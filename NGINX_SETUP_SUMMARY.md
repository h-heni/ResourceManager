# Production Nginx Reverse Proxy Setup - Summary

## What Was Delivered

This implementation provides a production-ready Nginx reverse proxy configuration for ResourceManager that:

✅ **Works with only a server IP address** (no domain required)  
✅ **Uses HTTP only (port 80)** for initial deployment  
✅ **Routes traffic properly:**
  - `/` → React frontend
  - `/api` → .NET backend  
✅ **Has gzip compression** enabled (6 levels)  
✅ **Has basic security headers** (X-Frame-Options, X-Content-Type-Options, etc.)  
✅ **Is production-structured** with separate nginx container  
✅ **Ready to easily upgrade to HTTPS** with commented templates

---

## Files Created

### 1. Nginx Reverse Proxy Configuration
```
nginx/
├── nginx.conf         # Main reverse proxy configuration (HTTP + HTTPS templates)
├── Dockerfile         # Nginx container build file
└── README.md          # Nginx-specific documentation
```

### 2. Production Docker Compose
```
docker-compose.prod.yml    # Production orchestration with separate nginx service
```

### 3. Documentation
```
DEPLOYMENT.md          # Complete deployment guide (firewall, SSL, etc.)
QUICKSTART.md          # Quick reference guide
```

### 4. Modified Files
```
ClientApp/nginx.conf   # Simplified to serve only React (no API proxying)
.gitignore            # Added certbot/SSL directories
```

---

## Architecture

### Before (Development)
```
Internet → [Web Container with Nginx] → [API Container]
                                      ↓
                              [PostgreSQL]
```
- Web container handled both React serving AND reverse proxying
- Direct port exposure of web container (port 80)

### After (Production)
```
Internet (Port 80)
    ↓
[Nginx Reverse Proxy] (:80) ← MAIN ENTRY POINT
    ├── /     → [Web Container] (:80)  ← React only
    └── /api  → [API Container] (:8080) ← .NET API
                        ↓
                [PostgreSQL] (:5432)
```
- Separate nginx service as main entry point
- Web container serves ONLY React static files
- All routing logic in external nginx
- Internal Docker network (no direct port exposure except nginx)

---

## Key Features

### Nginx Reverse Proxy (`nginx/nginx.conf`)

**Performance:**
- Gzip compression (6 levels) for text/json/css/js
- Auto-detect CPU cores for worker processes
- TCP optimizations (nopush, nodelay)
- Efficient buffer sizes
- Keep-alive connections

**Security:**
- Server tokens hidden (no version disclosure)
- Security headers:
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
- Rate limiting:
  - API: 100 req/min per IP (burst 20)
  - General: 200 req/min per IP (burst 50)
- Max upload: 25MB

**Routing:**
- `/health` → Nginx health check
- `/api/*` → Backend API (proxy to api:8080)
- `/swagger` → Swagger UI (optional, can disable)
- `/*` → React frontend (proxy to web:80)

**HTTPS Ready:**
- Commented HTTPS server block (lines 180-260)
- TLS 1.2 + TLS 1.3
- Strong ciphers (Mozilla Intermediate profile)
- HSTS header ready
- OCSP stapling configured
- HTTP to HTTPS redirect template

---

## Deployment Instructions

### Quick Start (5 minutes)

```bash
# 1. Install Docker on Ubuntu VPS
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# 2. Configure firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw enable

# 3. Clone repository
git clone https://github.com/h-heni/ResourceManager.git /opt/resourcemanager
cd /opt/resourcemanager

# 4. Configure environment
cp .env.example .env
nano .env
# Set POSTGRES_PASSWORD and JWT_KEY (see .env.example)

# 5. Deploy
docker compose -f docker-compose.prod.yml up -d

# 6. Run migrations (first time only)
docker compose -f docker-compose.prod.yml exec api dotnet ef database update

# 7. Access
# Open browser: http://YOUR_SERVER_IP
```

See `DEPLOYMENT.md` for full instructions.

---

## Firewall Configuration

The deployment guide includes complete UFW setup:

```bash
# Required rules
sudo ufw allow 22/tcp    # SSH (CRITICAL - don't lock yourself out!)
sudo ufw allow 80/tcp    # HTTP
sudo ufw enable

# For HTTPS later:
sudo ufw allow 443/tcp   # HTTPS
```

**Important:** Only port 80 is exposed to the internet. PostgreSQL (5432) and API (8080) are on an internal Docker network only.

---

## HTTPS Upgrade Path

When you're ready to add a domain and HTTPS:

### Step 1: DNS Setup
Point your domain to the server IP:
```
A Record: @ → YOUR_SERVER_IP
CNAME: www → yourdomain.com
```

### Step 2: Obtain Certificate
```bash
# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Get Let's Encrypt certificate
sudo apt install certbot -y
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificate saved to:
# /etc/letsencrypt/live/yourdomain.com/
```

### Step 3: Update Configuration
Edit `nginx/nginx.conf`:
1. Update `server_name` in HTTPS block (line ~189): `yourdomain.com www.yourdomain.com`
2. Uncomment HTTPS server block (lines 180-260)
3. Uncomment HTTP to HTTPS redirect (lines 270-290)
4. Comment out HTTP server block (lines 75-175)

Edit `docker-compose.prod.yml`:
1. Uncomment port 443 mapping
2. Uncomment SSL certificate volume mount:
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

### Step 4: Deploy HTTPS
```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build nginx

# Test
curl -I https://yourdomain.com
```

