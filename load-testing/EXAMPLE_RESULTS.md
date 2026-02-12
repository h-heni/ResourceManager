# Example Load Test Results

## Smoke Test Output Example

```
     /\      |‾‾| /‾‾/   /‾‾/   
    /  \     |  |/  /   /  /    
   /    \    |     (   /   ‾‾\  
  /      \   |  |\  \ |  (‾)  | 
 / __  __ \  |__| \__\ \_____/ .io

execution: local
    script: load-testing/scenarios/smoke-test.js
    output: json (load-testing/results/smoke-test-20240212-041500.json)

scenarios: (100.00%) 1 scenario, 5 max VUs, 2m30s max duration (incl. graceful stop):
          * default: 5 looping VUs for 2m0s (gracefulStop: 30s)

INFO[0002] ℹ️  Setting up test data...                   
INFO[0003] [2024-02-12T04:15:03Z] Login: status is 200  
INFO[0003] [2024-02-12T04:15:03Z] Dashboard Stats: status is 200
INFO[0003] [2024-02-12T04:15:03Z] List Invoices: status is 200
INFO[0004] [2024-02-12T04:15:04Z] List Clients: status is 200
INFO[0004] [2024-02-12T04:15:04Z] Get Company: status is 200
INFO[0004] [2024-02-12T04:15:04Z] List Devis: status is 200

running (2m00.5s), 0/5 VUs, 532 complete and 0 interrupted iterations
default ✓ [======================================] 5 VUs  2m0s

     ✓ Login: status is 200
     ✓ Login: response time < 500ms
     ✓ Login: response time < 1000ms
     ✓ Dashboard Stats: status is 200
     ✓ Dashboard Stats: response time < 500ms
     ✓ Dashboard Stats: response time < 1000ms
     ✓ List Invoices: status is 200
     ✓ List Invoices: response time < 500ms
     ✓ List Invoices: response time < 1000ms
     ✓ List Clients: status is 200
     ✓ List Clients: response time < 500ms
     ✓ List Clients: response time < 1000ms
     ✓ Get Company: status is 200
     ✓ Get Company: response time < 500ms
     ✓ Get Company: response time < 1000ms
     ✓ List Devis: status is 200
     ✓ List Devis: response time < 500ms
     ✓ List Devis: response time < 1000ms

     checks.........................: 100.00% ✓ 5184      ✗ 0    
     data_received..................: 4.2 MB  35 kB/s
     data_sent......................: 825 kB  6.9 kB/s
     http_req_blocked...............: avg=1.89ms   min=1µs     med=4µs      max=156.21ms p(90)=6µs      p(95)=11µs    
     http_req_connecting............: avg=1.03ms   min=0s      med=0s       max=82.43ms  p(90)=0s       p(95)=0s      
     http_req_duration..............: avg=142.51ms min=23.87ms med=126.12ms max=786.34ms p(90)=245.73ms p(95)=298.45ms
       { expected_response:true }...: avg=142.51ms min=23.87ms med=126.12ms max=786.34ms p(90)=245.73ms p(95)=298.45ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 3192 
     http_req_receiving.............: avg=125.24µs min=20µs    med=84µs     max=5.04ms   p(90)=214µs    p(95)=311µs   
     http_req_sending...............: avg=39.29µs  min=8µs     med=29µs     max=1.73ms   p(90)=63µs     p(95)=84µs    
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s       max=0s       p(90)=0s       p(95)=0s      
     http_req_waiting...............: avg=142.34ms min=23.77ms med=125.98ms max=786.23ms p(90)=245.52ms p(95)=298.23ms
     http_reqs......................: 3192    26.6/s
     iteration_duration.............: avg=11.24s   min=9.18s   med=11.12s   max=14.82s   p(90)=12.74s   p(95)=13.21s  
     iterations.....................: 532     4.433333/s
     vus............................: 5       min=5       max=5  
     vus_max........................: 5       min=5       max=5  

✅ Test completed successfully!
ℹ️  Results saved to: load-testing/results/smoke-test-20240212-041500.json
```

