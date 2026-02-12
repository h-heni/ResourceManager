# Capacity Planning for ResourceManager on 2GB VPS

## Executive Summary

Based on typical .NET + PostgreSQL performance characteristics and SaaS workload patterns:

### Estimated Capacity (2GB VPS)
- **Conservative**: 50-75 concurrent users
- **Optimal**: 100-150 concurrent users
- **Peak (optimized)**: 200-250 concurrent users

### Key Assumptions
- Average session duration: 10-15 minutes
- 80% read operations, 20% write operations
- Average response time target: <300ms (P95)
- Database properly indexed and optimized

---

## Detailed Analysis

### 1. Memory Breakdown (2GB Total)

```
Component          | Allocation | Percentage
-------------------|------------|------------
Operating System   | 256 MB     | 12.5%
PostgreSQL         | 768 MB     | 37.5%
.NET API           | 896 MB     | 44%
Other/Buffer       | 128 MB     | 6%
TOTAL             | 2048 MB    | 100%
```

### 2. PostgreSQL Configuration (2GB VPS)

**Critical Settings** (`postgresql.conf`):
```ini
# Memory Settings
shared_buffers = 256MB              # 25% of dedicated RAM (768MB)
effective_cache_size = 576MB        # 75% of dedicated RAM
work_mem = 2621kB                   # Calculated: (768MB / max_connections / 4)
maintenance_work_mem = 64MB         # 1/4 of shared_buffers

# Connection Settings
max_connections = 100               # Moderate for 2GB
superuser_reserved_connections = 3

# Query Planning
random_page_cost = 1.1              # SSD-optimized
effective_io_concurrency = 200      # SSDs can handle many concurrent I/O
default_statistics_target = 100

# Write Ahead Log (WAL)
wal_buffers = 8MB
checkpoint_completion_target = 0.9
min_wal_size = 1GB
max_wal_size = 4GB

# Query Performance
track_activity_query_size = 2048
pg_stat_statements.track = all
```

**Generate config with PGTune**: https://pgtune.leopard.in.ua/
- DB Type: Web application
- Total Memory: 768 MB (dedicated to PostgreSQL)
- Max Connections: 100
- Data Storage: SSD

### 3. .NET API Configuration

**appsettings.Production.json**:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=postgres_db;Database=resourcemanager;Pooling=true;Minimum Pool Size=5;Maximum Pool Size=50;Connection Lifetime=300;Connection Idle Lifetime=60"
  },
  "Kestrel": {
    "Limits": {
      "MaxConcurrentConnections": 200,
      "MaxConcurrentUpgradedConnections": 100,
      "MaxRequestBodySize": 10485760,
      "RequestHeadersTimeout": "00:00:30"
    }
  }
}
```

**Memory limits** (docker-compose.yml):
```yaml
api:
  deploy:
    resources:
      limits:
        memory: 896M
      reservations:
        memory: 512M
```

### 4. Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| **P95 Response Time** | <300ms | <500ms | >1000ms |
| **P99 Response Time** | <500ms | <1000ms | >2000ms |
| **Error Rate** | <0.5% | <1% | >2% |
| **Throughput** | >100 req/s | >50 req/s | <25 req/s |
| **Database Connections** | <50 | <75 | >90 |
| **Memory Usage** | <75% | <85% | >90% |
| **CPU Usage** | <70% | <80% | >90% |

### 5. Scaling Decision Matrix

#### When to Optimize (Before Scaling)
- P95 response time: 300-800ms
- CPU usage: 60-80%
- Memory usage: 70-85%
- Database connections: 40-70% of max
- No memory leaks detected

**Optimization Steps:**
1. Add database indexes (see optimize-database.sql)
2. Enable response caching
3. Implement connection pooling (PgBouncer)
4. Optimize N+1 queries
5. Enable gzip compression
6. Add CDN for static assets

#### When to Scale Vertically (Upgrade VPS)
- P95 response time consistently >800ms after optimization
- CPU usage sustained >80%
- Memory usage sustained >85%
- Database connections >70% of max
- Unable to handle expected growth

**Vertical Scaling Options:**

| VPS Size | Cost | Users | Notes |
|----------|------|-------|-------|
| 2GB → 4GB | 2x | 150-300 | Recommended first step |
| 2GB → 8GB | 4x | 400-800 | For growth to 500+ users |
| 2GB → 16GB | 8x | 1000+ | Enterprise scale |

#### When to Scale Horizontally (Multiple Servers)
- Need 99.9%+ uptime (HA requirement)
- Vertical scaling too expensive
- Traffic has high variance (auto-scaling needed)
- Users distributed globally (edge deployment)

**Horizontal Scaling Architecture:**

```
         Internet
             |
         [Load Balancer]
             |
    +--------+--------+
    |        |        |
  [API 1] [API 2] [API 3]  (2GB VPS each)
    |        |        |
    +--------+--------+
             |
     [PostgreSQL DB]
      (4-8GB VPS or managed service)
             |
        [Redis Cache]
        (512MB-1GB)
