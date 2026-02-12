# Production Deployment Instructions

This document provides quick setup instructions for deploying ResourceManager on a production VPS with CI/CD integration.

## 📦 What's Included

This repository includes a fully optimized production setup with automated CI/CD:

- **CI/CD Pipeline** - GitHub Actions workflows for automated build and deployment
- **GHCR Integration** - GitHub Container Registry for private image storage
- **docker-compose.prod.yml** - Production-optimized configuration (2GB VPS)
- **Comprehensive Documentation** - Complete guides for deployment and CI/CD

## 🚀 Quick Start (5 Minutes)

### Option 1: CI/CD Deployment (Recommended)

1. **Configure GitHub Secrets** (see [SECRETS.md](SECRETS.md))
2. **Push to master branch** - Triggers automated build
3. **Manual deploy** - Trigger deployment workflow from GitHub Actions
4. **Verify** - Check health endpoints

### Option 2: Manual Deployment

#### 1. Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout and login for group changes
```

#### 2. Configure Environment

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/h-heni/ResourceManager.git
cd ResourceManager

# Configure environment
cp .env.example .env
echo "JWT_KEY=$(openssl rand -base64 48)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
nano .env  # Update CORS origins and other settings
```

#### 3. Pull Images from GHCR

```bash
# Login to GitHub Container Registry
echo $GHCR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull latest images
docker compose -f docker-compose.prod.yml pull
```

#### 4. Deploy

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

#### 5. Verify

```bash
# Test endpoints
curl http://localhost:80/health        # Frontend
curl http://localhost:5000/health      # Backend

# Monitor resources
docker stats
```

## 📊 Resource Allocation (2GB VPS)

| Service    | Memory Limit | CPU Limit | Purpose              |
|------------|--------------|-----------|----------------------|
| PostgreSQL | 768MB        | 1.0 core  | Database             |
| Backend    | 1024MB       | 1.5 cores | .NET API             |
| Frontend   | 384MB        | 0.5 cores | React + Nginx        |
| System     | ~464MB       | -         | OS and kernel        |

## 🔒 Security Features

✅ CI/CD with GitHub Actions
✅ Private GHCR registry
✅ Memory limits prevent OOM
✅ Network isolation (frontend ↔ API ↔ database)
✅ Non-root container users
✅ Automated zero-downtime deployments
✅ Health checks with automatic rollback

## 📁 Key Files

### CI/CD
- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/deploy.yml` - VPS deployment workflow
- `CI-CD.md` - Pipeline architecture documentation
- `SECRETS.md` - GitHub Secrets configuration guide

### Deployment
- `docker-compose.prod.yml` - Production configuration
- `DEPLOYMENT.md` - Deployment procedures
- `DEPLOYMENT-CHECKLIST.md` - Quick reference
- `DEPLOYMENT_GUIDE.md` - Comprehensive guide

### Architecture
- `ARCHITECTURE_DIAGRAM.txt` - Visual diagrams
- `WORKFLOW-DIAGRAM.txt` - CI/CD workflow diagrams
- `IMPLEMENTATION_SUMMARY.md` - Configuration summary

## 📖 Documentation Index

**For CI/CD Setup:**
1. [SECRETS.md](SECRETS.md) - Configure GitHub Secrets
2. [CI-CD.md](CI-CD.md) - Understand the pipeline
3. [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures
4. [WORKFLOW-DIAGRAM.txt](WORKFLOW-DIAGRAM.txt) - Visual workflows

**For Manual Deployment:**
1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment guide
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command cheat sheet
3. [ARCHITECTURE_DIAGRAM.txt](ARCHITECTURE_DIAGRAM.txt) - System architecture

## 🆘 Common Issues

### CI/CD Issues

**"Failed to push to GHCR"**
→ Check GITHUB_TOKEN permissions in repository settings

**"Deployment failed health check"**
→ Check VPS logs: `docker compose -f docker-compose.prod.yml logs`

**"Cannot pull images from GHCR"**
→ Run on VPS: `echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin`

### Deployment Issues

**"Required variable is missing"**
→ Check `.env` file has all required values

**"Port already in use"**
→ Change `WEB_PORT` or `API_PORT` in `.env`

**"Database connection failed"**
→ Wait for PostgreSQL: `docker compose -f docker-compose.prod.yml logs postgres_db`

## 📞 Support

1. Check relevant documentation file
2. Review logs: `docker compose -f docker-compose.prod.yml logs -f`
3. Check troubleshooting sections in guides
4. Open GitHub issue with logs and configuration

## 🎯 Next Steps

After deployment:

1. **Monitor Resources**: `docker stats`
2. **Set Up Backups**: See [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)
3. **Configure Monitoring**: External uptime monitoring
4. **Enable HTTPS**: Let's Encrypt SSL certificate
5. **Review Logs**: Check for errors regularly

---

**Production Ready**: Tested on Ubuntu 22.04 LTS with 2GB RAM using GitHub Actions CI/CD.