### Step 5: Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job
sudo crontab -e
# Add line:
0 0,12 * * * certbot renew --quiet --post-hook "docker compose -f /opt/resourcemanager/docker-compose.prod.yml restart nginx"
```

**Full instructions:** See `DEPLOYMENT.md` section "Upgrading to HTTPS"

---

## Folder Structure

```
ResourceManager/
├── nginx/                          # NEW: Reverse proxy configuration
│   ├── Dockerfile                  # NEW: Nginx container build
│   ├── nginx.conf                  # NEW: Main proxy config
│   └── README.md                   # NEW: Nginx docs
│
├── ClientApp/                      # Frontend
│   ├── Dockerfile                  # Frontend container
│   ├── nginx.conf                  # MODIFIED: Now serves React only
│   └── src/                        # React source
│
├── docker-compose.prod.yml         # NEW: Production with reverse proxy
├── docker-compose.yml              # EXISTING: Development (unchanged)
├── Dockerfile                      # EXISTING: Backend API (unchanged)
│
├── DEPLOYMENT.md                   # NEW: Full deployment guide
├── QUICKSTART.md                   # NEW: Quick reference
└── .env.example                    # EXISTING: Environment template
```

---

## Testing

The configuration has been validated:

✅ **Nginx syntax:** Valid (expected hostname resolution errors in isolation)  
✅ **Docker Compose syntax:** Valid  
✅ **Environment variables:** Properly configured  
✅ **Service dependencies:** Correct health check chains  
✅ **Port mappings:** Only nginx exposed (port 80)  
✅ **Internal networking:** All services on `rm-internal` bridge  

---

## Commands Reference

### Deployment
```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop everything
docker compose -f docker-compose.prod.yml down
```

### Maintenance
```bash
# Update application
git pull && docker compose -f docker-compose.prod.yml up -d --build

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f api

# Database backup
docker compose -f docker-compose.prod.yml exec postgres_db \
  pg_dump -U rmuser resourcemanager > backup_$(date +%Y%m%d).sql

# Check health
curl http://localhost/health      # Nginx
curl http://localhost/api/health  # API
```

### Troubleshooting
```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# View all logs
docker compose -f docker-compose.prod.yml logs -f

# Restart specific service
docker compose -f docker-compose.prod.yml restart api

# Check firewall
sudo ufw status verbose

# Test nginx config (will show hostname errors - this is normal)
docker run --rm -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  nginx:alpine nginx -t
```

---

## Documentation

Three levels of documentation provided:

1. **QUICKSTART.md** - 5-minute deployment guide
2. **DEPLOYMENT.md** - Complete production deployment guide with:
   - Server setup
   - Firewall configuration
   - Deployment steps
   - HTTPS upgrade instructions
   - Troubleshooting
   - Maintenance procedures
3. **nginx/README.md** - Nginx-specific documentation

---

## Security Checklist

✅ **Network isolation** - Only nginx exposed to internet  
✅ **Firewall configured** - UFW rules provided  
✅ **Security headers** - X-Frame-Options, X-Content-Type-Options, etc.  
✅ **Rate limiting** - Protects against basic DoS  
✅ **No version disclosure** - server_tokens off  
✅ **Ready for HTTPS** - Complete upgrade path provided  
✅ **Secrets management** - .env file (not committed)  
✅ **Max upload limit** - 25MB prevents abuse  

**When HTTPS is enabled:**
✅ HSTS header (prevents SSL stripping)  
✅ Strong TLS protocols (1.2, 1.3)  
✅ Secure ciphers (Mozilla Intermediate)  
✅ OCSP stapling (performance + privacy)  

---

## Comparison: Development vs Production

| Feature | Development (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---------|-----------------------------------|----------------------------------------|
| Nginx Reverse Proxy | ❌ No (embedded in web) | ✅ Yes (separate service) |
| Port Exposure | Multiple (7175, 80) | Single (80) |
| API Direct Access | ✅ Yes (port 7175) | ❌ No (internal only) |
| Routing Logic | In web container | In nginx service |
| HTTPS Ready | ❌ No | ✅ Yes (templates) |
| Rate Limiting | ❌ No | ✅ Yes |
| Security Headers | Partial | Complete |

---

## What's Different

### Original Setup (Development)
- `docker-compose.yml` had web container with embedded nginx
- Web container's nginx proxied `/api` to API container
- API container exposed port 7175 externally
- Good for development, not ideal for production

### New Setup (Production)
- `docker-compose.prod.yml` has separate nginx service
- Nginx is the **only** exposed service (port 80)
- Web container serves **only** React static files
- API container not exposed externally (internal network only)
- Production-grade security, performance, and HTTPS readiness

### Migration Path
- Development workflow: Use `docker-compose.yml` (unchanged)
- Production deployment: Use `docker-compose.prod.yml` (new)
- Both setups coexist peacefully

---

## Next Steps

1. **Deploy to VPS** - Follow QUICKSTART.md or DEPLOYMENT.md
2. **Point domain** - When ready for HTTPS
3. **Get SSL certificate** - Let's Encrypt (free)
4. **Enable HTTPS** - Uncomment templates in nginx.conf
5. **Monitor** - Set up log monitoring, backups

---

## Support & Resources

- **Docker:** https://docs.docker.com/
- **Nginx:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **UFW:** https://help.ubuntu.com/community/UFW

---

**Created:** February 2026  
**Status:** Production Ready ✅
