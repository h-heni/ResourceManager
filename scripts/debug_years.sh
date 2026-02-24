#!/bin/bash
echo "=== Direct year extraction from OtherExpenses ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT DISTINCT date_part('year', \"Date\")::int as year FROM \"OtherExpenses\" WHERE \"CompanyId\" = 4 AND NOT \"IsDeleted\";"

echo ""
echo "=== All years from all sources for Company 4 ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "
SELECT 'Invoices' as source, DISTINCT date_part('year', \"Date\")::int as year FROM \"Invoices\" WHERE \"CompanyId\" = 4 AND NOT \"IsDeleted\"
UNION
SELECT 'OtherExpenses', DISTINCT date_part('year', \"Date\")::int FROM \"OtherExpenses\" WHERE \"CompanyId\" = 4 AND NOT \"IsDeleted\"
UNION
SELECT 'SupplierInvoices', DISTINCT date_part('year', COALESCE(\"InvoiceDate\", \"CreatedAt\"))::int FROM \"SupplierInvoices\" WHERE \"CompanyId\" = 4 AND NOT \"IsDeleted\"
ORDER BY source, year;"

echo ""
echo "=== Raw Date values in OtherExpenses ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT \"Id\", \"Date\", date_part('year', \"Date\") as extracted_year FROM \"OtherExpenses\" WHERE \"CompanyId\" = 4;"

echo ""
echo "=== Check OtherExpenses Date column type ==="
docker exec -i postgres_db psql -U rmuser -d resourcemanager -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'OtherExpenses' AND column_name = 'Date';"
