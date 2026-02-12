# Load Testing for ResourceManager SaaS

## Overview
This directory contains k6 load testing scripts to evaluate the performance and capacity of the ResourceManager invoice SaaS platform before production launch.

## Stack
- **.NET 8 API** - Backend service with JWT authentication
- **PostgreSQL** - Primary database
- **2GB VPS** - Target deployment environment
- **k6** - Load testing tool

## Quick Start

### Prerequisites
```bash
# Install k6
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker (alternative)
docker pull grafana/k6:latest
```

### Running Load Tests

#### 1. Start the Application
```bash
cd /home/runner/work/ResourceManager/ResourceManager
docker compose up -d
```

#### 2. Run Load Tests

**Smoke Test** (Sanity check with 1-5 VUs):
```bash
./load-testing/run-test.sh smoke
# Or directly:
k6 run load-testing/scenarios/smoke-test.js
```

**Load Test** (Normal expected load - 50 VUs):
```bash
./load-testing/run-test.sh load
# Or directly:
k6 run load-testing/scenarios/load-test.js
```

**Stress Test** (Find breaking point - up to 200 VUs):
```bash
./load-testing/run-test.sh stress
# Or directly:
k6 run load-testing/scenarios/stress-test.js
```

**Spike Test** (Sudden traffic surge):
```bash
./load-testing/run-test.sh spike
# Or directly:
k6 run load-testing/scenarios/spike-test.js
```

**Soak Test** (24-hour endurance test):
```bash
./load-testing/run-test.sh soak
# Or directly:
k6 run load-testing/scenarios/soak-test.js
```

#### 3. Monitor Performance
```bash
# Start monitoring stack (Prometheus + Grafana)
docker compose -f load-testing/docker-compose.monitoring.yml up -d

# Access Grafana dashboard at http://localhost:3000
# Default credentials: admin/admin
```

## Test Scenarios

### Realistic Invoice SaaS Workflow
Each virtual user simulates a typical user session:

1. **Login** - Authenticate with email/password
2. **View Dashboard** - Fetch dashboard statistics
3. **List Invoices** - Paginated invoice list (20 per page)
4. **Create Invoice** - Add new invoice with 3-5 line items
5. **Generate PDF** - Request invoice PDF generation
6. **List Clients** - Fetch client list
7. **View Invoice Details** - Get specific invoice data
8. **Update Invoice** - Modify invoice status/amount
9. **Think Time** - Random 1-5 second pause between actions

### Test Types

| Test | Duration | VUs | Purpose |
|------|----------|-----|---------|
| **Smoke** | 2 min | 1-5 | Verify all endpoints work |
| **Load** | 10 min | 10-50 | Normal traffic simulation |
| **Stress** | 15 min | 50-200 | Find breaking point |
| **Spike** | 5 min | 0→100→0 | Sudden traffic surge |
| **Soak** | 24 hrs | 30 | Detect memory leaks |

## Capacity Planning for 2GB VPS

### Expected Capacity

Based on typical .NET + PostgreSQL performance with 2GB RAM:

| Metric | Conservative | Optimal | Aggressive |
|--------|--------------|---------|------------|
| **Concurrent Users** | 50-100 | 100-200 | 200-300 |
| **Requests/sec** | 50-100 | 100-200 | 200-300 |
| **Response Time (P95)** | <500ms | <300ms | <200ms |
| **Database Connections** | 20-30 | 30-50 | 50-100 |

### Memory Allocation Recommendations
- **PostgreSQL**: 512-768 MB
- **.NET API**: 768-1024 MB
- **OS + Overhead**: 256-512 MB

### Database Tuning for 2GB
Add these to PostgreSQL configuration:
```
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 8MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 100
```

## Detecting Bottlenecks

### 1. Application Metrics (k6 Output)
Monitor these key metrics in k6 reports:

```javascript
// Good performance indicators:
http_req_duration (P95) < 500ms     // 95% requests under 500ms
http_req_failed < 1%                // Less than 1% error rate
http_reqs > 50/s                    // Sustained throughput

// Warning signs:
http_req_duration (P95) > 1000ms    // Slow responses
http_req_failed > 5%                // High error rate
http_req_blocked > 10ms             // Connection pool exhaustion
```

