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
            [FromQuery] decimal? exchangeRate = null,   // user-supplied rate for mixed mode
            [FromQuery] int? year = null)               // optional year filter (defaults to current year)
        {
            var now = DateTime.UtcNow;
            var selectedYear = year ?? now.Year;
            var startOfYear = new DateTime(selectedYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var endOfYear = startOfYear.AddYears(1);

            // Load all invoices for client-side aggregation (SQLite doesn't support Sum on decimal)
            var allInvoices = await _context.Invoices
                .Include(i => i.Payments)
                .Include(i => i.Client)
                .ToListAsync();

            // Also load historical revenues
            var allHistoricalRevenues = await _context.HistoricalRevenues.Include(h => h.Client).ToListAsync();
            var yearInvoices = allInvoices
                .Where(i => i.Date >= startOfYear && i.Date < endOfYear)
                .ToList();
            var yearHistoricalRevenues = allHistoricalRevenues
                .Where(h => h.Date >= startOfYear && h.Date < endOfYear)
                .ToList();

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

            var invoiceCurrencies = yearInvoices
                .Select(i => i.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            var allSupplierInvoices = await _context.FournisseurInvoices
                .Include(si => si.Payments)
                .Include(si => si.Items)
                .Include(si => si.Fournisseur)
                .ToListAsync();
            var yearSupplierInvoices = allSupplierInvoices
                .Where(si =>
                {
                    var date = si.InvoiceDate ?? si.CreatedAt;
                    return date >= startOfYear && date < endOfYear;
                })
                .ToList();

            var supplierCurrencies = yearSupplierInvoices
                .Select(si => si.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            var allOtherExpenses = await _context.OtherExpenses.ToListAsync();
            var allHistoricalExpenses = await _context.HistoricalExpenses.ToListAsync();
            var yearOtherExpenses = allOtherExpenses
                .Where(e => e.Date >= startOfYear && e.Date < endOfYear)
                .ToList();
            var yearHistoricalExpenses = allHistoricalExpenses
                .Where(h => h.Date >= startOfYear && h.Date < endOfYear)
                .ToList();

            var expenseCurrencies = yearOtherExpenses
                .Select(e => e.Currency ?? defaultCurrency)
                .Distinct()
                .ToList();

            // Include historical data currencies
            var histRevCurrencies = yearHistoricalRevenues.Select(h => h.Currency ?? defaultCurrency).Distinct();
            var histExpCurrencies = yearHistoricalExpenses.Select(h => h.Currency ?? defaultCurrency).Distinct();

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
            List<Invoice> revenueInvoices;
            decimal totalRevenue = 0;
            var currencyBreakdownRevenue = new Dictionary<string, decimal>();

            if (isMixedMode)
            {
                filteredInvoices = yearInvoices;
                revenueInvoices = filteredInvoices
                    .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                foreach (var invoice in revenueInvoices)
                {
                    var invCurrency = invoice.Currency ?? defaultCurrency;
                    var invoiceTotal = invoice.TotalAmount ?? 0;
                    totalRevenue += ConvertAmount(invoiceTotal, invCurrency);
                    if (!currencyBreakdownRevenue.ContainsKey(invCurrency))
                        currencyBreakdownRevenue[invCurrency] = 0;
                    currencyBreakdownRevenue[invCurrency] += invoiceTotal;
                }

                foreach (var h in yearHistoricalRevenues)
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
                filteredInvoices = yearInvoices
                    .Where(i => (i.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();

                revenueInvoices = filteredInvoices
                    .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                totalRevenue = revenueInvoices.Sum(i => i.TotalAmount ?? 0);
                totalRevenue += yearHistoricalRevenues
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
                filteredSupplierInvoices = yearSupplierInvoices;
                filteredOtherExpenses = yearOtherExpenses;

                foreach (var si in filteredSupplierInvoices)
                {
                    var siCurrency = si.Currency ?? defaultCurrency;
                    var paidAmount = (si.Payments ?? new List<SupplierPayment>())
                        .Where(p => p.Status == "Completed" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                        .Sum(p => p.Amount);
                    totalExpenses += ConvertAmount(paidAmount, siCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(siCurrency))
                        currencyBreakdownExpense[siCurrency] = 0;
                    currencyBreakdownExpense[siCurrency] += paidAmount;
                }
                foreach (var e in filteredOtherExpenses)
                {
                    var eCurrency = e.Currency ?? defaultCurrency;
                    totalExpenses += ConvertAmount(e.Amount, eCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(eCurrency))
                        currencyBreakdownExpense[eCurrency] = 0;
                    currencyBreakdownExpense[eCurrency] += e.Amount;
                }
                foreach (var h in yearHistoricalExpenses)
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
                filteredSupplierInvoices = yearSupplierInvoices
                    .Where(si => (si.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();
                filteredOtherExpenses = yearOtherExpenses
                    .Where(e => (e.Currency ?? defaultCurrency) == selectedCurrency)
                    .ToList();

                var supplierPaidAmount = filteredSupplierInvoices
                    .SelectMany(si => si.Payments ?? new List<SupplierPayment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                    .Sum(p => p.Amount);

                totalExpenses = filteredOtherExpenses.Sum(e => e.Amount)
                    + supplierPaidAmount;

                totalExpenses += yearHistoricalExpenses
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
                .Where(p => p.Status == "Pending" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                .ToList();
            var pendingPaymentsCount = pendingPayments.Count;
            var pendingPaymentsAmount = pendingPayments.Sum(p => p.Amount);

            // Due Payments (waiting for confirmation)
            var duePayments = filteredInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Due" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                .ToList();
            var duePaymentsCount = duePayments.Count;
            var duePaymentsAmount = duePayments.Sum(p => p.Amount);

            // ═══ Revenue Chart (by invoice date, per selected year) ═══
            var historicalRevenueForChart = isMixedMode
                ? yearHistoricalRevenues.ToList()
                : yearHistoricalRevenues.Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency).ToList();

            var revenueByMonth = revenueInvoices
                .GroupBy(i => i.Date.Month)
                .ToDictionary(g => g.Key, g => isMixedMode
                    ? g.Sum(i => ConvertAmount(i.TotalAmount ?? 0, i.Currency ?? defaultCurrency))
                    : g.Sum(i => i.TotalAmount ?? 0));

            var chart = Enumerable.Range(1, 12).Select(month => {
                var invoiceAmount = revenueByMonth.GetValueOrDefault(month, 0);
                var histAmount = historicalRevenueForChart
                    .Where(h => h.Date.Month == month && h.Date.Year == selectedYear)
                    .Sum(h => isMixedMode ? ConvertAmount(h.AmountPaid, h.Currency ?? defaultCurrency) : h.AmountPaid);
                return new {
                    month,
                    amount = invoiceAmount + histAmount,
                    count = revenueInvoices.Count(i => i.Date.Month == month)
                };
            }).ToList();

            // Monthly comparison (this month vs last month) — invoice totals
            var thisMonthRevenue = chart.FirstOrDefault(c => c.month == now.Month)?.amount ?? 0;

            int lastMonthNum = now.Month > 1 ? now.Month - 1 : 12;
            var lastMonthRevenue = chart.FirstOrDefault(c => c.month == lastMonthNum)?.amount ?? 0;

            // Client stats
            var activeClients = filteredInvoices
                .Where(i => i.ClientId.HasValue)
                .Select(i => i.ClientId!.Value)
                .Distinct()
                .Count();
            var totalSuppliers = await _context.Fournisseurs.CountAsync();
            var supplierInvoicesCount = filteredSupplierInvoices.Count;

            // ═══ PAYMENT-BASED Expense Chart ═══
            var otherExpensesByMonth = filteredOtherExpenses
                .GroupBy(e => e.Date.Month)
                .ToDictionary(g => g.Key, g => isMixedMode
                    ? g.Sum(e => ConvertAmount(e.Amount, e.Currency ?? defaultCurrency))
                    : g.Sum(e => e.Amount));

            // Supplier expenses by payment date (payment-based)
            var supplierCompletedPayments = filteredSupplierInvoices
                .SelectMany(si => (si.Payments ?? new List<SupplierPayment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                    .Select(p => new { Payment = p, Currency = si.Currency ?? defaultCurrency }))
                .ToList();

            var supplierExpensesByMonth = supplierCompletedPayments
                .GroupBy(x => x.Payment.PaymentDate.Month)
                .ToDictionary(g => g.Key, g => isMixedMode
                    ? g.Sum(x => ConvertAmount(x.Payment.Amount, x.Currency))
                    : g.Sum(x => x.Payment.Amount));

            // Historical expenses for chart
            var historicalExpenseForChart = isMixedMode
                ? yearHistoricalExpenses.ToList()
                : yearHistoricalExpenses.Where(h => (h.Currency ?? defaultCurrency) == selectedCurrency).ToList();

            var expenseChart = Enumerable.Range(1, 12).Select(month => {
                var otherAmt = otherExpensesByMonth.GetValueOrDefault(month, 0);
                var supplierAmt = supplierExpensesByMonth.GetValueOrDefault(month, 0);
                var histAmt = historicalExpenseForChart
                    .Where(h => h.Date.Month == month && h.Date.Year == selectedYear)
                    .Sum(h => isMixedMode ? ConvertAmount(h.AmountPaid, h.Currency ?? defaultCurrency) : h.AmountPaid);
                return new {
                    month,
                    amount = otherAmt + supplierAmt + histAmt,
                    supplierCount = filteredSupplierInvoices
                        .Count(si =>
                        {
                            var date = si.InvoiceDate ?? si.CreatedAt;
                            return date.Year == selectedYear && date.Month == month;
                        })
                };
            }).ToList();

            // Invoice status breakdown
            var statusBreakdown = filteredInvoices
                .GroupBy(i => i.Status)
                .Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(i => i.TotalAmount ?? 0) })
                .ToList();

            // Top clients by PAID amount (payment-based + historical) — filtered by selected year
            var invoiceClientRevenue = revenueInvoices
                .Where(i => i.ClientId.HasValue)
                .GroupBy(i => i.ClientId!.Value)
                .Select(g => {
                    return new {
                        clientId = g.Key,
                        clientName = g.First().Client?.Name ?? "Unknown",
                        totalInvoices = g.Count(),
                        totalAmount = g.Sum(i => i.TotalAmount ?? 0),
                        paidAmount = g.Sum(i => i.TotalAmount ?? 0)
                    };
                })
                .ToDictionary(c => c.clientId);

            // Merge historical revenue into top clients
            var historicalClientRevenue = yearHistoricalRevenues
                .Where(h => h.ClientId.HasValue)
                .GroupBy(h => h.ClientId!.Value)
                .ToDictionary(g => g.Key, g => new { paidAmount = g.Sum(h => h.AmountPaid), clientName = g.First().Client?.Name ?? g.First().ClientName });

            var mergedClientIds = invoiceClientRevenue.Keys.Union(historicalClientRevenue.Keys).ToHashSet();
            var topClients = mergedClientIds
                .Select(id => {
                    var inv = invoiceClientRevenue.GetValueOrDefault(id);
                    var hist = historicalClientRevenue.GetValueOrDefault(id);
                    return new {
                        clientId = (int?)id,
                        clientName = inv?.clientName ?? hist?.clientName ?? "Unknown",
                        totalInvoices = inv?.totalInvoices ?? 0,
                        totalAmount = (inv?.totalAmount ?? 0m) + (hist?.paidAmount ?? 0m),
                        paidAmount = (inv?.paidAmount ?? 0m) + (hist?.paidAmount ?? 0m)
                    };
                })
                .Where(c => c.paidAmount > 0)
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
                
                // Year filter
                selectedYear,

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

        // GET: api/dashboard/revenue-summary
        [HttpGet("revenue-summary")]
        public async Task<IActionResult> GetRevenueSummary(
            [FromQuery] string? currency = null,
            [FromQuery] string? mode = null,
            [FromQuery] string? targetCurrency = null,
            [FromQuery] decimal? exchangeRate = null,
            [FromQuery] int? year = null)
        {
            var now = DateTime.UtcNow;
            var selectedYear = year ?? now.Year;

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

            var isMixedMode = mode == "mixed" && !string.IsNullOrEmpty(targetCurrency) && exchangeRate.HasValue && exchangeRate.Value > 0;
            var selectedCurrency = isMixedMode ? targetCurrency! : (currency ?? defaultCurrency);

            decimal ConvertAmount(decimal amount, string sourceCurrency)
            {
                if (!isMixedMode) return amount;
                if (sourceCurrency == targetCurrency) return amount;
                return amount * exchangeRate!.Value;
            }

            var invoices = await _context.Invoices.ToListAsync();
            var historicalRevenues = await _context.HistoricalRevenues.ToListAsync();

            var invoiceItems = invoices
                .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                .Select(i => new
                {
                    Year = i.Date.Year,
                    Currency = i.Currency ?? defaultCurrency,
                    Amount = i.TotalAmount ?? 0
                });

            var historicalItems = historicalRevenues.Select(h => new
            {
                Year = h.Date.Year,
                Currency = h.Currency ?? defaultCurrency,
                Amount = h.AmountPaid
            });

            var revenueItems = invoiceItems.Concat(historicalItems);

            if (!isMixedMode)
            {
                revenueItems = revenueItems.Where(i => i.Currency == selectedCurrency);
            }

            var revenueByYear = revenueItems
                .GroupBy(i => i.Year)
                .Select(g => new
                {
                    year = g.Key,
                    total = g.Sum(i => isMixedMode ? ConvertAmount(i.Amount, i.Currency) : i.Amount)
                })
                .OrderBy(r => r.year)
                .ToList();

            var totalAllTime = revenueByYear.Sum(r => r.total);
            var selectedYearTotal = revenueByYear.FirstOrDefault(r => r.year == selectedYear)?.total ?? 0;

            return Ok(new
            {
                totalAllTime,
                selectedYearTotal,
                revenueByYear
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
