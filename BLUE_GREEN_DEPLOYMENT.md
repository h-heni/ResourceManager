# Blue-Green Deployment Guide

## Architecture Overview

Blue-Green deployment is a release management strategy that reduces downtime and risk by running two identical production environments: **Blue** (current) and **Green** (new).

### Architecture Diagram

```
                                  ┌─────────────────┐
                                  │   VPS Server    │
                                  │                 │
                                  │  ┌───────────┐  │
                                  │  │   Nginx   │  │
                                  │  │  (Port 80)│  │
                                  │  └─────┬─────┘  │
                                  │        │        │
                                  │   Upstream      │
                                  │   Switching     │
                                  │        │        │
                    ┌─────────────┼────────┼────────┼─────────────┐
                    │             │        │        │             │
                    │             │   ┌────▼────┐   │             │
                    │             │   │  Active │   │             │
                    │             │   │  (blue  │   │             │
                    │             │   │  or     │   │             │
                    │             │   │  green) │   │             │
                    │             │   └─────────┘   │             │
                    │             │                 │             │
        ┌───────────▼───────┐     │     ┌───────────▼───────┐     │
        │  Blue Environment │     │     │ Green Environment │     │
        │                   │     │     │                   │     │
        │ ┌───────────────┐ │     │     │ ┌───────────────┐ │     │
        │ │ API (Blue)    │ │     │     │ │ API (Green)   │ │     │
        │ │ Port: 7175    │ │     │     │ │ Port: 7176    │ │     │
        │ └───────┬───────┘ │     │     │ └───────┬───────┘ │     │
        │         │         │     │     │         │         │     │
        │ ┌───────▼───────┐ │     │     │ ┌───────▼───────┐ │     │
        │ │ Web (Blue)    │ │     │     │ │ Web (Green)   │ │     │
        │ │ Port: 8080    │ │     │     │ │ Port: 8081    │ │     │
        │ └───────┬───────┘ │     │     │ └───────┬───────┘ │     │
        │         │         │     │     │         │         │     │
        └─────────┼─────────┘     │     └─────────┼─────────┘     │
                  │               │               │               │
                  │               │               │               │
                  └───────────────┼───────────────┘               │
                                  │                               │
                                  │  ┌─────────────────────┐      │
                                  │  │   PostgreSQL DB     │      │
                                  │  │   (Shared)          │      │
                                  │  │   Port: 5432        │      │
                                  │  └─────────────────────┘      │
                                  │                               │
                                  └───────────────────────────────┘
```

### Key Components

1. **Nginx Reverse Proxy** (Port 80)
   - Single entry point for all traffic
   - Routes requests to active environment (Blue or Green)
   - Switches instantly between environments using upstream configuration

2. **Blue Environment** (Ports: 7175 API, 8080 Web)
   - Complete stack: API + Web containers
   - Independent from Green
   - Can run simultaneously with Green

3. **Green Environment** (Ports: 7176 API, 8081 Web)
   - Identical to Blue
   - Used for new deployments
   - Can run simultaneously with Blue

4. **PostgreSQL Database** (Shared)
   - Single database instance shared by both environments
   - Ensures data consistency
   - Requires backward-compatible migrations

## Deployment Flow

### Zero-Downtime Deployment Process

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Current State: Blue is ACTIVE, Green is IDLE             │
│    Nginx → Blue (serving traffic)                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Deploy to Green                                          │
│    - Pull new Docker images                                 │
│    - Start Green containers                                 │
│    - Blue continues serving traffic                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Health Check Green                                       │
│    - Verify API health: curl green_api/health              │
│    - Verify Web health: curl green_web/health              │
│    - Verify database connectivity                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Switch Traffic (Instant)                                 │
│    - Update Nginx upstream to point to Green               │
│    - Reload Nginx (0.1s downtime)                          │
│    - Green now serving traffic                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Verify & Cleanup                                         │
│    - Monitor Green for 5 minutes                            │
│    - If successful: Stop Blue containers                    │
│    - If failed: Rollback to Blue                           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### VPS Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Installation on VPS

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

## Setup Instructions

### 1. Initial Setup on VPS

