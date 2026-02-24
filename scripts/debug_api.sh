#!/bin/bash
# Test 1: Verify new CurrencyHelper by passing € as currency
TOKEN=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

echo "=== Test CurrencyHelper: currency=€ (should normalize to EUR) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=%E2%82%AC&year=2026" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'availableYears: {d[\"availableYears\"]}')
print(f'paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
print(f'totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'totalRevenue: {d[\"totalRevenue\"]}')
"

echo ""
echo "=== TND stats - key fields only ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2026" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'availableYears: {d[\"availableYears\"]}')
print(f'paidInvoiceCount: {d[\"paidInvoiceCount\"]}')
print(f'totalInvoiceCount: {d[\"totalInvoiceCount\"]}')
print(f'totalRevenue: {d[\"totalRevenue\"]}')
print(f'totalExpenses: {d[\"totalExpenses\"]}')
print(f'statusBreakdown: {d[\"statusBreakdown\"]}')
"

echo ""
echo "=== Purchases summary TND (this correctly showed 2025+2026 before) ==="
curl -s "http://localhost:7175/api/dashboard/purchases-summary?currency=TND" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'totalAllTime: {d[\"totalAllTime\"]}')
print(f'purchasesByYear: {d[\"purchasesByYear\"]}')
"
