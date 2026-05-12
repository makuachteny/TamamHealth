# Cutover — single-VPS to AWS af-south-1

> **Audience:** TamamHealth platform operator running the migration.
> **Estimated window:** 90 minutes total, 30 minutes of which is user-visible
> read-only mode.
> **PHI residency:** every step below stays in `af-south-1`. The CouchDB
> replication target is created in af-south-1 BEFORE any data leaves the VPS.

---

## Pre-flight (run this 7 days before cutover)

1. **Enable af-south-1 on the AWS account.** It's an opt-in region; allow up
   to 24h for full service availability. Confirm with:

   ```bash
   aws ec2 describe-regions --region af-south-1 \
       --query "Regions[?RegionName=='af-south-1'].OptInStatus"
   # Expected: "opted-in"
   ```

2. **Seed SSM Parameter Store with the secrets the EC2 boots with.** The CFN
   template fetches all of these at user-data time; the ASG cannot stand up
   the docker-compose stack without them.

   ```bash
   ENV=production
   REGION=af-south-1

   aws ssm put-parameter --region $REGION --type SecureString \
       --name /tamamhealth/$ENV/DOPPLER_TOKEN \
       --value "$DOPPLER_TOKEN"

   aws ssm put-parameter --region $REGION --type String \
       --name /tamamhealth/$ENV/COUCHDB_USER \
       --value admin

   aws ssm put-parameter --region $REGION --type SecureString \
       --name /tamamhealth/$ENV/COUCHDB_PASSWORD \
       --value "$(openssl rand -base64 32)"

   # Same value also goes into Doppler under COUCHDB_WEBHOOK_SECRET so the
   # platform's /api/sync route verifier matches the sync-worker signer.
   WEBHOOK_SECRET="$(openssl rand -hex 32)"
   aws ssm put-parameter --region $REGION --type SecureString \
       --name /tamamhealth/$ENV/COUCHDB_WEBHOOK_SECRET \
       --value "$WEBHOOK_SECRET"
   doppler secrets set COUCHDB_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
       --project tamamhealth --config prd
   ```

   **Verify** by listing them (without --with-decryption, so values stay masked):

   ```bash
   aws ssm describe-parameters --region $REGION \
       --filters "Key=Name,Option=BeginsWith,Values=/tamamhealth/$ENV/" \
       --query 'Parameters[].Name'
   ```

   Must return all four. The CouchDB ones can be missing for legacy stacks
   that don't run the sync-worker, but the wired-in CFN template requires
   them.

3. **Provision the AWS stack** (does not affect production yet):

   ```bash
   ./infra/aws/scripts/deploy.sh \
       --env production \
       --domain app.tamamhealth.org \
       --acm-cert arn:aws:acm:af-south-1:111111111111:certificate/XXX \
       --instance-type t3.large \
       --image-tag production \
       --keypair tamamhealth-prod \
       --db-password-from-ssm
   ```

4. **Lower the DNS TTL** on `app.tamamhealth.org` and `couch.tamamhealth.org`
   from the default (often 3600s) to **60s**. This must happen at least 24h
   before the cutover so existing resolvers honor the short TTL on the day.

5. **Doppler — point the prod config at the new endpoints (in advance).**
   Add `DATABASE_URL_AWS` (the new RDS Postgres URL) as a separate key. Do
   NOT yet swap `DATABASE_URL` — we'll do that during the window.

6. **Generate the GPG backup keypair** (if not already done) and place the
   pubkey on the new EC2 host at `/etc/tamamhealth/backup-pubkey.gpg`. See
   `docs/operations/backups.md`.

7. **Dry-run the restore drill** against an existing snapshot:

   ```bash
   ./scripts/backup-restore-drill.sh
   ```

   Must report `DRILL PASS` before you proceed.

8. **Schedule the cutover window** with the clinical team. Aim for the lowest
   patient-arrival hour — typically 22:00 EAT on a weekday.

---

## Cutover sequence

### T-30: read-only mode on

On the VPS:

```bash
ssh root@vps.legacy
cd /opt/tamamhealth
docker compose exec platform sh -c 'touch /tmp/READ_ONLY'
```

(The platform's middleware honors this file by returning 503 for every
non-GET; if not yet wired, achieve the same by stopping the platform service
while leaving CouchDB up so replication continues.)

### T-25: seed CouchDB on AWS via live replication

From the AWS host:

```bash
ssh -i ~/.ssh/aws-prod.pem ec2-user@<aws-ec2-ip>
cd /opt/tamamhealth
sudo docker compose exec couchdb sh -c '
  for db in $(curl -s -u admin:$COUCHDB_PASSWORD https://couch.tamamhealth.org/_all_dbs | jq -r ".[] | select(startswith(\"tamamhealth_\"))"); do
    curl -X PUT -u admin:$COUCHDB_PASSWORD "http://localhost:5984/$db"
    curl -X POST -u admin:$COUCHDB_PASSWORD -H "Content-Type: application/json" \
      http://localhost:5984/_replicator -d "{
        \"source\": \"https://admin:$VPS_COUCH_PASSWORD@couch.tamamhealth.org/$db\",
        \"target\": \"http://admin:$COUCHDB_PASSWORD@localhost:5984/$db\",
        \"create_target\": false,
        \"continuous\": false
      }"
  done
'
```

