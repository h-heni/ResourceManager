#!/bin/bash
echo "=== HistoricalRevenues for Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT COUNT(*) as total, date_part('\''year'\'', "Date")::int as year, "Currency" FROM "HistoricalRevenues" WHERE "CompanyId"=4 GROUP BY year, "Currency" ORDER BY year;'

echo ""
echo "=== HistoricalRevenues sample rows ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "ClientName", "AmountPaid", "Currency", "Date"::date, "IsDeleted" FROM "HistoricalRevenues" WHERE "CompanyId"=4 ORDER BY "Date" LIMIT 10;'

echo ""
echo "=== Invoices by year for Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT date_part('\''year'\'', "Date")::int as year, COUNT(*) as cnt, COUNT(*) FILTER (WHERE "Treated") as treated FROM "Invoices" WHERE "CompanyId"=4 AND NOT "IsDeleted" GROUP BY year ORDER BY year;'

echo ""
echo "=== HistoricalExpenses for Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT COUNT(*) as total, date_part('\''year'\'', "Date")::int as year, "Currency" FROM "HistoricalExpenses" WHERE "CompanyId"=4 GROUP BY year, "Currency" ORDER BY year;'

echo ""
echo "=== OtherExpenses by year for Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT date_part('\''year'\'', "Date")::int as year, COUNT(*) as cnt, SUM("Amount") as total, "Currency" FROM "OtherExpenses" WHERE "CompanyId"=4 AND NOT "IsDeleted" GROUP BY year, "Currency" ORDER BY year;'

echo ""
echo "=== API test: Stats EUR year=2025 ==="
TOKEN=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR&year=2025" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  availableYears: {d[\"availableYears\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]}')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
print(f'  activeClients: {d[\"activeClients\"]}')
print(f'  statusBreakdown: {d[\"statusBreakdown\"]}')
print(f'  isAllYearsMode: {d[\"isAllYearsMode\"]}')
print(f'  selectedYear: {d[\"selectedYear\"]}')
"

echo ""
echo "=== API test: Stats TND year=2025 ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2025" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]}')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
"
