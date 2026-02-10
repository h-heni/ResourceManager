using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace ResourceManager.Controllers
{
    [EnableRateLimiting("ReadHeavy")]
    public class DashboardController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(AppDbContext context, ILogger<DashboardController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/dashboard/stats
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats(
            [FromQuery] string? currency = null,
            [FromQuery] string? mode = null,           // "single" (default) or "mixed"
            [FromQuery] string? targetCurrency = null,  // target for mixed mode
            [FromQuery] decimal? exchangeRate = null)   // user-supplied rate for mixed mode
        {
            var now = DateTime.UtcNow;
            var startOfYear = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);

            // Load all invoices for client-side aggregation (SQLite doesn't support Sum on decimal)
            var allInvoices = await _context.Invoices
                .Include(i => i.Payments)
                .Include(i => i.Client)
                .ToListAsync();

            // Also load historical revenues
            var allHistoricalRevenues = await _context.HistoricalRevenues.ToListAsync();

            // ═══ Multi-Currency: Determine available currencies ═══
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            string defaultCurrency = "TND";
            if (userId != null)
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null)
                {
                    var companySettings = await _context.CompanySettings
                        .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                    if (companySettings != null)
                        defaultCurrency = companySettings.Currency ?? "TND";
                }
            }

            var invoiceCurrencies = allInvoices
                .Select(i => i.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            var allSupplierInvoices = await _context.FournisseurInvoices
                .Include(si => si.Payments)
                .Include(si => si.Items)
                .Include(si => si.Fournisseur)
                .ToListAsync();

            var supplierCurrencies = allSupplierInvoices
                .Select(si => si.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            var allOtherExpenses = await _context.OtherExpenses.ToListAsync();
            var allHistoricalExpenses = await _context.HistoricalExpenses.ToListAsync();

            var expenseCurrencies = allOtherExpenses
                .Select(e => e.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            // Include historical data currencies
            var histRevCurrencies = allHistoricalRevenues.Select(h => h.Currency ?? defaultCurrency).Distinct();
            var histExpCurrencies = allHistoricalExpenses.Select(h => h.Currency ?? defaultCurrency).Distinct();

            var availableCurrencies = invoiceCurrencies
                .Union(supplierCurrencies)
                .Union(expenseCurrencies)
                .Union(histRevCurrencies)
                .Union(histExpCurrencies)
                .Union(new[] { defaultCurrency })
                .Distinct()
                .OrderBy(c => c == defaultCurrency ? "" : c)
                .ToList();

            // ═══ MIXED MODE: Convert all currencies to target with user-supplied rate ═══
            var isMixedMode = mode == "mixed" && !string.IsNullOrEmpty(targetCurrency) && exchangeRate.HasValue && exchangeRate.Value > 0;

            var selectedCurrency = isMixedMode ? targetCurrency! : (currency ?? defaultCurrency);

            // Helper: apply conversion if in mixed mode
            decimal ConvertAmount(decimal amount, string sourceCurrency)
            {
                if (!isMixedMode) return amount;
                if (sourceCurrency == targetCurrency) return amount;
                return amount * exchangeRate!.Value;
            }

            // ═══ PAYMENT-BASED REVENUE (CRITICAL FIX) ═══
            // Revenue = SUM of all Completed payments on invoices, NOT invoice totals.
            // This correctly handles partial payments, overpayments, underpayments.
            List<Invoice> filteredInvoices;
            decimal totalRevenue = 0;
            var currencyBreakdownRevenue = new Dictionary<string, decimal>();

            if (isMixedMode)
            {
                filteredInvoices = allInvoices;
                foreach (var invoice in allInvoices)
                {
                    var invCurrency = invoice.Currency ?? defaultCurrency;
                    var completedPayments = (invoice.Payments ?? new List<Payment>())
                        .Where(p => p.Status == "Completed")
                        .Sum(p => p.Amount);
                    var converted = ConvertAmount(completedPayments, invCurrency);
                    totalRevenue += converted;
                    if (!currencyBreakdownRevenue.ContainsKey(invCurrency))
                        currencyBreakdownRevenue[invCurrency] = 0;
                    currencyBreakdownRevenue[invCurrency] += completedPayments;
                }

                // Include historical revenues
                foreach (var h in allHistoricalRevenues)
                {
                    var hCurrency = h.Currency ?? defaultCurrency;
                    totalRevenue += ConvertAmount(h.AmountPaid, hCurrency);
                    if (!currencyBreakdownRevenue.ContainsKey(hCurrency))
                        currencyBreakdownRevenue[hCurrency] = 0;
                    currencyBreakdownRevenue[hCurrency] += h.AmountPaid;
                }
            }
            else
            {
                filteredInvoices = allInvoices
                    .Where(i => (i.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();

                // PAYMENT-BASED: Sum ALL completed payments across ALL invoices in this currency
                totalRevenue = filteredInvoices
                    .SelectMany(i => i.Payments ?? new List<Payment>())
                    .Where(p => p.Status == "Completed")
                    .Sum(p => p.Amount);

                // Add historical revenue for this currency
                totalRevenue += allHistoricalRevenues
                    .Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency)
                    .Sum(h => h.AmountPaid);
            }

            // ═══ Filter expenses ═══
            List<FournisseurInvoice> filteredSupplierInvoices;
            List<OtherExpense> filteredOtherExpenses;
            decimal totalExpenses = 0;
            var currencyBreakdownExpense = new Dictionary<string, decimal>();

            if (isMixedMode)
            {
                filteredSupplierInvoices = allSupplierInvoices;
                filteredOtherExpenses = allOtherExpenses;

                // PAYMENT-BASED expenses: supplier paid amounts + other expenses
                foreach (var si in allSupplierInvoices)
                {
                    var siCurrency = si.Currency ?? defaultCurrency;
                    var paidAmount = si.AmountPaid; // Already payment-based (Completed payments)
                    totalExpenses += ConvertAmount(paidAmount, siCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(siCurrency))
                        currencyBreakdownExpense[siCurrency] = 0;
                    currencyBreakdownExpense[siCurrency] += paidAmount;
                }
                foreach (var e in allOtherExpenses)
                {
                    var eCurrency = e.Currency ?? defaultCurrency;
                    totalExpenses += ConvertAmount(e.Amount, eCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(eCurrency))
                        currencyBreakdownExpense[eCurrency] = 0;
                    currencyBreakdownExpense[eCurrency] += e.Amount;
                }
                foreach (var h in allHistoricalExpenses)
                {
                    var hCurrency = h.Currency ?? defaultCurrency;
                    totalExpenses += ConvertAmount(h.AmountPaid, hCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(hCurrency))
                        currencyBreakdownExpense[hCurrency] = 0;
                    currencyBreakdownExpense[hCurrency] += h.AmountPaid;
                }
            }
            else
            {
                filteredSupplierInvoices = allSupplierInvoices
                    .Where(si => (si.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();
                filteredOtherExpenses = allOtherExpenses
                    .Where(e => (e.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();

                // PAYMENT-BASED: supplier AmountPaid is already sum of Completed payments
                totalExpenses = filteredOtherExpenses.Sum(e => e.Amount)
                    + filteredSupplierInvoices.Sum(si => si.AmountPaid);

                // Add historical expenses for this currency
                totalExpenses += allHistoricalExpenses
                    .Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency)
                    .Sum(h => h.AmountPaid);
            }

            // Unpaid Invoices Count and Amount
            var unpaidInvoicesList = filteredInvoices.Where(i => (i.Status == "Unpaid" || i.Status == "Draft") && !i.Treated).ToList();
            var unpaidInvoices = unpaidInvoicesList.Count;
            var unpaidAmount = unpaidInvoicesList.Sum(i => i.TotalAmount ?? 0);

            // Partially Paid
            var partiallyPaidList = filteredInvoices.Where(i => i.Status == "PartiallyPaid").ToList();
            var partiallyPaidCount = partiallyPaidList.Count;
            var partiallyPaidAmount = partiallyPaidList.Sum(i => i.RemainingAmount);

            // Pending Payments (Scheduled future payments)
            var pendingPayments = filteredInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Pending")
                .ToList();
            var pendingPaymentsCount = pendingPayments.Count;
            var pendingPaymentsAmount = pendingPayments.Sum(p => p.Amount);

            // Due Payments (waiting for confirmation)
            var duePayments = filteredInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Due")
                .ToList();
            var duePaymentsCount = duePayments.Count;
            var duePaymentsAmount = duePayments.Sum(p => p.Amount);

            // ═══ PAYMENT-BASED Revenue Chart (by payment date, not invoice date) ═══
            var allCompletedPayments = filteredInvoices
                .SelectMany(i => (i.Payments ?? new List<Payment>()).Select(p => new { Payment = p, InvoiceCurrency = i.Currency ?? defaultCurrency }))
                .Where(x => x.Payment.Status == "Completed" && x.Payment.PaymentDate >= startOfYear)
                .ToList();

            // Also include historical revenues in chart
            var historicalRevenueForChart = isMixedMode
                ? allHistoricalRevenues.Where(h => h.Date >= startOfYear).ToList()
                : allHistoricalRevenues.Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency && h.Date >= startOfYear).ToList();

            var chart = Enumerable.Range(1, 12).Select(month => {
                var monthPayments = allCompletedPayments
                    .Where(x => x.Payment.PaymentDate.Month == month && x.Payment.PaymentDate.Year == now.Year);
                var paymentAmount = isMixedMode
                    ? monthPayments.Sum(x => ConvertAmount(x.Payment.Amount, x.InvoiceCurrency))
                    : monthPayments.Sum(x => x.Payment.Amount);
                // Add historical
                var histAmount = historicalRevenueForChart
                    .Where(h => h.Date.Month == month && h.Date.Year == now.Year)
                    .Sum(h => isMixedMode ? ConvertAmount(h.AmountPaid, h.Currency ?? defaultCurrency) : h.AmountPaid);
                return new {
                    month,
                    amount = paymentAmount + histAmount,
                    count = monthPayments.Count()
                };
            }).ToList();

            // Monthly comparison (this month vs last month) — PAYMENT-BASED
            var thisMonthPayments = allCompletedPayments
                .Where(x => x.Payment.PaymentDate.Year == now.Year && x.Payment.PaymentDate.Month == now.Month);
            var thisMonthRevenue = isMixedMode
                ? thisMonthPayments.Sum(x => ConvertAmount(x.Payment.Amount, x.InvoiceCurrency))
                : thisMonthPayments.Sum(x => x.Payment.Amount);

            int lastMonthNum = now.Month > 1 ? now.Month - 1 : 12;
            int lastMonthYear = now.Month > 1 ? now.Year : now.Year - 1;
            var lastMonthPayments = allCompletedPayments
                .Where(x => x.Payment.PaymentDate.Year == lastMonthYear && x.Payment.PaymentDate.Month == lastMonthNum);
            var lastMonthRevenue = isMixedMode
                ? lastMonthPayments.Sum(x => ConvertAmount(x.Payment.Amount, x.InvoiceCurrency))
                : lastMonthPayments.Sum(x => x.Payment.Amount);

            // Client stats
            var activeClients = await _context.Clients.CountAsync();
            var totalSuppliers = await _context.Fournisseurs.CountAsync();
            var supplierInvoicesCount = await _context.FournisseurInvoices.CountAsync();

            // ═══ PAYMENT-BASED Expense Chart ═══
            var otherExpensesByMonth = filteredOtherExpenses
                .Where(e => e.Date >= startOfYear)
                .GroupBy(e => e.Date.Month)
                .ToDictionary(g => g.Key, g => isMixedMode
                    ? g.Sum(e => ConvertAmount(e.Amount, e.Currency ?? defaultCurrency))
                    : g.Sum(e => e.Amount));

            // Supplier expenses by payment date (payment-based)
            var supplierCompletedPayments = filteredSupplierInvoices
                .SelectMany(si => (si.Payments ?? new List<SupplierPayment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= startOfYear)
                    .Select(p => new { Payment = p, Currency = si.Currency ?? defaultCurrency }))
                .ToList();

            var supplierExpensesByMonth = supplierCompletedPayments
                .GroupBy(x => x.Payment.PaymentDate.Month)
                .ToDictionary(g => g.Key, g => isMixedMode
                    ? g.Sum(x => ConvertAmount(x.Payment.Amount, x.Currency))
                    : g.Sum(x => x.Payment.Amount));

            // Historical expenses for chart
            var historicalExpenseForChart = isMixedMode
                ? allHistoricalExpenses.Where(h => h.Date >= startOfYear).ToList()
                : allHistoricalExpenses.Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency && h.Date >= startOfYear).ToList();

            var expenseChart = Enumerable.Range(1, 12).Select(month => {
                var otherAmt = otherExpensesByMonth.GetValueOrDefault(month, 0);
                var supplierAmt = supplierExpensesByMonth.GetValueOrDefault(month, 0);
                var histAmt = historicalExpenseForChart
                    .Where(h => h.Date.Month == month && h.Date.Year == now.Year)
                    .Sum(h => isMixedMode ? ConvertAmount(h.AmountPaid, h.Currency ?? defaultCurrency) : h.AmountPaid);
                return new {
                    month,
                    amount = otherAmt + supplierAmt + histAmt,
                    supplierCount = filteredSupplierInvoices
                        .Count(si => si.InvoiceDate.HasValue && si.InvoiceDate.Value >= startOfYear && si.InvoiceDate.Value.Month == month)
                };
            }).ToList();

            // Invoice status breakdown
            var statusBreakdown = filteredInvoices
                .GroupBy(i => i.Status)
                .Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(i => i.TotalAmount ?? 0) })
                .ToList();

            // Top clients by PAID amount (payment-based)
            var topClients = filteredInvoices
                .Where(i => i.ClientId.HasValue)
                .GroupBy(i => i.ClientId)
                .Select(g => new {
                    clientId = g.Key,
                    clientName = g.First().Client?.Name ?? "Unknown",
                    totalInvoices = g.Count(),
                    totalAmount = g.Sum(i => i.TotalAmount ?? 0),
                    paidAmount = g.Sum(i => i.AmountPaid) // payment-based
                })
                .OrderByDescending(c => c.paidAmount)
                .Take(5)
                .ToList();

            // Most bought products
            var allSupplierItems = filteredSupplierInvoices
                .SelectMany(si => si.Items ?? new List<FournisseurInvoiceItem>())
                .Where(item => !string.IsNullOrWhiteSpace(item.Description))
                .GroupBy(item => item.Description.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new {
                    description = g.Key,
                    totalQuantity = g.Sum(i => i.Quantity),
                    totalAmount = g.Sum(i => i.UnitPrice * i.Quantity)
                })
                .OrderByDescending(p => p.totalQuantity)
                .Take(10)
                .ToList();

            var paidInvoiceCount = filteredInvoices.Count(i => i.Status == "Paid" || i.Treated);

            return Ok(new {
                // Multi-currency metadata
                selectedCurrency,
                availableCurrencies,
                defaultCurrency,
                isMixedMode,
                exchangeRate = isMixedMode ? exchangeRate : null,
                currencyBreakdownRevenue = isMixedMode ? currencyBreakdownRevenue : null,
                currencyBreakdownExpense = isMixedMode ? currencyBreakdownExpense : null,
                
                totalRevenue,
                unpaidInvoices,
                unpaidAmount,
                partiallyPaidCount,
                partiallyPaidAmount,
                pendingPaymentsCount,
                pendingPaymentsAmount,
                duePaymentsCount,
                duePaymentsAmount,
                revenueChart = chart,
                expenseChart,
                totalExpenses,
                thisMonthRevenue,
                lastMonthRevenue,
                activeClients,
                totalSuppliers,
                supplierInvoices = supplierInvoicesCount,
                statusBreakdown,
                topClients,
                totalInvoiceCount = filteredInvoices.Count,
                paidInvoiceCount,
                mostBoughtProducts = allSupplierItems
            });
        }

        /// <summary>
        /// SuperAdmin-only: Per-company breakdown with revenue/expenses/net per currency.
        /// Never mixes currencies — each company returns an array of currency buckets.
        /// </summary>
        [HttpGet("admin-stats")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetAdminStats()
        {
            var companies = await _context.Companies.Where(c => !c.IsDeleted).ToListAsync();
            var result = new List<object>();

            foreach (var company in companies)
            {
                // Get default currency for this company
                var settings = await _context.CompanySettings
                    .FirstOrDefaultAsync(s => s.CompanyId == company.Id);
                var defaultCurrency = settings?.Currency ?? "TND";

                // Fetch invoices for this company (bypass global filter via IgnoreQueryFilters)
                var invoices = await _context.Invoices.IgnoreQueryFilters()
                    .Include(i => i.Payments)
                    .Where(i => i.CompanyId == company.Id && !i.IsDeleted)
                    .ToListAsync();

                var supplierInvoices = await _context.FournisseurInvoices.IgnoreQueryFilters()
                    .Include(si => si.Payments)
                    .Where(si => si.CompanyId == company.Id && !si.IsDeleted)
                    .ToListAsync();

                var otherExpenses = await _context.OtherExpenses.IgnoreQueryFilters()
                    .Where(e => e.CompanyId == company.Id && !e.IsDeleted)
                    .ToListAsync();

                // Group by currency
                var currencies = invoices.Select(i => i.Currency ?? defaultCurrency)
                    .Union(supplierInvoices.Select(si => si.Currency ?? defaultCurrency))
                    .Union(otherExpenses.Select(e => e.Currency ?? defaultCurrency))
                    .Union(new[] { defaultCurrency })
                    .Distinct()
                    .ToList();

                var currencyBuckets = currencies.Select(cur =>
                {
                    var curInvoices = invoices.Where(i => (i.Currency ?? defaultCurrency) == cur).ToList();
                    var curSupplier = supplierInvoices.Where(si => (si.Currency ?? defaultCurrency) == cur).ToList();
                    var curExpenses = otherExpenses.Where(e => (e.Currency ?? defaultCurrency) == cur).ToList();

                    // PAYMENT-BASED: Revenue = sum of all Completed payments
                    var revenue = curInvoices
                        .SelectMany(i => i.Payments ?? new List<Payment>())
                        .Where(p => p.Status == "Completed")
                        .Sum(p => p.Amount);
                    var expenses = curSupplier.Sum(si => si.AmountPaid) + curExpenses.Sum(e => e.Amount);

                    return new
                    {
                        Currency = cur,
                        Revenue = revenue,
                        Expenses = expenses,
                        Net = revenue - expenses,
                        InvoiceCount = curInvoices.Count,
                        UnpaidCount = curInvoices.Count(i => i.Status == "Unpaid" || i.Status == "Draft"),
                        UnpaidAmount = curInvoices.Where(i => i.Status == "Unpaid" || i.Status == "Draft").Sum(i => i.TotalAmount ?? 0)
                    };
                }).ToList();

                var userCount = await _context.Users.CountAsync(u => u.CompanyId == company.Id);

                result.Add(new
                {
                    CompanyId = company.Id,
                    CompanyName = company.Name,
                    UserCount = userCount,
                    DefaultCurrency = defaultCurrency,
                    EmployeeLimit = company.EmployeeLimit,
                    CurrencyBuckets = currencyBuckets
                });
            }

            return Ok(result);
        }

        /// <summary>
        /// SuperAdmin-only: User country statistics derived from company addresses.
        /// Privacy-safe — returns only country-level aggregation, no IPs or personal data.
        /// </summary>
        [HttpGet("country-stats")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetCountryStats()
        {
            // Derive country from company address (last line or known patterns)
            var companies = await _context.Companies
                .Where(c => !c.IsDeleted)
                .Select(c => new { c.Id, c.Address })
                .ToListAsync();

            var userCounts = await _context.Users
                .GroupBy(u => u.CompanyId)
                .Select(g => new { CompanyId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.CompanyId, g => g.Count);

            var countryCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var company in companies)
            {
                // Extract country from the last non-empty segment of the address
                var country = ExtractCountry(company.Address);
                var users = userCounts.GetValueOrDefault(company.Id, 0);

                if (countryCounts.ContainsKey(country))
                    countryCounts[country] += users;
                else
                    countryCounts[country] = users;
            }

            var result = countryCounts
                .OrderByDescending(kv => kv.Value)
                .Select(kv => new { Country = kv.Key, Count = kv.Value })
                .ToList();

            return Ok(result);
        }

        private static string ExtractCountry(string? address)
        {
            if (string.IsNullOrWhiteSpace(address)) return "Unknown";

            // Split by comma, newline, or dash and take the last meaningful segment
            var parts = address.Split(new[] { ',', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            var lastPart = parts.LastOrDefault()?.Trim();

            if (string.IsNullOrWhiteSpace(lastPart)) return "Unknown";

            // Strip postal codes (numbers at the start)
            var cleaned = System.Text.RegularExpressions.Regex.Replace(lastPart, @"^\d{4,6}\s*", "").Trim();
            return string.IsNullOrWhiteSpace(cleaned) ? lastPart : cleaned;
        }
    }
}
