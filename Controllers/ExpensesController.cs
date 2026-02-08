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
                expense.CreatedAt
            });
        }

        // GET: api/expenses/summary
        [HttpGet("summary")]
        public async Task<ActionResult> GetExpenseSummary()
        {
            var now = _time.GetUtcNow().DateTime;
            var startOfMonth = new DateTime(now.Year, now.Month, 1);
            var startOfYear = new DateTime(now.Year, 1, 1);

            var allExpenses = await _context.OtherExpenses.ToListAsync();

            var totalAll = allExpenses.Sum(e => e.Amount);
            var totalThisMonth = allExpenses
                .Where(e => e.Date >= startOfMonth)
                .Sum(e => e.Amount);
            var totalThisYear = allExpenses
                .Where(e => e.Date >= startOfYear)
                .Sum(e => e.Amount);

            // Group by category
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

            return Ok(new
            {
                TotalAll = totalAll,
                TotalThisMonth = totalThisMonth,
                TotalThisYear = totalThisYear,
                ByCategory = byCategory,
                Count = allExpenses.Count
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
                IsRecurring = dto.IsRecurring
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
