# TamamHealth website — DigitalOcean

Terraform for the marketing website (`website/`) only — not the full
platform stack. Provisions:

- A Droplet (Ubuntu 22.04) running the website container behind Caddy
  (automatic Let's Encrypt TLS).
- A Cloud Firewall (22/80/443 only).
- A Reserved IP (stable — survives droplet rebuilds).
- A DigitalOcean Container Registry (`starter` tier, free) to hold the
  built website image.

See `docs/DEPLOY-DIGITALOCEAN.md` at the repo root for the equivalent
full-stack (platform + website + CouchDB) playbook this was adapted from.

## Usage

```bash
export TF_VAR_do_token="dop_v1_..."   # never commit this

terraform init
terraform apply
```

After apply, build and push the website image to the registry it created:

```bash
doctl registry login   # or: docker login registry.digitalocean.com -u <token> -p <token>
docker build -t $(terraform output -raw registry_endpoint) ../../website
docker push $(terraform output -raw registry_endpoint)
```

The droplet's `website.service` systemd unit retries the pull automatically,
so it comes up within ~10s of the push landing.

Then point GoDaddy DNS at the reserved IP:

| Type | Name | Value |
|---|---|---|
| A | `@` | `terraform output -raw reserved_ip` |
| A | `www` | `terraform output -raw reserved_ip` |

## Known tradeoff

The DO API token is embedded in the droplet's cloud-init user-data to
authenticate `docker login` to the registry. It's only visible to someone
with API/console access to this same DO account, but a production hardening
step would be to swap it for a registry-scoped read-only token instead of
the full read+write token Terraform itself needs.
