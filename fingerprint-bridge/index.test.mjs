import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, loadAdapter } from './index.mjs';

let server;
let baseUrl;

before(async () => {
  const adapter = await loadAdapter('mock');
  server = createServer(adapter);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /health reports driver and scanner state', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.driver, 'mock');
  assert.equal(body.templateFormat, 'MOCK');
  assert.equal(body.scannerConnected, true);
});

test('POST /capture returns a template with quality and format', async () => {
  const { status, body } = await post('/capture', { finger: 'right_index' });
  assert.equal(status, 200);
  assert.ok(typeof body.template === 'string' && body.template.length > 0);
  assert.ok(body.quality > 0 && body.quality <= 100);
  assert.equal(body.finger, 'right_index');
  assert.equal(body.format, 'MOCK');
  assert.equal(body.driver, 'mock');
});

test('enroll + identify round trip: same simulateId matches at 100', async () => {
  const enrolled = await post('/capture', { simulateId: 'pat-abc123', finger: 'right_index' });
  const probe = await post('/capture', { simulateId: 'pat-abc123' });
  const other = await post('/capture', { simulateId: 'pat-zzz999' });

  const { status, body } = await post('/match', {
    probe: probe.body.template,
    candidates: [
      { id: 'tpl-1', template: enrolled.body.template },
      { id: 'tpl-2', template: other.body.template },
    ],
  });
  assert.equal(status, 200);
  assert.equal(body.matches.length, 1);
  assert.deepEqual(body.matches[0], { id: 'tpl-1', score: 100 });
});

test('POST /match returns empty list when nothing clears the threshold', async () => {
  const probe = await post('/capture', { simulateId: 'pat-nobody' });
  const candidate = await post('/capture', { simulateId: 'pat-someone' });
  const { body } = await post('/match', {
    probe: probe.body.template,
    candidates: [{ id: 'tpl-1', template: candidate.body.template }],
  });
  assert.deepEqual(body.matches, []);
});

test('POST /match validates payload', async () => {
  const missingProbe = await post('/match', { candidates: [] });
  assert.equal(missingProbe.status, 400);

  const badCandidates = await post('/match', { probe: 'abc', candidates: 'nope' });
  assert.equal(badCandidates.status, 400);
});

test('unknown route returns 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
});

test('CORS preflight is answered', async () => {
  const res = await fetch(`${baseUrl}/capture`, { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.ok(res.headers.get('access-control-allow-origin'));
});