Wait for replication to settle. Verify document counts match:

```bash
# On VPS:
for db in $(curl -s -u admin:$COUCHDB_PASSWORD http://localhost:5984/_all_dbs | jq -r '.[] | select(startswith("tamamhealth_"))'); do
  echo "$db: $(curl -s -u admin:$COUCHDB_PASSWORD http://localhost:5984/$db | jq .doc_count)"
done

# Same loop on AWS — counts must match exactly.
```

### T-15: seed Postgres on RDS

If using analytics Postgres:

```bash
# On VPS:
pg_dump --format=custom --no-owner --no-acl \
        --file /tmp/pg-cutover.dump "$DATABASE_URL"

# Copy to AWS host:
scp /tmp/pg-cutover.dump ec2-user@<aws-ec2-ip>:/tmp/

# On AWS:
pg_restore --no-owner --no-acl --clean --if-exists \
           --dbname "$DATABASE_URL_AWS" /tmp/pg-cutover.dump
```

### T-5: flip DATABASE_URL in Doppler

```bash
doppler secrets set DATABASE_URL="$DATABASE_URL_AWS" --project tamamhealth --config prd
```

The platform on AWS picks this up on next boot (or on docker compose restart).

### T-0: DNS swap

Update Route 53:

```bash
aws route53 change-resource-record-sets \
    --hosted-zone-id ZXXXXXXX \
    --change-batch file://route53-cutover.json
```

`route53-cutover.json`:

```json
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "app.tamamhealth.org.",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "<ALBHostedZoneId from CFN output>",
        "DNSName": "<ALBDnsName from CFN output>",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
```

With TTL pre-lowered to 60s, propagation completes within ~2 minutes for most
clients.

### T+5: smoke checks

```bash
curl -sI https://app.tamamhealth.org/ | head -1            # 200 or 302
curl -sI https://app.tamamhealth.org/api/health | head -1  # 200
```

Log in via the UI on a separate device. Walk through:

- patient list loads,
- create a test encounter,
- billing report loads,
- audit log shows the test encounter.

### T+15: read-only off

If everything passes, exit read-only mode by removing the `/tmp/READ_ONLY`
flag (or starting the platform back up if you did the stop-version).

The VPS platform stays stopped; CouchDB stays up but no one talks to it.

---

## Rollback

If anything fails before T+15:

1. **Revert Route 53** — same UPSERT but with the old VPS A-record value.
   With 60s TTL, traffic is back on the VPS within 2 minutes.

2. **Revert Doppler** — flip `DATABASE_URL` back to the VPS Postgres value.

3. **Restart VPS platform** — `docker compose up -d platform` on the VPS.

4. **Reverse the CouchDB replication** — any writes that happened on AWS
   between T-30 and rollback need to flow BACK. From the VPS:

   ```bash
   for db in tamamhealth_*; do
     curl -X POST -u admin:$VPS_PASS -H 'Content-Type: application/json' \
       http://localhost:5984/_replicator -d "{
         \"source\": \"https://admin:$AWS_PASS@app.tamamhealth.org/couch/$db\",
         \"target\": \"http://admin:$VPS_PASS@localhost:5984/$db\",
         \"create_target\": false,
         \"continuous\": false
       }"
   done
   ```

5. Take a deep breath. Schedule a post-mortem. Try again next week with the
   missing piece fixed.

---

## Post-cutover (first 7 days)

- **Keep the VPS up and patched** for 7 days. If something subtle breaks at
  the AWS end, the VPS is still a viable rollback target.
- **Monitor CloudWatch** logs and ALB target health hourly for the first 24h.
- **Run `./scripts/backup-couchdb.sh` manually** the first day to make sure
  the EC2 host's IAM + GPG pubkey + bucket are all correctly wired before
  trusting the systemd timer.
- **Day 7:** stop the VPS. Day 30: terminate. Take a final encrypted
  snapshot of its CouchDB data dir before terminate, just in case.

---

## Operator gotcha (read this twice)

**The ACM cert MUST be in `af-south-1`, not `us-east-1`.** The reflex from
prior CloudFront work is to provision certs in us-east-1 because that's
where CloudFront wants them — but this baseline does NOT use CloudFront, and
ALB requires the cert in the same region as the load balancer. If you put
the cert in us-east-1 the CFN deploy will fail at the listener attach step
with `CertificateArn cannot be found`. The error message does not mention
"region", so operators chase IAM permissions for an hour before realizing
the cert is in the wrong region. Confirm with:

```bash
aws acm list-certificates --region af-south-1 --query "CertificateSummaryList[*].DomainName"
```

The hostname you're cutting over to MUST appear in this list before you run
the deploy script. The wrapper script also enforces this — it parses the
region out of the cert ARN and refuses to deploy if they mismatch.
