# CouchDB → PostgreSQL writeback: per-table conflict policy

This document describes how the platform resolves conflicts when an offline
CouchDB document is replayed into the national analytics PostgreSQL store, and
what residual risks remain.

## Why this matters

The clinical edge runs offline-first on CouchDB. A single row's history can
look like this:

1. Clinician A drafts a lab order on a tablet at 09:00.
2. Clinician B finalizes the same order on a different tablet at 11:00.
3. Tablet A only reaches the network at 13:00 and sends its 09:00 snapshot.

If the writeback applies the 13:00-arriving 09:00 snapshot last, the
finalized record is silently rolled back to a draft. The same shape of
problem applies to demographics (a stale push erasing a clinician's note),
audit log (a duplicate replay overwriting a write the user actually made),
and disease-surveillance status (a closed alert reopened by an old doc).

A naive `INSERT … ON CONFLICT (id) DO UPDATE SET …` is wrong for every one
of these. We resolve conflicts per table, with a small typed enum.

## The three policies

Defined in [`lib/db/postgres.ts`](../../src/lib/db/postgres.ts) as the
`ConflictPolicy` value object and the `TABLE_CONFLICT_POLICY` map.

### `LAST_WRITE_WINS`

```
INSERT INTO <table> (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...
```

The default. Used when each push from a client carries the entire current
state of the row and there is no clinical-grade status to roll back.

| Table | Why |
|---|---|
| `patients` | Demographics; latest snapshot is the source of truth. (A future `MERGE_NOTES` policy variant will protect narrative columns.) |
| `hospitals`, `organizations`, `facility_assessments` | Reference data + assessment scores. |
| `sync_metadata` | Bookkeeping for the sync runner itself. |
| `immunizations`, `anc_visits`, `boma_visits` | Each row is its own visit; no terminal status semantic. |

### `APPEND_ONLY`

```
INSERT INTO audit_log (...) VALUES (...)
ON CONFLICT (id) DO NOTHING
```

| Table | Why |
|---|---|
| `audit_log` | An audit row is immutable once written. If the same `id` arrives twice from the sync feed the second is a duplicate to be silently dropped, never an overwrite. Compromising the audit log defeats the rest of the platform's incident-response posture. |

### `CLINICAL_FINALIZED`

```
INSERT INTO <table> (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...
WHERE (
  <table>.status IS NULL OR
  <table>.status NOT IN ('closed','resolved','cancelled','finalized')
) AND (
  $<updated_at>::timestamptz >=
  COALESCE(<table>.updated_at, '1970-01-01'::timestamptz)
)
```

Two guards:

- The existing row is not in a terminal status (only emitted for tables that
  actually carry a `status` column — `lab_results`, `referrals`,
  `disease_alerts`, `prescriptions`).
- The incoming `updated_at` is monotonic — a 09:00 snapshot cannot overwrite
  an 11:00 one regardless of when it arrives.

| Table | Why |
|---|---|
| `medical_records` | Encounter notes. Older snapshot must not erase a newer one. |
| `lab_results` | Once `status='resolved'` the result is signed off. |
| `prescriptions` | Once `status='cancelled'` the order must not silently un-cancel. |
| `births`, `deaths` | CRVS records. The certificate number is part of an external register; the row must not silently downgrade. |
| `referrals` | Once `status='closed'` the referral has been actioned. |
| `disease_alerts` | Once `status='resolved'` an outbreak should not silently re-open. |

The guard relies on a covering index — see [migration
0002](../../src/lib/db/migrations/0002_finalized_status_index.sql) — so the
per-change writeback latency stays flat as the tables grow.

## What this does *not* defend against

- **A genuinely newer doc with a worse status transition.** If clinician B
  legitimately reverts a finalized lab result by issuing a fresher doc that
  resets `status` to `pending`, the policy treats that as the new truth. The
  guard is against stale or replayed snapshots, not against a clinician with
  a pen.
- **Field-level merge.** The current `LAST_WRITE_WINS` for `patients` still
  overwrites every column. A planned follow-up adds a `MERGE_NOTES` variant
  that uses `COALESCE(EXCLUDED.note, patients.note)` so a server push that
  omits the notes column does not blank it.
- **Clock skew between edge devices.** The `updated_at` guard assumes
  reasonably-synchronised tablet clocks. Severe skew (>1 hour) can let a
  stale snapshot win. The mitigation is at the device layer — NTP /
  CouchDB-side timestamping.
- **An attacker forging the writeback feed.** Out of scope for this
  document. The webhook is HMAC-authenticated; see
  [`/api/sync` route](../../src/app/api/sync/route.ts) for that defence.

## What the operator must do

- Run migration `0002` before deploying the new conflict policy. The runner
  in [`lib/db/migrate.ts`](../../src/lib/db/migrate.ts) applies it
  automatically at boot, but the indexes can be slow to build on a populated
  database — schedule the deploy during a low-write window if the analytics
  store is large.
- When adding a new clinical table, decide its policy at the same time it is
  added to `ALLOWED_TABLES`. The runtime will refuse to upsert into a table
  that has no entry in `TABLE_CONFLICT_POLICY` — fail-fast is intentional
  and a missing policy must not silently degrade to last-write-wins.

## Tests

- [`upsert-policy.test.ts`](../../src/__tests__/db/upsert-policy.test.ts) —
  asserts that the SQL emitted for each policy matches the expected shape:
  `DO NOTHING` for the audit log, the WHERE-clause guard for the clinical
  tables, and the original `DO UPDATE SET` for last-write-wins.
- [`sql-allowlist.test.ts`](../../src/__tests__/security/sql-allowlist.test.ts)
  — ensures the identifier allowlist still rejects unknown tables and
  poisoned column names alongside the new policy dispatch.
