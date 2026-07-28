/**
 * Patient-progress feed derivation.
 *
 * The property that matters most here is `approximate`. A document records its
 * CURRENT lifecycle stage, not when each stage was reached — only a few stages
 * carry their own stamp. Presenting a last-modified time as a precise clinical
 * event time would let someone read "dispensed at 14:32" off a record that
 * never claimed it, so every event has to declare which kind of time it holds.
 */

import {
  buildProgressFeed,
  progressFeedFor,
  relativeTime,
  PROGRESS_FEED_BY_ROLE,
} from '@/lib/clinical-flow/progress-feed';
import { hasRoleRouteConfig } from '@/lib/role-routes';

const NOW = Date.parse('2026-07-28T12:00:00.000Z');
const iso = (minsAgo: number) => new Date(NOW - minsAgo * 60_000).toISOString();

describe('timestamp honesty', () => {
  test('a triage stamp is exact, not approximate', () => {
    const [ev] = buildProgressFeed(
      { triages: [{ _id: 't1', patientId: 'p1', patientName: 'Achol Deng', triagedAt: iso(5), updatedAt: iso(1) }] },
      { nowMs: NOW },
    );
    expect(ev.approximate).toBe(false);
    // The stage stamp wins over the later modification time.
    expect(ev.at).toBe(iso(5));
  });

  test('a triage with no triagedAt falls back to updatedAt and says so', () => {
    const [ev] = buildProgressFeed(
      { triages: [{ _id: 't1', patientId: 'p1', patientName: 'Achol Deng', updatedAt: iso(5) }] },
      { nowMs: NOW },
    );
    expect(ev.approximate).toBe(true);
    expect(ev.at).toBe(iso(5));
  });

  test('a dispense uses dispensedAt exactly', () => {
    const [ev] = buildProgressFeed(
      { prescriptions: [{ _id: 'r1', patientId: 'p1', patientName: 'Achol Deng', orderStatus: 'dispensed', dispensedAt: iso(9), updatedAt: iso(2) }] },
      { nowMs: NOW },
    );
    expect(ev.approximate).toBe(false);
    expect(ev.at).toBe(iso(9));
  });

  test('a stage with no stamp of its own is approximate', () => {
    // `cleared_for_dispensing` has no dedicated timestamp anywhere in the
    // schema, so the only honest answer is "the record changed then".
    const [ev] = buildProgressFeed(
      { prescriptions: [{ _id: 'r1', patientId: 'p1', patientName: 'A', orderStatus: 'cleared_for_dispensing', updatedAt: iso(3) }] },
      { nowMs: NOW },
    );
    expect(ev.approximate).toBe(true);
  });

  test('a resulted lab uses completedAt; a collected specimen cannot', () => {
    const events = buildProgressFeed(
      {
        labs: [
          { _id: 'l1', patientId: 'p1', patientName: 'A', orderStatus: 'resulted', completedAt: iso(8), updatedAt: iso(1) },
          { _id: 'l2', patientId: 'p2', patientName: 'B', orderStatus: 'specimen_collected', updatedAt: iso(4) },
        ],
      },
      { nowMs: NOW },
    );
    const resulted = events.find(e => e.kind === 'lab_resulted')!;
    const collected = events.find(e => e.kind === 'specimen_collected')!;
    expect(resulted.approximate).toBe(false);
    expect(resulted.at).toBe(iso(8));
    expect(collected.approximate).toBe(true);
  });
});

describe('event derivation', () => {
  test('maps each lifecycle stage to a readable phrase', () => {
    const events = buildProgressFeed(
      {
        prescriptions: [
          { _id: 'a', patientId: 'p', patientName: 'A', orderStatus: 'dispensed', dispensedAt: iso(1) },
          { _id: 'b', patientId: 'p', patientName: 'B', orderStatus: 'stockout_partial_referred', updatedAt: iso(2) },
        ],
      },
      { nowMs: NOW },
    );
    expect(events.find(e => e.kind === 'dispensed')!.label).toBe('dispensed');
    expect(events.find(e => e.kind === 'stockout')!.label).toMatch(/stockout/i);
  });

  test('counseled and complete still count as dispensed', () => {
    // The drug reached the patient; the later stages are follow-through.
    for (const orderStatus of ['counseled', 'complete'] as const) {
      const [ev] = buildProgressFeed(
        { prescriptions: [{ _id: 'r', patientId: 'p', patientName: 'A', orderStatus, dispensedAt: iso(1) }] },
        { nowMs: NOW },
      );
      expect(ev.kind).toBe('dispensed');
    }
  });

  test('a legacy lab result with no orderStatus is not dropped', () => {
    // `orderStatus` is optional and most stored results predate it — reading
    // it alone left the lab's own feed permanently empty.
    const [ev] = buildProgressFeed(
      { labs: [{ _id: 'l', patientId: 'p', patientName: 'A', status: 'completed', completedAt: iso(4) }] },
      { nowMs: NOW },
    );
    expect(ev.kind).toBe('lab_resulted');
    expect(ev.approximate).toBe(false);
  });

  test('a legacy lab still pending produces nothing', () => {
    const events = buildProgressFeed(
      { labs: [{ _id: 'l', patientId: 'p', patientName: 'A', status: 'pending', updatedAt: iso(1) }] },
      { nowMs: NOW },
    );
    expect(events).toEqual([]);
  });

  test('a legacy prescription with no orderStatus is not dropped', () => {
    // Records predating the granular lifecycle only carry the coarse field.
    // Dropping them would blank the feed on historical data.
    const [ev] = buildProgressFeed(
      { prescriptions: [{ _id: 'r', patientId: 'p', patientName: 'A', status: 'dispensed', dispensedAt: iso(3) }] },
      { nowMs: NOW },
    );
    expect(ev.kind).toBe('dispensed');
  });

  test('stages that are not progress milestones produce nothing', () => {
    const events = buildProgressFeed(
      {
        labs: [{ _id: 'l', patientId: 'p', patientName: 'A', orderStatus: 'ordered', updatedAt: iso(1) }],
        prescriptions: [{ _id: 'r', patientId: 'p', patientName: 'A', orderStatus: 'under_review', updatedAt: iso(1) }],
      },
      { nowMs: NOW },
    );
    expect(events).toEqual([]);
  });

  test('newest first', () => {
    const events = buildProgressFeed(
      {
        triages: [
          { _id: 'old', patientId: 'p1', patientName: 'Old', triagedAt: iso(120) },
          { _id: 'new', patientId: 'p2', patientName: 'New', triagedAt: iso(2) },
        ],
      },
      { nowMs: NOW },
    );
    expect(events.map(e => e.patientName)).toEqual(['New', 'Old']);
  });

  test('carries the patient through to a usable link', () => {
    const [ev] = buildProgressFeed(
      { triages: [{ _id: 't', patientId: 'pat-77', patientName: 'A', triagedAt: iso(1) }] },
      { nowMs: NOW },
    );
    expect(ev.patientId).toBe('pat-77');
    expect(ev.href).toContain('pat-77');
  });
});