```

**Cost Comparison (Monthly):**
- Single 8GB VPS: $40-80
- 3x 2GB VPS + 4GB DB + Load Balancer: $80-120
- Managed services (AWS/Azure): $150-300

### 6. Traffic Patterns & User Calculations

**Concurrent vs Total Users:**
- Concurrent users: Users active at the same time
- Total daily users: All unique users in 24 hours

**Conversion Formula:**
```
Total Daily Users = Concurrent Users × (1440 min / Avg Session Duration)
                  = Concurrent Users × (1440 / 15)
                  = Concurrent Users × 96

Example: 100 concurrent users = ~9,600 daily active users
```

**Peak Traffic Planning:**
- Normal load: 100% capacity used
- Peak hour: 150-200% of normal (need headroom)
- Recommended: Provision for 2x average concurrent users

**Example Growth Scenarios:**

| Month | Total Users | Daily Active | Concurrent | VPS Size |
|-------|-------------|--------------|------------|----------|
| 1 | 500 | 100 | 10-15 | 2GB ✅ |
| 3 | 2,000 | 400 | 40-60 | 2GB ✅ |
| 6 | 5,000 | 1,000 | 100-120 | 4GB ⚠️ |
| 12 | 15,000 | 3,000 | 300-350 | 8GB or 2x4GB 🚀 |

### 7. Monitoring & Alerts

**Critical Metrics to Monitor:**

```yaml
alerts:
  - name: High Response Time
    condition: p95_response_time > 500ms for 5 minutes
    action: Investigate slow queries, check CPU/memory
    
  - name: High Error Rate
    condition: error_rate > 2% for 5 minutes
    action: Check application logs, database connections
    
  - name: Memory Pressure
    condition: memory_usage > 85% for 10 minutes
    action: Check for memory leaks, consider scaling
    
  - name: Database Connection Pool
    condition: db_connections > 80 for 5 minutes
    action: Check connection leaks, increase pool size
    
  - name: High CPU Usage
    condition: cpu_usage > 80% for 10 minutes
    action: Profile application, optimize hot paths
```

**Monitoring Stack:**
- **Metrics**: Prometheus + node-exporter + postgres-exporter
- **Visualization**: Grafana
- **Logging**: Serilog → Console/File
- **APM**: Application Insights / New Relic (optional)

### 8. Cost-Benefit Analysis

**Option 1: Stay on 2GB VPS**
- Cost: $10-20/month
- Capacity: 50-150 users
- Pros: Minimal cost, simple deployment
- Cons: Limited growth, single point of failure

**Option 2: Upgrade to 4GB VPS**
- Cost: $20-40/month
- Capacity: 150-300 users
- Pros: 2x capacity, still simple
- Cons: Still single point of failure

**Option 3: Horizontal Scaling**
- Cost: $80-150/month
- Capacity: 500-1000+ users
- Pros: High availability, auto-scaling
- Cons: Complex deployment, higher ops overhead

**Option 4: Managed Services (PaaS)**
- Cost: $150-500/month
- Capacity: Virtually unlimited
- Pros: Managed scaling, backups, monitoring
- Cons: Vendor lock-in, higher cost

### 9. Pre-Launch Checklist

- [ ] Database indexes created (run optimize-database.sql)
- [ ] Connection pooling configured
- [ ] Response caching enabled
- [ ] Gzip compression enabled
- [ ] Rate limiting configured
- [ ] Monitoring stack deployed (Prometheus + Grafana)
- [ ] Alerts configured (CPU, memory, response time)
- [ ] Backup strategy in place
- [ ] Load tests completed (smoke, load, stress)
- [ ] Disaster recovery plan documented
- [ ] Scaling plan defined based on growth projections

### 10. Post-Launch Monitoring Plan

**Week 1:**
- Monitor every 4 hours
- Review all metrics daily
- Optimize based on actual traffic patterns

**Month 1:**
- Daily metric review
- Weekly performance optimization
- Monthly capacity planning review

**Ongoing:**
- Weekly automated reports
- Monthly capacity planning
- Quarterly load testing
- Annual disaster recovery drill

---

## Quick Reference Commands

```bash
# Check current resource usage
docker stats --no-stream

# Monitor database
docker compose exec postgres_db psql -U rmuser -d resourcemanager -f load-testing/config/monitor-database.sql

# Run load test
./load-testing/run-test.sh load

# View API logs
docker compose logs -f api --tail=100

# Check database connections
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c "SELECT count(*) FROM pg_stat_activity;"

# Optimize database
docker compose exec postgres_db psql -U rmuser -d resourcemanager -f load-testing/config/optimize-database.sql
```

---

## Conclusion

A 2GB VPS can comfortably handle **100-150 concurrent users** (9,600-14,400 daily active users) with proper optimization. Monitor metrics closely and be prepared to scale when:

1. P95 response time consistently exceeds 500ms
2. CPU usage sustained above 80%
3. User growth exceeds 200 concurrent users

Start with optimization, then vertical scaling, and only move to horizontal scaling when you need high availability or have exceeded the capacity of a single large VPS.
