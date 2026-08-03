import {
  looksLikeId,
  templatePath,
  scrubMeta,
  sanitizeUsageEvent,
  describeElement,
  truncateLabel,
} from '@/lib/usage/sanitize';

describe('usage sanitize', () => {
  test('templates UUID and opaque patient ids in paths', () => {
    expect(templatePath('/patients/550e8400-e29b-41d4-a716-446655440000')).toBe('/patients/[id]');
    expect(templatePath('/patients/JTH-00042/edit')).toBe('/patients/[id]/edit');
    expect(templatePath('/admin/analytics')).toBe('/admin/analytics');
    expect(templatePath('/patients/new')).toBe('/patients/new');
  });

  test('looksLikeId rejects static segments', () => {
    expect(looksLikeId('patients')).toBe(false);
    expect(looksLikeId('new')).toBe(false);
    expect(looksLikeId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('scrubMeta drops PHI keys and keeps safe fields', () => {
    const scrubbed = scrubMeta({
      email: 'a@b.com',
      phone: '123',
      feature: 'search',
      count: 3,
      passwordHash: 'x',
      notes: 'clinical',
    });
    expect(scrubbed).toEqual({ feature: 'search', count: 3 });
  });

  test('sanitizeUsageEvent stamps path template and rejects bad events', () => {
    expect(sanitizeUsageEvent(null)).toBeNull();
    expect(sanitizeUsageEvent({ eventName: 'click' })).toBeNull();

    const ok = sanitizeUsageEvent({
      eventName: 'page_view',
      path: '/patients/user-001',
      sessionId: 'sess-1',
      ts: '2026-07-29T12:00:00.000Z',
      meta: { email: 'x@y.z', tab: 'overview' },
    });
    expect(ok).not.toBeNull();
    expect(ok!.path).toBe('/patients/[id]');
    expect(ok!.meta).toEqual({ tab: 'overview' });
  });

  test('truncateLabel caps length', () => {
    expect(truncateLabel('a'.repeat(100)).length).toBeLessThanOrEqual(40);
  });

  test('describeElement prefers data-track', () => {
    document.body.innerHTML = `
      <div data-track="patient.create">
        <button type="button">Register</button>
      </div>
    `;
    const btn = document.querySelector('button');
    expect(describeElement(btn)).toBe('patient.create');
  });
});

/**
 * PHI regression cover.
 *
 * describeElement used to fall back to the element's textContent (and
 * aria-label) when no data-track ancestor existed. On a patient list the link
 * text IS the patient's name, so every click wrote a direct identifier into
 * usage_events and — with PostHog configured — POSTed it to a third party.
 */
describe('usage sanitize — no PHI in element descriptors', () => {
  test('never captures link text, even when it is a patient name', () => {
    document.body.innerHTML = `
      <div class="patient-row">
        <a href="/patients/pat-00001">Deng Mabior Garang</a>
      </div>
    `;
    const link = document.querySelector('a');
    const descriptor = describeElement(link);
    expect(descriptor).not.toMatch(/deng|mabior|garang/i);
    expect(descriptor).toBe('a');
  });

  test('never captures aria-label, which names the patient on action buttons', () => {
    document.body.innerHTML = `
      <button type="button" aria-label="Open chart for Nyamal Koang Gatdet">Open</button>
    `;
    const btn = document.querySelector('button');
    const descriptor = describeElement(btn);
    expect(descriptor).not.toMatch(/nyamal|koang|gatdet/i);
    expect(descriptor).toBe('button|type=button');
  });

  test('drops a name attribute that looks like a PHI field', () => {
    document.body.innerHTML = `<input type="text" name="patientEmail" />`;
    const input = document.querySelector('input');
    expect(describeElement(input)).toBe('input|type=text');
  });

  test('keeps a non-PHI name attribute', () => {
    document.body.innerHTML = `<select name="ward"></select>`;
    expect(describeElement(document.querySelector('select'))).toBe('select|name=ward');
  });

  test('ingest rejects a free-text element from a stale or tampered client', () => {
    // The API runs sanitizeUsageEvent over client JSON, so a client still
    // sending textContent (or one deliberately posting PHI) must not persist it.
    const ev = sanitizeUsageEvent({
      eventName: 'click',
      path: '/patients/pat-00001',
      element: 'a|Deng Mabior Garang',
      sessionId: 'sess-1',
      ts: '2026-08-03T12:00:00.000Z',
    });
    expect(ev).not.toBeNull();
    expect(ev!.element).toBeUndefined();
    // The event itself still counts — only the unsafe descriptor is dropped.
    expect(ev!.path).toBe('/patients/[id]');
  });

  test('ingest keeps a well-formed machine descriptor', () => {
    const ev = sanitizeUsageEvent({
      eventName: 'click',
      path: '/pharmacy',
      element: 'button|type=submit|name=dispense',
      sessionId: 'sess-1',
      ts: '2026-08-03T12:00:00.000Z',
    });
    expect(ev!.element).toBe('button|type=submit|name=dispense');
  });
});
