# Quick Start - Production Deployment

## TL;DR - Deploy in 5 Minutes

### 1. Prepare Server (Ubuntu VPS)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```

### 2. Clone Repository

```bash
sudo mkdir -p /opt/resourcemanager
sudo chown $USER:$USER /opt/resourcemanager
cd /opt/resourcemanager
git clone https://github.com/h-heni/ResourceManager.git .
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env

# Set these values:
# POSTGRES_PASSWORD=$(openssl rand -base64 24)
# JWT_KEY=$(openssl rand -base64 48)
```

### 4. Deploy

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d

# Run migrations (first time only)
docker compose -f docker-compose.prod.yml exec api dotnet ef database update
```

### 5. Access

Open browser: `http://YOUR_SERVER_IP`

---

## Architecture

```
Internet (Port 80)
    ↓
[Nginx Reverse Proxy] (:80)
    ├── /     → [Web Container] (:80)  - React Frontend
    └── /api  → [API Container] (:8080) - .NET Backend
                        ↓
                [PostgreSQL] (:5432)
```

**Key Points:**
- Only Nginx is exposed to internet (port 80)
- All containers on internal network (`rm-internal`)
- Frontend and API not directly accessible

---

## Files Created

- `nginx/nginx.conf` - Reverse proxy configuration (HTTP + HTTPS template)
- `nginx/Dockerfile` - Nginx container build
- `docker-compose.prod.yml` - Production orchestration
- `DEPLOYMENT.md` - Full deployment guide

## Files Modified

- `ClientApp/nginx.conf` - Now serves only React (no API proxying)

---

## Common Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop everything
docker compose -f docker-compose.prod.yml down

# Update application
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

---

## Upgrade to HTTPS Later

1. Point domain to server IP
2. Install Certbot: `sudo apt install certbot -y`
3. Get certificate: `sudo certbot certonly --standalone -d yourdomain.com`
4. Edit `nginx/nginx.conf` - uncomment HTTPS block
5. Edit `docker-compose.prod.yml` - mount certificates
6. Allow port 443: `sudo ufw allow 443/tcp`
7. Rebuild: `docker compose -f docker-compose.prod.yml up -d --build`

See `DEPLOYMENT.md` for detailed instructions.

---

## Troubleshooting

**Can't reach server?**
```bash
sudo ufw status              # Check firewall
docker compose -f docker-compose.prod.yml ps  # Check containers
docker compose -f docker-compose.prod.yml logs nginx  # Check logs
```

**502 Bad Gateway?**
```bash
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml restart api
```

---

For full documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
