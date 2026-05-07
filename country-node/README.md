# TamamHealth Country Node

National-layer service in the federated EHR architecture. Receives synchronized
event batches from facility nodes (hospitals, clinics, PHCUs) inside a given
country's jurisdiction and provides:

- National ingestion API (the receiver for facility `sync_events` outbox pushes)
- Canonical clinical store, partitioned by country
- DHIS2 adapter (country-specific mappings, periods, org units)
- National metadata service (`/metadata`) — concept mappings, facility registry,
  program definitions; facility nodes fetch and cache this
- National analytics — dashboards for ministry users, partner orgs
- Reconciliation + profile/version distribution back to facilities

This layer is the country's **interoperability and governance runtime**. It does
not replace the facility node's clinical runtime — clinicians keep working
locally even when the country node is unreachable.

## Status

**Scaffold / Phase 3 design stake.** This directory is a placeholder so that
`docker-compose.country.yml` can point at it when a country ministry or partner
org commits to deploying a country node. The facility platform already emits
`sync_events` (see `platform/src/lib/services/sync-event-service.ts`) and the
country metadata API at `platform/src/app/api/country/metadata/route.ts` is a
stand-in the facility uses until this service is live.

## Intended architecture

```
platform (facility node)                  country-node
─────────────────────────                 ─────────────────
/api/patients (write)                     /ingest/events (receive push)
/api/sync     (CouchDB webhook)    ───►   canonical store (PostgreSQL)
sync_events outbox                        DHIS2 adapter → ministry DHIS2
                                          /metadata     (serve to facilities)
                                          /fhir/*       (national FHIR API)
                                          /analytics    (ministry dashboard)
```

## Recommended stack

- **FastAPI (Python 3.12)** or **Spring Boot (Java 21)** for the ingestion and
  query APIs — the spec calls out these stacks for the country layer because
  they're common in African ministry IT environments.
- **PostgreSQL 16** as the canonical store with per-country schemas.
- **Celery/RQ** (Python) or scheduled workers (Java) for DHIS2 push, backup,
  reconciliation.
- **Kafka or CouchDB `_changes`** as the ingestion backbone.

## First milestones

1. `/ingest/events` endpoint — accepts the facility's `sync_events` batches,
   validates against the country's allowed resource types, writes to Postgres.
2. `/metadata` endpoint — serve country profile (currently stubbed in the
   facility platform at `/api/country/metadata`).
3. DHIS2 scheduled push — weekly `dataValueSets` submission using the existing
   exporter logic from the facility service.
4. FHIR read API at the national level — already prototyped on the facility
   platform, port to this service for aggregate queries.
5. Reconciliation queue push-back — country-detected identifier collisions
   return to facility `conflict_queue`.

## Why this lives in its own service

- **Sovereignty**: ministries require country-owned data perimeters; a shared
  regional transactional DB is politically and legally infeasible.
- **Resilience**: facility nodes must continue serving care during country
  node outages; separate services make the failure domain explicit.
- **Scaling**: national aggregate analytics load profile is very different
  from point-of-care write traffic; separating them lets each layer scale
  independently.

---

When you're ready to build this out, start with the `/ingest/events` endpoint
and a minimal Postgres schema mirroring the facility `db-types.ts`. The
facility platform already knows where to push — just point
`SYNC_PUSH_URL=https://country.example.org/ingest/events` in the facility's
env and it will start draining its outbox here.
