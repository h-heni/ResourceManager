using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Dtos;
using ResourceManager.Helpers;

namespace ResourceManager.Controllers
{
    public class ExpensesController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly ILogger<ExpensesController> _logger;

        // ═══ Category translations → canonical English key ═══
        // Loaded dynamically from i18n locale files (ClientApp/src/i18n/locales/*.json)
        // so adding a new language or category automatically updates the mapping.
        private static Dictionary<string, string>? _categoryAliases;
        private static readonly object _aliasLock = new();

        private static Dictionary<string, string> GetCategoryAliases()
        {
            if (_categoryAliases != null) return _categoryAliases;
            lock (_aliasLock)
            {
                if (_categoryAliases != null) return _categoryAliases;
                _categoryAliases = LoadCategoryAliasesFromLocales();
                return _categoryAliases;
            }
        }

        /// <summary>
        /// Reads all i18n locale JSON files and builds a reverse map:
        /// translated category value → canonical English key.
        /// e.g. "Loyer" → "rent", "Salaires" → "salary", "إيجار" → "rent".
        /// </summary>
        private static Dictionary<string, string> LoadCategoryAliasesFromLocales()
        {
            var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            // Try published output first (Docker), then development path
            var localesDir = Path.Combine(AppContext.BaseDirectory, "locales");
            if (!Directory.Exists(localesDir))
                localesDir = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "src", "i18n", "locales");

            if (!Directory.Exists(localesDir))
                return aliases; // No locale files found — normalization still lowercases

            foreach (var file in Directory.GetFiles(localesDir, "*.json"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(file));
                    if (doc.RootElement.TryGetProperty("expense", out var expense)
                        && expense.TryGetProperty("categories", out var categories))
                    {
                        foreach (var prop in categories.EnumerateObject())
                        {
                            var translated = prop.Value.GetString();
                            // Map translated value → English key (skip identity mappings)
                            if (!string.IsNullOrWhiteSpace(translated) && !string.Equals(translated, prop.Name, StringComparison.OrdinalIgnoreCase))
                            {
                                aliases.TryAdd(translated, prop.Name);
                            }
                        }
                    }
                }
                catch { /* skip malformed locale files */ }
            }
            return aliases;
        }

        /// <summary>Normalize currency code: DT → TND, dt → TND, etc. Delegates to shared CurrencyHelper.</summary>
        internal static string NormalizeCurrency(string? currency)
        {
            var result = CurrencyHelper.NormalizeCurrency(currency);
            return string.IsNullOrEmpty(result) ? "TND" : result;
        }

        /// <summary>Normalize category: translated names → canonical English key, lowercase.</summary>
        internal static string NormalizeCategory(string? category)
        {
            if (string.IsNullOrWhiteSpace(category)) return "other";
            var trimmed = category.Trim();
            var aliases = GetCategoryAliases();
            if (aliases.TryGetValue(trimmed, out var canonical))
                return canonical;
            // Check if it already matches a built-in key (case-insensitive) — preserve original casing
            var validKeys = GetValidCategoryKeys();
            foreach (var key in validKeys)
            {
                if (string.Equals(key, trimmed, StringComparison.OrdinalIgnoreCase))
                    return key;
            }
            // Custom category: return trimmed as-is (preserve user's casing)
            return trimmed;
        }

        /// <summary>
        /// Returns the set of valid built-in expense category keys
        /// (e.g. "rent", "utilities", "office", etc.) loaded from the i18n locale files.
        /// </summary>
        internal static HashSet<string> GetValidCategoryKeys()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var localesDir = Path.Combine(AppContext.BaseDirectory, "locales");
            if (!Directory.Exists(localesDir))
                localesDir = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "src", "i18n", "locales");

            if (!Directory.Exists(localesDir))
                return keys;

            // Read the first locale file that has expense.categories to extract the keys
            foreach (var file in Directory.GetFiles(localesDir, "*.json"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(file));
                    if (doc.RootElement.TryGetProperty("expense", out var expense)
                        && expense.TryGetProperty("categories", out var categories))
                    {
                        foreach (var prop in categories.EnumerateObject())
                        {
                            keys.Add(prop.Name);
                        }
                        if (keys.Count > 0) break; // all locale files share the same keys
                    }
                }
                catch { /* skip malformed locale files */ }
            }
            return keys;
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

            // Normalize the default currency (e.g., DT → TND) so it matches normalized category currencies
            defaultCurrency = NormalizeCurrency(defaultCurrency);

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
            // Local helper: coalesce null/empty/whitespace currency to defaultCurrency before normalization
            string Cur(string? raw) => NormalizeCurrency(string.IsNullOrWhiteSpace(raw) ? defaultCurrency : raw);

            // Normalize currency codes so DT/TND/dt all group together
            var byCurrency = allExpenses
                .GroupBy(e => Cur(e.Currency))
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
                .GroupBy(si => Cur(si.Currency))
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

            // Group by (category, currency) so amounts are correctly separated per currency
            // Normalize both category names and currency codes
            var byCategory = allExpenses
                .GroupBy(e => new { Category = NormalizeCategory(e.Category), Currency = Cur(e.Currency) })
                .Select(g => new
                {
                    Category = g.Key.Category,
                    Currency = g.Key.Currency,
                    Total = g.Sum(e => e.Amount),
                    Count = g.Count()
                })
                .OrderByDescending(g => g.Total)
                .ToList();

            // Add supplier invoices as a category per currency if any paid amount exists
            var supplierByCategory = allSupplierInvoices
                .Where(si => si.AmountPaid > 0)
                .GroupBy(si => Cur(si.Currency))
                .Select(g => new
                {
                    Category = "supplier_invoices",
                    Currency = g.Key,
                    Total = g.Sum(si => si.AmountPaid),
                    Count = g.Count()
                })
                .ToList();

            foreach (var sc in supplierByCategory)
            {
                byCategory.Add(sc);
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
