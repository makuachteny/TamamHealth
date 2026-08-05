/**
 * app/(dashboard)/dashboard/page.tsx — `assembleDoctorWorklist`, the pure
 * data-assembly function behind the doctor/CO/clinician worklist and the
 * "outstanding items" rail (signing inbox, referrals, labs, telehealth,
 * transfers).
 *
 * Regression coverage for defects fixed earlier today:
 *  1. An unclaimed-but-triaged patient (active triage, no assignedDoctor, no
 *     booking) must appear on the worklist — previously invisible to every
 *     doctor in the building.
 *  2. A patient who is both assigned AND triaged must appear exactly once.
 *  3. Tenancy: the worklist never includes a patient absent from the scoped
 *     `patients` input, even if `triages` references them.
 *  4. `unsignedNotes` must be folded into signCount AND rendered as document
 *     entries linking to /notes/[id] — not a patient route.
 */
import { assembleDoctorWorklist } from '@/app/(dashboard)/dashboard/page';
import {
  makePatient, makeTriage, makeAppointment, makeMedicalRecord, makeAssessment,
  makeClinicalNote, makeReferral, makePhoneNote, makeTransfer, makeResumableEncounter,
  resetFixtureSeq,
} from './fixtures';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const VIEWER = { _id: 'doctor-1', name: 'Dr. Deng Mabior' };
const OTHER_DOCTOR_ID = 'doctor-2';

