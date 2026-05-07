/**
 * In-app database test runner.
 *
 * Exercises every database function to validate correctness.
 * Call runAllTests() from a useEffect or button handler.
 * Remove this file before shipping to production.
 */

import {
  getDatabase,
  getMedicalRecords,
  getLabResults,
  getPrescriptions,
  getAppointments,
  getImmunizations,
  getMessages,
  getBilling,
  insertAppointment,
  insertPayment,
  insertMessage,
  getPendingSyncItems,
  getSyncQueueCount,
  markSyncItemDone,
  markSyncItemFailed,
  markRecordSynced,
  getLastSyncTime,
  setLastSyncTime,
  upsertMedicalRecords,
  upsertLabResults,
  upsertPrescriptions,
  upsertAppointments,
  upsertImmunizations,
  upsertMessages,
  upsertPayments,
  upsertCharges,
} from './database';

type TestResult = { name: string; pass: boolean; error?: string };

async function test(name: string, fn: () => Promise<void>): Promise<TestResult> {
  try {
    await fn();
    return { name, pass: true };
  } catch (err: any) {
    return { name, pass: false, error: err.message ?? String(err) };
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

export async function runAllTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  // ── READ tests ──────────────────────────────────────────────
  results.push(await test('getMedicalRecords returns seed data', async () => {
    const records = await getMedicalRecords();
    assert(records.length === 3, `expected 3 records, got ${records.length}`);
    assert(records[0]._id !== undefined, 'record._id is undefined');
    assert(records[0].patientId === 'pat-00001', `wrong patientId: ${records[0].patientId}`);
    assert(Array.isArray(records[0].diagnoses), 'diagnoses not array');
    assert(records[0].diagnoses.length > 0, 'diagnoses empty');
  }));

  results.push(await test('getLabResults returns seed data', async () => {
    const labs = await getLabResults();
    assert(labs.length === 4, `expected 4 labs, got ${labs.length}`);
    assert(labs.some(l => l.abnormal === true), 'no abnormal labs');
    assert(labs.some(l => l.status === 'pending'), 'no pending labs');
    assert(labs.some(l => l.status === 'completed'), 'no completed labs');
  }));

  results.push(await test('getPrescriptions returns seed data', async () => {
    const rx = await getPrescriptions();
    assert(rx.length === 3, `expected 3 prescriptions, got ${rx.length}`);
    assert(rx.some(r => r.status === 'dispensed'), 'no dispensed rx');
    assert(rx.some(r => r.status === 'pending'), 'no pending rx');
  }));

  results.push(await test('getAppointments returns seed data', async () => {
    const apts = await getAppointments();
    assert(apts.length === 3, `expected 3 appointments, got ${apts.length}`);
    assert(apts.some(a => a.status === 'scheduled'), 'no scheduled');
    assert(apts.some(a => a.status === 'completed'), 'no completed');
  }));

  results.push(await test('getImmunizations returns seed data', async () => {
    const imms = await getImmunizations();
    assert(imms.length === 4, `expected 4 immunizations, got ${imms.length}`);
    assert(imms.every(i => i.status === 'completed'), 'not all completed');
  }));

  results.push(await test('getMessages returns seed data', async () => {
    const msgs = await getMessages();
    assert(msgs.length === 2, `expected 2 messages, got ${msgs.length}`);
    assert(msgs[0].body.length > 10, 'message body too short');
  }));

  results.push(await test('getBilling returns correct totals', async () => {
    const billing = await getBilling();
    assert(billing.payments.length === 2, `expected 2 payments, got ${billing.payments.length}`);
    assert(billing.charges.length === 6, `expected 6 charges, got ${billing.charges.length}`);
    assert(billing.summary.totalBilled === 17500, `totalBilled ${billing.summary.totalBilled} !== 17500`);
    assert(billing.summary.totalPaid === 8500, `totalPaid ${billing.summary.totalPaid} !== 8500`);
    assert(billing.balance === 9000, `balance ${billing.balance} !== 9000`);
  }));

  // ── WRITE tests ─────────────────────────────────────────────
  results.push(await test('insertAppointment persists and appears in getAppointments', async () => {
    const apt = {
      _id: `test-apt-${Date.now()}`,
      patientId: 'pat-00001',
      appointmentDate: '2026-06-01',
      appointmentTime: '10:00',
      appointmentType: 'Follow-up',
      reason: 'DB test',
      status: 'scheduled',
      providerName: 'Test Doctor',
      facilityName: 'Test Facility',
      department: 'Test Dept',
      duration: 15,
    };
    await insertAppointment(apt);
    const all = await getAppointments();
    const found = all.find(a => a._id === apt._id);
    assert(found !== undefined, 'inserted appointment not found in getAppointments');
    assert(found!.reason === 'DB test', `wrong reason: ${found!.reason}`);
  }));

  results.push(await test('insertPayment persists and appears in getBilling', async () => {
    const pay = {
      _id: `test-pay-${Date.now()}`,
      amount: 1000,
      method: 'Cash',
      status: 'posted',
      processedAt: new Date().toISOString(),
      reference: 'TEST-REF',
    };
    await insertPayment(pay);
    const billing = await getBilling();
    const found = billing.payments.find(p => p._id === pay._id);
    assert(found !== undefined, 'inserted payment not found in getBilling');
    assert(found!.amount === 1000, `wrong amount: ${found!.amount}`);
  }));

  results.push(await test('insertMessage persists and appears in getMessages', async () => {
    const msg = {
      _id: `test-msg-${Date.now()}`,
      patientId: 'pat-00001',
      fromDoctorName: 'Test Doctor',
      fromHospitalName: 'Test Hospital',
      subject: 'DB test message',
      body: 'This is a test message for database validation.',
      sentAt: new Date().toISOString(),
      status: 'sent',
    };
    await insertMessage(msg);
    const all = await getMessages();
    const found = all.find(m => m._id === msg._id);
    assert(found !== undefined, 'inserted message not found in getMessages');
    assert(found!.subject === 'DB test message', `wrong subject: ${found!.subject}`);
  }));

  // ── SYNC QUEUE tests ────────────────────────────────────────
  results.push(await test('sync queue has items after inserts', async () => {
    const count = await getSyncQueueCount();
    assert(count >= 3, `expected ≥3 sync queue items, got ${count}`);
  }));

  results.push(await test('getPendingSyncItems returns queue items', async () => {
    const items = await getPendingSyncItems();
    assert(items.length >= 3, `expected ≥3 items, got ${items.length}`);
    assert(items[0].tableName !== undefined, 'tableName undefined');
    assert(items[0].action === 'create', `expected create, got ${items[0].action}`);
    assert(items[0].attempts === 0, `expected 0 attempts, got ${items[0].attempts}`);
  }));

  results.push(await test('markSyncItemFailed increments attempts', async () => {
    const items = await getPendingSyncItems();
    const item = items[items.length - 1];
    await markSyncItemFailed(item.id, 'test error');
    const updated = await getPendingSyncItems();
    const updatedItem = updated.find(i => i.id === item.id);
    assert(updatedItem !== undefined, 'failed item not found');
    assert(updatedItem!.attempts === 1, `expected 1 attempt, got ${updatedItem!.attempts}`);
    assert(updatedItem!.lastError === 'test error', `wrong error: ${updatedItem!.lastError}`);
  }));

  results.push(await test('markSyncItemDone removes from queue', async () => {
    const items = await getPendingSyncItems();
    const countBefore = items.length;
    await markSyncItemDone(items[0].id);
    const countAfter = await getSyncQueueCount();
    assert(countAfter === countBefore - 1, `expected ${countBefore - 1}, got ${countAfter}`);
  }));

  results.push(await test('markRecordSynced updates synced flag', async () => {
    const db = await getDatabase();
    if (!db) return; // web fallback
    // Get the test appointment we inserted
    const apts = await getAppointments();
    const testApt = apts.find(a => a.reason === 'DB test');
    assert(testApt !== undefined, 'test appointment not found');
    await markRecordSynced('appointments', testApt!._id);
    const row = await db.getFirstAsync(
      'SELECT synced FROM appointments WHERE _id = ?', testApt!._id
    );
    assert(row.synced === 1, `expected synced=1, got ${row.synced}`);
  }));

  // ── SYNC METADATA tests ────────────────────────────────────
  results.push(await test('setLastSyncTime and getLastSyncTime roundtrip', async () => {
    const ts = '2026-04-16T12:00:00.000Z';
    await setLastSyncTime(ts);
    const got = await getLastSyncTime();
    assert(got === ts, `expected ${ts}, got ${got}`);
  }));

  // ── UPSERT tests (server-wins conflict resolution) ──────────
  results.push(await test('upsertMedicalRecords updates existing record', async () => {
    const updated = [{
      _id: 'mr-001',
      patientId: 'pat-00001',
      visitType: 'OPD Consultation (Updated)',
      chiefComplaint: 'Updated complaint',
      diagnoses: [{ name: 'Test Diagnosis' }],
      createdAt: '2026-02-09T08:30:00Z',
    }];
    const count = await upsertMedicalRecords(updated as any);
    assert(count === 1, `expected 1 upserted, got ${count}`);
    const records = await getMedicalRecords();
    const found = records.find(r => r._id === 'mr-001');
    assert(found!.visitType === 'OPD Consultation (Updated)', `upsert didn't update: ${found!.visitType}`);
  }));

  results.push(await test('upsertAppointments skips unsynced local records', async () => {
    // The test appointment we inserted earlier has synced=1 (we called markRecordSynced).
    // But let's insert a new unsynced one and verify it's protected.
    const localApt = {
      _id: `local-apt-${Date.now()}`,
      patientId: 'pat-00001',
      appointmentDate: '2026-07-01',
      appointmentTime: '14:00',
      appointmentType: 'Check-up',
      reason: 'Local unsynced',
      status: 'scheduled',
    };
    await insertAppointment(localApt);

    // Now try to upsert the same ID from "server" with different data
    const serverVersion = [{
      ...localApt,
      reason: 'Server version',
      status: 'cancelled',
    }];
    await upsertAppointments(serverVersion);

    // The local version should win (not overwritten)
    const all = await getAppointments();
    const found = all.find(a => a._id === localApt._id);
    assert(found!.reason === 'Local unsynced', `local record was overwritten: ${found!.reason}`);
  }));

  // ── TABLE VALIDATION test ───────────────────────────────────
  results.push(await test('markRecordSynced rejects invalid table names', async () => {
    try {
      await markRecordSynced('DROP TABLE medical_records; --', 'test');
      throw new Error('Should have thrown');
    } catch (err: any) {
      assert(err.message.includes('invalid table name'), `wrong error: ${err.message}`);
    }
  }));

  // ── Summary ─────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log('\n══════════════════════════════════════════');
  console.log(`  DATABASE TESTS: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════');
  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
  }
  console.log('══════════════════════════════════════════\n');

  return { passed, failed, results };
}