## Load Test Output Example

```
     /\      |‾‾| /‾‾/   /‾‾/   
    /  \     |  |/  /   /  /    
   /    \    |     (   /   ‾‾\  
  /      \   |  |\  \ |  (‾)  | 
 / __  __ \  |__| \__\ \_____/ .io

execution: local
    script: load-testing/scenarios/load-test.js
    output: json (load-testing/results/load-test-20240212-042000.json)

scenarios: (100.00%) 1 scenario, 50 max VUs, 10m30s max duration (incl. graceful stop):
          * default: Up to 50 looping VUs for 10m0s over 4 stages (gracefulRampDown: 30s, gracefulStop: 30s)

INFO[0120] 📊 Load test progress: 2m elapsed, 10 VUs active
INFO[0300] 📊 Load test progress: 5m elapsed, 50 VUs active (peak load)
INFO[0480] 📊 Load test progress: 8m elapsed, 50 VUs active
INFO[0600] 📊 Load test complete: 10m total

running (10m00.5s), 0/50 VUs, 4234 complete and 0 interrupted iterations
default ✓ [======================================] 0/50 VUs  10m0s

     ✓ Login: status is 200
     ✓ Login: response time < 500ms
     ✓ Login: response time < 1000ms
     ✓ Dashboard Stats: status is 200
     ✓ Dashboard Stats: response time < 500ms
     ✓ List Invoices (Page 1): status is 200
     ✓ List Invoices (Page 1): response time < 500ms
     ✓ List Clients: status is 200
     ✓ Get Client Details: status is 200
     ✓ Create Invoice: status is 200
     ✓ Create Invoice: response time < 1000ms
     ✓ Generate PDF: status is 200
     ✓ Revenue Summary: status is 200

     checks.........................: 98.67% ✓ 52341     ✗ 706  
     data_received..................: 78 MB  130 kB/s
     data_sent......................: 15 MB  25 kB/s
     http_req_blocked...............: avg=2.47ms   min=1µs     med=4µs      max=234.56ms p(90)=7µs      p(95)=15.23ms 
     http_req_connecting............: avg=1.34ms   min=0s      med=0s       max=156.78ms p(90)=0s       p(95)=8.12ms  
     http_req_duration..............: avg=187.43ms min=18.32ms med=156.23ms max=2.34s    p(90)=342.12ms p(95)=456.78ms
       { expected_response:true }...: avg=186.21ms min=18.32ms med=155.67ms max=2.12s    p(90)=340.45ms p(95)=453.21ms
     http_req_failed................: 1.33%  ✓ 706       ✗ 52341
     http_req_receiving.............: avg=167.34µs min=18µs    med=92µs     max=12.45ms  p(90)=298µs    p(95)=445µs   
     http_req_sending...............: avg=48.23µs  min=7µs     med=32µs     max=3.21ms   p(90)=78µs     p(95)=112µs   
     http_req_waiting...............: avg=187.21ms min=18.28ms med=156.08ms max=2.33s    p(90)=341.89ms p(95)=456.34ms
     http_reqs......................: 53047  88.41/s
     iteration_duration.............: avg=16.72s   min=11.23s  med=15.98s   max=45.67s   p(90)=23.45s   p(95)=27.89s  
     iterations.....................: 4234   7.056667/s
     vus............................: 0      min=0       max=50 
     vus_max........................: 50     min=50      max=50 

✅ Test completed successfully!
ℹ️  Results saved to: load-testing/results/load-test-20240212-042000.json

📊 Performance Summary:
   ✅ P95 response time: 456.78ms (target: <500ms) - PASS
   ⚠️  Error rate: 1.33% (target: <1%) - MARGINAL
   ✅ Throughput: 88.41 req/s - GOOD
   ✅ 98.67% of checks passed - PASS

💡 Recommendations:
   - Investigate the 1.33% error rate (706 failed requests)
   - Check API logs for specific error patterns
   - Consider adding database indexes for frequently queried tables
```

## Stress Test Output Example

