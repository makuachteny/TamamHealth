/**
 * sync-worker smoke tests.
 *
 * Run with:  node --test index.test.mjs
 *
 * These tests are intentionally narrow — they cover the pieces of the worker
 * that are easy to break silently (HMAC framing, env validation, state-file
 * round-trip, _changes shape adaptation). The main loop is exercised via the
 * docker-compose integration path, not here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

import {
  signPayload,
  readEnv,
  loadState,
  saveState,
  pollDatabase,
  FALLBACK_DBS,
} from './index.mjs';

test('signPayload produces sha256= prefixed hex matching the platform verifier', () => {
  const secret = 'x'.repeat(32);
  const body = JSON.stringify({ db: 'tamamhealth_patients', changes: [] });
  const sig = signPayload(secret, body);
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
  const expected = 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  assert.equal(sig, expected);
});

test('readEnv reports every missing required var', () => {
  const saved = {
    COUCHDB_URL: process.env.COUCHDB_URL,
    COUCHDB_WEBHOOK_SECRET: process.env.COUCHDB_WEBHOOK_SECRET,
    PLATFORM_SYNC_URL: process.env.PLATFORM_SYNC_URL,
  };
  delete process.env.COUCHDB_URL;
  delete process.env.COUCHDB_WEBHOOK_SECRET;
  delete process.env.PLATFORM_SYNC_URL;
  try {
    const { errors } = readEnv();
    assert.ok(errors.some((e) => e.includes('COUCHDB_URL')));
    assert.ok(errors.some((e) => e.includes('COUCHDB_WEBHOOK_SECRET')));
    assert.ok(errors.some((e) => e.includes('PLATFORM_SYNC_URL')));
  } finally {
    if (saved.COUCHDB_URL !== undefined) process.env.COUCHDB_URL = saved.COUCHDB_URL;
    if (saved.COUCHDB_WEBHOOK_SECRET !== undefined) process.env.COUCHDB_WEBHOOK_SECRET = saved.COUCHDB_WEBHOOK_SECRET;
    if (saved.PLATFORM_SYNC_URL !== undefined) process.env.PLATFORM_SYNC_URL = saved.PLATFORM_SYNC_URL;
  }
});

test('readEnv rejects short secrets', () => {
  const saved = process.env.COUCHDB_WEBHOOK_SECRET;
  process.env.COUCHDB_URL = 'http://couchdb:5984';
  process.env.COUCHDB_WEBHOOK_SECRET = 'too-short';
  process.env.PLATFORM_SYNC_URL = 'http://platform:3000/api/sync';
  try {
    const { errors } = readEnv();
    assert.ok(errors.some((e) => e.includes('>=32 chars')));
  } finally {
    if (saved === undefined) delete process.env.COUCHDB_WEBHOOK_SECRET;
    else process.env.COUCHDB_WEBHOOK_SECRET = saved;
  }
});

test('saveState/loadState round-trips JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-state-'));
  try {
    const path = join(dir, 'state.json');
    const initial = await loadState(path);
    assert.deepEqual(initial, {});
    const wanted = { tamamhealth_patients: { seq: '42-abc', lastUpdated: '2026-05-09T00:00:00.000Z' } };
    await saveState(path, wanted);
    const reread = await loadState(path);
    assert.deepEqual(reread, wanted);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FALLBACK_DBS includes patients and audit_log', () => {
  assert.ok(FALLBACK_DBS.includes('tamamhealth_patients'));
  assert.ok(FALLBACK_DBS.includes('tamamhealth_audit_log'));
});

test('pollDatabase advances seq and POSTs an HMAC signed body', async (t) => {
  const realFetch = globalThis.fetch;
  let postedBody = null;
  let postedHeaders = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/_changes')) {
      return new Response(JSON.stringify({
        last_seq: '7-deadbeef',
        pending: 0,
        results: [
          { seq: '5-aaa', id: 'p:1', doc: { _id: 'p:1', name: 'A' }, changes: [{ rev: '1-x' }] },
          { seq: '7-deadbeef', id: 'p:2', doc: { _id: 'p:2', name: 'B' }, changes: [{ rev: '1-y' }] },
        ],
      }), { status: 200 });
    }
    if (u.endsWith('/api/sync')) {
      postedBody = opts.body;
      postedHeaders = opts.headers;
      return new Response(JSON.stringify({ ok: true, processed: 2, errors: 0, lastSeq: '7-deadbeef' }), { status: 200 });
    }
    return new Response('not mocked', { status: 500 });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const env = {
    COUCHDB_URL: 'http://couchdb:5984',
    COUCHDB_WEBHOOK_SECRET: 'x'.repeat(32),
    PLATFORM_SYNC_URL: 'http://platform:3000/api/sync',
    BATCH_SIZE: 100,
  };
  const state = {};
  const r = await pollDatabase({ env, state, db: 'tamamhealth_patients' });
  assert.equal(r.processed, 2);
  assert.equal(r.advancedTo, '7-deadbeef');
  assert.equal(state.tamamhealth_patients.seq, '7-deadbeef');

  // verify HMAC matches what /api/sync expects
  const expected = 'sha256=' + createHmac('sha256', env.COUCHDB_WEBHOOK_SECRET).update(postedBody, 'utf8').digest('hex');
  assert.equal(postedHeaders['x-tamamhealth-signature'], expected);
});