### 2. Database Bottlenecks
```bash
# Monitor PostgreSQL performance
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c "
SELECT 
  schemaname, 
  tablename, 
  seq_scan, 
  seq_tup_read, 
  idx_scan, 
  idx_tup_fetch
FROM pg_stat_user_tables 
ORDER BY seq_scan DESC 
LIMIT 10;"

# Check slow queries
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c "
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;"

# Monitor active connections
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c "
SELECT count(*) as total_connections, 
       state, 
       wait_event_type 
FROM pg_stat_activity 
GROUP BY state, wait_event_type;"
```

### 3. API Server Bottlenecks
```bash
# Monitor CPU and Memory
docker stats resourcemanager-api --no-stream

# Check application logs for errors
docker compose logs -f api | grep -E "ERROR|WARN|Exception"

# Monitor .NET thread pool
# Add to Program.cs: 
# ThreadPool.GetAvailableThreads(out int workerThreads, out int completionPortThreads);
# _logger.LogInformation("Available threads: {worker}/{completion}", workerThreads, completionPortThreads);
```

### 4. Common Bottleneck Patterns

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| P95 latency increases linearly | Database query performance | Add indexes, optimize queries |
| Error rate spikes at high load | Connection pool exhaustion | Increase max connections |
| Memory increases over time | Memory leak | Check for unclosed connections, circular references |
| CPU at 100% | Inefficient algorithms | Profile code, optimize hot paths |
| Disk I/O maxed out | Excessive logging or DB writes | Reduce log verbosity, batch writes |

## Scaling Strategies

### Vertical Scaling (Upgrade VPS)

| VPS Size | Expected Capacity | Cost Multiplier |
|----------|------------------|-----------------|
| 2GB RAM | 50-100 users | 1x (baseline) |
| 4GB RAM | 150-300 users | 2x |
| 8GB RAM | 400-800 users | 4x |
| 16GB RAM | 1000+ users | 8x |

**When to scale up:**
- Sustained CPU > 70%
- Memory usage > 80%
- Database connections > 70% of max
- P95 response time > 500ms

### Horizontal Scaling (Multiple Servers)

```
                 Load Balancer (nginx/HAProxy)
                         |
        +----------------+----------------+
        |                |                |
    API Server 1     API Server 2     API Server 3
    (2GB VPS)        (2GB VPS)        (2GB VPS)
        |                |                |
        +----------------+----------------+
                         |
                  PostgreSQL (Managed)
                  (4-8GB instance)
```

**Implementation:**
1. **Database**: Migrate to managed PostgreSQL (AWS RDS, Azure Database, DigitalOcean Managed DB)
2. **API Servers**: Deploy multiple instances behind load balancer
3. **Session Storage**: Use Redis for distributed caching
4. **File Storage**: Move to object storage (S3, Azure Blob, Supabase)

**When to scale out:**
- Single VPS can't handle load even after optimization
- Need high availability (99.9%+ uptime)
- Traffic varies significantly (scale up/down automatically)

### Database Scaling

**Read Replicas** (for read-heavy workloads):
```
Primary DB (writes) ──→ Read Replica 1 (reads)
                    ──→ Read Replica 2 (reads)
```

**Connection Pooling** (PgBouncer):
```yaml
# Add to docker-compose.yml
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES_HOST: postgres_db
    DATABASES_PORT: 5432
    DATABASES_USER: rmuser
    DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
    DATABASES_DBNAME: resourcemanager
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 25
```

### Optimization Before Scaling

**Before spending money on bigger servers, optimize first:**

1. **Add Database Indexes**
   ```sql
   -- Invoice queries
   CREATE INDEX idx_invoices_date ON invoices(date DESC);
   CREATE INDEX idx_invoices_company_id ON invoices(company_id);
   CREATE INDEX idx_invoices_status ON invoices(status);
   
   -- Client queries
   CREATE INDEX idx_clients_company_id ON clients(company_id);
   CREATE INDEX idx_clients_name ON clients(name);
   ```

