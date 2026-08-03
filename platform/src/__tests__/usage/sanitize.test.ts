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
