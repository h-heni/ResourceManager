# Deploy ResourceManager — Zero-Downtime Guide

> **Target**: 2GB Ubuntu VPS at `rscmanager.com`
> **Strategy**: Blue-Green sequential swap (~10-15s downtime on 2GB RAM)
> **Images**: Built on-server from Git source

---

## Quick Deploy (Copy-Paste)

SSH into your server and run:

```bash
cd /opt/ResourceManager
git pull origin main
docker build -t resourcemanager-api:latest .
docker build -t resourcemanager-web:latest ./ClientApp
./scripts/deploy-blue-green.sh
```

That's it. The script handles everything: detects active environment, stops old, starts new, runs health checks, switches Nginx, and cleans up.

---

## How It Works

```
                    ┌──────────┐
  Users ──► Nginx ──┤ Blue API │  (active, serving traffic)
                    │ Blue Web │
                    └──────────┘
                    ┌───────────┐
                    │ Green API │  (idle, stopped)
                    │ Green Web │
                    └───────────┘

  Deploy triggers:
    1. Pull code + build new images
    2. Stop Blue (old)
    3. Start Green (new) — migrations auto-apply
    4. Health check Green
    5. Switch Nginx → Green
    6. Remove Blue containers
    7. Next deploy will swap back: Green → Blue
```

The active environment alternates between **blue** and **green** on each deploy. The `.env` file tracks which is active via `ACTIVE_ENV`.

---

## First-Time Setup

Only needed once on a fresh server.

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes
```

### 2. Clone & Configure

```bash
sudo mkdir -p /opt/ResourceManager
sudo chown $USER:$USER /opt/ResourceManager
git clone https://github.com/h-heni/ResourceManager.git /opt/ResourceManager
cd /opt/ResourceManager
cp .env.example .env
```

### 3. Edit `.env` — Fill in Required Secrets

```bash
nano .env
```

Required variables:

| Variable | Example |
|----------|---------|
| `POSTGRES_PASSWORD` | Strong random password |
| `POSTGRES_DB` | `resourcemanager` |
| `POSTGRES_USER` | `rmuser` |
| `JWT_KEY` | 64+ character secret |
| `REDIS_PASSWORD` | Strong random password |
| `EMAIL_SMTP_HOST` | `smtp-relay.brevo.com` |
| `EMAIL_SMTP_PORT` | `587` |
| `EMAIL_SMTP_USER` | Your SMTP username |
| `EMAIL_SMTP_PASSWORD` | Your SMTP password |
| `EMAIL_FROM_ADDRESS` | `noreply@rscmanager.com` |
| `APP_BASE_URL` | `https://rscmanager.com` |
| `ACTIVE_ENV` | `blue` |
| `ACTIVE_API_HOST` | `blue-api` |
| `ACTIVE_WEB_HOST` | `blue-web` |

### 4. Build Images

```bash
docker build -t resourcemanager-api:latest .
docker build -t resourcemanager-web:latest ./ClientApp
```

### 5. Initial Launch (Blue)

```bash
docker compose -f docker-compose.blue-green.yml up -d postgres_db redis
# Wait ~10s for DB to initialize
sleep 10
docker compose -f docker-compose.blue-green.yml up -d blue-api blue-web nginx
```

### 6. Verify

```bash
curl http://localhost/health
curl http://localhost/api/health
```

---

## Deploying Updates

After the first-time setup, every subsequent deploy follows this pattern:

### Step 1: Pull Latest Code

```bash
ssh user@rscmanager.com
cd /opt/ResourceManager
git pull origin main
```

### Step 2: Rebuild Images

```bash
# Backend API image (~2-3 min on 2GB VPS)
docker build -t resourcemanager-api:latest .

# Frontend image (~1-2 min)
docker build -t resourcemanager-web:latest ./ClientApp
```

### Step 3: Deploy with Blue-Green Swap

```bash
./scripts/deploy-blue-green.sh
```

