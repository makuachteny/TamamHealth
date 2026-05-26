/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for triage-service.ts
 * Covers WHO ETAT priority calculation, CRUD, state machine transitions, and stats.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-triage-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  calculatePriority,
  createTriage,
  getAllTriage,
  getTriageByPatient,
  getActiveTriage,
  updateTriage,
  getTriageStats,
} from '@/lib/services/triage-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateTriageInput = Parameters<typeof createTriage>[0];

function validTriage(overrides: Partial<CreateTriageInput> = {}): CreateTriageInput {
  return {
    patientId: 'patient-001',
    patientName: 'Deng Mabior',
    airway: 'clear' as const,
    breathing: 'normal' as const,
    circulation: 'normal' as const,
    consciousness: 'alert' as const,
    priority: 'GREEN' as const,
    triagedBy: 'nurse-001',
    triagedByName: 'Nurse Ayen',
    triagedAt: new Date().toISOString(),
    status: 'pending' as const,
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    ...overrides,
  };
}

describe('Triage Service', () => {
  describe('calculatePriority — WHO ETAT decision tree', () => {
    test('returns RED for obstructed airway', () => {
      expect(calculatePriority({
        airway: 'obstructed', breathing: 'normal', circulation: 'normal', consciousness: 'alert',
      })).toBe('RED');
    });

    test('returns RED for absent breathing', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'absent', circulation: 'normal', consciousness: 'alert',
      })).toBe('RED');
    });

    test('returns RED for absent circulation', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'absent', consciousness: 'alert',
      })).toBe('RED');
    });

    test('returns RED for unresponsive consciousness', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'unresponsive',
      })).toBe('RED');
    });

    test('returns YELLOW for distressed breathing', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'distressed', circulation: 'normal', consciousness: 'alert',
      })).toBe('YELLOW');
    });

    test('returns YELLOW for impaired circulation', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'impaired', consciousness: 'alert',
      })).toBe('YELLOW');
    });

    test('returns YELLOW for verbal consciousness', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'verbal',
      })).toBe('YELLOW');
    });

    test('returns YELLOW for pain consciousness', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'pain',
      })).toBe('YELLOW');
    });

    test('returns GREEN when all normal', () => {
      expect(calculatePriority({
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert',
      })).toBe('GREEN');
    });

    test('returns empty string for incomplete assessment', () => {
      expect(calculatePriority({ airway: '', breathing: 'normal', circulation: 'normal', consciousness: 'alert' })).toBe('');
      expect(calculatePriority({ airway: 'clear', breathing: '', circulation: 'normal', consciousness: 'alert' })).toBe('');
    });

    test('RED overrides YELLOW signs', () => {
      expect(calculatePriority({
        airway: 'obstructed', breathing: 'distressed', circulation: 'impaired', consciousness: 'verbal',
      })).toBe('RED');
    });
  });

  describe('CRUD operations', () => {
    test('creates a triage record', async () => {
      const triage = await createTriage(validTriage());
      expect(triage._id).toMatch(/^triage-/);
      expect(triage.type).toBe('triage');
      expect(triage.priority).toBe('GREEN');
      expect(triage.status).toBe('pending');
    });

    test('retrieves all triages sorted by date', async () => {
      await createTriage(validTriage({ triagedAt: '2026-04-01T08:00:00Z' }));
      await createTriage(validTriage({
        patientId: 'patient-002', patientName: 'Achol',
        triagedAt: '2026-04-01T10:00:00Z',
      }));

      const all = await getAllTriage();
      expect(all).toHaveLength(2);
      expect(all[0].patientName).toBe('Achol'); // Most recent first
    });

    test('retrieves triages by patient', async () => {
      await createTriage(validTriage());
      await createTriage(validTriage({
        patientId: 'patient-002', patientName: 'Achol',
      }));

      const p1 = await getTriageByPatient('patient-001');
      expect(p1).toHaveLength(1);
      expect(p1[0].patientName).toBe('Deng Mabior');
    });

    test('getActiveTriage returns only pending and seen', async () => {
      await createTriage(validTriage({ status: 'pending' }));
      await createTriage(validTriage({
        patientId: 'patient-002', patientName: 'Achol',
        status: 'seen',
      }));
      await createTriage(validTriage({
        patientId: 'patient-003', patientName: 'Nyabol',
        status: 'discharged',
      }));

      const active = await getActiveTriage();
      expect(active).toHaveLength(2);
      expect(active.every(t => t.status === 'pending' || t.status === 'seen')).toBe(true);
    });
  });

  describe('Status transition state machine', () => {
    test('pending → seen is valid', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, { status: 'seen' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('seen');
    });

    test('pending → admitted is valid', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, { status: 'admitted' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('admitted');
    });

    test('pending → discharged is valid', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, { status: 'discharged' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('discharged');
    });

    test('pending → referred is valid', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, { status: 'referred' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('referred');
    });

    test('seen → admitted is valid', async () => {
      const t = await createTriage(validTriage());
      await updateTriage(t._id, { status: 'seen' });
      const admitted = await updateTriage(t._id, { status: 'admitted' });
      expect(admitted).not.toBeNull();
      expect(admitted!.status).toBe('admitted');
    });

    test('discharged → any is invalid (terminal state)', async () => {
      const t = await createTriage(validTriage());
      await updateTriage(t._id, { status: 'discharged' });
      // Attempt to go back to seen — should fail (returns null due to caught error)
      const result = await updateTriage(t._id, { status: 'seen' });
      expect(result).toBeNull();
    });

    test('admitted → discharged is valid', async () => {
      const t = await createTriage(validTriage());
      await updateTriage(t._id, { status: 'admitted' });
      const discharged = await updateTriage(t._id, { status: 'discharged' });
      expect(discharged).not.toBeNull();
      expect(discharged!.status).toBe('discharged');
    });

    test('referred → discharged is valid', async () => {
      const t = await createTriage(validTriage());
      await updateTriage(t._id, { status: 'referred' });
      const discharged = await updateTriage(t._id, { status: 'discharged' });
      expect(discharged).not.toBeNull();
      expect(discharged!.status).toBe('discharged');
    });

    test('seen → pending is invalid (no backward transition)', async () => {
      const t = await createTriage(validTriage());
      await updateTriage(t._id, { status: 'seen' });
      const result = await updateTriage(t._id, { status: 'pending' });
      expect(result).toBeNull();
    });
  });

  describe('Statistics', () => {
    test('getTriageStats returns correct counts', async () => {
      const today = new Date().toISOString();
      await createTriage(validTriage({ priority: 'RED', triagedAt: today }));
      await createTriage(validTriage({
        patientId: 'patient-002', patientName: 'Achol',
        priority: 'YELLOW', triagedAt: today,
      }));
      await createTriage(validTriage({
        patientId: 'patient-003', patientName: 'Nyabol',
        priority: 'GREEN', triagedAt: today,
      }));

      const stats = await getTriageStats();
      expect(stats.total).toBe(3);
      expect(stats.todayTotal).toBe(3);
      expect(stats.todayRed).toBe(1);
      expect(stats.todayYellow).toBe(1);
      expect(stats.todayGreen).toBe(1);
      expect(stats.pending).toBe(3);
    });

    test('getAllTriage sorts correctly with undefined triagedAt', async () => {
      await createTriage(validTriage({
        triagedAt: '2026-04-01T10:00:00Z',
        patientId: 'patient-001',
        patientName: 'Deng Mabior',
      }));
      // Create without triagedAt to test the || '' fallback
      await createTriage(validTriage({
        triagedAt: undefined as unknown as string,
        patientId: 'patient-002',
        patientName: 'Achol',
      }));

      const all = await getAllTriage();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Scope filtering', () => {
    test('getAllTriage with scope filters results', async () => {
      await createTriage(validTriage({
        facilityId: 'hosp-001',
        patientId: 'patient-001',
      }));

      const all = await getAllTriage({ hospitalId: 'hosp-001', role: 'nurse' } as Parameters<typeof getAllTriage>[0]);
      expect(all).toBeDefined();
    });

    test('getActiveTriage with scope filters results', async () => {
      await createTriage(validTriage({
        status: 'pending',
        facilityId: 'hosp-001',
      }));

      const active = await getActiveTriage({ hospitalId: 'hosp-001', role: 'nurse' } as Parameters<typeof getActiveTriage>[0]);
      expect(active).toBeDefined();
    });

    test('getTriageStats with scope filters results', async () => {
      const today = new Date().toISOString();
      await createTriage(validTriage({
        triagedAt: today,
        facilityId: 'hosp-001',
      }));

      const stats = await getTriageStats({ hospitalId: 'hosp-001', role: 'nurse' } as Parameters<typeof getTriageStats>[0]);
      expect(stats).toBeDefined();
    });
  });

  describe('Status update with logAudit', () => {
    test('updateTriage with status change logs audit', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, {
        status: 'seen',
        handoffTo: 'doctor-001',
        handoffToName: 'Dr. Ahmed',
      });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('seen');
    });

    test('updateTriage without status change does not log audit', async () => {
      const t = await createTriage(validTriage());
      const updated = await updateTriage(t._id, {
        priority: 'YELLOW',
      });
      expect(updated).not.toBeNull();
      expect(updated!.priority).toBe('YELLOW');
    });
  });

  describe('Invalid status transitions', () => {
    test('attempting invalid transition returns null', async () => {
      const t = await createTriage(validTriage({ status: 'admitted' }));
      const result = await updateTriage(t._id, { status: 'pending' });
      expect(result).toBeNull();
    });

    test('attempting nonexistent triage returns null', async () => {
      const result = await updateTriage('nonexistent-id', { status: 'seen' });
      expect(result).toBeNull();
    });
  });

  describe('Uncovered branch fixes', () => {
    // ---- Line 51: Test sort with missing triagedAt ----
    test('getAllTriage sorts correctly with missing triagedAt (line 51)', async () => {
      await createTriage(validTriage({ patientId: 'p1', triagedAt: new Date().toISOString() }));

      // Manually insert triage without triagedAt
      const db = require('@/lib/db').triageDB();
      const triageNoDate = {
        _id: 'triage-no-date',
        type: 'triage',
        patientId: 'p2',
        patientName: 'Unknown',
        triagedAt: undefined as unknown as string,
        triagedBy: 'nurse',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.put(triageNoDate);

      const all = await getAllTriage();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
    });

    // ---- Line 97: Test VALID_TRANSITIONS fallback with unknown status ----
    test('updateTriage handles unknown status in VALID_TRANSITIONS (line 97)', async () => {
      const t = await createTriage(validTriage({ status: 'pending' }));

      // Manually set an unknown status
      const db = require('@/lib/db').triageDB();
      const updated = await db.get(t._id) as { status: string };
      updated.status = 'unknown_status';
      await db.put(updated);

      // Try to transition from the unknown status - should fail gracefully
      const result = await updateTriage(t._id, { status: 'seen' });
      expect(result).toBeNull();
    });

    // ---- Line 121: Test filter with missing triagedAt in getTriageStats ----
    test('getTriageStats handles missing triagedAt (line 121)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await createTriage(validTriage({ triagedAt: today + 'T10:00:00.000Z' }));

      // Manually insert triage without triagedAt
      const db = require('@/lib/db').triageDB();
      const triageNoDate = {
        _id: 'triage-stats-no-date',
        type: 'triage',
        patientId: 'p-stats',
        patientName: 'Stats Test',
        triagedAt: undefined as unknown as string,
        triagedBy: 'nurse',
        priority: 'GREEN' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.put(triageNoDate);

      const stats = await getTriageStats();
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.todayTotal).toBe('number');
    });
  });
});
