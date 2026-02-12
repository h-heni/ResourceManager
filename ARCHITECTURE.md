# Blue-Green Deployment - Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPS SERVER                                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         NGINX REVERSE PROXY                           │ │
│  │                         (Port 80 - Public)                           │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────┐    │ │
│  │  │  Upstream Configuration (Dynamic)                           │    │ │
│  │  │  ┌────────────────┐      ┌────────────────┐                │    │ │
│  │  │  │  blue_api      │      │  green_api     │                │    │ │
│  │  │  │  blue_web      │      │  green_web     │                │    │ │
│  │  │  └────────┬───────┘      └────────┬───────┘                │    │ │
│  │  │           │                        │                        │    │ │
│  │  │           └────────────┬───────────┘                        │    │ │
│  │  │                        │                                    │    │ │
│  │  │              ACTIVE_ENV = ${ACTIVE_ENV}                     │    │ │
│  │  │              (blue or green)                                │    │ │
│  │  └─────────────────────────────────────────────────────────────┘    │ │
│  │                                │                                      │ │
│  │                    Nginx routes all traffic to                       │ │
│  │                    currently ACTIVE environment                      │ │
│  └───────────────────────────────┬───────────────────────────────────────┘ │
│                                  │                                         │
│     ┌────────────────────────────┴──────────────────────────────┐         │
│     │                                                             │         │
│     ▼                                                             ▼         │
│  ┌──────────────────────────────┐           ┌──────────────────────────────┐ │
│  │    BLUE ENVIRONMENT          │           │    GREEN ENVIRONMENT         │ │
│  │    (Inactive)                │           │    (Active) ✓                │ │
│  │                              │           │                              │ │
│  │  ┌────────────────────────┐  │           │  ┌────────────────────────┐  │ │
│  │  │   blue-api             │  │           │  │   green-api            │  │ │
│  │  │   Container            │  │           │  │   Container            │  │ │
│  │  │                        │  │           │  │                        │  │ │
│  │  │   • .NET 8 API        │  │           │  │   • .NET 8 API        │  │ │
│  │  │   • Port: 7175→8080   │  │           │  │   • Port: 7176→8080   │  │ │
│  │  │   • Health: /health    │  │           │  │   • Health: /health    │  │ │
│  │  │   • Swagger: /swagger  │  │           │  │   • Swagger: /swagger  │  │ │
│  │  └──────────┬─────────────┘  │           │  └──────────┬─────────────┘  │ │
│  │             │                │           │             │                │ │
│  │             │                │           │             │                │ │
│  │             ▼                │           │             ▼                │ │
│  │  ┌────────────────────────┐  │           │  ┌────────────────────────┐  │ │
│  │  │   blue-web             │  │           │  │   green-web            │  │ │
│  │  │   Container            │  │           │  │   Container            │  │ │
│  │  │                        │  │           │  │                        │  │ │
│  │  │   • React 19 + Vite   │  │           │  │   • React 19 + Vite   │  │ │
│  │  │   • Nginx Alpine       │  │           │  │   • Nginx Alpine       │  │ │
│  │  │   • Port: 8080→80     │  │           │  │   • Port: 8081→80     │  │ │
│  │  │   • Proxies to blue-api│  │           │  │   • Proxies to green-api│ │ │
│  │  └──────────┬─────────────┘  │           │  └──────────┬─────────────┘  │ │
│  │             │                │           │             │                │ │
│  └─────────────┼────────────────┘           └─────────────┼────────────────┘ │
│                │                                          │                  │
│                │                                          │                  │
│                └──────────────┬───────────────────────────┘                  │
│                               │                                              │
│                               ▼                                              │
│                    ┌────────────────────────┐                                │
│                    │   PostgreSQL 16        │                                │
│                    │   (Shared Database)    │                                │
│                    │                        │                                │
│                    │   • Port: 5432         │                                │
│                    │   • Volume: pgdata     │                                │
│                    │   • Used by BOTH envs  │                                │
│                    └────────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      BLUE-GREEN DEPLOYMENT FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

  STEP 1: Initial State (Blue is ACTIVE)
  ┌────────────────────────────────────────────────────┐
  │  Nginx → Blue Environment (serving traffic)        │
  │  Green Environment (stopped or idle)               │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 2: Deploy to Green
  ┌────────────────────────────────────────────────────┐
  │  1. Pull new Docker images                         │
  │  2. Start Green containers                         │
  │  3. Blue continues serving traffic (No downtime)   │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 3: Health Checks
  ┌────────────────────────────────────────────────────┐
  │  1. Check Green API: curl :7176/health            │
  │  2. Check Green Web: curl :8081/health            │
  │  3. Verify database connectivity                   │
  │  4. Container status check                         │
  │                                                    │
  │  ✓ All healthy → Continue                         │
  │  ✗ Any failed → Stop Green, abort deployment      │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 4: Switch Traffic (< 0.1 seconds)
  ┌────────────────────────────────────────────────────┐
  │  1. Update ACTIVE_ENV=green in .env                │
  │  2. docker exec nginx nginx -s reload              │
  │  3. Nginx hot-reloads configuration                │
  │  4. New requests → Green                           │
  │  5. Existing connections finish gracefully         │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 5: Monitor & Verify
  ┌────────────────────────────────────────────────────┐
  │  1. Monitor Green for 5 minutes                    │
  │  2. Continuous health checks                       │
  │  3. Check application functionality                │
  │  4. Monitor error logs                             │
  │                                                    │
  │  ✓ Stable → Stop Blue, cleanup                    │
  │  ✗ Issues → Rollback to Blue                      │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 6: Cleanup
  ┌────────────────────────────────────────────────────┐
  │  Nginx → Green Environment (serving traffic)       │
  │  Blue Environment (stopped)                        │
  │  Old Docker images pruned                          │
  └────────────────────────────────────────────────────┘

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Deployment Complete! ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Rollback Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      INSTANT ROLLBACK FLOW                                   │
└──────────────────────────────────────────────────────────────────────────────┘

  ISSUE DETECTED: Green environment has problems
  ┌────────────────────────────────────────────────────┐
  │  Current: Nginx → Green (problematic)              │
  │  Available: Blue (previous working version)        │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 1: Start Blue (if stopped)
  ┌────────────────────────────────────────────────────┐
  │  docker-compose start blue-api blue-web            │
  │  Wait for health checks                            │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 2: Switch Traffic Back (< 30 seconds)
  ┌────────────────────────────────────────────────────┐
  │  1. Update ACTIVE_ENV=blue in .env                 │
  │  2. docker exec nginx nginx -s reload              │
  │  3. Traffic immediately routes to Blue             │
  └────────────────────────────────────────────────────┘
                          │
                          ▼
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 3: Verify & Cleanup
  ┌────────────────────────────────────────────────────┐
  │  Nginx → Blue Environment (serving traffic)        │
  │  Green Environment (stopped for investigation)     │
  └────────────────────────────────────────────────────┘

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rollback Complete! ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Network Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          NETWORK ARCHITECTURE                                │
└──────────────────────────────────────────────────────────────────────────────┘

  Internet Users
       │
       │ HTTP/HTTPS
       │
       ▼
  ┌─────────────────┐
  │   VPS :80/443   │  ← Public facing
  └────────┬────────┘
           │
           │ Docker Network: rm-internal
           │
           ▼
  ┌─────────────────┐
  │  Nginx :80      │  ← Reverse Proxy
  │  (Container)    │
  └────────┬────────┘
           │
           │ if ACTIVE_ENV=blue
           ├─────────────────────────┐
           │                         │
           ▼                         ▼
  ┌──────────────────┐    ┌──────────────────┐
  │  blue-api :8080  │    │  green-api :8080 │
  │  (Container)     │    │  (Container)     │
  └────────┬─────────┘    └────────┬─────────┘
           │                       │
           ▼                       ▼
  ┌──────────────────┐    ┌──────────────────┐
  │  blue-web :80    │    │  green-web :80   │
  │  (Container)     │    │  (Container)     │
  └────────┬─────────┘    └────────┬─────────┘
           │                       │
           └───────────┬───────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  postgres_db     │
              │  :5432           │
              │  (Container)     │
              └──────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  pgdata volume   │  ← Persistent storage
              └──────────────────┘

  Host Port Mapping:
  ────────────────────────────────────────
  :80         → nginx:80
  :7175       → blue-api:8080
  :7176       → green-api:8080
  :8080       → blue-web:80
  :8081       → green-web:80
  :5432       → (internal only)
