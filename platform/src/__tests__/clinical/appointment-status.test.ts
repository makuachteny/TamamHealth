/**
 * Scheduling — appointment status model (src/lib/appointment-status.ts).
 *
 * Two invariants matter for correctness:
 *  - a COMPLETED appointment must NOT release its slot (the visit happened),
 *    while cancelled/no-show/rescheduled do,
 *  - legacy stored statuses fold onto their canonical offered value so old and
 *    new writers agree.
 */
import {
  canonicalAppointmentStatus,
  appointmentStatusGroup,
  APPOINTMENT_SLOT_RELEASED_STATUSES,
  APPOINTMENT_CLOSED_STATUSES,
  APPOINTMENT_STATUS_EXITS,
} from '@/lib/appointment-status';

describe('appointment slot release', () => {
  test('cancelled / no_show / rescheduled release the slot', () => {
    for (const s of ['cancelled', 'no_show', 'rescheduled'] as const) {
      expect(APPOINTMENT_SLOT_RELEASED_STATUSES).toContain(s);
    }
  });
  test('completed does NOT release the slot (the visit occurred)', () => {
    expect(APPOINTMENT_SLOT_RELEASED_STATUSES).not.toContain('completed');
    // ...even though completed is a closed status.
    expect(APPOINTMENT_CLOSED_STATUSES).toContain('completed');
  });
});

describe('canonical status folding', () => {
  test('legacy statuses map onto their offered canonical value', () => {
    expect(canonicalAppointmentStatus('reminder_sent')).toBe('scheduled');
    expect(canonicalAppointmentStatus('confirmed')).toBe('scheduled');
    expect(canonicalAppointmentStatus('arrived')).toBe('checked_in');
    expect(canonicalAppointmentStatus('triaged')).toBe('in_progress');
  });
  test('offered statuses are unchanged by folding', () => {
    for (const s of ['scheduled', 'checked_in', 'in_progress', 'completed'] as const) {
      expect(canonicalAppointmentStatus(s)).toBe(s);
    }
  });
});

describe('three-lane grouping', () => {
  test('arrived stays in the scheduled lane (desk has not opened the visit)', () => {
    expect(appointmentStatusGroup('arrived')).toBe('scheduled');
  });
  test('in_progress is in-office and completed is finished', () => {
    expect(appointmentStatusGroup('in_progress')).toBe('in_office');
    expect(appointmentStatusGroup('completed')).toBe('finished');
  });
});

describe('exit statuses', () => {
  test('the exit set is exactly no_show / rescheduled / cancelled', () => {
    expect([...APPOINTMENT_STATUS_EXITS].sort()).toEqual(['cancelled', 'no_show', 'rescheduled']);
  });
});
