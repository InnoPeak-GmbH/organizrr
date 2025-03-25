variable "do_token" {
  description = "DigitalOcean API Access Token"
  type        = string
  sensitive   = true
}

variable "dikurium_k8s_cluster_name_all" {
  description = "The name of the Dikurium main Kubernetes cluster"
  default     = "k8s-dik-all"
  type        = string
}

variable "cluster_issuer_name" {
  description = "Name of the ClusterIssuer Kubernetes resource."
  type        = string
  sensitive   = true
}

variable "registry" {
  description = "Registry to fetch advisement tool image from"
  type        = string
}

variable "image_repository" {
  description = "Repository for advisement tool image"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag for advisement tool"
  type        = string
}

variable "registry_username" {
  description = "Username to access registry"
  type        = string
}

variable "registry_password" {
  description = "Password to access registry"
  type        = string
  sensitive   = true
}
