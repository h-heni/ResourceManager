# ResourceManager - Production Deployment Guide

> **Note**: This is a comprehensive production deployment guide. For CI/CD-specific information, see [CI-CD.md](CI-CD.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [SECRETS.md](SECRETS.md).

## 🎯 Overview

This guide covers deploying ResourceManager on a 2GB Ubuntu VPS using Docker Compose. The configuration is optimized for low-memory environments while maintaining production-grade security and reliability.

For detailed CI/CD pipeline information and GitHub Container Registry (GHCR) setup, please refer to the dedicated CI/CD documentation files.

## 📋 Quick Reference

- **CI/CD Pipeline**: See [CI-CD.md](CI-CD.md)
- **Deployment Checklist**: See [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) 
- **Secrets Configuration**: See [SECRETS.md](SECRETS.md)
- **Workflow Diagrams**: See [WORKFLOW-DIAGRAM.txt](WORKFLOW-DIAGRAM.txt)

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

### 3. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment

```bash
# Check all containers are running
docker ps

# Test health endpoints
curl http://localhost:80/health        # Frontend
curl http://localhost:5000/health      # Backend API

# Monitor resource usage
docker stats
```

## Security Hardening

### 1. Firewall Configuration

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

### 2. SSL/TLS (HTTPS)

For production deployments, enable HTTPS using Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com
```

## Backup & Recovery

### Automated Backups

See [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) for backup procedures.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs <service-name>
```

### Database Connection Errors

```bash
# Verify PostgreSQL is healthy
docker compose -f docker-compose.prod.yml logs postgres_db

# Check network connectivity
docker compose -f docker-compose.prod.yml exec api ping postgres_db
```

## CI/CD Integration

This repository includes automated CI/CD pipelines using GitHub Actions and GitHub Container Registry (GHCR).

**Key CI/CD Features:**
- Automated builds on push to master
- Docker image publishing to GHCR
- Zero-downtime deployments
- Health check verification
- Automatic rollback on failure

For complete CI/CD documentation, see:
- [CI-CD.md](CI-CD.md) - Pipeline architecture
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures  
- [SECRETS.md](SECRETS.md) - GitHub Secrets configuration

## Additional Resources

- [ARCHITECTURE_DIAGRAM.txt](ARCHITECTURE_DIAGRAM.txt) - Visual architecture diagrams
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command cheat sheet
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Configuration summary
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Performance Tuning](https://pgtune.leopard.in.ua/)
- [Nginx Optimization](https://www.nginx.com/blog/tuning-nginx/)

---

**Version**: 2.0 (Integrated with CI/CD)
**Last Updated**: 2024
**Tested On**: Ubuntu 22.04 LTS with Docker 24.0.7
