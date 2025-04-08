terraform {
  backend "s3" {
    bucket = "dik-terraform-state"
    key    = "apps/customer-files-organizer/terraform.tfstate"
    region = "fra1"
    endpoints = {
      s3 = "https://fra1.digitaloceanspaces.com"
    }

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.3.2"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.0.0"
    }
  }
}

locals {
  domain    = "innopeak.ch"
  subdomain = "organizrr"
  hostname  = "${local.subdomain}.${local.domain}"
  url       = "https://${local.hostname}"
  namespace = "customer-files-organizer"
  match_labels = {
    "app.kubernetes.io/component" = "frontend"
    "app.kubernetes.io/name"      = "customer-files-organizer"
    "app.kubernetes.io/part-of"   = "consulting"
  }
  labels = merge(local.match_labels, {
    "app.kubernetes.io/version"    = var.image_tag
    "app.kubernetes.io/managed-by" = "terraform"
  })
}

provider "random" {
}

provider "digitalocean" {
  token = var.do_token
}

data "digitalocean_kubernetes_cluster" "dikurium_kube_cluster" {
  name = var.dikurium_k8s_cluster_name_all
}

provider "kubernetes" {
  host  = data.digitalocean_kubernetes_cluster.dikurium_kube_cluster.endpoint
  token = data.digitalocean_kubernetes_cluster.dikurium_kube_cluster.kube_config[0].token
  cluster_ca_certificate = base64decode(
    data.digitalocean_kubernetes_cluster.dikurium_kube_cluster.kube_config[0].cluster_ca_certificate
  )
}

resource "kubernetes_namespace" "customer_files_organizer" {
  metadata {
    name = local.namespace
  }
}

resource "kubernetes_deployment" "customer_files_organizer" {
  metadata {
    name      = "customer-files-organizer"
    namespace = kubernetes_namespace.customer_files_organizer.metadata.0.name
  }
  spec {
    replicas = 1
    selector {
      match_labels = local.match_labels
    }
    template {
      metadata {
        labels = local.labels
        annotations = {
          "dikurium.ch/last-updated" = timestamp()
        }
      }
      spec {
        image_pull_secrets {
          name = kubernetes_secret.registry_auth.metadata.0.name
        }
        container {
          image             = "${var.registry}/${var.image_repository}:${var.image_tag}"
          name              = "customer-files-organizer"
          image_pull_policy = "Always"
          port {
            container_port = 3000
            name           = "http"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "customer_files_organizer" {
  metadata {
    name      = "customer-files-organizer"
    namespace = kubernetes_namespace.customer_files_organizer.metadata.0.name
  }
  spec {
    selector = local.match_labels
    type     = "ClusterIP"
    port {
      port        = 80
      target_port = "http"
    }
  }
}

resource "kubernetes_ingress_v1" "customer_files_organizer" {
  metadata {
    name      = "customer-files-organizer"
    namespace = kubernetes_namespace.customer_files_organizer.metadata.0.name
    annotations = {
      "cert-manager.io/cluster-issuer" = var.cluster_issuer_name
    }
  }
  spec {
    ingress_class_name = "nginx"

    rule {
      host = local.hostname
      http {
        path {
          backend {
            service {
              name = kubernetes_service.customer_files_organizer.metadata.0.name
              port {
                name = "http"
              }
            }
          }
          path      = "/"
          path_type = "Prefix"
        }
      }
    }

    tls {
      secret_name = "customer-files-organizer-tls"
      hosts       = [local.hostname]
    }
  }
  depends_on = [
    time_sleep.wait_for_dns_record
  ]
}

data "digitalocean_domain" "innopeak" {
  name = local.domain
}

data "digitalocean_loadbalancer" "nginx-ingress-controller" {
  name = "nginx-ingress-controller.service.dikurium.ch"
}

resource "digitalocean_record" "customer_files_organizer" {
  domain = data.digitalocean_domain.innopeak.id
  type   = "A"
  name   = local.subdomain
  value  = data.digitalocean_loadbalancer.nginx-ingress-controller.ip
}

resource "time_sleep" "wait_for_dns_record" {
  depends_on = [
    digitalocean_record.customer_files_organizer
  ]
  create_duration = "30s"
}

resource "kubernetes_secret" "registry_auth" {
  metadata {
    name      = "registry-auth"
    namespace = kubernetes_namespace.customer_files_organizer.metadata.0.name
  }

  data = {
    ".dockerconfigjson" = jsonencode({
      "auths" = {
        "${var.registry}" = {
          "auth" = base64encode("${var.registry_username}:${var.registry_password}")
        }
      },
      "credsStore"  = "",
      "credHelpers" = {}
    })
  }

  type = "kubernetes.io/dockerconfigjson"
}
