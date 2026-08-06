/**
 * The status vocabulary is consumed by the front desk, the clinician chart, the
 * appointments list and the calendar, so the invariants they all rely on are
 * pinned here: every status is labelled and coloured, the desk's dropdown is
 * the reference ladder in the reference order, and the group sets stay disjoint
 * where the UI assumes they are.
 */
import {
  APPOINTMENT_STATUS_FLOW,
  APPOINTMENT_STATUS_EXITS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_I18N_KEYS,
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_TONES,
  APPOINTMENT_PRESENT_STATUSES,
  APPOINTMENT_CHECKED_IN_STATUSES,
  APPOINTMENT_CLOSED_STATUSES,
  APPOINTMENT_PENDING_STATUSES,
  APPOINTMENT_STATUS_GROUPS,
  APPOINTMENT_STATUS_GROUP_LABELS,
  appointmentStatusGroup,
  appointmentStatusLabel,
  priorAppointmentStatus,
  canonicalAppointmentStatus,
} from '../lib/appointment-status';
import type { AppointmentStatus } from '../lib/db-types';
import en from '../lib/i18n/locales/en';

const ALL_STATUSES = Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[];

describe('appointment status dropdown', () => {
  it('offers the simplified front desk ladder in order, exits last', () => {
    expect(APPOINTMENT_STATUS_OPTIONS.map(s => APPOINTMENT_STATUS_LABELS[s])).toEqual([
      'Scheduled',
      'Checked In',
      'In Progress',
      'Completed',
      'No Show',
      'Rescheduled',
      'Cancelled',
    ]);
  });

  it('folds every fine-grained status into a rung the ladder still offers', () => {
    // System events keep writing reminder_sent / confirmed / arrived /
    // triaged; each must display and file as one of the four offered rungs.
    for (const status of ALL_STATUSES) {
      if (status === 'requested' || APPOINTMENT_STATUS_EXITS.includes(status)) continue;
      expect(APPOINTMENT_STATUS_FLOW).toContain(canonicalAppointmentStatus(status));
    }
    // ...and wears that rung's label, so pills and pickers agree.
    expect(APPOINTMENT_STATUS_LABELS.reminder_sent).toBe(APPOINTMENT_STATUS_LABELS.scheduled);
    expect(APPOINTMENT_STATUS_LABELS.confirmed).toBe(APPOINTMENT_STATUS_LABELS.scheduled);
    expect(APPOINTMENT_STATUS_LABELS.arrived).toBe(APPOINTMENT_STATUS_LABELS.checked_in);
    expect(APPOINTMENT_STATUS_LABELS.triaged).toBe(APPOINTMENT_STATUS_LABELS.in_progress);
  });

  it('never offers `requested` as a destination', () => {
    // The patient portal writes it; reception answers it with a real rung.
    expect(APPOINTMENT_STATUS_OPTIONS).not.toContain('requested');
    expect(APPOINTMENT_STATUS_LABELS.requested).toBe('Requested');
  });

  it('is the flow plus the exits, with nothing counted twice', () => {
    expect(APPOINTMENT_STATUS_OPTIONS).toEqual([...APPOINTMENT_STATUS_FLOW, ...APPOINTMENT_STATUS_EXITS]);
    expect(new Set(APPOINTMENT_STATUS_OPTIONS).size).toBe(APPOINTMENT_STATUS_OPTIONS.length);
  });
});

