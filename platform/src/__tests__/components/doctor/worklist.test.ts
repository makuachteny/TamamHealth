/**
 * Behavioral coverage for `assembleDoctorWorklist` (src/app/(dashboard)/dashboard/page.tsx).
 *
 * The function is a pure combiner: every input is already the resolved output
 * of a scoped hook, so this suite only exercises the assembler's own combining
 * logic (assignment/triage merge, sort orders, tone derivation, entry
 * filtering) — never tenancy/scope filtering, which happens upstream.
 *
 * Every test passes a fixed `now` so nothing here depends on the wall clock.
 */
import { assembleDoctorWorklist, type DoctorWorklistInput } from '@/app/(dashboard)/dashboard/page';
import { computeSignCount } from '@/lib/hooks/signing-inbox-math';
import {
  makePatient,
  makeTriage,
  makeAppointment,
  makeMedicalRecord,
  makeAssessment,
  makeClinicalNote,
  makeReferral,
  makePhoneNote,
  makeTransfer,
  makeResumableEncounter,
  resetFixtureSeq,
} from './fixtures';

// Fixed reference instant for every test: 2026-08-04T12:00:00.000Z.
// todayIso = '2026-08-04'; the 24h "active triage" cutoff = 2026-08-03T12:00:00.000Z.
const NOW = new Date('2026-08-04T12:00:00.000Z');

const CURRENT_USER = { _id: 'doctor-1', name: 'Dr. Deng' };

function baseInput(overrides: Partial<DoctorWorklistInput> = {}): DoctorWorklistInput {
  return {
    patients: [],
    triages: [],
    currentUser: CURRENT_USER,
    appointments: [],
    unsignedDrafts: [],
    awaitingCosign: [],
    heldAssessments: [],
    unsignedNotes: [],
    phoneNotesInbox: [],
    referrals: [],
    resumableEncounters: [],
    incomingTransfers: [],
    now: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  resetFixtureSeq();
});

