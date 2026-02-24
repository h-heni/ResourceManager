#!/bin/bash
echo "=== All Companies ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Name" FROM "Companies" WHERE NOT "IsDeleted";'

echo ""
echo "=== HistoricalRevenues - ALL companies ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "CompanyId", COUNT(*) as total, date_part('\''year'\'', "Date")::int as year FROM "HistoricalRevenues" GROUP BY "CompanyId", year ORDER BY "CompanyId", year;'

echo ""
echo "=== Invoices - ALL companies by year, treated summary ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "CompanyId", date_part('\''year'\'', "Date")::int as year, COUNT(*) as total, COUNT(*) FILTER (WHERE "Treated") as archived, COUNT(*) FILTER (WHERE NOT "IsDeleted") as active FROM "Invoices" GROUP BY "CompanyId", year ORDER BY "CompanyId", year;'

echo ""
echo "=== PendingInvoices - check for imported data ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "CompanyId", COUNT(*) as cnt FROM "PendingInvoices" GROUP BY "CompanyId";'

echo ""
echo "=== Check all users and their companies ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Email", "CompanyId", "FirstName" FROM "AspNetUsers" ORDER BY "CompanyId";'

echo ""
echo "=== Check Company 4 total invoices (including deleted/2025) ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT date_part('\''year'\'', "Date")::int as year, COUNT(*) total, COUNT(*) FILTER (WHERE "Treated") as treated, COUNT(*) FILTER (WHERE "IsDeleted") as deleted FROM "Invoices" WHERE "CompanyId"=4 GROUP BY year ORDER BY year;'
