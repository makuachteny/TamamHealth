# TamamHealth on AWS — `af-south-1` (Cape Town)

> **Audience:** TamamHealth platform operators standing up production
> infrastructure.
> **Status:** Authoritative for the AWS deploy target. The legacy single-VPS
> path remains supported for staging / sandbox / cost-constrained installs;
> see `/deploy.sh` and `docs/operations/secrets.md`.
>
> **PHI residency: every component below is constrained to `af-south-1`.** No
> control plane outside af-south-1 sees PHI. CloudFront and Route 53 are
> global services that route bytes but never persist them, so they're
> acceptable; CloudTrail / Config / GuardDuty are also region-scoped to
> af-south-1.

---

## TL;DR — chosen architecture

```
                 Route 53 (global, alias)
                  app.<DomainName>     ─┐
                  www.<DomainName>     ─┤
                  couch.<DomainName>   ─┤  (all 3 alias the same ALB)
                  <DomainName>         ─┘
                          │
                          ▼
           ACM cert (af-south-1) on ALB :443
                          │
                          ▼
   ┌─────────────────────────────────────────────────┐
   │   ALB (public subnets, 2 AZ, HTTPS only)        │
   │   host-routed:                                  │
   │     app/<root>      -> platform :3000           │
   │     www             -> website  :3001           │
   │     couch           -> couchdb  :5984 (/_up hc) │
   └─────────────────────────────────────────────────┘
                          │
                          ▼
   ┌─────────────────────────────────────────────────┐
   │   ASG (1 desired, 1 min, 3 max) of EC2          │
   │   - t3.medium (staging) / t3.large (prod)       │
   │   - private subnets                             │
   │   - Docker Compose stack via cloud-init         │
   │   - services:                                   │
   │       platform     (Next.js, :3000)             │
   │       website      (marketing site, :3001)      │
   │       couchdb      (couchdb:3, :5984)           │
   │       sync-worker  (CouchDB → Postgres bridge)  │
   └─────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   ┌───────────────────────┐   ┌───────────────────┐
   │ RDS Postgres 16       │   │ S3 backups bucket │
   │ (analytics ONLY,      │   │ (separate account │
   │ downstream of         │   │  via cross-acct   │
   │ sync-worker; clinical │   │  IAM, see         │
   │ writes still go to    │   │  docs/operations/ │
   │ CouchDB on the EC2)   │   │  backups.md)      │
   │ private subnets       │   └───────────────────┘
   │ Multi-AZ in prod      │
   │ encrypted at rest     │
   └───────────────────────┘
```

### Data flow (clinical writes)

```
Mobile/web client (PouchDB)
        │  bidirectional CouchDB replication
        ▼
CouchDB on EC2  (durable; canonical clinical store)
        │  GET /_changes (poll, every 5s)
        ▼
sync-worker container on the same EC2
        │  POST /api/sync (HMAC-SHA256, COUCHDB_WEBHOOK_SECRET)
        ▼
platform Next.js  →  RDS Postgres (analytics only)
```

PHI residency: every box above is in `af-south-1`. The PostgreSQL store is
analytics-only and is the only place the cross-facility reporting layer
reads from; the platform's clinical CRUD path writes through CouchDB.

### Why EC2 + Docker Compose (not ECS Fargate)

We picked single-EC2 + Docker Compose for these reasons, in order:

1. **CouchDB is stateful and we already operate it.** Fargate's ephemeral
   storage model fights stateful workloads; ECS-on-EC2 with EBS attachment
   solves that but at that point you've reintroduced everything ECS was
   meant to abstract away. CouchDB on a directly-attached EBS volume in a
   single EC2 instance is the simplest correct answer for a sub-100k-patient
   clinic.

2. **Operator parity with the legacy VPS deploy.** The same `docker-compose
   up` runs on the Cape Town EC2 that ran on the Hetzner VPS. Operators
   don't have to learn a second deploy mental model. ECS task definitions
   would be a third.

3. **af-south-1 ECS Fargate has had intermittent gaps in supported
   features.** Cross-region parity has historically lagged in af-south-1;
   plain EC2 always works.

4. **Cost.** A t3.medium reserved instance + RDS db.t3.small + ALB +
   single-AZ NAT gateway lands around USD 90/month for staging. Fargate
   would land at ~USD 130 for equivalent throughput. Not the deciding
   factor, but it's a real number.

