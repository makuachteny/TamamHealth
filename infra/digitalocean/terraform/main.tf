resource "digitalocean_ssh_key" "deploy" {
  name       = "${var.project_name}-deploy"
  public_key = var.ssh_public_key
}

resource "digitalocean_droplet" "staging" {
  name     = "${var.project_name}-staging"
  region   = var.region
  size     = var.staging_size
  image    = "ubuntu-22-04-x64"
  ssh_keys = [digitalocean_ssh_key.deploy.fingerprint]
  tags     = ["tamamhealth", "staging"]
}

resource "digitalocean_reserved_ip" "staging" {
  region = digitalocean_droplet.staging.region
}

resource "digitalocean_reserved_ip_assignment" "staging" {
  ip_address = digitalocean_reserved_ip.staging.ip_address
  droplet_id = digitalocean_droplet.staging.id
}

resource "digitalocean_firewall" "staging" {
  name        = "${var.project_name}-staging"
  droplet_ids = [digitalocean_droplet.staging.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.admin_ssh_cidr]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_droplet" "production" {
  name     = "${var.project_name}-production"
  region   = var.region
  size     = var.production_size
  image    = "ubuntu-22-04-x64"
  ssh_keys = [digitalocean_ssh_key.deploy.fingerprint]
  tags     = ["tamamhealth", "production"]
}

resource "digitalocean_reserved_ip" "production" {
  region = digitalocean_droplet.production.region
}

resource "digitalocean_reserved_ip_assignment" "production" {
  ip_address = digitalocean_reserved_ip.production.ip_address
  droplet_id = digitalocean_droplet.production.id
}

resource "digitalocean_firewall" "production" {
  name        = "${var.project_name}-production"
  droplet_ids = [digitalocean_droplet.production.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.admin_ssh_cidr]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
