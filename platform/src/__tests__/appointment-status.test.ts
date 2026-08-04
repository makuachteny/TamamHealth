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
  appointmentStatusLabel,
  priorAppointmentStatus,
} from '../lib/appointment-status';
import type { AppointmentStatus } from '../lib/db-types';
import en from '../lib/i18n/locales/en';

const ALL_STATUSES = Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[];

describe('appointment status dropdown', () => {
  it('offers the front desk ladder in order, exits last', () => {
    expect(APPOINTMENT_STATUS_OPTIONS.map(s => APPOINTMENT_STATUS_LABELS[s])).toEqual([
      'Scheduled',
      'Reminder Sent',
      'Confirmed',
      'Arrived',
      'Checked In',
      'Roomed',
      'Checked Out',
      'No Show',
      'Rescheduled',
      'Cancelled',
    ]);
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

describe('priorAppointmentStatus', () => {
  it('steps one rung back down the ladder', () => {
    expect(priorAppointmentStatus('reminder_sent')).toBe('scheduled');
    expect(priorAppointmentStatus('confirmed')).toBe('reminder_sent');
    expect(priorAppointmentStatus('arrived')).toBe('confirmed');
    expect(priorAppointmentStatus('checked_in')).toBe('arrived');
    expect(priorAppointmentStatus('in_progress')).toBe('checked_in');
    expect(priorAppointmentStatus('completed')).toBe('in_progress');
  });

  it('reopens an exit to scheduled, and bottoms out at scheduled', () => {
    for (const exit of APPOINTMENT_STATUS_EXITS) {
      expect(priorAppointmentStatus(exit)).toBe('scheduled');
    }
    expect(priorAppointmentStatus('scheduled')).toBeUndefined();
    expect(priorAppointmentStatus('requested')).toBeUndefined();
  });
});