2. **Enable Response Caching**
   ```csharp
   // In Program.cs
   builder.Services.AddResponseCaching();
   builder.Services.AddMemoryCache();
   
   // In controllers
   [ResponseCache(Duration = 60)] // Cache for 60 seconds
   public async Task<IActionResult> GetInvoices()
   ```

3. **Implement Pagination**
   - Limit default page size to 20-50 items
   - Use cursor-based pagination for large datasets

4. **Optimize Queries**
   - Avoid N+1 queries (use `.Include()` properly)
   - Select only needed fields
   - Use AsNoTracking() for read-only queries

5. **Connection Pooling**
   ```
   # In connection string:
   ...;Pooling=true;Minimum Pool Size=5;Maximum Pool Size=100;
   ```

## Results Analysis

### Success Criteria
- ✅ P95 response time < 500ms under normal load
- ✅ Error rate < 1%
- ✅ Can handle 50 concurrent users smoothly
- ✅ No memory leaks over 24 hours
- ✅ Database CPU < 70% under load

### Generate HTML Report
```bash
k6 run --out json=results/load-test.json scenarios/load-test.js
k6 report results/load-test.json --format html > results/load-test-report.html
```

### Example Output Interpretation
```
✓ status was 200
✓ response time < 500ms

checks.........................: 98.5%  ✓ 5234   ✗ 80
data_received..................: 45 MB  75 kB/s
data_sent......................: 8.5 MB 14 kB/s
http_req_blocked...............: avg=2.5ms   p95=12ms
http_req_connecting............: avg=1.2ms   p95=5ms
http_req_duration..............: avg=145ms   p95=380ms  ← GOOD!
http_req_failed................: 1.5%   ✗ 80     ← NEEDS INVESTIGATION
http_req_receiving.............: avg=0.8ms   p95=2.5ms
http_req_sending...............: avg=0.3ms   p95=1.2ms
http_req_waiting...............: avg=143ms   p95=375ms
http_reqs......................: 5314   88.5/s  ← GOOD THROUGHPUT
iterations.....................: 532    8.8/s
vus............................: 50     min=10  max=50
```

## Continuous Load Testing

### CI/CD Integration
Add to `.github/workflows/load-test.yml`:
```yaml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker compose up -d
      - name: Wait for services
        run: sleep 30
      - name: Run k6
        uses: grafana/k6-action@v0.3.1
        with:
          filename: load-testing/scenarios/smoke-test.js
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results/
```

## Support & Resources

- **k6 Documentation**: https://k6.io/docs/
- **k6 Examples**: https://github.com/grafana/k6-learn
- **PostgreSQL Tuning**: https://pgtune.leopard.in.ua/
- **.NET Performance**: https://learn.microsoft.com/en-us/dotnet/core/diagnostics/

## Troubleshooting

### k6 Connection Errors
```bash
# Increase system limits
ulimit -n 65535  # File descriptors
sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

### Database Connection Pool Exhausted
```bash
# Check current connections
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Increase max_connections in docker-compose.yml
postgres_db:
  command: postgres -c max_connections=200
```

### API Server OOM (Out of Memory)
```bash
# Monitor memory in real-time
docker stats resourcemanager-api

# Limit API container memory
docker compose down
# Edit docker-compose.yml: add under 'api' service
#   deploy:
#     resources:
#       limits:
#         memory: 1G
docker compose up -d
```

## Next Steps After Load Testing

1. **Analyze Results**: Review k6 reports, identify bottlenecks
2. **Optimize**: Apply database indexes, query optimization, caching
3. **Re-test**: Run tests again to validate improvements
4. **Capacity Plan**: Determine VPS sizing based on user projections
5. **Monitor Production**: Set up Prometheus + Grafana for ongoing monitoring
6. **Set Alerts**: Configure alerts for high latency, error rates, resource usage
7. **Document**: Record baseline performance metrics for future comparison
