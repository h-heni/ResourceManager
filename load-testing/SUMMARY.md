# Load Testing Infrastructure - Implementation Summary

## ✅ What's Been Created

### 📁 Directory Structure
```
load-testing/
├── README.md                           # Main documentation
├── QUICKSTART.md                       # 5-minute getting started guide
├── CAPACITY_PLANNING.md                # Detailed capacity analysis for 2GB VPS
├── run-test.sh                         # Test runner script (executable)
├── setup.sh                            # Environment setup script (executable)
├── docker-compose.loadtest.yml         # Optimized Docker setup for testing
├── docker-compose.monitoring.yml       # Prometheus + Grafana monitoring
│
├── scenarios/                          # k6 test scripts
│   ├── smoke-test.js                   # Quick validation (2 min, 5 VUs)
│   ├── load-test.js                    # Normal load (10 min, 10-50 VUs)
│   ├── stress-test.js                  # Find limits (15 min, 50-200 VUs)
│   ├── spike-test.js                   # Traffic surge (5 min, 0→100→0 VUs)
│   └── soak-test.js                    # 24-hour endurance test
│
├── config/                             # Configuration files
│   ├── prometheus.yml                  # Metrics collection config
│   ├── grafana-datasources.yml         # Grafana data sources
│   ├── grafana-dashboards.yml          # Dashboard provisioning
│   ├── postgresql-tuning.conf          # PostgreSQL optimization settings
│   ├── optimize-database.sql           # Index creation & optimization
│   └── monitor-database.sql            # Real-time monitoring queries
│
├── utils/                              # Utility functions
│   └── common.js                       # Shared k6 utilities
│
├── data/                               # Test data
│   └── test-data.js                    # Sample data for tests
│
└── results/                            # Test outputs (gitignored)
    ├── .gitignore
    └── README.md
```

## 🎯 Test Scenarios

### 1. Smoke Test (`smoke-test.js`)
- **Purpose**: Quick sanity check
- **Duration**: 2 minutes
- **Load**: 5 concurrent virtual users
- **Use case**: Verify all endpoints work before full testing

### 2. Load Test (`load-test.js`)
- **Purpose**: Simulate normal production traffic
- **Duration**: 10 minutes
- **Load**: Ramps from 10 → 50 → 50 → 0 users
- **Workflow**: Login → Dashboard → Browse invoices → Create invoice → Generate PDF
- **Use case**: Baseline performance measurement

### 3. Stress Test (`stress-test.js`)
- **Purpose**: Find system breaking point
- **Duration**: 15 minutes
- **Load**: Ramps from 50 → 100 → 150 → 200 users
- **Use case**: Determine maximum capacity

### 4. Spike Test (`spike-test.js`)
- **Purpose**: Test sudden traffic surge
- **Duration**: 5 minutes
- **Load**: Sudden spike from 10 → 100 users, then back to 10
- **Use case**: Verify system recovery after spikes

### 5. Soak Test (`soak-test.js`)
- **Purpose**: Detect memory leaks and degradation
- **Duration**: 24 hours
- **Load**: Constant 30 users
- **Use case**: Production readiness validation

## 📊 Capacity Planning Results

### Expected Performance on 2GB VPS

| Metric | Conservative | Optimal | Aggressive |
|--------|--------------|---------|------------|
| **Concurrent Users** | 50-75 | 100-150 | 200-250 |
| **Daily Active Users** | 4,800-7,200 | 9,600-14,400 | 19,200-24,000 |
| **Requests/sec** | 50-100 | 100-200 | 200-300 |
| **P95 Response Time** | <500ms | <300ms | <200ms |
| **Database Connections** | 20-30 | 30-50 | 50-100 |

### Memory Allocation (2GB Total)
- **PostgreSQL**: 768 MB (37.5%)
- **.NET API**: 896 MB (44%)
- **OS + Overhead**: 384 MB (18.5%)

## 🚀 Quick Start Commands

```bash
# 1. Setup environment
./load-testing/setup.sh

# 2. Run smoke test (recommended first)
./load-testing/run-test.sh smoke

# 3. Run load test
./load-testing/run-test.sh load

# 4. Start monitoring (optional)
docker compose -f load-testing/docker-compose.monitoring.yml up -d
# Access Grafana: http://localhost:3000 (admin/admin)

# 5. Optimize database
docker compose exec postgres_db psql -U rmuser -d resourcemanager \
  -f /path/to/load-testing/config/optimize-database.sql
```

