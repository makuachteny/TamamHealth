# Deploy on DigitalOcean

DigitalOcean-specific notes layered on top of the generic runbook
(`docs/STEP-BY-STEP-PLAYBOOK.md` / `docs/DEPLOYMENT-AND-ROLLOUT.md`). Use a
**Droplet** (a normal Ubuntu VM) — NOT App Platform, because the stack is a
docker-compose bundle with stateful CouchDB + a Caddy reverse proxy, which App
Platform doesn't host well.

---

## Audit status (today)
Build-ready: 0 TypeScript errors, 0 lint errors, no dead routes/links, no
conflict markers, key data-flow + sync-coverage + clinical-state-machine tests
pass (30/30). The final `next build` runs inside `deploy.sh` on the droplet.

---

## 1. Create the Droplet
DigitalOcean → **Create → Droplets**:
- **Image:** Ubuntu **22.04 (LTS) x64**.
- **Size (demo):** Basic → Regular, **4 GB / 2 vCPU** ($24/mo). Don't use 1–2 GB:
  the Next.js build can run out of memory (or add swap — see §6).
- **Size (production country node):** **8 GB / 4 vCPU+** ($48/mo) or larger.
- **Region:** DO has **no Africa region**. Nearest are **Frankfurt (FRA1)** or
  **Bangalore (BLR1)**.
  - **Demo (no real patient data):** any region is fine — pick FRA1.
  - **Real PHI / production:** DigitalOcean cannot host inside South Sudan, so it
    does **not** satisfy in-country data-residency. Use DO only for the demo;
    host the real country node in-country / on an MoH-approved host. (See
    `docs/AFRICA-HOSTING-STRATEGY.md`.)
- **Authentication:** add your **SSH key** (paste `~/.ssh/id_ed25519.pub`).
- Create, then copy the droplet's public IP.

## 2. Reserve a stable IP (recommended)
DO → **Networking → Reserved IPs** → assign one to the droplet. Point DNS at the
**Reserved IP** so you can rebuild/resize the droplet without changing GoDaddy
records.

## 3. DigitalOcean Cloud Firewall
DO → **Networking → Firewalls → Create**:
- **Inbound:** SSH `22` (ideally limited to your IP), HTTP `80`, HTTPS `443`.
- Everything else denied. Assign the firewall to the droplet.
- CouchDB (5984) / Postgres (5432) are already bound to `127.0.0.1` in
  `docker-compose.yml`, so they're never exposed — keep it that way (don't open
  those ports in the firewall).

## 4. GoDaddy DNS → the Reserved IP
Add three **A** records (delete GoDaddy's parked `@` record first):

| Type | Name | Value |
|---|---|---|
| A | `@` | your Reserved IP |
| A | `app` | your Reserved IP |
| A | `couch` | your Reserved IP |

Verify: `dig +short app.tamamhealth.org` returns the IP.

## 5. Deploy (same as the playbook)
SSH in and run the standard flow:
```bash
ssh root@<reserved-ip>
apt-get update -y && apt-get install -y git
git clone https://github.com/<you>/tamamhealth.git /opt/tamamhealth
cd /opt/tamamhealth
./scripts/gen-secrets.sh
sed -i 's/REPLACE-DOMAIN/tamamhealth.org/g' platform/.env.production website/.env.production
sed -i 's#^NEXT_PUBLIC_COUCHDB_URL=.*#NEXT_PUBLIC_COUCHDB_URL=https://couch.tamamhealth.org#' platform/.env.production
sed -i 's#^NEXT_PUBLIC_DEMO_MODE=.*#NEXT_PUBLIC_DEMO_MODE=true#' platform/.env.production   # demo
./scripts/preflight.sh
sudo bash deploy.sh
```
Caddy auto-issues TLS for the three domains. Verify at https://app.tamamhealth.org.

## 6. Build memory (if you chose a small droplet)
If `next build` is killed (OOM) on a 2 GB droplet, add swap once:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
Then re-run `sudo bash deploy.sh`. (Or just use a 4 GB droplet.)

## 7. Production country node on DO — extra steps (real PHI)
Only if you accept DO as the host (residency caveat above):
- Attach a **Block Storage Volume**, LUKS-encrypt it, mount at
  `/opt/tamamhealth-data`, and point Docker's data-root there (so PHI lands on
  the encrypted volume) — see `docs/DEPLOYMENT-AND-ROLLOUT.md` §B3/B5.
- Enable **DO weekly Droplet backups** AND ship the nightly CouchDB dump offsite
  (encrypted) — DO Spaces in the same region works as the offsite target.
- Set `NEXT_PUBLIC_DEMO_MODE=false` (clean slate).

---

### DO product cheat-sheet
- **Droplet** = the server (use this).
- **Reserved IP** = stable address for DNS.
- **Cloud Firewall** = network allowlist (22/80/443).
- **Block Storage Volume** = the encrypted data disk for production PHI.
- **Spaces** = S3-compatible object storage for offsite encrypted backups.
- **App Platform** = not used (doesn't fit the docker-compose + CouchDB stack).
