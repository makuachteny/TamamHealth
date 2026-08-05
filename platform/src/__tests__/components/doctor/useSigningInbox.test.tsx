/**
 * lib/hooks/useSigningInbox.ts — the clinician's "documents to sign" inbox.
 *
 * Renders the REAL hook (not a reimplementation) with react-dom/client + act,
 * the same technique src/__tests__/context-slices.test.tsx uses instead of
 * @testing-library/react — that package is present in node_modules but not
 * in package-lock.json, so `npm ci` would not install it.
 *
 * The three backing service calls (getSigningInbox / getHeldAssessments /
 * getUnsignedNotes) are mocked directly — they're each already covered at
 * the service layer elsewhere (e.g. medical-record-service.test.ts's
 * "Signing inbox (P1.1 query)" suite) — so this test is scoped to what the
 * HOOK itself is responsible for: aggregating the three results (including
 * `unsignedNotes`, the field that was reported fixed once while no consumer
 * actually read it) and reacting to live DB changes.
 */
import React, { act, createContext, useContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// React 19 wants this flag set for act() outside a test renderer.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/lib/db', () => require('../../helpers/test-db').createDBMock());

const mockCurrentUser = { _id: 'doctor-1', name: 'Dr. Deng Mabior', orgId: 'org-001', hospitalId: 'hosp-001', role: 'doctor' };
jest.mock('@/lib/context', () => ({
  useApp: () => ({ currentUser: mockCurrentUser }),
}));

let signingInboxImpl: () => Promise<{ unsignedDrafts: unknown[]; awaitingCosign: unknown[] }> =
  async () => ({ unsignedDrafts: [], awaitingCosign: [] });
let heldAssessmentsImpl: () => Promise<unknown[]> = async () => [];
let unsignedNotesImpl: () => Promise<unknown[]> = async () => [];

jest.mock('@/lib/services/medical-record-service', () => ({
  getSigningInbox: (...args: unknown[]) => signingInboxImpl(),
}));
jest.mock('@/lib/services/assessment-service', () => ({
  getHeldAssessments: (...args: unknown[]) => heldAssessmentsImpl(),
}));
jest.mock('@/lib/clinical-notes/note-service', () => ({
  getUnsignedNotes: (...args: unknown[]) => unsignedNotesImpl(),
}));

import { useSigningInbox, type SigningInboxState } from '@/lib/hooks/useSigningInbox';
import { getDB } from '@/lib/db';
import { teardownTestDBs } from '../../helpers/test-db';

const StateContext = createContext<SigningInboxState | null>(null);

function Harness({ children }: { children?: React.ReactNode }) {
  const state = useSigningInbox();
  return <StateContext.Provider value={state}>{children}</StateContext.Provider>;
}

let container: HTMLDivElement;
let root: Root;
let captured: SigningInboxState | undefined;

function Capture() {
  captured = useContext(StateContext) ?? undefined;
  return null;
}

async function flush(times = 6) {
  for (let i = 0; i < times; i++) {
     
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  captured = undefined;
  signingInboxImpl = async () => ({ unsignedDrafts: [], awaitingCosign: [] });
  heldAssessmentsImpl = async () => [];
  unsignedNotesImpl = async () => [];
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  await teardownTestDBs();
});

describe('useSigningInbox', () => {
  test('aggregates unsignedNotes alongside drafts/cosign/held into the returned state', async () => {
    signingInboxImpl = async () => ({
      unsignedDrafts: [{ _id: 'draft-1', patientId: 'p-1' }],
      awaitingCosign: [{ _id: 'cosign-1', patientId: 'p-2' }],
    });
    heldAssessmentsImpl = async () => [{ _id: 'held-1', patientId: 'p-3' }];
    unsignedNotesImpl = async () => [{ _id: 'note-1', patientId: 'p-4', patientName: 'Note Patient', noteType: 'soap' }];

    await act(async () => {
      root.render(
        <Harness>
          <Capture />
        </Harness>,
      );
    });
    await flush();

    expect(captured?.unsignedDrafts).toHaveLength(1);
    expect(captured?.awaitingCosign).toHaveLength(1);
    expect(captured?.heldAssessments).toHaveLength(1);
    expect(captured?.unsignedNotes).toHaveLength(1);
    expect(captured?.unsignedNotes[0]._id).toBe('note-1');
    expect(captured?.loading).toBe(false);
  });

  test('starts loading and settles to loading:false with empty arrays when nothing is outstanding', async () => {
    await act(async () => {
      root.render(
        <Harness>
          <Capture />
        </Harness>,
      );
    });
    await flush();

    expect(captured?.loading).toBe(false);
    expect(captured?.unsignedDrafts).toEqual([]);
    expect(captured?.awaitingCosign).toEqual([]);
    expect(captured?.heldAssessments).toEqual([]);
    expect(captured?.unsignedNotes).toEqual([]);
  });

  test('a live change on the clinical notes DB triggers a reload that picks up a newly-created unsigned note', async () => {
    let notesCallCount = 0;
    unsignedNotesImpl = async () => {
      notesCallCount += 1;
      if (notesCallCount === 1) return [];
      return [{ _id: 'note-late', patientId: 'p-9', patientName: 'Late Note', noteType: 'soap' }];
    };

    await act(async () => {
      root.render(
        <Harness>
          <Capture />
        </Harness>,
      );
    });
    await flush();
    expect(captured?.unsignedNotes).toEqual([]);
    expect(notesCallCount).toBe(1);

    // Simulate a note being created elsewhere — the hook subscribes to this
    // exact DB (getDB('tamamhealth_clinical_notes')) via .changes({live:true}).
    await act(async () => {
      await getDB('tamamhealth_clinical_notes').put({ _id: 'note-late', type: 'clinical_note' });
    });
    await flush();

    expect(notesCallCount).toBeGreaterThan(1);
    expect(captured?.unsignedNotes.map((n) => n._id)).toContain('note-late');
  });

  test('reload() re-fetches on demand', async () => {
    await act(async () => {
      root.render(
        <Harness>
          <Capture />
        </Harness>,
      );
    });
    await flush();
    expect(captured?.unsignedNotes).toEqual([]);

    unsignedNotesImpl = async () => [{ _id: 'note-manual', patientId: 'p-1', patientName: 'Manual', noteType: 'soap' }];
    await act(async () => {
      captured?.reload();
    });
    await flush();

    expect(captured?.unsignedNotes.map((n) => n._id)).toContain('note-manual');
  });
});
