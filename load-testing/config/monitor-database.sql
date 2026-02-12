-- =============================================================================
-- Database Monitoring Queries
-- =============================================================================
-- Use these queries during load testing to identify bottlenecks
-- =============================================================================

-- 1. ACTIVE CONNECTIONS
\echo '🔌 Active Database Connections:'
SELECT 
    count(*) as total_connections,
    state,
    wait_event_type,
    count(*) * 100.0 / sum(count(*)) OVER () as percentage
FROM pg_stat_activity
WHERE datname = 'resourcemanager'
GROUP BY state, wait_event_type
ORDER BY count(*) DESC;

-- 2. SLOW QUERIES (requires pg_stat_statements)
\echo ''
\echo '🐌 Top 10 Slowest Queries (by mean execution time):'
SELECT 
    round(mean_exec_time::numeric, 2) as avg_ms,
    round(total_exec_time::numeric, 2) as total_ms,
    calls,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) as pct_total,
    left(query, 80) as query_snippet
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'resourcemanager')
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 3. MOST FREQUENT QUERIES
\echo ''
\echo '🔥 Top 10 Most Frequently Called Queries:'
SELECT 
    calls,
    round(mean_exec_time::numeric, 2) as avg_ms,
    round(total_exec_time::numeric, 2) as total_ms,
    left(query, 80) as query_snippet
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'resourcemanager')
ORDER BY calls DESC
LIMIT 10;

-- 4. TABLE SCAN STATISTICS (sequential vs index scans)
\echo ''
\echo '📊 Table Scan Statistics (Sequential vs Index):'
SELECT
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    seq_tup_read as seq_rows_read,
    idx_scan as index_scans,
    idx_tup_fetch as idx_rows_fetched,
    CASE 
        WHEN seq_scan = 0 THEN 0
        WHEN idx_scan = 0 THEN 100
        ELSE round((seq_scan::numeric / (seq_scan + idx_scan) * 100)::numeric, 2)
    END as seq_scan_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

-- 5. CACHE HIT RATIO
\echo ''
\echo '💾 Cache Hit Ratio (should be > 99%):'
SELECT 
    'Cache Hit Ratio' as metric,
    round(
        sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0),
        2
    ) as percentage
FROM pg_stat_database
WHERE datname = 'resourcemanager';

-- 6. LOCKS
\echo ''
\echo '🔒 Current Locks:'
SELECT 
    pg_class.relname,
    pg_locks.mode,
    pg_locks.granted,
    count(*) as lock_count
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
WHERE pg_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY pg_class.relname, pg_locks.mode, pg_locks.granted
ORDER BY lock_count DESC;

-- 7. INDEX USAGE
\echo ''
\echo '📑 Unused Indexes (consider removing):'
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 8. BLOAT ESTIMATION
\echo ''
\echo '💨 Table Bloat Estimation:'
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    round(100 * pg_total_relation_size(schemaname||'.'||tablename) / 
        nullif(pg_database_size(current_database()), 0), 2) as pct_of_db
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 9. LONG-RUNNING QUERIES
\echo ''
\echo '⏱️  Long-Running Queries (> 1 second):'
SELECT
    pid,
    now() - pg_stat_activity.query_start as duration,
    state,
    left(query, 100) as query_snippet
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 seconds'
    AND state = 'active'
    AND datname = 'resourcemanager'
ORDER BY duration DESC;

-- 10. CONNECTION POOL STATS
\echo ''
\echo '🏊 Connection Pool Status:'
SELECT 
    max_conn,
    used,
    res_for_super,
    max_conn - used - res_for_super as available,
    round((used::numeric / max_conn * 100)::numeric, 2) as pct_used
FROM (
    SELECT 
        count(*) as used,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn,
        (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') as res_for_super
    FROM pg_stat_activity
    WHERE datname = 'resourcemanager'
) s;