describe('assembleDoctorWorklist — assigned patients', () => {
  test('only patients assigned to currentUser appear as assigned rows; other doctors excluded', () => {
    const mine = makePatient({ _id: 'p-mine', assignedDoctor: 'doctor-1', assignedAt: '2026-08-04T09:00:00.000Z' });
    const others = makePatient({ _id: 'p-others', assignedDoctor: 'doctor-2', assignedAt: '2026-08-04T11:00:00.000Z' });
    const unassigned = makePatient({ _id: 'p-none' });

    const result = assembleDoctorWorklist(baseInput({ patients: [mine, others, unassigned] }));

    const ids = result.patients.map(p => p._id);
    expect(ids).toContain('p-mine');
    expect(ids).not.toContain('p-others');
    expect(ids).not.toContain('p-none');
  });

  test('assigned rows are sorted by assignedAt descending', () => {
    const older = makePatient({ _id: 'p-older', assignedDoctor: 'doctor-1', assignedAt: '2026-08-03T10:00:00.000Z' });
    const newer = makePatient({ _id: 'p-newer', assignedDoctor: 'doctor-1', assignedAt: '2026-08-04T09:00:00.000Z' });
    const newest = makePatient({ _id: 'p-newest', assignedDoctor: 'doctor-1', assignedAt: '2026-08-04T11:30:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [older, newer, newest] }));

    expect(result.patients.map(p => p._id)).toEqual(['p-newest', 'p-newer', 'p-older']);
  });
});

describe('assembleDoctorWorklist — unclaimed triaged walk-ins', () => {
  test('an unassigned patient with an active (pending) triage within 24h appears as an unassigned row', () => {
    const patient = makePatient({ _id: 'p-walkin' });
    const triage = makeTriage({
      patientId: 'p-walkin',
      status: 'pending',
      triagedAt: '2026-08-04T08:00:00.000Z', // 4h before NOW — active, today
      priority: 'YELLOW',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    const row = result.patients.find(p => p._id === 'p-walkin');
    expect(row).toBeDefined();
    expect(row?.doctor).toBe('');
    expect(row?.assignedDoctor).toBeUndefined();
  });

  test('an unassigned patient with an active "seen" triage within 24h also appears', () => {
    const patient = makePatient({ _id: 'p-seen' });
    const triage = makeTriage({
      patientId: 'p-seen',
      status: 'seen',
      triagedAt: '2026-08-04T10:00:00.000Z',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients.some(p => p._id === 'p-seen')).toBe(true);
  });

  test('a triage older than 24h does not surface the patient', () => {
    const patient = makePatient({ _id: 'p-stale' });
    const triage = makeTriage({
      patientId: 'p-stale',
      status: 'pending',
      // Cutoff is 2026-08-03T12:00:00.000Z — this is before it.
      triagedAt: '2026-08-03T08:00:00.000Z',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients.some(p => p._id === 'p-stale')).toBe(false);
  });

  test('a non-active triage status (e.g. admitted) within 24h does not surface the patient', () => {
    const patient = makePatient({ _id: 'p-admitted' });
    const triage = makeTriage({
      patientId: 'p-admitted',
      status: 'admitted',
      triagedAt: '2026-08-04T08:00:00.000Z',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients.some(p => p._id === 'p-admitted')).toBe(false);
  });

  test('a patient assigned to ANOTHER doctor with an active triage does not appear at all', () => {
    const patient = makePatient({ _id: 'p-others-triaged', assignedDoctor: 'doctor-2', assignedAt: '2026-08-04T09:00:00.000Z' });
    const triage = makeTriage({
      patientId: 'p-others-triaged',
      status: 'pending',
      triagedAt: '2026-08-04T08:00:00.000Z',
      priority: 'RED',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    // Not in assignedRows (wrong doctor) AND not in unassignedRows (has an assignedDoctor).
    expect(result.patients.some(p => p._id === 'p-others-triaged')).toBe(false);
  });

  test('a patient with both an assignment to this doctor and an active triage appears exactly once', () => {
    const patient = makePatient({ _id: 'p-both', assignedDoctor: 'doctor-1', assignedAt: '2026-08-04T09:00:00.000Z' });
    const triage = makeTriage({
      patientId: 'p-both',
      status: 'pending',
      triagedAt: '2026-08-04T08:00:00.000Z',
    });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    const matches = result.patients.filter(p => p._id === 'p-both');
    expect(matches).toHaveLength(1);
    expect(matches[0].assignedDoctor).toBe('doctor-1');
  });
});

describe('assembleDoctorWorklist — triage priority', () => {
  test('an unassigned row carries the HIGHEST of today\'s triage priorities, not just its chosen active triage\'s own priority', () => {
    const patient = makePatient({ _id: 'p-prio' });
    // triages must be newest-first, matching getAllTriage's real ordering —
    // the assembler keeps only the first (latest) doc per patient for its
    // "which triage is this row about" pick.
    const triages = [
      makeTriage({ _id: 't-latest', patientId: 'p-prio', status: 'pending', triagedAt: '2026-08-04T09:00:00.000Z', priority: 'GREEN' }),
      makeTriage({ _id: 't-earlier', patientId: 'p-prio', status: 'pending', triagedAt: '2026-08-04T07:00:00.000Z', priority: 'RED' }),
    ];

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages }));

    const row = result.patients.find(p => p._id === 'p-prio');
    // The chosen active-triage doc (latest) is GREEN, but the day's max is RED.
    expect(row?.triagePriority).toBe('RED');
  });

  test('RED beats YELLOW beats GREEN for an assigned row too', () => {
    const patient = makePatient({ _id: 'p-assigned-prio', assignedDoctor: 'doctor-1', assignedAt: '2026-08-04T09:00:00.000Z' });
    const triages = [
      makeTriage({ patientId: 'p-assigned-prio', triagedAt: '2026-08-04T07:00:00.000Z', priority: 'GREEN' }),
      makeTriage({ patientId: 'p-assigned-prio', triagedAt: '2026-08-04T08:00:00.000Z', priority: 'YELLOW' }),
      makeTriage({ patientId: 'p-assigned-prio', triagedAt: '2026-08-04T09:00:00.000Z', priority: 'RED' }),
    ];

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages }));

    expect(result.patients.find(p => p._id === 'p-assigned-prio')?.triagePriority).toBe('RED');
  });

  test('YELLOW beats GREEN when there is no RED', () => {
    const patient = makePatient({ _id: 'p-yg' });
    const triages = [
      makeTriage({ patientId: 'p-yg', status: 'pending', triagedAt: '2026-08-04T07:00:00.000Z', priority: 'GREEN' }),
      makeTriage({ patientId: 'p-yg', status: 'pending', triagedAt: '2026-08-04T08:00:00.000Z', priority: 'YELLOW' }),
    ];

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages }));

    expect(result.patients.find(p => p._id === 'p-yg')?.triagePriority).toBe('YELLOW');
  });
});

