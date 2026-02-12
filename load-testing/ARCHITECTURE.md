# Load Testing Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Load Testing Stack                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────────────────────────────────┐
│              │         │                                          │
│  Developer   │────────▶│  k6 Load Testing Tool                    │
│  Machine     │         │  - smoke-test.js (5 VUs, 2 min)          │
│              │         │  - load-test.js (10-50 VUs, 10 min)      │
└──────────────┘         │  - stress-test.js (50-200 VUs, 15 min)   │
                         │  - spike-test.js (0→100→0 VUs, 5 min)    │
                         │  - soak-test.js (30 VUs, 24 hrs)         │
                         └──────────────┬───────────────────────────┘
                                        │
                                        │ HTTP Requests
                                        ▼
        ┌───────────────────────────────────────────────────────────┐
        │              Application Under Test (2GB VPS)             │
        ├───────────────────────────────────────────────────────────┤
        │                                                           │
        │  ┌─────────────────────────────────────────────────┐    │
        │  │         .NET API (896 MB)                       │    │
        │  │  - JWT Authentication                           │    │
        │  │  - Invoice CRUD Operations                      │    │
        │  │  - PDF Generation                               │    │
        │  │  - Connection Pooling (5-50 connections)        │    │
        │  │  - Port: 7175 → 8080                           │    │
        │  └──────────────┬──────────────────────────────────┘    │
        │                 │                                         │
        │                 │ SQL Queries                             │
        │                 ▼                                         │
        │  ┌─────────────────────────────────────────────────┐    │
        │  │      PostgreSQL (768 MB)                        │    │
        │  │  - shared_buffers: 256MB                        │    │
        │  │  - max_connections: 100                         │    │
        │  │  - Indexes: invoices, clients, payments         │    │
        │  │  - pg_stat_statements enabled                   │    │
        │  │  - Port: 5432 (internal only)                   │    │
        │  └─────────────────────────────────────────────────┘    │
        │                                                           │
        └───────────────────────────────────────────────────────────┘
                                        │
                                        │ Metrics Export
                                        ▼
        ┌───────────────────────────────────────────────────────────┐
        │              Monitoring Stack (Optional)                  │
        ├───────────────────────────────────────────────────────────┤
        │                                                           │
        │  ┌──────────────────┐      ┌──────────────────┐         │
        │  │   Prometheus     │      │  Postgres        │         │
        │  │   (Metrics)      │◀─────│  Exporter        │         │
        │  │   Port: 9090     │      │  Port: 9187      │         │
        │  └────────┬─────────┘      └──────────────────┘         │
        │           │                                               │
        │           │ Query Metrics                                │
        │           ▼                                               │
        │  ┌──────────────────┐                                    │
        │  │    Grafana       │                                    │
        │  │  (Dashboards)    │                                    │
        │  │  Port: 3000      │                                    │
        │  │  admin/admin     │                                    │
        │  └──────────────────┘                                    │
        │                                                           │
        └───────────────────────────────────────────────────────────┘
```

## Test Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│                    k6 Test Execution Flow                          │
└────────────────────────────────────────────────────────────────────┘

Start Test
    │
    ├─ Setup Phase
    │   └─ Initialize test data
    │
    ├─ VU Iteration (per virtual user)
    │   │
    │   ├─ 1. Login
    │   │   POST /api/auth/login
    │   │   ├─ Send credentials
    │   │   └─ Receive JWT token
    │   │
    │   ├─ 2. View Dashboard
    │   │   GET /api/dashboard/stats
    │   │   └─ Check response time < 500ms
    │   │
    │   ├─ 3. List Invoices (paginated)
    │   │   GET /api/invoices?page=1&size=20
    │   │   └─ Verify 200 status
    │   │
    │   ├─ 4. Get Clients
    │   │   GET /api/clients
    │   │   └─ Extract client IDs
    │   │
    │   ├─ 5. Create Invoice (30% probability)
    │   │   POST /api/invoices
    │   │   ├─ Generate random invoice data
    │   │   └─ Store invoice ID
    │   │
    │   ├─ 6. Generate PDF (if invoice created)
    │   │   GET /api/invoices/{id}/pdf
    │   │   └─ Verify PDF generation
    │   │
    │   └─ 7. Think Time (1-5 seconds)
    │       └─ Simulate user reading/thinking
    │
    ├─ Metrics Collection
    │   ├─ http_req_duration (response time)
    │   ├─ http_req_failed (error rate)
    │   ├─ http_reqs (throughput)
    │   └─ checks (validation pass rate)
    │
    └─ Teardown Phase
        └─ Generate summary report
```

