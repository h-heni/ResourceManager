# ResourceManager — Production Deployment Guide

This guide covers deploying ResourceManager on an Ubuntu VPS with Docker, using Nginx as a reverse proxy. It includes HTTP-only setup (IP address access) with instructions for upgrading to HTTPS later.

---

## Table of Contents

1. [Folder Structure](#folder-structure)
2. [Prerequisites](#prerequisites)
3. [Initial Server Setup](#initial-server-setup)
4. [Firewall Configuration](#firewall-configuration)
5. [Deploy the Application](#deploy-the-application)
6. [Verify Deployment](#verify-deployment)
7. [Upgrading to HTTPS (Let's Encrypt)](#upgrading-to-https-lets-encrypt)
8. [Maintenance & Troubleshooting](#maintenance--troubleshooting)

---

## Folder Structure

The production deployment uses this structure:

```
ResourceManager/
├── nginx/                          # Reverse proxy configuration
│   ├── Dockerfile                  # Nginx container build
│   └── nginx.conf                  # Main reverse proxy config (HTTP + HTTPS templates)
├── ClientApp/                      # React frontend
│   ├── Dockerfile                  # Frontend container build
│   ├── nginx.conf                  # Internal nginx (serves React only)
│   └── src/                        # React source code
├── Controllers/                    # .NET API controllers
├── Data/                           # EF Core context + migrations
├── Models/                         # Domain entities
├── Dockerfile                      # Backend API container build
├── docker-compose.prod.yml         # Production orchestration (with reverse proxy)
├── docker-compose.yml              # Development orchestration (without reverse proxy)
├── .env.example                    # Environment variables template
└── DEPLOYMENT.md                   # This file
```

### Architecture

```
Internet (Port 80/443)
    ↓
[Nginx Reverse Proxy]
    ├── / → [Web Container] (React frontend on port 80)
    └── /api → [API Container] (.NET backend on port 8080)
                    ↓
            [PostgreSQL Container] (port 5432)
```

**Key Points:**
- Nginx is the **only** container exposed to the internet (port 80)
- All containers communicate on an internal Docker network (`rm-internal`)
- The frontend and API containers are **not** directly accessible from outside

---

## Prerequisites

### 1. Ubuntu VPS Requirements

- **OS:** Ubuntu 20.04 LTS or later
- **RAM:** Minimum 2GB (4GB recommended)
- **Storage:** Minimum 20GB
- **Public IP:** Required for internet access
- **Domain:** Optional (for HTTPS later)

### 2. SSH Access

```bash
ssh root@YOUR_SERVER_IP
```

Or with a non-root user:

```bash
ssh username@YOUR_SERVER_IP
```

---

## Initial Server Setup

### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
```

### Step 3: Install Docker Compose (if not included)

```bash
# Docker Compose v2 is usually included with Docker now
docker compose version

# If not installed, manually install:
sudo apt install docker-compose-plugin -y
```

### Step 4: Create Application Directory

```bash
sudo mkdir -p /opt/resourcemanager
sudo chown $USER:$USER /opt/resourcemanager
cd /opt/resourcemanager
```

### Step 5: Upload Project Files

**Option A: From local machine**
```bash
# On your local machine:
scp -r ./ResourceManager/* username@YOUR_SERVER_IP:/opt/resourcemanager/
```

**Option B: Clone from Git**
```bash
# On the server:
cd /opt/resourcemanager
git clone https://github.com/h-heni/ResourceManager.git .
```

---

## Firewall Configuration

Use UFW (Uncomplicated Firewall) to secure your server.

### Step 1: Install UFW

```bash
sudo apt install ufw -y
```

### Step 2: Configure Firewall Rules

```bash
# Allow SSH (CRITICAL - do this first or you'll lock yourself out!)
sudo ufw allow 22/tcp
sudo ufw allow OpenSSH

# Allow HTTP (port 80) for the application
sudo ufw allow 80/tcp

# For HTTPS later (optional now):
# sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable

# Verify status
sudo ufw status verbose
```

**Expected Output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
```

### Important Notes:
- **Never block port 22** or you'll lose SSH access
- Port 80 is for HTTP traffic
- Port 443 will be added later for HTTPS
- Database (5432) and API (8080) ports are **not** exposed (internal only)

---

## Deploy the Application

### Step 1: Create Environment File

```bash
cd /opt/resourcemanager
cp .env.example .env
nano .env
```

**Configure these critical values:**

```bash
# Database credentials
POSTGRES_DB=resourcemanager
POSTGRES_USER=rmuser
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE   # Generate with: openssl rand -base64 24

# JWT secret key (must be ≥32 characters)
JWT_KEY=YOUR_SECURE_RANDOM_KEY_HERE           # Generate with: openssl rand -base64 48
JWT_ISSUER=ResourceManager
JWT_AUDIENCE=ResourceManager-Users
JWT_EXPIRATION=15

# Container images
API_IMAGE=resourcemanager-api:latest
WEB_IMAGE=resourcemanager-web:latest
NGINX_IMAGE=resourcemanager-nginx:latest

# Optional: Google integration (for sending emails via Gmail API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

**Security Tips:**
- Use strong, random passwords (24+ characters)
- JWT key must be at least 32 characters
- Never commit `.env` to Git (it's in `.gitignore`)

### Step 2: Build Docker Images

```bash
cd /opt/resourcemanager

# Build all images
docker compose -f docker-compose.prod.yml build

# This will build:
# - resourcemanager-api (backend)
# - resourcemanager-web (frontend)
# - resourcemanager-nginx (reverse proxy)
```

### Step 3: Start Services

```bash
# Start all containers in detached mode
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

**Expected Output:**
```
NAME                    COMMAND                  SERVICE      STATUS        PORTS
postgres_db             "docker-entrypoint.s…"   postgres_db  Up (healthy)  
resourcemanager-api     "dotnet ResourceMana…"   api          Up (healthy)  
resourcemanager-web     "/docker-entrypoint.…"   web          Up (healthy)  
resourcemanager-nginx   "/docker-entrypoint.…"   nginx        Up (healthy)  0.0.0.0:80->80/tcp
```

### Step 4: Run Database Migrations

**First time deployment only:**

```bash
# Apply EF Core migrations
docker compose -f docker-compose.prod.yml exec api dotnet ef database update

# Verify migration
docker compose -f docker-compose.prod.yml exec api dotnet ef migrations list
```

---

## Verify Deployment

### Step 1: Test Health Endpoints

```bash
# Test nginx health (from server)
curl http://localhost/health
# Expected: "healthy"

# Test API health
curl http://localhost/api/health
# Expected: {"status":"healthy","timestamp":"..."}
```

### Step 2: Access from Browser

Open your browser and navigate to:

```
http://YOUR_SERVER_IP
```

You should see the ResourceManager login page.

### Step 3: Check Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f postgres_db
```

### Step 4: Test API Endpoints

```bash
# Test Swagger UI (optional - disable in hardened production)
curl http://YOUR_SERVER_IP/swagger

# Test specific API endpoint
curl http://YOUR_SERVER_IP/api/health
```

---

## Upgrading to HTTPS (Let's Encrypt)

Once you have a domain name pointed to your server, follow these steps to enable HTTPS.

### Prerequisites

- **Domain name** (e.g., `yourdomain.com`)
- **DNS A record** pointing to your server's public IP
- **Ports 80 and 443** open in firewall

### Step 1: Point Domain to Server

Create an A record in your DNS provider:

```
Type: A
Name: @ (or yourdomain.com)
Value: YOUR_SERVER_IP
TTL: 3600
```

Also create a CNAME for www:

```
Type: CNAME
Name: www
Value: yourdomain.com
TTL: 3600
```

Verify DNS propagation:

```bash
dig +short yourdomain.com
# Should return YOUR_SERVER_IP
```

### Step 2: Install Certbot

```bash
# Install Certbot and nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

### Step 3: Stop Nginx Container

```bash
docker compose -f docker-compose.prod.yml stop nginx
```

### Step 4: Obtain SSL Certificate

```bash
# Request certificate (standalone mode)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com --email your-email@example.com --agree-tos

# Certificate will be saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Step 5: Update Nginx Configuration

Edit `nginx/nginx.conf`:

```bash
nano /opt/resourcemanager/nginx/nginx.conf
```

**Make these changes:**

1. **Update server_name** in the commented HTTPS block:
   ```nginx
   server_name yourdomain.com www.yourdomain.com;
   ```

2. **Uncomment the HTTPS server block** (lines starting with `# server {` around line 180)

3. **Uncomment the HTTP to HTTPS redirect** (bottom of the file)

4. **Comment out or remove the HTTP server block** (the first `server { listen 80; ... }`)

### Step 6: Update docker-compose.prod.yml

Edit `docker-compose.prod.yml`:

```bash
nano /opt/resourcemanager/docker-compose.prod.yml
```

Uncomment the SSL certificate volumes in the `nginx` service:

```yaml
nginx:
  # ...
  ports:
    - "80:80"
    - "443:443"  # Uncomment this
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro  # Uncomment this
    - nginx-logs:/var/log/nginx
```

### Step 7: Update Firewall

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Verify
sudo ufw status
```

### Step 8: Rebuild and Restart

```bash
cd /opt/resourcemanager

# Rebuild nginx container with new config
docker compose -f docker-compose.prod.yml build nginx

# Restart all services
docker compose -f docker-compose.prod.yml up -d
```

### Step 9: Verify HTTPS

```bash
# Test HTTPS
curl -I https://yourdomain.com
# Should return: HTTP/2 200

# Test HTTP redirect
curl -I http://yourdomain.com
# Should return: HTTP/1.1 301 Moved Permanently
```

### Step 10: Set Up Auto-Renewal

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Add cron job for automatic renewal
sudo crontab -e

# Add this line (runs twice daily):
0 0,12 * * * certbot renew --quiet --post-hook "docker compose -f /opt/resourcemanager/docker-compose.prod.yml restart nginx"
```

---

## Maintenance & Troubleshooting

### Update Application

```bash
cd /opt/resourcemanager

# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Restart services (zero downtime with health checks)
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart nginx
```

### Stop Application

```bash
# Stop all containers
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (WARNING: deletes database)
docker compose -f docker-compose.prod.yml down -v
```

### Database Backup

```bash
# Backup database
docker compose -f docker-compose.prod.yml exec postgres_db pg_dump -U rmuser resourcemanager > backup_$(date +%Y%m%d).sql

# Restore database
cat backup_20260212.sql | docker compose -f docker-compose.prod.yml exec -T postgres_db psql -U rmuser resourcemanager
```

### Common Issues

#### Issue: "Can't reach the server"
```bash
# Check if containers are running
docker compose -f docker-compose.prod.yml ps

# Check firewall
sudo ufw status

# Check nginx logs
docker compose -f docker-compose.prod.yml logs nginx
```

#### Issue: "502 Bad Gateway"
```bash
# Check if API is healthy
docker compose -f docker-compose.prod.yml exec api curl http://localhost:8080/health

# Check API logs
docker compose -f docker-compose.prod.yml logs api

# Restart API
docker compose -f docker-compose.prod.yml restart api
```

#### Issue: "Connection refused" from API
```bash
# Check if services are on the same network
docker network inspect resourcemanager_rm-internal

# Restart all services
docker compose -f docker-compose.prod.yml restart
```

### Performance Monitoring

```bash
# View resource usage
docker stats

# View disk usage
df -h
docker system df

# Clean up unused images/containers
docker system prune -a
```

---

## Security Checklist

- [ ] Strong database password (24+ characters)
- [ ] Strong JWT key (48+ characters)
- [ ] UFW firewall enabled
- [ ] Only ports 22, 80, (443) open
- [ ] `.env` file not committed to Git
- [ ] Regular backups configured
- [ ] SSL certificates (when using HTTPS)
- [ ] Swagger disabled in production (edit `nginx/nginx.conf`, set `/swagger` to `return 404;`)

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [UFW Guide](https://help.ubuntu.com/community/UFW)

---

**Last Updated:** February 2026  
**Author:** ResourceManager Team