```bash
# Create deployment directory
sudo mkdir -p /opt/resourcemanager
sudo chown $USER:$USER /opt/resourcemanager
cd /opt/resourcemanager

# Clone repository files
# Note: Copy these files manually or via CI/CD
# - docker-compose.blue-green.yml
# - nginx/blue-green.conf
# - scripts/deploy-blue-green.sh
# - scripts/rollback-blue-green.sh
# - .env

# Create .env file with your secrets
cat > .env << 'EOF'
# Database
POSTGRES_DB=resourcemanager
POSTGRES_USER=rmuser
POSTGRES_PASSWORD=YourSecurePassword123!

# JWT
JWT_KEY=YourSecureJWTKey-GenerateWith-OpenSSL
JWT_ISSUER=ResourceManager
JWT_AUDIENCE=ResourceManager-Users
JWT_EXPIRATION=100

# Images
API_IMAGE=ghcr.io/your-org/resourcemanager-api:latest
WEB_IMAGE=ghcr.io/your-org/resourcemanager-web:latest

# Active environment (blue or green)
ACTIVE_ENV=blue
EOF

# Create nginx configuration directory
mkdir -p nginx

# Start initial Blue environment
docker-compose -f docker-compose.blue-green.yml up -d postgres_db blue-api blue-web nginx

# Wait for services to be healthy
sleep 30
docker-compose -f docker-compose.blue-green.yml ps
```

### 2. Verify Initial Setup

```bash
# Check container health
curl http://localhost/health

# Check API
curl http://localhost/api/health

# Check which environment is active
curl http://localhost/api/version
```

## Deployment Commands

### Deploy New Version (Zero Downtime)

```bash
# Run the deployment script
./scripts/deploy-blue-green.sh

# The script will:
# 1. Detect current active environment (Blue or Green)
# 2. Deploy to the inactive environment
# 3. Run health checks
# 4. Switch Nginx traffic
# 5. Stop old environment after verification
```

### Manual Deployment Steps

If you prefer manual control:

```bash
# 1. Check current active environment
ACTIVE_ENV=$(grep "^ACTIVE_ENV=" .env | cut -d'=' -f2)
echo "Current active: $ACTIVE_ENV"

# 2. Determine target environment
if [ "$ACTIVE_ENV" = "blue" ]; then
    TARGET_ENV="green"
    TARGET_API_PORT=7176
    TARGET_WEB_PORT=8081
else
    TARGET_ENV="blue"
    TARGET_API_PORT=7175
    TARGET_WEB_PORT=8080
fi
echo "Deploying to: $TARGET_ENV"

# 3. Pull latest images
docker-compose -f docker-compose.blue-green.yml pull ${TARGET_ENV}-api ${TARGET_ENV}-web

# 4. Start target environment
docker-compose -f docker-compose.blue-green.yml up -d ${TARGET_ENV}-api ${TARGET_ENV}-web

# 5. Wait for health checks
echo "Waiting for services to be healthy..."
sleep 30

# 6. Health check
curl -f http://localhost:${TARGET_API_PORT}/health || exit 1
curl -f http://localhost:${TARGET_WEB_PORT}/health || exit 1

# 7. Switch nginx traffic
sed -i "s/ACTIVE_ENV=.*/ACTIVE_ENV=${TARGET_ENV}/" .env
docker exec nginx nginx -s reload

# 8. Verify traffic is on new environment
curl http://localhost/health

# 9. Wait 5 minutes for monitoring
echo "Monitoring new environment for 5 minutes..."
sleep 300

# 10. Stop old environment
docker-compose -f docker-compose.blue-green.yml stop ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web

echo "Deployment complete! Active: $TARGET_ENV"
```

## Rollback Instructions

### Automatic Rollback

```bash
# Run the rollback script
./scripts/rollback-blue-green.sh

# The script will:
# 1. Start the previous environment
# 2. Run health checks
# 3. Switch Nginx back
# 4. Stop current environment
```

### Manual Rollback Steps