describe('assembleDoctorWorklist — appointments', () => {
  test('only this provider\'s appointments are kept, sorted by date+time ascending', () => {
    const apptD = makeAppointment({ _id: 'appt-D', providerId: 'doctor-1', appointmentDate: '2026-08-03', appointmentTime: '10:00', status: 'completed' });
    const apptB = makeAppointment({ _id: 'appt-B', providerId: 'doctor-1', appointmentDate: '2026-08-04', appointmentTime: '08:00' });
    const apptA = makeAppointment({ _id: 'appt-A', providerId: 'doctor-1', appointmentDate: '2026-08-04', appointmentTime: '09:00' });
    const apptI = makeAppointment({ _id: 'appt-I', providerId: 'doctor-1', appointmentDate: '2026-08-05', appointmentTime: '07:00' });
    const apptOther = makeAppointment({ _id: 'appt-other-provider', providerId: 'doctor-2', appointmentDate: '2026-08-04', appointmentTime: '08:30' });

    const result = assembleDoctorWorklist(baseInput({ appointments: [apptI, apptA, apptOther, apptD, apptB] }));

    expect(result.appointments.map(a => a._id)).toEqual(['appt-D', 'appt-B', 'appt-A', 'appt-I']);
  });

  test('completed/cancelled/no_show appointments are retained in `appointments` (Finished lane)', () => {
    const completed = makeAppointment({ _id: 'appt-completed', providerId: 'doctor-1', status: 'completed' });
    const cancelled = makeAppointment({ _id: 'appt-cancelled', providerId: 'doctor-1', status: 'cancelled' });
    const noShow = makeAppointment({ _id: 'appt-noshow', providerId: 'doctor-1', status: 'no_show' });

    const result = assembleDoctorWorklist(baseInput({ appointments: [completed, cancelled, noShow] }));

    expect(result.appointments.map(a => a._id).sort()).toEqual(['appt-cancelled', 'appt-completed', 'appt-noshow']);
  });

  test('closed appointments are excluded from telehealth entries even when telehealth-typed and today', () => {
    const live = makeAppointment({
      _id: 'appt-tele-live', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-04', appointmentTime: '10:00', status: 'scheduled',
    });
    const cancelled = makeAppointment({
      _id: 'appt-tele-cancelled', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-04', appointmentTime: '11:00', status: 'cancelled',
    });
    const completed = makeAppointment({
      _id: 'appt-tele-completed', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-04', appointmentTime: '12:00', status: 'completed',
    });
    const noShow = makeAppointment({
      _id: 'appt-tele-noshow', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-04', appointmentTime: '13:00', status: 'no_show',
    });

    const result = assembleDoctorWorklist(baseInput({ appointments: [live, cancelled, completed, noShow] }));

    // All four remain in the flat appointments list...
    expect(result.appointments).toHaveLength(4);
    // ...but only the still-live one becomes a telehealth entry.
    const telehealthItem = result.outstanding.find(o => o.label === 'Telehealth visits');
    expect(telehealthItem?.count).toBe(1);
    expect(telehealthItem?.entries?.map(e => e.id)).toEqual(['appt-tele-live']);
  });

  test('telehealth entries only include today\'s telehealth-type appointments', () => {
    const todayTele = makeAppointment({
      _id: 'appt-today-tele', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-04', status: 'scheduled',
    });
    const futureTele = makeAppointment({
      _id: 'appt-future-tele', providerId: 'doctor-1', appointmentType: 'telehealth',
      appointmentDate: '2026-08-05', status: 'scheduled',
    });
    const todayInPerson = makeAppointment({
      _id: 'appt-today-general', providerId: 'doctor-1', appointmentType: 'general',
      appointmentDate: '2026-08-04', status: 'scheduled',
    });

    const result = assembleDoctorWorklist(baseInput({ appointments: [todayTele, futureTele, todayInPerson] }));

    const telehealthItem = result.outstanding.find(o => o.label === 'Telehealth visits');
    expect(telehealthItem?.entries?.map(e => e.id)).toEqual(['appt-today-tele']);
    expect(telehealthItem?.entries?.[0].href).toBe(`/telehealth/visit/${encodeURIComponent('appt-today-tele')}`);
  });
});

