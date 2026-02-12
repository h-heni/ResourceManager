# Production Deployment Instructions

This document provides quick setup instructions for deploying ResourceManager on a production VPS.

## 📦 What's Included

This repository includes a fully optimized production Docker Compose configuration designed for 2GB Ubuntu VPS:

- **`docker-compose.prod.yml`** - Production-optimized configuration with:
  - Memory limits for low-RAM environments
  - Network isolation (separate frontend/backend networks)
  - Named volumes for PostgreSQL data persistence
  - Automatic restart policies
  - Security hardening (capability dropping, non-root users)
  - Health checks for all services
  - Log rotation to prevent disk space issues

- **`DEPLOYMENT_GUIDE.md`** - Comprehensive 20+ page guide covering:
  - Architecture and design decisions
  - Resource allocation strategy
  - Detailed explanation of every configuration option
  - Security hardening steps
  - Backup and recovery procedures
  - Monitoring and troubleshooting
  - Performance tuning tips

- **`QUICK_REFERENCE.md`** - Cheat sheet with common commands

## 🚀 Quick Start (5 Minutes)

### 1. Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout and login for group changes to take effect
```

### 2. Configure Environment

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/h-heni/ResourceManager.git
cd ResourceManager

# Copy environment template
cp .env.example .env

# Generate secrets
echo "JWT_KEY=$(openssl rand -base64 48)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

# Edit .env and update CORS_ORIGIN values
nano .env
```

### 3. Deploy

```bash
# Validate configuration
docker compose -f docker-compose.prod.yml config

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Verify

```bash
# Test health endpoints
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

✅ Memory limits prevent OOM killer  
✅ Network isolation (frontend ↔ API ↔ database)  
✅ Non-root container users  
✅ Capability dropping (minimal privileges)  
✅ Secret management via environment variables  
✅ Read-only filesystems where possible  
✅ Automatic restart on failure  
✅ Health checks for all services  

## 📁 Key Files

- `docker-compose.prod.yml` - Production configuration
- `DEPLOYMENT_GUIDE.md` - Full documentation (read this!)
- `QUICK_REFERENCE.md` - Command cheat sheet
- `.env.example` - Environment variable template
- `Dockerfile` - Backend container image
- `ClientApp/Dockerfile` - Frontend container image
- `ClientApp/nginx.conf` - Nginx reverse proxy config

## 📖 Learn More

For detailed information about:
- Architecture decisions and design rationale
- Security hardening steps
- Backup and disaster recovery
- Performance tuning for your specific use case
- Troubleshooting common issues
- Scaling to larger VPS sizes

**👉 Read the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

## 🆘 Common Issues

### "Required variable is missing"
→ Check your `.env` file has all required values

### "Port already in use"
→ Change `WEB_PORT` or `API_PORT` in `.env`

### "Database connection failed"
→ Wait for PostgreSQL health check: `docker compose -f docker-compose.prod.yml logs postgres_db`

### High memory usage
→ Reduce limits in `docker-compose.prod.yml` or upgrade VPS

## 📞 Support

1. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
2. Read troubleshooting section in `DEPLOYMENT_GUIDE.md`
3. Open GitHub issue with logs and configuration

---

**Production Ready**: This configuration has been tested on Ubuntu 22.04 LTS with 2GB RAM and is actively used in production environments.
