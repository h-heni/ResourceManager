# Architecture Diagrams

## HTTP (Current Setup)

```
┌──────────────────────────────────────────────────────────────┐
│                      PUBLIC INTERNET                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Port 80 (HTTP)
                         │
                    ┌────▼─────┐
                    │   UFW    │ Firewall
                    │  Allow:  │ - Port 22 (SSH)
                    │  Port 80 │ - Port 80 (HTTP)
                    └────┬─────┘
                         │
                         │
        ┌────────────────▼────────────────┐
        │  Nginx Reverse Proxy Container  │
        │  resourcemanager-nginx          │
        │  ─────────────────────────────  │
        │  • Port 80 exposed to internet  │
        │  • Gzip compression             │
        │  • Security headers             │
        │  • Rate limiting                │
        │  • Health check: /health        │
        └────┬──────────────────┬─────────┘
             │                  │
             │                  │ Internal Docker Network
             │                  │ (rm-internal bridge)
    ┌────────▼────────┐   ┌────▼────────┐
    │  Web Container  │   │ API Container│
    │ resourcemanager │   │ resourcemana-│
    │      -web       │   │     ger-api  │
    │ ─────────────── │   │ ──────────── │
    │ • React + Nginx │   │ • .NET 8 API │
    │ • Port 80       │   │ • Port 8080  │
    │   (internal)    │   │   (internal) │
    │ • Static files  │   │ • JWT auth   │
    │   only          │   │ • REST API   │
    └─────────────────┘   └──────┬───────┘
                                 │
                                 │
                          ┌──────▼────────┐
                          │   PostgreSQL  │
                          │   Container   │
                          │  postgres_db  │
                          │ ────────────  │
                          │ • Port 5432   │
                          │   (internal)  │
                          │ • Data volume │
                          └───────────────┘

Request Flow:
1. Browser → http://YOUR_SERVER_IP/
2. UFW → Nginx (port 80)
3. Nginx → Web container (serve index.html)
4. Browser renders React app

5. React app → http://YOUR_SERVER_IP/api/invoices
6. Nginx → API container (port 8080)
7. API → PostgreSQL (port 5432)
8. API → Nginx → Browser (JSON response)
```

---

## HTTPS (After Upgrade)

```
┌──────────────────────────────────────────────────────────────┐
│                      PUBLIC INTERNET                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │   UFW    │ Firewall
                    │  Allow:  │ - Port 22 (SSH)
                    │  Port 80 │ - Port 80 (HTTP → redirect)
                    │ Port 443 │ - Port 443 (HTTPS)
                    └────┬─────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
     Port 80 (HTTP)              Port 443 (HTTPS/TLS)
          │                             │
          ▼                             ▼
    ┌──────────┐         ┌──────────────────────────┐
    │  Nginx   │         │   Nginx Reverse Proxy    │
    │  (301)   ├────────►│   With SSL/TLS           │
    │ Redirect │         │  ──────────────────────  │
    └──────────┘         │  • TLS 1.2 + 1.3         │
                         │  • Strong ciphers        │
                         │  • HSTS header           │
                         │  • OCSP stapling         │
                         │  • Let's Encrypt certs   │
                         │    mounted from host     │
                         └──┬──────────────┬────────┘
                            │              │
                   ┌────────▼────┐   ┌────▼────────┐
                   │     Web     │   │     API     │
                   │  Container  │   │  Container  │
                   └─────────────┘   └──────┬──────┘
                                            │
                                     ┌──────▼──────┐
                                     │  PostgreSQL │
                                     └─────────────┘

Request Flow with HTTPS:
1. Browser → http://yourdomain.com
2. Nginx → 301 Redirect → https://yourdomain.com
3. Browser → https://yourdomain.com (TLS handshake)
4. Nginx terminates SSL, proxies to Web/API
5. Rest of flow is the same (internal HTTP)
```

---

## Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Host VPS                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Docker Network: rm-internal (bridge)        │  │
│  │                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │    Nginx     │  │     Web      │  │    API     │ │  │
│  │  │   (proxy)    │  │  (frontend)  │  │ (backend)  │ │  │
│  │  │              │  │              │  │            │ │  │
│  │  │ nginx:alpine │  │ nginx:alpine │  │  .NET 8    │ │  │
│  │  └──────┬───────┘  └──────▲───────┘  └─────▲──────┘ │  │
│  │         │                 │                 │        │  │
│  │         │                 │                 │        │  │
│  │         └─────────────────┴─────────────────┘        │  │
│  │                           │                          │  │
│  │                    ┌──────▼───────┐                  │  │
│  │                    │  PostgreSQL  │                  │  │
│  │                    │   (database) │                  │  │
│  │                    │              │                  │  │
│  │                    │ postgres:16  │                  │  │
│  │                    └──────────────┘                  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Volumes:                                                   │
│  • pgdata       → PostgreSQL data persistence              │
│  • api-logs     → API logs                                 │
│  • api-data     → API data files                           │
│  • nginx-logs   → Nginx access/error logs                  │
│                                                             │
│  Ports Exposed to Internet:                                │
│  • 0.0.0.0:80 → nginx:80 (HTTP)                            │
│  • 0.0.0.0:443 → nginx:443 (HTTPS - after SSL setup)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Container Communication

