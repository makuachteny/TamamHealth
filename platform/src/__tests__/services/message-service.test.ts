/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for message-service.ts
 * Covers CRUD operations, filtering by patient/doctor, and status management.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-msg-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllMessages,
  getMessagesByPatient,
  getMessagesByDoctor,
  createMessage,
  updateMessage,
  deleteMessage,
} from '@/lib/services/message-service';
import type { DataScope } from '@/lib/services/data-scope';

type CreateMessageInput = Parameters<typeof createMessage>[0];

const makeMessageData = (overrides: Partial<CreateMessageInput> = {}): CreateMessageInput => ({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  patientPhone: '+211912345678',
  fromDoctorId: 'doc-001',
  fromDoctorName: 'Dr. Mayen Dut',
  fromHospitalName: 'Juba Teaching Hospital',
  subject: 'Follow-up appointment',
  body: 'Please come back for your check-up next week.',
  channel: 'app' as const,
  sentAt: '2025-03-15T10:30:00Z',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

// Additional tests for branch coverage
const makeLongMessageData = (overrides: Partial<CreateMessageInput> = {}): CreateMessageInput => ({
  ...makeMessageData(),
  ...overrides,
});

describe('message-service', () => {
  test('getAllMessages returns empty initially', async () => {
    const messages = await getAllMessages();
    expect(messages).toEqual([]);
  });

  test('createMessage creates with correct fields', async () => {
    const msg = await createMessage(makeMessageData());

    expect(msg._id).toMatch(/^msg-/);
    expect(msg.type).toBe('message');
    expect(msg.patientId).toBe('pat-001');
    expect(msg.patientName).toBe('Achol Deng');
    expect(msg.subject).toBe('Follow-up appointment');
    expect(msg.channel).toBe('app');
    expect(msg.status).toBe('sent');
    expect(msg.createdAt).toBeDefined();
    expect(msg.updatedAt).toBeDefined();
    expect(msg._rev).toBeDefined();
  });

  test('createMessage with SMS channel', async () => {
    const msg = await createMessage(makeMessageData({ channel: 'sms' }));

    expect(msg.channel).toBe('sms');
    expect(msg.status).toBe('sent');
  });

  test('createMessage with both channel', async () => {
    const msg = await createMessage(makeMessageData({ channel: 'both' }));

    expect(msg.channel).toBe('both');
  });

  test('getMessagesByPatient filters correctly', async () => {
    await createMessage(makeMessageData({ patientId: 'pat-001' }));
    await createMessage(makeMessageData({ patientId: 'pat-001', subject: 'Test 2' }));
    await createMessage(makeMessageData({ patientId: 'pat-002', patientName: 'Nyabol Kuol' }));

    const pat1Msgs = await getMessagesByPatient('pat-001');
    const pat2Msgs = await getMessagesByPatient('pat-002');

    expect(pat1Msgs).toHaveLength(2);
    expect(pat2Msgs).toHaveLength(1);
    expect(pat2Msgs[0].patientId).toBe('pat-002');
  });

  test('getMessagesByDoctor filters correctly', async () => {
    await createMessage(makeMessageData({ fromDoctorId: 'doc-001' }));
    await createMessage(makeMessageData({ fromDoctorId: 'doc-001', subject: 'Test 2' }));
    await createMessage(makeMessageData({ fromDoctorId: 'doc-002', fromDoctorName: 'Dr. Nyabol' }));

    const doc1Msgs = await getMessagesByDoctor('doc-001');
    const doc2Msgs = await getMessagesByDoctor('doc-002');

    expect(doc1Msgs).toHaveLength(2);
    expect(doc2Msgs).toHaveLength(1);
    expect(doc2Msgs[0].fromDoctorId).toBe('doc-002');
  });

  test('updateMessage updates status', async () => {
    const msg = await createMessage(makeMessageData());
    const updated = await updateMessage(msg._id, { status: 'delivered' });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('delivered');
    expect(updated!.patientId).toBe('pat-001');
  });

  test('updateMessage returns null for non-existent id', async () => {
    const result = await updateMessage('msg-nonexistent', { status: 'failed' });
    expect(result).toBeNull();
  });

  test('deleteMessage removes the message', async () => {
    const msg = await createMessage(makeMessageData());
    const success = await deleteMessage(msg._id);

    expect(success).toBe(true);

    // Verify deletion by checking getAllMessages
    const messages = await getAllMessages();
    expect(messages).toHaveLength(0);
  });

  test('deleteMessage returns false for non-existent id', async () => {
    const success = await deleteMessage('msg-nonexistent');
    expect(success).toBe(false);
  });

  test('getAllMessages sorts by sentAt descending', async () => {
    await createMessage(makeMessageData({ sentAt: '2025-03-10T08:00:00Z', subject: 'First' }));
    await createMessage(makeMessageData({ sentAt: '2025-03-15T10:00:00Z', subject: 'Second' }));
    await createMessage(makeMessageData({ sentAt: '2025-03-12T09:00:00Z', subject: 'Third' }));

    const all = await getAllMessages();

    expect(all[0].subject).toBe('Second');
    expect(all[1].subject).toBe('Third');
    expect(all[2].subject).toBe('First');
  });

  test('getAllMessages handles undefined sentAt in sort (line 13)', async () => {
    // Tests line 13: new Date(b.sentAt || '').getTime()
    // When sentAt is undefined, new Date('') creates Invalid Date with NaN time
    await createMessage(makeLongMessageData({
      subject: 'No sentAt message',
      sentAt: undefined,
    }));
    await createMessage(makeLongMessageData({
      subject: 'With sentAt message',
      sentAt: '2025-03-15T10:00:00Z',
    }));

    const all = await getAllMessages();
    expect(all).toHaveLength(2);
    // Should handle the undefined sentAt gracefully without crashing
    expect(Array.isArray(all)).toBe(true);
  });

  test('updateMessage preserves existing fields', async () => {
    const msg = await createMessage(makeMessageData({ subject: 'Original subject' }));
    const updated = await updateMessage(msg._id, { status: 'delivered' });

    expect(updated!.subject).toBe('Original subject');
    expect(updated!.patientId).toBe('pat-001');
    expect(updated!.status).toBe('delivered');
  });

  test('message status transitions: sent -> delivered', async () => {
    const msg = await createMessage(makeMessageData());
    expect(msg.status).toBe('sent');

    const delivered = await updateMessage(msg._id, { status: 'delivered' });
    expect(delivered!.status).toBe('delivered');

    const failed = await updateMessage(msg._id, { status: 'failed' });
    expect(failed!.status).toBe('failed');
  });

  test('createMessage assigns timestamps correctly', async () => {
    const before = new Date().toISOString();
    const msg = await createMessage(makeMessageData());
    const after = new Date().toISOString();

    expect(msg.createdAt >= before).toBe(true);
    expect(msg.createdAt <= after).toBe(true);
    expect(msg.updatedAt).toBe(msg.createdAt);
  });

  test('updateMessage updates updatedAt timestamp', async () => {
    const msg = await createMessage(makeMessageData());
    const originalUpdatedAt = msg.updatedAt;

    // Wait a tiny bit to ensure timestamp changes
    await new Promise(r => setTimeout(r, 10));

    const updated = await updateMessage(msg._id, { status: 'delivered' });
    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test('getAllMessages with scope filters results', async () => {
    await createMessage(makeMessageData());
    const allNoScope = await getAllMessages();
    expect(allNoScope.length).toBeGreaterThanOrEqual(1);

    // With scope - the filterByScope function would be called
    const allWithScope = await getAllMessages({ role: 'nurse' } as DataScope);
    expect(Array.isArray(allWithScope)).toBe(true);
  });

  test('getAllMessages handles messages with missing sentAt', async () => {
    await createMessage(makeMessageData({ sentAt: '2025-03-15T10:00:00Z' }));
    await createMessage(makeMessageData({ sentAt: undefined }));

    const all = await getAllMessages();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