describe('the window', () => {
  test('drops anything older than the window', () => {
    const events = buildProgressFeed(
      { triages: [{ _id: 't', patientId: 'p', patientName: 'A', triagedAt: iso(60 * 24) }] },
      { nowMs: NOW },
    );
    expect(events).toEqual([]);
  });

  test('honours a caller-supplied window', () => {
    const input = { triages: [{ _id: 't', patientId: 'p', patientName: 'A', triagedAt: iso(90) }] };
    expect(buildProgressFeed(input, { nowMs: NOW, windowMs: 60 * 60_000 })).toEqual([]);
    expect(buildProgressFeed(input, { nowMs: NOW, windowMs: 120 * 60_000 })).toHaveLength(1);
  });

  test('keeps a future-dated event rather than hiding it', () => {
    // A tablet with a skewed clock is a real field condition. Hiding the
    // record would be worse than showing it slightly out of order.
    const [ev] = buildProgressFeed(
      { triages: [{ _id: 't', patientId: 'p', patientName: 'A', triagedAt: iso(-30) }] },
      { nowMs: NOW },
    );
    expect(ev).toBeDefined();
  });

  test('an unparseable timestamp is dropped, not rendered as NaN', () => {
    const events = buildProgressFeed(
      { triages: [{ _id: 't', patientId: 'p', patientName: 'A', triagedAt: 'not-a-date' }] },
      { nowMs: NOW },
    );
    expect(events).toEqual([]);
  });
});

describe('per-role configuration', () => {
  test('every configured key is a role the app actually assigns', () => {
    // This is the test that was missing. The first version keyed the map by
    // `lab_technician`; the real role is `lab_tech`, so the lab's card never
    // rendered — and the unit tests still passed, because they asserted
    // against the same invented string. Checking against the ROUTE TABLE
    // instead grounds the map in something external to this module.
    for (const role of Object.keys(PROGRESS_FEED_BY_ROLE)) {
      expect(hasRoleRouteConfig(role)).toBe(true);
    }
  });

  test('each configured role has a title and at least one kind', () => {
    for (const [role, cfg] of Object.entries(PROGRESS_FEED_BY_ROLE)) {
      expect(cfg.title.length).toBeGreaterThan(0);
      expect(cfg.kinds.length).toBeGreaterThan(0);
      expect(role).not.toBe('');
    }
  });

  test('roles see the slice their station cares about', () => {
    expect(progressFeedFor('pharmacist')!.kinds).toContain('dispensed');
    expect(progressFeedFor('lab_tech')!.kinds).toContain('specimen_collected');
    // The pharmacy has no reason to watch specimens.
    expect(progressFeedFor('pharmacist')!.kinds).not.toContain('specimen_collected');
  });

  test('titles are role-specific, not a generic "Activity"', () => {
    expect(progressFeedFor('pharmacist')!.title).not.toBe(progressFeedFor('lab_tech')!.title);
  });

  test('a role with no configured feed returns null', () => {
    // Governance/aggregate roles are deliberately absent: a named-patient feed
    // on a geographic dashboard crosses the scope boundary.
    expect(progressFeedFor('government_official')).toBeNull();
    expect(progressFeedFor('super_admin')).toBeNull();
    expect(progressFeedFor(undefined)).toBeNull();
  });
});

describe('relativeTime', () => {
  test.each([
    [0, 'just now'],
    [1, '1m ago'],
    [59, '59m ago'],
    [60, '1h ago'],
    [60 * 25, '1d ago'],
  ])('%s minutes ago → %s', (mins, expected) => {
    expect(relativeTime(iso(mins), NOW)).toBe(expected);
  });

  test('returns empty for an unparseable value rather than "NaN ago"', () => {
    expect(relativeTime('nope', NOW)).toBe('');
  });
});
