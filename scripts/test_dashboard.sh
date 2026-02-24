#!/bin/bash
# Authenticate and test all dashboard endpoints for Company 4 (Manager@gmail.com)
set -e

BASE="https://rscmanager.com/api"

# Login
TOKEN=$(curl -s -X POST "$BASE/Auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"Manager@gmail.com","password":"Manager@gmail.com"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "FAILED TO LOGIN"
  exit 1
fi
echo "=== Logged in ==="

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== 1. Dashboard Stats (default currency, year=2026) ==="
curl -s "$BASE/Dashboard/stats?year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/stats?year=2026" -H "$AUTH"

echo ""
echo "=== 2. Dashboard Stats (TND, year=2026) ==="
curl -s "$BASE/Dashboard/stats?currency=TND&year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/stats?currency=TND&year=2026" -H "$AUTH"

echo ""
echo "=== 3. Expenses Summary (year=2026) ==="
curl -s "$BASE/Expenses/summary?year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Expenses/summary?year=2026" -H "$AUTH"

echo ""
echo "=== 4. Revenue Summary (default, year=2026) ==="
curl -s "$BASE/Dashboard/revenue-summary?year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/revenue-summary?year=2026" -H "$AUTH"

echo ""
echo "=== 5. Revenue Summary (TND, year=2026) ==="
curl -s "$BASE/Dashboard/revenue-summary?currency=TND&year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/revenue-summary?currency=TND&year=2026" -H "$AUTH"

echo ""
echo "=== 6. Purchases Summary (default, year=2026) ==="
curl -s "$BASE/Dashboard/purchases-summary?year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/purchases-summary?year=2026" -H "$AUTH"

echo ""
echo "=== 7. Purchases Summary (TND, year=2026) ==="
curl -s "$BASE/Dashboard/purchases-summary?currency=TND&year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/purchases-summary?currency=TND&year=2026" -H "$AUTH"

echo ""
echo "=== 8. Archived Count (year=2026) ==="
curl -s "$BASE/Invoices/archived/count?year=2026" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Invoices/archived/count?year=2026" -H "$AUTH"

echo ""
echo "=== 9. Dashboard Stats (ALL YEARS, no year) ==="
curl -s "$BASE/Dashboard/stats" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "$BASE/Dashboard/stats" -H "$AUTH"