```

## Container Communication

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CONTAINER COMMUNICATION PATHS                             │
└──────────────────────────────────────────────────────────────────────────────┘

  User Request Flow:
  ──────────────────────────────────────────────────────────────────

  Browser
     │
     │ GET http://vps-ip/
     ▼
  [nginx:80]
     │
     │ Proxy to active web
     ▼
  [green-web:80]  (if ACTIVE_ENV=green)
     │
     │ Returns index.html
     │
     └─────────────────────────────────────────► User gets page


  API Request Flow:
  ──────────────────────────────────────────────────────────────────

  Browser
     │
     │ GET http://vps-ip/api/invoices
     ▼
  [nginx:80]
     │
     │ Proxy to http://green-api:8080/api/invoices
     ▼
  [green-api:8080]
     │
     │ Connect to postgres_db:5432
     ▼
  [postgres_db:5432]
     │
     │ Return data
     │
     └─────────────────────────────────────────► User gets JSON


  Health Check Flow:
  ──────────────────────────────────────────────────────────────────

  Deployment Script
     │
     │ curl http://localhost:7176/health
     ▼
  Host :7176 → [green-api:8080]
     │
     └─────────────────────────────────────────► {"status": "healthy"}
```

## File Structure

```
/opt/resourcemanager/
│
├── docker-compose.blue-green.yml    ← Main orchestration file
├── nginx/
│   └── blue-green.conf              ← Nginx dynamic routing config
├── scripts/
│   ├── deploy-blue-green.sh         ← Zero-downtime deployment
│   └── rollback-blue-green.sh       ← Instant rollback
├── .env                             ← Environment variables (ACTIVE_ENV)
├── .env.example                     ← Template with defaults
│
├── BLUE_GREEN_DEPLOYMENT.md         ← Full documentation
├── QUICK_REFERENCE.md               ← Quick commands guide
└── ARCHITECTURE.md                  ← This file (diagrams)
```

