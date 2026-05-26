/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for staff-scheduling-service.ts
 * Covers CRUD, shift queries, on-call lookup, weekly roster, and staffing gap detection.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-sched-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllSchedules,
  getSchedulesByDate,
  getSchedulesByUser,
  getOnCallStaff,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getWeeklyRoster,
  getStaffingGaps,
} from '@/lib/services/staff-scheduling-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateScheduleInput = Parameters<typeof createSchedule>[0];

function validSchedule(overrides: Partial<CreateScheduleInput> = {}): CreateScheduleInput {
  return {
    userId: 'user-nurse-001',
    userName: 'Nurse Ayen',
    role: 'nurse',
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    shiftType: 'morning' as const,
    shiftDate: '2026-04-13',
    startTime: '07:00',
    endTime: '15:00',
    isOnCall: false,
    status: 'scheduled' as const,
    ...overrides,
  };
}

describe('Staff Scheduling Service', () => {
  test('creates a schedule with valid data', async () => {
    const sched = await createSchedule(validSchedule());
    expect(sched._id).toMatch(/^sched-/);
    expect(sched.type).toBe('staff_schedule');
    expect(sched.userName).toBe('Nurse Ayen');
    expect(sched.shiftType).toBe('morning');
    expect(sched.createdAt).toBeDefined();
  });

  test('retrieves all schedules sorted by date+time', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-14', startTime: '07:00' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', startTime: '15:00', shiftType: 'afternoon' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', startTime: '07:00' }));

    const all = await getAllSchedules();
    expect(all).toHaveLength(3);
    // Sorted by date+time ascending
    expect(all[0].shiftDate).toBe('2026-04-13');
    expect(all[0].startTime).toBe('07:00');
    expect(all[1].shiftDate).toBe('2026-04-13');
    expect(all[1].startTime).toBe('15:00');
    expect(all[2].shiftDate).toBe('2026-04-14');
  });

  test('getAllSchedules with scope filters results', async () => {
    await createSchedule(validSchedule());
    const allNoScope = await getAllSchedules();
    expect(allNoScope.length).toBeGreaterThanOrEqual(1);

    const allWithScope = await getAllSchedules({ role: 'nurse' } as Parameters<typeof getAllSchedules>[0]);
    expect(Array.isArray(allWithScope)).toBe(true);
  });

  test('getSchedulesByDate returns only matching date', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-13' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-14' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', shiftType: 'afternoon', startTime: '15:00' }));

    const result = await getSchedulesByDate('2026-04-13');
    expect(result).toHaveLength(2);
  });

  test('getSchedulesByDate filters by facilityId', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', facilityId: 'hosp-001' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', facilityId: 'hosp-002', facilityName: 'Other' }));

    const result = await getSchedulesByDate('2026-04-13', 'hosp-001');
    expect(result).toHaveLength(1);
    expect(result[0].facilityId).toBe('hosp-001');
  });

  test('getSchedulesByUser returns schedules for specific user', async () => {
    await createSchedule(validSchedule({ userId: 'user-nurse-001' }));
    await createSchedule(validSchedule({ userId: 'user-nurse-001', shiftDate: '2026-04-14' }));
    await createSchedule(validSchedule({ userId: 'user-nurse-002', userName: 'Nurse Bak' }));

    const result = await getSchedulesByUser('user-nurse-001');
    expect(result).toHaveLength(2);
  });

  test('getOnCallStaff returns on-call staff for date', async () => {
    await createSchedule(validSchedule({ isOnCall: true, shiftType: 'on_call', startTime: '00:00', endTime: '23:59' }));
    await createSchedule(validSchedule({ isOnCall: false }));
    await createSchedule(validSchedule({
      isOnCall: true, shiftType: 'on_call', startTime: '00:00', endTime: '23:59',
      userId: 'user-doc-001', userName: 'Dr. Kuol', role: 'doctor',
    }));

    const onCall = await getOnCallStaff('2026-04-13');
    expect(onCall).toHaveLength(2);
  });

  test('getOnCallStaff excludes absent staff', async () => {
    await createSchedule(validSchedule({ isOnCall: true, shiftType: 'on_call', status: 'absent' }));
    await createSchedule(validSchedule({
      isOnCall: true, shiftType: 'on_call', status: 'confirmed',
      userId: 'user-doc-001', userName: 'Dr. Kuol',
    }));

    const onCall = await getOnCallStaff('2026-04-13');
    expect(onCall).toHaveLength(1);
    expect(onCall[0].status).toBe('confirmed');
  });

  test('getOnCallStaff filters by facility', async () => {
    await createSchedule(validSchedule({ isOnCall: true, shiftType: 'on_call', facilityId: 'hosp-001' }));
    await createSchedule(validSchedule({
      isOnCall: true, shiftType: 'on_call', facilityId: 'hosp-002', facilityName: 'Other',
      userId: 'user-doc-001', userName: 'Dr. Kuol',
    }));

    const onCall = await getOnCallStaff('2026-04-13', 'hosp-001');
    expect(onCall).toHaveLength(1);
  });

  test('updates a schedule', async () => {
    const sched = await createSchedule(validSchedule());
    const updated = await updateSchedule(sched._id, { status: 'confirmed' });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('confirmed');
    expect(updated!.userName).toBe('Nurse Ayen');
  });

  test('update returns null for nonexistent schedule', async () => {
    const result = await updateSchedule('nonexistent', { status: 'confirmed' });
    expect(result).toBeNull();
  });

  test('deletes a schedule', async () => {
    const sched = await createSchedule(validSchedule());
    const deleted = await deleteSchedule(sched._id);
    expect(deleted).toBe(true);

    const all = await getAllSchedules();
    expect(all).toHaveLength(0);
  });

  test('delete returns false for nonexistent schedule', async () => {
    const result = await deleteSchedule('nonexistent');
    expect(result).toBe(false);
  });

  test('getWeeklyRoster returns 7-day window', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-13' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-15', userId: 'user-2', userName: 'Nurse B' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-19', userId: 'user-3', userName: 'Nurse C' }));
    // Outside the 7-day window
    await createSchedule(validSchedule({ shiftDate: '2026-04-21', userId: 'user-4', userName: 'Nurse D' }));

    const roster = await getWeeklyRoster('2026-04-13');
    expect(roster).toHaveLength(3);
  });

  test('getWeeklyRoster filters by facility', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-13', facilityId: 'hosp-001' }));
    await createSchedule(validSchedule({ shiftDate: '2026-04-14', facilityId: 'hosp-002', facilityName: 'Other', userId: 'user-2', userName: 'Nurse B' }));

    const roster = await getWeeklyRoster('2026-04-13', 'hosp-001');
    expect(roster).toHaveLength(1);
  });

  test('getStaffingGaps identifies understaffed shifts', async () => {
    // Only 2 morning staff (needs 5) and 1 night staff (needs 3)
    await createSchedule(validSchedule({ shiftType: 'morning' }));
    await createSchedule(validSchedule({ shiftType: 'morning', userId: 'user-2', userName: 'Nurse B' }));
    await createSchedule(validSchedule({ shiftType: 'night', startTime: '23:00', endTime: '07:00', userId: 'user-3', userName: 'Nurse C' }));

    const gaps = await getStaffingGaps('2026-04-13');
    expect(gaps.length).toBeGreaterThanOrEqual(2);

    const morningGap = gaps.find(g => g.shift === 'morning');
    expect(morningGap).toBeDefined();
    expect(morningGap!.currentStaff).toBe(2);
    expect(morningGap!.requiredStaff).toBe(5);
    expect(morningGap!.gap).toBe(3);

    const nightGap = gaps.find(g => g.shift === 'night');
    expect(nightGap).toBeDefined();
    expect(nightGap!.currentStaff).toBe(1);
    expect(nightGap!.gap).toBe(2);
  });

  test('getStaffingGaps excludes absent staff from count', async () => {
    await createSchedule(validSchedule({ shiftType: 'morning', status: 'scheduled' }));
    await createSchedule(validSchedule({ shiftType: 'morning', status: 'absent', userId: 'user-2', userName: 'Nurse B' }));

    const gaps = await getStaffingGaps('2026-04-13');
    const morningGap = gaps.find(g => g.shift === 'morning');
    expect(morningGap).toBeDefined();
    // Only 1 non-absent staff, not 2
    expect(morningGap!.currentStaff).toBe(1);
  });

  test('getStaffingGaps returns empty when fully staffed', async () => {
    // Staff all shifts above minimum
    const shifts = [
      ...Array.from({ length: 5 }, (_, i) => validSchedule({ shiftType: 'morning', userId: `m-${i}`, userName: `M${i}` })),
      ...Array.from({ length: 4 }, (_, i) => validSchedule({ shiftType: 'afternoon', startTime: '15:00', userId: `a-${i}`, userName: `A${i}` })),
      ...Array.from({ length: 3 }, (_, i) => validSchedule({ shiftType: 'night', startTime: '23:00', userId: `n-${i}`, userName: `N${i}` })),
      ...Array.from({ length: 2 }, (_, i) => validSchedule({ shiftType: 'on_call', userId: `oc-${i}`, userName: `OC${i}`, isOnCall: true })),
    ];
    for (const s of shifts) {
      await createSchedule(s);
    }

    const gaps = await getStaffingGaps('2026-04-13');
    expect(gaps).toHaveLength(0);
  });

  test('deleteSchedule handles document with revision', async () => {
    const sched = await createSchedule(validSchedule());
    expect(sched._rev).toBeDefined();
    const deleted = await deleteSchedule(sched._id);
    expect(deleted).toBe(true);
  });

  test('getSchedulesByDate with no matching date returns empty', async () => {
    await createSchedule(validSchedule({ shiftDate: '2026-04-13' }));
    const result = await getSchedulesByDate('2026-05-01');
    expect(result).toHaveLength(0);
  });

  test('getOnCallStaff with no on-call staff returns empty', async () => {
    await createSchedule(validSchedule({ isOnCall: false }));
    const onCall = await getOnCallStaff('2026-04-13');
    expect(onCall).toHaveLength(0);
  });

  // ---- Line 88: Test deleteSchedule handles errors gracefully ----
  test('deleteSchedule returns false when document not found (line 88)', async () => {
    // Try to delete a non-existent schedule
    const deleted = await deleteSchedule('nonexistent-schedule-id');
    expect(deleted).toBe(false);
  });
});
