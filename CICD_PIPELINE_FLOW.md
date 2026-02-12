# CI/CD Pipeline Flow Documentation

## Overview

The ResourceManager project uses a multi-stage CI/CD pipeline with separate workflows for building, testing, and deployment. This document explains how the automated deployment works.

## Workflow Files

### 1. `ci.yml` - Main CI/CD Pipeline
**Triggers:**
- Push to `dev`, `staging`, or `main` branches
- Pull requests to these branches
- Manual workflow dispatch

**Jobs:**

#### Backend Job (Always runs)
- Runs on: All branches and PRs
- Actions:
  - Checkout code
  - Setup .NET 8
  - Restore dependencies
  - Build all projects (excluding Mobile)
  - Run unit tests
  - Upload test results

#### Frontend Job (Always runs)
- Runs on: All branches and PRs  
- Actions:
  - Checkout code
  - Setup Node.js
  - Install dependencies
  - Run ESLint
  - Type check with TypeScript
  - Build production bundle
  - Upload build artifacts

#### Docker Job (Conditional)
- Runs on: Push events only (not PRs) to `main` or `staging` branches
- Depends on: Backend and Frontend jobs must succeed
- Actions:
  - Build and push Backend Docker image to GHCR
    - Tag: `latest` (for main) or `staging` (for staging)
    - Tag: `<commit-sha>` (version tag)
  - Build and push Frontend Docker image to GHCR
    - Tag: `latest` (for main) or `staging` (for staging)
    - Tag: `<commit-sha>` (version tag)
  - Run Trivy security scans
  - Upload security results to GitHub Security

### 2. `deploy.yml` - Deployment to VPS
**Triggers:**
- Manual workflow dispatch (can specify environment and tag)
- Automatic via `workflow_run` when CI/CD Pipeline completes on `main` or `staging`

**Jobs:**

#### Deploy Job
- Runs on: Ubuntu latest
- Conditions: Only if CI pipeline succeeded (when triggered by workflow_run)
- Environment: Auto-detected based on branch (main → production, staging → staging)
- Actions:
  - Checkout deployment files
  - Determine environment and image tags
  - Setup SSH to VPS
  - Copy deployment files (docker-compose, nginx config)
  - Pull latest Docker images from GHCR
  - Perform zero-downtime rolling update
  - Run health checks
  - Rollback on failure

### 3. `deploy-blue-green.yml` - Blue-Green Deployment
**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Note:** This is an alternative deployment strategy. Choose either `deploy.yml` or `deploy-blue-green.yml`, not both.

## Deployment Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Action                             │
│  git push origin main  OR  git push origin staging               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ci.yml (CI/CD Pipeline)                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Backend Job (Build + Test)         ✓                        │
│  2. Frontend Job (Lint + Build)        ✓                        │
│  3. Docker Job (if main/staging)       ✓                        │
│     - Build & push API image                                     │
│     - Build & push Web image                                     │
│     - Security scan                                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ (workflow_run trigger)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    deploy.yml (Deployment)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Detect environment (main=prod, staging=staging)              │
│  2. Select image tag (main=latest, staging=staging)              │
│  3. SSH to VPS                                                   │
│  4. Pull images from GHCR                                        │
│  5. Zero-downtime deployment                                     │
│     - Update API (with health check)                             │
│     - Update Frontend + Nginx                                    │
│  6. Verify deployment                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Branch Strategy and Deployment Targets

| Branch    | CI Runs | Docker Build | Auto Deploy | Target Environment |
|-----------|---------|--------------|-------------|-------------------|
| `dev`     | ✓       | ✗            | ✗           | None              |
| `staging` | ✓       | ✓            | ✓           | Staging VPS       |
| `main`    | ✓       | ✓            | ✓           | Production VPS    |
| PR        | ✓       | ✗            | ✗           | None              |

## Image Tagging Strategy

