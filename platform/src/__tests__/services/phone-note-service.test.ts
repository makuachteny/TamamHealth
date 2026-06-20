/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for phone-note-service.ts (P1.4 phone notes / callback workflow).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-phonenote-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createPhoneNote,
  respondToPhoneNote,
  closePhoneNote,
  getPhoneNotesByPatient,
  getOpenPhoneNotesForUser,
} from '@/lib/services/phone-note-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

function validInput(overrides = {}) {
  return {
    patientId: 'patient-001',
    patientName: 'Ayen Deng',
    callerName: 'Ayen Deng',
    callerPhone: '0900000000',
    subject: 'Medication question',
    message: 'Can I take the malaria tablets with food?',
    routedToId: 'u-dr-wani',
    routedToName: 'Dr. Wani',
    recordedById: 'u-desk-amira',
    recordedByName: 'Amira (Front Desk)',
    hospitalId: 'hosp-001',
    ...overrides,
  };
}

describe('Phone note service (P1.4)', () => {
  test('creates an open phone note routed to a provider', async () => {
    const note = await createPhoneNote(validInput());
    expect(note._id).toMatch(/^phnote-/);
    expect(note.status).toBe('open');
    expect(note.routedToName).toBe('Dr. Wani');
    expect(note.subject).toBe('Medication question');
  });

  test('requires subject and message', async () => {
    await expect(createPhoneNote(validInput({ subject: '  ' }))).rejects.toThrow();
    await expect(createPhoneNote(validInput({ message: '' }))).rejects.toThrow();
  });

  test('lists notes by patient newest-first', async () => {
    await createPhoneNote(validInput({ subject: 'First' }));
    await createPhoneNote(validInput({ subject: 'Second' }));
    const notes = await getPhoneNotesByPatient('patient-001');
    expect(notes).toHaveLength(2);
  });

  test('open notes for a user surface only their open ones', async () => {
    await createPhoneNote(validInput({ routedToId: 'u-dr-wani' }));
    await createPhoneNote(validInput({ routedToId: 'u-dr-achol' }));
    const wani = await getOpenPhoneNotesForUser('u-dr-wani');
    expect(wani).toHaveLength(1);
    expect(wani[0].routedToId).toBe('u-dr-wani');
  });

  test('provider response marks the note responded and records the responder', async () => {
    const note = await createPhoneNote(validInput());
    const responded = await respondToPhoneNote(note._id, 'Yes, take with food.', { userId: 'u-dr-wani', userName: 'Dr. Wani', userRole: 'doctor' });
    expect(responded!.status).toBe('responded');
    expect(responded!.response).toBe('Yes, take with food.');
    expect(responded!.respondedByName).toBe('Dr. Wani');
    expect(responded!.respondedAt).toBeDefined();
    // No longer in the open worklist.
    expect(await getOpenPhoneNotesForUser('u-dr-wani')).toHaveLength(0);
  });

  test('response requires text', async () => {
    const note = await createPhoneNote(validInput());
    await expect(respondToPhoneNote(note._id, '  ', { userName: 'Dr. Wani' })).rejects.toThrow();
  });

  test('responding to a nonexistent note returns null', async () => {
    expect(await respondToPhoneNote('nope', 'x', { userName: 'Dr. Wani', userRole: 'doctor' })).toBeNull();
  });

  test('a non-clinical role may not respond', async () => {
    const note = await createPhoneNote(validInput());
    await expect(
      respondToPhoneNote(note._id, 'ok', { userId: 'u-desk', userName: 'Front Desk', userRole: 'front_desk' }),
    ).rejects.toThrow(/may not respond/);
  });

  test('a clinical officer may respond (primary clinician role)', async () => {
    const note = await createPhoneNote(validInput());
    const responded = await respondToPhoneNote(note._id, 'Take with food.', { userId: 'u-co', userName: 'CO Deng', userRole: 'clinical_officer' });
    expect(responded!.status).toBe('responded');
  });

  test('closing a note sets status closed', async () => {
    const note = await createPhoneNote(validInput());
    const closed = await closePhoneNote(note._id);
    expect(closed!.status).toBe('closed');
    expect(await getOpenPhoneNotesForUser('u-dr-wani')).toHaveLength(0);
  });
});