We DO accept these trade-offs:

- Single-instance ASG = one-AZ outage tolerance only via instance refresh,
  not seconds-to-failover. Documented in the runbook.
- Vertical scaling first; horizontal scaling means moving CouchDB to an
  external instance group. Tracked under "growth path" in the runbook.

If your install grows past ~50k patients, revisit ECS-on-EC2 or move CouchDB
to a dedicated multi-AZ stateful set. This baseline is for the 0-to-50k
range.

---

## Components

| Layer        | AWS service                | Notes                                                                  |
|--------------|----------------------------|------------------------------------------------------------------------|
| DNS          | Route 53                   | Global. Alias to ALB for `app.`, `www.`, `couch.<DomainName>`.         |
| TLS          | ACM (af-south-1)           | Cert provisioned in af-south-1, attached to the ALB. **Not us-east-1.**|
| Edge LB      | Application LB             | HTTPS-only listener; HTTP-to-HTTPS redirect; host-based routing to platform/website/couchdb target groups; idle timeout 60s. |
| Compute      | EC2 + ASG                  | t3.medium / t3.large; ASG of 1 (room to grow).                         |
| Container    | Docker Compose             | Embedded in the EC2 user-data. Services: platform, website, couchdb, sync-worker. |
| Analytics DB | RDS Postgres 16            | Private subnets only; encrypted at rest with KMS; daily automated snapshots. Downstream of `sync-worker` only — never the clinical write path. |
| Clinical DB  | CouchDB on EC2 EBS         | Directly attached gp3 EBS, encrypted with the default-account KMS key. Replication target for browser PouchDBs. |
| Sync bridge  | sync-worker container      | Polls CouchDB `_changes` every 5s and POSTs HMAC-signed batches to the platform's `/api/sync` route. State persisted to a named volume. See `sync-worker/README.md`. |
| Object store | S3 (separate account)      | Cross-account IAM. See `docs/operations/backups.md`.                   |
| Secrets      | Doppler + SSM Parameter Store | Doppler for runtime app secrets; SSM SecureString for boot-time secrets the EC2 needs (CouchDB password, webhook secret, Doppler token). |
| Logs         | CloudWatch (af-south-1)    | Container stdout shipped via the Docker awslogs driver.                |
| Audit        | CloudTrail (af-south-1)    | Trail enabled, log-file validation on, separate-account log bucket.    |
| Network      | VPC with 2 AZ (a, b)       | 2 public subnets (ALB), 2 private subnets (EC2 + RDS).                 |

### What is explicitly NOT here

- **CloudFront.** No public static asset CDN — the platform serves clinical
  data exclusively, and a CDN in front would require careful PHI scrubbing
  rules. Static assets ride the ALB. If marketing-only traffic grows, put
  CloudFront in front of `website` only, never `platform`.
- **WAF.** Recommended next step but not in this baseline (cost/operator
  complexity). Add `AWSManagedRulesCommonRuleSet` once an operator can
  triage false positives weekly.
- **NAT gateway redundancy.** Single-AZ NAT to keep cost down. Documented;
  add a second NAT before scaling to multi-instance ASG.
- **ECS / EKS.** See "Why EC2 + Docker Compose" above.
- **Public S3 buckets.** Forbidden. The CFN template enforces
  `BlockPublicAcls=true` on every bucket it creates.

---

## Pre-flight (do this BEFORE the first deploy)

