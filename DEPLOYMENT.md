# 🚀 Production Deployment Guide

Complete guide for deploying ResourceManager to a production VPS using Docker and GitHub Actions.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [Initial Deployment](#initial-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Zero-Downtime Deployments](#zero-downtime-deployments)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Logs](#monitoring--logs)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 20GB+ free space
- **Network**: Public IP address

### Local Requirements
- Docker Hub account
- GitHub account with repository access
- SSH client

### Software Stack
- Docker Engine 24.0+
- Docker Compose v2.20+
- Git

---

## VPS Setup

### 1. Initial Server Configuration

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose v2
apt install docker-compose-plugin -y

# Verify installations
docker --version
docker compose version
```

### 2. Create Deployment User

For security, create a dedicated user for deployments:

```bash
# Create deploy user
useradd -m -s /bin/bash deploy

# Add to docker group (no sudo required for docker commands)
usermod -aG docker deploy

# Create deployment directory
mkdir -p /opt/resourcemanager
chown -R deploy:deploy /opt/resourcemanager

# Switch to deploy user
su - deploy
cd /opt/resourcemanager
```

### 3. Setup SSH Key Authentication

**On your local machine** (not on VPS):

```bash
# Generate SSH key pair (if you don't have one)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/resourcemanager_deploy
# Press Enter for no passphrase (required for automated deployment)

# Display the private key (you'll add this to GitHub Secrets)
cat ~/.ssh/resourcemanager_deploy

# Display the public key
cat ~/.ssh/resourcemanager_deploy.pub
```

**On your VPS** (as the deploy user):

```bash
# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key to authorized_keys
nano ~/.ssh/authorized_keys
# Paste the public key and save (Ctrl+X, Y, Enter)

chmod 600 ~/.ssh/authorized_keys
```

**Test SSH connection from your local machine:**

```bash
ssh -i ~/.ssh/resourcemanager_deploy deploy@your-vps-ip
```

### 4. Configure Firewall

```bash
# Allow SSH (change 22 to your SSH port if different)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### 5. Setup Environment File

```bash
# Create .env file on VPS
cd /opt/resourcemanager
nano .env
```

**Paste the following** (customize values):

```env
# ═══════════════════════════════════════════════════════════════
# ResourceManager - Production Environment Variables
# ═══════════════════════════════════════════════════════════════

# ── Database ──
POSTGRES_DB=resourcemanager
POSTGRES_USER=rmuser
POSTGRES_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD_12345

# ── JWT Configuration ──
# Generate with: openssl rand -base64 48
JWT_KEY=CHANGE_THIS_TO_SECURE_RANDOM_KEY_AT_LEAST_32_CHARS_LONG_abcdef123456
JWT_ISSUER=ResourceManager
JWT_AUDIENCE=ResourceManager-Users
JWT_EXPIRATION=15

# ── Docker Images (will be updated by CI/CD) ──
API_IMAGE=your-dockerhub-username/resourcemanager-api:latest
WEB_IMAGE=your-dockerhub-username/resourcemanager-web:latest

# ── Frontend ──
WEB_PORT=80

# ── Google Integration (Optional - Gmail API for email) ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

**Generate secure values:**

```bash
# Generate JWT secret
openssl rand -base64 48

# Generate database password
openssl rand -base64 32
```

---

## GitHub Secrets Configuration

### 1. Docker Hub Setup

1. Go to [Docker Hub](https://hub.docker.com/)
2. Login and go to **Account Settings** → **Security** → **Access Tokens**
3. Click **New Access Token**
   - Description: "GitHub Actions ResourceManager"
   - Permissions: Read & Write
4. Copy the token (you can't see it again!)

### 2. Add Secrets to GitHub

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Click **New repository secret** and add each of the following:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `DOCKERHUB_USERNAME` | `your-dockerhub-username` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | `dckr_pat_xxxxx` | Docker Hub access token from step 1 |
| `VPS_HOST` | `123.456.789.0` | Your VPS IP address or domain |
| `VPS_USER` | `deploy` | SSH username (created earlier) |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Private SSH key content |
| `VPS_PORT` | `22` | SSH port (optional, defaults to 22) |

### 3. Add Variables (Optional)

Go to **Variables** tab and add:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `DEPLOY_PATH` | `/opt/resourcemanager` | Deployment directory on VPS |

### 4. Configure Environments

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it `production`
4. (Optional) Add **Protection rules**:
   - ✅ Required reviewers (select team members)
   - ✅ Wait timer (e.g., 5 minutes)
5. Click **Save protection rules**

---

## Initial Deployment

### Option A: Manual First Deployment

```bash
# SSH into VPS as deploy user
ssh deploy@your-vps-ip
cd /opt/resourcemanager

# Create docker-compose.yml and docker-compose.prod.yml
# (Copy from repository or download via curl)

# Pull images manually
docker login docker.io -u your-dockerhub-username
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps

# View logs
docker compose logs -f api
```

### Option B: Deploy via GitHub Actions

1. Push code to `main` branch
2. Go to **Actions** tab in GitHub
3. Select **CI/CD Pipeline** workflow
4. Wait for it to complete (builds and pushes images)
5. Select **Deploy to VPS** workflow
6. Click **Run workflow**
7. Select environment: `production`
8. Click **Run workflow**

---

## CI/CD Pipeline

### Workflow Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Push to main/staging                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Build & Test      │
         │  - Backend (.NET)  │
         │  - Frontend (React)│
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Build Docker      │
         │  - Push to Hub     │
         │  - Security Scan   │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Deploy to VPS     │
         │  - Zero Downtime   │
         │  - Health Checks   │
         │  - Auto Rollback   │
         └────────────────────┘
```

### Automatic Triggers

- **Push to `main`**: Builds images, pushes to Docker Hub
- **Push to `staging`**: Builds staging images
- **Pull requests**: Runs tests and builds (no deployment)

### Manual Deployment

For production deployments, use manual workflow dispatch:

1. Go to **Actions** → **Deploy to VPS**
2. Click **Run workflow**
3. Select **production** environment
4. Choose image tag (default: `latest`)
5. Click **Run workflow**
6. Review and approve (if required)

---

## Zero-Downtime Deployments

### How It Works

1. **Pull new images** - Downloads latest from Docker Hub
2. **Scale up** - Starts new API container alongside old one
3. **Health check** - Waits for new API to be healthy (30 attempts × 2s)
4. **Scale down** - Removes old API container
5. **Update frontend** - Restarts Nginx with new version
6. **Verify** - Final health checks on all services
7. **Cleanup** - Removes old images

### During Deployment

- ✅ API remains accessible (old container still serving)
- ✅ No connection errors
- ✅ Database connections maintained
- ✅ Automatic rollback if health checks fail

### Monitoring Deployment

```bash
# SSH into VPS
ssh deploy@your-vps-ip

# Watch live logs during deployment
cd /opt/resourcemanager
watch -n 1 'docker compose ps'

# Follow API logs
docker compose logs -f api

# Check health status
docker compose exec api curl http://localhost:8080/health
docker compose exec web wget --spider http://localhost:80/health
```

---

## Rollback Procedures

### Automatic Rollback

If the new deployment fails health checks, the system automatically:
1. Scales back to 1 API instance (old version)
2. Keeps the old containers running
3. Exits with error (GitHub Actions shows failure)

### Manual Rollback

#### Option 1: Deploy Previous Version

```bash
# In GitHub Actions
# Run workflow → Deploy to VPS
# Set tag to previous version (e.g., "abc1234" from commit SHA)
```

#### Option 2: Quick Rollback on VPS

```bash
# SSH into VPS
ssh deploy@your-vps-ip
cd /opt/resourcemanager

# List available images
docker images | grep resourcemanager

# Edit .env to use previous image
nano .env
# Change:
# API_IMAGE=your-username/resourcemanager-api:abc1234  # Previous version
# WEB_IMAGE=your-username/resourcemanager-web:abc1234

# Restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate

# Verify
docker compose ps
```

#### Option 3: Emergency Stop

```bash
# If something goes critically wrong
docker compose down

# Start with known-good configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Monitoring & Logs

### Check Service Status

```bash
# List all services
docker compose ps

# Check resource usage
docker stats

# View all logs
docker compose logs

# Follow specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres_db
```

### View Application Logs

```bash
# API logs are persisted in volume
docker compose exec api ls -lh /app/Logs

# View latest log file
docker compose exec api tail -f /app/Logs/log-$(date +%Y%m%d).txt
```

### Health Checks

```bash
# API health endpoint
curl http://your-vps-ip:7175/health
# or from inside VPS
docker compose exec api curl http://localhost:8080/health

# Web health endpoint
curl http://your-vps-ip/health

# Database health
docker compose exec postgres_db pg_isready -U rmuser -d resourcemanager
```

### Disk Space Management

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Cleanup old images (careful!)
docker image prune -a --filter "until=72h"

# Cleanup stopped containers
docker container prune

# Cleanup unused volumes (very careful!)
docker volume prune
```

---

## Security Best Practices

### 1. Use Strong Secrets

- ✅ JWT_KEY: Minimum 48 characters, cryptographically random
- ✅ POSTGRES_PASSWORD: Minimum 32 characters
- ✅ Change default credentials immediately

### 2. Enable HTTPS

Use **Caddy** or **Traefik** as reverse proxy with automatic SSL:

```bash
# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy

# Configure Caddy
nano /etc/caddy/Caddyfile
```

**Caddyfile example:**
```
yourdomain.com {
    reverse_proxy localhost:80
}
```

```bash
# Restart Caddy
systemctl restart caddy
```

### 3. Firewall Configuration

```bash
# Only allow necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS

# Deny all other incoming
ufw default deny incoming
ufw default allow outgoing

ufw enable
```

### 4. Disable Root Login

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no
PasswordAuthentication no

# Restart SSH
systemctl restart sshd
```

### 5. Regular Updates

```bash
# Setup automatic security updates
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Manual update process
apt update && apt upgrade -y
```

### 6. Backup Strategy

```bash
# Create backup script
nano /opt/resourcemanager/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T postgres_db pg_dump -U rmuser resourcemanager | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Backup environment file
cp .env $BACKUP_DIR/env_backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/resourcemanager/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/resourcemanager/backup.sh >> /opt/resourcemanager/backup.log 2>&1
```

---

## Troubleshooting

### Issue: Deployment Fails with Health Check Timeout

**Symptoms**: Deployment script exits with "New API failed health check"

**Solutions**:
```bash
# Check API logs
docker compose logs api

# Check if port 8080 is accessible
docker compose exec api netstat -tlnp | grep 8080

# Test health endpoint manually
docker compose exec api curl -v http://localhost:8080/health

# Check database connection
docker compose exec api cat /app/appsettings.Production.json
docker compose exec postgres_db pg_isready
```

### Issue: Database Connection Errors

**Symptoms**: API logs show "Connection refused" or "Could not connect to server"

**Solutions**:
```bash
# Check if PostgreSQL is running
docker compose ps postgres_db

# Check database logs
docker compose logs postgres_db

# Verify connection string in .env
cat .env | grep CONNECTION_STRING

# Test database connection
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c "SELECT version();"
```

### Issue: Out of Memory Errors

**Symptoms**: Containers randomly crash, "OOMKilled" in docker logs

**Solutions**:
```bash
# Check current memory usage
free -h
docker stats --no-stream

# Increase VPS RAM or reduce container limits in docker-compose.prod.yml

# Add swap space (temporary fix)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
# Make permanent: echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Issue: Images Not Pulling from Docker Hub

**Symptoms**: "unauthorized: authentication required"

**Solutions**:
```bash
# Login to Docker Hub manually
docker login docker.io -u your-username

# Check .env has correct image names
cat .env | grep IMAGE

# Try pulling manually
docker pull your-username/resourcemanager-api:latest

# Check Docker Hub repository is public or credentials are correct
```

### Issue: Port Already in Use

**Symptoms**: "bind: address already in use"

**Solutions**:
```bash
# Find process using port
lsof -i :80
lsof -i :7175

# Stop conflicting service
systemctl stop apache2   # or nginx, or whatever is using the port

# Or change port in docker-compose.yml
```

### Issue: SSL/HTTPS Certificate Errors

**Symptoms**: Browser shows "Not Secure", certificate errors

**Solutions**:
1. If using Caddy: Check Caddyfile configuration
2. If using Let's Encrypt manually: Renew certificates
3. Verify DNS points to your VPS
4. Check firewall allows port 443

```bash
# Test SSL with Caddy
curl -v https://yourdomain.com
systemctl status caddy
journalctl -u caddy -f
```

### Getting Help

- **Check logs first**: `docker compose logs`
- **GitHub Issues**: Open an issue with logs and error messages
- **Community**: Search existing issues for similar problems

---

## Quick Reference Commands

```bash
# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop services
docker compose down

# Restart a service
docker compose restart api

# View logs
docker compose logs -f api

# Execute command in container
docker compose exec api bash

# Check status
docker compose ps

# Pull latest images
docker compose pull

# Update and restart
docker compose pull && docker compose up -d

# Clean up
docker system prune -a

# Backup database
docker compose exec postgres_db pg_dump -U rmuser resourcemanager > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres_db psql -U rmuser resourcemanager
```

---

## Next Steps

1. ✅ Complete VPS setup
2. ✅ Configure GitHub Secrets
3. ✅ Test initial deployment
4. ✅ Enable HTTPS with Caddy/Let's Encrypt
5. ✅ Setup backup automation
6. ✅ Configure monitoring (optional: Prometheus, Grafana)
7. ✅ Document custom configurations for your team

---

**Need help?** Open an issue on GitHub with your deployment logs and configuration (remove sensitive data first!).
