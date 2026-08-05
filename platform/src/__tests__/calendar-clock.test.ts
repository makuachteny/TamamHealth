import { calendarClock, calendarRange } from '@/app/(dashboard)/appointments/_AppointmentsCalendar';

/** Local-time date; the calendar renders in the viewer's zone. */
function at(hours: number, minutes = 0): Date {
  return new Date(2026, 7, 5, hours, minutes, 0, 0);
}

describe('calendarClock — the month grid\'s time prefix', () => {
  it('drops :00 so a whole hour is three characters, not six', () => {
    expect(calendarClock(at(16))).toBe('4pm');
    expect(calendarClock(at(11))).toBe('11am');
  });

  it('keeps the minutes when there are any', () => {
    expect(calendarClock(at(13, 30))).toBe('1:30pm');
    expect(calendarClock(at(9, 5))).toBe('9:05am');
  });

  it('renders both noon and midnight as 12, not 0', () => {
    expect(calendarClock(at(12))).toBe('12pm');
    expect(calendarClock(at(0))).toBe('12am');
    expect(calendarClock(at(0, 30))).toBe('12:30am');
  });

  it('splits am and pm on the hour boundary', () => {
    expect(calendarClock(at(11, 59))).toBe('11:59am');
    expect(calendarClock(at(12, 1))).toBe('12:01pm');
    expect(calendarClock(at(23, 45))).toBe('11:45pm');
  });
});

describe('calendarRange — the second line of a week/day block', () => {
  it('states the meridiem once when both ends share it', () => {
    // "7am – 10am" would spend four characters restating the half of the day.
    expect(calendarRange(at(7), at(10))).toBe('7 – 10am');
    expect(calendarRange(at(13, 30), at(17))).toBe('1:30 – 5pm');
  });

  it('states it on both ends when the visit crosses noon', () => {
    expect(calendarRange(at(11), at(12))).toBe('11am – 12pm');
    expect(calendarRange(at(11, 30), at(14))).toBe('11:30am – 2pm');
  });

  it('treats noon as pm and midnight as am when deciding', () => {
    expect(calendarRange(at(12), at(14))).toBe('12 – 2pm');
    expect(calendarRange(at(0), at(2))).toBe('12 – 2am');
  });
});
