# CSRF threat model

This document describes how the platform defends against Cross-Site Request
Forgery and what residual risks remain.

## Layers

The platform stacks three independent defences. An attack has to defeat all
three to land a forged mutation.

### 1. SameSite=strict session cookie

The session JWT lives in `tamamhealth-token`, an `httpOnly` cookie set
`SameSite=strict; Secure` (the latter in production). A cross-site request
initiated from `evil.com` does not carry this cookie at all — the browser
refuses to attach it on cross-origin loads.

This single mechanism stops the textbook CSRF attack (an `<img>` or
`<form action>` from a malicious page). It is implemented at
[`/api/auth/login`](../../src/app/api/auth/login/route.ts) and
[`/api/auth/logout`](../../src/app/api/auth/logout/route.ts).

### 2. Origin / Host header check (middleware layer 1)

For every state-changing request to `/api/*`,
[`middleware.ts`](../../src/middleware.ts) requires:

- An `Origin` header is present (mandatory in production).
- `URL(origin).host === request.headers.get('host')`.

This catches the residual cases where SameSite is bypassed — most commonly,
buggy or older browsers, exotic deployment misconfigurations, or a downstream
proxy that strips cookie attributes.

### 3. HMAC-bound double-submit token (middleware layer 2)

Implemented in [`lib/csrf.ts`](../../src/lib/csrf.ts).

On successful login the server mints a token of the form

    base64url(nonce_16_random_bytes) "." base64url(HMAC-SHA-256(JWT_SECRET, sub || nonce))

The token is set as a *non-`httpOnly`* cookie `tamamhealth-csrf` so the
browser-side fetch wrapper [`lib/api-fetch.ts`](../../src/lib/api-fetch.ts)
can read it and echo it back in the `X-CSRF-Token` header on every
state-changing request.

The middleware enforces, for any non-exempt POST/PUT/PATCH/DELETE under
`/api/*`:

- both the cookie *and* the header are present;
- they are equal (the "double-submit" check);
- the HMAC verifies for the JWT subject of the current session.

The HMAC is the load-bearing piece. A pure double-submit cookie can be
defeated by an attacker who can write any cookie on the target origin (e.g.
via a sub-domain takeover or a misbehaving downstream that injects headers).
The HMAC binds the token to the *server's* secret and to the *current user's*
identity, so neither writing arbitrary cookies nor leaking another user's
token gives the attacker something that verifies.

## Exempt routes

Some `/api/*` paths are intentionally exempt from layer 3:

| Path | Why |
|---|---|
| `/api/auth/login`  | No session yet — there is nothing to bind a token to. |
| `/api/auth/logout` | Idempotent; failure mode is "user stays logged in". |
| `/api/auth/me`     | Read-only. |
| `/api/demo-credentials` | Read-only and self-gates by demo flag. |
| `/api/patient-portal/*` | Separate JWT scheme with its own anti-forgery flow. |
| `/api/fhir/metadata` | Public CapabilityStatement. |
| `/api/country/metadata`, `/api/terminology/*` | Public reference data, no PHI. |

The exempt list lives in [`middleware.ts`](../../src/middleware.ts) — touch
both there and the unit tests when adding to it.

## What this does *not* defend against

- **XSS in our own JS payload.** A successful XSS on `app.tamamhealth.org`
  bypasses every CSRF mitigation here — the attacker's script runs
  *as* the user, reads their CSRF cookie, and sends matching headers.
  CSRF is the cross-origin defence; XSS prevention (CSP, output encoding,
  removing inline `dangerouslySetInnerHTML` paths) is the defence against
  same-origin attacks.
- **A compromised browser or OS.** Cookies and headers can both be read by
  malware on the user's machine.
- **Insider threat.** A logged-in clinician using their own session to do
  things they shouldn't is an authorisation problem, not a CSRF one.

## Token rotation

- A fresh token is minted on every login (so a leaked old token from a
  previous session doesn't survive a re-auth).
- The cookie's `maxAge` matches the session JWT's 8-hour life.
- Logout clears both cookies.
- Lazy mint: if the middleware sees a valid session JWT but no CSRF cookie
  (the user upgraded across the deploy that introduced this defence, or
  they cleared cookies), it sets a fresh CSRF cookie on the next
  authenticated GET response. The user's next mutation then succeeds without
  forcing a re-login.

## What the operator must do

- Set `JWT_SECRET` to ≥32 bytes of entropy in every environment. The CSRF
  HMAC reuses that secret. The platform refuses to boot in production
  without it.
- Don't expose `tamamhealth-csrf` to a non-same-origin downstream — it is
  intentionally readable by the browser, but a public CDN that caches it
  would break user isolation.

## Tests

- [`csrf.test.ts`](../../src/__tests__/security/csrf.test.ts) — mint/verify
  unit tests (HMAC binding, nonce randomness, malformed-input handling).
- The middleware enforcement path (missing token / mismatched token / lazy
  mint on first authenticated GET) is exercised live against the dev server
  during release verification; see the entries in the ticket history when
  this defence was introduced.

## See also

- [draft-storage.md](./draft-storage.md) — encrypted ephemeral storage for
  in-progress PHI form drafts on shared workstations. Different threat
  surface (next-user-on-the-device, not cross-origin) but the same general
  posture of layering browser-side defences over a session cookie.
- [token-revocation.md](./token-revocation.md) — what happens server-side on
  logout (the same `logout()` flow that triggers draft cleanup).