## 🔍 Bottleneck Detection

### Application-Level Monitoring
```bash
# Watch resource usage during tests
docker stats

# Monitor API logs
docker compose logs -f api | grep -E "ERROR|WARN"

# Check response times
# Review k6 output for http_req_duration metrics
```

### Database-Level Monitoring
```bash
# Real-time monitoring
docker compose exec postgres_db psql -U rmuser -d resourcemanager \
  -f load-testing/config/monitor-database.sql

# Key metrics to watch:
# - Active connections (should be < 80% of max)
# - Slow queries (mean_exec_time > 100ms)
# - Cache hit ratio (should be > 99%)
# - Sequential scans (should be minimal)
```

### Common Bottleneck Patterns

| Symptom | Cause | Solution |
|---------|-------|----------|
| P95 latency increasing linearly | Database query performance | Add indexes, optimize queries |
| Error rate spike at high load | Connection pool exhaustion | Increase max_connections |
| Memory increases over time | Memory leak | Check for unclosed connections |
| CPU at 100% | Inefficient code | Profile and optimize hot paths |

## 📈 Scaling Decision Tree

```
Start: Are you experiencing performance issues?
│
├─ No → Monitor and be happy! 🎉
│
└─ Yes → Is P95 response time > 500ms?
    │
    ├─ No → Check error logs, might be a bug
    │
    └─ Yes → Have you optimized?
        │
        ├─ No → Run optimize-database.sql
        │      Enable caching
        │      Fix N+1 queries
        │      Then re-test
        │
        └─ Yes → Is CPU or Memory > 80%?
            │
            ├─ Memory → Upgrade to 4GB VPS ($20-40/mo)
            │
            ├─ CPU → Upgrade to 4GB VPS ($20-40/mo)
            │
            └─ Both OK → You might need horizontal scaling
                         or there's a code issue
```

## 🎯 Success Criteria

### Pre-Launch Checklist
- [ ] Smoke test passes (all checks > 95%)
- [ ] Load test P95 < 500ms
- [ ] Stress test shows graceful degradation
- [ ] No memory leaks in soak test (if run)
- [ ] Error rate < 1% under normal load
- [ ] Database indexes created
- [ ] Monitoring stack deployed
- [ ] Backup strategy in place

### Performance Targets
- ✅ **P95 Response Time**: < 500ms (normal load)
- ✅ **P99 Response Time**: < 1000ms (normal load)
- ✅ **Error Rate**: < 1%
- ✅ **Throughput**: > 50 requests/second
- ✅ **Uptime**: > 99.5%

## 🛠️ Maintenance

### Regular Tasks
- **Weekly**: Review performance metrics
- **Monthly**: Run load tests to establish baseline
- **Quarterly**: Run stress tests to verify capacity
- **Yearly**: Run 24-hour soak test

### When to Run Load Tests
- Before major releases
- After significant code changes
- After infrastructure changes
- When planning capacity upgrades
- After performance optimizations

## 📚 Documentation Files

1. **README.md** - Complete documentation (12KB)
2. **QUICKSTART.md** - 5-minute quick start (6KB)
3. **CAPACITY_PLANNING.md** - Detailed capacity analysis (9KB)
4. **This file** - Implementation summary

## 🔧 Technologies Used

- **k6**: Load testing framework (https://k6.io)
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **PostgreSQL**: Database with performance monitoring
- **Docker Compose**: Container orchestration

## 💡 Key Features

1. **Realistic Scenarios**: Tests mirror actual user behavior
2. **Graduated Testing**: Smoke → Load → Stress progression
3. **Comprehensive Monitoring**: App + DB + System metrics
4. **Capacity Planning**: Concrete numbers for 2GB VPS
5. **Optimization Scripts**: Database tuning and indexing
6. **Production-Ready**: Based on industry best practices

## 🎓 Learning Resources

- k6 Documentation: https://k6.io/docs/
- PostgreSQL Tuning: https://pgtune.leopard.in.ua/
- .NET Performance: https://docs.microsoft.com/en-us/dotnet/core/diagnostics/
- Grafana Dashboards: https://grafana.com/grafana/dashboards/

## 🤝 Support

If you encounter issues:
1. Check QUICKSTART.md for common issues
2. Review test logs in `results/` directory
3. Check API logs: `docker compose logs api`
4. Monitor database: Run `monitor-database.sql`
5. Verify setup: `docker compose ps`

---

**Ready to test?** Start with: `./load-testing/run-test.sh smoke`