```
┌─────────────────────────────────────────────────────────────┐
│                    Internal DNS Resolution                  │
│  (Docker Compose automatic container name resolution)      │
└─────────────────────────────────────────────────────────────┘

Container: nginx
  → Can reach: http://web:80
  → Can reach: http://api:8080

Container: web
  → Can reach: http://api:8080 (not used in production setup)

Container: api
  → Can reach: postgres_db:5432

Container: postgres_db
  → Isolated, only accepts connections from api

┌─────────────────────────────────────────────────────────────┐
│                    Port Mapping Summary                     │
└─────────────────────────────────────────────────────────────┘

Service         Internal Port    External Port    Accessible From
──────────────  ──────────────   ─────────────    ───────────────
nginx           80               80               Internet
nginx           443              443              Internet (after SSL)
web             80               None             nginx only
api             8080             None             nginx only
postgres_db     5432             None             api only

Security Note: Only nginx is exposed to the internet. All other
services are on an internal network and cannot be directly accessed.
```

---

## Data Flow Examples

### Example 1: Login

```
1. User enters credentials in browser
   ↓
2. React app: POST http://YOUR_SERVER_IP/api/auth/login
   ↓
3. Nginx receives request on port 80
   ↓
4. Nginx routes /api/* → http://api:8080/api/*
   ↓
5. API validates credentials against PostgreSQL
   ↓
6. API generates JWT token + refresh cookie
   ↓
7. API responds with token
   ↓
8. Nginx forwards response to browser
   ↓
9. React app stores token, redirects to dashboard
```

### Example 2: Fetch Invoices

```
1. React app: GET http://YOUR_SERVER_IP/api/invoices
   Authorization: Bearer <jwt-token>
   ↓
2. Nginx receives request
   ↓
3. Nginx forwards headers (including Authorization)
   ↓
4. API validates JWT token
   ↓
5. API queries PostgreSQL with CompanyId filter
   ↓
6. PostgreSQL returns invoice records
   ↓
7. API serializes to JSON
   ↓
8. Nginx applies gzip compression
   ↓
9. Browser receives compressed response
   ↓
10. React renders invoice list
```

### Example 3: Static Asset Loading

```
1. Browser: GET http://YOUR_SERVER_IP/assets/main-abc123.js
   ↓
2. Nginx receives request
   ↓
3. Nginx routes / → http://web:80/
   ↓
4. Web container's nginx serves static file
   ↓
5. Main nginx receives response
   ↓
6. Main nginx adds cache headers + gzip
   ↓
7. Browser caches file for 1 year
```

---

## Development vs Production Comparison

### Development (`docker-compose.yml`)

```
Internet
   │
   ├──► Port 7175 → API Container (direct)
   │
   └──► Port 80 → Web Container
                     │
                     └──► /api → API Container (proxy)
```

**Characteristics:**
- Multiple exposed ports
- Web container handles routing
- Good for local development
- Hot reload support

### Production (`docker-compose.prod.yml`)

```
Internet
   │
   └──► Port 80 → Nginx Proxy
                     │
                     ├──► / → Web Container
                     │
                     └──► /api → API Container
```

**Characteristics:**
- Single exposed port (80)
- Dedicated reverse proxy
- Better security
- Production-grade performance
- HTTPS ready
```

---

## Upgrade Path: HTTP → HTTPS

```
Phase 1: HTTP Only (Current)
─────────────────────────────
Internet → Port 80 → Nginx → Web/API
✓ Works with IP address only
✓ No domain required
✓ No SSL certificate needed

Phase 2: HTTPS Setup (Future)
──────────────────────────────
1. Obtain domain name
2. Point DNS A record to server IP
3. Get Let's Encrypt certificate
4. Uncomment HTTPS block in nginx.conf
5. Mount certificates in docker-compose.prod.yml
6. Restart nginx

Result:
Internet → Port 443 (HTTPS) → Nginx (SSL termination) → Web/API
         → Port 80 (HTTP) → Redirect to HTTPS
✓ Encrypted traffic
✓ HSTS enabled
✓ A+ SSL rating
```

---

## File Organization

```
ResourceManager/
├── nginx/                          ← NEW: Reverse proxy layer
│   ├── nginx.conf                  ← Main config (HTTP + HTTPS templates)
│   ├── Dockerfile                  ← Container build
│   └── README.md                   ← Nginx docs
│
├── ClientApp/                      ← Frontend layer
│   ├── nginx.conf                  ← MODIFIED: React serving only
│   └── ...
│
├── Controllers/                    ← Backend API layer
├── Models/
├── Services/
├── Dockerfile                      ← API container
│
├── docker-compose.yml              ← Development setup
├── docker-compose.prod.yml         ← NEW: Production setup
│
└── Documentation/
    ├── DEPLOYMENT.md               ← NEW: Full deployment guide
    ├── QUICKSTART.md               ← NEW: Quick reference
    ├── NGINX_SETUP_SUMMARY.md      ← NEW: Overview
    └── ARCHITECTURE.md             ← This file
```

---

**Created:** February 2026  
**Purpose:** Visual reference for production deployment architecture
