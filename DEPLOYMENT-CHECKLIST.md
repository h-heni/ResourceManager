# ✅ Deployment Checklist

Quick checklist for deploying ResourceManager to production. Follow this after setting up your VPS.

---

## Pre-Deployment Checklist

### 1. VPS Setup
- [ ] Ubuntu 20.04+ or Debian 11+ installed
- [ ] Minimum 2GB RAM available
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Deploy user created with docker group access
- [ ] Deployment directory created: `/opt/resourcemanager`

### 2. SSH Configuration
- [ ] SSH key pair generated locally
- [ ] Public key added to VPS `~/.ssh/authorized_keys`
- [ ] SSH connection tested successfully
- [ ] No password required for SSH login

### 3. GitHub Container Registry Setup
- [ ] GitHub Personal Access Token generated
- [ ] Token has `read:packages` scope
- [ ] Token saved securely

### 4. GitHub Secrets Configuration
- [ ] `VPS_HOST` added (IP or domain)
- [ ] `VPS_USER` added (deploy user)
- [ ] `VPS_SSH_KEY` added (private key content)
- [ ] `VPS_PORT` added (if not 22)
- [ ] `GHCR_TOKEN` added (for VPS to pull images)

### 5. GitHub Environment Setup
- [ ] Production environment created
- [ ] Protection rules configured (optional but recommended)
- [ ] Required reviewers added (optional)

### 6. VPS Environment File
- [ ] `.env` file created on VPS
- [ ] Strong PostgreSQL password set
- [ ] JWT secret generated (48+ characters)
- [ ] Database credentials configured
- [ ] Image names will be updated by CI/CD

---

## First Deployment

### Step 1: Prepare Code
```bash
# Ensure code is ready on main branch
git checkout main
git pull origin main
```

### Step 2: Trigger CI/CD
```bash
# Push to main (if changes exist)
git push origin main

# Or commit a small change
git commit --allow-empty -m "trigger: initial production deployment"
git push origin main
```

### Step 3: Wait for Build
- [ ] Go to GitHub → Actions → CI/CD Pipeline
- [ ] Wait for all jobs to complete (build, test, docker)
- [ ] Verify Docker images pushed to GHCR successfully
- [ ] Check for any errors in logs

### Step 4: Deploy to VPS
- [ ] Go to GitHub → Actions → Deploy to VPS
- [ ] Click "Run workflow"
- [ ] Select environment: `production`
- [ ] Keep tag as: `latest`
- [ ] Click "Run workflow"
- [ ] Approve deployment (if protection rules enabled)

### Step 5: Monitor Deployment
- [ ] Watch workflow logs in GitHub Actions
- [ ] SSH into VPS: `ssh deploy@your-vps-ip`
- [ ] Check services: `docker compose ps`
- [ ] View logs: `docker compose logs -f api`

### Step 6: Verify Deployment
- [ ] API health: `curl http://your-vps-ip:7175/health`
- [ ] Web health: `curl http://your-vps-ip/health`
- [ ] Open in browser: `http://your-vps-ip`
- [ ] Test login with default account
- [ ] Check database connection works

---

## Post-Deployment

### Immediate Actions
- [ ] Change default test account password
- [ ] Test all critical features
- [ ] Monitor logs for errors
- [ ] Set up backup automation
- [ ] Document your production URL

### Security Hardening
- [ ] Enable HTTPS with Caddy or Let's Encrypt
- [ ] Update `.env` with production domain
- [ ] Configure CORS for production domain
- [ ] Disable Swagger in production (optional)
- [ ] Enable automatic security updates on VPS

### Monitoring Setup (Optional)
- [ ] Set up log aggregation
- [ ] Configure uptime monitoring
- [ ] Set up alerts for failures
- [ ] Monitor disk space usage

---

## Regular Deployment Workflow

### For Future Updates

1. **Make Changes**
   ```bash
   git checkout -b feature/my-feature
   # ... make changes ...
   git commit -m "feat: add new feature"
   git push origin feature/my-feature
   ```

2. **Create Pull Request**
   - [ ] Open PR to `main` branch
   - [ ] Wait for CI to pass
   - [ ] Get code review
   - [ ] Merge PR

3. **Deploy**
   - [ ] Go to Actions → Deploy to VPS
   - [ ] Run workflow for production
   - [ ] Monitor deployment
   - [ ] Verify changes

4. **Verify**
   - [ ] Test new features work
   - [ ] Check for errors in logs
   - [ ] Monitor performance

