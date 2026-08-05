/**
 * useCreateNote — starting a note from wherever the clinician already is
 * (an appointment, a chart, a queue row).
 *
 * The hook itself is a thin `useCallback`/`useState`/`router.push` wrapper
 * with no branching logic of its own; everything that decides WHAT gets
 * created or reopened lives in three pure, exported helpers
 * (`findReusableDraft`, `resolveNoteTypeForCreate`, `buildCreateNoteInput`),
 * so those are what get exercised here.
 *
 * This project has no hook-rendering test infrastructure (no
 * `@testing-library/react`, no existing `renderHook` usage anywhere in the
 * suite), so the hook's React wiring (state toggling, router.push, the
 * `navigate` option) is not covered by this file — see the note-service and
 * note-catalog tests for the same "extract the logic, test the function"
 * pattern already established in this codebase (`noteTypeMenuOrder`).
 */
import {
  findReusableDraft, resolveNoteTypeForCreate, buildCreateNoteInput,
  type CreateNoteFromVisitInput, type CurrentUserLike,
} from '@/lib/clinical-notes/useCreateNote';
import { getNoteType } from '@/lib/clinical-notes/note-catalog';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';

function draftNote(over: Partial<ClinicalNoteDoc> = {}): ClinicalNoteDoc {
  return {
    _id: 'note-1', type: 'clinical_note', patientId: 'pat-1', patientName: 'Deng Mabior',
    noteType: 'soap', sections: [], serviceDate: '2026-08-04', status: 'draft',
    createdAt: '2026-08-04T08:00:00Z', updatedAt: '2026-08-04T08:00:00Z',
    ...over,
  } as ClinicalNoteDoc;
}

describe('findReusableDraft', () => {
  test('finds the draft tied to the same appointment', () => {
    const a = draftNote({ _id: 'note-a', appointmentId: 'appt-1', status: 'draft' });
    const b = draftNote({ _id: 'note-b', appointmentId: 'appt-2', status: 'draft' });
    expect(findReusableDraft([a, b], 'appt-1')).toBe(a);
  });

  test('does not reopen a SIGNED note against the same appointment — that would edit a locked record', () => {
    const signed = draftNote({ _id: 'note-a', appointmentId: 'appt-1', status: 'signed' });
    expect(findReusableDraft([signed], 'appt-1')).toBeUndefined();
  });

  test('returns undefined when nothing matches the appointment', () => {
    const other = draftNote({ appointmentId: 'appt-2', status: 'draft' });
    expect(findReusableDraft([other], 'appt-1')).toBeUndefined();
  });

  test('returns undefined when no appointmentId was given at all — never reopens by accident', () => {
    const any = draftNote({ appointmentId: 'appt-1', status: 'draft' });
    expect(findReusableDraft([any], undefined)).toBeUndefined();
  });

  test('returns undefined against an empty note list', () => {
    expect(findReusableDraft([], 'appt-1')).toBeUndefined();
  });
});

describe('resolveNoteTypeForCreate', () => {
  test('an explicit noteType always wins, even for a telehealth visit', () => {
    expect(resolveNoteTypeForCreate({ noteType: 'phone', telehealth: true })).toBe('phone');
  });

  test('falls back to telehealth_soap for a telehealth visit with no explicit type', () => {
    expect(resolveNoteTypeForCreate({ telehealth: true })).toBe('telehealth_soap');
  });

  test('falls back to plain soap otherwise', () => {
    expect(resolveNoteTypeForCreate({})).toBe('soap');
    expect(resolveNoteTypeForCreate({ telehealth: false })).toBe('soap');
  });
});

