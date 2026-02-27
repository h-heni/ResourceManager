using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace ResourceManager.Controllers
{
    [EnableRateLimiting("ReadHeavy")]
    [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]  // Employees cannot access Dashboard
    public class DashboardController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<DashboardController> _logger;
        private readonly IMemoryCache _cache;

        public DashboardController(AppDbContext context, ILogger<DashboardController> logger, IMemoryCache cache)
        {
            _context = context;
            _logger = logger;
            _cache = cache;
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
            try
            {
                var now = DateTime.UtcNow;
                // ── Available years: Query WITH tenant filter (no IgnoreQueryFilters!)
                // This ensures each company only sees years from its own data.
                var clientYears = await _context.Invoices
                    .AsNoTracking()
                    .Select(x => x.Date.Year)
                    .Distinct()
                    .ToListAsync();

                var supplierYears = await _context.SupplierInvoices
                    .AsNoTracking()
                    .Select(si => (si.InvoiceDate ?? si.CreatedAt).Year)
                    .Distinct()
                    .ToListAsync();

                // Include OtherExpenses years so the year picker shows years that only have other expenses
                var otherExpenseYears = await _context.OtherExpenses
                    .AsNoTracking()
                    .Select(e => e.Date.Year)
                    .Distinct()
                    .ToListAsync();

                var availableYears = clientYears
                    .Union(supplierYears)
                    .Union(otherExpenseYears)
                    .Distinct()
                    .OrderByDescending(y => y)
                    .ToList();

                if (!availableYears.Any())
                    availableYears = new List<int> { now.Year };

                var minAvailableYear = availableYears.Min();
                var maxAvailableYear = availableYears.Max();

                // Support "All Years" mode: year omitted = show all data (no year filter)
                // Specific year: year param is present
                var isAllYearsMode = !year.HasValue;
                // Use now.Year as fallback for period comparisons (never -1, which would crash DateTime ctor)
                var selectedYear = isAllYearsMode
                    ? now.Year
                    : (availableYears.Contains(year!.Value) ? year.Value : maxAvailableYear);

                // For "All Years" mode, use full date range; otherwise filter by selected year
                var startOfYear = isAllYearsMode
                    ? new DateTime(minAvailableYear, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                    : new DateTime(selectedYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var endOfYear = isAllYearsMode
                    ? new DateTime(maxAvailableYear + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                    : startOfYear.AddYears(1);
                
                // For charts, use current year even in "All Years" mode
                var chartYear = isAllYearsMode ? now.Year : selectedYear;

            // Filter by year at the database level + AsNoTracking for read-only queries
            var yearInvoices = await _context.Invoices
                .AsNoTracking()
                .Where(i => i.Date >= startOfYear && i.Date < endOfYear)
                .Include(i => i.Payments)
                .Include(i => i.Client)
                .Include(i => i.Quote)
                .Include(i => i.InvoiceItems)
                .ToListAsync();

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

            // Normalize company default currency (e.g. DT → TND)
            defaultCurrency = CurrencyHelper.NormalizeCurrency(defaultCurrency);
            if (string.IsNullOrEmpty(defaultCurrency)) defaultCurrency = "TND";

            // Local helper: normalize any raw currency, fallback to company default
            string NC(string? raw)
            {
                var n = CurrencyHelper.NormalizeCurrency(raw);
                return string.IsNullOrEmpty(n) ? defaultCurrency : n;
            }

            var invoiceCurrencies = yearInvoices
                .Select(i => NC(i.Quote?.Currency))
                .Distinct()
                .ToList();

            var yearSupplierInvoices = await _context.SupplierInvoices
                .AsNoTracking()
                .Include(si => si.Payments)
                .Include(si => si.Items)
                .Include(si => si.Supplier)
                .Where(si => (si.InvoiceDate != null && si.InvoiceDate >= startOfYear && si.InvoiceDate < endOfYear)
                          || (si.InvoiceDate == null && si.CreatedAt >= startOfYear && si.CreatedAt < endOfYear))
                .ToListAsync();

            var supplierCurrencies = yearSupplierInvoices
                .Select(si => NC(si.Currency))
                .Distinct()
                .ToList();

            var yearOtherExpenses = await _context.OtherExpenses
                .AsNoTracking()
                .Where(e => e.Date >= startOfYear && e.Date < endOfYear)
                .ToListAsync();

            var expenseCurrencies = yearOtherExpenses
                .Select(e => NC(e.Currency))
                .Distinct()
                .ToList();

            var availableCurrencies = invoiceCurrencies
                .Union(supplierCurrencies)
                .Union(expenseCurrencies)
                .Union(new[] { defaultCurrency })
                .Distinct()
                .OrderBy(c => c == defaultCurrency ? "" : c)
                .ToList();

            // ═══ MIXED MODE: Convert all currencies to target with user-supplied rate ═══
            var isMixedMode = mode == "mixed" && !string.IsNullOrEmpty(targetCurrency) && exchangeRate.HasValue && exchangeRate.Value > 0;

            var selectedCurrency = NC(isMixedMode ? targetCurrency : currency);

            // Helper: apply conversion if in mixed mode (normalizes source currency)
            decimal ConvertAmount(decimal amount, string sourceCurrency)
            {
                if (!isMixedMode) return amount;
                if (NC(sourceCurrency) == selectedCurrency) return amount;
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
                    var invCurrency = NC(invoice.Quote?.Currency);
                    var confirmedPaid = invoice.AmountPaid; // Only confirmed payments count as revenue
                    totalRevenue += ConvertAmount(confirmedPaid, invCurrency);
                    if (!currencyBreakdownRevenue.ContainsKey(invCurrency))
                        currencyBreakdownRevenue[invCurrency] = 0;
                    currencyBreakdownRevenue[invCurrency] += confirmedPaid;
                }
            }
            else
            {
                filteredInvoices = yearInvoices
                    .Where(i => NC(i.Quote?.Currency) == selectedCurrency)
                    .ToList();

                revenueInvoices = filteredInvoices
                    .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                totalRevenue = revenueInvoices.Sum(i => i.AmountPaid); // Only confirmed payments count as revenue
            }

            // ═══ Filter expenses ═══
            List<SupplierInvoice> filteredSupplierInvoices;
            List<OtherExpense> filteredOtherExpenses;
            decimal totalExpenses = 0;
            var currencyBreakdownExpense = new Dictionary<string, decimal>();

            if (isMixedMode)
            {
                filteredSupplierInvoices = yearSupplierInvoices;
                filteredOtherExpenses = yearOtherExpenses;

                // "Paid Only" logic: Total Expenses = Sum(AmountPaid) from supplier invoices.
                // Only confirmed payments count — ignores unpaid/remaining balances.
                foreach (var si in filteredSupplierInvoices)
                {
                    var siCurrency = NC(si.Currency);
                    var paidAmount = si.AmountPaid;
                    totalExpenses += ConvertAmount(paidAmount, siCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(siCurrency))
                        currencyBreakdownExpense[siCurrency] = 0;
                    currencyBreakdownExpense[siCurrency] += paidAmount;
                }
                foreach (var e in filteredOtherExpenses)
                {
                    var eCurrency = NC(e.Currency);
                    totalExpenses += ConvertAmount(e.Amount, eCurrency);
                    if (!currencyBreakdownExpense.ContainsKey(eCurrency))
                        currencyBreakdownExpense[eCurrency] = 0;
                    currencyBreakdownExpense[eCurrency] += e.Amount;
                }
            }
            else
            {
                filteredSupplierInvoices = yearSupplierInvoices
                    .Where(si => NC(si.Currency) == selectedCurrency)
                    .ToList();
                filteredOtherExpenses = yearOtherExpenses
                    .Where(e => NC(e.Currency) == selectedCurrency)
                    .ToList();

                // "Paid Only" logic: Total Expenses = Sum(AmountPaid) from supplier invoices.
                var supplierPaidAmount = filteredSupplierInvoices
                    .Sum(si => si.AmountPaid);

                totalExpenses = filteredOtherExpenses.Sum(e => e.Amount)
                    + supplierPaidAmount;
            }

            // Pending Invoices Count and Amount (Pending = TotalAmount - AmountPaid)
            var pendingInvoicesList = filteredInvoices.Where(i => i.Status == "Pending" && !i.Treated).ToList();
            var pendingInvoicesCount = pendingInvoicesList.Count;
            var pendingInvoicesAmount = isMixedMode
                ? pendingInvoicesList.Sum(i => ConvertAmount(i.RemainingAmount, NC(i.Quote?.Currency)))
                : pendingInvoicesList.Sum(i => i.RemainingAmount);

            // Partially Paid
            var partiallyPaidList = filteredInvoices.Where(i => i.Status == "PartiallyPaid").ToList();
            var partiallyPaidCount = partiallyPaidList.Count;
            var partiallyPaidAmount = isMixedMode
                ? partiallyPaidList.Sum(i => ConvertAmount(i.RemainingAmount, NC(i.Quote?.Currency)))
                : partiallyPaidList.Sum(i => i.RemainingAmount);

            // Pending Payments (Scheduled future payments)
            var pendingPayments = filteredInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Pending" && p.PaymentDate >= startOfYear && p.PaymentDate < endOfYear)
                .ToList();
            var pendingPaymentsCount = pendingPayments.Count;
            var pendingPaymentsAmount = pendingPayments.Sum(p => p.Amount);

            // ═══ Revenue Chart — dynamic aggregation ═══
            // In "All Years" mode: group by year. In specific-year mode: group by month.
            object chart;
            if (isAllYearsMode)
            {
                // Group revenue invoices by year
                var revenueByYear = revenueInvoices
                    .GroupBy(i => i.Date.Year)
                    .ToDictionary(g => g.Key, g => new {
                        amount = isMixedMode
                            ? g.Sum(i => ConvertAmount(i.AmountPaid, NC(i.Quote?.Currency)))
                            : g.Sum(i => i.AmountPaid),
                        count = g.Count()
                    });

                var allYearKeys = revenueByYear.Keys.OrderBy(y => y).ToList();
                chart = allYearKeys.Select(yr => new {
                    year = yr,
                    month = 0,  // unused in All Years mode
                    label = yr.ToString(),
                    amount = revenueByYear.GetValueOrDefault(yr)?.amount ?? 0,
                    count = revenueByYear.GetValueOrDefault(yr)?.count ?? 0
                }).ToList();
            }
            else
            {
                var revenueByMonth = revenueInvoices
                    .GroupBy(i => i.Date.Month)
                    .ToDictionary(g => g.Key, g => isMixedMode
                        ? g.Sum(i => ConvertAmount(i.AmountPaid, NC(i.Quote?.Currency)))
                        : g.Sum(i => i.AmountPaid));

                chart = Enumerable.Range(1, 12).Select(month => {
                    var invoiceAmount = revenueByMonth.GetValueOrDefault(month, 0);
                    return new {
                        year = chartYear,
                        month,
                        label = "",  // frontend uses month names
                        amount = invoiceAmount,
                        count = revenueInvoices.Count(i => i.Date.Month == month)
                    };
                }).ToList();
            }

            // Current period vs previous period comparison (Month/Year, includes imported + regular)
            var currentPeriodStart = new DateTime(selectedYear, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var nextPeriodStart = currentPeriodStart.AddMonths(1);
            var previousPeriodStart = currentPeriodStart.AddMonths(-1);

            decimal SumPeriodRevenue(DateTime periodStart, DateTime periodEnd)
            {
                return yearInvoices
                    .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase)
                             && i.Date >= periodStart
                             && i.Date < periodEnd)
                    .Sum(i => isMixedMode
                        ? ConvertAmount(i.AmountPaid, NC(i.Quote?.Currency))
                        : (NC(i.Quote?.Currency) == selectedCurrency ? i.AmountPaid : 0m));
            }

            var thisMonthRevenue = SumPeriodRevenue(currentPeriodStart, nextPeriodStart);
            var lastMonthRevenue = SumPeriodRevenue(previousPeriodStart, currentPeriodStart);
            var growthDisplay = lastMonthRevenue == 0
                ? (thisMonthRevenue > 0 ? "New" : "0%")
                : $"{(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100):+0.0;-0.0;0.0}%";
            var growthPercentage = lastMonthRevenue == 0
                ? (thisMonthRevenue > 0 ? 100m : 0m)
                : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100m;

            // Client stats
            var activeClients = filteredInvoices
                .Where(i => i.ClientId.HasValue)
                .Select(i => i.ClientId!.Value)
                .Distinct()
                .Count();
            // Per-tenant cache key to prevent cross-company data leak
            var companyId = User.FindFirst("CompanyId")?.Value ?? "0";
            var totalSuppliers = await _cache.GetOrCreateAsync($"suppliers_count_{companyId}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _context.Suppliers.CountAsync();
            });
            // Count supplier invoices from the full year/company set (active + paid),
            // independent from currency filtering used for amount calculations.
            // Query ALL supplier invoices (not year-filtered) for the total dashboard count
            // Count supplier invoices from full year/company set (active + paid),
            // independent from currency filtering used for amount calculations.
            // Query ALL supplier invoices (not year-filtered) for the total dashboard count
            // Global filter handles CompanyId and !IsDeleted automatically
            var allSupplierInvoices = await _context.SupplierInvoices
                .AsNoTracking()
                .Include(si => si.Payments)
                .Include(si => si.Items)
                .Include(si => si.Supplier)
                .ToListAsync();

            // Use year-filtered data for charts and breakdowns, but ALL data for total count
            var supplierInvoicesForCount = isAllYearsMode ? allSupplierInvoices : yearSupplierInvoices;
            var supplierInvoicesCount = supplierInvoicesForCount.Count;
            var supplierInvoiceCountByYear = supplierInvoicesForCount
                .GroupBy(si => (si.InvoiceDate ?? si.CreatedAt).Year)
                .ToDictionary(g => g.Key, g => g.Count());
            var supplierInvoiceCountByYearMonth = supplierInvoicesForCount
                .GroupBy(si => {
                    var date = si.InvoiceDate ?? si.CreatedAt;
                    return (Year: date.Year, Month: date.Month);
                })
                .ToDictionary(g => g.Key, g => g.Count());

            // ═══ PAYMENT-BASED Expense Chart — dynamic aggregation ═══
            object expenseChart;
            if (isAllYearsMode)
            {
                // Group by year
                var otherByYear = filteredOtherExpenses
                    .GroupBy(e => e.Date.Year)
                    .ToDictionary(g => g.Key, g => isMixedMode
                        ? g.Sum(e => ConvertAmount(e.Amount, NC(e.Currency)))
                        : g.Sum(e => e.Amount));
                var supplierByYear = filteredSupplierInvoices
                    .GroupBy(si => (si.InvoiceDate ?? si.CreatedAt).Year)
                    .ToDictionary(g => g.Key, g => isMixedMode
                        ? g.Sum(si => ConvertAmount(si.AmountPaid, NC(si.Currency)))
                        : g.Sum(si => si.AmountPaid));

                var allExpYears = otherByYear.Keys.Union(supplierByYear.Keys).OrderBy(y => y).ToList();
                expenseChart = allExpYears.Select(yr => new {
                    year = yr,
                    month = 0,
                    label = yr.ToString(),
                    amount = otherByYear.GetValueOrDefault(yr, 0)
                           + supplierByYear.GetValueOrDefault(yr, 0),
                    supplierCount = supplierInvoiceCountByYear.GetValueOrDefault(yr, 0)
                }).ToList();
            }
            else
            {
                var otherExpensesByMonth = filteredOtherExpenses
                    .GroupBy(e => e.Date.Month)
                    .ToDictionary(g => g.Key, g => isMixedMode
                        ? g.Sum(e => ConvertAmount(e.Amount, NC(e.Currency)))
                        : g.Sum(e => e.Amount));
                var supplierExpensesByMonth = filteredSupplierInvoices
                    .GroupBy(si => (si.InvoiceDate ?? si.CreatedAt).Month)
                    .ToDictionary(g => g.Key, g => isMixedMode
                        ? g.Sum(si => ConvertAmount(si.AmountPaid, NC(si.Currency)))
                        : g.Sum(si => si.AmountPaid));

                expenseChart = Enumerable.Range(1, 12).Select(month => {
                    var otherAmt = otherExpensesByMonth.GetValueOrDefault(month, 0);
                    var supplierAmt = supplierExpensesByMonth.GetValueOrDefault(month, 0);
                    return new {
                        year = chartYear,
                        month,
                        label = "",
                        amount = otherAmt + supplierAmt,
                        supplierCount = supplierInvoiceCountByYearMonth
                            .GetValueOrDefault((chartYear, month), 0)
                    };
                }).ToList();
            }

            // Invoice status breakdown — map Treated invoices to "Archived"
            var statusBreakdown = filteredInvoices
                .GroupBy(i => i.Treated ? "Archived" : i.Status)
                .Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(i => i.TotalAmount ?? 0) })
                .ToList();

            // Top clients by PAID amount (payment-based) — filtered by selected year
            decimal NormalizeAmount(decimal amount, string currency) =>
                isMixedMode ? ConvertAmount(amount, currency) : amount;

            var topClients = revenueInvoices
                .Where(i => i.ClientId.HasValue)
                .GroupBy(i => i.ClientId!.Value)
                .Select(g => {
                    var totalAmount = g.Sum(i => NormalizeAmount(i.AmountPaid, NC(i.Quote?.Currency)));
                    return new {
                        clientId = g.Key,
                        clientName = g.First().Client?.Name ?? "Unknown",
                        totalInvoices = g.Count(),
                        totalAmount,
                        paidAmount = totalAmount
                    };
                })
                .Where(c => c.paidAmount > 0)
                .OrderByDescending(c => c.paidAmount)
                .Take(5)
                .ToList();

            // Most bought products (from ALL supplier invoices regardless of currency — quantities are currency-agnostic)
            var allSupplierItems = yearSupplierInvoices
                .SelectMany(si => si.Items ?? new List<SupplierInvoiceItem>())
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

            // Most sold products (from ALL client invoice items regardless of currency — quantities are currency-agnostic)
            var allSoldItems = yearInvoices
                .Where(i => !string.Equals(i.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                .SelectMany(i => i.InvoiceItems ?? new List<InvoiceItem>())
                .Where(item => !string.IsNullOrWhiteSpace(item.Description))
                .GroupBy(item => item.Description.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new {
                    description = g.Key,
                    totalQuantity = g.Sum(i => i.Quantity ?? 0),
                    totalAmount = g.Sum(i => (i.Price ?? 0) * (i.Quantity ?? 0))
                })
                .OrderByDescending(p => p.totalQuantity)
                .Take(10)
                .ToList();

            // Count invoices considered archived/legacy in UI: Treated plus imported category.
            var paidInvoiceCount = filteredInvoices.Count(i =>
                i.Treated || string.Equals(i.Category, "imported", StringComparison.OrdinalIgnoreCase));

            return Ok(new {
                // Multi-currency metadata
                selectedCurrency,
                availableCurrencies,
                defaultCurrency,
                availableYears,
                minAvailableYear,
                isMixedMode,
                exchangeRate = isMixedMode ? exchangeRate : null,
                currencyBreakdownRevenue = isMixedMode ? currencyBreakdownRevenue : null,
                currencyBreakdownExpense = isMixedMode ? currencyBreakdownExpense : null,
                
                // Year filter — return null for "All Years" mode
                selectedYear = isAllYearsMode ? (int?)null : selectedYear,

                totalRevenue,
                pendingInvoicesCount,
                pendingInvoicesAmount,
                partiallyPaidCount,
                partiallyPaidAmount,
                pendingPaymentsCount,
                pendingPaymentsAmount,
                revenueChart = chart,
                expenseChart,
                totalExpenses,
                thisMonthRevenue,
                lastMonthRevenue,
                growthDisplay,
                growthPercentage,
                activeClients,
                totalSuppliers,
                supplierInvoices = supplierInvoicesCount,
                statusBreakdown,
                topClients,
                totalInvoiceCount = filteredInvoices.Count,
                paidInvoiceCount,
                mostBoughtProducts = allSupplierItems,
                mostSoldProducts = allSoldItems,
                isAllYearsMode
            });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching dashboard stats");
                // Return empty/default dashboard data instead of 500 error
                return Ok(new {
                    selectedCurrency = currency ?? "TND",
                    availableCurrencies = new[] { currency ?? "TND" },
                    defaultCurrency = "TND",
                    availableYears = new[] { year ?? DateTime.UtcNow.Year },
                    minAvailableYear = year ?? DateTime.UtcNow.Year,
                    isMixedMode = false,
                    exchangeRate = (decimal?)null,
                    currencyBreakdownRevenue = (object?)null,
                    currencyBreakdownExpense = (object?)null,
                    selectedYear = year.HasValue ? (int?)year.Value : null,
                    totalRevenue = 0m,
                    pendingInvoicesCount = 0,
                    pendingInvoicesAmount = 0m,
                    partiallyPaidCount = 0,
                    partiallyPaidAmount = 0m,
                    pendingPaymentsCount = 0,
                    pendingPaymentsAmount = 0m,
                    revenueChart = Enumerable.Range(1, 12).Select(m => new { year = year ?? DateTime.UtcNow.Year, month = m, label = "", amount = 0m, count = 0 }),
                    expenseChart = Enumerable.Range(1, 12).Select(m => new { year = year ?? DateTime.UtcNow.Year, month = m, label = "", amount = 0m, supplierCount = 0 }),
                    totalExpenses = 0m,
                    thisMonthRevenue = 0m,
                    lastMonthRevenue = 0m,
                    growthDisplay = "0%",
                    growthPercentage = 0m,
                    activeClients = 0,
                    totalSuppliers = 0,
                    supplierInvoices = 0,
                    statusBreakdown = Array.Empty<object>(),
                    topClients = Array.Empty<object>(),
                    totalInvoiceCount = 0,
                    paidInvoiceCount = 0,
                    mostBoughtProducts = Array.Empty<object>(),
                    mostSoldProducts = Array.Empty<object>(),
                    isAllYearsMode = !year.HasValue
                });
            }
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
            var isAllYears = !year.HasValue;
            var selectedYear = isAllYears ? now.Year : year.GetValueOrDefault(now.Year);

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

            // Normalize currencies
            defaultCurrency = CurrencyHelper.NormalizeCurrency(defaultCurrency);
            if (string.IsNullOrEmpty(defaultCurrency)) defaultCurrency = "TND";
            string NC(string? raw)
            {
                var n = CurrencyHelper.NormalizeCurrency(raw);
                return string.IsNullOrEmpty(n) ? defaultCurrency : n;
            }
            var selectedCurrency = NC(isMixedMode ? targetCurrency : currency);

            decimal ConvertAmount(decimal amount, string sourceCurrency)
            {
                if (!isMixedMode) return amount;
                if (NC(sourceCurrency) == selectedCurrency) return amount;
                return amount * exchangeRate!.Value;
            }

            var invoices = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Quote)
                .Include(i => i.Payments)
                .Where(i => !string.Equals(i.Status, "Draft"))
                .Select(i => new
                {
                    Year = i.Date.Year,
                    Currency = i.Quote != null ? i.Quote.Currency : null,
                    Amount = i.Payments
                        .Where(p => p.Status == "Completed")
                        .Sum(p => (decimal?)p.Amount) ?? 0
                })
                .ToListAsync();
            var invoiceItems = invoices
                .Select(i => new
                {
                    i.Year,
                    Currency = NC(i.Currency),
                    i.Amount
                });

            var revenueItems = invoiceItems;

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
            // In "All Years" mode, selectedYearTotal = totalAllTime
            var selectedYearTotal = isAllYears
                ? totalAllTime
                : (revenueByYear.FirstOrDefault(r => r.year == selectedYear)?.total ?? 0);

            return Ok(new
            {
                totalAllTime,
                selectedYearTotal,
                revenueByYear
            });
        }

        // GET: api/dashboard/purchases-summary
        [HttpGet("purchases-summary")]
        public async Task<IActionResult> GetPurchasesSummary(
            [FromQuery] string? currency = null,
            [FromQuery] string? mode = null,
            [FromQuery] string? targetCurrency = null,
            [FromQuery] decimal? exchangeRate = null,
            [FromQuery] int? year = null)
        {
            var now = DateTime.UtcNow;
            var isAllYears = !year.HasValue;
            var selectedYear = isAllYears ? now.Year : year.GetValueOrDefault(now.Year);

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

            // Normalize currencies
            defaultCurrency = CurrencyHelper.NormalizeCurrency(defaultCurrency);
            if (string.IsNullOrEmpty(defaultCurrency)) defaultCurrency = "TND";
            string NC(string? raw)
            {
                var n = CurrencyHelper.NormalizeCurrency(raw);
                return string.IsNullOrEmpty(n) ? defaultCurrency : n;
            }
            var selectedCurrency = NC(isMixedMode ? targetCurrency : currency);

            decimal ConvertAmount(decimal amount, string sourceCurrency)
            {
                if (!isMixedMode) return amount;
                if (NC(sourceCurrency) == selectedCurrency) return amount;
                return amount * exchangeRate!.Value;
            }

            // Supplier invoices — "Paid Only" logic: use AmountPaid (confirmed payments)
            var supplierInvoices = await _context.SupplierInvoices
                .AsNoTracking()
                .Include(si => si.Payments)
                .ToListAsync();

            var supplierInvoiceItems = supplierInvoices.Select(si => new
                {
                    Year = (si.InvoiceDate ?? si.CreatedAt).Year,
                    Currency = si.Currency,
                    Amount = si.AmountPaid
                })
                .ToList();

            // Other expenses
            var otherExpenses = await _context.OtherExpenses
                .AsNoTracking()
                .Select(e => new
                {
                    Year = e.Date.Year,
                    Currency = e.Currency,
                    Amount = e.Amount
                })
                .ToListAsync();

            var expenseItems = supplierInvoiceItems
                .Select(si => new { si.Year, Currency = NC(si.Currency), si.Amount })
                .Concat(otherExpenses.Select(e => new { e.Year, Currency = NC(e.Currency), e.Amount }));

            if (!isMixedMode)
            {
                expenseItems = expenseItems.Where(i => i.Currency == selectedCurrency);
            }

            var purchasesByYear = expenseItems
                .GroupBy(i => i.Year)
                .Select(g => new
                {
                    year = g.Key,
                    total = g.Sum(i => isMixedMode ? ConvertAmount(i.Amount, i.Currency) : i.Amount)
                })
                .OrderBy(r => r.year)
                .ToList();

            var totalAllTime = purchasesByYear.Sum(r => r.total);
            var selectedYearTotal = isAllYears
                ? totalAllTime
                : (purchasesByYear.FirstOrDefault(r => r.year == selectedYear)?.total ?? 0);

            return Ok(new
            {
                totalAllTime,
                selectedYearTotal,
                purchasesByYear
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
            var companies = await _context.Companies.AsNoTracking().Where(c => !c.IsDeleted).ToListAsync();
            var result = new List<object>();

            foreach (var company in companies)
            {
                // Get default currency for this company
                var settings = await _context.CompanySettings
                    .FirstOrDefaultAsync(s => s.CompanyId == company.Id);
                var defaultCurrency = CurrencyHelper.NormalizeCurrency(settings?.Currency ?? "TND");
                if (string.IsNullOrEmpty(defaultCurrency)) defaultCurrency = "TND";
                string NC(string? raw)
                {
                    var n = CurrencyHelper.NormalizeCurrency(raw);
                    return string.IsNullOrEmpty(n) ? defaultCurrency : n;
                }

                // Fetch invoices for this company (bypass global filter via IgnoreQueryFilters)
                var invoices = await _context.Invoices.IgnoreQueryFilters()
                    .AsNoTracking()
                    .Include(i => i.Payments)
                    .Include(i => i.Quote)
                    .Where(i => i.CompanyId == company.Id && !i.IsDeleted)
                    .ToListAsync();

                var supplierInvoices = await _context.SupplierInvoices.IgnoreQueryFilters()
                    .AsNoTracking()
                    .Include(si => si.Payments)
                    .Where(si => si.CompanyId == company.Id && !si.IsDeleted)
                    .ToListAsync();

                var otherExpenses = await _context.OtherExpenses.IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(e => e.CompanyId == company.Id && !e.IsDeleted)
                    .ToListAsync();

                // Group by normalized currency
                var currencies = invoices.Select(i => NC(i.Quote?.Currency))
                    .Union(supplierInvoices.Select(si => NC(si.Currency)))
                    .Union(otherExpenses.Select(e => NC(e.Currency)))
                    .Union(new[] { defaultCurrency })
                    .Distinct()
                    .ToList();

                var currencyBuckets = currencies.Select(cur =>
                {
                    var curInvoices = invoices.Where(i => NC(i.Quote?.Currency) == cur).ToList();
                    var curSupplier = supplierInvoices.Where(si => NC(si.Currency) == cur).ToList();
                    var curExpenses = otherExpenses.Where(e => NC(e.Currency) == cur).ToList();

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
                        UnpaidCount = curInvoices.Count(i => i.Status == "Pending"),
                        UnpaidAmount = curInvoices.Where(i => i.Status == "Pending").Sum(i => i.TotalAmount ?? 0)
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
                .AsNoTracking()
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
