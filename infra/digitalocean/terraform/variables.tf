variable "do_token" {
  description = "DigitalOcean API token. Prefer: export DIGITALOCEAN_TOKEN=..."
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DO region (e.g. fra1, blr1). No Africa region on DO."
  type        = string
  default     = "fra1"
}

variable "domain" {
  description = "Root domain for DNS (configure A records at your registrar)."
  type        = string
  default     = "tamamhealth.org"
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key (id_ed25519.pub)."
  type        = string
}

variable "admin_ssh_cidr" {
  description = "CIDR allowed to SSH (port 22). Use your public IP/32."
  type        = string
}

variable "project_name" {
  type    = string
  default = "tamamhealth"
}

variable "staging_size" {
  type    = string
  default = "s-2vcpu-4gb"
}

variable "production_size" {
  type    = string
  default = "s-4vcpu-8gb"
}