```
     /\      |‾‾| /‾‾/   /‾‾/   
    /  \     |  |/  /   /  /    
   /    \    |     (   /   ‾‾\  
  /      \   |  |\  \ |  (‾)  | 
 / __  __ \  |__| \__\ \_____/ .io

execution: local
    script: load-testing/scenarios/stress-test.js
    output: json (load-testing/results/stress-test-20240212-043000.json)

scenarios: (100.00%) 1 scenario, 200 max VUs, 15m30s max duration (incl. graceful stop):
          * default: Up to 200 looping VUs for 15m0s over 6 stages (gracefulRampDown: 30s, gracefulStop: 30s)

INFO[0120] 📊 Stress test: 2m - 50 VUs - P95: 312ms - Errors: 0.5%
INFO[0300] 📊 Stress test: 5m - 100 VUs - P95: 487ms - Errors: 1.2%
INFO[0480] 📊 Stress test: 8m - 150 VUs - P95: 756ms - Errors: 3.4%
INFO[0660] 📊 Stress test: 11m - 200 VUs - P95: 1247ms - Errors: 8.7%
WARN[0720] ⚠️  High error rate detected (>5%) - system under stress!
INFO[0900] 📊 Stress test complete: 15m total

running (15m00.5s), 0/200 VUs, 12456 complete and 0 interrupted iterations
default ✓ [======================================] 0/200 VUs  15m0s

     ✓ Login: status is 200
     ✓ Login: response time < 2000ms
     ✓ Dashboard Stats: status is 200
     ✓ List Invoices: status is 200
     ✓ List Clients: status is 200
     ✓ Create Invoice: status is 200

     checks.........................: 91.23% ✓ 68234     ✗ 6567 
     data_received..................: 198 MB 220 kB/s
     data_sent......................: 38 MB  42 kB/s
     http_req_blocked...............: avg=8.34ms   min=1µs     med=5µs      max=876.23ms p(90)=23.45ms  p(95)=67.89ms 
     http_req_connecting............: avg=4.56ms   min=0s      med=0s       max=534.12ms p(90)=12.34ms  p(95)=34.56ms 
     http_req_duration..............: avg=456.78ms min=21.34ms med=342.12ms max=8.92s    p(90)=987.65ms p(95)=1.54s   
       { expected_response:true }...: avg=423.45ms min=21.34ms med=334.56ms max=5.67s    p(90)=876.54ms p(95)=1.23s   
     http_req_failed................: 8.77%  ✓ 6567      ✗ 68234
     http_req_receiving.............: avg=234.56µs min=16µs    med=98µs     max=45.67ms  p(90)=456µs    p(95)=789µs   
     http_req_sending...............: avg=78.23µs  min=6µs     med=35µs     max=12.34ms  p(90)=123µs    p(95)=234µs   
     http_req_waiting...............: avg=456.46ms min=21.31ms med=341.98ms max=8.91s    p(90)=987.23ms p(95)=1.53s   
     http_reqs......................: 74801  83.11/s
     iteration_duration.............: avg=9.23s    min=4.56s   med=8.12s    max=32.45s   p(90)=14.56s   p(95)=18.23s  
     iterations.....................: 12456  13.84/s
     vus............................: 0      min=0       max=200
     vus_max........................: 200    min=200     max=200

❌ Stress Test Analysis:
   Failure Rate: 8.77%
   P95 Duration: 1540.00ms
   ⚠️  System showed signs of stress (>5% failure rate)
   ⚠️  Response times degraded significantly (P95 > 1s)

🔍 Breaking Point Analysis:
   • 50 VUs: ✅ Stable (P95: 312ms, 0.5% errors)
   • 100 VUs: ✅ Good (P95: 487ms, 1.2% errors)  
   • 150 VUs: ⚠️  Degraded (P95: 756ms, 3.4% errors)
   • 200 VUs: ❌ Overload (P95: 1247ms, 8.7% errors)

💡 Capacity Recommendation:
   Maximum sustainable load: ~120-130 concurrent users
   Comfortable operating capacity: 80-100 concurrent users
   
🚀 Next Steps:
   1. Review database slow queries
   2. Check connection pool settings
   3. Consider vertical scaling to 4GB VPS for >150 users
   4. Implement response caching for read-heavy endpoints
```

