# 📊 ResourceManager - Monitoring Guide

## Overview

ResourceManager includes a comprehensive monitoring stack using Prometheus and Grafana for metrics collection and visualization, along with k6 load testing for performance validation.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Grafana   │────▶│  Prometheus  │────▶│  API Server  │
│  (Port 3000)│     │  (Port 9090) │     │  (Port 8080) │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Metrics)   │
                    └──────────────┘
```

## Quick Start

### 1. Start Monitoring Stack

```bash
cd load-testing
docker compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Dashboards

| Service    | URL                        | Default Credentials |
|-----------|----------------------------|---------------------|
| Grafana   | http://localhost:3000       | admin / admin       |
| Prometheus| http://localhost:9090       | N/A                 |

### 3. Run Load Tests

```bash
# Setup k6
./setup.sh

# Run smoke test
./run-test.sh smoke

# Run full load test
./run-test.sh load

# Run stress test
./run-test.sh stress
```

## Health Checks

All services expose health check endpoints:

| Service    | Endpoint                          | Expected Response |
|-----------|-----------------------------------|-------------------|
| API       | `http://api:8080/health`          | 200 OK            |
| Web       | `http://web:80/health`            | 200 OK            |
| Nginx     | `http://nginx:80/health`          | 200 OK            |
| PostgreSQL| `pg_isready` command              | Exit code 0       |
| Redis     | `redis-cli ping`                  | PONG              |

## Docker Resource Monitoring

### Real-time Container Stats

```bash
# Watch all containers
docker stats

# Specific containers
docker stats rm-api rm-postgres rm-redis rm-nginx

# One-shot snapshot
docker stats --no-stream
```

### Memory Usage Check

```bash
# Check if containers are near limits (2GB VPS budget)
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}"
```

### Expected Resource Usage (2GB VPS)

| Container    | Memory Limit | Expected Usage | CPU Limit |
|-------------|-------------|----------------|-----------|
| PostgreSQL  | 768M        | 200-400M       | 1.0       |
| API         | 1024M       | 200-500M       | 1.5       |
| Redis       | 192M        | 30-96M         | 0.25      |
| Nginx       | 128M        | 10-30M         | 0.25      |
| Web         | 128M        | 10-30M         | 0.5       |

## Log Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api

# Since timestamp
docker compose logs --since="2024-01-01T00:00:00" api
```

### Log Rotation

Logs are automatically rotated via Docker's `json-file` driver:

- **API**: max 20MB × 5 files = 100MB total
- **PostgreSQL**: max 10MB × 3 files = 30MB total
- **Nginx**: max 10MB × 3 files = 30MB total

## Database Monitoring

### PostgreSQL Performance Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries (> 1 second)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
ORDER BY duration DESC;

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Cache hit ratio (should be > 99%)
SELECT sum(heap_blks_read) as heap_read,
       sum(heap_blks_hit)  as heap_hit,
       sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

### Redis Monitoring

```bash
# Connect to Redis CLI
docker exec -it rm-redis redis-cli -a $REDIS_PASSWORD

# Memory usage
INFO memory

# Key statistics
INFO keyspace

# Slow log
SLOWLOG GET 10

# Connected clients
INFO clients
```

## Alerting

### Recommended Alert Rules

Set up alerts for these conditions:

1. **Container restarts** — any container restarting more than 3 times in 5 minutes
2. **High memory usage** — any container using > 90% of its memory limit
3. **API health check failure** — /health endpoint not responding
4. **Database connection pool** — active connections > 35 (max 40)
5. **Disk space** — host disk usage > 80%

### External Monitoring (Recommended)

For production, use an external uptime monitoring service:

- **UptimeRobot** (free tier) — monitor HTTP endpoints
- **Better Uptime** — incident management
- **Healthchecks.io** — cron job monitoring (for backup scripts)

## Load Testing Scenarios

See `load-testing/` directory for comprehensive k6 test scenarios:

| Test     | Duration | VUs  | Purpose                     |
|----------|----------|------|-----------------------------|
| Smoke    | 1 min    | 1-5  | Basic functionality check   |
| Load     | 10 min   | 50   | Normal traffic simulation   |
| Stress   | 15 min   | 200  | Find breaking point         |
| Spike    | 5 min    | 500  | Sudden traffic burst        |
| Soak     | 60 min   | 30   | Memory leak detection       |

For details, see [load-testing/README.md](load-testing/README.md).

## Troubleshooting

### High Memory Usage

```bash
# Check which container is using most memory
docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}"

# Force garbage collection on .NET API
docker exec rm-api dotnet-counters monitor --process-id 1
```

### Slow API Responses

```bash
# Check API logs for slow queries
docker compose logs api | grep -i "slow\|timeout\|error"

# Check PostgreSQL slow query log
docker compose logs postgres_db | grep "duration:"

# Check Redis connection
docker exec rm-redis redis-cli -a $REDIS_PASSWORD ping
```

### Container Crashes

```bash
# Check container exit codes
docker ps -a --filter "status=exited"

# Check OOM kills
dmesg | grep -i oom

# Check container inspect
docker inspect rm-api | grep -A 10 "State"
```
