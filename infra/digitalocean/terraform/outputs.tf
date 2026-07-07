output "staging_reserved_ip" {
  value       = digitalocean_reserved_ip.staging.ip_address
  description = "A records: app.staging.<domain>, couch.staging.<domain>"
}

output "production_reserved_ip" {
  value       = digitalocean_reserved_ip.production.ip_address
  description = "A records: @, app, couch, www"
}

output "dns_records_staging" {
  value = {
    "app.staging.${var.domain}"   = digitalocean_reserved_ip.staging.ip_address
    "couch.staging.${var.domain}" = digitalocean_reserved_ip.staging.ip_address
  }
}

output "dns_records_production" {
  value = {
    "${var.domain}"       = digitalocean_reserved_ip.production.ip_address
    "app.${var.domain}"   = digitalocean_reserved_ip.production.ip_address
    "couch.${var.domain}" = digitalocean_reserved_ip.production.ip_address
    "www.${var.domain}"   = digitalocean_reserved_ip.production.ip_address
  }
}

output "deploy_staging" {
  value = "../../scripts/do-ssh-deploy.sh --host ${digitalocean_reserved_ip.staging.ip_address} --env staging --domain ${var.domain}"
}

output "deploy_production" {
  value = "../../scripts/do-ssh-deploy.sh --host ${digitalocean_reserved_ip.production.ip_address} --env production --domain ${var.domain}"
}
