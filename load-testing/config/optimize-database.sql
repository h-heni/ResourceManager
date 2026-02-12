-- =============================================================================
-- PostgreSQL Performance Optimization for 2GB VPS
-- =============================================================================
-- Run these optimizations to improve database performance before load testing
-- Execute: psql -U rmuser -d resourcemanager -f optimize-database.sql
-- =============================================================================

\echo '============================================'
\echo 'PostgreSQL Optimization Script'
\echo '============================================'

-- 1. CREATE MISSING INDEXES
\echo ''
\echo '📊 Creating performance indexes...'

-- Invoice indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date_desc ON invoices(date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, date DESC);

-- Client indexes
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- InvoiceItem indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- Devis (Quotes) indexes
CREATE INDEX IF NOT EXISTS idx_devis_company_id ON devis(company_id);
CREATE INDEX IF NOT EXISTS idx_devis_date_desc ON devis(date DESC);
CREATE INDEX IF NOT EXISTS idx_devis_client_id ON devis(client_id);

-- Delivery Notes indexes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_id ON delivery_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date_desc ON delivery_notes(date DESC);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON "AspNetUsers"(company_id);

-- Company indexes
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at);

\echo '✅ Indexes created'

-- 2. UPDATE STATISTICS
\echo ''
\echo '📈 Updating table statistics...'
ANALYZE invoices;
ANALYZE clients;
ANALYZE invoice_items;
ANALYZE payments;
ANALYZE devis;
ANALYZE delivery_notes;
ANALYZE companies;
ANALYZE "AspNetUsers";
\echo '✅ Statistics updated'

-- 3. VACUUM (reclaim space and update statistics)
\echo ''
\echo '🧹 Vacuuming tables...'
VACUUM ANALYZE invoices;
VACUUM ANALYZE clients;
VACUUM ANALYZE invoice_items;
VACUUM ANALYZE payments;
\echo '✅ Vacuum complete'

-- 4. CHECK FOR MISSING PRIMARY KEYS
\echo ''
\echo '🔑 Checking for missing primary keys...'
SELECT 
    schemaname, 
    tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
    SELECT tablename 
    FROM pg_indexes 
    WHERE indexname LIKE '%_pkey'
);

-- 5. CHECK FOR TABLES WITHOUT INDEXES
\echo ''
\echo '📋 Tables with no indexes (excluding junction tables):'
SELECT 
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
    SELECT DISTINCT tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 6. DISPLAY INDEX USAGE STATISTICS
\echo ''
\echo '📊 Index usage statistics:'
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- 7. TABLE SIZES
\echo ''
\echo '💾 Table sizes:'
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- 8. SLOW QUERY DETECTION (requires pg_stat_statements extension)
\echo ''
\echo '🐌 Enabling slow query tracking...'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\echo ''
\echo '============================================'
\echo 'Optimization Complete!'
\echo '============================================'
\echo ''
\echo 'Recommendations:'
\echo '  1. Monitor index usage after load testing'
\echo '  2. Run VACUUM ANALYZE regularly (weekly)'
\echo '  3. Check slow queries: SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;'
\echo '  4. Review connection pooling settings'
\echo ''
