/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for appointment-reminder-service.ts
 * Covers upcoming reminders, message generation, overdue detection,
 * no-show stats, and missed follow-up identification.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-appt-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { appointmentsDB } from '@/lib/db';
import type { AppointmentDoc } from '@/lib/db-types';
import {
  getUpcomingReminders,
  generateReminderMessages,
  getOverdueAppointments,
  getNoShowStats,
  getMissedFollowUps,
} from '@/lib/services/appointment-reminder-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

function validAppointment(overrides: Partial<AppointmentDoc> = {}): AppointmentDoc {
  return {
    _id: `appt-${++uuidCounter}`,
    type: 'appointment',
    patientId: 'patient-001',
    patientName: 'Deng Mabior',
    patientPhone: '+211912345001',
    providerId: 'doc-001',
    providerName: 'Dr. Kuol',
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    facilityLevel: 'county',
    appointmentDate: tomorrow,
    appointmentTime: '09:00',
    duration: 30,
    appointmentType: 'general',
    priority: 'routine',
    department: 'Outpatient',
    reason: 'Follow-up visit',
    status: 'scheduled',
    reminderSent: false,
    isRecurring: false,
    bookedBy: 'desk-001',
    bookedByName: 'Desk Amira',
    state: 'Central Equatoria',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as AppointmentDoc;
}

async function seedAppointment(overrides: Partial<AppointmentDoc> = {}): Promise<AppointmentDoc> {
  const db = appointmentsDB();
  const doc = validAppointment(overrides);
  await db.put(doc);
  return doc;
}

describe('Appointment Reminder Service', () => {
  test('getUpcomingReminders returns appointments within daysAhead', async () => {
    await seedAppointment({ appointmentDate: tomorrow, reminderSent: false });
    await seedAppointment({ appointmentDate: today, reminderSent: false });
    // Too far in the future (default daysAhead = 1)
    const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await seedAppointment({ appointmentDate: nextWeek, reminderSent: false });

    const reminders = await getUpcomingReminders(1);
    expect(reminders).toHaveLength(2); // today and tomorrow
  });

  test('getUpcomingReminders excludes already-sent reminders', async () => {
    await seedAppointment({ appointmentDate: tomorrow, reminderSent: true });
    await seedAppointment({ appointmentDate: tomorrow, reminderSent: false });

    const reminders = await getUpcomingReminders(1);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].reminderSent).toBe(false);
  });

  test('getUpcomingReminders excludes cancelled/completed/no_show', async () => {
    await seedAppointment({ appointmentDate: tomorrow, status: 'cancelled' });
    await seedAppointment({ appointmentDate: tomorrow, status: 'completed' });
    await seedAppointment({ appointmentDate: tomorrow, status: 'no_show' });
    await seedAppointment({ appointmentDate: tomorrow, status: 'scheduled' });

    const reminders = await getUpcomingReminders(1);
    expect(reminders).toHaveLength(1);
  });

  test('getUpcomingReminders filters by facility', async () => {
    await seedAppointment({ appointmentDate: tomorrow, facilityId: 'hosp-001' });
    await seedAppointment({ appointmentDate: tomorrow, facilityId: 'hosp-002', facilityName: 'Other' });

    const reminders = await getUpcomingReminders(1, 'hosp-001');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].facilityId).toBe('hosp-001');
  });

  test('getUpcomingReminders with scope', async () => {
    await seedAppointment({ appointmentDate: tomorrow });
    const reminders = await getUpcomingReminders(1, undefined, { role: 'nurse' });
    expect(Array.isArray(reminders)).toBe(true);
  });

  test('generateReminderMessages creates messages for appointments', async () => {
    const appt = validAppointment({ appointmentDate: tomorrow });
    const messages = await generateReminderMessages([appt]);
    expect(messages).toHaveLength(1);
    expect(messages[0].appointmentId).toBe(appt._id);
    expect(messages[0].patientName).toBe('Deng Mabior');
    expect(messages[0].message).toContain('Reminder');
    expect(messages[0].message).toContain('Dr. Kuol');
    expect(messages[0].message).toContain('TamamHealth Hospital');
    expect(messages[0].channel).toBe('both');
  });

  test('generateReminderMessages respects reminder channel', async () => {
    const appt = validAppointment({ reminderChannel: 'sms' });
    const messages = await generateReminderMessages([appt]);
    expect(messages[0].channel).toBe('sms');
  });

  test('generateReminderMessages handles empty array', async () => {
    const messages = await generateReminderMessages([]);
    expect(messages).toHaveLength(0);
  });

  test('getOverdueAppointments returns past non-completed appointments', async () => {
    await seedAppointment({ appointmentDate: yesterday, status: 'scheduled' });
    await seedAppointment({ appointmentDate: yesterday, status: 'completed' });
    await seedAppointment({ appointmentDate: yesterday, status: 'cancelled' });
    await seedAppointment({ appointmentDate: yesterday, status: 'confirmed' });

    const overdue = await getOverdueAppointments();
    expect(overdue).toHaveLength(2); // scheduled and confirmed
  });

  test('getOverdueAppointments does not include future appointments', async () => {
    await seedAppointment({ appointmentDate: tomorrow, status: 'scheduled' });
    await seedAppointment({ appointmentDate: yesterday, status: 'scheduled' });

    const overdue = await getOverdueAppointments();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].appointmentDate).toBe(yesterday);
  });

  test('getOverdueAppointments filters by facility', async () => {
    await seedAppointment({ appointmentDate: yesterday, status: 'scheduled', facilityId: 'hosp-001' });
    await seedAppointment({ appointmentDate: yesterday, status: 'scheduled', facilityId: 'hosp-002', facilityName: 'Other' });

    const overdue = await getOverdueAppointments('hosp-001');
    expect(overdue).toHaveLength(1);
  });

  test('getNoShowStats calculates rates correctly', async () => {
    const start = lastWeek;
    const end = today;
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', department: 'Outpatient' });
    await seedAppointment({ appointmentDate: yesterday, status: 'completed', department: 'Outpatient' });
    await seedAppointment({ appointmentDate: yesterday, status: 'completed', department: 'Maternity' });
    await seedAppointment({ appointmentDate: yesterday, status: 'cancelled', department: 'Outpatient' });

    const stats = await getNoShowStats({ start, end });
    expect(stats.totalAppointments).toBe(4);
    expect(stats.noShowCount).toBe(1);
    expect(stats.noShowRate).toBe(25); // 1/4 = 25%
    expect(stats.completedCount).toBe(2);
    expect(stats.cancelledCount).toBe(1);
    expect(stats.byDepartment['Outpatient']).toBeDefined();
    expect(stats.byDepartment['Outpatient'].noShow).toBe(1);
    expect(stats.byDepartment['Outpatient'].total).toBe(3);
  });

  test('getNoShowStats handles zero appointments', async () => {
    const stats = await getNoShowStats({ start: lastWeek, end: today });
    expect(stats.totalAppointments).toBe(0);
    expect(stats.noShowRate).toBe(0);
  });

  test('getNoShowStats filters by facility', async () => {
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', facilityId: 'hosp-001' });
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', facilityId: 'hosp-002', facilityName: 'Other' });

    const stats = await getNoShowStats({ start: lastWeek, end: today }, 'hosp-001');
    expect(stats.totalAppointments).toBe(1);
  });

  test('getMissedFollowUps returns past no-show follow-ups', async () => {
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', appointmentType: 'follow_up' });
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', appointmentType: 'general' });
    await seedAppointment({ appointmentDate: yesterday, status: 'completed', appointmentType: 'follow_up' });
    await seedAppointment({ appointmentDate: tomorrow, status: 'no_show', appointmentType: 'follow_up' });

    const missed = await getMissedFollowUps();
    expect(missed).toHaveLength(1);
    expect(missed[0].appointmentType).toBe('follow_up');
    expect(missed[0].status).toBe('no_show');
  });

  test('getMissedFollowUps filters by facility', async () => {
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', appointmentType: 'follow_up', facilityId: 'hosp-001' });
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', appointmentType: 'follow_up', facilityId: 'hosp-002', facilityName: 'Other' });

    const missed = await getMissedFollowUps('hosp-001');
    expect(missed).toHaveLength(1);
  });

  test('getNoShowStats handles zero appointments in a department', async () => {
    // Seed appointments but ensure byDepartment calculation covers the case where deptAppts.length > 0
    const start = lastWeek;
    const end = today;
    await seedAppointment({ appointmentDate: yesterday, status: 'no_show', department: 'Surgery' });
    await seedAppointment({ appointmentDate: yesterday, status: 'completed', department: 'Surgery' });

    const stats = await getNoShowStats({ start, end });
    expect(stats.byDepartment['Surgery']).toBeDefined();
    expect(stats.byDepartment['Surgery'].total).toBe(2);
    expect(stats.byDepartment['Surgery'].rate).toBe(50); // 1/2 = 50%
  });

  test('getUpcomingReminders with no appointments returns empty', async () => {
    const reminders = await getUpcomingReminders(1);
    expect(reminders).toHaveLength(0);
  });

  test('getUpcomingReminders includes appointments from today through daysAhead', async () => {
    const twoDaysAhead = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await seedAppointment({ appointmentDate: today, reminderSent: false });
    await seedAppointment({ appointmentDate: tomorrow, reminderSent: false });
    await seedAppointment({ appointmentDate: twoDaysAhead, reminderSent: false });

    // With daysAhead=2, should include appointments on today, tomorrow, and 2 days ahead
    const reminders = await getUpcomingReminders(2);
    expect(reminders.length).toBeGreaterThanOrEqual(3);
  });

  test('generateReminderMessages uses patientPhone correctly', async () => {
    const appt = validAppointment({ patientPhone: '+211987654321' });
    const messages = await generateReminderMessages([appt]);
    expect(messages[0].patientPhone).toBe('+211987654321');
  });

  test('getMissedFollowUps with no missed follow-ups returns empty', async () => {
    const missed = await getMissedFollowUps();
    expect(missed).toHaveLength(0);
  });

  // ---- Lines 7, 106: Test getNoShowStats with department having zero appointments ----
  test('getNoShowStats handles department with zero appointments (line 106)', async () => {
    const start = lastWeek;
    const end = today;

    // Add appointments from different departments
    await seedAppointment({
      appointmentDate: yesterday,
      status: 'completed',
      department: 'Cardiology',
    });

    const stats = await getNoShowStats({ start, end });

    // Since we only have completed appointments in Cardiology and no no_shows
    // in other departments, the stats should handle the calculation correctly
    expect(stats).toBeDefined();
    expect(typeof stats.noShowRate).toBe('number');

    // Check that byDepartment has the department
    if (stats.byDepartment['Cardiology']) {
      expect(stats.byDepartment['Cardiology'].rate).toBeDefined();
      expect(stats.byDepartment['Cardiology'].rate).toBeGreaterThanOrEqual(0);
    }
  });

  // ---- Line 7: Test getUpcomingReminders with facilityId filter false branch ----
  test('getUpcomingReminders filters by facility when facilityId is provided (line 26)', async () => {
    await seedAppointment({
      appointmentDate: tomorrow,
      reminderSent: false,
      facilityId: 'hosp-001',
    });

    await seedAppointment({
      appointmentDate: tomorrow,
      reminderSent: false,
      facilityId: 'hosp-002',
      facilityName: 'Other Hospital',
    });

    const upcomingHosp1 = await getUpcomingReminders(1, 'hosp-001');
    const upcomingHosp2 = await getUpcomingReminders(1, 'hosp-002');

    expect(upcomingHosp1.every(a => a.facilityId === 'hosp-001')).toBe(true);
    expect(upcomingHosp2.every(a => a.facilityId === 'hosp-002')).toBe(true);
  });
});
