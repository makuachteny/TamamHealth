import { deriveConsultationProgress } from '@/lib/clinical-flow/consultation-progress-derive';

const DAY = '2026-07-27';
const P = 'pat-1';

describe('deriveConsultationProgress', () => {
  it('reports nothing done for a patient with no records', () => {
    const out = deriveConsultationProgress({ patientId: P, dayKey: DAY });
    expect(out.doneCount).toBe(0);
    expect(out.notStarted).toBe(true);
    expect(out.steps.every(s => s.state === 'pending')).toBe(true);
    // Every pending step explains what would satisfy it.
    expect(out.steps.every(s => Boolean(s.hint))).toBe(true);
  });

  it('marks check-in done and carries the clerk who did it', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      appointments: [{ patientId: P, checkedInAt: `${DAY}T08:15:00Z`, checkedInByName: 'Rita Achol' }],
    });
    const step = out.steps.find(s => s.key === 'checked_in')!;
    expect(step.state).toBe('done');
    expect(step.actor).toBe('Rita Achol');
    expect(out.doneCount).toBe(1);
  });

  it('marks triage done with the nurse who recorded it', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      triages: [{ patientId: P, triagedAt: `${DAY}T08:40:00Z`, triagedByName: 'Nurse Grace' }],
    });
    const step = out.steps.find(s => s.key === 'triaged')!;
    expect(step.state).toBe('done');
    expect(step.actor).toBe('Nurse Grace');
  });

  it('only counts a signed note as signed — a draft does not close the visit', () => {
    const draft = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      records: [{ patientId: P, documentStatus: 'draft', diagnosis: 'Malaria', doctorName: 'Dr Peter', createdAt: `${DAY}T09:10:00Z` }],
    });
    expect(draft.steps.find(s => s.key === 'signed')!.state).toBe('pending');
    expect(draft.steps.find(s => s.key === 'diagnosis')!.state).toBe('done');

    const signed = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      records: [{ patientId: P, documentStatus: 'signed', signedByName: 'Dr Peter', signedAt: `${DAY}T09:30:00Z`, createdAt: `${DAY}T09:10:00Z` }],
    });
    const step = signed.steps.find(s => s.key === 'signed')!;
    expect(step.state).toBe('done');
    expect(step.actor).toBe('Dr Peter');
  });

  it('tells the reader when a note is stuck awaiting co-signature', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      records: [{ patientId: P, documentStatus: 'awaiting_cosign', createdAt: `${DAY}T09:10:00Z` }],
    });
    expect(out.steps.find(s => s.key === 'signed')!.hint).toMatch(/co-signature/i);
  });

  it('does not attribute another patient\'s records to this patient', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      triages: [{ patientId: 'someone-else', triagedAt: `${DAY}T08:40:00Z`, triagedByName: 'Nurse Grace' }],
      records: [{ patientId: 'someone-else', documentStatus: 'signed', createdAt: `${DAY}T09:00:00Z` }],
    });
    expect(out.doneCount).toBe(0);
  });

  it('does not count yesterday\'s note as part of today\'s visit', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      records: [{ patientId: P, documentStatus: 'signed', signedByName: 'Dr Peter', createdAt: '2026-07-26T09:00:00Z' }],
    });
    expect(out.steps.find(s => s.key === 'signed')!.state).toBe('pending');
  });

  it('scopes by encounter when records carry one', () => {
    const shared = { patientId: P, documentStatus: 'signed' as const, createdAt: `${DAY}T09:00:00Z` };
    const matched = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'with_clinician' },
      records: [{ ...shared, encounterId: 'enc-1' }],
    });
    expect(matched.steps.find(s => s.key === 'signed')!.state).toBe('done');

    const other = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'with_clinician' },
      records: [{ ...shared, encounterId: 'enc-2' }],
    });
    expect(other.steps.find(s => s.key === 'signed')!.state).toBe('pending');
  });

  it('counts orders across prescriptions and labs', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      prescriptions: [{ patientId: P, createdAt: `${DAY}T09:20:00Z`, prescribedBy: 'Dr Peter' }],
      labResults: [{ patientId: P, createdAt: `${DAY}T09:25:00Z`, orderedByName: 'Dr Peter' }],
    });
    const step = out.steps.find(s => s.key === 'orders')!;
    expect(step.state).toBe('done');
    expect(step.label).toContain('(2)');
  });

  it('surfaces a non-linear outcome as an exception, never as a step', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'lwbs' },
    });
    expect(out.exception?.label).toBe('Left without being seen');
    // The exception must not be smuggled into the step list.
    expect(out.steps.some(s => /left without/i.test(s.label))).toBe(false);
    expect(out.steps).toHaveLength(7);
  });

  it('reports the authoritative encounter status as the current label', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'awaiting_labs' },
    });
    expect(out.currentLabel).toBe('Awaiting labs');
  });

  it('treats an encounter past rooming as "seen by clinician" even before a note exists', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'with_clinician', providerName: 'Dr Peter' },
    });
    const step = out.steps.find(s => s.key === 'seen')!;
    expect(step.state).toBe('done');
    expect(step.actor).toBe('Dr Peter');

    const waiting = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      encounter: { _id: 'enc-1', status: 'ready_for_clinician' },
    });
    expect(waiting.steps.find(s => s.key === 'seen')!.state).toBe('pending');
  });

  it('ignores standalone nursing vitals when looking for the consultation note', () => {
    const out = deriveConsultationProgress({
      patientId: P,
      dayKey: DAY,
      records: [{ patientId: P, recordKind: 'nursing_vitals', documentStatus: 'signed', createdAt: `${DAY}T08:50:00Z` }],
    });
    expect(out.steps.find(s => s.key === 'signed')!.state).toBe('pending');
  });
});

describe('deriveConsultationProgress — honesty guards', () => {
  it('does not claim a position when there is no open encounter', () => {
    const out = deriveConsultationProgress({
      patientId: 'pat-1',
      dayKey: '2026-07-27',
      triages: [{ patientId: 'pat-1', triagedAt: '2026-07-27T08:40:00Z', triagedByName: 'Nurse Stella' }],
    });
    // Steps are recorded, so it must not read "not started"...
    expect(out.doneCount).toBeGreaterThan(0);
    expect(out.notStarted).toBe(false);
    // ...and it must not invent a current stage either.
    expect(out.currentLabel).toBeUndefined();
  });

  it('leaves the actor unset rather than inventing one', () => {
    const out = deriveConsultationProgress({
      patientId: 'pat-1',
      dayKey: '2026-07-27',
      appointments: [{ patientId: 'pat-1', checkedInAt: '2026-07-27T08:15:00Z' }], // no checkedInByName
    });
    const step = out.steps.find(s => s.key === 'checked_in')!;
    expect(step.state).toBe('done');
    expect(step.actor).toBeUndefined();
  });
});
