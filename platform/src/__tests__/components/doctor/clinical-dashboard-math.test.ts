/**
 * lib/mobile-shell/use-clinical-dashboard-data.ts — the pure lane-split and
 * outstanding-count functions behind the mobile shell's doctor dashboard.
 *
 * Regression coverage: `unsignedNotes` must be folded into the mobile
 * "Documents to sign" tile too — this consumer's own signCount arithmetic is
 * exactly the "second consumer" that could silently miss a field added to
 * useSigningInbox() while the desktop dashboard's did not.
 */
import { computeClinicalLanes, computeClinicalOutstanding } from '@/lib/mobile-shell/use-clinical-dashboard-data';
import { makeMedicalRecord, makeAssessment, makeClinicalNote, makeAppointment, resetFixtureSeq } from './fixtures';

beforeEach(() => resetFixtureSeq());

function baseOutstandingInput(overrides: Partial<Parameters<typeof computeClinicalOutstanding>[0]> = {}) {
  return {
    currentUser: { _id: 'doctor-1', name: 'Dr. Deng Mabior' },
    unsignedDrafts: [],
    awaitingCosign: [],
    heldAssessments: [],
    unsignedNotes: [],
    phoneNotes: [],
    referrals: [],
    intakeForms: [],
    labResults: [],
    telehealthSessions: [],
    hasTelehealth: true,
    today: '2026-08-04',
    ...overrides,
  };
}

describe('computeClinicalOutstanding — signing inbox (mobile consumer)', () => {
  test('unsignedNotes are folded into the "Documents to sign" tile count', () => {
    const note = makeClinicalNote({ _id: 'note-1' });
    const items = computeClinicalOutstanding(baseOutstandingInput({ unsignedNotes: [note] }));
    const docs = items.find(i => i.key === 'documents')!;
    expect(docs.count).toBe(1);
  });

  test('signCount sums all four signing-inbox arrays, matching the desktop dashboard\'s arithmetic', () => {
    const items = computeClinicalOutstanding(baseOutstandingInput({
      unsignedDrafts: [makeMedicalRecord({ _id: 'd-1' })],
      awaitingCosign: [makeMedicalRecord({ _id: 'c-1' })],
      heldAssessments: [makeAssessment({ _id: 'h-1' })],
      unsignedNotes: [makeClinicalNote({ _id: 'n-1' }), makeClinicalNote({ _id: 'n-2' })],
    }));
    expect(items.find(i => i.key === 'documents')!.count).toBe(5);
  });

  test('an empty signing inbox reports a zero-count documents tile', () => {
    const items = computeClinicalOutstanding(baseOutstandingInput());
    expect(items.find(i => i.key === 'documents')!.count).toBe(0);
  });
});

describe('computeClinicalOutstanding — telehealth visibility', () => {
  test('the telehealth tile is omitted entirely (not shown as zero) when the role has no /telehealth route', () => {
    const items = computeClinicalOutstanding(baseOutstandingInput({ hasTelehealth: false }));
    expect(items.find(i => i.key === 'telehealth')).toBeUndefined();
  });

  test('the telehealth tile counts only today\'s scheduled/waiting-room sessions', () => {
    const items = computeClinicalOutstanding(baseOutstandingInput({
      hasTelehealth: true,
      today: '2026-08-04',
      telehealthSessions: [
        { scheduledDate: '2026-08-04', status: 'scheduled' },
        { scheduledDate: '2026-08-04', status: 'waiting_room' },
        { scheduledDate: '2026-08-04', status: 'completed' },
        { scheduledDate: '2026-08-03', status: 'scheduled' },
         
      ] as any,
    }));
    expect(items.find(i => i.key === 'telehealth')!.count).toBe(2);
  });
});

describe('computeClinicalLanes — matches the desktop three-lane vocabulary', () => {
  test('splits today\'s appointments into Scheduled / In Office / Finished', () => {
    const lanes = computeClinicalLanes([
      makeAppointment({ _id: 'a1', appointmentDate: '2026-08-04', status: 'scheduled' }),
      makeAppointment({ _id: 'a2', appointmentDate: '2026-08-04', status: 'checked_in' }),
      makeAppointment({ _id: 'a3', appointmentDate: '2026-08-04', status: 'completed' }),
      makeAppointment({ _id: 'a4', appointmentDate: '2026-08-04', status: 'cancelled' }),
      makeAppointment({ _id: 'a5', appointmentDate: '2026-08-05', status: 'scheduled' }), // different day
    ], '2026-08-04');

    const scheduled = lanes.find(l => l.key === 'scheduled')!;
    const inOffice = lanes.find(l => l.key === 'in_office')!;
    const finished = lanes.find(l => l.key === 'finished')!;

    expect(scheduled.items.map((a) => a._id)).toEqual(['a1']);
    expect(inOffice.items.map((a) => a._id)).toEqual(['a2']);
    // completed AND cancelled both land in Finished — a checked-out or
    // cancelled visit must not vanish from every lane.
    expect(finished.items.map((a) => a._id).sort()).toEqual(['a3', 'a4']);
    expect(scheduled.label).toBe('1 Scheduled');
    expect(inOffice.label).toBe('1 In Office');
    expect(finished.label).toBe('2 Finished');
  });

  test('a status change moves an appointment from one lane to another', () => {
    const scheduledLanes = computeClinicalLanes(
      [makeAppointment({ _id: 'moving', appointmentDate: '2026-08-04', status: 'scheduled' })],
      '2026-08-04',
    );
    expect(scheduledLanes.find(l => l.key === 'scheduled')!.items).toHaveLength(1);
    expect(scheduledLanes.find(l => l.key === 'finished')!.items).toHaveLength(0);

    const completedLanes = computeClinicalLanes(
      [makeAppointment({ _id: 'moving', appointmentDate: '2026-08-04', status: 'completed' })],
      '2026-08-04',
    );
    expect(completedLanes.find(l => l.key === 'scheduled')!.items).toHaveLength(0);
    expect(completedLanes.find(l => l.key === 'finished')!.items).toHaveLength(1);
  });
});