describe('assembleDoctorWorklist — outstanding: documents to sign', () => {
  test('the sign count is computeSignCount over the four signing-inbox inputs', () => {
    const unsignedDrafts = [makeMedicalRecord({ _id: 'draft-1' }), makeMedicalRecord({ _id: 'draft-2' })];
    const awaitingCosign = [makeMedicalRecord({ _id: 'cosign-1' })];
    const heldAssessments = [makeAssessment({ _id: 'assess-1' })];
    const unsignedNotes = [makeClinicalNote({ _id: 'note-1' })];

    const input = baseInput({ unsignedDrafts, awaitingCosign, heldAssessments, unsignedNotes });
    const result = assembleDoctorWorklist(input);

    const expectedCount = computeSignCount({ unsignedDrafts, awaitingCosign, heldAssessments, unsignedNotes });
    expect(expectedCount).toBe(5);

    const item = result.outstanding.find(o => o.label === 'Documents to sign');
    expect(item?.count).toBe(expectedCount);
    expect(item?.tone).toBe('warning');
    expect(item?.entries).toHaveLength(5);
  });

  test('a zero sign count is neutral-toned', () => {
    const result = assembleDoctorWorklist(baseInput());
    const item = result.outstanding.find(o => o.label === 'Documents to sign');
    expect(item?.count).toBe(0);
    expect(item?.tone).toBe('neutral');
  });
});

describe('assembleDoctorWorklist — outstanding: phone notes', () => {
  test('phone note count and entries reflect the inbox, routed to /messages', () => {
    const notes = [
      makePhoneNote({ _id: 'pn-1', patientName: 'Akol Deng' }),
      makePhoneNote({ _id: 'pn-2', patientName: undefined, callerName: 'A relative' }),
    ];

    const result = assembleDoctorWorklist(baseInput({ phoneNotesInbox: notes }));

    const item = result.outstanding.find(o => o.label === 'Phone notes');
    expect(item?.count).toBe(2);
    expect(item?.tone).toBe('warning');
    expect(item?.entries?.every(e => e.href === '/messages')).toBe(true);
    expect(item?.entries?.map(e => e.title)).toEqual(['Akol Deng', 'A relative']);
  });

  test('an empty phone note inbox is neutral-toned with zero count', () => {
    const result = assembleDoctorWorklist(baseInput());
    const item = result.outstanding.find(o => o.label === 'Phone notes');
    expect(item?.count).toBe(0);
    expect(item?.tone).toBe('neutral');
  });
});

describe('assembleDoctorWorklist — outstanding: open referrals', () => {
  test('only this clinician\'s open-status referrals are counted; others and closed ones are excluded', () => {
    const sent = makeReferral({ _id: 'ref-sent', createdBy: 'doctor-1', status: 'sent' });
    const received = makeReferral({ _id: 'ref-received', createdBy: 'doctor-1', status: 'received' });
    const seen = makeReferral({ _id: 'ref-seen', createdBy: 'doctor-1', status: 'seen' });
    const completed = makeReferral({ _id: 'ref-completed', createdBy: 'doctor-1', status: 'completed' });
    const cancelled = makeReferral({ _id: 'ref-cancelled', createdBy: 'doctor-1', status: 'cancelled' });
    const othersReferral = makeReferral({ _id: 'ref-others', createdBy: 'doctor-2', status: 'sent' });
    // UI-created referrals currently ship with no `createdBy` stamped at all
    // (see the note on the fix below) — such a referral must not be
    // attributed to this clinician just because nobody else claims it either.
    const noCreatedBy = makeReferral({ _id: 'ref-no-creator', createdBy: undefined, status: 'sent' });

    const result = assembleDoctorWorklist(baseInput({
      referrals: [sent, received, seen, completed, cancelled, othersReferral, noCreatedBy],
    }));

    const item = result.outstanding.find(o => o.label === 'Open referrals');
    expect(item?.count).toBe(3);
    expect(item?.entries?.map(e => e.id).sort()).toEqual(['ref-received', 'ref-seen', 'ref-sent']);
    // Explicitly assert the createdBy-less referral is excluded: today the UI
    // does not stamp `createdBy` on referrals it creates, so until that fix
    // lands, every UI-created referral is invisible on this rail.
    expect(item?.entries?.some(e => e.id === 'ref-no-creator')).toBe(false);
  });
});