## Memory Layout (2GB VPS)

```
┌─────────────────────────────────────────────────────────────┐
│                  2048 MB Total RAM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────┐  896 MB (44%)  │
│  │         .NET API Container             │                │
│  │  - Application memory                  │                │
│  │  - Thread pool                         │                │
│  │  - HTTP request buffers                │                │
│  │  - Response caching                    │                │
│  └────────────────────────────────────────┘                │
│                                                             │
│  ┌────────────────────────────────────────┐  768 MB (37%)  │
│  │      PostgreSQL Container              │                │
│  │  - shared_buffers: 256 MB              │                │
│  │  - work_mem: 2621 KB × connections     │                │
│  │  - maintenance_work_mem: 64 MB         │                │
│  │  - WAL buffers: 8 MB                   │                │
│  │  - Connection memory                   │                │
│  └────────────────────────────────────────┘                │
│                                                             │
│  ┌────────────────────────────────────────┐  384 MB (19%)  │
│  │    Operating System + Docker           │                │
│  │  - Linux kernel                        │                │
│  │  - Docker daemon                       │                │
│  │  - System processes                    │                │
│  │  - Network buffers                     │                │
│  └────────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Database Connection Flow

```
┌──────────────────────────────────────────────────────────────────┐
│               Connection Pooling Architecture                    │
└──────────────────────────────────────────────────────────────────┘

k6 Virtual Users (50 concurrent)
         │
         ├── VU 1 ──┐
         ├── VU 2 ──┤
         ├── VU 3 ──┤
         ├── ...   ──┤
         └── VU 50 ─┘
                    │
                    ▼
            ┌───────────────────┐
            │   .NET API        │
            │  Connection Pool  │
            │  Min: 5           │
            │  Max: 50          │
            │  Idle timeout: 60s│
            └─────────┬─────────┘
                      │
                      │ Multiplexed
                      │
                      ▼
            ┌───────────────────┐
            │   PostgreSQL      │
            │  max_connections  │
            │  = 100            │
            │                   │
            │  Active: ~30-40   │
            │  Idle: ~10-20     │
            │  Reserved: 3      │
            └───────────────────┘

Note: Connection pooling allows 50 concurrent API requests
      to share 30-40 database connections efficiently.
```

## Test Progression Strategy

```
┌────────────────────────────────────────────────────────────┐
│            Recommended Testing Sequence                    │
└────────────────────────────────────────────────────────────┘

Day 1: Initial Validation
├─ 1. Smoke Test (2 min)
│   └─ Purpose: Verify all endpoints work
│   └─ Success: All checks pass, no errors
│
├─ 2. Database Optimization
│   └─ Run: optimize-database.sql
│   └─ Create indexes, update statistics
│
└─ 3. Smoke Test Again
    └─ Verify optimization didn't break anything

Day 2: Baseline Performance
├─ 4. Load Test (10 min)
│   └─ Purpose: Establish baseline metrics
│   └─ Record: P95 latency, throughput, error rate
│
└─ 5. Analysis
    └─ Review: monitor-database.sql
    └─ Identify: Slow queries, missing indexes

Day 3: Find Limits
├─ 6. Stress Test (15 min)
│   └─ Purpose: Find breaking point
│   └─ Watch: When does P95 exceed 1000ms?
│   └─ Record: Maximum concurrent users
│
└─ 7. Spike Test (5 min)
    └─ Purpose: Test recovery from surge
    └─ Verify: System recovers gracefully

Day 7: Production Readiness (Optional)
└─ 8. Soak Test (24 hours)
    └─ Purpose: Detect memory leaks
    └─ Monitor: Memory usage over time
    └─ Success: No degradation after 24 hrs
