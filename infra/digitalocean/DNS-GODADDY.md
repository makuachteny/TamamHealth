# GoDaddy DNS for TamamHealth on DigitalOcean

Domain **tamamhealth.org** uses GoDaddy nameservers (`ns45.domaincontrol.com`).
Records must be added in **GoDaddy → My Products → tamamhealth.org → DNS**.

## Staging (do this first)

Add these **A** records. In the **Name** column, enter only the left part (GoDaddy appends `.tamamhealth.org`).

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `app.staging` | `146.190.179.153` | 600 |
| A | `couch.staging` | `146.190.179.153` | 600 |
| A | `staging` | `146.190.179.153` | 600 |
| A | `www.staging` | `146.190.179.153` | 600 |

**Do not** enter the full hostname `app.staging.tamamhealth.org` in the Name field — use `app.staging` only.

## Production (when ready)

Replace or remove old `@` records that point at AWS (`13.248.243.5`, etc.).

| Type | Name | Value |
|------|------|-------|
| A | `@` | `138.68.124.30` |
| A | `www` | `138.68.124.30` |
| A | `app` | `138.68.124.30` |
| A | `couch` | `138.68.124.30` |

## Verify

Wait 5–15 minutes, then:

```bash
./scripts/check-deploy-dns.sh
dig +short app.staging.tamamhealth.org   # should print 146.190.179.153
```

Caddy on the droplet will auto-issue Let's Encrypt certs once DNS resolves publicly (may take a few minutes after DNS propagates). **Then remove `tls internal` from the staging Caddyfile** (see deploy.sh / re-run bootstrap) so browsers get a trusted cert.

## After GoDaddy DNS is live — revert temporary TLS

SSH to staging and remove the `tls internal` lines from `/etc/caddy/Caddyfile`, then:

```bash
systemctl reload caddy
```

## Test before DNS (SSH tunnel)

```bash
ssh -L 3000:127.0.0.1:3000 root@146.190.179.153
# Open http://localhost:3000/login in your browser
```
