#!/bin/bash
echo "=== All users ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Email", "CompanyId" FROM "AspNetUsers" ORDER BY "CompanyId";'

echo ""
echo "=== Test AHT account ==="
TOKEN=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"AHT@gmail.com","password":"AHT@gmail.com"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','FAIL: '+str(d)))" 2>/dev/null)
echo "Token length: ${#TOKEN}"

if [ ${#TOKEN} -gt 10 ]; then
  echo ""
  echo "=== AHT - Stats EUR 2025 ==="
  curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR&year=2025" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  availableYears: {d[\"availableYears\"]}')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]}')
"

  echo ""
  echo "=== AHT - Stats TND 2025 ==="
  curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2025" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]}')
"
fi

echo ""
echo "=== Check ALL Invoices including date range 2024-2025 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "CompanyId", date_part('\''year'\'', "Date")::int as year, "Status", "Treated", COUNT(*) FROM "Invoices" GROUP BY "CompanyId", year, "Status", "Treated" ORDER BY "CompanyId", year;'
