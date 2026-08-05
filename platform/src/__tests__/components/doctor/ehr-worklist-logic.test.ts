/**
 * components/ehr/EhrClinicalDashboard.tsx — the pure row-assembly, queue and
 * lane-grouping functions behind the doctor's "Patients assigned to you"
 * worklist.
 *
 * Regression coverage for defects fixed earlier today:
 *  1. An unclaimed patient's care-team label must read "Doctor unassigned",
 *     never the viewing clinician's own name.
 *  2. A patient present in `patients` AND separately booked for today must
 *     not render as two rows.
 *  5. A status change moves a row between Scheduled / In Office / Finished,
 *     and the lane tally must always match what's actually filtered into
 *     each lane.
 *  6. A completed ETAT ('seen') must not display as "Awaiting Triage"; a
 *     'lwbs'/terminal-status triage must not produce a live queue entry.
 */
import {
  buildUnifiedPatientRows,
  buildActiveTriageByPatient,
  buildQueueEntryByPatient,
  computeRowQueueColumns,
  computeRowStatusGroup,
  tallyByStatusGroup,
  buildClaimUpdate,
  type WorklistPatient,
  type UnifiedPatientRow,
} from '@/components/ehr/EhrClinicalDashboard';
import { STAGE_LABELS } from '@/lib/services/patient-queue-service';
import { makeAppointment, makeTriage, resetFixtureSeq } from './fixtures';

const CLINICIAN_NAME = 'Dr. Deng Mabior';

function baseWorklistPatient(overrides: Partial<WorklistPatient> = {}): WorklistPatient {
  return {
    _id: 'p-1',
    name: 'Test Patient',
    age: 30,
    gender: 'M',
    ...overrides,
  };
}

beforeEach(() => resetFixtureSeq());

describe('buildUnifiedPatientRows — labelling', () => {
  test('an unassigned patient row is NOT pre-labelled with the viewing clinician\'s name', () => {
    const patient = baseWorklistPatient({ _id: 'unclaimed-1', name: 'Nyandeng Deng' });
    // No assignedDoctor set — the exact shape dashboard/page.tsx's
    // `unassignedRows` produces for an unclaimed triaged walk-in.

    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('');
    expect(rows[0].provider).not.toBe(CLINICIAN_NAME);
  });

  test('computeRowQueueColumns renders an empty provider as "Doctor unassigned"', () => {
    const patient = baseWorklistPatient({ _id: 'unclaimed-2' });
    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });
    const columns = computeRowQueueColumns(rows[0], null, null, Date.now());
    expect(columns.careTeamPrimary).toBe('Doctor unassigned');
    expect(columns.careTeamPrimary).not.toContain('Deng Mabior');
  });

  test('an assigned patient borrows the viewing clinician\'s name only when the row already has one', () => {
    const patient = baseWorklistPatient({ _id: 'assigned-1', assignedDoctor: 'doctor-1', doctor: CLINICIAN_NAME });
    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });
    expect(rows[0].provider).toBe(CLINICIAN_NAME);
  });
});

describe('buildUnifiedPatientRows — no duplication', () => {
  test('a patient already in `patients` with a same-day appointment renders once, not twice', () => {
    const patient = baseWorklistPatient({ _id: 'dup-1', name: 'Akol Wani' });
    const appt = makeAppointment({ patientId: 'dup-1', patientName: 'Akol Wani', appointmentDate: '2026-08-04' });

    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [appt],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });

    expect(rows.filter(r => r.id === 'dup-1')).toHaveLength(1);
    // The single row is enriched with the appointment (time/status), not a
    // second bare appointment-only row.
    expect(rows[0].appointment?._id).toBe(appt._id);
  });

  test('a patient matched only by name (no patientId on the appointment) still dedupes', () => {
    const patient = baseWorklistPatient({ _id: 'dup-2', name: 'Akuot Malual' });
    const appt = makeAppointment({ patientId: '', patientName: 'Akuot Malual', appointmentDate: '2026-08-04' });

    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [appt],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });

    expect(rows).toHaveLength(1);
  });

  test('an appointment for a patient NOT in `patients` still adds its own row', () => {
    const appt = makeAppointment({ _id: 'solo-appt', patientId: 'solo-patient', patientName: 'Solo Patient', appointmentDate: '2026-08-04' });
    const rows = buildUnifiedPatientRows({
      patients: [],
      selectedAppointmentsForDay: [appt],
      photoByPatientId: new Map(),
      clinicianName: CLINICIAN_NAME,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isAssigned).toBe(false);
  });
});

