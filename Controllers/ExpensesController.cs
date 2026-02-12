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

        public ExpensesController(AppDbContext context, TimeProvider time, ILogger<ExpensesController> logger)
        {
            _context = context;
            _time = time;
            _logger = logger;
        }

        // GET: api/expenses
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetExpenses()
        {
            var expenses = await _context.OtherExpenses
                .OrderByDescending(e => e.Date)
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

            return Ok(expenses);
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
            var selectedYear = year ?? now.Year;
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

            var allExpenses = await _context.OtherExpenses.ToListAsync();

            // Include paid supplier invoices in expense totals
            var allSupplierInvoices = await _context.FournisseurInvoices
                .Include(si => si.Payments)
                .ToListAsync();

            if (year.HasValue)
            {
                allExpenses = allExpenses
                    .Where(e => e.Date.Year == selectedYear)
                    .ToList();
                allSupplierInvoices = allSupplierInvoices
                    .Where(si => (si.InvoiceDate ?? si.CreatedAt).Year == selectedYear)
                    .ToList();
            }

            // ═══ Per-currency breakdown ═══
            var byCurrency = allExpenses
                .GroupBy(e => e.Currency ?? defaultCurrency)
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

            // Add supplier invoices per currency
            var supplierByCurrency = allSupplierInvoices
                .Where(si => si.AmountPaid > 0)
                .GroupBy(si => si.Currency ?? defaultCurrency)
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
            var byCategory = allExpenses
                .GroupBy(e => e.Category)
                .Select(g => new
                {
                    Category = g.Key,
                    Total = g.Sum(e => e.Amount),
                    Count = g.Count()
                })
                .OrderByDescending(g => g.Total)
                .ToList();

            var totalSupplierPaid = allSupplierInvoices.Sum(si => si.AmountPaid);
            // Add supplier invoices as a category if any paid amount exists
            if (totalSupplierPaid > 0)
            {
                byCategory.Add(new { Category = "supplier_invoices", Total = totalSupplierPaid, Count = allSupplierInvoices.Count(si => si.AmountPaid > 0) });
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
            var expense = new OtherExpense
            {
                Description = dto.Description,
                Amount = dto.Amount,
                Date = dto.Date ?? _time.GetUtcNow().DateTime,
                Category = dto.Category,
                Notes = dto.Notes,
                IsRecurring = dto.IsRecurring,
                Currency = dto.Currency,
                CurrencySymbol = dto.CurrencySymbol
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
            expense.Category = dto.Category;
            expense.Notes = dto.Notes;
            expense.IsRecurring = dto.IsRecurring;
            expense.Currency = dto.Currency ?? expense.Currency;
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
