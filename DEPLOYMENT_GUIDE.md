# ResourceManager - Production Deployment Guide

## 🎯 Overview

This guide covers deploying ResourceManager on a 2GB Ubuntu VPS using Docker Compose. The configuration is optimized for low-memory environments while maintaining production-grade security and reliability.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [Resource Allocation](#resource-allocation)
5. [Configuration Sections Explained](#configuration-sections-explained)
6. [Security Hardening](#security-hardening)
7. [Backup & Recovery](#backup--recovery)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- Ubuntu 20.04+ (or any Linux distribution)
- 2GB RAM minimum
- 20GB disk space
- Docker 20.10+
- Docker Compose 2.0+
- Root or sudo access

### Install Docker & Docker Compose

```bash
# Update package index
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (logout/login required after)
sudo usermod -aG docker $USER

# Install Docker Compose (if not included)
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Quick Start

### 1. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/h-heni/ResourceManager.git
cd ResourceManager
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate secure JWT key
openssl rand -base64 48

# Generate secure database password
openssl rand -base64 24

# Edit .env file with your values
nano .env
```

**Required changes in `.env`:**
- `POSTGRES_PASSWORD`: Strong database password
- `JWT_KEY`: 32+ character random key
- `CORS_ORIGIN_1` and `CORS_ORIGIN_2`: Your domain/IP

### 3. Validate Configuration

```bash
# Validate docker-compose syntax
docker compose -f docker-compose.prod.yml config

# Check for errors in the output
```

### 4. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Verify Deployment

```bash
# Check all containers are running
docker ps

# Test health endpoints
curl http://localhost:80/health        # Frontend
curl http://localhost:5000/health      # Backend API

# Monitor resource usage
docker stats
```

---

## Architecture Overview

### Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└────────────────────────┬────────────────────────────────┘
                         │ Port 80 (HTTP)
                         ▼
        ┌────────────────────────────────┐
        │  rm-web (Nginx + React)        │
        │  Memory: 256MB / 384MB max     │
        │  - Serves static files         │
        │  - Reverse proxy to API        │
        └────────────┬───────────────────┘
                     │ /api/* → http://api:8080
                     │ Frontend Network (172.21.0.0/24)
                     ▼
        ┌────────────────────────────────┐
        │  rm-api (.NET 8)               │
        │  Memory: 768MB / 1024MB max    │
        │  - Business logic              │
        │  - REST API endpoints          │
        │  - JWT authentication          │
        └────────────┬───────────────────┘
                     │ Port 5432
                     │ Backend Network (172.20.0.0/24)
                     ▼
        ┌────────────────────────────────┐
        │  rm-postgres (PostgreSQL 16)   │
        │  Memory: 512MB / 768MB max     │
        │  - Persistent data storage     │
        │  - No external access          │
        └────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │  postgres_data (Volume)        │
        │  Persistent disk storage       │
        └────────────────────────────────┘
```

### Network Isolation

**Frontend Network** (`172.21.0.0/24`)
- Web container (Nginx)
- API container
- Purpose: User-facing traffic

**Backend Network** (`172.20.0.0/24`)
- API container
- PostgreSQL container
- Purpose: Database access (isolated from web)

**Security Benefit**: The web container cannot directly access the database, reducing attack surface.

---

## Resource Allocation

### Memory Distribution (2GB Total)

| Component         | Soft Limit | Hard Limit | Burst Capacity | Purpose                     |
|-------------------|-----------|------------|----------------|------------------------------|
| **PostgreSQL**    | 384MB     | 768MB      | 2x            | Database operations          |
| **Backend API**   | 512MB     | 1024MB     | 2x            | Application logic            |
| **Frontend**      | 128MB     | 384MB      | 3x            | Nginx + static files         |
| **System/Kernel** | -         | -          | ~464MB        | OS, cache, buffers           |
| **Total**         | 1024MB    | 2176MB     | -             | Slightly over-subscribed*    |

*Over-subscription is safe because services rarely hit max simultaneously.

### CPU Allocation

| Component       | Reservation | Limit |
|-----------------|-------------|-------|
| PostgreSQL      | 0.25 cores  | 1.0   |
| Backend API     | 0.5 cores   | 1.5   |
| Frontend        | 0.1 cores   | 0.5   |

---

## Configuration Sections Explained

### 1. PostgreSQL Database

```yaml
postgres_db:
  image: postgres:16-alpine
  container_name: rm-postgres
```

**Why Alpine?** 
- Alpine Linux base image is 5-10x smaller than Debian
- Reduces memory footprint and attack surface
- Image size: ~230MB vs ~400MB for Debian

#### Memory Limits

```yaml
deploy:
  resources:
    limits:
      memory: 768M
    reservations:
      memory: 384M
```

- **Soft limit (384MB)**: Guaranteed minimum memory
- **Hard limit (768MB)**: Maximum allowed (OOM killed if exceeded)
- **Why these values?**: 
  - PostgreSQL performs well with 512MB
  - Extra 256MB headroom for burst activity
  - Prevents single service from consuming all RAM

#### PostgreSQL Performance Tuning

```yaml
command: >
  postgres
  -c shared_buffers=128MB
  -c effective_cache_size=384MB
  -c work_mem=4MB
  -c max_connections=40
```

**Key Settings:**

| Parameter                   | Value  | Explanation                                    |
|-----------------------------|--------|------------------------------------------------|
| `shared_buffers`            | 128MB  | Memory for caching data (25% of total)         |
| `effective_cache_size`      | 384MB  | OS cache size hint (75% of total)              |
| `work_mem`                  | 4MB    | Memory per sort/hash operation                 |
| `max_connections`           | 40     | Reduced from 100 (each uses ~10MB)             |
| `maintenance_work_mem`      | 64MB   | For VACUUM, CREATE INDEX                       |

**Impact**: Optimizes PostgreSQL for low-RAM environments while maintaining performance.

#### Named Volume

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

- **Purpose**: Persists database across container restarts
- **Location**: `/var/lib/docker/volumes/resourcemanager_postgres_data`
- **Backup**: Critical - must be backed up regularly

#### Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U rmuser -d resourcemanager"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

- Ensures database is accepting connections
- API waits for `service_healthy` before starting
- Prevents "connection refused" errors during startup

#### Security Features

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - DAC_OVERRIDE
  - SETGID
  - SETUID
```

- **no-new-privileges**: Prevents privilege escalation attacks
- **cap_drop/cap_add**: Drops all Linux capabilities except those required
- **Minimal attack surface**: Only essential privileges granted

---

### 2. Backend API (.NET 8)

```yaml
api:
  image: resourcemanager-api:latest
  container_name: rm-api
```

#### Memory Limits

```yaml
deploy:
  resources:
    limits:
      memory: 1024M
    reservations:
      memory: 512M
```

- **Why more than PostgreSQL?**: .NET applications need RAM for:
  - JIT compilation
  - Garbage collection
  - Request processing
  - PDF generation (QuestPDF)
  - Caching

#### .NET Memory Optimization

```yaml
environment:
  - DOTNET_gcServer=0                # Workstation GC (lower memory)
  - DOTNET_GCConserveMemory=9        # Max conservation (1-9 scale)
  - DOTNET_GCHeapCount=2             # Limit GC heaps
```

**GC Modes:**
- **Server GC**: High throughput, high memory (default for servers)
- **Workstation GC**: Lower memory, suitable for constrained environments
- **Conservative Mode**: Reduces heap size, more frequent collections

**Trade-off**: Slightly higher CPU usage, significantly lower memory usage.

#### Database Connection

```yaml
environment:
  - ConnectionStrings__DefaultConnection=Host=postgres_db;Port=5432;...
```

- Uses **service name** (`postgres_db`) as hostname
- Docker DNS automatically resolves to container IP
- No need for IP addresses (dynamic)

#### Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  start_period: 40s
```

- 40s start period allows for:
  - .NET runtime initialization
  - Database migrations
  - Dependency injection setup

#### Dependency

```yaml
depends_on:
  postgres_db:
    condition: service_healthy
```

- Waits for PostgreSQL health check to pass
- Prevents "database unavailable" errors

---

### 3. Frontend (React + Nginx)

```yaml
web:
  image: resourcemanager-web:latest
  container_name: rm-web
```

#### Why Nginx is Lightweight

- Nginx uses event-driven architecture (non-blocking I/O)
- Handles 10,000+ concurrent connections with minimal memory
- Static file serving is extremely efficient
- Typical usage: 20-50MB for small/medium sites

#### Resource Limits

```yaml
deploy:
  resources:
    limits:
      memory: 384M
    reservations:
      memory: 128M
```

- **128MB**: More than enough for Nginx + static React build
- **384MB**: Generous headroom for spikes

#### Reverse Proxy

From `nginx.conf`:

```nginx
location /api/ {
    proxy_pass http://api:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**Benefits:**
1. **Single entry point**: Users only connect to port 80
2. **Security**: Backend API not directly exposed
3. **SSL termination**: Add HTTPS at nginx layer (future)
4. **Load balancing**: Easy to add multiple API instances
5. **Caching**: Can cache API responses

#### Static Asset Caching

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

- 1-year expiration for static assets
- Reduces bandwidth and server load
- Uses browser cache effectively

---

### 4. Volumes

```yaml
volumes:
  postgres_data:
    driver: local
  api-logs:
    driver: local
```

#### postgres_data

- **Purpose**: Stores PostgreSQL database files
- **Persistence**: Data survives container deletion
- **Backup**: CRITICAL - Loss = data loss
- **Size**: Grows with application usage

#### api-logs

- **Purpose**: Application logs from .NET backend
- **Persistence**: Useful for debugging, not critical
- **Rotation**: Limited to 100MB (5 files × 20MB)
- **Cleanup**: Can be safely deleted if disk space needed

#### Backup Strategy

```bash
# Backup postgres_data volume
docker run --rm \
  -v resourcemanager_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz /data

# List backups
ls -lh postgres-backup-*.tar.gz

# Restore from backup
docker run --rm \
  -v resourcemanager_postgres_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres-backup-20240101.tar.gz --strip-components=1"
```

---

### 5. Networks

```yaml
networks:
  backend-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
  
  frontend-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/24
```

#### Network Isolation Benefits

**Defense in Depth:**
1. Web container cannot directly access database
2. If web container compromised, attacker cannot reach DB
3. API acts as controlled gateway with authentication/authorization
4. Each network has separate subnet for clarity

**Container Network Mapping:**

| Container     | Frontend Network | Backend Network |
|---------------|------------------|-----------------|
| rm-web        | ✅ (172.21.0.x)  | ❌              |
| rm-api        | ✅ (172.21.0.x)  | ✅ (172.20.0.x) |
| rm-postgres   | ❌               | ✅ (172.20.0.x) |

---

### 6. Restart Policies

```yaml
restart: unless-stopped
```

**Behavior:**
- Container restarts automatically on failure
- Continues restarting until explicitly stopped
- Survives host reboots (systemd/init starts Docker daemon)

**Alternatives:**
- `no`: Never restart (default)
- `always`: Always restart, even after explicit stop
- `on-failure`: Only restart on error exit code

**Why `unless-stopped`?**
- Production-appropriate balance
- Allows manual control via `docker compose down`
- Handles crashes and host reboots

---

### 7. Logging

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

**Purpose**: Prevents log files from filling disk

**Configuration:**
- Each container's logs limited to 30MB total (3 files × 10MB)
- Oldest file deleted when limit reached (rotation)
- Logs accessible via `docker compose logs`

**Calculate total log space:**
- PostgreSQL: 30MB
- API: 100MB (5 × 20MB)
- Web: 30MB
- **Total**: ~160MB maximum

**View logs:**

```bash
# Real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100

# With timestamps
docker compose -f docker-compose.prod.yml logs -t
```

---

## Security Hardening

### 1. Environment Variables

**Never hardcode secrets in docker-compose.yml!**

✅ **Good:**
```yaml
environment:
  - JWT_KEY=${JWT_KEY:?ERROR - JWT_KEY required}
```

❌ **Bad:**
```yaml
environment:
  - JWT_KEY=my-secret-key-12345  # NEVER DO THIS
```

**Validation:**
- `:?` syntax requires variable to be set
- Compose fails with clear error if missing
- Prevents accidental deployment with defaults

### 2. Generate Strong Secrets

```bash
# JWT Key (at least 32 characters)
openssl rand -base64 48
# Output: vK8zP3mN9xL4tC7jR2wS6bF1dH5gV0qY8nA3pM4rT9eU6oI2sL7kJ

# PostgreSQL Password
openssl rand -base64 24
# Output: xR3mK8pL2tN9vC4jF7qS1wB6

# Store in .env file
echo "JWT_KEY=vK8zP3mN9xL4tC7jR2wS6bF1dH5gV0qY8nA3pM4rT9eU6oI2sL7kJ" >> .env
echo "POSTGRES_PASSWORD=xR3mK8pL2tN9vC4jF7qS1wB6" >> .env
```

### 3. Firewall Configuration

```bash
# Install UFW (Uncomplicated Firewall)
sudo apt install ufw

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (if using SSL)
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 4. Disable Unnecessary Features

**In production:**
- Remove Swagger UI endpoint from `nginx.conf`
- Set `ASPNETCORE_ENVIRONMENT=Production` (hides detailed errors)
- Disable development CORS origins

### 5. Regular Updates

```bash
# Update Docker images (pulls latest security patches)
docker compose -f docker-compose.prod.yml pull

# Recreate containers with new images
docker compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -a
```

### 6. SSL/TLS (HTTPS)

**Add Let's Encrypt certificate:**

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update docker-compose.prod.yml
# Uncomment SSL port and add volume:
# volumes:
#   - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## Backup & Recovery

### Automated Daily Backups

Create `/opt/resourcemanager/backup.sh`:

```bash
#!/bin/bash
# Daily backup script for ResourceManager

BACKUP_DIR="/opt/backups/resourcemanager"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# 1. Backup PostgreSQL data volume
docker run --rm \
  -v resourcemanager_postgres_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres-${DATE}.tar.gz /data

# 2. Backup using pg_dump (logical backup)
docker compose -f /opt/ResourceManager/docker-compose.prod.yml exec -T postgres_db \
  pg_dump -U rmuser -d resourcemanager | gzip > $BACKUP_DIR/dump-${DATE}.sql.gz

# 3. Backup .env file (encrypted)
gpg --symmetric --cipher-algo AES256 -o $BACKUP_DIR/env-${DATE}.gpg /opt/ResourceManager/.env

# 4. Delete old backups
find $BACKUP_DIR -name "postgres-*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "dump-*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "env-*.gpg" -mtime +$RETENTION_DAYS -delete

# 5. Log completion
echo "[$(date)] Backup completed: postgres-${DATE}.tar.gz" >> $BACKUP_DIR/backup.log
```

**Set up cron job:**

```bash
# Make script executable
chmod +x /opt/resourcemanager/backup.sh

# Add to crontab (runs daily at 2 AM)
sudo crontab -e

# Add line:
0 2 * * * /opt/resourcemanager/backup.sh
```

### Restore from Backup

```bash
# Stop services
docker compose -f docker-compose.prod.yml down

# Restore volume
docker run --rm \
  -v resourcemanager_postgres_data:/data \
  -v /opt/backups/resourcemanager:/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres-20240101_020000.tar.gz --strip-components=1"

# Start services
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml logs -f postgres_db
```

---

## Monitoring & Maintenance

### Resource Monitoring

```bash
# Real-time resource usage
docker stats

# Output:
# CONTAINER     CPU %   MEM USAGE / LIMIT   MEM %   NET I/O       BLOCK I/O
# rm-postgres   2%      256MB / 768MB       33%     1.2MB / 2.1MB  ...
# rm-api        15%     512MB / 1024MB      50%     3.4MB / 1.8MB  ...
# rm-web        1%      64MB / 384MB        17%     5.1MB / 890KB  ...
```

### Health Checks

```bash
# Check container health status
docker compose -f docker-compose.prod.yml ps

# Output shows "healthy" or "unhealthy"
```

### Log Analysis

```bash
# Check for errors
docker compose -f docker-compose.prod.yml logs | grep -i error

# Database connection errors
docker compose -f docker-compose.prod.yml logs api | grep -i "connection"

# API response times
docker compose -f docker-compose.prod.yml logs web | grep "GET /api"
```

### Disk Space Management

```bash
# Check disk usage
df -h

# Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes

# Remove stopped containers only
docker container prune

# Remove unused images
docker image prune -a
```

### Performance Tuning

**If memory is consistently high:**

```bash
# Option 1: Increase swap (emergency only)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Option 2: Adjust memory limits in docker-compose.prod.yml
# Reduce API limit to 768MB if underutilized

# Option 3: Enable PostgreSQL connection pooling
# Add PgBouncer container (lightweight, ~50MB)
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs <service-name>
```

**Common issues:**
1. **Missing environment variable**: Check `.env` file
2. **Port already in use**: Change port in `.env`
3. **Database connection failed**: Ensure PostgreSQL is healthy
4. **Out of memory**: Reduce memory limits or upgrade VPS

### Database Connection Errors

```bash
# Test PostgreSQL from API container
docker compose -f docker-compose.prod.yml exec api \
  /bin/sh -c 'apt update && apt install -y postgresql-client && psql $ConnectionStrings__DefaultConnection'

# Check PostgreSQL logs
docker compose -f docker-compose.prod.yml logs postgres_db

# Verify network connectivity
docker compose -f docker-compose.prod.yml exec api ping postgres_db
```

### High Memory Usage

```bash
# Identify culprit
docker stats --no-stream

# Restart specific service
docker compose -f docker-compose.prod.yml restart api

# Check for memory leaks in logs
docker compose -f docker-compose.prod.yml logs api | grep -i "OutOfMemory"
```

### Slow Performance

**Check:**
1. CPU usage: `docker stats`
2. Disk I/O: `iostat -x 1`
3. Network latency: `docker compose exec api curl -w "@/dev/null" -o /dev/null -s http://postgres_db:5432`

**Optimize:**
- Enable query caching in PostgreSQL
- Add Redis for session storage (if implemented)
- Increase shared_buffers if memory available

### Cannot Access Website

```bash
# Check if web container is running
docker ps | grep rm-web

# Check nginx logs
docker compose -f docker-compose.prod.yml logs web

# Test from host
curl http://localhost:80

# Check firewall
sudo ufw status

# Verify port binding
sudo netstat -tulpn | grep :80
```

---

## Scaling Beyond 2GB

### 4GB VPS Recommendations

```yaml
# Adjust in docker-compose.prod.yml:
postgres_db:
  deploy:
    resources:
      limits:
        memory: 1536M  # 3x increase
      reservations:
        memory: 768M

api:
  deploy:
    resources:
      limits:
        memory: 2048M  # 2x increase
      reservations:
        memory: 1024M
```

### 8GB+ VPS Recommendations

Add Redis for caching:

```yaml
redis:
  image: redis:7-alpine
  container_name: rm-redis
  deploy:
    resources:
      limits:
        memory: 256M
  networks:
    - backend-network
  restart: unless-stopped
```

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Performance Tuning](https://pgtune.leopard.in.ua/)
- [Nginx Optimization](https://www.nginx.com/blog/tuning-nginx/)
- [.NET Memory Management](https://docs.microsoft.com/en-us/dotnet/standard/garbage-collection/)

---

## Support

For issues or questions:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Review this guide's troubleshooting section
3. Open GitHub issue with logs and configuration

---

**Last Updated**: 2024
**Version**: 1.0
**Tested On**: Ubuntu 22.04 LTS with Docker 24.0.7
