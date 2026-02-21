using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Dtos;

namespace ResourceManager.Controllers
{
    public class ExpensesController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly ILogger<ExpensesController> _logger;

        // ═══ Currency alias → canonical ISO code ═══
        // DT (French symbol for Tunisian Dinar) → TND, etc.
        private static readonly Dictionary<string, string> CurrencyAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            ["DT"] = "TND",
            ["dt"] = "TND",
            // Arabic symbol for TND
            ["\u062F\u062A"] = "TND",
        };

        // ═══ Category translations → canonical English key ═══
        // Covers FR, DE, AR translations so imported data maps back correctly.
        private static readonly Dictionary<string, string> CategoryAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            // French
            ["loyer"] = "rent", ["services publics"] = "utilities",
            ["fournitures de bureau"] = "office", ["déplacements"] = "travel",
            ["assurance"] = "insurance", ["abonnements"] = "subscription",
            ["salaires"] = "salary", ["télécommunications"] = "telecom",
            ["frais bancaires"] = "bankFees", ["autre"] = "other",
            ["factures fournisseurs"] = "supplier_invoices",
            // German
            ["miete"] = "rent", ["nebenkosten"] = "utilities",
            ["bürobedarf"] = "office", ["reisen"] = "travel",
            ["versicherung"] = "insurance", ["wartung"] = "maintenance",
            ["gehälter"] = "salary", ["telekommunikation"] = "telecom",
            ["bankgebühren"] = "bankFees", ["sonstiges"] = "other",
            ["lieferantenrechnungen"] = "supplier_invoices",
            // Arabic
            ["إيجار"] = "rent", ["مرافق"] = "utilities",
            ["مستلزمات مكتبية"] = "office", ["سفر"] = "travel",
            ["تسويق"] = "marketing", ["تأمين"] = "insurance",
            ["صيانة"] = "maintenance", ["اشتراكات"] = "subscription",
            ["رواتب"] = "salary", ["اتصالات"] = "telecom",
            ["رسوم بنكية"] = "bankFees", ["أخرى"] = "other",
            ["فواتير الموردين"] = "supplier_invoices",
        };

        /// <summary>Normalize currency code: DT → TND, dt → TND, etc.</summary>
        internal static string NormalizeCurrency(string? currency)
        {
            if (string.IsNullOrWhiteSpace(currency)) return "TND";
            var trimmed = currency.Trim();
            if (CurrencyAliases.TryGetValue(trimmed, out var canonical))
                return canonical;
            return trimmed.ToUpperInvariant();
        }

        /// <summary>Normalize category: translated names → canonical English key, lowercase.</summary>
        internal static string NormalizeCategory(string? category)
        {
            if (string.IsNullOrWhiteSpace(category)) return "other";
            var trimmed = category.Trim();
            if (CategoryAliases.TryGetValue(trimmed, out var canonical))
                return canonical;
            return trimmed.ToLowerInvariant();
        }

        public ExpensesController(AppDbContext context, TimeProvider time, ILogger<ExpensesController> logger)
        {
            _context = context;
            _time = time;
            _logger = logger;
        }

        // GET: api/expenses
        [HttpGet]
        public async Task<ActionResult> GetExpenses([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.OtherExpenses
                    .AsNoTracking()
                    .OrderByDescending(e => e.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var expenses = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(e => new
                    {
                        e.Id,
                        e.Description,
                        e.Amount,
                        e.Date,
                        e.Category,
                        e.Notes,
                        e.IsRecurring,
                        e.Currency,
                        e.CurrencySymbol,
                        e.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new { Data = expenses, Page = page, Size = size, TotalCount = totalCount, TotalPages = totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching expenses");
                return Ok(new { Data = Array.Empty<object>(), Page = page, Size = size, TotalCount = 0, TotalPages = 0 });
            }
        }

        // GET: api/expenses/5
        [HttpGet("{id}")]
        public async Task<ActionResult> GetExpense(int id)
        {
            var expense = await _context.OtherExpenses.FindAsync(id);
            if (expense == null) return NotFound();

            return Ok(new
            {
                expense.Id,
                expense.Description,
                expense.Amount,
                expense.Date,
                expense.Category,
                expense.Notes,
                expense.IsRecurring,
                expense.Currency,
                expense.CurrencySymbol,
                expense.CreatedAt
            });
        }

        // GET: api/expenses/summary
        [HttpGet("summary")]
        public async Task<ActionResult> GetExpenseSummary([FromQuery] int? year = null)
        {
            var now = _time.GetUtcNow().DateTime;
            // year == null means "All Years" (no filter)
            var isAllYears = !year.HasValue;
            var selectedYear = isAllYears ? now.Year : year.GetValueOrDefault(now.Year);
            var startOfMonth = new DateTime(selectedYear, now.Month, 1);
            var startOfYear = new DateTime(selectedYear, 1, 1);

            // Determine company default currency
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            string defaultCurrency = "TND";
            if (userId != null)
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null)
                {
                    var settings = await _context.CompanySettings
                        .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                    if (settings != null)
                        defaultCurrency = settings.Currency ?? "TND";
                }
            }

            var expensesQuery = _context.OtherExpenses.AsQueryable();
            if (!isAllYears)
            {
                expensesQuery = expensesQuery.Where(e => e.Date.Year == selectedYear);
            }
            var allExpenses = await expensesQuery.ToListAsync();

            // Include paid supplier invoices in expense totals
            var supplierInvoicesQuery = _context.SupplierInvoices
                .Include(si => si.Payments)
                .AsQueryable();
            if (!isAllYears)
            {
                supplierInvoicesQuery = supplierInvoicesQuery
                    .Where(si => (si.InvoiceDate ?? si.CreatedAt).Year == selectedYear);
            }
            var allSupplierInvoices = await supplierInvoicesQuery.ToListAsync();

            // ═══ Per-currency breakdown ═══
            // Normalize currency codes so DT/TND/dt all group together
            var byCurrency = allExpenses
                .GroupBy(e => NormalizeCurrency(e.Currency ?? defaultCurrency))
                .Select(g => new
                {
                    Currency = g.Key,
                    CurrencySymbol = g.First().CurrencySymbol ?? g.Key,
                    TotalAll = g.Sum(e => e.Amount),
                    TotalThisMonth = g.Where(e => e.Date >= startOfMonth).Sum(e => e.Amount),
                    TotalThisYear = g.Where(e => e.Date >= startOfYear).Sum(e => e.Amount),
                    Count = g.Count()
                })
                .ToList();

            // Add supplier invoices per currency — "Paid Only" logic: use AmountPaid (confirmed payments)
            var supplierByCurrency = allSupplierInvoices
                .Where(si => si.AmountPaid > 0)
                .GroupBy(si => NormalizeCurrency(si.Currency ?? defaultCurrency))
                .Select(g => new
                {
                    Currency = g.Key,
                    TotalPaid = g.Sum(si => si.AmountPaid),
                    TotalThisMonth = g.Where(si => si.InvoiceDate.HasValue && si.InvoiceDate.Value >= startOfMonth).Sum(si => si.AmountPaid),
                    TotalThisYear = g.Where(si => si.InvoiceDate.HasValue && si.InvoiceDate.Value >= startOfYear).Sum(si => si.AmountPaid),
                    Count = g.Count()
                })
                .ToList();

            // Merge expense + supplier totals per currency
            var allCurrencies = byCurrency.Select(b => b.Currency)
                .Union(supplierByCurrency.Select(s => s.Currency))
                .Distinct()
                .ToList();

            var currencyBreakdowns = allCurrencies.Select(cur =>
            {
                var exp = byCurrency.FirstOrDefault(b => b.Currency == cur);
                var sup = supplierByCurrency.FirstOrDefault(s => s.Currency == cur);
                return new
                {
                    Currency = cur,
                    CurrencySymbol = exp?.CurrencySymbol ?? cur,
                    TotalAll = (exp?.TotalAll ?? 0) + (sup?.TotalPaid ?? 0),
                    TotalThisMonth = (exp?.TotalThisMonth ?? 0) + (sup?.TotalThisMonth ?? 0),
                    TotalThisYear = (exp?.TotalThisYear ?? 0) + (sup?.TotalThisYear ?? 0),
                    Count = (exp?.Count ?? 0) + (sup?.Count ?? 0)
                };
            })
            .OrderByDescending(c => c.TotalAll)
            .ToList();

            // Legacy flat totals (sum across ALL currencies for backward compat)
            var totalAll = currencyBreakdowns.Sum(c => c.TotalAll);
            var totalThisMonth = currencyBreakdowns.Sum(c => c.TotalThisMonth);
            var totalThisYear = currencyBreakdowns.Sum(c => c.TotalThisYear);

            // Group by category (OtherExpenses only — supplier invoices are a separate category)
            // Normalize category names so translated/cased variants group together
            var byCategory = allExpenses
                .GroupBy(e => NormalizeCategory(e.Category))
                .Select(g => new
                {
                    Category = g.Key,
                    Total = g.Sum(e => e.Amount),
                    Count = g.Count()
                })
                .OrderByDescending(g => g.Total)
                .ToList();

            var totalSupplierAmount = allSupplierInvoices.Sum(si => si.AmountPaid);
            // Add supplier invoices as a category if any paid amount exists
            if (totalSupplierAmount > 0)
            {
                byCategory.Add(new { Category = "supplier_invoices", Total = totalSupplierAmount, Count = allSupplierInvoices.Count(si => si.AmountPaid > 0) });
            }

            return Ok(new
            {
                TotalAll = totalAll,
                TotalThisMonth = totalThisMonth,
                TotalThisYear = totalThisYear,
                ByCategory = byCategory,
                Count = allExpenses.Count + allSupplierInvoices.Count(si => si.AmountPaid > 0),
                CurrencyBreakdowns = currencyBreakdowns,
                DefaultCurrency = defaultCurrency
            });
        }

        // POST: api/expenses
        [HttpPost]
        public async Task<ActionResult> CreateExpense(CreateExpenseDto dto)
        {
            var normalizedCurrency = NormalizeCurrency(dto.Currency);
            var normalizedCategory = NormalizeCategory(dto.Category);

            var expense = new OtherExpense
            {
                Description = dto.Description,
                Amount = dto.Amount,
                Date = dto.Date ?? _time.GetUtcNow().DateTime,
                Category = normalizedCategory,
                Notes = dto.Notes,
                IsRecurring = dto.IsRecurring,
                Currency = normalizedCurrency,
                CurrencySymbol = dto.CurrencySymbol ?? normalizedCurrency
            };

            _context.OtherExpenses.Add(expense);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created expense {Id}: {Description} - {Amount}", expense.Id, expense.Description, expense.Amount);

            return CreatedAtAction(nameof(GetExpense), new { id = expense.Id }, new
            {
                expense.Id,
                expense.Description,
                expense.Amount,
                expense.Date,
                expense.Category,
                expense.Notes,
                expense.IsRecurring,
                expense.Currency,
                expense.CurrencySymbol,
                expense.CreatedAt
            });
        }

        // PUT: api/expenses/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateExpense(int id, UpdateExpenseDto dto)
        {
            var expense = await _context.OtherExpenses.FindAsync(id);
            if (expense == null) return NotFound();

            expense.Description = dto.Description;
            expense.Amount = dto.Amount;
            expense.Date = dto.Date ?? expense.Date;
            expense.Category = NormalizeCategory(dto.Category);
            expense.Notes = dto.Notes;
            expense.IsRecurring = dto.IsRecurring;
            expense.Currency = NormalizeCurrency(dto.Currency ?? expense.Currency);
            expense.CurrencySymbol = dto.CurrencySymbol ?? expense.CurrencySymbol;
            expense.UpdatedAt = _time.GetUtcNow().DateTime;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated expense {Id}: {Description}", expense.Id, expense.Description);

            return NoContent();
        }

        // DELETE: api/expenses/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteExpense(int id)
        {
            var expense = await _context.OtherExpenses.FindAsync(id);
            if (expense == null) return NotFound();

            // Soft delete
            expense.IsDeleted = true;
            expense.DeletedAt = _time.GetUtcNow().DateTime;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft-deleted expense {Id}", id);

            return NoContent();
        }
    }
}
