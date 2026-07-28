# ADR 0001 — Cross-organization referral visibility

- **Status:** Accepted (implementation landed 2026-07-27)
- **Ticket:** KAN-101
- **Supersedes:** nothing
- **Interacts with:** KAN-95 (per-facility PHI isolation via CouchDB security)

## Context

Referral documents are org-scoped. `filterByScope` filters on `orgId` **before**
it evaluates any facility match, and a referral's `orgId` resolves to the
*sending* organization (`inferOrgId` returns the from-facility's org).

The consequence was structural rather than a bug in a screen: when a facility in
org A referred a patient to a facility in org B, **org B never saw the
referral**. The referring clinician watched a referral sit at `sent` forever,
and the receiving facility had no record it existed. There was no screen to fix
— org-scoped documents cannot deliver cross-org hand-offs.

In South Sudan this is not an edge case. Referral pathways routinely cross
between MoH facilities and mission/NGO hospitals, which are separate
organizations in this system.

## Decision

**Dual-org visibility**, not a shared referral exchange.

A referral carries `toOrgId` when the destination facility belongs to a
different organization, and `filterByScope` admits a document when
`d.orgId === scope.orgId || d.toOrgId === scope.orgId`.

## Alternatives considered

### Shared referral exchange (rejected for now)

A separate, narrowly-scoped store both organizations read, holding the referral
plus the minimum PHI needed to act on it.

Rejected because it introduces a third data location with its own replication
topology, consent semantics, retention policy and failure modes — for a payload
that is, by definition, already a clinical hand-off between two named
facilities. It also fragments the referral: the sending org's copy and the
exchange copy would need reconciling on every status change, and the SLA and
outcome flows added in KAN-43 would have to work across both.

It becomes the right answer if referrals ever need to reach an organization that
is **not** named on the referral (a regional broker routing to "whichever
hospital has capacity"). That is the `regional-exchange` service's problem, and
that service is currently a README.

### Dual-org visibility (chosen)

Cheaper, and narrow by construction — see the boundary analysis below.

## What crosses the boundary

The whole `ReferralDoc`, which is the point: a referral the receiver cannot read
is not a referral. It carries patient name, reason, department, urgency, and
the referring clinician's notes — the minimum a receiving clinician needs to
triage the arrival.

**`transferPackage` is the open question.** `createReferralWithTransfer`
attaches a bulk patient snapshot. That is appropriate for a hand-off inside one
organization; across a boundary it is a larger PHI transfer than the referral
itself implies. This ADR does **not** change that behaviour, and it should be
revisited — a cross-org referral arguably needs an explicit consent step before
the full package crosses, whereas the referral header does not.

## Authorization

Implicit in the act of referring: a clinician addressing a referral to a named
facility is authorizing that facility to see it. There is no separate consent
step today.

This is a deliberate simplification, and the reason it is defensible is that the
crossing is **audited** — `resolveDestinationOrg` writes a `CROSS_ORG_REFERRAL`
audit entry naming both organizations and the destination facility, separately
from the ordinary `CREATE_REFERRAL` entry. Cross-org hand-offs are therefore
enumerable after the fact even though they are not gated before it.

## Why this does not widen anything else

Three properties keep the exception narrow, each with a test:

1. **`toOrgId` is only ever written by `createReferral` / `createReferralWithTransfer`**,
   and only when the destination org genuinely differs. No other document type
   sets it, so nothing else can use this branch.
2. **The facility filter still applies.** A receiving org's clinician sees the
   referral because `toHospitalId` matches their facility — a *different*
   facility in the same receiving org sees nothing.
3. **It is one-directional and document-scoped.** Org B gains sight of referrals
   addressed to org B's facilities. It gains no access to org A's patients,
   encounters, labs or anything else.

## Interaction with per-facility isolation (KAN-95)

KAN-95 proposes replacing client-side `filterByScope` with CouchDB-level
security, so a facility's data never reaches a device that shouldn't have it.
That work **must preserve this exception**, and it is the harder half: CouchDB
`validate_doc_update` and per-database security objects operate at database
granularity, not per-document-field.

The likely shape is a dedicated referral database replicated to both
organizations with a filtered replication on `toOrgId`/`orgId`, which is closer
to the "shared exchange" model rejected above — arrived at from the replication
side rather than the application side. Whoever picks up KAN-95 should read this
ADR first.

## Consequences

- A referral sent from org A to a facility in org B appears on org B's worklist.
- Status changes (`received`, `seen`, `completed`) flow back to the sender,
  because both organizations read the same document rather than two copies.
- The KAN-43 acknowledgement SLA and the care-alert feedback loop work across
  the boundary unchanged.
- `filterByScope` now has one document-shape-specific branch. That is a small
  cost in generality, paid to avoid a second data store.
