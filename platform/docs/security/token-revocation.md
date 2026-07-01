# JWT revocation

This document describes how the platform invalidates a session JWT before
its `exp` claim and where that check is enforced.

## Why a blacklist at all

JWTs in this platform are HMAC-signed by `JWT_SECRET` and live for 8 hours.
That window is too long for clinical contexts on shared devices: when a
clinician logs out at the end of a shift, the next clinician on the same
tablet must not be able to replay the previous session's cookie. Short
expiries don't solve this — only an explicit revocation does.

## Store

`lib/token-blacklist.ts` keeps a `Map<jwt, { expSec }>`:

- Persisted to `<platform>/.token-blacklist.json` (gitignored, mode 0600)
  so a server restart doesn't reset the revocation list.
- Keyed by the full JWT string. Forged tokens never reach this layer
  because `verifyToken()` HMAC-checks first.
- Each entry carries the JWT's `exp` claim. Entries are evicted lazily on
  read and proactively on a 60-second sweep — once the JWT itself expires
  it can't be replayed anyway, so we stop tracking it.
- The previous in-memory implementation flushed on a 1,000-entry cap. That
  was a denial-of-revocation: an attacker could log in 1,000 times to
  empty the blacklist. The current store has no such cap; the only
  shrinking mechanism is exp-based eviction.

## Where the check runs

JWT revocation has to be enforced in *Node* runtime (the file-backed store
needs `node:fs`). Every authenticated path passes through one of two Node
chokepoints:

| Chokepoint | What it protects | File |
|---|---|---|
| `/api/auth/me` | The session bootstrap that `context.tsx` calls on every app load. A revoked token → `401 { user: null }` → client logs out the user. | [route.ts](../../src/app/api/auth/me/route.ts) |
| `getAuthPayload(request)` | Used by every authenticated `/api/*` route handler. A revoked token never returns a payload, so no PHI read or mutation can land. | [api-auth.ts](../../src/lib/api-auth.ts) |

The page-level Edge proxy **does not** call `isTokenRevoked` —
Next.js proxy runs on the Edge runtime which has no `node:fs`. A
stolen-cookie page navigation can render the route shell, but the
shell's bootstrap call to `/api/auth/me` triggers the logout flow and any
subsequent API call (mutation or PHI read) is rejected at `getAuthPayload`.
Logout also clears the cookie on the same browser, so this only matters
for cross-browser cookie theft.

## Logout flow

[`/api/auth/logout`](../../src/app/api/auth/logout/route.ts):

1. Reads the token from the request cookie.
2. `await revokeToken(token)` — the store extracts `exp` from the JWT,
   inserts the entry, and debounces a write to the persistence file.
3. Clears both `tamamhealth-token` (httpOnly) and `tamamhealth-csrf` cookies
   on the response.

All three steps are best-effort: if the cookie is absent or the token is
malformed, logout still succeeds with the cookie cleared.

## Failure modes

- **Server restart loses entries written in the last ~250ms.** The persist
  is debounced. For most contexts this is acceptable; if a logout request
  succeeds the response is sent and the user is redirected before the
  debounce timer fires. Critical environments can call
  `_flushTokenBlacklistForTest()` (or a future operator-facing equivalent)
  to force-flush before redeploying.
- **Process crash mid-write** can leave the file partially written. The
  loader catches JSON-parse failures and starts empty rather than
  refusing to boot — fail-open here is the lesser evil.
- **Horizontal scaling**: the file-backed store is single-instance. A
  rolling deploy across N instances doesn't share revocations. The next
  ticket on the roadmap moves rate-limiting (and this) to Redis.

## Operator notes

- `TOKEN_BLACKLIST_FILE` env var overrides the default path
  (`<cwd>/.token-blacklist.json`). Useful for tests and for operators who
  want to put the file on a faster volume.
- The file is gitignored. Don't commit it.
- A production audit of "who logged out and when" needs to combine this
  store with the audit log — the blacklist intentionally keeps no
  per-session metadata beyond `exp`.

## Tests

- [`token-blacklist.test.ts`](../../src/__tests__/security/token-blacklist.test.ts)
  — 10 tests covering: round-trip revoke/check, isolation between tokens,
  persistence across an in-process restart, expired-entry lazy eviction,
  expired entries don't survive a restart, the no-flush-at-N regression,
  empty-token safety, malformed-JWT fallback expiry.
