#!/bin/bash
echo "=== Invoice columns ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'Invoices' ORDER BY ordinal_position;"
echo ""
echo "=== Invoices Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c 'SELECT "Id", "Status", "Treated", "TotalAmount", "Date"::date FROM "Invoices" WHERE "CompanyId"=4 AND NOT "IsDeleted" ORDER BY "Id";'
echo ""
echo "=== Auth test ==="
RESP=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}')
echo "Auth response: $RESP"
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
echo "Token length: ${#TOKEN}"
if [ ${#TOKEN} -gt 10 ]; then
  echo ""
  echo "=== Stats TND year=2026 ==="
  curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

  echo ""
  echo "=== Stats EUR year=2026 ==="
  curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

  echo ""
  echo "=== Stats EUR all years ==="
  curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
fi
