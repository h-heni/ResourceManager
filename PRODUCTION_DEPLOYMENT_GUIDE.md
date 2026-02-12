# 🚀 ResourceManager - Production Deployment Guide

> Complete guide for deploying ResourceManager to a 2GB VPS with all infrastructure components.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [First Deployment](#first-deployment)
5. [Standard Deployment (CI/CD)](#standard-deployment-cicd)
6. [Blue-Green Deployment](#blue-green-deployment)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [Redis Cache](#redis-cache)
9. [Database Backups](#database-backups)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **VPS**: Ubuntu 22.04+ with 2GB RAM, 1-2 vCPUs, 20GB+ SSD
- **Docker**: Docker Engine 24+ with Docker Compose v2
- **GitHub**: Repository with Actions enabled
- **Domain** (optional): DNS A record pointing to VPS IP

## VPS Setup

### 1. Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### 2. Create Deploy User

```bash
# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Setup SSH key authentication
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
# Or add your public key manually:
# echo "ssh-rsa YOUR_PUBLIC_KEY" | sudo tee /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 3. Create Application Directory

```bash
sudo mkdir -p /opt/resourcemanager
sudo chown deploy:deploy /opt/resourcemanager
```

### 4. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 5. Swap Space (2GB VPS)

```bash
# Add 2GB swap for stability
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swap behavior for VPS
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## GitHub Secrets Configuration

Configure these in your repository: **Settings → Secrets and variables → Actions**

### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `VPS_HOST` | VPS IP address or hostname | `85.214.180.48` |
| `VPS_USER` | SSH username | `deploy` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### Optional Secrets

| Secret | Description | Default |
|--------|-------------|---------|
| `VPS_PORT` | SSH port | `22` |
| `GHCR_TOKEN` | GitHub PAT for GHCR pull on VPS | Auto via `GITHUB_TOKEN` |

> **Note:** `GITHUB_TOKEN` is automatically available for GHCR push in CI workflows.

### Generate SSH Key Pair

```bash
# Generate key pair (on your local machine)
ssh-keygen -t ed25519 -C "deploy@resourcemanager" -f ~/.ssh/rm_deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/rm_deploy.pub deploy@YOUR_VPS_IP

# The private key (~/.ssh/rm_deploy) goes into VPS_SSH_KEY secret
cat ~/.ssh/rm_deploy
```

## First Deployment

### 1. Prepare Environment File

On the VPS:

```bash
# Switch to deploy user
sudo su - deploy
cd /opt/resourcemanager

# Create .env from template
cat > .env << 'EOF'
# Database
POSTGRES_DB=resourcemanager
POSTGRES_USER=rmuser
POSTGRES_PASSWORD=$(openssl rand -base64 24)
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=$(openssl rand -base64 24)
REDIS_MAXMEMORY=96mb

# JWT
JWT_KEY=$(openssl rand -base64 48)
JWT_ISSUER=ResourceManager
JWT_AUDIENCE=ResourceManager-Users
JWT_EXPIRATION=60

# Docker Images (GHCR)
API_IMAGE=ghcr.io/h-heni/resourcemanager-api:latest
WEB_IMAGE=ghcr.io/h-heni/resourcemanager-web:latest

# Network
WEB_PORT=80

# CORS
CORS_ORIGIN_1=http://YOUR_VPS_IP
CORS_ORIGIN_2=http://YOUR_DOMAIN
EOF

# Generate actual random passwords
sed -i "s/\$(openssl rand -base64 24)/$(openssl rand -base64 24)/g" .env
sed -i "s/\$(openssl rand -base64 48)/$(openssl rand -base64 48)/g" .env
```

### 2. Login to GHCR

```bash
# Create a GitHub Personal Access Token with read:packages scope
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u h-heni --password-stdin
```

### 3. Deploy

```bash
# Copy compose files to VPS (or use CI/CD)
# Then start services
docker compose -f docker-compose.yml up -d

# Or with production overrides (includes nginx reverse proxy)
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose ps
docker stats --no-stream
```

## Standard Deployment (CI/CD)

### Automatic (on push to main)

The CI pipeline (`.github/workflows/ci.yml`) automatically:
1. Builds and tests backend (.NET) and frontend (React)
2. Builds Docker images and pushes to GHCR
3. Runs Trivy security scans
4. Triggers deployment placeholder

### Manual Deployment

Use the deploy workflow (`.github/workflows/deploy.yml`):
1. Go to **Actions → Deploy to VPS → Run workflow**
2. Select environment (production/staging)
3. Optionally specify a Docker image tag

The deploy workflow:
- SSHs into VPS
- Pulls latest images from GHCR
- Performs rolling update with health checks
- Rolls back automatically on health check failure

## Blue-Green Deployment

For zero-downtime deployments with instant rollback:

```bash
# Initial setup
docker compose -f docker-compose.blue-green.yml up -d postgres_db blue-api blue-web nginx

# Deploy to inactive environment
./scripts/deploy-blue-green.sh

# Rollback if needed
./scripts/rollback-blue-green.sh
```

See [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md) for full documentation.

## Nginx Reverse Proxy

The nginx container acts as the production entry point:

- Routes `/` → React frontend
- Routes `/api/` → .NET backend
- Rate limiting: 100 req/min API, 200 req/min general
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- Gzip compression for text/JSON responses
- HTTPS ready (uncomment SSL block in nginx.conf)

See [nginx/README.md](nginx/README.md) for configuration details.

## Redis Cache

Redis 7 Alpine is configured for distributed caching:

- **Memory**: 96MB max with LRU eviction
- **Persistence**: AOF enabled
- **Authentication**: Password required
- **Fallback**: API falls back to in-memory cache if Redis is unavailable

See [docs/REDIS_CACHING_GUIDE.md](docs/REDIS_CACHING_GUIDE.md) for caching patterns.

## Database Backups

Automated PostgreSQL backups with gzip compression:

```bash
# Manual backup
./scripts/pg-backup.sh

# Setup daily cron job
./scripts/setup-backup-cron.sh

# Restore from backup
./scripts/pg-restore.sh /path/to/backup.sql.gz
```

See [BACKUP_GUIDE.md](BACKUP_GUIDE.md) for full documentation.

## Monitoring

### Container Health

```bash
# All container status
docker compose ps

# Resource usage
docker stats --no-stream

# Logs
docker compose logs -f --tail=100
```

### Load Testing

```bash
cd load-testing
./setup.sh        # Install k6
./run-test.sh smoke   # Quick smoke test
./run-test.sh load    # Full load test
```

See [MONITORING_GUIDE.md](MONITORING_GUIDE.md) for comprehensive monitoring setup.

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose logs --tail=50

# Verify .env file
docker compose config

# Check port conflicts
sudo ss -tlnp | grep -E '80|443|5432|6379'
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Check OOM kills
dmesg | grep -i oom

# Reduce limits if needed
# Edit docker-compose.prod.yml memory limits
```

### Database Connection Issues

```bash
# Check PostgreSQL health
docker exec rm-postgres pg_isready -U rmuser -d resourcemanager

# Check connection string
docker exec rm-api env | grep CONNECTION
```

### Rollback

```bash
# Quick rollback to previous image
docker compose pull   # Pull previous tagged images
docker compose up -d --force-recreate

# Or use blue-green rollback
./scripts/rollback-blue-green.sh
```

## Resource Budget (2GB VPS)

| Component   | Memory Limit | Expected Usage |
|------------|-------------|----------------|
| PostgreSQL | 768M        | 200-400M       |
| API (.NET) | 1024M       | 200-500M       |
| Redis      | 192M        | 30-96M         |
| Nginx      | 128M        | 10-30M         |
| Web        | 128M        | 10-30M         |
| **Total**  | **~2200M**  | **~450-1050M** |
| OS/Kernel  | ~800M       | Reserved       |

## Related Documentation

- [CICD_GUIDE.md](CICD_GUIDE.md) — GitHub Actions CI/CD pipeline
- [SECRETS_GUIDE.md](SECRETS_GUIDE.md) — GitHub Secrets configuration
- [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md) — Blue-Green deployment
- [MONITORING_GUIDE.md](MONITORING_GUIDE.md) — Monitoring and alerting
- [BACKUP_GUIDE.md](BACKUP_GUIDE.md) — PostgreSQL backup automation
- [docs/REDIS_CACHING_GUIDE.md](docs/REDIS_CACHING_GUIDE.md) — Redis caching patterns
- [load-testing/README.md](load-testing/README.md) — k6 load testing
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — Command cheat sheet
