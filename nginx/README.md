# Nginx Reverse Proxy

This directory contains the configuration for the production Nginx reverse proxy.

## Files

- **nginx.conf** - Main nginx configuration file
  - HTTP server on port 80 (active)
  - HTTPS server on port 443 (commented out, ready for SSL)
  - Routes `/` to React frontend (web container)
  - Routes `/api` to .NET backend (api container)
  - Gzip compression enabled
  - Security headers configured
  - Rate limiting enabled

- **Dockerfile** - Container build file for nginx

## Usage

The nginx service is included in `docker-compose.prod.yml`:

```bash
# Build nginx image
docker compose -f docker-compose.prod.yml build nginx

# Start nginx with all services
docker compose -f docker-compose.prod.yml up -d

# View nginx logs
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

## Testing Configuration

To test the nginx configuration syntax:

```bash
# Note: This will show "host not found" errors for 'api' and 'web'
# This is expected - these hostnames only exist in the Docker network
docker run --rm -v "$(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t
```

## Upgrading to HTTPS

To enable HTTPS after obtaining SSL certificates:

1. Update `server_name` in nginx.conf (replace `_` with your domain)
2. Uncomment the HTTPS server block (line ~180)
3. Uncomment the HTTP to HTTPS redirect (bottom of file)
4. Update docker-compose.prod.yml to mount SSL certificates
5. Rebuild and restart nginx

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed instructions.

## Architecture

```
Internet (Port 80)
    ↓
[Nginx Reverse Proxy]
    ├── /     → http://web:80      (React frontend)
    └── /api  → http://api:8080    (Backend API)
```

## Configuration Highlights

### Performance
- Gzip compression (6 levels)
- Worker processes auto-detect CPU cores
- TCP optimizations (tcp_nopush, tcp_nodelay)
- Efficient buffer sizes

### Security
- Server tokens hidden
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Rate limiting (100 req/min for API, 200 req/min for general)
- Max upload size: 25MB

### Monitoring
- Health check endpoint at `/health`
- Access and error logs in `/var/log/nginx/`

## Customization

Edit `nginx.conf` to:
- Change rate limits (search for `limit_req_zone`)
- Modify timeouts (search for `timeout`)
- Add custom headers
- Enable/disable Swagger endpoint
- Configure Content-Security-Policy

After changes:
```bash
docker compose -f docker-compose.prod.yml up -d --build nginx
```