The script will:
1. Read `ACTIVE_ENV` from `.env` (e.g., `blue`)
2. Target the opposite environment (`green`)
3. Stop current (`blue-api`, `blue-web`)
4. Start target (`green-api`, `green-web`)
5. Run health checks on target
6. Update `.env` → `ACTIVE_ENV=green`
7. Recreate Nginx to point to green
8. Remove old blue containers
9. Prune unused images

### Step 4: Verify

```bash
# Check health endpoints
curl -s http://localhost/health
curl -s http://localhost/api/health

# Check which environment is active
grep ACTIVE_ENV .env

# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Watch API logs
docker logs green-api --tail 50 -f
```

---

## Rollback

If something goes wrong after deployment:

```bash
cd /opt/ResourceManager

# Check which environment is active
grep ACTIVE_ENV .env
# Example output: ACTIVE_ENV=green (this is the broken one)

# Switch back to the previous environment
# If green is broken, restore blue:
docker compose -f docker-compose.blue-green.yml stop green-api green-web
docker compose -f docker-compose.blue-green.yml up -d blue-api blue-web

# Update .env to point back to blue
sed -i 's/ACTIVE_ENV=green/ACTIVE_ENV=blue/' .env
sed -i 's/ACTIVE_API_HOST=green-api/ACTIVE_API_HOST=blue-api/' .env
sed -i 's/ACTIVE_WEB_HOST=green-web/ACTIVE_WEB_HOST=blue-web/' .env

# Recreate nginx with old config
docker compose -f docker-compose.blue-green.yml up -d --force-recreate nginx

# Verify
curl http://localhost/health
curl http://localhost/api/health
```

---

## One-Liner Deploy Script

For convenience, you can create an alias:

```bash
# Add to ~/.bashrc
alias deploy='cd /opt/ResourceManager && git pull origin main && docker build -t resourcemanager-api:latest . && docker build -t resourcemanager-web:latest ./ClientApp && ./scripts/deploy-blue-green.sh'
```

Then just run:

```bash
deploy
```

---

## Database Migrations

Migrations run **automatically** at API startup via EF Core. No manual steps needed.

If you need to check migration status:

```bash
# Connect to the database
docker exec -it postgres_db psql -U rmuser -d resourcemanager

# List applied migrations
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId" DESC LIMIT 10;
```

---

## Monitoring

```bash
# Live resource usage
docker stats --no-stream

# Container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# API logs (last 100 lines, follow)
docker logs $(grep -oP 'ACTIVE_ENV=\K\w+' .env)-api --tail 100 -f

# Nginx access log
docker logs nginx --tail 50

# Disk usage
docker system df
```

---

## Ports Reference

| Service | Internal | External |
|---------|----------|----------|
| Nginx (proxy) | 80 | 80 |
| Blue API | 8080 | 7175 |
| Green API | 8080 | 7176 |
| Blue Web | 80 | 8080 |
| Green Web | 80 | 8081 |
| PostgreSQL | 5432 | — (internal only) |
| Redis | 6379 | — (internal only) |

---

## Troubleshooting

### Build fails with out-of-memory

```bash
# Free up memory before building
docker system prune -f
# Or build with limited parallelism
DOCKER_BUILDKIT=0 docker build -t resourcemanager-api:latest .
```

### Health check fails after deploy

```bash
# Check API logs for startup errors
docker logs green-api --tail 100

# Common issues:
# - Missing .env variable → check .env file
# - DB connection refused → ensure postgres_db is running
# - Port conflict → check nothing else uses 7175/7176
```

### Nginx returns 502

```bash
# Check if the active API container is running
docker ps | grep api

# Verify nginx config
docker exec nginx cat /etc/nginx/conf.d/default.conf

# Restart nginx
docker compose -f docker-compose.blue-green.yml up -d --force-recreate nginx
```

### Disk space full

```bash
# Remove old images and build cache
docker system prune -af --volumes
# WARNING: --volumes removes named volumes (DB data). 
# Use without --volumes to keep data:
docker system prune -af
```