## Database Monitoring During Load Test

```bash
$ docker compose exec postgres_db psql -U rmuser -d resourcemanager \
  -f load-testing/config/monitor-database.sql

🔌 Active Database Connections:
 total_connections | state  | wait_event_type | percentage 
-------------------+--------+-----------------+------------
                35 | active | Client          |      58.33
                18 | idle   | (null)          |      30.00
                 7 | idle   | ClientRead      |      11.67
(3 rows)

🐌 Top 10 Slowest Queries (by mean execution time):
 avg_ms  | total_ms | calls | pct_total | query_snippet
---------+----------+-------+-----------+-----------------------------------------------------
  234.56 | 23456.78 |   100 |     12.34 | SELECT i.*, c.name FROM invoices i JOIN clients c ON...
  145.23 | 14523.45 |   100 |      7.65 | SELECT * FROM invoices WHERE company_id = $1 AND date...
   98.76 |  9876.54 |   100 |      5.21 | UPDATE invoices SET status = $1 WHERE id = $2
   67.89 |  6789.01 |   100 |      3.58 | INSERT INTO invoice_items (invoice_id, description...
   45.67 |  4567.89 |   100 |      2.41 | SELECT COUNT(*) FROM invoices WHERE company_id = $1
(5 rows)

💾 Cache Hit Ratio (should be > 99%):
     metric      | percentage 
-----------------+------------
 Cache Hit Ratio |      98.76
(1 row)

✅ Good! Above 98% is acceptable.

📊 Table Scan Statistics (Sequential vs Index):
 schemaname | tablename      | sequential_scans | seq_rows_read | index_scans | idx_rows_fetched | seq_scan_percentage
------------+----------------+------------------+---------------+-------------+------------------+--------------------
 public     | invoices       |              234 |        45678  |        8765 |           123456 |                2.60
 public     | clients        |               12 |          456  |        2345 |            34567 |                0.51
 public     | invoice_items  |                5 |          123  |        5678 |            67890 |                0.09
(3 rows)

✅ Low sequential scan percentages - indexes are being used effectively!
```

## System Resource Monitoring

```bash
$ docker stats --no-stream

CONTAINER ID   NAME                    CPU %     MEM USAGE / LIMIT     MEM %     NET I/O
a1b2c3d4e5f6   resourcemanager-api     68.45%    742MiB / 896MiB      82.81%    156MB / 89MB
b2c3d4e5f6g7   postgres_db             45.23%    623MiB / 768MiB      81.12%    89MB / 156MB

Analysis:
✅ API Memory: 82.81% - Within acceptable range (<85%)
✅ DB Memory: 81.12% - Within acceptable range (<85%)
⚠️  API CPU: 68.45% - Approaching threshold (70%)
✅ DB CPU: 45.23% - Good

Recommendations:
- Monitor CPU usage during peak hours
- Consider vertical scaling if sustained >70%
- Current capacity comfortable for ~100 concurrent users
```

## Result Files

After running tests, you'll find JSON result files in `load-testing/results/`:

```json
{
  "metrics": {
    "http_req_duration": {
      "values": {
        "avg": 187.43,
        "min": 18.32,
        "med": 156.23,
        "max": 2340,
        "p(90)": 342.12,
        "p(95)": 456.78,
        "p(99)": 789.45
      }
    },
    "http_req_failed": {
      "values": {
        "rate": 0.0133,
        "passes": 52341,
        "fails": 706
      }
    },
    "http_reqs": {
      "values": {
        "count": 53047,
        "rate": 88.41
      }
    },
    "checks": {
      "values": {
        "rate": 0.9867,
        "passes": 52341,
        "fails": 706
      }
    }
  }
}
```

You can analyze these files with:
```bash
cat load-testing/results/load-test-*.json | jq '.metrics.http_req_duration.values'
```
