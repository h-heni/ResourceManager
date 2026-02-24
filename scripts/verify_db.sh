#!/bin/bash
echo "=== OtherExpenses ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Description", "Amount", "Currency", "Date"::date, "CompanyId", "IsDeleted" FROM "OtherExpenses" ORDER BY "Id";'
echo ""
echo "=== Invoices (Company 4) ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Status", "Treated", "TotalAmount", "AmountPaid", "Date"::date FROM "Invoices" WHERE "CompanyId"=4 AND NOT "IsDeleted" ORDER BY "Id";'
echo ""
echo "=== Quote currencies for Company 4 invoices ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT i."Id", q."Currency" as quote_currency FROM "Invoices" i LEFT JOIN "Quotes" q ON i."QuoteId" = q."Id" WHERE i."CompanyId"=4 AND NOT i."IsDeleted" ORDER BY i."Id";'
echo ""
echo "=== Test API auth ==="
TOKEN=$(curl -s -X POST http://localhost:5000/api/Auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"Manager@gmail.com\",\"password\":\"Manager@gmail.com\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
echo "Token obtained: ${#TOKEN} chars"

echo ""
echo "=== Stats TND year=2026 ==="
curl -s "http://localhost:5000/api/dashboard/stats?currency=TND&year=2026" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "=== Stats EUR year=2026 ==="
curl -s "http://localhost:5000/api/dashboard/stats?currency=EUR&year=2026" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "=== Stats all years no year param ==="
curl -s "http://localhost:5000/api/dashboard/stats?currency=EUR" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "FAILED"
