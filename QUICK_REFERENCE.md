# ResourceManager - Quick Reference

## 🚀 Common Commands

### Deployment

```bash
# Start all services (production)
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart a specific service
docker compose -f docker-compose.prod.yml restart api

# Rebuild and restart (after code changes)
docker compose -f docker-compose.prod.yml up -d --build

# Pull latest images from GHCR
docker compose -f docker-compose.prod.yml pull
```

### CI/CD Operations

```bash
# Login to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images from GHCR
docker compose -f docker-compose.prod.yml pull

# Check GitHub Actions workflows
# Visit: https://github.com/h-heni/ResourceManager/actions

# Trigger manual deployment
# Go to Actions → Deploy to VPS → Run workflow
```

### Monitoring

```bash
# View all container status
docker compose -f docker-compose.prod.yml ps

# Real-time resource usage
docker stats

# View logs (all services)
docker compose -f docker-compose.prod.yml logs -f

# View logs (specific service)
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f postgres_db
docker compose -f docker-compose.prod.yml logs -f web

# Last 100 log lines
docker compose -f docker-compose.prod.yml logs --tail=100

# Logs with timestamps
docker compose -f docker-compose.prod.yml logs -t
```

### Maintenance

```bash
# Execute command in container
docker compose -f docker-compose.prod.yml exec api /bin/sh
docker compose -f docker-compose.prod.yml exec postgres_db psql -U rmuser -d resourcemanager

# Backup database
docker compose -f docker-compose.prod.yml exec postgres_db pg_dump -U rmuser resourcemanager > backup.sql

# Restore database
docker compose -f docker-compose.prod.yml exec -T postgres_db psql -U rmuser resourcemanager < backup.sql

# Clean up unused resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

### Troubleshooting

```bash
# Validate configuration
docker compose -f docker-compose.prod.yml config

# Check container health
docker compose -f docker-compose.prod.yml ps

# Inspect container details
docker inspect rm-api

# Check network connectivity
docker compose -f docker-compose.prod.yml exec api ping postgres_db

# View environment variables
docker compose -f docker-compose.prod.yml exec api env

# Restart unhealthy service
docker compose -f docker-compose.prod.yml restart <service-name>
```

### Security

```bash
# Generate JWT key
openssl rand -base64 48

# Generate database password
openssl rand -base64 24

# Check for security vulnerabilities (if Docker Scout available)
docker scout cves ghcr.io/h-heni/resourcemanager-api:latest

# Update images (security patches)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 📊 Resource Limits Summary

| Service    | CPU Limit | Memory Limit | Restart Policy |
|------------|-----------|--------------|----------------|
| PostgreSQL | 1.0       | 768M         | unless-stopped |
| Backend    | 1.5       | 1024M        | unless-stopped |
| Frontend   | 0.5       | 384M         | unless-stopped |

## 🔒 Security Checklist

- [ ] `.env` file created and configured
- [ ] Strong `POSTGRES_PASSWORD` set (24+ chars)
- [ ] Strong `JWT_KEY` set (48+ chars)
- [ ] CORS origins updated for production domain
- [ ] Firewall configured (UFW): ports 22, 80, 443
- [ ] GHCR authentication configured
- [ ] GitHub Secrets configured (if using CI/CD)
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Regular backups scheduled (cron job)
- [ ] Log monitoring set up

## 🔧 Performance Tuning

### If RAM usage is high:

```yaml
# In docker-compose.prod.yml, reduce limits:
api:
  deploy:
    resources:
      limits:
        memory: 768M  # Reduce from 1024M
```

### If CPU usage is high:

```yaml
# Increase CPU limits:
api:
  deploy:
    resources:
      limits:
        cpus: '2.0'  # Increase from 1.5
```

## 📁 File Structure

```
/opt/ResourceManager/
├── .github/workflows/         # CI/CD pipelines
│   ├── ci.yml                 # Main pipeline
│   └── deploy.yml             # VPS deployment
├── docker-compose.prod.yml    # Production configuration
├── .env                       # Environment variables (create from .env.example)
├── .env.example               # Template
├── Dockerfile                 # Backend image
├── ClientApp/
│   └── Dockerfile             # Frontend image
├── CI-CD.md                   # Pipeline architecture
├── DEPLOYMENT.md              # Deployment procedures
├── SECRETS.md                 # GitHub Secrets guide
└── DEPLOYMENT_GUIDE.md        # Full documentation
```

## 🔗 Important URLs

- **Frontend**: http://your-server-ip:80
- **API**: http://your-server-ip:5000
- **GitHub Actions**: https://github.com/h-heni/ResourceManager/actions
- **GHCR Registry**: https://github.com/h-heni?tab=packages
- **Health Checks**:
  - Frontend: http://your-server-ip:80/health
  - API: http://your-server-ip:5000/health

## 📞 Emergency Procedures

### CI/CD Pipeline Failed:

```bash
# Check GitHub Actions logs
# Visit: https://github.com/h-heni/ResourceManager/actions

# Manual deploy if automated deployment fails
ssh user@vps
cd /opt/ResourceManager
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Database corrupted:

```bash
# Stop services
docker compose -f docker-compose.prod.yml down

# Restore from backup
docker run --rm -v resourcemanager_postgres_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/postgres-backup.tar.gz --strip-components=1"

# Start services
docker compose -f docker-compose.prod.yml up -d
```

### Out of memory:

```bash
# Immediate: Restart containers
docker compose -f docker-compose.prod.yml restart

# Short-term: Enable swap
sudo fallocate -l 2G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Long-term: Reduce memory limits or upgrade VPS
```

### Service won't start:

```bash
# Check logs for errors
docker compose -f docker-compose.prod.yml logs <service>

# Remove and recreate
docker compose -f docker-compose.prod.yml rm -f <service>
docker compose -f docker-compose.prod.yml up -d <service>

# Last resort: Full reset
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

## 📈 Monitoring Thresholds

**Alert if:**
- Memory usage > 90% for > 5 minutes
- CPU usage > 80% for > 10 minutes
- Disk usage > 80%
- Container restart count > 3 in 1 hour
- Health check failures > 3 consecutive

**Check:**
```bash
# Memory
docker stats --no-stream

# Disk
df -h

# Container restarts
docker ps -a --filter "status=restarted"
```

## 📚 Documentation Quick Links

- **CI/CD Setup**: [CI-CD.md](CI-CD.md), [SECRETS.md](SECRETS.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md), [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Architecture**: [ARCHITECTURE_DIAGRAM.txt](ARCHITECTURE_DIAGRAM.txt)
- **Workflows**: [WORKFLOW-DIAGRAM.txt](WORKFLOW-DIAGRAM.txt)
- **Summary**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

For detailed information, see the complete documentation files listed above.