```bash
# 1. Check current active environment
ACTIVE_ENV=$(grep "^ACTIVE_ENV=" .env | cut -d'=' -f2)
echo "Current active (failed): $ACTIVE_ENV"

# 2. Determine rollback target
if [ "$ACTIVE_ENV" = "blue" ]; then
    ROLLBACK_ENV="green"
else
    ROLLBACK_ENV="blue"
fi
echo "Rolling back to: $ROLLBACK_ENV"

# 3. Start rollback environment (if stopped)
docker-compose -f docker-compose.blue-green.yml start ${ROLLBACK_ENV}-api ${ROLLBACK_ENV}-web

# 4. Wait for health
sleep 10
curl -f http://localhost/health || echo "Warning: Health check failed"

# 5. Switch nginx immediately
sed -i "s/ACTIVE_ENV=.*/ACTIVE_ENV=${ROLLBACK_ENV}/" .env
docker exec nginx nginx -s reload

# 6. Verify
curl http://localhost/health

# 7. Stop failed environment
docker-compose -f docker-compose.blue-green.yml stop ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web

echo "Rollback complete! Active: $ROLLBACK_ENV"
```

### Emergency Rollback (< 30 seconds)

If the new environment is completely broken:

```bash
# Immediate switch back (no health checks)
# Replace 'green' with your previous working environment
sed -i "s/ACTIVE_ENV=.*/ACTIVE_ENV=blue/" .env
docker exec nginx nginx -s reload

echo "Emergency rollback complete!"
```

## Nginx Switching Strategy

### How Traffic Switching Works

The Nginx configuration uses environment variables to determine which upstream (Blue or Green) to route traffic to:

```nginx
# Upstream is determined by environment variable
upstream backend_api {
    server ${ACTIVE_ENV}-api:8080;
}

upstream backend_web {
    server ${ACTIVE_ENV}-web:80;
}
```

When you switch environments:
1. Update `ACTIVE_ENV` variable in `.env`
2. Reload Nginx: `docker exec nginx nginx -s reload`
3. Nginx hot-reloads configuration (< 0.1s downtime)
4. New requests go to the new environment
5. Existing connections finish gracefully

### Zero-Downtime Guarantee

- **Nginx reload**: Uses `nginx -s reload` (hot reload, not restart)
- **Connection draining**: Existing connections complete
- **No packet loss**: New connections immediately use new upstream
- **Total downtime**: < 0.1 seconds (imperceptible to users)

## Database Migration Strategy

Since Blue and Green share the same database, migrations must be **backward-compatible**.

### Safe Migration Practices

✅ **Safe Operations**:
- Add new tables
- Add new columns with defaults
- Add indexes
- Rename columns (with backward-compatible views)
- Add stored procedures

❌ **Unsafe Operations** (require maintenance window):
- Drop columns (old environment will crash)
- Rename tables without aliases
- Change column types in breaking ways
- Remove stored procedures still in use

### Migration Workflow

```bash
# 1. Deploy backward-compatible migrations with Blue
./scripts/deploy-blue-green.sh

# 2. Both Blue and Green can now work with DB
# (Blue ignores new columns, Green uses them)

# 3. After Green is stable, remove backward-compatibility
# in next deployment cycle
```

## Monitoring & Verification

### Health Check Endpoints

```bash
# Overall health
curl http://localhost/health

# API health
curl http://localhost/api/health

# Direct environment health
curl http://localhost:7175/health  # Blue API
curl http://localhost:7176/health  # Green API
curl http://localhost:8080/health  # Blue Web
curl http://localhost:8081/health  # Green Web
```

### Container Status

```bash
# View all containers
docker-compose -f docker-compose.blue-green.yml ps

# View logs
docker-compose -f docker-compose.blue-green.yml logs -f blue-api
docker-compose -f docker-compose.blue-green.yml logs -f green-api
docker-compose -f docker-compose.blue-green.yml logs -f nginx
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Cleanup old images
docker image prune -a
```

## Troubleshooting

### Issue: Health Check Fails on New Environment

```bash
# Check container logs
docker-compose -f docker-compose.blue-green.yml logs green-api
docker-compose -f docker-compose.blue-green.yml logs green-web

# Check if containers are running
docker-compose -f docker-compose.blue-green.yml ps

# Manually test health endpoint
curl -v http://localhost:7176/health  # Green API
curl -v http://localhost:8081/health  # Green Web
```

