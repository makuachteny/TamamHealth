# Login rate limiting

This document describes how the platform throttles failed-login attempts and
how an operator scales that defence across multiple Next.js instances.

## Why rate-limit logins at all

The session JWT is reachable via `/api/auth/login`. Without throttling, an
attacker can:

- **Brute force** a single account by guessing thousands of passwords per
  second from one host.
- **Password-spray** a known username list with one common password
  (`Welcome2024!`, `December2025`, etc.) — defeating per-account throttling
  by spreading guesses across many accounts.

The login route stops both. Two independent counters run in parallel:

| Counter | Threshold | Window | Defence against |
|---|---|---|---|
| per-username | 5 failed attempts | 15 min | brute force on one account |
| per-source-IP | 20 failed attempts | 15 min | password spray from one host |

When either counter is exhausted, `/api/auth/login` returns HTTP 429
without consulting the password verifier. Resetting happens on every
successful login (both counters for the legitimate user are cleared).

## Algorithm

Implemented in [`lib/rate-limit.ts`](../../src/lib/rate-limit.ts).

Each call to `rateLimit({ key, limit, windowMs })`:

1. SHA-256 hashes the key (`tamam-rl:<key>`) and truncates to 16 hex chars.
   The hash is what gets stored — usernames and IPs never appear as
   plaintext keys in Redis or in operator dashboards.
2. INCRs the bucket. On the first hit in a window, an EXPIRE sets the
   bucket TTL to `windowMs`. The bucket auto-evicts when the window
   passes, giving a fixed-window counter equivalent to the previous
   in-memory `count + lockedUntil` shape.
3. Returns `{ allowed, resetAt, remaining }`. `allowed` is `count <= limit`.

The single round-trip to Upstash is a 3-command pipeline (`INCR`,
`EXPIRE … NX`, `PTTL`) — one HTTP call per attempt.

`resetRateLimit(key)` DELetes the bucket. Called once per successful login.

## Backends

The backend is selected at module-init based on environment variables:

### Upstash Redis REST (production / staging)

If both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set,
the module talks to the Upstash REST endpoint via plain `fetch`.

We deliberately did **not** add the `@upstash/redis` SDK as a runtime
dependency. The REST endpoint accepts a JSON-array pipeline body and
returns `{ result }` / `{ error }` entries — two commands' worth of
integration code, against an extra package and its transitive deps, was
not a worthwhile trade. Using `fetch` also means the module runs in both
the Node and Edge runtimes, so we can hoist rate limiting into
`middleware.ts` later without rewriting it.

### In-process Map (single-instance dev)

If the Upstash vars are absent, the module falls back to a `Map` keyed by
the hashed key. This is fine for local development against `next dev`
where there is exactly one process. The first call to `rateLimit` in this
mode logs a one-time warning so an operator who deploys without setting
the env vars sees:

    [rate-limit] Using in-process memory backend. Horizontally scaled
    deploys MUST set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
    so per-IP / per-user counters are shared across instances.

## Fail-open posture

If Upstash returns 5xx, throws, or times out, `rateLimit` returns
`allowed: true` and logs the error. Two reasons:

1. Rate limiting is defence-in-depth. Login already has CSRF, SameSite
   cookies, and bcrypt verification; an attacker who beats Upstash for
   a few minutes still has to beat those.
2. The alternative — denying all logins when Redis is down — turns a
   third-party outage into a self-inflicted DoS for legitimate
   clinicians who need to chart on shift. We accept the worse failure
   mode in exchange for the better availability.

The retry policy is one round of 50ms exponential backoff before
falling through. 4xx responses from Upstash (bad token, malformed
command) are treated as programming errors and surface to the logs;
they should never happen in steady state.

## Privacy

The hashed key written to Redis is `sha256("tamam-rl:" + key)` truncated
to 16 hex chars. 64 bits of collision resistance is plenty at expected
cardinality (thousands of usernames + IPs); a collision only causes two
keys to share a counter, which is safe — the limit gets a tiny bit
stricter for one of them.

Hashing matters because the Upstash dashboard shows live keys. Without
the hash, a misconfigured access control on the dashboard would leak the
list of currently-being-rate-limited usernames.

## Environment variables

| Var | Required? | Effect |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Production / multi-instance | Switches backend to Upstash. Trailing `/` is stripped automatically. |
| `UPSTASH_REDIS_REST_TOKEN` | Production / multi-instance | Bearer token for the Upstash REST endpoint. |

If only one of the two is set, the module falls back to the in-memory
backend (and warns) — both are required to engage Upstash.

## Operator guidance

- **Single instance / dev**: leave the env vars unset. The in-memory
  fallback works; the warning is informational.
- **Single instance / production**: still set Upstash. A redeploy or
  process restart blows away in-memory state, which means an attacker
  who triggered a redeploy mid-attack would get their counters reset.
- **N-instance horizontally scaled**: Upstash is mandatory. Without it,
  an attacker can route 5 password attempts to instance A, 5 to B, 5 to
  C, etc., and never trip the per-account threshold.
- **Region**: pick an Upstash region close to the deploying region
  (e.g. `eu-west-1` for AWS Frankfurt). The REST call is on the login
  hot path; cross-region adds 50-100ms of latency to every attempt.
- **Rotation**: the token rotates without code change. Set the new
  values and redeploy. Do not write tokens into the repo — the platform
  reads them from `process.env`.

## Lockout thresholds

The thresholds are constants in
[`/api/auth/login/route.ts`](../../src/app/api/auth/login/route.ts):

```
USER_LOCK_THRESHOLD = 5
USER_LOCK_MS = 15 * 60 * 1000

IP_LOCK_THRESHOLD = 20
IP_LOCK_MS = 15 * 60 * 1000
```

The per-IP threshold is intentionally higher than per-user. A shared
network (a hospital ward NAT'd behind one public IP, a VPN concentrator)
can plausibly produce 5–10 failed attempts an hour from real users
fat-fingering passwords. 20 is well above that and well below the rate a
spraying attacker would use.

If the operator needs to tune them per environment without a redeploy,
move the constants behind env vars; this hasn't been needed yet.

## Tests

- [`rate-limit.test.ts`](../../src/__tests__/security/rate-limit.test.ts)
  — limit enforcement, window roll, reset, in-memory fallback, Upstash
  pipeline shape, hashed-key privacy, 5xx fail-open.

## Future work

- **Edge-runtime move**: the module is already `fetch`-only, so when we
  decide to put rate limiting in `middleware.ts` (so a flood doesn't
  even reach the route handler), the only code change is to call
  `rateLimit` from there.
- **Sliding-log instead of fixed-window**: fixed window has the
  classic boundary-burst issue (a burst at second 59 of one window plus
  the start of the next allows up to 2× the limit in 2 seconds). For
  login that is acceptable; for general API throttling it isn't, and
  we'd want a sorted-set sliding log there.