## Key Concepts

### Zero-Downtime Guarantee

```
Time:     0s ──────── 0.1s ────── 10s ────── 5min ───────►
          │          │            │         │
State:    Blue       Switch       Green     Green
          Active     Traffic      Active    Verified
          │          │            │         │
Traffic:  100%       Switching    100%      100%
          Blue       (< 0.1s)     Green     Green
                     
Downtime: [═════════════════════ ZERO ═════════════════════]
```

### Environment States

```
┌────────────────┬──────────────┬──────────────┬───────────────┐
│ Deployment     │ Blue State   │ Green State  │ Active        │
│ Phase          │              │              │ Environment   │
├────────────────┼──────────────┼──────────────┼───────────────┤
│ Initial        │ Running      │ Stopped      │ Blue          │
│ Deploy Start   │ Running      │ Starting     │ Blue          │
│ Health Check   │ Running      │ Running      │ Blue          │
│ Traffic Switch │ Running      │ Running      │ Green         │
│ Monitoring     │ Running      │ Running      │ Green         │
│ Cleanup        │ Stopped      │ Running      │ Green         │
└────────────────┴──────────────┴──────────────┴───────────────┘
```

### Resource Usage Timeline

```
Resources (RAM/CPU)
      │
  2x  ├─────────┐         ┌──────
      │         │         │
  1x  ┤         └─────────┘
      │
  0   └─────────────────────────────► Time
           │           │
         Deploy    Cleanup
         
  Phase 1: Normal (1 environment)
  Phase 2: Deployment (2 environments - brief period)
  Phase 3: Normal (1 environment)
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                   TECHNOLOGY LAYERS                     │
├─────────────────────────────────────────────────────────┤
│  Layer 7: Users                                         │
│           └─> Web Browsers, Mobile Apps                 │
├─────────────────────────────────────────────────────────┤
│  Layer 6: Load Balancer / Reverse Proxy                │
│           └─> Nginx Alpine (Dynamic Upstream)           │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Application Environments                      │
│           ├─> Blue: API + Web Containers                │
│           └─> Green: API + Web Containers               │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Application Runtimes                          │
│           ├─> .NET 8 (Backend)                          │
│           ├─> React 19 (Frontend)                       │
│           └─> Nginx Alpine (Static serving)             │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Data Layer                                    │
│           └─> PostgreSQL 16 (Shared)                    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Container Orchestration                       │
│           └─> Docker Compose                            │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure                                │
│           └─> VPS (Ubuntu/Debian)                       │
└─────────────────────────────────────────────────────────┘
```

## Comparison: Traditional vs Blue-Green

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL DEPLOYMENT                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Stop application         │████████│ Downtime                       │
│  2. Deploy new version       │████████│ Downtime                       │
│  3. Start application        │████████│ Downtime                       │
│                                                                         │
│  Total Downtime: 2-5 minutes                                           │
│  Risk: High (can't easily rollback)                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    BLUE-GREEN DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Deploy to inactive env   │████████│ Running (No downtime)          │
│  2. Health checks            │████████│ Running (No downtime)          │
│  3. Switch traffic           │▓│        < 0.1s                         │
│  4. Monitor                  │████████│ Running (No downtime)          │
│                                                                         │
│  Total Downtime: < 0.1 seconds                                         │
│  Risk: Low (instant rollback available)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

For detailed instructions, see [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md)

For quick commands, see [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