The EC2 user-data fetches all runtime secrets from SSM Parameter Store at
boot. The CFN template intentionally does NOT carry these as CFN
parameters (they'd be visible in stack history and CloudTrail-noisy). They
must exist before the ASG launches its first instance — otherwise the
docker-compose `up` step will fail and the instance will recycle.

Required SSM parameters per environment (`<env>` is `staging` or `production`):

| Name                                                  | Type           | Notes                                                                |
|-------------------------------------------------------|----------------|----------------------------------------------------------------------|
| `/tamamhealth/<env>/DOPPLER_TOKEN`                    | `SecureString` | Doppler service token; fetched into the platform container at boot. |
| `/tamamhealth/<env>/COUCHDB_USER`                     | `String`       | CouchDB admin username (default `admin` if absent).                  |
| `/tamamhealth/<env>/COUCHDB_PASSWORD`                 | `SecureString` | CouchDB admin password. Min 16 chars. **Do not commit. Do not pass via CFN parameter.** |
| `/tamamhealth/<env>/COUCHDB_WEBHOOK_SECRET`           | `SecureString` | HMAC secret shared with the sync-worker. Min 32 chars.               |
| `/tamamhealth/<env>/DB_MASTER_PASSWORD`               | `SecureString` | RDS Postgres master password (when using `--db-password-from-ssm`).  |

Create them once with the AWS CLI:

```bash
ENV=staging
REGION=af-south-1

aws ssm put-parameter --region $REGION --type SecureString \
    --name /tamamhealth/$ENV/COUCHDB_PASSWORD \
    --value "$(openssl rand -base64 32)"

aws ssm put-parameter --region $REGION --type String \
    --name /tamamhealth/$ENV/COUCHDB_USER \
    --value admin

aws ssm put-parameter --region $REGION --type SecureString \
    --name /tamamhealth/$ENV/COUCHDB_WEBHOOK_SECRET \
    --value "$(openssl rand -hex 32)"
```

The same `COUCHDB_WEBHOOK_SECRET` must be set in Doppler under the
platform's runtime config — the platform's `/api/sync` route verifies the
HMAC against `process.env.COUCHDB_WEBHOOK_SECRET`. If they drift, every
sync POST will return 401.

The EC2 IAM role (`EC2InstanceRole`) is scoped to
`/tamamhealth/<env>/*` for `ssm:GetParameter` and carries `kms:Decrypt`
constrained via `kms:ViaService = ssm.<region>.amazonaws.com`. SecureString
parameters use the AWS-managed `aws/ssm` key by default; that condition
covers them. If you re-key any parameter to a customer-managed CMK, also
add that key's ARN to the policy.

### Route 53

Create three records (or one wildcard) pointing at the ALB:

| Record                  | Type              | Value                            |
|-------------------------|-------------------|----------------------------------|
| `<DomainName>`          | A (alias)         | `<ALBDnsName>` (CFN output)      |
| `app.<DomainName>`      | A (alias) or CNAME| same ALB                         |
| `www.<DomainName>`      | A (alias) or CNAME| same ALB → website target group  |
| `couch.<DomainName>`    | A (alias) or CNAME| same ALB → couchdb target group  |

The ALB's listener rules host-route the request to the right target group;
all three records resolve to the same ALB DNS name.

---

## Deploy

```bash
./infra/aws/scripts/deploy.sh \
    --env staging \
    --domain staging.tamamhealth.org \
    --acm-cert arn:aws:acm:af-south-1:111111111111:certificate/abc... \
    --instance-type t3.medium \
    --image-tag staging
```

The script wraps `aws cloudformation deploy` with parameter validation —
refuses to run if the ACM cert is in a non-af-south-1 region, refuses if the
domain doesn't end with a recognized brand suffix, etc. Read the script for
the full list.

---

## Cutover from the existing single-VPS deploy

See `infra/aws/scripts/cutover.md`. Highlights:

- Pre-warm CouchDB in af-south-1 from a live replication off the VPS.
- 30-minute blue-green window with DNS TTL pre-lowered to 60s.
- Rollback = flip Route 53 alias back; the VPS must stay up for 7 days post-
  cutover.

---

## Operator gotcha (read this twice)

**`af-south-1` is an opt-in region.** A fresh AWS account does not have
`af-south-1` enabled by default. Until an operator enables it via Account
Settings -> Regions, every CFN deploy will fail with `OptInRequired`,
EVERY ACM cert request 404s, every IAM action returns a confusing
`SubscriptionRequiredException`. Enable the region BEFORE running
`deploy.sh` for the first time, and verify with:

```bash
aws ec2 describe-regions --region af-south-1 \
    --query "Regions[?RegionName=='af-south-1'].OptInStatus"
```

The expected response is `"opted-in"`. If it returns `"not-opted-in"` or an
error, go to <https://console.aws.amazon.com/billing/home#/account/regions>
and enable af-south-1 explicitly. There's a 24-hour-ish lag before all
services are usable in a newly-opted-in region; don't run a real cutover on
the same day you enable it.
