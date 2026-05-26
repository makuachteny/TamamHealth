/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end tests for the patient ↔ staff messaging flow.
 *
 * Covers the round-trip the patient-portal Chat tab and the staff Messages
 * inbox rely on: a patient writes a message via `createMessage` with
 * `direction: 'patient_to_staff'`; the facility-side helper picks it up;
 * a staff member replies; both messages then appear in the patient's
 * conversation history (newest-first) when fetched by patient id.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-msg-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createMessage,
  getMessagesByPatient,
  getMessagesForFacility,
  getInboundPatientMessages,
} from '@/lib/services/message-service';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('patient ↔ staff messaging flow', () => {
  test('patient_to_staff messages surface to the receiving facility', async () => {
    const saved = await createMessage({
      direction: 'patient_to_staff',
      recipientType: 'staff',
      patientId: 'pat-100',
      patientName: 'Akol Deng',
      patientPhone: '+211912000100',
      recipientDepartment: 'General / OPD',
      recipientHospitalId: 'hosp-001',
      recipientHospitalName: 'Juba Teaching Hospital',
      fromDoctorId: 'patient',
      fromDoctorName: 'Akol Deng',
      fromHospitalId: 'hosp-001',
      fromHospitalName: 'Juba Teaching Hospital',
      subject: 'Patient message — General / OPD',
      body: 'I have been coughing for three days.',
      channel: 'app',
      sentAt: '2026-05-09T10:00:00Z',
    });

    expect(saved.direction).toBe('patient_to_staff');
    expect(saved.fromDoctorId).toBe('patient');

    // Facility-side query — messages targeting hosp-001 must include this one.
    const facilityInbox = await getMessagesForFacility('hosp-001');
    expect(facilityInbox).toHaveLength(1);
    expect(facilityInbox[0]._id).toBe(saved._id);
    expect(facilityInbox[0].direction).toBe('patient_to_staff');

    // Helper that lists only inbound (patient-originated) messages.
    const inbound = await getInboundPatientMessages();
    expect(inbound).toHaveLength(1);
    expect(inbound[0].patientId).toBe('pat-100');
  });

  test('staff reply round-trips back to the patient conversation', async () => {
    // 1. Patient writes a message.
    await createMessage({
      direction: 'patient_to_staff',
      recipientType: 'staff',
      patientId: 'pat-200',
      patientName: 'Nyabol Kuol',
      patientPhone: '+211912000200',
      recipientDepartment: 'General / OPD',
      recipientHospitalId: 'hosp-001',
      recipientHospitalName: 'Juba Teaching Hospital',
      fromDoctorId: 'patient',
      fromDoctorName: 'Nyabol Kuol',
      fromHospitalId: 'hosp-001',
      fromHospitalName: 'Juba Teaching Hospital',
      subject: 'Patient message — General / OPD',
      body: 'Can I bring my prescription tomorrow?',
      channel: 'app',
      sentAt: '2026-05-09T10:00:00Z',
    });

    // 2. Staff replies.
    await createMessage({
      direction: 'staff_to_patient',
      recipientType: 'patient',
      patientId: 'pat-200',
      patientName: 'Nyabol Kuol',
      patientPhone: '+211912000200',
      fromDoctorId: 'doc-001',
      fromDoctorName: 'Dr. Mayen Dut',
      fromHospitalId: 'hosp-001',
      fromHospitalName: 'Juba Teaching Hospital',
      subject: 'Re: Patient message — General / OPD',
      body: 'Yes, please come at 09:00 tomorrow.',
      channel: 'app',
      sentAt: '2026-05-09T11:00:00Z',
    });

    // 3. The patient-portal Chat tab fetches all messages on this patient
    //    via `getMessagesByPatient` and renders them ordered by sentAt.
    //    The service already returns newest-first.
    const conversation = await getMessagesByPatient('pat-200');
    expect(conversation).toHaveLength(2);
    expect(conversation[0].direction).toBe('staff_to_patient');
    expect(conversation[0].body).toContain('please come at 09:00');
    expect(conversation[1].direction).toBe('patient_to_staff');
    expect(conversation[1].body).toContain('prescription tomorrow');
  });

  test('legacy messages without direction default to staff_to_patient semantics', async () => {
    // A pre-existing message saved before the direction field was added.
    await createMessage({
      patientId: 'pat-300',
      patientName: 'Achol Dut',
      patientPhone: '+211912000300',
      fromDoctorId: 'doc-002',
      fromDoctorName: 'Dr. Wani James',
      fromHospitalName: 'Juba Teaching Hospital',
      subject: 'Lab result',
      body: 'Your lab results are ready.',
      channel: 'app',
      sentAt: '2025-12-01T08:00:00Z',
    });

    // Helper must not include legacy staff-authored docs as inbound.
    const inbound = await getInboundPatientMessages();
    expect(inbound).toHaveLength(0);

    // But the conversation history for the patient still includes it.
    const history = await getMessagesByPatient('pat-300');
    expect(history).toHaveLength(1);
    expect(history[0].direction).toBeUndefined();
  });

  test('legacy patient-marker messages (fromDoctorId === "patient") still register as inbound', async () => {
    // Documents written before the `direction` field existed used the
    // `fromDoctorId === 'patient'` marker. The inbound helper must still
    // pick them up so we don't lose visibility on historical chats.
    await createMessage({
      patientId: 'pat-400',
      patientName: 'Garang Makuei',
      patientPhone: '+211912000400',
      fromDoctorId: 'patient',
      fromDoctorName: 'Garang Makuei',
      fromHospitalName: 'Juba Teaching Hospital',
      subject: 'Follow up question',
      body: 'I forgot to ask about my dosage.',
      channel: 'app',
      sentAt: '2025-11-01T08:00:00Z',
    });

    const inbound = await getInboundPatientMessages();
    expect(inbound).toHaveLength(1);
    expect(inbound[0].patientId).toBe('pat-400');
  });

  test('getMessagesForFacility scopes by either recipient or sender hospital', async () => {
    // Patient at hosp-001 sends a message; another patient at hosp-002
    // sends a message; staff at hosp-001 sends to a patient. hosp-001
    // inbox should see exactly two of these (its inbound + outbound).
    await createMessage({
      direction: 'patient_to_staff',
      recipientType: 'staff',
      patientId: 'pat-500',
      patientName: 'Akol Deng',
      patientPhone: '',
      recipientHospitalId: 'hosp-001',
      fromDoctorId: 'patient',
      fromDoctorName: 'Akol Deng',
      fromHospitalId: 'hosp-001',
      fromHospitalName: 'Juba',
      subject: 'Q1', body: 'Hello',
      channel: 'app', sentAt: '2026-05-09T10:00:00Z',
    });
    await createMessage({
      direction: 'patient_to_staff',
      recipientType: 'staff',
      patientId: 'pat-501',
      patientName: 'Other Patient',
      patientPhone: '',
      recipientHospitalId: 'hosp-002',
      fromDoctorId: 'patient',
      fromDoctorName: 'Other Patient',
      fromHospitalId: 'hosp-002',
      fromHospitalName: 'Wau',
      subject: 'Q2', body: 'Hi',
      channel: 'app', sentAt: '2026-05-09T10:05:00Z',
    });
    await createMessage({
      direction: 'staff_to_patient',
      recipientType: 'patient',
      patientId: 'pat-500',
      patientName: 'Akol Deng',
      patientPhone: '',
      fromDoctorId: 'doc-001',
      fromDoctorName: 'Dr. Mayen Dut',
      fromHospitalId: 'hosp-001',
      fromHospitalName: 'Juba',
      subject: 'Re: Q1', body: 'Reply',
      channel: 'app', sentAt: '2026-05-09T10:10:00Z',
    });

    const jubaInbox = await getMessagesForFacility('hosp-001');
    expect(jubaInbox).toHaveLength(2);
    const wauInbox = await getMessagesForFacility('hosp-002');
    expect(wauInbox).toHaveLength(1);
  });
});
