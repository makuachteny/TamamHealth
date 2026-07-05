output "reserved_ip" {
  description = "Point GoDaddy A records (@ and www) at this IP."
  value       = digitalocean_reserved_ip.website.ip_address
}

output "droplet_ip" {
  description = "The droplet's own (non-reserved) public IP, for reference."
  value       = digitalocean_droplet.website.ipv4_address
}

output "registry_endpoint" {
  description = "Push the website image here: docker push <this>/website:latest"
  value       = "${digitalocean_container_registry.main.endpoint}/website:latest"
}

output "ssh_command" {
  value = "ssh root@${digitalocean_reserved_ip.website.ip_address}"
}
