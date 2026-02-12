# Blue-Green Deployment - Setup Checklist

Use this checklist to set up Blue-Green deployment on your VPS.

## 📋 Pre-Deployment Checklist

### 1. VPS Requirements
- [ ] Ubuntu 20.04+ or Debian 11+ installed
- [ ] Minimum 4GB RAM (8GB recommended)
- [ ] Minimum 20GB storage
- [ ] SSH access configured
- [ ] Firewall allows ports: 22 (SSH), 80 (HTTP), 443 (HTTPS - optional)

### 2. Software Installation
- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker compose version` or `docker-compose --version`
- [ ] User added to docker group: `groups | grep docker`
- [ ] Git installed (optional): `git --version`

### 3. Repository Files
- [ ] `docker-compose.blue-green.yml` uploaded to VPS
- [ ] `nginx/blue-green.conf` uploaded to VPS
- [ ] `scripts/deploy-blue-green.sh` uploaded to VPS
- [ ] `scripts/rollback-blue-green.sh` uploaded to VPS
- [ ] Scripts are executable: `chmod +x scripts/*.sh`

### 4. Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `POSTGRES_PASSWORD` set (strong password)
- [ ] `JWT_KEY` set (min 32 characters, use: `openssl rand -base64 48`)
- [ ] `API_IMAGE` set (Docker image path)
- [ ] `WEB_IMAGE` set (Docker image path)
- [ ] `ACTIVE_ENV=blue` set (initial environment)

## 🚀 Initial Deployment Checklist

### Step 1: Database Setup
```bash
cd /opt/resourcemanager
```
- [ ] Start PostgreSQL: `docker-compose -f docker-compose.blue-green.yml up -d postgres_db`
- [ ] Wait 10 seconds: `sleep 10`
- [ ] Check health: `docker-compose -f docker-compose.blue-green.yml ps postgres_db`
- [ ] Database should show "healthy" status

### Step 2: Blue Environment Setup (Initial)
```bash
# Start Blue environment
docker-compose -f docker-compose.blue-green.yml up -d blue-api blue-web
```
- [ ] Wait 30 seconds for startup: `sleep 30`
- [ ] Check API health: `curl -f http://localhost:7175/health`
- [ ] Check Web health: `curl -f http://localhost:8080/health`
- [ ] Both should return 200 OK

### Step 3: Nginx Setup
```bash
# Start Nginx
docker-compose -f docker-compose.blue-green.yml up -d nginx
```
- [ ] Wait 5 seconds: `sleep 5`
- [ ] Check overall health: `curl -f http://localhost/health`
- [ ] Check API via proxy: `curl -f http://localhost/api/health`
- [ ] Verify active environment: `curl -I http://localhost/health | grep X-Deployment-Env`
- [ ] Should show: `X-Deployment-Env: blue`

### Step 4: Verify Complete Stack
- [ ] All containers running: `docker-compose -f docker-compose.blue-green.yml ps`
- [ ] No errors in logs: `docker-compose -f docker-compose.blue-green.yml logs --tail=50`
- [ ] Can access application: Open browser to `http://YOUR-VPS-IP`
- [ ] Can login with test credentials

## 🔄 First Deployment Test

### Test Deployment to Green
```bash
# Run deployment script
./scripts/deploy-blue-green.sh
```

- [ ] Script detects Blue as active
- [ ] Script deploys to Green
- [ ] Health checks pass
- [ ] Traffic switches to Green
- [ ] Monitoring completes
- [ ] Blue environment stops
- [ ] Can still access application

### Test Rollback to Blue
```bash
# Run rollback script
./scripts/rollback-blue-green.sh
```

- [ ] Script detects Green as active
- [ ] Script starts Blue
- [ ] Health checks pass
- [ ] Traffic switches back to Blue
- [ ] Green environment stops
- [ ] Can still access application

## 🔐 Security Checklist

### Firewall
- [ ] Only necessary ports open: 22, 80, (443 for HTTPS)
- [ ] SSH configured with key authentication only
- [ ] Root login disabled
- [ ] Fail2ban or similar installed

### Secrets
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] `.env` not committed to git
- [ ] JWT_KEY is strong and random
- [ ] Database password is strong
- [ ] No hardcoded secrets in docker-compose files

### Docker
- [ ] Docker containers run as non-root users
- [ ] Unnecessary ports not exposed to host
- [ ] Images from trusted sources
- [ ] Regular image updates scheduled

## 📊 Monitoring Setup

### Health Endpoints
- [ ] Test: `curl http://localhost/health`
- [ ] Test: `curl http://localhost/api/health`
- [ ] Test: `curl http://localhost:7175/health` (Blue API)
- [ ] Test: `curl http://localhost:7176/health` (Green API)
- [ ] Test: `curl http://localhost:8080/health` (Blue Web)
- [ ] Test: `curl http://localhost:8081/health` (Green Web)

### Monitoring Tools (Optional)
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- [ ] Set up log aggregation (e.g., Loki, ELK)
- [ ] Set up metrics collection (e.g., Prometheus)
- [ ] Set up alerting (e.g., AlertManager, PagerDuty)

## 🔧 CI/CD Integration

### GitHub Secrets
- [ ] `VPS_HOST` added to GitHub Secrets
- [ ] `VPS_USER` added to GitHub Secrets
- [ ] `SSH_PRIVATE_KEY` added to GitHub Secrets

### GitHub Variables (Optional)
- [ ] `DEPLOY_PATH` set (default: `/opt/resourcemanager`)

### Workflow Test
- [ ] Push to main branch triggers workflow
- [ ] Images build successfully
- [ ] Images push to GHCR
- [ ] SSH connection works
- [ ] Deployment script runs
- [ ] Application updates successfully

## 📝 Documentation

### Team Onboarding
- [ ] Team has access to this checklist
- [ ] Team has read BLUE_GREEN_DEPLOYMENT.md
- [ ] Team has read QUICK_REFERENCE.md
- [ ] Team knows how to rollback
- [ ] Team knows where to find logs

### Runbooks
- [ ] Deployment procedure documented
- [ ] Rollback procedure documented
- [ ] Emergency contacts documented
- [ ] Escalation path defined
- [ ] Disaster recovery plan created

## ✅ Post-Deployment Verification

### Functional Tests
- [ ] Can access login page
- [ ] Can login with credentials
- [ ] Can create invoice
- [ ] Can view dashboard
- [ ] Can generate PDF
- [ ] Email sending works (if configured)

### Performance Tests
- [ ] Response time acceptable (< 2s)
- [ ] No memory leaks: `docker stats`
- [ ] No excessive CPU usage
- [ ] Database queries optimized

### Load Tests (Optional)
- [ ] Application handles expected concurrent users
- [ ] No degradation during deployment
- [ ] Rollback time acceptable (< 1 min)

## 🎯 Production Readiness

### Infrastructure
- [ ] Backups configured (database)
- [ ] Log rotation configured
- [ ] Disk space monitoring setup
- [ ] SSL/TLS certificates installed (for HTTPS)
- [ ] CDN configured (optional)

### Application
- [ ] Environment variables correct
- [ ] Database migrations tested
- [ ] Error handling tested
- [ ] Security headers configured
- [ ] Rate limiting configured (if needed)

### Operations
- [ ] Deployment schedule defined
- [ ] Maintenance window defined
- [ ] On-call rotation defined
- [ ] Incident response plan created
- [ ] Communication plan defined

## 🚨 Emergency Procedures

### Quick Links
- **Health Check**: `curl http://localhost/health`
- **Emergency Rollback**: `./scripts/rollback-blue-green.sh`
- **Check Active Env**: `grep ACTIVE_ENV .env`
- **View Logs**: `docker-compose -f docker-compose.blue-green.yml logs [service]`
- **Restart All**: `docker-compose -f docker-compose.blue-green.yml restart`

### Emergency Contacts
- [ ] DevOps lead contact info documented
- [ ] Backend lead contact info documented
- [ ] Database admin contact info documented
- [ ] VPS provider support info documented

## 📅 Maintenance Schedule

### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review deployment logs
- [ ] Test backup restoration
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Security updates applied
- [ ] Performance review
- [ ] Capacity planning review
- [ ] Disaster recovery drill

## 🎓 Training Checklist

### Developer Training
- [ ] Understands Blue-Green concept
- [ ] Can deploy to staging
- [ ] Can read deployment logs
- [ ] Knows how to rollback
- [ ] Has access to documentation

### Operations Training
- [ ] Can SSH to VPS
- [ ] Can run deployment script
- [ ] Can run rollback script
- [ ] Can troubleshoot common issues
- [ ] Knows escalation procedure

## 📖 Resources

- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Full Guide**: [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Main README**: [README.md](README.md)

---

## ✨ Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| DevOps Lead | | | |
| Backend Lead | | | |
| QA Lead | | | |
| Project Manager | | | |

**Deployment Date**: _______________

**Notes**:
```
[Add any deployment-specific notes here]
```

---

**Status**: 
- [ ] Ready for Production
- [ ] Needs Review
- [ ] Blocked (explain why)

**Next Steps**:
1. _________________________________
2. _________________________________
3. _________________________________