function baseInput(overrides: Partial<Parameters<typeof assembleDoctorWorklist>[0]> = {}) {
  return {
    patients: [],
    triages: [],
    currentUser: VIEWER,
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

beforeEach(() => resetFixtureSeq());

describe('assembleDoctorWorklist — unassigned triaged patients', () => {
  test('an active-triage patient with no assignedDoctor and no booking appears on the worklist, labelled unassigned', () => {
    const patient = makePatient({ _id: 'walkin-1', firstName: 'Nyandeng', surname: 'Deng' });
    const triage = makeTriage({ patientId: 'walkin-1', status: 'pending', triagedAt: '2026-08-04T09:30:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients).toHaveLength(1);
    const row = result.patients[0];
    expect(row._id).toBe('walkin-1');
    // Not pre-labelled with the viewing clinician's own name.
    expect(row.doctor).toBe('');
    expect(row.assignedDoctor).toBeUndefined();
  });

  test('an active-triage patient with a "seen" status (post-ETAT, pre-claim) also appears', () => {
    const patient = makePatient({ _id: 'walkin-2' });
    const triage = makeTriage({ patientId: 'walkin-2', status: 'seen', triagedAt: '2026-08-04T09:45:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients.map(p => p._id)).toContain('walkin-2');
  });

  test('a triage older than 24h does not surface an unclaimed row', () => {
    const patient = makePatient({ _id: 'stale-1' });
    const triage = makeTriage({ patientId: 'stale-1', status: 'pending', triagedAt: '2026-08-02T09:00:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients).toHaveLength(0);
  });

  test('a patient with only an "lwbs" triage never appears — left without being seen', () => {
    const patient = makePatient({ _id: 'lwbs-1' });
    const triage = makeTriage({ patientId: 'lwbs-1', status: 'lwbs', triagedAt: '2026-08-04T09:00:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients).toHaveLength(0);
  });

  test('a patient with a terminal ("discharged") triage status never appears as unclaimed', () => {
    const patient = makePatient({ _id: 'discharged-1' });
    const triage = makeTriage({ patientId: 'discharged-1', status: 'discharged', triagedAt: '2026-08-04T09:00:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients).toHaveLength(0);
  });
});

describe('assembleDoctorWorklist — no duplication', () => {
  test('a patient assigned to the viewer AND actively triaged appears exactly once', () => {
    const patient = makePatient({ _id: 'both-1', assignedDoctor: VIEWER._id, assignedDoctorName: VIEWER.name });
    const triage = makeTriage({ patientId: 'both-1', status: 'seen', triagedAt: '2026-08-04T09:30:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients.filter(p => p._id === 'both-1')).toHaveLength(1);
    expect(result.patients[0].assignedDoctor).toBe(VIEWER._id);
  });

  test('a patient assigned to a DIFFERENT doctor and actively triaged does not leak onto this viewer\'s worklist', () => {
    const patient = makePatient({ _id: 'someone-elses', assignedDoctor: OTHER_DOCTOR_ID, assignedDoctorName: 'Dr. Other' });
    const triage = makeTriage({ patientId: 'someone-elses', status: 'pending', triagedAt: '2026-08-04T09:30:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({ patients: [patient], triages: [triage] }));

    expect(result.patients).toHaveLength(0);
  });
});

describe('assembleDoctorWorklist — tenancy', () => {
  test('a patient outside the scoped `patients` input never appears, even if triages references them', () => {
    const inScope = makePatient({ _id: 'in-scope-1' });
    const inScopeTriage = makeTriage({ patientId: 'in-scope-1', status: 'pending', triagedAt: '2026-08-04T09:30:00.000Z' });
    // Simulates a triage doc for a patient at a different facility/org — one
    // that never made it into the (already hospital/org-scoped) `patients`
    // array `usePatients()` would have returned.
    const otherFacilityTriage = makeTriage({ patientId: 'other-facility-ghost', status: 'pending', triagedAt: '2026-08-04T09:31:00.000Z' });

    const result = assembleDoctorWorklist(baseInput({
      patients: [inScope],
      triages: [inScopeTriage, otherFacilityTriage],
    }));

    // In-scope patient still appears...
    expect(result.patients.map(p => p._id)).toContain('in-scope-1');
    // ...but nothing for the out-of-scope patient is manufactured.
    expect(result.patients.map(p => p._id)).not.toContain('other-facility-ghost');
    expect(result.patients).toHaveLength(1);
  });

  test('an assigned patient outside the scoped `patients` input never appears', () => {
    // No patients handed in at all — as if usePatients() scoped this viewer's
    // facility down to nothing relevant today.
    const result = assembleDoctorWorklist(baseInput({
      patients: [],
      triages: [makeTriage({ patientId: 'ghost', status: 'pending' })],
    }));
    expect(result.patients).toHaveLength(0);
  });
});

describe('assembleDoctorWorklist — signing inbox', () => {
  test('unsignedNotes are folded into signCount and rendered as document entries linking to /notes/[id]', () => {
    const note = makeClinicalNote({ _id: 'note-1', patientName: 'Nyanut Akech', noteType: 'soap', serviceDate: '2026-08-04' });

    const result = assembleDoctorWorklist(baseInput({ unsignedNotes: [note] }));

    const docs = result.outstanding.find(item => item.label === 'Documents to sign');
    expect(docs).toBeDefined();
    expect(docs!.count).toBe(1);
    expect(docs!.entries).toHaveLength(1);
    const entry = docs!.entries![0];
    expect(entry.id).toBe('note-1');
    expect(entry.title).toBe('Nyanut Akech');
    expect(entry.href).toBe('/notes/note-1');
    // Specifically NOT a patient-chart route.
    expect(entry.href).not.toMatch(/^\/patients\//);
  });

  test('signCount sums drafts + cosign + held assessments + unsigned notes, and each renders its own entry', () => {
    const draft = makeMedicalRecord({ _id: 'draft-1', patientId: 'p-1' });
    const cosign = makeMedicalRecord({ _id: 'cosign-1', patientId: 'p-2' });
    const held = makeAssessment({ _id: 'held-1', patientId: 'p-3' });
    const note = makeClinicalNote({ _id: 'note-2', patientId: 'p-4', patientName: 'Someone' });

    const result = assembleDoctorWorklist(baseInput({
      patients: [makePatient({ _id: 'p-1', firstName: 'One' }), makePatient({ _id: 'p-2', firstName: 'Two' })],
      unsignedDrafts: [draft],
      awaitingCosign: [cosign],
      heldAssessments: [held],
      unsignedNotes: [note],
    }));

    const docs = result.outstanding.find(item => item.label === 'Documents to sign')!;
    expect(docs.count).toBe(4);
    expect(docs.entries).toHaveLength(4);

    // Notes route to their own document; everything else routes to the chart.
    const noteEntry = docs.entries!.find(e => e.id === 'note-2')!;
    expect(noteEntry.href).toBe('/notes/note-2');
    const draftEntry = docs.entries!.find(e => e.id === 'draft-1')!;
    expect(draftEntry.href).toBe('/patients/p-1');
  });

  test('an empty signing inbox reports a zero count and no entries', () => {
    const result = assembleDoctorWorklist(baseInput());
    const docs = result.outstanding.find(item => item.label === 'Documents to sign')!;
    expect(docs.count).toBe(0);
    expect(docs.entries).toHaveLength(0);
    expect(docs.tone).toBe('neutral');
  });
});

describe('assembleDoctorWorklist — outstanding rail (other items)', () => {
  test('phone notes, open referrals, labs, telehealth and transfers all carry through', () => {
    const patientId = 'p-tele';
    const result = assembleDoctorWorklist(baseInput({
      phoneNotesInbox: [makePhoneNote({ _id: 'pn-1' })],
      referrals: [makeReferral({ _id: 'r-1', createdBy: VIEWER._id, status: 'sent' })],
      resumableEncounters: [makeResumableEncounter({ _id: 'enc-1' })],
      incomingTransfers: [makeTransfer({ _id: 'xfer-1' })],
      appointments: [makeAppointment({
        _id: 'appt-tele', providerId: VIEWER._id, patientId, appointmentType: 'telehealth',
        appointmentDate: '2026-08-04', status: 'confirmed',
      })],
    }));

    expect(result.outstanding.find(i => i.label === 'Phone notes')!.count).toBe(1);
    expect(result.outstanding.find(i => i.label === 'Open referrals')!.count).toBe(1);
    expect(result.outstanding.find(i => i.label === 'Awaiting labs')!.count).toBe(1);
    expect(result.outstanding.find(i => i.label === 'Telehealth visits')!.count).toBe(1);
    expect(result.outstanding.find(i => i.label === 'Transfers to accept')!.count).toBe(1);
  });

  test('a referral created by a different clinician is not counted as "open" for this viewer', () => {
    const result = assembleDoctorWorklist(baseInput({
      referrals: [makeReferral({ _id: 'r-2', createdBy: OTHER_DOCTOR_ID, status: 'sent' })],
    }));
    expect(result.outstanding.find(i => i.label === 'Open referrals')!.count).toBe(0);
  });

  test('a completed appointment still appears in `appointments` (feeds the Finished lane) but not the telehealth tile', () => {
    const result = assembleDoctorWorklist(baseInput({
      appointments: [makeAppointment({
        _id: 'appt-done', providerId: VIEWER._id, appointmentType: 'telehealth',
        appointmentDate: '2026-08-04', status: 'completed',
      })],
    }));
    expect(result.appointments.map(a => a._id)).toContain('appt-done');
    expect(result.outstanding.find(i => i.label === 'Telehealth visits')!.count).toBe(0);
  });

  test('appointments are scoped to this clinician as the provider', () => {
    const result = assembleDoctorWorklist(baseInput({
      appointments: [
        makeAppointment({ _id: 'mine', providerId: VIEWER._id }),
        makeAppointment({ _id: 'not-mine', providerId: OTHER_DOCTOR_ID }),
      ],
    }));
    expect(result.appointments.map(a => a._id)).toEqual(['mine']);
  });
});
