using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using System.Globalization;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Archive controller for viewing historical invoices (revenues) and expenses.
    /// Combines regular records with imported CSV data.
    /// </summary>
    public class ArchiveController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ArchiveController> _logger;

        public ArchiveController(AppDbContext context, ILogger<ArchiveController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// GET: api/archive/years
        /// Returns list of available years from both regular and historical data.
        /// </summary>
        [HttpGet("years")]
        public async Task<ActionResult> GetAvailableYears()
        {
            try
            {
                // Get years from regular invoices with Paid status
                var invoiceYears = await _context.Invoices
                    .Where(i => i.Status == "Paid")
                    .Select(i => i.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from historical revenues
                var historicalRevenueYears = await _context.HistoricalRevenues
                    .Select(h => h.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from other expenses
                var expenseYears = await _context.OtherExpenses
                    .Select(e => e.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from historical expenses
                var historicalExpenseYears = await _context.HistoricalExpenses
                    .Select(h => h.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from paid supplier invoices
                var supplierYears = await _context.FournisseurInvoices
                    .Where(si => si.Payments != null && si.Payments.Any(p => p.Status == "Completed"))
                    .Where(si => si.InvoiceDate.HasValue)
                    .Select(si => si.InvoiceDate!.Value.Year)
                    .Distinct()
                    .ToListAsync();

                // Combine all years and sort (oldest first as per requirement)
                var allYears = invoiceYears
                    .Concat(historicalRevenueYears)
                    .Concat(expenseYears)
                    .Concat(historicalExpenseYears)
                    .Concat(supplierYears)
                    .Distinct()
                    .OrderBy(y => y)
                    .ToList();

                return Ok(new
                {
                    years = allYears,
                    latestYear = allYears.Any() ? allYears.Max() : (int?)null
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get available years");
                return StatusCode(500, new { message = "Failed to retrieve available years" });
            }
        }

        /// <summary>
        /// GET: api/archive/invoices
        /// Returns archived invoices combining regular Paid invoices and historical revenues.
        /// Supports year filtering.
        /// </summary>
        [HttpGet("invoices")]
        public async Task<ActionResult> GetArchivedInvoices([FromQuery] int? year)
        {
            try
            {
                // Determine the year to filter by
                int filterYear = year ?? DateTime.UtcNow.Year;

                // Get regular invoices with Paid status
                var regularInvoices = await _context.Invoices
                    .Include(i => i.Client)
                    .Include(i => i.Payments)
                    .Where(i => i.Status == "Paid" && i.Date.Year == filterYear)
                    .ToListAsync();

                var regularInvoiceData = regularInvoices.Select(i => {
                    var payments = i.Payments?.Where(p => p != null).Select(p => new
                    {
                        p.Id,
                        p.Amount,
                        PaymentDate = p.PaymentDate.ToString("yyyy-MM-dd"),
                        Notes = p.Notes ?? "",
                        Status = p.Status ?? "Completed",
                        p.IsScheduled
                    }).ToList();
                    
                    return new
                    {
                        i.Id,
                        Number = i.Number.ToString(),
                        Date = i.Date,
                        TotalAmount = i.TotalAmount,
                        ClientName = i.Client != null ? i.Client.Name : "Unknown",
                        ClientId = i.ClientId,
                        Currency = i.Currency ?? "",
                        CurrencySymbol = i.CurrencySymbol ?? "",
                        AmountPaid = i.Payments != null ? i.Payments.Where(p => p.Status == "Completed").Sum(p => p.Amount) : 0m,
                        RemainingAmount = i.TotalAmount - (i.Payments != null ? i.Payments.Where(p => p.Status == "Completed").Sum(p => p.Amount) : 0m),
                        Status = i.Status ?? "Paid",
                        Reference = i.Number.ToString(),
                        PaymentMethod = "Invoice",
                        Source = "invoice",
                        Year = i.Date.Year,
                        Payments = payments
                    };
                }).ToList();

                // Get historical revenues
                var historicalRevenues = await _context.HistoricalRevenues
                    .Include(h => h.Client)
                    .Where(h => h.Date.Year == filterYear)
                    .ToListAsync();

                var historicalRevenueData = historicalRevenues.Select(h => new
                {
                    h.Id,
                    Number = "H" + h.Id.ToString(), // Historical data doesn't have invoice numbers, use H + ID
                    Date = h.Date,
                    TotalAmount = h.AmountPaid,
                    ClientName = h.ClientName,
                    ClientId = h.ClientId,
                    Currency = h.Currency ?? "",
                    CurrencySymbol = h.Currency ?? "",
                    AmountPaid = h.AmountPaid,
                    RemainingAmount = 0m,
                    Status = "Paid",
                    Reference = h.Reference ?? "",
                    PaymentMethod = h.PaymentMethod ?? "Cash",
                    Source = "historical",
                    Year = h.Date.Year,
                    Payments = (List<object>?)null // Historical data doesn't have payment records
                }).ToList();

                // Combine both lists by creating a unified response
                var combinedList = new List<object>();
                combinedList.AddRange(regularInvoiceData);
                combinedList.AddRange(historicalRevenueData);
                
                var sorted = combinedList.OrderByDescending(x => ((dynamic)x).Date).ToList();

                return Ok(new
                {
                    year = filterYear,
                    count = sorted.Count,
                    data = sorted
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get archived invoices for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve archived invoices" });
            }
        }

        /// <summary>
        /// GET: api/archive/expenses
        /// Returns archived expenses combining regular expenses, supplier invoices, and historical expenses.
        /// Supports year filtering.
        /// </summary>
        [HttpGet("expenses")]
        public async Task<ActionResult> GetArchivedExpenses([FromQuery] int? year)
        {
            try
            {
                // Determine the year to filter by
                int filterYear = year ?? DateTime.UtcNow.Year;

                // Get other expenses
                var otherExpenses = await _context.OtherExpenses
                    .Where(e => e.Date.Year == filterYear)
                    .Select(e => new
                    {
                        e.Id,
                        Date = e.Date,
                        SupplierName = e.Description ?? "",
                        Amount = e.Amount,
                        Currency = e.Currency ?? "",
                        CurrencySymbol = e.CurrencySymbol ?? "",
                        Category = e.Category ?? "",
                        Reference = e.Notes ?? "",
                        Source = "expense",
                        Year = e.Date.Year
                    })
                    .ToListAsync();

                // Get paid supplier invoices
                var supplierInvoices = await _context.FournisseurInvoices
                    .Include(si => si.Fournisseur)
                    .Include(si => si.Payments)
                    .Where(si => si.Payments != null && si.Payments.Any(p => p.Status == "Completed"))
                    .Where(si => si.InvoiceDate.HasValue && si.InvoiceDate.Value.Year == filterYear)
                    .Select(si => new
                    {
                        si.Id,
                        Date = si.InvoiceDate!.Value,
                        SupplierName = si.Fournisseur != null ? si.Fournisseur.Name : "Unknown",
                        Amount = si.Payments!.Where(p => p.Status == "Completed").Sum(p => p.Amount),
                        Currency = si.Currency ?? "",
                        CurrencySymbol = si.CurrencySymbol ?? "",
                        Category = "Supplier Invoice",
                        Reference = si.InvoiceNumber ?? "",
                        Source = "supplier_invoice",
                        Year = si.InvoiceDate!.Value.Year
                    })
                    .ToListAsync();

                // Get historical expenses
                var historicalExpenses = await _context.HistoricalExpenses
                    .Include(h => h.Fournisseur)
                    .Where(h => h.Date.Year == filterYear)
                    .Select(h => new
                    {
                        h.Id,
                        Date = h.Date,
                        SupplierName = h.SupplierName ?? "",
                        Amount = h.AmountPaid,
                        Currency = h.Currency ?? "",
                        CurrencySymbol = h.Currency ?? "",
                        Category = h.Category ?? "",
                        Reference = h.Reference ?? "",
                        Source = "historical",
                        Year = h.Date.Year
                    })
                    .ToListAsync();

                // Combine all expenses
                var combinedData = otherExpenses
                    .Concat(supplierInvoices.Select(s => new
                    {
                        s.Id,
                        s.Date,
                        s.SupplierName,
                        s.Amount,
                        s.Currency,
                        s.CurrencySymbol,
                        s.Category,
                        s.Reference,
                        s.Source,
                        s.Year
                    }))
                    .Concat(historicalExpenses.Select(h => new
                    {
                        h.Id,
                        h.Date,
                        h.SupplierName,
                        h.Amount,
                        h.Currency,
                        h.CurrencySymbol,
                        h.Category,
                        h.Reference,
                        h.Source,
                        h.Year
                    }))
                    .OrderByDescending(x => x.Date)
                    .ToList();

                return Ok(new
                {
                    year = filterYear,
                    count = combinedData.Count,
                    data = combinedData
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get archived expenses for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve archived expenses" });
            }
        }
    }
}
