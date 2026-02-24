#!/bin/bash
set -e
BASE="https://rscmanager.com/api"

# Login with test account
RESP=$(curl -s -X POST "$BASE/Auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"AHT@gmail.com","password":"AHT@gmail.com"}')

echo "LOGIN RESPONSE: $RESP" | head -c 200
echo ""

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "FAILED - trying Manager account"
  RESP=$(curl -s -X POST "$BASE/Auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}')
  echo "LOGIN RESPONSE: $RESP" | head -c 200
  echo ""
  TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null || echo "")
fi

if [ -z "$TOKEN" ]; then
  echo "CANNOT LOGIN"
  exit 1
fi

echo "TOKEN OK (len=${#TOKEN})"
AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== STATS (EUR default, year=2026) ==="
curl -s "$BASE/Dashboard/stats?year=2026" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
keys = ['selectedCurrency','defaultCurrency','totalRevenue','totalExpenses','pendingInvoicesCount','pendingInvoicesAmount',
        'partiallyPaidCount','partiallyPaidAmount','activeClients','totalSuppliers','supplierInvoices',
        'totalInvoiceCount','paidInvoiceCount','thisMonthRevenue','lastMonthRevenue','growthDisplay','growthPercentage',
        'availableCurrencies','availableYears','isAllYearsMode','selectedYear','pendingPaymentsCount','pendingPaymentsAmount']
for k in keys:
    print(f'  {k}: {d.get(k)}')
print(f'  statusBreakdown: {d.get(\"statusBreakdown\")}')
print(f'  topClients count: {len(d.get(\"topClients\",[]))}')
for c in d.get('topClients',[]):
    print(f'    {c}')
"

echo ""
echo "=== STATS (TND, year=2026) ==="
curl -s "$BASE/Dashboard/stats?currency=TND&year=2026" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
keys = ['selectedCurrency','totalRevenue','totalExpenses','pendingInvoicesCount','pendingInvoicesAmount',
        'partiallyPaidCount','partiallyPaidAmount','activeClients','totalInvoiceCount','paidInvoiceCount',
        'thisMonthRevenue','lastMonthRevenue','growthDisplay']
for k in keys:
    print(f'  {k}: {d.get(k)}')
print(f'  statusBreakdown: {d.get(\"statusBreakdown\")}')
"

echo ""
echo "=== EXPENSES SUMMARY (year=2026) ==="
curl -s "$BASE/Expenses/summary?year=2026" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAll: {d.get(\"totalAll\")}')
print(f'  totalThisMonth: {d.get(\"totalThisMonth\")}')
print(f'  totalThisYear: {d.get(\"totalThisYear\")}')
print(f'  defaultCurrency: {d.get(\"defaultCurrency\")}')
print(f'  count: {d.get(\"count\")}')
for cat in d.get('byCategory',[]):
    print(f'  category: {cat}')
for cb in d.get('currencyBreakdowns',[]):
    print(f'  breakdown: {cb}')
"

echo ""
echo "=== REVENUE SUMMARY defaults ==="
curl -s "$BASE/Dashboard/revenue-summary?year=2026" -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== REVENUE SUMMARY TND ==="
curl -s "$BASE/Dashboard/revenue-summary?currency=TND&year=2026" -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== PURCHASES SUMMARY defaults ==="
curl -s "$BASE/Dashboard/purchases-summary?year=2026" -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== PURCHASES SUMMARY TND ==="
curl -s "$BASE/Dashboard/purchases-summary?currency=TND&year=2026" -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== ARCHIVED COUNT ==="
curl -s "$BASE/Invoices/archived/count?year=2026" -H "$AUTH" | python3 -m json.tool
