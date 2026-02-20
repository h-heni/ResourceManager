# ResourceManager - Production Deployment Guide

## Overview

Deploy ResourceManager to a **2GB RAM / 80GB Ubuntu VPS** using Docker and Blue-Green deployment with automated GitHub Actions.

**What happens when you push to `main`:**

```
git push origin main
    │
    ▼
GitHub Actions automatically:
    1. Builds & tests backend (.NET 8)
    2. Builds & lints frontend (React + Vite)
    3. Builds Docker images → pushes to GHCR
    4. SSHs into your VPS
    5. Runs deploy-blue-green.sh:
       - Stops old environment (frees RAM)
       - Starts new environment
       - API applies DB migrations at startup
       - Health checks pass → switches Nginx
       - Fails → auto-rollback to previous version
    6. ~10-15 seconds downtime per deploy
```

---

## Table of Contents

1. [VPS Requirements](#vps-requirements)
2. [Step 1: VPS Initial Setup](#step-1-vps-initial-setup)
3. [Step 2: Create .env File (REQUIRED)](#step-2-create-env-file-required)
4. [Step 3: GitHub Secrets (REQUIRED)](#step-3-github-secrets-required)
5. [Step 4: First Deployment](#step-4-first-deployment)
6. [Step 5: Verify](#step-5-verify)
7. [Database Migrations](#database-migrations)
8. [Daily Operations](#daily-operations)
9. [Troubleshooting](#troubleshooting)

---

## VPS Requirements

| Resource | Your VPS | Minimum |
|----------|----------|---------|
| **OS** | Ubuntu 20.04+ | Ubuntu 20.04+ or Debian 11+ |
| **RAM** | 2GB | 2GB |
| **Storage** | 80GB | 20GB |
| **Docker** | — | 20.10+ |
| **Docker Compose** | — | 2.0+ |

### Memory Budget (2GB)

| Service | Reserved | Limit | Notes |
|---------|----------|-------|-------|
| PostgreSQL | 256MB | 512MB | Database |
| Redis | 64MB | 128MB | Cache (LRU eviction) |
| API (.NET 8) | 256MB | 512MB | Workstation GC, conserve memory |
| Web (Nginx) | 32MB | 64MB | Static files |
| Nginx Proxy | 32MB | 64MB | Reverse proxy + routing |
| **System/OS** | — | ~500MB | Kernel, buffers, SSH |
| **Total** | ~640MB | ~1.3GB | ~700MB headroom |

> **Note:** Only ONE environment (blue OR green) runs at a time. During deployment the old one stops before the new one starts.

---

## Step 1: VPS Initial Setup

SSH into your VPS and run these commands **once**:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# 3. Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# 4. Verify
docker --version          # Must be 20.10+
docker compose version    # Must be 2.0+

# 5. Create deployment directory
sudo mkdir -p /opt/resourcemanager
sudo chown $USER:$USER /opt/resourcemanager

# 6. Create nginx config directory
mkdir -p /opt/resourcemanager/nginx
mkdir -p /opt/resourcemanager/scripts

# 7. Set up firewall
sudo apt install ufw -y
sudo ufw allow 22/tcp     # SSH (do this FIRST!)
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS (future)
sudo ufw enable

# 8. Set up swap (safety net for 2GB VPS)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 2: Create .env File (REQUIRED)

On the VPS, create the `.env` file. **This is the only manual configuration needed.**

```bash
cd /opt/resourcemanager
nano .env
```

Copy this template and **replace every value marked with `CHANGE_THIS`**:

```bash
# ═══════════════════════════════════════════════
# ResourceManager — Production Environment
# ═══════════════════════════════════════════════
# This file contains ALL secrets and configuration.
# NEVER commit this file to Git.
# ═══════════════════════════════════════════════

# ── Database ──
POSTGRES_DB=resourcemanager
POSTGRES_USER=rmuser
POSTGRES_PASSWORD=3/KYABIxp8FQ4ZEC5ToK2XoepOPmT1sX

# ── Redis Cache ──
REDIS_PASSWORD=u1qowRT+W3CugxkSXVMZ9Fy25MyfVCVG

# ── JWT Authentication ──
JWT_KEY=w3wiOReUSFzZhxvfBfMV8Cn+6AfqqYZLFmsY7pvu85eHk3SfW8S+R4SK1fGbNCNv
JWT_ISSUER=ResourceManager
JWT_AUDIENCE=ResourceManager-Users
JWT_EXPIRATION=60

# ── Docker Images (auto-updated by GitHub Actions) ──
API_IMAGE=ghcr.io/h-heni/resourcemanager-api:latest
WEB_IMAGE=ghcr.io/h-heni/resourcemanager-web:latest

# ── Blue-Green Switch (managed by deploy script — DO NOT EDIT) ──
ACTIVE_ENV=blue

# ── Ports ──
WEB_PORT=80

# ── CORS (set to your VPS IP or domain) ──
CORS_ORIGIN_1=http://YOUR_VPS_IP        # e.g. http://85.214.180.48
CORS_ORIGIN_2=http://YOUR_DOMAIN        # e.g. http://resourcemanager.com

# ── Google Integration (optional — for sending invoice emails via Gmail) ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=



### Generate Secrets

Run these commands on your VPS and paste the output into .env:

```bash
# Generate POSTGRES_PASSWORD
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"

# Generate REDIS_PASSWORD
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"

# Generate JWT_KEY (must be 32+ chars)
echo "JWT_KEY=$(openssl rand -base64 48)"
```

### Lock the file

```bash
chmod 600 /opt/resourcemanager/.env
```

---

## Step 3: GitHub Secrets (REQUIRED)

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add these 3 secrets:

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `VPS_HOST` | `85.214.180.48` | Your VPS IP address |
| `VPS_USER` | `root` or `deploy` | Your SSH username |
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | See below |

### Generate SSH Key for GitHub Actions

On your **local machine**:

```bash
# Generate a key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Display the PRIVATE key (paste this into GitHub secret SSH_PRIVATE_KEY)
cat ~/.ssh/github_deploy

# Display the PUBLIC key (add this to VPS)
cat ~/.ssh/github_deploy.pub
```

On your **VPS**:

```bash
# Add the public key to authorized_keys
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Optional: GitHub Variable

Go to **Settings** → **Variables** → **Actions** → **New repository variable**:

| Variable Name | Value | Default |
|---------------|-------|---------|
| `DEPLOY_PATH` | `/opt/resourcemanager` | `/opt/resourcemanager` |

### Optional: GitHub Environment

Go to **Settings** → **Environments** → **New environment** → name it `production`.
You can add protection rules here (e.g. require approval before deploy).

---

## Step 4: First Deployment

### Option A: Automatic (recommended)

Just push to main:

```bash
git add .
git commit -m "Production deployment"
git push origin main
```

GitHub Actions will:
1. Build & test
2. Build Docker images → push to GHCR
3. SSH into VPS → copy files → run deploy script
4. Start PostgreSQL + Redis + Blue API + Blue Web + Nginx
5. Apply database migrations at API startup
6. Health check → switch Nginx → done

### Option B: Manual First-Time Setup

If you want to do the very first deploy manually on the VPS:

```bash
cd /opt/resourcemanager

# Login to GitHub Container Registry
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull images
docker compose -f docker-compose.blue-green.yml pull

# Start everything (Blue environment)
docker compose -f docker-compose.blue-green.yml up -d postgres_db redis
sleep 15  # Wait for DB to be ready

docker compose -f docker-compose.blue-green.yml up -d blue-api blue-web
sleep 30  # Wait for API startup + migrations

docker compose -f docker-compose.blue-green.yml up -d nginx
sleep 5

# Verify
curl http://localhost/health
curl http://localhost/api/health
```

---

## Step 5: Verify

### From VPS

```bash
# Container status
docker compose -f docker-compose.blue-green.yml ps

# Health checks
curl http://localhost/health
curl http://localhost/api/health

# Resource usage
docker stats --no-stream

# Logs
docker compose -f docker-compose.blue-green.yml logs blue-api --tail=50
docker compose -f docker-compose.blue-green.yml logs blue-web --tail=20
```

### From Browser

Open `http://YOUR_VPS_IP` — you should see the ResourceManager login page.

Test account: `AHT@gmail.com` / `AHT@gmail.com`

---

## Database Migrations

### How It Works

**Migrations are automatic.** The .NET API applies pending EF Core migrations every time it starts:

```
API starts → checks pending migrations → applies them → serves traffic
```

### Development Workflow

1. **Make schema changes** in your local dev environment:
   ```bash
   # After modifying models/DbContext
   dotnet ef migrations add YourMigrationName
   dotnet ef database update     # Test locally
   ```

2. **Push to main**:
   ```bash
   git add .
   git commit -m "Add new field to Invoice"
   git push origin main
   ```

3. **GitHub Actions deploys** → new API starts → applies migration automatically.

### Migration Safety Rules

| Safe (no downtime risk) | Unsafe (needs care) |
|------------------------|---------------------|
| Add new table | Drop column |
| Add new column with default | Rename table |
| Add index | Change column type |
| Add nullable column | Remove constraint |

For **unsafe** migrations, deploy in two steps:
1. First deploy: add new column (backward compatible)
2. Second deploy: remove old column after code no longer uses it

### Manual Migration (emergency)

```bash
# SSH into VPS, run migration manually
docker compose -f docker-compose.blue-green.yml exec blue-api \
  dotnet ef database update
```

---

## Daily Operations

### Check Status

```bash
docker compose -f docker-compose.blue-green.yml ps
docker stats --no-stream
```

### View Logs

```bash
# API logs (replace blue with green if green is active)
docker compose -f docker-compose.blue-green.yml logs blue-api --tail=100 -f

# All logs
docker compose -f docker-compose.blue-green.yml logs -f
```

### Manual Deploy

```bash
cd /opt/resourcemanager
./scripts/deploy-blue-green.sh
```

### Rollback

```bash
cd /opt/resourcemanager
./scripts/rollback-blue-green.sh
```

### Disk Cleanup

```bash
# Check disk usage
df -h
docker system df

# Clean old images
docker image prune -a -f --filter "until=72h"

# Full cleanup (careful)
docker system prune -a --volumes
```

### Backup Database

```bash
# pg_dump (recommended)
docker compose -f docker-compose.blue-green.yml exec -T postgres_db \
  pg_dump -U rmuser -d resourcemanager | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260213.sql.gz | docker compose -f docker-compose.blue-green.yml exec -T postgres_db \
  psql -U rmuser -d resourcemanager
```

---

## Complete Pipeline Summary

```
Developer pushes to main
         │
         ▼
┌─ GitHub Actions ─────────────────────────────────┐
│  1. backend job:   dotnet build + test            │
│  2. frontend job:  npm lint + tsc + build         │
│  3. docker job:    build images → push to GHCR    │
│  4. deploy job:    SCP files → SSH → deploy.sh    │
│  5. rollback job:  auto if deploy fails           │
└──────────────────────────────────────────────────┘
         │
         ▼ (SSH into VPS)
┌─ deploy-blue-green.sh ──────────────────────────┐
│  1. Pull new images                              │
│  2. Check PostgreSQL is healthy                  │
│  3. Stop old environment (free RAM)              │
│  4. Start new environment                        │
│  5. Wait for health (API applies migrations)     │
│  6. Switch Nginx upstream                        │
│  7. Cleanup old containers + images              │
│                                                  │
│  On failure: auto-rollback to previous env       │
└──────────────────────────────────────────────────┘
```

---

## .env Quick Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `POSTGRES_PASSWORD` | **YES** | `xR3mK8pL2tN...` | `openssl rand -base64 24` |
| `REDIS_PASSWORD` | **YES** | `bF1dH5gV0q...` | `openssl rand -base64 24` |
| `JWT_KEY` | **YES** | `vK8zP3mN9xL4...` | `openssl rand -base64 48` (32+ chars) |
| `JWT_ISSUER` | no | `ResourceManager` | Default is fine |
| `JWT_AUDIENCE` | no | `ResourceManager-Users` | Default is fine |
| `JWT_EXPIRATION` | no | `60` | Minutes |
| `POSTGRES_DB` | no | `resourcemanager` | Default is fine |
| `POSTGRES_USER` | no | `rmuser` | Default is fine |
| `API_IMAGE` | auto | `ghcr.io/.../api:latest` | Set by GitHub Actions |
| `WEB_IMAGE` | auto | `ghcr.io/.../web:latest` | Set by GitHub Actions |
| `ACTIVE_ENV` | auto | `blue` | Set by deploy script |
| `WEB_PORT` | no | `80` | Change if 80 is taken |
| `CORS_ORIGIN_1` | **YES** | `http://85.214.180.48` | Your VPS IP |
| `CORS_ORIGIN_2` | no | `http://rscmanager.com` | Your domain |
| `SUPABASE_URL` | no | `https://x.supabase.co` | For file storage |
| `SUPABASE_KEY` | no | `eyJhbGci...` | For file storage |

---

## GitHub Secrets Quick Reference

| Secret | Required | Value |
|--------|----------|-------|
| `VPS_HOST` | **YES** | Your VPS IP (e.g. `85.214.180.48`) |
| `VPS_USER` | **YES** | SSH username (e.g. `root` or `deploy`) |
| `SSH_PRIVATE_KEY` | **YES** | Full private key (starts with `-----BEGIN`) |

These are the ONLY 3 secrets needed. Everything else is in the `.env` file on the VPS.

---

## Troubleshooting

### API won't start

```bash
docker compose -f docker-compose.blue-green.yml logs blue-api --tail=50
```

Common causes:
- Missing `JWT_KEY` in .env → add it
- Wrong `POSTGRES_PASSWORD` → ensure same in .env
- Migration error → check logs for SQL errors

### Can't access website

```bash
# Check containers
docker compose -f docker-compose.blue-green.yml ps

# Check nginx
docker exec nginx nginx -t

# Check firewall
sudo ufw status

# Check what's on port 80
sudo ss -tlnp | grep :80
```

### Out of memory

```bash
# Check memory
free -h
docker stats --no-stream

# Restart if needed
docker compose -f docker-compose.blue-green.yml restart
```

### GitHub Actions deploy fails

1. Check the Actions tab in GitHub for error logs
2. Verify secrets are set correctly (VPS_HOST, VPS_USER, SSH_PRIVATE_KEY)
3. Test SSH manually: `ssh -i key deploy@your-vps-ip`
4. Ensure VPS has Docker installed and .env exists at `/opt/resourcemanager/.env`

---

**Last Updated**: February 2026
**Tested On**: Ubuntu 22.04 LTS, Docker 24.x, 2GB RAM / 80GB VPS
