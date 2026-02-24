#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

echo "=== Stats EUR 2026 (7 invoices, 1 archived) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]} (should be 7)')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]} (should be 1 - archived)')
print(f'  => Sales Overview Invoices card now shows: {d[\"totalInvoiceCount\"]} (was: {d[\"totalInvoiceCount\"] - d[\"paidInvoiceCount\"]})')
"

echo ""
echo "=== Stats TND 2026 (1 invoice, 0 archived) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]} (should be 1)')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]} (should be 0)')
"

echo ""
echo "=== Verify web container has new code ==="
docker exec blue-web cat /usr/share/nginx/html/assets/*.js 2>/dev/null | grep -o 'totalInvoiceCount[^,]*' | head -3
