#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:7175/api/Auth/login -H "Content-Type: application/json" -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
echo "Token: ${#TOKEN} chars"

echo ""
echo "============================================"
echo "=== FULL DASHBOARD STATS VERIFICATION ==="
echo "============================================"

echo ""
echo "=== 1. EUR stats (year=2026) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=EUR&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  defaultCurrency: {d[\"defaultCurrency\"]}')
print(f'  availableYears: {d[\"availableYears\"]}')
print(f'  availableCurrencies: {d[\"availableCurrencies\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]} (expected: 518591.1)')
print(f'  totalExpenses: {d[\"totalExpenses\"]} (expected: 0)')
print(f'  pendingInvoicesCount: {d[\"pendingInvoicesCount\"]} (expected: 6)')
print(f'  pendingInvoicesAmount: {d[\"pendingInvoicesAmount\"]} (expected: 60257.9)')
print(f'  partiallyPaidCount: {d[\"partiallyPaidCount\"]} (expected: 0)')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]} (expected: 7)')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]} (expected: 1)')
print(f'  activeClients: {d[\"activeClients\"]} (expected: 4)')
print(f'  totalSuppliers: {d[\"totalSuppliers\"]} (expected: 1)')
print(f'  supplierInvoices: {d[\"supplierInvoices\"]} (expected: 0)')
print(f'  thisMonthRevenue: {d[\"thisMonthRevenue\"]} (expected: 518591.1)')
print(f'  growthDisplay: {d[\"growthDisplay\"]} (expected: New)')
print(f'  statusBreakdown: {d[\"statusBreakdown\"]}')
print(f'  topClients: {[(c[\"clientName\"],c[\"paidAmount\"]) for c in d[\"topClients\"]]}')
"

echo ""
echo "=== 2. TND stats (year=2026) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]} (expected: 2.191)')
print(f'  totalExpenses: {d[\"totalExpenses\"]} (expected: 300)')
print(f'  pendingInvoicesCount: {d[\"pendingInvoicesCount\"]} (expected: 0)')
print(f'  partiallyPaidCount: {d[\"partiallyPaidCount\"]} (expected: 1)')
print(f'  partiallyPaidAmount: {d[\"partiallyPaidAmount\"]} (expected: 0.00019)')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]} (expected: 1)')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]} (expected: 0)')
print(f'  activeClients: {d[\"activeClients\"]} (expected: 1)')
print(f'  statusBreakdown: {d[\"statusBreakdown\"]}')
"

echo ""
echo "=== 3. TND stats (year=2025) ==="
curl -s "http://localhost:7175/api/dashboard/stats?currency=TND&year=2025" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  selectedCurrency: {d[\"selectedCurrency\"]}')
print(f'  totalRevenue: {d[\"totalRevenue\"]} (expected: 0)')
print(f'  totalExpenses: {d[\"totalExpenses\"]} (expected: 150 - Heni)')
print(f'  totalInvoiceCount: {d[\"totalInvoiceCount\"]} (expected: 0)')
print(f'  paidInvoiceCount: {d[\"paidInvoiceCount\"]} (expected: 0)')
"

echo ""
echo "=== 4. Revenue Summary EUR ==="
curl -s "http://localhost:7175/api/dashboard/revenue-summary?currency=EUR&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAllTime: {d[\"totalAllTime\"]} (expected: 518591.1)')
print(f'  selectedYearTotal: {d[\"selectedYearTotal\"]} (expected: 518591.1)')
print(f'  revenueByYear: {d[\"revenueByYear\"]}')
"

echo ""
echo "=== 5. Revenue Summary TND ==="
curl -s "http://localhost:7175/api/dashboard/revenue-summary?currency=TND&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAllTime: {d[\"totalAllTime\"]} (expected: 2.191)')
print(f'  selectedYearTotal: {d[\"selectedYearTotal\"]} (expected: 2.191)')
"

echo ""
echo "=== 6. Purchases Summary EUR ==="
curl -s "http://localhost:7175/api/dashboard/purchases-summary?currency=EUR&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAllTime: {d[\"totalAllTime\"]} (expected: 0)')
print(f'  purchasesByYear: {d[\"purchasesByYear\"]} (expected: [])')
"

echo ""
echo "=== 7. Purchases Summary TND (all years) ==="
curl -s "http://localhost:7175/api/dashboard/purchases-summary?currency=TND" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAllTime: {d[\"totalAllTime\"]} (expected: 450)')
print(f'  purchasesByYear: {d[\"purchasesByYear\"]} (expected: [{2025:150},{2026:300}])')
"

echo ""
echo "=== 8. Expenses Summary ==="
curl -s "http://localhost:7175/api/Expenses/summary" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  totalAll: {d[\"totalAll\"]} (expected: 450 = all expenses)')
print(f'  defaultCurrency: {d[\"defaultCurrency\"]}')
print(f'  byCategory: {d[\"byCategory\"]}')
"

echo ""
echo "=== 9. Archived Count ==="
curl -s "http://localhost:7175/api/Invoices/archived/count?year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  count: {d[\"count\"]} (expected: 1 = FA26-004)')
"

echo ""
echo "=== 10. CurrencyHelper tests ==="
for cur in "€" "£" "DT" "دت" "DA" "DH" "LE" "₺"; do
  result=$(curl -s "http://localhost:7175/api/dashboard/stats?currency=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$cur'))")&year=2026" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['selectedCurrency'])" 2>/dev/null)
  echo "  $cur -> $result"
done

echo ""
echo "============================================"
echo "=== ALL TESTS COMPLETE ==="
echo "============================================"