### Issue: Database Connection Fails

```bash
# Check PostgreSQL
docker-compose -f docker-compose.blue-green.yml logs postgres_db

# Test connection from host
docker exec -it postgres_db psql -U rmuser -d resourcemanager -c "SELECT 1;"

# Check environment variables
docker-compose -f docker-compose.blue-green.yml config
```

### Issue: Nginx Not Switching

```bash
# Check nginx configuration
docker exec nginx nginx -t

# Check active environment variable
docker-compose -f docker-compose.blue-green.yml exec nginx env | grep ACTIVE

# Manually reload nginx
docker exec nginx nginx -s reload

# Check nginx logs
docker-compose -f docker-compose.blue-green.yml logs nginx
```

### Issue: Port Conflicts

```bash
# Check what's using ports
sudo netstat -tlnp | grep -E ':(80|5432|7175|7176|8080|8081)\s'

# Stop conflicting services
sudo systemctl stop apache2  # If Apache is running
sudo systemctl stop nginx    # If system nginx is running
```

### Issue: Out of Disk Space

```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a --volumes
docker volume prune
docker image prune -a

# Remove unused containers
docker-compose -f docker-compose.blue-green.yml down --remove-orphans
```

## Best Practices

### 1. Database Migrations
- Always make migrations backward-compatible
- Test migrations on staging first
- Keep rollback scripts ready
- Never drop columns until old code is fully removed

### 2. Deployment Timing
- Deploy during low-traffic hours when possible
- Monitor for 5-10 minutes before stopping old environment
- Keep both environments running initially
- Have team members on standby during deployment

### 3. Rollback Preparation
- Always keep previous environment stopped but ready
- Don't delete old Docker images immediately
- Test rollback procedure regularly
- Document any environment-specific configurations

### 4. Resource Management
- Monitor disk space (Docker images accumulate)
- Prune old images after successful deployment
- Set up log rotation
- Monitor memory usage (running both environments doubles RAM usage temporarily)

### 5. Security
- Keep `.env` file secure (never commit)
- Use secrets management for production
- Regularly update Docker images
- Review and update security headers in Nginx

## Cost Optimization

### Resource Usage During Deployment

| Phase | CPU | RAM | Disk |
|-------|-----|-----|------|
| Normal (1 env) | 1 core | 2GB | 10GB |
| Deployment (2 envs) | 2 cores | 4GB | 15GB |
| After cleanup | 1 core | 2GB | 10GB |

### Tips
- Stop old environment after verification (5-10 min)
- Prune images after deployment
- Use alpine-based images (already in use)
- Monitor with `docker stats`

## CI/CD Integration

The Blue-Green deployment can be integrated with GitHub Actions:

```yaml
# In .github/workflows/deploy.yml
- name: Deploy with Blue-Green
  run: |
    ssh $VPS_USER@$VPS_HOST 'cd /opt/resourcemanager && ./scripts/deploy-blue-green.sh'
```

## Summary

| Feature | Supported | Notes |
|---------|-----------|-------|
| Zero Downtime | ✅ | < 0.1s during nginx reload |
| Instant Rollback | ✅ | < 30 seconds |
| Database Migration | ✅ | Must be backward-compatible |
| Health Checks | ✅ | Automated before switch |
| Cost Efficient | ✅ | Only 2x resources during deployment |
| Simple VPS | ✅ | No Kubernetes needed |
| Automated Scripts | ✅ | deploy-blue-green.sh / rollback-blue-green.sh |

## Next Steps

1. ✅ Read this guide thoroughly
2. ✅ Set up VPS with Docker and Docker Compose
3. ✅ Copy deployment files to VPS
4. ✅ Configure `.env` with your secrets
5. ✅ Run initial deployment to Blue
6. ✅ Test deployment to Green
7. ✅ Test rollback to Blue
8. ✅ Integrate with CI/CD
9. ✅ Set up monitoring and alerts
10. ✅ Document team-specific procedures

---

**Questions or Issues?** Open an issue in the repository or contact the DevOps team.
