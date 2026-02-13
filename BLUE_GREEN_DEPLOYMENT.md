# Blue-Green Deployment Guide (2GB VPS)

## Architecture Overview

Blue-Green deployment with **sequential swap** strategy optimized for a 2GB RAM VPS.

- Two environments: **Blue** and **Green**
- Only **one runs at a time** (not enough RAM for both)
- Shared PostgreSQL + Redis (always running)
- Nginx switches between them
- ~10-15 seconds downtime per deploy

### Architecture Diagram

```
                    ┌───────────────────────────────┐
                    │         VPS (2GB RAM)          │
                    │                                │
                    │  ┌──────────────────────┐      │
                    │  │   Nginx (Port 80)    │      │
                    │  │   Routes to active   │      │
                    │  │   environment        │      │
                    │  └──────────┬───────────┘      │
                    │             │                   │
                    │      ┌──────┴──────┐           │
                    │      │  ACTIVE_ENV │           │
                    │      │  blue/green │           │
                    │      └──────┬──────┘           │
                    │             │                   │
                    │  ┌──────────▼───────────┐      │
                    │  │  Active Environment  │      │
                    │  │  ┌─────────────────┐ │      │
                    │  │  │  API (.NET 8)   │ │      │
                    │  │  │  512MB limit    │ │      │
                    │  │  └────────┬────────┘ │      │
                    │  │  ┌────────▼────────┐ │      │
                    │  │  │  Web (Nginx)    │ │      │
                    │  │  │  64MB limit     │ │      │
                    │  │  └────────┬────────┘ │      │
                    │  └───────────┼──────────┘      │
                    │              │                  │
                    │  ┌───────────▼──────────┐      │
                    │  │  PostgreSQL (512MB)  │      │
                    │  │  Redis (128MB)       │      │
                    │  │  Shared — always on  │      │
                    │  └─────────────────────┘      │
                    └───────────────────────────────┘
```

> **2GB Constraint**: Both Blue and Green cannot run simultaneously — the deploy script **stops** the old environment before starting the new one.

---

## Deployment Flow (Sequential Swap)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Current: Blue is ACTIVE, Green is STOPPED                │
│    Nginx → Blue (serving traffic)                           │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Pull new Docker images (while Blue is still running)     │
│    docker compose pull green-api green-web                  │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. STOP Blue (downtime begins ~10-15s)                      │
│    docker compose stop blue-api blue-web                    │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. START Green                                              │
│    docker compose up -d green-api green-web                 │
│    API applies EF Core migrations automatically             │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Health Checks (20 retries, 5s intervals)                 │
│    curl green-api:8080/health ✓                            │
│    (downtime ends when health passes)                       │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Switch Nginx upstream → Green                            │
│    Update .env: ACTIVE_ENV=green                            │
│    Regenerate nginx conf → reload                           │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Verify via proxy: curl http://localhost/health           │
│    If fails → auto-rollback to Blue                         │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Cleanup old images                                       │
│    GREEN is now ACTIVE. Blue containers are stopped.        │
│    Next deploy will go to Blue.                             │
└─────────────────────────────────────────────────────────────┘
```

**Total Downtime**: ~10-15 seconds (between stopping old and new passing health check)

---

## Memory Budget (2GB VPS)

| Service | Reservation | Limit | Notes |
|---------|-------------|-------|-------|
| PostgreSQL | 256MB | 512MB | Shared, always running |
| Redis | 64MB | 128MB | 96MB maxmemory, LRU eviction |
| API (.NET 8) | 256MB | 512MB | Workstation GC, auto migrations |
| Web (Nginx) | 32MB | 64MB | Static files |
| Nginx Proxy | 32MB | 64MB | Reverse proxy |
| **OS/System** | — | ~500MB | Kernel, SSH, buffers |
| **Total** | ~640MB | ~1.3GB | ~700MB headroom |

> Only ONE API+Web pair runs at a time. Never both Blue and Green simultaneously.

---

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.blue-green.yml` | Defines all services (blue/green envs, postgres, redis, nginx) |
| `scripts/deploy-blue-green.sh` | Automated deploy with sequential swap + auto-rollback |
| `scripts/rollback-blue-green.sh` | Manual rollback to previous environment |
| `nginx/blue-green.conf.template` | Nginx config template with `${ACTIVE_ENV}` variable |
| `.env` | All secrets + `ACTIVE_ENV` (blue or green) |
| `.github/workflows/ci.yml` | Unified CI/CD pipeline (build → test → deploy) |