describe('triage handoff — active-triage / queue-entry derivation', () => {
  test('a "seen" triage without a room produces "Awaiting Rooming", not "Awaiting Triage"', () => {
    const triage = makeTriage({ patientId: 'p-seen', status: 'seen', triagedAt: '2026-08-04T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const active = buildActiveTriageByPatient([triage], nowMs);
    const queue = buildQueueEntryByPatient(active);
    const entry = queue.get('p-seen')!;
    expect(entry).toBeDefined();
    expect(STAGE_LABELS[entry.stage]).toBe('Awaiting Rooming');
    expect(STAGE_LABELS[entry.stage]).not.toBe('Awaiting Triage');
  });

  test('a "seen" triage WITH a room produces "Awaiting Consultation"', () => {
    const triage = makeTriage({ patientId: 'p-roomed', status: 'seen', assignedRoom: 'Room 3', triagedAt: '2026-08-04T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const queue = buildQueueEntryByPatient(buildActiveTriageByPatient([triage], nowMs));
    expect(STAGE_LABELS[queue.get('p-roomed')!.stage]).toBe('Awaiting Consultation');
  });

  test('a "pending" triage produces "Awaiting Triage" and comes from Registration', () => {
    const triage = makeTriage({ patientId: 'p-pending', status: 'pending', triagedAt: '2026-08-04T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const active = buildActiveTriageByPatient([triage], nowMs);
    const queue = buildQueueEntryByPatient(active);
    const entry = queue.get('p-pending')!;
    expect(STAGE_LABELS[entry.stage]).toBe('Awaiting Triage');

    const row: UnifiedPatientRow = {
      id: 'p-pending', patient: null, appointment: null, name: 'Pending Patient',
      patientId: 'p-pending', triagePriority: 'GREEN', reason: '', timeLabel: '',
      status: 'scheduled', department: 'OPD', provider: '', isAssigned: true,
    };
    const columns = computeRowQueueColumns(row, entry, active.get('p-pending') ?? null, nowMs);
    expect(columns.comingFrom).toBe('Registration');
  });

  test('an "lwbs" triage produces no live queue entry — must not appear in the active queue', () => {
    const triage = makeTriage({ patientId: 'p-lwbs', status: 'lwbs', triagedAt: '2026-08-04T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const queue = buildQueueEntryByPatient(buildActiveTriageByPatient([triage], nowMs));
    expect(queue.has('p-lwbs')).toBe(false);
  });

  test('a terminal ("discharged") triage produces no live queue entry', () => {
    const triage = makeTriage({ patientId: 'p-discharged', status: 'discharged', triagedAt: '2026-08-04T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const queue = buildQueueEntryByPatient(buildActiveTriageByPatient([triage], nowMs));
    expect(queue.has('p-discharged')).toBe(false);
  });

  test('a triage older than the 24h window is dropped entirely', () => {
    const triage = makeTriage({ patientId: 'p-stale', status: 'pending', triagedAt: '2026-08-02T09:00:00.000Z' });
    const nowMs = new Date('2026-08-04T10:00:00.000Z').getTime();
    const active = buildActiveTriageByPatient([triage], nowMs);
    expect(active.has('p-stale')).toBe(false);
  });

  test('nowMs === null (wall clock not sampled yet) returns an empty map rather than guessing', () => {
    const triage = makeTriage({ patientId: 'p-x', status: 'pending' });
    expect(buildActiveTriageByPatient([triage], null).size).toBe(0);
  });
});

describe('lane grouping — status change moves a row, and counts match the rendered rows', () => {
  test('a scheduled status with no live queue entry stays in the Scheduled lane', () => {
    expect(computeRowStatusGroup('scheduled', false)).toBe('scheduled');
  });

  test('a scheduled status WITH a live queue entry (walk-in) promotes to In Office', () => {
    expect(computeRowStatusGroup('scheduled', true)).toBe('in_office');
  });

  test('checked_in is always In Office regardless of queue entry', () => {
    expect(computeRowStatusGroup('checked_in', false)).toBe('in_office');
  });

  test('completed is always Finished', () => {
    expect(computeRowStatusGroup('completed', false)).toBe('finished');
    expect(computeRowStatusGroup('completed', true)).toBe('finished');
  });

  test('a status change moves a row from Scheduled to Finished', () => {
    const before = computeRowStatusGroup('scheduled', false);
    const after = computeRowStatusGroup('completed', false);
    expect(before).toBe('scheduled');
    expect(after).toBe('finished');
  });

  test('tallyByStatusGroup always agrees with filtering rows by the same groupOf function', () => {
    const rows: UnifiedPatientRow[] = [
      { id: '1', patient: null, appointment: null, name: 'A', triagePriority: 'GREEN', reason: '', timeLabel: '', status: 'scheduled', department: 'OPD', provider: '', isAssigned: true },
      { id: '2', patient: null, appointment: null, name: 'B', triagePriority: 'GREEN', reason: '', timeLabel: '', status: 'checked_in', department: 'OPD', provider: '', isAssigned: true },
      { id: '3', patient: null, appointment: null, name: 'C', triagePriority: 'GREEN', reason: '', timeLabel: '', status: 'in_progress', department: 'OPD', provider: '', isAssigned: true },
      { id: '4', patient: null, appointment: null, name: 'D', triagePriority: 'GREEN', reason: '', timeLabel: '', status: 'completed', department: 'OPD', provider: '', isAssigned: true },
      { id: '5', patient: null, appointment: null, name: 'E', triagePriority: 'GREEN', reason: '', timeLabel: '', status: 'no_show', department: 'OPD', provider: '', isAssigned: true },
    ];
    const groupOf = (row: UnifiedPatientRow) => computeRowStatusGroup(row.status, false);
    const tally = tallyByStatusGroup(rows, groupOf);

    for (const group of ['scheduled', 'in_office', 'finished'] as const) {
      const rendered = rows.filter(row => groupOf(row) === group);
      expect(tally[group]).toBe(rendered.length);
    }
    expect(tally.scheduled + tally.in_office + tally.finished).toBe(rows.length);
  });
});

describe('buildClaimUpdate — claiming assigns the patient to the claimer', () => {
  test('claiming an unassigned patient assigns them to the claiming clinician, not any prior value', () => {
    const claimer = { _id: 'doctor-9', name: 'Dr. Claimer' };
    const update = buildClaimUpdate(undefined, claimer, new Date('2026-08-04T10:00:00.000Z'));
    expect(update.assignedDoctor).toBe('doctor-9');
    expect(update.assignedDoctorName).toBe('Dr. Claimer');
    expect(update.assignmentStatus).toBe('accepted');
    expect(update.assignmentAcceptedBy).toBe('doctor-9');
    expect(update.assignmentAcceptedAt).toBe('2026-08-04T10:00:00.000Z');
  });

  test('claiming a patient already carrying a DIFFERENT assignedDoctor still reassigns to the claimer', () => {
    const claimer = { _id: 'doctor-9', name: 'Dr. Claimer' };
    const priorAssignment = baseWorklistPatient({ assignedDoctor: 'doctor-2', assignedDoctorName: 'Dr. Someone Else' });
    const update = buildClaimUpdate(priorAssignment, claimer);
    expect(update.assignedDoctor).toBe('doctor-9');
    expect(update.assignedDoctorName).toBe('Dr. Claimer');
  });

  test('with no signed-in user (should not happen, but must not crash), falls back to the existing assignment', () => {
    const priorAssignment = baseWorklistPatient({ assignedDoctor: 'doctor-2', assignedDoctorName: 'Dr. Someone Else' });
    const update = buildClaimUpdate(priorAssignment, undefined);
    expect(update.assignedDoctor).toBe('doctor-2');
    expect(update.assignedDoctorName).toBe('Dr. Someone Else');
  });
});

describe('end-to-end pipeline — unassigned row is visible, correctly labelled, and claimable', () => {
  test('a walk-in worklist row from dashboard/page.tsx renders as "Doctor unassigned" and claiming assigns it to the viewer', () => {
    const patient = baseWorklistPatient({ _id: 'pipeline-1', name: 'Awut Malual' }); // no assignedDoctor
    const rows = buildUnifiedPatientRows({
      patients: [patient],
      selectedAppointmentsForDay: [],
      photoByPatientId: new Map(),
      clinicianName: 'Dr. Some Other Clinician Entirely',
    });
    const row = rows[0];
    const columns = computeRowQueueColumns(row, null, null, Date.now());
    expect(columns.careTeamPrimary).toBe('Doctor unassigned');

    const claimer = { _id: 'doctor-claim', name: 'Dr. Claiming Now' };
    const claimUpdate = buildClaimUpdate(row.patient, claimer, new Date());
    expect(claimUpdate.assignedDoctor).toBe('doctor-claim');
    expect(claimUpdate.assignedDoctor).not.toBe('Dr. Some Other Clinician Entirely');
  });
});
