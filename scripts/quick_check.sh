#!/bin/bash
echo "=== Invoices by company and year (latest check) ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT \"CompanyId\", date_part('year', \"Date\")::int as year, COUNT(*) as total, COUNT(*) FILTER (WHERE \"Treated\") as treated FROM \"Invoices\" WHERE NOT \"IsDeleted\" GROUP BY \"CompanyId\", year ORDER BY \"CompanyId\", year;"

echo ""
echo "=== HistoricalRevenues (latest check) ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT \"CompanyId\", date_part('year', \"Date\")::int as year, COUNT(*) as total FROM \"HistoricalRevenues\" GROUP BY \"CompanyId\", year ORDER BY \"CompanyId\", year;"

echo ""
echo "=== Total row count in key tables ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT 'Invoices' as tbl, COUNT(*) FROM \"Invoices\" UNION ALL SELECT 'HistoricalRevenues', COUNT(*) FROM \"HistoricalRevenues\" UNION ALL SELECT 'HistoricalExpenses', COUNT(*) FROM \"HistoricalExpenses\" UNION ALL SELECT 'OtherExpenses', COUNT(*) FROM \"OtherExpenses\" UNION ALL SELECT 'SupplierInvoices', COUNT(*) FROM \"SupplierInvoices\";"
