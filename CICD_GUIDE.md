# 🚀 CI/CD Pipeline Overview

Complete CI/CD pipeline for ResourceManager using GitHub Actions, GitHub Container Registry (GHCR), and automated VPS deployment.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer pushes to GitHub                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────▼──────────┐
                │   GitHub Actions     │
                │   Workflow Triggered │
                └───────────┬──────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│ Backend Build  │                    │ Frontend Build  │
│ - .NET 8 Build │                    │ - React + Vite  │
│ - Run Tests    │                    │ - ESLint        │
│ - Code Quality │                    │ - TypeScript    │
└───────┬────────┘                    └────────┬────────┘
        │                                      │
        └───────────────────┬──────────────────┘
                            │
                ┌───────────▼──────────┐
                │  Docker Build        │
                │  - Multi-stage       │
                │  - Layer Caching     │
                │  - Security Scan     │
                └───────────┬──────────┘
                            │
                ┌───────────▼──────────┐
                │  Push to GHCR        │
                │  (GitHub Container   │
                │   Registry)          │
                └───────────┬──────────┘
                            │
                ┌───────────▼──────────┐
                │  Deploy to VPS       │
                │  - SSH Connection    │
                │  - Zero Downtime     │
                │  - Health Checks     │
                │  - Auto Rollback     │
                └──────────────────────┘
```

---

## Workflows

### 1. CI/CD Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `staging`, or `dev` branches
- Pull requests to these branches
- Manual dispatch

**Jobs:**

#### a) Backend Build & Test
- Setup .NET 8 SDK
- Restore NuGet packages
- Build solution in Release mode
- Run unit tests with coverage
- Upload test results as artifacts

#### b) Frontend Build & Lint
- Setup Node.js 20
- Install npm dependencies (with caching)
- Run ESLint
- TypeScript type checking
- Build production bundle
- Upload build artifacts

#### c) Docker Build & Push (main/staging only)
- Login to GitHub Container Registry
- Build multi-stage Docker images (backend + frontend)
- Tag with `latest` and commit SHA
- Push to GHCR
- Run Trivy security scans
- Upload security results

#### d) Deploy Notification
- Notifies that images are ready
- Actual deployment handled by separate workflow

---

### 2. VPS Deployment (`.github/workflows/deploy.yml`)

**Triggers:**
- Manual workflow dispatch (recommended)
- Can be configured for automatic deployment

**Features:**
- ✅ Zero-downtime deployment
- ✅ Automatic health checks
- ✅ Rollback on failure
- ✅ Multi-environment support (production/staging)
- ✅ Version control (deploy specific tags)

**Process:**
1. Pull pre-built images from GHCR
2. Copy docker-compose files to VPS
3. Login to GHCR on VPS
4. Update image tags in `.env`
5. Pull latest images
6. Scale up API (2 instances temporarily)
7. Wait for new API to be healthy
8. Scale down old API (remove old instance)
9. Update frontend (quick restart)
10. Verify all services healthy
11. Clean up old images

---

## Environment Strategy

| Branch | Environment | Docker Tag | Auto Deploy | Approval Required |
|--------|-------------|------------|-------------|-------------------|
| `main` | Production | `latest` + commit SHA | Manual | Yes (recommended) |
| `staging` | Staging | `staging` + commit SHA | Manual | Optional |
| `dev` | Development | `dev` | No | No |

---

## Docker Images

### Backend Image
- **Base**: `mcr.microsoft.com/dotnet/aspnet:8.0-alpine`
- **Size**: ~110MB (Alpine-based)
- **Registry**: GitHub Container Registry (GHCR)
- **Tags**: 
  - `latest` (production)
  - `staging` (staging)
  - `{commit-sha}` (specific version)

### Frontend Image
- **Base**: `nginx:alpine`
- **Size**: ~25MB
- **Registry**: GitHub Container Registry (GHCR)
- **Tags**: Same as backend

---

## Configuration Files

### Docker Compose Files

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Base configuration | All environments |
| `docker-compose.prod.yml` | Production overrides | Production VPS |
| `docker-compose.dev.yml` | Development setup | Local development |
| `docker-compose.ci.yml` | CI testing | GitHub Actions |

**Usage:**
```bash
# Development
docker compose -f docker-compose.dev.yml up -d

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Dockerfiles

| File | Purpose | Optimization |
|------|---------|--------------|
| `Dockerfile` | Backend API | Multi-stage, Alpine, non-root user |
| `ClientApp/Dockerfile` | Frontend | Multi-stage, Nginx, static asset caching |

---

## Security Features

### 1. Image Security
- ✅ Alpine Linux base (minimal attack surface)
- ✅ Non-root user execution
- ✅ Trivy vulnerability scanning
- ✅ Multi-stage builds (build artifacts removed)
- ✅ Read-only filesystem where possible

### 2. Secret Management
- ✅ GitHub Secrets for credentials
- ✅ Environment-specific secrets
- ✅ No secrets in code or images
- ✅ Encrypted at rest and in transit

### 3. Network Security
- ✅ Internal Docker network (services isolated)
- ✅ Database not exposed to public
- ✅ Health check endpoints for monitoring

### 4. Deployment Security
- ✅ SSH key authentication (no passwords)
- ✅ Protected environments with approval
- ✅ Audit trail in GitHub Actions
- ✅ Automatic rollback on failure

---

## Performance Optimizations

### Build Time
- ✅ Docker layer caching (GitHub Actions cache)
- ✅ npm dependency caching
- ✅ NuGet package caching
- ✅ Multi-stage builds (parallel stages)