describe('buildCreateNoteInput', () => {
  const now = new Date('2026-08-04T09:15:00Z');
  const baseVisit: CreateNoteFromVisitInput = {
    patientId: 'pat-1',
    patientName: 'Deng Mabior',
    mrn: 'JTH-000001',
  };
  const user: CurrentUserLike = {
    _id: 'u-doc', name: 'Dr Achol', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: 'org-1',
  };

  test('carries the patient identity straight through', () => {
    const payload = buildCreateNoteInput(baseVisit, user, now);
    expect(payload.patientId).toBe('pat-1');
    expect(payload.patientName).toBe('Deng Mabior');
    expect(payload.mrn).toBe('JTH-000001');
  });

  test('defaults serviceDate/serviceTime from `now` when the visit does not specify them', () => {
    const payload = buildCreateNoteInput(baseVisit, user, now);
    expect(payload.serviceDate).toBe(now.toISOString().slice(0, 10));
    expect(payload.serviceTime).toBe(now.toTimeString().slice(0, 5));
  });

  test('an explicit serviceDate/serviceTime on the visit is not overridden', () => {
    const payload = buildCreateNoteInput(
      { ...baseVisit, serviceDate: '2026-01-01', serviceTime: '07:00' }, user, now,
    );
    expect(payload.serviceDate).toBe('2026-01-01');
    expect(payload.serviceTime).toBe('07:00');
  });

  test('the current user becomes both author and the default assignee', () => {
    const payload = buildCreateNoteInput(baseVisit, user, now);
    expect(payload.authorId).toBe('u-doc');
    expect(payload.authorName).toBe('Dr Achol');
    expect(payload.assignedToId).toBe('u-doc');
    expect(payload.assignedToName).toBe('Dr Achol');
  });

  test('an explicit assignee on the visit overrides the current user default — the author stays the current user', () => {
    const payload = buildCreateNoteInput(
      { ...baseVisit, assignedToId: 'u-covering', assignedToName: 'Dr Covering' }, user, now,
    );
    expect(payload.assignedToId).toBe('u-covering');
    expect(payload.assignedToName).toBe('Dr Covering');
    expect(payload.authorId).toBe('u-doc');
  });

  test('falls back to username when the user has no display name', () => {
    const payload = buildCreateNoteInput(baseVisit, { _id: 'u-1', username: 'dachol' }, now);
    expect(payload.authorName).toBe('dachol');
    expect(payload.assignedToName).toBe('dachol');
  });

  test('carries the acting user\'s facility and org onto the note', () => {
    const payload = buildCreateNoteInput(baseVisit, user, now);
    expect(payload.hospitalId).toBe('hosp-001');
    expect(payload.hospitalName).toBe('Juba Teaching Hospital');
    expect(payload.orgId).toBe('org-1');
  });

  test('with no current user, author/assignee/org fields are simply absent — never a crash', () => {
    const payload = buildCreateNoteInput(baseVisit, null, now);
    expect(payload.authorId).toBeUndefined();
    expect(payload.assignedToId).toBeUndefined();
    expect(payload.orgId).toBeUndefined();
  });

  test('telehealth is inferred from the resolved note type when the visit does not say', () => {
    const payload = buildCreateNoteInput({ ...baseVisit, telehealth: true }, user, now);
    expect(payload.noteType).toBe('telehealth_soap');
    expect(payload.telehealth).toBe(true);
    expect(payload.telehealth).toBe(getNoteType('telehealth_soap').telehealth);
  });

  test('an explicit telehealth flag on the visit is not overridden by the resolved type', () => {
    // Type picked explicitly as plain SOAP, but the visit itself is marked
    // telehealth (e.g. a video appointment) — the flag should still carry.
    const payload = buildCreateNoteInput({ ...baseVisit, noteType: 'soap', telehealth: true }, user, now);
    expect(payload.noteType).toBe('soap');
    expect(payload.telehealth).toBe(true);
  });

  test('threads appointmentId and encounterId through unchanged', () => {
    const payload = buildCreateNoteInput(
      { ...baseVisit, appointmentId: 'appt-1', encounterId: 'enc-1' }, user, now,
    );
    expect(payload.appointmentId).toBe('appt-1');
    expect(payload.encounterId).toBe('enc-1');
  });
});