---

## Commands

### Deploy (automated by CI/CD)

```bash
cd /opt/resourcemanager
./scripts/deploy-blue-green.sh
```

The script automatically:
1. Detects active environment from `.env`
2. Pulls new images (while old still serves traffic)
3. Stops old environment
4. Starts new environment
5. Waits for health checks (20 retries × 5s)
6. Switches Nginx upstream
7. Verifies through proxy
8. Auto-rollback on any failure

### Rollback

```bash
./scripts/rollback-blue-green.sh
```

### Emergency Rollback (< 10 seconds)

```bash
# If green is active and broken, switch back to blue immediately
sed -i "s/ACTIVE_ENV=.*/ACTIVE_ENV=blue/" .env
docker compose -f docker-compose.blue-green.yml up -d blue-api blue-web
sleep 10
docker exec nginx sh -c 'envsubst "\$ACTIVE_ENV" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -s reload'
docker compose -f docker-compose.blue-green.yml stop green-api green-web
```

### Check Status

```bash
# Which environment is active?
grep ACTIVE_ENV .env

# Container status
docker compose -f docker-compose.blue-green.yml ps

# Resource usage
docker stats --no-stream

# Logs
docker compose -f docker-compose.blue-green.yml logs blue-api --tail=50
docker compose -f docker-compose.blue-green.yml logs green-api --tail=50
```

---

## Database Migrations

The API applies EF Core migrations automatically at startup. Both Blue and Green share the same database.

### Best Practices

| Safe (no downtime risk) | Unsafe (2-step deploy needed) |
|------------------------|-------------------------------|
| Add new table | Drop column |
| Add column with default | Rename table |
| Add nullable column | Change column type |
| Add index | Remove constraint |

For **unsafe** changes, deploy in two steps:
1. Deploy 1: Add new column/table (backward compatible)
2. Deploy 2: Remove old column after code no longer references it

### Manual Migration

```bash
docker compose -f docker-compose.blue-green.yml exec blue-api \
  dotnet ef database update
```

---

## CI/CD Integration

The unified `.github/workflows/ci.yml` pipeline handles everything:

```yaml
push to main → build → test → docker → deploy → health verify
                                                      ↓ (failure)
                                                  auto-rollback
```

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USER` | SSH username |
| `SSH_PRIVATE_KEY` | Ed25519 private key |

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full setup instructions.

---

## Troubleshooting

### Health Check Fails

```bash
# Check API logs
docker compose -f docker-compose.blue-green.yml logs green-api --tail=50

# Common causes:
# - Missing env vars in .env
# - Database not ready
# - Migration error
```

### Database Connection Error

```bash
# Check PostgreSQL
docker compose -f docker-compose.blue-green.yml logs postgres_db --tail=20

# Test connection
docker compose -f docker-compose.blue-green.yml exec postgres_db \
  psql -U rmuser -d resourcemanager -c "SELECT 1;"
```

### Nginx Not Routing

```bash
# Test config
docker exec nginx nginx -t

# Check active env in container
docker exec nginx printenv ACTIVE_ENV

# Force reload
docker exec nginx nginx -s reload
```

### Out of Memory

```bash
free -h
docker stats --no-stream

# If OOM: restart with memory limits enforced
docker compose -f docker-compose.blue-green.yml down
docker compose -f docker-compose.blue-green.yml up -d postgres_db redis
sleep 15
docker compose -f docker-compose.blue-green.yml up -d blue-api blue-web nginx
```

### Disk Full

```bash
df -h
docker system df

# Clean up
docker image prune -a -f --filter "until=72h"
docker system prune -f
```

---

## Comparison: 2GB vs 4GB VPS

| Feature | 2GB (Current) | 4GB+ |
|---------|---------------|------|
| Strategy | Sequential swap | Parallel swap |
| Downtime | ~10-15 seconds | ~0.1 seconds |
| Both envs running | NO | YES |
| Auto-rollback | YES (restart old) | YES (instant switch) |
| Cost | Lower | Higher |
| Upgrade path | Change deploy script memory limits | Change deploy script to parallel |

To **upgrade to 4GB**: modify `deploy-blue-green.sh` to start new environment BEFORE stopping old, and increase memory limits in `docker-compose.blue-green.yml`.

---

**See also**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete setup instructions, .env configuration, and GitHub Secrets setup.