### Runtime Performance
- ✅ Resource limits (2GB RAM VPS optimized)
- ✅ Log rotation (prevent disk fill-up)
- ✅ Health checks (automatic restart on failure)
- ✅ Gzip compression (nginx)
- ✅ Static asset caching (1 year)

### Image Size
- Backend: ~110MB (vs ~220MB with Debian)
- Frontend: ~25MB (vs ~150MB with Node.js)
- Total: ~135MB (both images)

---

## Monitoring & Observability

### Health Checks

```bash
# API health endpoint
GET http://your-vps:7175/health

# Web health endpoint  
GET http://your-vps/health

# Database health
docker compose exec postgres_db pg_isready
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres_db

# Last 100 lines
docker compose logs --tail=100 api

# Since timestamp
docker compose logs --since 2024-01-01T00:00:00 api
```

### Metrics

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Service status
docker compose ps
```

---

## Deployment Scenarios

### Scenario 1: Regular Deployment

```bash
# Triggered automatically on push to main
git push origin main

# Or manually via GitHub Actions UI:
# 1. Go to Actions → Deploy to VPS
# 2. Click "Run workflow"
# 3. Select "production"
# 4. Click "Run workflow"
```

### Scenario 2: Hotfix Deployment

```bash
# 1. Make fix on main branch
git checkout main
git pull
# ... make changes ...
git commit -m "hotfix: critical bug fix"
git push origin main

# 2. CI/CD builds and pushes images automatically

# 3. Deploy immediately
# Go to Actions → Deploy to VPS → Run workflow
```

### Scenario 3: Rollback

```bash
# Option A: Via GitHub Actions
# Deploy to VPS → Run workflow → Enter previous commit SHA as tag

# Option B: Via SSH
ssh deploy@vps
cd /opt/resourcemanager
# Edit .env to use previous image tag
nano .env
# Change: API_IMAGE=username/resourcemanager-api:abc1234
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
```

### Scenario 4: Testing Before Production

```bash
# 1. Push to staging branch
git push origin staging

# 2. CI/CD builds staging images

# 3. Deploy to staging VPS
# Actions → Deploy to VPS → environment: staging

# 4. Test thoroughly

# 5. Merge to main when ready
git checkout main
git merge staging
git push origin main
```

---

## Troubleshooting

### Build Failures

**Backend build fails:**
```bash
# Check .NET version
dotnet --version

# Restore dependencies
dotnet restore

# Build locally
dotnet build --configuration Release
```

**Frontend build fails:**
```bash
# Check Node version
node --version

# Clear cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Deployment Failures

**Health check timeout:**
- Check VPS logs: `docker compose logs api`
- Verify database connection
- Check if port 8080 is accessible
- Increase timeout in deploy.yml

**SSH connection refused:**
- Verify SSH key in GitHub secrets
- Test SSH manually: `ssh -i key deploy@vps`
- Check firewall allows SSH port
- Verify deploy user exists on VPS

**GHCR authentication:**
- Verify GHCR_TOKEN has `read:packages` scope
- Test login: `echo $TOKEN | docker login ghcr.io -u h-heni --password-stdin`
- Check token was created at https://github.com/settings/tokens

---

## Best Practices

### Development Workflow

1. ✅ Create feature branch from `dev`
2. ✅ Make changes and test locally
3. ✅ Push feature branch (triggers CI)
4. ✅ Create PR to `dev` (review + CI)
5. ✅ Merge to `dev` after approval
6. ✅ Test on dev environment
7. ✅ Merge `dev` → `staging` for pre-production
8. ✅ Final testing on staging
9. ✅ Merge `staging` → `main` for production
10. ✅ Manual deployment to production

### Deployment Workflow

1. ✅ Review changes in PR
2. ✅ Wait for CI to pass
3. ✅ Merge to main
4. ✅ Wait for Docker images to build
5. ✅ Manually trigger deployment
6. ✅ Monitor logs during deployment
7. ✅ Verify health checks
8. ✅ Test critical functionality
9. ✅ Monitor for errors

### Maintenance

- 🔄 Rotate secrets every 90 days
- 🔄 Update dependencies monthly
- 🔄 Review logs weekly
- 🔄 Test backup/restore quarterly
- 🔄 Security scan images monthly

---

## Quick Commands Reference

```bash
# View workflow runs
gh run list --workflow=ci.yml

# Trigger deployment manually
gh workflow run deploy.yml -f environment=production -f tag=latest

# View logs of specific run
gh run view <run-id> --log

# SSH into VPS
ssh deploy@your-vps-ip

# Check deployment status on VPS
cd /opt/resourcemanager && docker compose ps

# View logs on VPS
docker compose logs -f api

# Restart service
docker compose restart api

# Pull and update
docker compose pull && docker compose up -d
```

---

## Additional Resources

- 📖 [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- 🔐 [SECRETS.md](./SECRETS.md) - Secrets configuration
- 📝 [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Development setup
- 🐳 [Docker Documentation](https://docs.docker.com/)
- 🚀 [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Support

**Found an issue?** Open an issue on GitHub with:
- Workflow run ID
- Error logs
- Configuration (remove sensitive data)
- Steps to reproduce

**Need help?** Check:
- GitHub Actions logs
- VPS docker logs
- Documentation above
- Existing GitHub issues

---

**Status**: ✅ Production Ready | **Last Updated**: 2024 | **Version**: 1.0