```

## Scaling Decision Flowchart

```
                    Start: Monitor Performance
                              │
                              ▼
                    ┌───────────────────┐
                    │ P95 < 500ms?      │
                    └─────┬───────┬─────┘
                          │       │
                    Yes   │       │   No
                          ▼       ▼
                    ┌─────────┐ ┌──────────────────┐
                    │ Great!  │ │ Optimized?       │
                    │ Monitor │ └────┬───────┬─────┘
                    └─────────┘      │       │
                                Yes  │       │  No
                                     │       ▼
                                     │  ┌────────────────┐
                                     │  │ 1. Add indexes │
                                     │  │ 2. Enable cache│
                                     │  │ 3. Fix N+1     │
                                     │  │ 4. Retest      │
                                     │  └────────────────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │ CPU/Memory > 80%?│
                          └────┬───────┬─────┘
                               │       │
                         Yes   │       │   No
                               ▼       ▼
                    ┌────────────────┐ ┌──────────────┐
                    │ Vertical Scale │ │ Code issue?  │
                    │ 2GB → 4GB VPS  │ │ Profile code │
                    └────────────────┘ └──────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │ Still not enough?  │
                    └─────┬──────────────┘
                          │
                          ▼
                    ┌────────────────────┐
                    │ Horizontal Scaling │
                    │ Load Balancer +    │
                    │ Multiple API nodes │
                    └────────────────────┘
```

## File Structure Reference

```
load-testing/
│
├── 📘 Documentation (4 files)
│   ├── README.md              # Main documentation (13KB)
│   ├── QUICKSTART.md          # 5-minute guide (6KB)
│   ├── CAPACITY_PLANNING.md   # Capacity analysis (9KB)
│   └── SUMMARY.md             # Implementation summary (8KB)
│
├── 🧪 Test Scenarios (5 files)
│   ├── smoke-test.js          # 2 min, 5 VUs
│   ├── load-test.js           # 10 min, 10-50 VUs
│   ├── stress-test.js         # 15 min, 50-200 VUs
│   ├── spike-test.js          # 5 min, 0→100→0 VUs
│   └── soak-test.js           # 24 hrs, 30 VUs
│
├── ⚙️ Configuration (6 files)
│   ├── prometheus.yml         # Metrics collection
│   ├── grafana-*.yml          # Dashboard setup
│   ├── postgresql-tuning.conf # DB optimization
│   ├── optimize-database.sql  # Index creation
│   └── monitor-database.sql   # Real-time monitoring
│
├── 🐳 Docker (2 files)
│   ├── docker-compose.loadtest.yml    # Optimized test env
│   └── docker-compose.monitoring.yml  # Prometheus + Grafana
│
├── 🛠️ Scripts (2 files)
│   ├── run-test.sh            # Test runner
│   └── setup.sh               # Environment setup
│
├── 📦 Utilities (2 files)
│   ├── utils/common.js        # Shared k6 functions
│   └── data/test-data.js      # Sample data
│
└── 📊 Results (directory)
    └── results/               # Test outputs (gitignored)
```

## Key Metrics Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    Grafana Dashboard                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Response Time                      Throughput                  │
│  ┌─────────────────┐               ┌─────────────────┐         │
│  │ P95: 380ms ✅   │               │ 88 req/s  ✅    │         │
│  │ P99: 520ms ✅   │               │                 │         │
│  └─────────────────┘               └─────────────────┘         │
│                                                                 │
│  Error Rate                         Database Connections        │
│  ┌─────────────────┐               ┌─────────────────┐         │
│  │ 0.5% ✅         │               │ 42/100  ✅      │         │
│  └─────────────────┘               └─────────────────┘         │
│                                                                 │
│  CPU Usage                          Memory Usage                │
│  ┌─────────────────┐               ┌─────────────────┐         │
│  │ 65% ✅          │               │ 78% ✅          │         │
│  └─────────────────┘               └─────────────────┘         │
│                                                                 │
│  Active VUs Over Time              Request Duration Histogram   │
│  ┌─────────────────────────────┐  ┌─────────────────┐         │
│  │      /\                     │  │       ┌──┐      │         │
│  │     /  \                    │  │     ┌─┘  └─┐    │         │
│  │    /    \___                │  │   ┌─┘      └─┐  │         │
│  │___/         \___            │  │───┘          └──│         │
│  └─────────────────────────────┘  └─────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
