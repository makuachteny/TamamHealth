/**
 * TamamHealth Fingerprint Bridge
 *
 * Browsers cannot talk to USB fingerprint scanners directly (vendor SDKs are
 * native C/C++/.NET libraries), so this small Node service runs on the SAME
 * machine as the scanner and exposes it to the browser app over localhost
 * HTTP. The platform never depends on it being up — fingerprint features
 * degrade gracefully when the bridge is unreachable (offline-first principle).
 *
 * Endpoints:
 *   GET  /health   → { ok, driver, templateFormat, scannerConnected }
 *   POST /capture  → { template, quality, finger, format, driver }
 *                    body: { finger?, simulateId? (mock driver only) }
 *   POST /match    → { matches: [{ id, score }] } sorted by score desc,
 *                    filtered to score >= threshold
 *                    body: { probe, candidates: [{ id, template }], threshold? }
 *
 * Driver selection: FINGERPRINT_DRIVER env var (default "mock"). Each driver
 * lives in ./adapters/<name>.mjs and exports createAdapter() implementing:
 *   { name, templateFormat, isScannerConnected(), capture(opts), match(probe, candidates) }
 *
 * Security posture: binds to 127.0.0.1 only. Biometric templates transit this
 * process during enroll/identify but are never persisted here — storage and
 * sync live in the platform's PouchDB/CouchDB layer.
 */

import http from 'node:http';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.FINGERPRINT_BRIDGE_PORT || 7345);
const HOST = process.env.FINGERPRINT_BRIDGE_HOST || '127.0.0.1';
const DRIVER = process.env.FINGERPRINT_DRIVER || 'mock';
// Browser app origin allowed to call the bridge. "*" is acceptable here
// because the service is loopback-only, but deployments can pin it.
const ALLOWED_ORIGIN = process.env.FINGERPRINT_BRIDGE_ALLOWED_ORIGIN || '*';
/** Minimum match score (0-100) returned by /match unless the caller overrides. */
const DEFAULT_MATCH_THRESHOLD = 40;

export async function loadAdapter(name = DRIVER) {
  const mod = await import(`./adapters/${name}.mjs`);
  if (typeof mod.createAdapter !== 'function') {
    throw new Error(`[fingerprint-bridge] adapter "${name}" does not export createAdapter()`);
  }
  return mod.createAdapter();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function createServer(adapter) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        const scannerConnected = await adapter.isScannerConnected();
        sendJSON(res, 200, {
          ok: true,
          driver: adapter.name,
          templateFormat: adapter.templateFormat,
          scannerConnected,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/capture') {
        const body = await readBody(req);
        if (!(await adapter.isScannerConnected())) {
          sendJSON(res, 503, { error: 'scanner not connected' });
          return;
        }
        const result = await adapter.capture(body);
        sendJSON(res, 200, {
          ...result,
          format: adapter.templateFormat,
          driver: adapter.name,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/match') {
        const body = await readBody(req);
        const { probe, candidates, threshold } = body;
        if (typeof probe !== 'string' || !probe) {
          sendJSON(res, 400, { error: 'probe (base64 template) is required' });
          return;
        }
        if (!Array.isArray(candidates)) {
          sendJSON(res, 400, { error: 'candidates must be an array of { id, template }' });
          return;
        }
        const minScore = typeof threshold === 'number' ? threshold : DEFAULT_MATCH_THRESHOLD;
        const scored = await adapter.match(probe, candidates);
        const matches = scored
          .filter(m => m.score >= minScore)
          .sort((a, b) => b.score - a.score);
        sendJSON(res, 200, { matches });
        return;
      }

      sendJSON(res, 404, { error: 'not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'internal error';
      const status = message === 'invalid JSON body' || message === 'payload too large' ? 400 : 500;
      sendJSON(res, status, { error: message });
    }
  });
}

async function main() {
  const adapter = await loadAdapter();
  const server = createServer(adapter);
  server.listen(PORT, HOST, () => {
    console.log(`[fingerprint-bridge] driver=${adapter.name} format=${adapter.templateFormat} listening on http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    console.log('[fingerprint-bridge] shutting down');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[fingerprint-bridge] fatal:', err);
    process.exit(1);
  });
}