### Main Branch (Production)
- `ghcr.io/h-heni/resourcemanager-api:latest`
- `ghcr.io/h-heni/resourcemanager-api:<commit-sha>`
- `ghcr.io/h-heni/resourcemanager-web:latest`
- `ghcr.io/h-heni/resourcemanager-web:<commit-sha>`

### Staging Branch
- `ghcr.io/h-heni/resourcemanager-api:staging`
- `ghcr.io/h-heni/resourcemanager-api:<commit-sha>`
- `ghcr.io/h-heni/resourcemanager-web:staging`
- `ghcr.io/h-heni/resourcemanager-web:<commit-sha>`

## Manual Deployment

### Option 1: Via GitHub Actions UI
1. Go to Actions → Deploy to VPS
2. Click "Run workflow"
3. Select branch (main/staging)
4. Choose environment (production/staging)
5. Optional: specify image tag (default: latest)
6. Click "Run workflow"

### Option 2: Via GitHub CLI
```bash
# Deploy production with latest tag
gh workflow run deploy.yml --ref main -f environment=production -f tag=latest

# Deploy staging with specific version
gh workflow run deploy.yml --ref staging -f environment=staging -f tag=abc1234
```

## Rollback Procedure

### Automatic Rollback
The deployment script includes automatic rollback on health check failure.

### Manual Rollback to Previous Version
```bash
# Find the previous image tag from GHCR or git commit history
gh workflow run deploy.yml --ref main -f environment=production -f tag=<previous-commit-sha>
```

## Required Secrets and Variables

### GitHub Secrets (Repository Settings → Secrets and variables → Actions)
- `VPS_HOST` - Server IP or hostname
- `VPS_USER` - SSH username (e.g., deploy)
- `VPS_SSH_KEY` - Private SSH key for authentication
- `VPS_PORT` - SSH port (default: 22)
- `GHCR_TOKEN` - GitHub Personal Access Token with `read:packages` scope

### GitHub Variables (Repository Settings → Secrets and variables → Actions → Variables)
- `DEPLOY_PATH` - Path on VPS (default: ~/projects)
- `VITE_API_URL` - API URL for frontend build (optional)

### Environment Secrets (Repository Settings → Environments)
Each environment (staging, production) should have:
- Environment-specific protection rules
- Required reviewers (recommended for production)

## Troubleshooting

### Issue: Docker job is skipped
**Cause:** Running on a PR or a branch other than main/staging  
**Solution:** This is expected behavior. Docker images are only built for deployable branches.

### Issue: Deployment doesn't trigger after CI
**Cause:** CI pipeline failed, or secrets are not configured  
**Solution:** 
1. Check CI pipeline logs for failures
2. Verify all required secrets are set
3. Ensure deploy.yml workflow is present on the branch

### Issue: Deployment fails with SSH error
**Cause:** Invalid SSH key or incorrect VPS credentials  
**Solution:** 
1. Verify `VPS_SSH_KEY` secret contains valid private key
2. Check `VPS_HOST` and `VPS_USER` are correct
3. Ensure SSH key is authorized on VPS (~/.ssh/authorized_keys)

### Issue: Health check fails after deployment
**Cause:** Application startup issue or database migration failure  
**Solution:** 
1. SSH to VPS and check Docker logs: `docker compose logs api`
2. Verify database connection string in .env
3. Check if database migrations applied correctly

## Best Practices

1. **Always merge to staging first** before deploying to production
2. **Use PRs** for code review before merging to main/staging
3. **Monitor logs** after deployment to ensure application health
4. **Tag releases** in git for important production deployments
5. **Test staging** thoroughly before promoting to production
6. **Keep secrets secure** - never commit them to the repository
7. **Use environment protection rules** in GitHub for production

## Related Documentation

- [CICD_GUIDE.md](./CICD_GUIDE.md) - Detailed CI/CD setup guide
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - VPS deployment instructions
- [BLUE_GREEN_DEPLOYMENT.md](./BLUE_GREEN_DEPLOYMENT.md) - Blue-Green strategy guide
