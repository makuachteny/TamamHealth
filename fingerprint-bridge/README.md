# TamamHealth Fingerprint Bridge

A small Node service that exposes a USB fingerprint scanner to the TamamHealth
browser app over a localhost HTTP API. It runs on the same machine the scanner
is plugged into (the registration desk PC) and wraps vendor SDKs behind a
uniform adapter interface.

```
Browser app (Next.js)  ──HTTP──▶  fingerprint-bridge (this service, 127.0.0.1:7345)
                                        │
                                        ▼  vendor SDK / driver
                                  USB fingerprint scanner
```

Why a bridge? Browsers cannot load native scanner SDKs. WebUSB is not supported
by most optical scanner vendors, and the SDKs that exist are native libraries.
A loopback HTTP service is the standard integration pattern (Mantra, SecuGen,
DigitalPersona all ship one); this bridge gives TamamHealth a single,
vendor-neutral API in front of whichever scanner a facility owns.

## Offline-first posture

The platform never depends on the bridge being up. If the bridge is
unreachable, fingerprint enrollment/identification UI simply reports the
scanner as unavailable and staff fall back to hospital-number / QR / name
search. Biometric **templates** (not images) are stored in the platform's
PouchDB/CouchDB layer (`tamamhealth_biometric_templates`) and sync like any
other clinical data — identification works fully offline against the local
replica.

## Run

```bash
cd fingerprint-bridge
npm start           # mock driver, http://127.0.0.1:7345
```

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `FINGERPRINT_DRIVER` | `mock` | Adapter to load from `./adapters/<name>.mjs` |
| `FINGERPRINT_BRIDGE_PORT` | `7345` | Listen port |
| `FINGERPRINT_BRIDGE_HOST` | `127.0.0.1` | Listen host (keep loopback) |
| `FINGERPRINT_BRIDGE_ALLOWED_ORIGIN` | `*` | CORS origin pin for the browser app |

On the platform side, set in `platform/.env.local`:

```bash
NEXT_PUBLIC_FINGERPRINT_ENABLED=true
NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL=http://127.0.0.1:7345
```

## API

### `GET /health`

```json
{ "ok": true, "driver": "mock", "templateFormat": "MOCK", "scannerConnected": true }
```

### `POST /capture`

Body: `{ "finger": "right_index" }` (mock driver also accepts `simulateId` to
produce a deterministic template for demos/tests).

```json
{ "template": "<base64>", "quality": 92, "finger": "right_index", "format": "MOCK", "driver": "mock" }
```

### `POST /match`

Body: `{ "probe": "<base64>", "candidates": [{ "id": "tpl-1", "template": "<base64>" }], "threshold": 40 }`

```json
{ "matches": [{ "id": "tpl-1", "score": 100 }] }
```

Matches are sorted by score (0–100) descending and filtered to
`score >= threshold` (default 40).

## Adding a real scanner adapter

Create `adapters/<vendor>.mjs` exporting `createAdapter()` that returns:

```js
{
  name: 'mantra-mfs100',
  templateFormat: 'ISO_19794_2',        // or 'ANSI_378'
  async isScannerConnected() {},        // poll the SDK / device list
  async capture({ finger }) {},         // → { template, quality, finger }
  async match(probe, candidates) {},    // → [{ id, score }] using the SDK matcher
}
```

then run with `FINGERPRINT_DRIVER=<vendor>`. Guidance:

- **Prefer ISO/IEC 19794-2 (or ANSI 378) templates** so enrollments are
  portable across scanner brands. Avoid proprietary template formats unless
  the vendor offers nothing else — those lock a facility to one brand.
- **Delegate matching to the vendor SDK** (1:1 verify in a loop, or 1:N
  identify if offered). Normalize whatever score the SDK returns to 0–100.
- Vendors with loopback HTTP services of their own (e.g. Mantra MFS100 client
  service) can be wrapped with a thin adapter that just forwards requests.

## Test

```bash
npm test
```