describe('appointment status metadata', () => {
  it('labels, colours, tones and locale keys cover every status', () => {
    for (const status of ALL_STATUSES) {
      expect(APPOINTMENT_STATUS_LABELS[status]).toBeTruthy();
      expect(APPOINTMENT_STATUS_COLORS[status]?.color).toMatch(/^#|rgba?\(/);
      expect(APPOINTMENT_STATUS_COLORS[status]?.bg).toMatch(/^#|rgba?\(/);
      expect(APPOINTMENT_STATUS_TONES[status]).toBeTruthy();
      expect(APPOINTMENT_STATUS_I18N_KEYS[status]).toBeTruthy();
    }
  });

  it('has an English string behind every locale key', () => {
    for (const status of ALL_STATUSES) {
      const key = APPOINTMENT_STATUS_I18N_KEYS[status];
      expect(en[key]).toBeTruthy();
      // The locale and the plain label must agree, or a pill's wording changes
      // depending on whether the surface happens to translate.
      expect(en[key]).toBe(APPOINTMENT_STATUS_LABELS[status]);
    }
  });

  it('falls back to a readable label for an unknown status', () => {
    expect(appointmentStatusLabel('left_without_being_seen' as AppointmentStatus))
      .toBe('Left Without Being Seen');
  });
});

describe('appointment status groups', () => {
  it('treats arrived as present but not yet checked in', () => {
    expect(APPOINTMENT_PRESENT_STATUSES).toContain('arrived');
    expect(APPOINTMENT_CHECKED_IN_STATUSES).not.toContain('arrived');
    // Which is what keeps an arrived patient in the appointments card rather
        // than in the live queue the checked-in list drives.
    expect(APPOINTMENT_PENDING_STATUSES).toContain('arrived');
  });

  it('keeps pending and closed disjoint', () => {
    for (const status of APPOINTMENT_PENDING_STATUSES) {
      expect(APPOINTMENT_CLOSED_STATUSES).not.toContain(status);
    }
  });

  it('closes the three exits and the finished visit', () => {
    expect([...APPOINTMENT_CLOSED_STATUSES].sort())
      .toEqual(['cancelled', 'completed', 'no_show', 'rescheduled']);
  });

  it('only lists real statuses in every group', () => {
    for (const group of [
      APPOINTMENT_PRESENT_STATUSES, APPOINTMENT_CHECKED_IN_STATUSES,
      APPOINTMENT_CLOSED_STATUSES, APPOINTMENT_PENDING_STATUSES,
    ]) {
      for (const status of group) expect(ALL_STATUSES).toContain(status);
    }
  });
});

describe('appointmentStatusGroup', () => {
  it('files every status into exactly one of the three dashboard lanes', () => {
    for (const status of ALL_STATUSES) {
      expect(APPOINTMENT_STATUS_GROUPS).toContain(appointmentStatusGroup(status));
    }
  });

  it('keeps arrived in the scheduled lane until the desk opens the visit', () => {
    for (const status of ['requested', ...APPOINTMENT_PENDING_STATUSES] as AppointmentStatus[]) {
      expect(appointmentStatusGroup(status)).toBe('scheduled');
    }
  });

  it('puts the open visit in office and every closed slot in finished', () => {
    expect(appointmentStatusGroup('checked_in')).toBe('in_office');
    expect(appointmentStatusGroup('in_progress')).toBe('in_office');
    for (const status of APPOINTMENT_CLOSED_STATUSES) {
      expect(appointmentStatusGroup(status)).toBe('finished');
    }
  });

  it('labels all three lanes', () => {
    expect(APPOINTMENT_STATUS_GROUPS.map(g => APPOINTMENT_STATUS_GROUP_LABELS[g]))
      .toEqual(['Scheduled', 'In Office', 'Finished']);
  });

  /**
   * The lane invariant every station board relies on. The front desk used to
   * file rows by "does this patient have a triage record" rather than by the
   * visit's rung, so bookings still on Scheduled were listed AND counted under
   * In Office. These pin the rule the boards must file by.
   */
  it('admits only checked-in visits to the In Office lane', () => {
    const inOffice = ALL_STATUSES.filter(s => appointmentStatusGroup(s) === 'in_office');
    // Exactly the rungs where the desk has opened the visit and the patient is
    // in the building — nothing that is merely booked, and nothing closed.
    expect([...inOffice].sort()).toEqual(['checked_in', 'in_progress', 'triaged']);
  });

  it('keeps every not-yet-checked-in booking in the Scheduled lane', () => {
    // `arrived` included on purpose: standing in the waiting room is not the
    // same as the desk having opened the visit.
    const scheduled = ALL_STATUSES.filter(s => appointmentStatusGroup(s) === 'scheduled');
    expect([...scheduled].sort()).toEqual(['arrived', 'confirmed', 'reminder_sent', 'requested', 'scheduled']);
    for (const status of scheduled) {
      expect(APPOINTMENT_CHECKED_IN_STATUSES).not.toContain(status);
    }
  });

  it('files each status into one lane only, so no row can be counted twice', () => {
    const lanes = { scheduled: 0, in_office: 0, finished: 0 };
    for (const status of ALL_STATUSES) lanes[appointmentStatusGroup(status)] += 1;
    expect(lanes.scheduled + lanes.in_office + lanes.finished).toBe(ALL_STATUSES.length);
  });

  it('agrees with APPOINTMENT_CHECKED_IN_STATUSES on who is in the building', () => {
    // The two must not drift: the queue admits rows by the set, the lanes file
    // them by the function. `completed` is checked-in-derived but closed out.
    for (const status of APPOINTMENT_CHECKED_IN_STATUSES) {
      const lane = appointmentStatusGroup(status);
      expect(status === 'completed' ? 'finished' : 'in_office').toBe(lane);
    }
  });
});

describe('priorAppointmentStatus', () => {
  it('steps one rung back down the simplified ladder', () => {
    expect(priorAppointmentStatus('checked_in')).toBe('scheduled');
    expect(priorAppointmentStatus('in_progress')).toBe('checked_in');
    expect(priorAppointmentStatus('completed')).toBe('in_progress');
  });

  it('steps fine-grained statuses from the rung they fold into', () => {
    // reminder_sent / confirmed ARE the scheduled rung — nowhere lower to go.
    expect(priorAppointmentStatus('reminder_sent')).toBeUndefined();
    expect(priorAppointmentStatus('confirmed')).toBeUndefined();
    // arrived files as Checked In; triaged as In Progress.
    expect(priorAppointmentStatus('arrived')).toBe('scheduled');
    expect(priorAppointmentStatus('triaged')).toBe('checked_in');
  });

  it('reopens an exit to scheduled, and bottoms out at scheduled', () => {
    for (const exit of APPOINTMENT_STATUS_EXITS) {
      expect(priorAppointmentStatus(exit)).toBe('scheduled');
    }
    expect(priorAppointmentStatus('scheduled')).toBeUndefined();
    expect(priorAppointmentStatus('requested')).toBeUndefined();
  });
});
