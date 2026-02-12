# Blue-Green Deployment - Quick Reference

## 📋 Quick Start

### Initial Setup (One-time)
```bash
# On VPS
cd /opt/resourcemanager
cp .env.example .env
# Edit .env with your secrets
nano .env

# Start Blue environment
docker-compose -f docker-compose.blue-green.yml up -d postgres_db blue-api blue-web nginx
```

### Deploy New Version (Zero Downtime)
```bash
# Automated
./scripts/deploy-blue-green.sh

# Manual (if needed)
# 1. Pull images
docker-compose -f docker-compose.blue-green.yml pull green-api green-web

# 2. Start green
docker-compose -f docker-compose.blue-green.yml up -d green-api green-web

# 3. Health check
curl http://localhost:7176/health  # Green API
curl http://localhost:8081/health  # Green Web

# 4. Switch traffic
sed -i 's/ACTIVE_ENV=blue/ACTIVE_ENV=green/' .env
docker exec nginx nginx -s reload

# 5. Monitor and stop old
docker-compose -f docker-compose.blue-green.yml stop blue-api blue-web
```

### Rollback (< 30 seconds)
```bash
# Automated
./scripts/rollback-blue-green.sh

# Emergency (instant)
sed -i 's/ACTIVE_ENV=green/ACTIVE_ENV=blue/' .env
docker exec nginx nginx -s reload
```

## 🔍 Health Checks

```bash
# Overall health
curl http://localhost/health

# Direct environment health
curl http://localhost:7175/health  # Blue API
curl http://localhost:7176/health  # Green API
curl http://localhost:8080/health  # Blue Web
curl http://localhost:8081/health  # Green Web

# Check active environment
curl -I http://localhost/health | grep X-Deployment-Env
```

## 🔧 Troubleshooting

### Check Container Status
```bash
docker-compose -f docker-compose.blue-green.yml ps
docker stats
```

### View Logs
```bash
# Blue environment
docker-compose -f docker-compose.blue-green.yml logs -f blue-api
docker-compose -f docker-compose.blue-green.yml logs -f blue-web

# Green environment
docker-compose -f docker-compose.blue-green.yml logs -f green-api
docker-compose -f docker-compose.blue-green.yml logs -f green-web

# Nginx
docker-compose -f docker-compose.blue-green.yml logs -f nginx
```

### Test Environment Directly
```bash
# Test Blue directly
curl http://localhost:8090/health

# Test Green directly
curl http://localhost:8091/health
```

### Database Issues
```bash
# Check PostgreSQL
docker-compose -f docker-compose.blue-green.yml logs postgres_db

# Connect to database
docker exec -it postgres_db psql -U rmuser -d resourcemanager
```

### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tlnp | grep -E ':(80|5432|7175|7176|8080|8081)\s'

# Stop system nginx if needed
sudo systemctl stop nginx
```

## 📊 Monitoring

### Check Which Environment is Active
```bash
grep ACTIVE_ENV .env
curl -I http://localhost/health | grep X-Deployment-Env
```

### Resource Usage
```bash
docker stats --no-stream
df -h
docker system df
```

### Cleanup
```bash
# Remove old images
docker image prune -a

# Remove unused containers
docker-compose -f docker-compose.blue-green.yml down --remove-orphans

# Full cleanup (careful!)
docker system prune -a --volumes
```

## 🎯 Deployment Workflow

```
┌─────────────────────────────────────┐
│ 1. Push to main branch              │
│    └─> Triggers GitHub Actions      │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 2. Build Docker images              │
│    └─> Push to GHCR                 │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 3. SSH to VPS                       │
│    └─> Run deploy-blue-green.sh     │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 4. Deploy to inactive environment   │
│    (Blue → Green or Green → Blue)   │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 5. Health checks (30s)              │
│    ├─> API health                   │
│    └─> Web health                   │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 6. Switch Nginx traffic (< 0.1s)   │
│    └─> nginx -s reload              │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 7. Monitor new env (5 min)          │
│    └─> Continuous health checks     │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 8. Stop old environment             │
│    └─> Free up resources            │
└─────────────────────────────────────┘
```

## 🚨 Emergency Procedures

### Total Failure - Both Environments Down
```bash
# 1. Check logs
docker-compose -f docker-compose.blue-green.yml logs

# 2. Restart database
docker-compose -f docker-compose.blue-green.yml restart postgres_db

# 3. Start both environments
docker-compose -f docker-compose.blue-green.yml up -d blue-api blue-web green-api green-web

# 4. Check which one is healthy
curl http://localhost:7175/health  # Blue
curl http://localhost:7176/health  # Green

# 5. Point to healthy one
echo "ACTIVE_ENV=blue" >> .env  # or green
docker exec nginx nginx -s reload
```

### Nginx Configuration Issues
```bash
# Test nginx config
docker exec nginx nginx -t

# Restart nginx
docker-compose -f docker-compose.blue-green.yml restart nginx

# Check nginx logs
docker-compose -f docker-compose.blue-green.yml logs nginx
```

### Database Migration Issues
```bash
# Rollback database migration (if needed)
# On VPS
docker-compose -f docker-compose.blue-green.yml exec blue-api dotnet ef database update <PreviousMigration>

# Or in development
dotnet ef database update <PreviousMigration>
```

## 📝 Best Practices

1. **Always test in staging first**
2. **Monitor for 5-10 minutes before stopping old environment**
3. **Keep both environments running during deployment**
4. **Run health checks after every change**
5. **Document any manual changes made**
6. **Keep .env file backed up**
7. **Prune Docker images regularly**
8. **Set up monitoring alerts**

## 🔐 Security Checklist

- [ ] .env file has secure passwords (not default)
- [ ] JWT_KEY is cryptographically random (48+ chars)
- [ ] Database password is strong
- [ ] Firewall allows only necessary ports (80, 443, SSH)
- [ ] SSH key authentication only (no passwords)
- [ ] Docker images are updated regularly
- [ ] Nginx security headers are configured
- [ ] SSL/TLS certificates are installed (when using HTTPS)

## 📞 Support

For issues:
1. Check logs: `docker-compose -f docker-compose.blue-green.yml logs`
2. Review BLUE_GREEN_DEPLOYMENT.md
3. Check GitHub Issues
4. Contact DevOps team

## 🔗 Resources

- Full Guide: [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md)
- Docker Compose: [docker-compose.blue-green.yml](docker-compose.blue-green.yml)
- Nginx Config: [nginx/blue-green.conf](nginx/blue-green.conf)
- Deployment Script: [scripts/deploy-blue-green.sh](scripts/deploy-blue-green.sh)
- Rollback Script: [scripts/rollback-blue-green.sh](scripts/rollback-blue-green.sh)