describe('assembleDoctorWorklist — outstanding: awaiting labs', () => {
  test('an encounter with all results back gets danger tone and a consultation-resume href', () => {
    const enc = makeResumableEncounter({ _id: 'enc-full', allResultsBack: true, resultsReady: 3, resultsTotal: 3 });

    const result = assembleDoctorWorklist(baseInput({ resumableEncounters: [enc] }));

    const item = result.outstanding.find(o => o.label === 'Awaiting labs');
    const entry = item?.entries?.find(e => e.id === 'enc-full');
    expect(entry?.tone).toBe('danger');
    expect(entry?.href).toContain('encounter=');
    expect(entry?.href).toBe('/consultation?encounter=enc-full');
  });

  test('an encounter with partial results gets neutral tone and links to /lab', () => {
    const enc = makeResumableEncounter({ _id: 'enc-partial', allResultsBack: false, resultsReady: 1, resultsTotal: 3 });

    const result = assembleDoctorWorklist(baseInput({ resumableEncounters: [enc] }));

    const item = result.outstanding.find(o => o.label === 'Awaiting labs');
    const entry = item?.entries?.find(e => e.id === 'enc-partial');
    expect(entry?.tone).toBe('neutral');
    expect(entry?.href).toBe('/lab');
    expect(entry?.subtitle).toBe('1 of 3 results back');
  });
});

describe('assembleDoctorWorklist — outstanding: transfers', () => {
  test('an overdue transfer gets danger tone on its entry and the item; href targets the referrals tab', () => {
    const overdue = makeTransfer({
      _id: 'xfer-overdue',
      patientId: 'patient-overdue',
      status: 'requested',
      urgency: 'routine', // 48h SLA
      requestedAt: '2026-08-02T10:00:00.000Z', // deadline 2026-08-04T10:00Z, before NOW (12:00Z)
    });
    const onTime = makeTransfer({
      _id: 'xfer-ontime',
      patientId: 'patient-ontime',
      status: 'requested',
      urgency: 'routine',
      requestedAt: '2026-08-04T11:00:00.000Z', // deadline well after NOW
    });

    const result = assembleDoctorWorklist(baseInput({ incomingTransfers: [overdue, onTime] }));

    const item = result.outstanding.find(o => o.label === 'Transfers to accept');
    expect(item?.count).toBe(2);
    // Item-level tone escalates to danger as soon as ANY transfer is overdue.
    expect(item?.tone).toBe('danger');

    const overdueEntry = item?.entries?.find(e => e.id === 'xfer-overdue');
    const onTimeEntry = item?.entries?.find(e => e.id === 'xfer-ontime');
    expect(overdueEntry?.tone).toBe('danger');
    expect(overdueEntry?.meta).toBe('Overdue');
    expect(overdueEntry?.href).toBe('/patients/patient-overdue?tab=referrals');
    expect(onTimeEntry?.tone).toBe('warning');
    expect(onTimeEntry?.href).toBe('/patients/patient-ontime?tab=referrals');
  });

  test('no incoming transfers is neutral-toned with zero count', () => {
    const result = assembleDoctorWorklist(baseInput());
    const item = result.outstanding.find(o => o.label === 'Transfers to accept');
    expect(item?.count).toBe(0);
    expect(item?.tone).toBe('neutral');
  });

  test('transfers present but none overdue is warning-toned', () => {
    const onTime = makeTransfer({
      _id: 'xfer-ontime-only',
      patientId: 'patient-x',
      status: 'requested',
      urgency: 'routine',
      requestedAt: '2026-08-04T11:00:00.000Z',
    });
    const result = assembleDoctorWorklist(baseInput({ incomingTransfers: [onTime] }));
    const item = result.outstanding.find(o => o.label === 'Transfers to accept');
    expect(item?.tone).toBe('warning');
  });
});
