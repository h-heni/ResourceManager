# Load Testing Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install k6
```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (using Chocolatey)
choco install k6

# Or use Docker
docker pull grafana/k6:latest
```

### Step 2: Start Your Application
```bash
cd /home/runner/work/ResourceManager/ResourceManager

# Make sure you have a .env file
cp .env.example .env
# Edit .env and set passwords

# Start services
docker compose up -d

# Wait for services (30-60 seconds)
docker compose logs -f api
# Press Ctrl+C when you see "Now listening on: http://0.0.0.0:8080"
```

### Step 3: Run Your First Load Test
```bash
# Smoke test (2 minutes, 5 users)
./load-testing/run-test.sh smoke

# Or run directly with k6
k6 run load-testing/scenarios/smoke-test.js
```

### Step 4: Interpret Results

Look for these key metrics in the output:

```
✓ checks.........................: 98.5%  ✓ 5234   ✗ 80
  http_req_duration..............: avg=145ms   p95=380ms  ← GOOD if < 500ms
  http_req_failed................: 1.5%   ✗ 80          ← GOOD if < 1%
  http_reqs......................: 5314   88.5/s        ← Throughput
```

**Good performance:**
- ✅ P95 < 500ms
- ✅ Error rate < 1%
- ✅ Checks pass rate > 98%

**Needs attention:**
- ⚠️ P95 > 500ms - Optimize queries or scale
- ⚠️ Error rate > 1% - Check logs for errors
- ⚠️ Checks < 98% - Investigate failures

### Step 5: Monitor Your System

While tests are running:

```bash
# Watch resource usage
docker stats

# Check API logs
docker compose logs -f api

# Monitor database
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

---

## 📊 Test Scenarios

### Smoke Test (Recommended First)
**Purpose:** Verify everything works  
**Duration:** 2 minutes  
**Load:** 5 concurrent users  

```bash
./load-testing/run-test.sh smoke
```

### Load Test
**Purpose:** Test normal expected load  
**Duration:** 10 minutes  
**Load:** Ramps from 10 to 50 users  

```bash
./load-testing/run-test.sh load
```

### Stress Test
**Purpose:** Find breaking point  
**Duration:** 15 minutes  
**Load:** Ramps from 50 to 200 users  

```bash
./load-testing/run-test.sh stress
```

### Spike Test
**Purpose:** Test sudden traffic surge  
**Duration:** 5 minutes  
**Load:** Sudden spike from 10 to 100 users  

```bash
./load-testing/run-test.sh spike
```

### Soak Test (Long-Running)
**Purpose:** Detect memory leaks  
**Duration:** 24 hours  
**Load:** 30 concurrent users  

```bash
./load-testing/run-test.sh soak
```

---

## 🔧 Common Issues & Quick Fixes

### Issue: k6 not found
```bash
# Install k6 (see Step 1 above)
# Or use Docker
alias k6='docker run --rm -i -v $(pwd):/app grafana/k6:latest'
```

### Issue: API not responding
```bash
# Check if services are running
docker compose ps

# If not running
docker compose up -d

# Check API health
curl http://localhost:7175/health
```

### Issue: "Connection refused" errors
```bash
# Check if port 7175 is accessible
netstat -an | grep 7175

# If not, check docker port mapping
docker compose ps
# Should show: 0.0.0.0:7175->8080/tcp
```

### Issue: High error rate (>5%)
```bash
# Check API logs for errors
docker compose logs api --tail=100 | grep -i error

# Check database connections
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# If connection pool exhausted, increase max_connections
```

### Issue: Slow response times (P95 > 1000ms)
```bash
# Check database performance
docker compose exec postgres_db psql -U rmuser -d resourcemanager \
  -f load-testing/config/monitor-database.sql

# Optimize database
docker compose exec postgres_db psql -U rmuser -d resourcemanager \
  -f load-testing/config/optimize-database.sql

# Check for slow queries
docker compose exec postgres_db psql -U rmuser -d resourcemanager -c \
  "SELECT query, mean_exec_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC LIMIT 10;"
```

---

## 📈 Next Steps

After your first smoke test:

1. **Review Results**
   - Check if P95 < 500ms ✅
   - Check if error rate < 1% ✅
   - Note your baseline metrics

2. **Run Load Test**
   ```bash
   ./load-testing/run-test.sh load
   ```

3. **Optimize if Needed**
   - Add database indexes (see CAPACITY_PLANNING.md)
   - Enable caching
   - Tune PostgreSQL settings

4. **Test Again**
   - Run load test again to verify improvements

5. **Stress Test**
   ```bash
   ./load-testing/run-test.sh stress
   ```
   - Find your breaking point
   - Plan capacity accordingly

6. **Set Up Monitoring** (Optional)
   ```bash
   docker compose -f load-testing/docker-compose.monitoring.yml up -d
   # Access Grafana at http://localhost:3000
   # Login: admin / admin
   ```

---

## 📚 Learn More

- **Full Documentation**: [load-testing/README.md](./README.md)
- **Capacity Planning**: [load-testing/CAPACITY_PLANNING.md](./CAPACITY_PLANNING.md)
- **k6 Documentation**: https://k6.io/docs/

---

## 💡 Pro Tips

1. **Always start with smoke test** - Don't jump straight to stress testing
2. **Monitor during tests** - Use `docker stats` to watch resource usage
3. **Test incrementally** - smoke → load → stress
4. **Compare results** - Save baseline metrics and compare after changes
5. **Optimize before scaling** - Database indexes are free, bigger servers cost money

---

## 🆘 Need Help?

Check these resources:
- Test logs: `load-testing/results/`
- API logs: `docker compose logs api`
- Database logs: `docker compose logs postgres_db`
- Monitor DB: `load-testing/config/monitor-database.sql`

Common commands:
```bash
# Restart everything
docker compose down && docker compose up -d

# Clean slate (WARNING: deletes data)
docker compose down -v && docker compose up -d

# Check what's running
docker compose ps

# View resource usage
docker stats --no-stream
```
