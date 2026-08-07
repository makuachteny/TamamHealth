/**
 * Slot engine tests.
 *
 * The rule these are written to protect: a slot the engine offers must always
 * be a slot the booking guard accepts. Every test below is either "this
 * opening must be offered" or "this opening must NOT be offered" — there is no
 * third outcome worth having.
 */

import {
  computeSlots, expandWindows, windowIsEligible, reasonIsBookable,
  groupSlotsByDate, groupSlotsByProviderAndDate, slotIsStillOpen,
  filterSlotsByStaffAvailability,
  toMinutes, toHHMM, addDays, datesBetween, dayOfWeek, daysBetween,
  type SlotQuery,
} from '@/lib/booking/slot-engine';
import type { AppointmentDoc, AvailabilityDoc } from '@/lib/db-types';
import type { BookingPolicyDoc, SlotHoldDoc, VisitReasonDoc } from '@/lib/db-types-booking';

// ── Fixtures ───────────────────────────────────────────────────────────────

const NOW_ISO = '2026-08-07T06:00:00.000Z';
const NOW = { date: '2026-08-07', time: '06:00' };   // a Friday

function policy(overrides: Partial<BookingPolicyDoc> = {}): BookingPolicyDoc {
  return {
    _id: 'policy-1',
    type: 'booking_policy',
    orgId: 'org-1',
    facilityId: 'fac-1',
    onlineBookingEnabled: true,
    confirmationMode: 'request',
    minLeadTimeMinutes: 0,
    maxAdvanceDays: 90,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    defaultCapacity: 1,
    cancellationWindowHours: 24,
    requireInsurance: false,
    singleSlotPerFacility: false,
    consentTextPrivacy: 'privacy',
    consentTextSms: 'sms',
    publicSlug: 'demo-practice',
    embedAllowedOrigins: [],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function reason(overrides: Partial<VisitReasonDoc> = {}): VisitReasonDoc {
  return {
    _id: 'reason-1',
    type: 'visit_reason',
    orgId: 'org-1',
    name: 'Annual Visit',
    slug: 'annual-visit',
    durationMinutes: 30,
    availableToNewPatients: true,
    availableToReturningPatients: true,
    modality: 'both',
    providerIds: [],
    department: 'Outpatient',
    appointmentType: 'general',
    sortOrder: 1,
    isActive: true,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function window(overrides: Partial<AvailabilityDoc> = {}): AvailabilityDoc {
  return {
    _id: 'avail-1',
    type: 'availability',
    providerId: 'doc-1',
    providerName: 'Dr. Achol Mayen',
    facilityId: 'fac-1',
    facilityName: 'Juba Teaching Hospital',
    date: '2026-08-10',
    startTime: '08:00',
    endTime: '12:00',
    slotMinutes: 30,
    modality: 'in_person',
    status: 'open',
    orgId: 'org-1',
    bookableOnline: true,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function appointment(overrides: Partial<AppointmentDoc> = {}): AppointmentDoc {
  return {
    _id: 'apt-1',
    type: 'appointment',
    patientId: 'pat-1',
    patientName: 'Test Patient',
    providerId: 'doc-1',
    providerName: 'Dr. Achol Mayen',
    facilityId: 'fac-1',
    facilityName: 'Juba Teaching Hospital',
    facilityLevel: 'county',
    appointmentDate: '2026-08-10',
    appointmentTime: '09:00',
    duration: 30,
    appointmentType: 'general',
    priority: 'routine',
    department: 'Outpatient',
    reason: 'Review',
    status: 'scheduled',
    reminderSent: false,
    isRecurring: false,
    bookedBy: 'user-1',
    bookedByName: 'Desk',
    state: 'Central Equatoria',
    orgId: 'org-1',
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function hold(overrides: Partial<SlotHoldDoc> = {}): SlotHoldDoc {
  return {
    _id: 'hold-1',
    type: 'slot_hold',
    orgId: 'org-1',
    facilityId: 'fac-1',
    providerId: 'doc-1',
    date: '2026-08-10',
    startTime: '10:00',
    durationMinutes: 30,
    expiresAt: '2026-08-07T06:10:00.000Z',
    holdToken: 'tok',
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

const baseQuery: SlotQuery = {
  from: '2026-08-10',
  to: '2026-08-10',
  now: NOW,
  visitReason: reason(),
  patientClass: 'new',
  modality: 'in_person',
  channel: 'public',
};

function run(
  opts: {
    windows?: AvailabilityDoc[];
    appointments?: AppointmentDoc[];
    holds?: SlotHoldDoc[];
    policy?: BookingPolicyDoc;
    query?: Partial<SlotQuery>;
  } = {},
) {
  return computeSlots(
    opts.windows ?? [window()],
    opts.appointments ?? [],
    opts.holds ?? [],
    opts.policy ?? policy(),
    { ...baseQuery, ...opts.query },
    NOW_ISO,
  );
}

const times = (slots: { startTime: string }[]) => slots.map(s => s.startTime);

// ═══════════════════════════════════════════════════════════════════════════

describe('time helpers', () => {
  it('parses and formats HH:MM', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('00:00')).toBe(0);
    expect(toHHMM(570)).toBe('09:30');
    expect(toHHMM(0)).toBe('00:00');
  });

  it('rejects malformed times rather than guessing', () => {
    expect(toMinutes('')).toBeNaN();
    expect(toMinutes('9am')).toBeNaN();
    expect(toMinutes('25:00')).toBeNaN();
    expect(toMinutes('09:60')).toBeNaN();
  });

  it('walks dates across month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days across a month boundary correctly', () => {
    // The naive Date.UTC(y, m, d) form gets this wrong; February is why.
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-08-07', '2026-08-10')).toBe(3);
    expect(daysBetween('2026-08-10', '2026-08-07')).toBe(-3);
  });

  it('knows the day of week without local-timezone drift', () => {
    expect(dayOfWeek('2026-08-07')).toBe(5);   // Friday
    expect(dayOfWeek('2026-08-09')).toBe(0);   // Sunday
  });

  it('enumerates an inclusive date range', () => {
    expect(datesBetween('2026-08-07', '2026-08-10'))
      .toEqual(['2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10']);
    expect(datesBetween('2026-08-10', '2026-08-07')).toEqual([]);
  });
});

describe('slicing a window', () => {
  it('steps by the visit reason duration, not the window slotMinutes', () => {
    const slots = run({
      windows: [window({ startTime: '08:00', endTime: '09:00', slotMinutes: 30 })],
      query: { visitReason: reason({ durationMinutes: 20 }) },
    });
    expect(times(slots)).toEqual(['08:00', '08:20', '08:40']);
  });

  it('never emits a slot that would run past the window', () => {
    const slots = run({
      windows: [window({ startTime: '08:00', endTime: '08:50' })],
      query: { visitReason: reason({ durationMinutes: 30 }) },
    });
    expect(times(slots)).toEqual(['08:00']);   // 08:30–09:00 would overrun
  });

  it('renders a lunch gap as absent slots, not as a hole in a fixed grid', () => {
    const slots = run({
      windows: [
        window({ _id: 'a', startTime: '08:00', endTime: '10:00' }),
        window({ _id: 'b', startTime: '13:00', endTime: '14:00' }),
      ],
    });
    expect(times(slots)).toEqual(['08:00', '08:30', '09:00', '09:30', '13:00', '13:30']);
  });

  it('ignores a window whose end is not after its start', () => {
    expect(run({ windows: [window({ startTime: '12:00', endTime: '12:00' })] })).toEqual([]);
    expect(run({ windows: [window({ startTime: '12:00', endTime: '09:00' })] })).toEqual([]);
  });

  it('returns nothing for a zero or negative duration instead of looping', () => {
    expect(run({ query: { visitReason: reason({ durationMinutes: 0 }) } })).toEqual([]);
    expect(run({ query: { visitReason: reason({ durationMinutes: -30 }) } })).toEqual([]);
  });
});

describe('recurrence', () => {
  const weekly = window({
    date: '2026-08-03',                    // Monday
    recurrence: { daysOfWeek: [1, 3, 5], until: '2026-08-31' },
    startTime: '08:00',
    endTime: '09:00',
  });

  it('expands to the named weekdays only', () => {
    const expanded = expandWindows([weekly], '2026-08-10', '2026-08-16');
    expect(expanded.map(e => e.date)).toEqual(['2026-08-10', '2026-08-12', '2026-08-14']);
  });

  it('honours exceptions', () => {
    const withException = {
      ...weekly,
      recurrence: { ...weekly.recurrence!, exceptions: ['2026-08-12'] },
    };
    const expanded = expandWindows([withException], '2026-08-10', '2026-08-16');
    expect(expanded.map(e => e.date)).toEqual(['2026-08-10', '2026-08-14']);
  });

  it('does not run before the series start or after `until`', () => {
    const expanded = expandWindows([weekly], '2026-07-01', '2026-09-30');
    expect(expanded[0].date).toBe('2026-08-03');
    expect(expanded[expanded.length - 1].date).toBe('2026-08-31');
  });

  it('leaves a non-recurring window covering exactly its own date', () => {
    const expanded = expandWindows([window({ date: '2026-08-10' })], '2026-08-01', '2026-08-31');
    expect(expanded.map(e => e.date)).toEqual(['2026-08-10']);
  });

  it('skips a cancelled window entirely', () => {
    expect(expandWindows([window({ status: 'cancelled' })], '2026-08-01', '2026-08-31')).toEqual([]);
  });

  it('produces slots across a multi-day range', () => {
    const slots = run({
      windows: [weekly],
      query: { from: '2026-08-10', to: '2026-08-14' },
    });
    expect([...new Set(slots.map(s => s.date))]).toEqual(['2026-08-10', '2026-08-12', '2026-08-14']);
  });
});

describe('occupancy', () => {
  it('drops a slot taken by an existing booking', () => {
    const slots = run({ appointments: [appointment({ appointmentTime: '09:00' })] });
    expect(times(slots)).not.toContain('09:00');
    expect(times(slots)).toContain('09:30');
  });

  it('releases the slot again when that booking is cancelled or a no-show', () => {
    for (const status of ['cancelled', 'no_show', 'rescheduled'] as const) {
      const slots = run({ appointments: [appointment({ status })] });
      expect(times(slots)).toContain('09:00');
    }
  });

  it('does not let one provider block another at the same time', () => {
    const slots = run({
      windows: [window({ _id: 'w1', providerId: 'doc-1' }), window({ _id: 'w2', providerId: 'doc-2', providerName: 'Dr. Wani' })],
      appointments: [appointment({ providerId: 'doc-1' })],
    });
    const nine = slots.filter(s => s.startTime === '09:00');
    expect(nine.map(s => s.providerId)).toEqual(['doc-2']);
  });

  it('applies facility-wide exclusivity only when the policy asks for it', () => {
    const args = {
      windows: [window({ _id: 'w1', providerId: 'doc-1' }), window({ _id: 'w2', providerId: 'doc-2', providerName: 'Dr. Wani' })],
      appointments: [appointment({ providerId: 'doc-1' })],
    };
    const strict = run({ ...args, policy: policy({ singleSlotPerFacility: true }) });
    expect(strict.filter(s => s.startTime === '09:00')).toHaveLength(0);
  });

  it('blocks a shared room even across providers', () => {
    const slots = run({
      windows: [window({ providerId: 'doc-2', providerName: 'Dr. Wani', roomId: 'room-3' })],
      appointments: [appointment({ providerId: 'doc-1', room: 'room-3' })],
    });
    expect(times(slots)).not.toContain('09:00');
  });

  it('honours capacity greater than one', () => {
    const slots = run({
      windows: [window({ capacity: 2 })],
      appointments: [appointment({ appointmentTime: '09:00' })],
    });
    const nine = slots.find(s => s.startTime === '09:00');
    expect(nine?.capacityLeft).toBe(1);
  });

  it('closes a slot once capacity is used up', () => {
    const slots = run({
      windows: [window({ capacity: 2 })],
      appointments: [
        appointment({ _id: 'a', appointmentTime: '09:00' }),
        appointment({ _id: 'b', appointmentTime: '09:00', patientId: 'pat-2' }),
      ],
    });
    expect(times(slots)).not.toContain('09:00');
  });

  it('treats a partially overlapping booking as blocking', () => {
    // A 45-minute booking at 09:15 covers part of both 09:00 and 09:30.
    const slots = run({ appointments: [appointment({ appointmentTime: '09:15', duration: 45 })] });
    expect(times(slots)).not.toContain('09:00');
    expect(times(slots)).not.toContain('09:30');
    expect(times(slots)).toContain('10:00');
  });

  it('does not block a slot that merely abuts a booking', () => {
    const slots = run({ appointments: [appointment({ appointmentTime: '08:30', duration: 30 })] });
    expect(times(slots)).toContain('09:00');   // 08:30–09:00 ends exactly at 09:00
    expect(times(slots)).toContain('08:00');
  });
});

describe('buffers', () => {
  it('keeps a turnaround gap after a booking', () => {
    const slots = run({
      policy: policy({ bufferAfterMinutes: 15 }),
      appointments: [appointment({ appointmentTime: '09:00', duration: 30 })],
    });
    expect(times(slots)).not.toContain('09:30');   // 09:30 falls inside the 15-min tail
    expect(times(slots)).toContain('10:00');
  });

  it('keeps a preparation gap before a booking', () => {
    const slots = run({
      policy: policy({ bufferBeforeMinutes: 15 }),
      appointments: [appointment({ appointmentTime: '09:00', duration: 30 })],
    });
    expect(times(slots)).not.toContain('08:30');
    expect(times(slots)).toContain('08:00');
  });
});

describe('holds', () => {
  it('blocks a slot held by someone mid-form', () => {
    const slots = run({ holds: [hold({ startTime: '10:00' })] });
    expect(times(slots)).not.toContain('10:00');
  });

  it('ignores an expired hold', () => {
    const slots = run({ holds: [hold({ expiresAt: '2026-08-07T05:59:00.000Z' })] });
    expect(times(slots)).toContain('10:00');
  });

  it('ignores a hold already turned into a booking', () => {
    const slots = run({ holds: [hold({ consumedAt: NOW_ISO })] });
    expect(times(slots)).toContain('10:00');
  });
});

describe('lead time and horizon', () => {
  it('excludes slots inside the lead time', () => {
    const slots = run({
      policy: policy({ minLeadTimeMinutes: 240 }),
      windows: [window({ date: '2026-08-07', startTime: '08:00', endTime: '12:00' })],
      query: { from: '2026-08-07', to: '2026-08-07' },
    });
    // now = 06:00, so anything before 10:00 is inside the 4-hour lead.
    expect(times(slots)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('treats a slot exactly at the lead-time cutoff as bookable', () => {
    const slots = run({
      policy: policy({ minLeadTimeMinutes: 120 }),
      windows: [window({ date: '2026-08-07', startTime: '08:00', endTime: '09:00' })],
      query: { from: '2026-08-07', to: '2026-08-07' },
    });
    expect(times(slots)).toContain('08:00');   // exactly 120 minutes away
  });

  it('excludes slots already in the past today', () => {
    const slots = run({
      windows: [window({ date: '2026-08-07', startTime: '05:00', endTime: '08:00' })],
      query: { from: '2026-08-07', to: '2026-08-07' },
    });
    expect(times(slots)).toEqual(['06:00', '06:30', '07:00', '07:30']);
  });

  it('clamps the public horizon to maxAdvanceDays', () => {
    const slots = run({
      policy: policy({ maxAdvanceDays: 7 }),
      windows: [window({ date: '2026-09-30' })],
      query: { from: '2026-08-07', to: '2026-12-31' },
    });
    expect(slots).toEqual([]);
  });

  it('lets staff book beyond the public horizon and lead time', () => {
    const slots = run({
      policy: policy({ maxAdvanceDays: 7, minLeadTimeMinutes: 10_000 }),
      windows: [window({ date: '2026-09-30', bookableOnline: false })],
      query: { from: '2026-08-07', to: '2026-12-31', channel: 'staff' },
    });
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe('eligibility', () => {
  it('hides windows not opened to online booking from the public', () => {
    expect(run({ windows: [window({ bookableOnline: undefined })] })).toEqual([]);
    expect(run({ windows: [window({ bookableOnline: false })] })).toEqual([]);
  });

  it('still lets staff book an internal window', () => {
    const slots = run({
      windows: [window({ bookableOnline: undefined })],
      query: { channel: 'staff' },
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it('returns nothing when online booking is switched off', () => {
    expect(run({ policy: policy({ onlineBookingEnabled: false }) })).toEqual([]);
  });

  it('still serves staff when online booking is switched off', () => {
    const slots = run({
      policy: policy({ onlineBookingEnabled: false }),
      query: { channel: 'staff' },
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it('matches modality between window, reason and request', () => {
    expect(run({ windows: [window({ modality: 'telehealth' })] })).toEqual([]);
    expect(run({
      windows: [window({ modality: 'telehealth' })],
      query: { modality: 'telehealth' },
    }).length).toBeGreaterThan(0);
    expect(run({
      query: { visitReason: reason({ modality: 'telehealth' }) },
    })).toEqual([]);
  });

  it('respects a window reserved for one patient class', () => {
    expect(run({ windows: [window({ patientClass: 'returning' })] })).toEqual([]);
    expect(run({
      windows: [window({ patientClass: 'returning' })],
      query: { patientClass: 'returning' },
    }).length).toBeGreaterThan(0);
  });

  it('respects a reason not offered to new patients', () => {
    expect(run({
      query: { visitReason: reason({ availableToNewPatients: false }) },
    })).toEqual([]);
  });

  it('respects a window restricted to particular reasons', () => {
    expect(run({ windows: [window({ visitReasonIds: ['reason-other'] })] })).toEqual([]);
    expect(run({ windows: [window({ visitReasonIds: ['reason-1'] })] }).length).toBeGreaterThan(0);
  });

  it('respects a reason restricted to particular providers', () => {
    expect(run({
      query: { visitReason: reason({ providerIds: ['doc-9'] }) },
    })).toEqual([]);
  });

  it('never offers an inactive reason', () => {
    expect(run({ query: { visitReason: reason({ isActive: false }) } })).toEqual([]);
  });

  it('filters by requested facility and provider', () => {
    const windows = [
      window({ _id: 'w1', providerId: 'doc-1', facilityId: 'fac-1' }),
      window({ _id: 'w2', providerId: 'doc-2', providerName: 'Dr. Wani', facilityId: 'fac-2' }),
    ];
    expect(run({ windows, query: { providerIds: ['doc-2'] } }).every(s => s.providerId === 'doc-2')).toBe(true);
    expect(run({ windows, query: { facilityIds: ['fac-2'] } }).every(s => s.facilityId === 'fac-2')).toBe(true);
  });

  it('judges a single window the same way through the helper', () => {
    const q = { ...baseQuery, channel: 'public' as const };
    expect(windowIsEligible(window(), q)).toBe(true);
    expect(windowIsEligible(window({ status: 'cancelled' }), q)).toBe(false);
    expect(reasonIsBookable(q)).toBe(true);
  });
});

describe('output shape', () => {
  it('sorts by date, then time, then provider', () => {
    const slots = run({
      windows: [
        window({ _id: 'w2', providerId: 'doc-2', providerName: 'Dr. Zachary', startTime: '08:00', endTime: '09:00' }),
        window({ _id: 'w1', providerId: 'doc-1', providerName: 'Dr. Achol', startTime: '08:00', endTime: '09:00' }),
      ],
    });
    expect(slots.map(s => `${s.startTime} ${s.providerName}`)).toEqual([
      '08:00 Dr. Achol', '08:00 Dr. Zachary', '08:30 Dr. Achol', '08:30 Dr. Zachary',
    ]);
  });

  it('collapses duplicate openings from overlapping windows', () => {
    const slots = run({
      windows: [
        window({ _id: 'w1', startTime: '08:00', endTime: '09:00' }),
        window({ _id: 'w2', startTime: '08:00', endTime: '09:00' }),
      ],
    });
    expect(times(slots)).toEqual(['08:00', '08:30']);
  });

  it('carries the end time and duration of each slot', () => {
    const [first] = run({ query: { visitReason: reason({ durationMinutes: 45 }) } });
    expect(first.startTime).toBe('08:00');
    expect(first.endTime).toBe('08:45');
    expect(first.durationMinutes).toBe(45);
  });

  it('groups by date', () => {
    const slots = run({
      windows: [window({ recurrence: { daysOfWeek: [1, 3], until: '2026-08-31' }, date: '2026-08-03', startTime: '08:00', endTime: '09:00' })],
      query: { from: '2026-08-10', to: '2026-08-14' },
    });
    const grouped = groupSlotsByDate(slots);
    expect([...grouped.keys()]).toEqual(['2026-08-10', '2026-08-12']);
    expect(grouped.get('2026-08-10')).toHaveLength(2);
  });

  it('groups by provider then date, which is what the week grid needs', () => {
    const slots = run({
      windows: [
        window({ _id: 'w1', providerId: 'doc-1', startTime: '08:00', endTime: '09:00' }),
        window({ _id: 'w2', providerId: 'doc-2', providerName: 'Dr. Wani', startTime: '08:00', endTime: '08:30' }),
      ],
    });
    const grouped = groupSlotsByProviderAndDate(slots);
    expect(grouped.get('doc-1')?.get('2026-08-10')).toHaveLength(2);
    expect(grouped.get('doc-2')?.get('2026-08-10')).toHaveLength(1);
  });
});

describe('second staff member (nurse, interpreter, scribe)', () => {
  const slots = () => run();   // 08:00–12:00, 30 min, doc-1

  it('leaves the grid alone when no second person is named', () => {
    expect(filterSlotsByStaffAvailability(slots(), '', [], [], policy(), NOW_ISO)).toHaveLength(slots().length);
  });

  it('does not empty the grid for staff who have no roster recorded', () => {
    // No availability windows for nurse-1 — that is missing information about
    // her hours, not evidence she is busy.
    const filtered = filterSlotsByStaffAvailability(slots(), 'nurse-1', [], [], policy(), NOW_ISO);
    expect(filtered).toHaveLength(slots().length);
  });

  it('restricts to the roster once that person has one', () => {
    const nurseWindow = window({ _id: 'nw', providerId: 'nurse-1', startTime: '10:00', endTime: '12:00' });
    const filtered = filterSlotsByStaffAvailability(slots(), 'nurse-1', [nurseWindow], [], policy(), NOW_ISO);
    expect(times(filtered)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('drops a slot where that person is already the clinician elsewhere', () => {
    const busy = [appointment({ providerId: 'nurse-1', appointmentTime: '09:00' })];
    const filtered = filterSlotsByStaffAvailability(slots(), 'nurse-1', [], busy, policy(), NOW_ISO);
    expect(times(filtered)).not.toContain('09:00');
    expect(times(filtered)).toContain('09:30');
  });

  it('drops a slot where that person is already the SECOND staff elsewhere', () => {
    // The case a provider-only check misses: the nurse is free as a clinician
    // but already assigned to another doctor's visit.
    const busy = [appointment({ providerId: 'doc-9', staffId: 'nurse-1', appointmentTime: '09:00' })];
    const filtered = filterSlotsByStaffAvailability(slots(), 'nurse-1', [], busy, policy(), NOW_ISO);
    expect(times(filtered)).not.toContain('09:00');
  });

  it('honours buffers around that person’s other commitments', () => {
    const busy = [appointment({ providerId: 'nurse-1', appointmentTime: '09:00', duration: 30 })];
    const filtered = filterSlotsByStaffAvailability(
      slots(), 'nurse-1', [], busy, policy({ bufferAfterMinutes: 15 }), NOW_ISO);
    expect(times(filtered)).not.toContain('09:30');
    expect(times(filtered)).toContain('10:00');
  });

  it('expands a recurring roster like any other window', () => {
    const weekly = window({
      _id: 'nw', providerId: 'nurse-1', date: '2026-08-03',
      recurrence: { daysOfWeek: [1], until: '2026-08-31' },     // Mondays only
      startTime: '08:00', endTime: '12:00',
    });
    const monday = run({ query: { from: '2026-08-10', to: '2026-08-10' }, windows: [window({ date: '2026-08-10' })] });
    const filtered = filterSlotsByStaffAvailability(monday, 'nurse-1', [weekly], [], policy(), NOW_ISO);
    expect(filtered.length).toBe(monday.length);

    const saturday = run();   // 2026-08-10 is Monday; base run is 2026-08-10 too
    expect(filterSlotsByStaffAvailability(saturday, 'nurse-1', [weekly], [], policy(), NOW_ISO).length)
      .toBe(saturday.length);
  });

  it('excludes a named appointment, so rescheduling does not block itself', () => {
    const busy = [appointment({ _id: 'apt-self', providerId: 'nurse-1', appointmentTime: '09:00' })];
    const filtered = filterSlotsByStaffAvailability(slots(), 'nurse-1', [], busy, policy(), NOW_ISO, 'apt-self');
    expect(times(filtered)).toContain('09:00');
  });
});

describe('slotIsStillOpen', () => {
  const candidate = { providerId: 'doc-1', date: '2026-08-10', startTime: '09:00' };

  it('confirms a free slot', () => {
    expect(slotIsStillOpen(candidate, [window()], [], [], policy(), baseQuery, NOW_ISO)).toBe(true);
  });

  it('rejects a slot taken since the hold was made', () => {
    const taken = [appointment({ appointmentTime: '09:00' })];
    expect(slotIsStillOpen(candidate, [window()], taken, [], policy(), baseQuery, NOW_ISO)).toBe(false);
  });

  it('rejects a slot that never existed', () => {
    const bogus = { ...candidate, startTime: '09:07' };
    expect(slotIsStillOpen(bogus, [window()], [], [], policy(), baseQuery, NOW_ISO)).toBe(false);
  });

  it('rejects a slot for a provider who is not the one being booked', () => {
    const other = { ...candidate, providerId: 'doc-9' };
    expect(slotIsStillOpen(other, [window()], [], [], policy(), baseQuery, NOW_ISO)).toBe(false);
  });
});
