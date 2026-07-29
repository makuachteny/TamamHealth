import { formatAppointmentTimeUntil } from '@/lib/format-utils';

describe('formatAppointmentTimeUntil', () => {
  const now = new Date(2026, 6, 29, 10, 0, 0);

  test('shows seconds for a near appointment instead of a vague Now label', () => {
    expect(formatAppointmentTimeUntil(new Date(2026, 6, 29, 10, 0, 7), now)).toBe('in 7s');
  });

  test('shows the calendar date for another day', () => {
    expect(formatAppointmentTimeUntil(new Date(2026, 6, 30, 10, 0, 0), now)).toMatch(/Jul 30, 2026/);
  });

  test('shows the calendar date for a past day', () => {
    expect(formatAppointmentTimeUntil(new Date(2026, 6, 28, 10, 0, 0), now)).toMatch(/Jul 28, 2026/);
  });
});
