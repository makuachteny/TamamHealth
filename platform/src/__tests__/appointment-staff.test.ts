import {
  humanizeRole, staffAvailability, staffOptionLabel, type StaffPickerPerson,
} from '@/lib/appointment-staff';
import type { AppointmentDoc } from '@/lib/db-types';

const doctor: StaffPickerPerson = {
  _id: 'u-1', name: 'Dr. Peter Garang Deng', role: 'doctor',
  specialty: 'Surgeon', department: 'Surgery', hospitalName: 'Juba Teaching Hospital',
};

const nurse: StaffPickerPerson = { _id: 'u-2', name: 'Stella Keji Lemi', role: 'nurse' };

function appt(over: Partial<AppointmentDoc>): AppointmentDoc {
  return {
    _id: 'a-1', type: 'appointment', patientId: 'p-1', patientName: 'A Patient',
    appointmentDate: '2026-08-04', appointmentTime: '16:15', duration: 30,
    providerId: 'u-1', providerName: 'Dr. Peter Garang Deng',
    appointmentType: 'general', priority: 'routine', status: 'scheduled',
    department: 'Surgery', reason: 'Review', createdAt: '', updatedAt: '',
    ...over,
  } as AppointmentDoc;
}

const slot = { date: '2026-08-04', time: '16:15', duration: 30 };

describe('humanizeRole', () => {
  it('turns a stored role into a readable one', () => {
    expect(humanizeRole('clinical_officer')).toBe('Clinical officer');
    expect(humanizeRole(undefined)).toBe('');
  });
});

describe('staffAvailability', () => {
  it('flags an overlapping booking as a clash', () => {
    const { clash } = staffAvailability(doctor, { appointments: [appt({})], ...slot });
    expect(clash?._id).toBe('a-1');
  });

  it('does not count the appointment being edited against itself', () => {
    const { clash } = staffAvailability(doctor, {
      appointments: [appt({})], ...slot, excludeAppointmentId: 'a-1',
    });
    expect(clash).toBeNull();
  });

  it('ignores cancelled and no-show rows — they hold no slot', () => {
    const rows = [appt({ _id: 'a-2', status: 'cancelled' }), appt({ _id: 'a-3', status: 'no_show' })];
    const { clash, sameDayCount } = staffAvailability(doctor, { appointments: rows, ...slot });
    expect(clash).toBeNull();
    expect(sameDayCount).toBe(0);
  });

  it('treats assisting on a visit as being busy too', () => {
    const rows = [appt({ _id: 'a-4', providerId: 'u-9', providerName: 'Someone Else', staffId: 'u-2' })];
    const { clash } = staffAvailability(nurse, { appointments: rows, ...slot });
    expect(clash?._id).toBe('a-4');
  });

  it('counts the day without counting non-overlapping slots as clashes', () => {
    const rows = [appt({ _id: 'a-5', appointmentTime: '09:00' })];
    const { clash, sameDayCount } = staffAvailability(doctor, { appointments: rows, ...slot });
    expect(clash).toBeNull();
    expect(sameDayCount).toBe(1);
  });

  it('does not look at other days', () => {
    const rows = [appt({ _id: 'a-6', appointmentDate: '2026-08-05' })];
    expect(staffAvailability(doctor, { appointments: rows, ...slot }).sameDayCount).toBe(0);
  });
});

describe('staffOptionLabel', () => {
  it('states who they are, that they are free, and their load', () => {
    const label = staffOptionLabel(doctor, { appointments: [], ...slot });
    expect(label).toBe('Dr. Peter Garang Deng · Surgeon, Surgery · Free');
  });

  it('names the clashing time so a double-booking is visible before the pick', () => {
    const label = staffOptionLabel(doctor, { appointments: [appt({})], ...slot });
    expect(label).toContain('Busy 16:15');
    expect(label).toContain('1 today');
  });

  it('falls back to the role when no specialty is recorded', () => {
    expect(staffOptionLabel(nurse, { appointments: [], ...slot })).toBe('Stella Keji Lemi · Nurse · Free');
  });

  it('adds the facility only when asked, for org-wide pickers', () => {
    const label = staffOptionLabel(doctor, { appointments: [], ...slot, showFacility: true });
    expect(label).toContain('Juba Teaching Hospital');
  });
});