---

## Rollback Procedure

### If Deployment Fails

**Automatic Rollback:**
- If health checks fail, old version stays running
- Check workflow logs for error details

**Manual Rollback:**

1. **Option A: Deploy Previous Version**
   ```bash
   # In GitHub Actions → Deploy to VPS
   # Set tag to previous commit SHA (e.g., abc1234)
   ```

2. **Option B: SSH Rollback**
   ```bash
   ssh deploy@your-vps-ip
   cd /opt/resourcemanager
   
   # Edit .env to use previous image
   nano .env
   # Change: API_IMAGE=username/resourcemanager-api:previous-sha
   
   # Restart
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
   ```

---

## Common Issues & Quick Fixes

### Issue: Health Check Timeout
```bash
# SSH into VPS
docker compose logs api | tail -100
# Check for database connection errors
docker compose exec postgres_db pg_isready
```

### Issue: Database Connection Failed
```bash
# Verify database is running
docker compose ps postgres_db
# Check connection string in .env
cat .env | grep POSTGRES
```

### Issue: Out of Memory
```bash
# Check memory usage
free -h
docker stats --no-stream
# Consider adding swap or reducing container limits
```

### Issue: Port Already in Use
```bash
# Find what's using the port
lsof -i :80
lsof -i :7175
# Stop conflicting service or change ports
```

### Issue: Images Not Pulling
```bash
# Login to GHCR manually
echo "$GHCR_TOKEN" | docker login ghcr.io -u h-heni --password-stdin
# Try pulling manually
docker pull ghcr.io/h-heni/resourcemanager-api:latest
```

---

## Backup & Disaster Recovery

### Create Backup
```bash
ssh deploy@your-vps-ip
cd /opt/resourcemanager

# Backup database
docker compose exec -T postgres_db pg_dump -U rmuser resourcemanager | gzip > backup_$(date +%Y%m%d).sql.gz

# Backup .env file
cp .env env_backup_$(date +%Y%m%d)
```

### Restore Backup
```bash
# Restore database
gunzip < backup_YYYYMMDD.sql.gz | docker compose exec -T postgres_db psql -U rmuser resourcemanager
```

### Automate Backups
```bash
# Create backup script
nano /opt/resourcemanager/backup.sh
# Add backup commands from DEPLOYMENT.md

# Make executable
chmod +x /opt/resourcemanager/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/resourcemanager/backup.sh >> /opt/resourcemanager/backup.log 2>&1
```

---

## Quick Commands Reference

### SSH to VPS
```bash
ssh deploy@your-vps-ip
cd /opt/resourcemanager
```

### Check Status
```bash
docker compose ps                          # Service status
docker compose logs -f api                 # Follow API logs
docker stats --no-stream                   # Resource usage
docker system df                           # Disk usage
```

### Restart Services
```bash
docker compose restart api                 # Restart API only
docker compose restart web                 # Restart frontend only
docker compose down && docker compose up -d # Restart all
```

### Update Services
```bash
docker compose pull                        # Pull latest images
docker compose up -d                       # Recreate with new images
```

### View Logs
```bash
docker compose logs --tail=100 api         # Last 100 lines
docker compose logs --since 1h api         # Last hour
docker compose logs -f api                 # Follow live logs
```

### Cleanup
```bash
docker image prune -a --filter "until=72h" # Remove old images (3+ days)
docker system prune                        # Clean up unused resources
```

---

## Documentation Reference

- 📖 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide (read this first!)
- 🔐 **[SECRETS.md](./SECRETS.md)** - GitHub Secrets setup guide
- 🚀 **[CI-CD.md](./CI-CD.md)** - Pipeline architecture and workflows
- 📝 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Local development setup

---

## Support

**Found an issue?**
- Check documentation above
- Review GitHub Actions logs
- Check VPS docker logs
- Search existing GitHub issues
- Open new issue with logs (remove sensitive data)

**Need help?**
- Read detailed guides in documentation
- Check troubleshooting sections
- Review common issues above

---

## Success Criteria

Your deployment is successful when:

- ✅ All services running (`docker compose ps` shows "Up")
- ✅ Health endpoints responding (200 OK)
- ✅ Can login to application
- ✅ Database operations work
- ✅ No errors in logs
- ✅ Application accessible from browser

---

**Status**: Ready for Production | **Version**: 1.0 | **Last Updated**: 2024
