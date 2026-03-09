using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.DTOs;
using ResourceManager.Models;
using System.Globalization;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Archive controller for viewing historical invoices (revenues) and expenses.
    /// Combines regular records with imported CSV data.
    /// Employees cannot access archive data.
    /// </summary>
    [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
    public class ArchiveController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ArchiveController> _logger;
        private readonly UserManager<ApplicationUser> _userManager;

        public ArchiveController(AppDbContext context, ILogger<ArchiveController> logger, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _logger = logger;
            _userManager = userManager;
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
                var user = await GetCurrentUserAsync(_userManager);
                if (user == null) return Unauthorized();

                // Get years from archived invoices (Treated == true) using IgnoreQueryFilters
                var invoiceYears = await _context.Invoices
                    .IgnoreQueryFilters()
                    .Where(i => i.CompanyId == user.CompanyId
                        && (i.Treated == true || i.Category == "imported"))
                    .Select(i => i.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from other expenses
                var expenseYears = await _context.OtherExpenses
                    .Select(e => e.Date.Year)
                    .Distinct()
                    .ToListAsync();

                // Get years from paid supplier invoices
                var supplierYears = await _context.SupplierInvoices
                    .Where(si => si.Payments != null && si.Payments.Any(p => p.Status == "Completed"))
                    .Where(si => si.InvoiceDate.HasValue)
                    .Select(si => si.InvoiceDate!.Value.Year)
                    .Distinct()
                    .ToListAsync();

                // Combine all years and sort (oldest first as per requirement)
                var allYears = invoiceYears
                    .Concat(expenseYears)
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
        /// Returns archived invoices from core invoices table.
        /// Supports year filtering.
        /// </summary>
        [HttpGet("invoices")]
        public async Task<ActionResult<PaginatedResponseDto<object>>> GetArchivedInvoices(
            [FromQuery] int? year,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (pageSize < 1) pageSize = 20;
                if (pageSize > 100) pageSize = 100;

                var user = await GetCurrentUserAsync(_userManager);
                if (user == null) return Unauthorized();

                // Determine the year to filter by
                int filterYear = year ?? DateTime.UtcNow.Year;

                // Get archived invoices (Treated == true) using IgnoreQueryFilters + manual CompanyId
                var regularInvoices = await _context.Invoices
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Include(i => i.Client)
                    .Include(i => i.Payments)
                    .Include(i => i.Quotes)
                    .Where(i => i.CompanyId == user.CompanyId
                        && i.Date.Year == filterYear
                        && (i.Treated == true || i.Category == "imported"))
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
                        Currency = i.Quotes.FirstOrDefault()?.Currency ?? "",
                        CurrencySymbol = i.Quotes.FirstOrDefault()?.CurrencySymbol ?? "",
                        AmountPaid = i.Payments != null ? i.Payments.Where(p => p.Status == "Completed").Sum(p => p.Amount) : 0m,
                        RemainingAmount = i.TotalAmount - (i.Payments != null ? i.Payments.Where(p => p.Status == "Completed").Sum(p => p.Amount) : 0m),
                        Status = i.Status ?? "Paid",
                        Reference = i.Number.ToString(),
                        PaymentMethod = "Invoice",
                        Source = string.Equals(i.Category, "imported", StringComparison.OrdinalIgnoreCase) ? "historical" : "invoice",
                        Year = i.Date.Year,
                        Payments = payments
                    };
                }).ToList();

                var sorted = regularInvoiceData.OrderByDescending(x => x.Date).Cast<object>().ToList();
                var totalCount = sorted.Count;
                var pagedItems = sorted
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var response = new PaginatedResponseDto<object>
                {
                    Items = pagedItems,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get archived invoices for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve archived invoices" });
            }
        }

        /// <summary>
        /// GET: api/archive/other-expenses
        /// </summary>
        [HttpGet("other-expenses")]
        public async Task<ActionResult> GetOtherExpenses([FromQuery] int? year)
        {
            try
            {
                int filterYear = year ?? DateTime.UtcNow.Year;

                var data = await _context.OtherExpenses
                    .AsNoTracking()
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
                    .OrderByDescending(x => x.Date)
                    .ToListAsync();

                return Ok(new
                {
                    year = filterYear,
                    count = data.Count,
                    data = data
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get other expenses for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve other expenses" });
            }
        }

        /// <summary>
        /// GET: api/archive/supplier-invoices
        /// Includes paid supplier invoices from core table.
        /// </summary>
        [HttpGet("supplier-invoices")]
        public async Task<ActionResult> GetSupplierInvoices([FromQuery] int? year)
        {
            try
            {
                int filterYear = year ?? DateTime.UtcNow.Year;

                // 1. Get paid supplier invoices logic
                var supplierInvoices = await _context.SupplierInvoices
                    .AsNoTracking()
                    .Include(si => si.Supplier)
                    .Include(si => si.Payments)
                    .Where(si => si.Payments != null && si.Payments.Any(p => p.Status == "Completed"))
                    .Where(si => si.InvoiceDate.HasValue && si.InvoiceDate.Value.Year == filterYear)
                    .Select(si => new
                    {
                        si.Id,
                        Date = si.InvoiceDate!.Value,
                        SupplierName = si.Supplier != null ? si.Supplier.Name : "Unknown",
                        Amount = si.Payments!.Where(p => p.Status == "Completed").Sum(p => p.Amount),
                        Currency = si.Currency ?? "",
                        CurrencySymbol = si.CurrencySymbol ?? "",
                        Category = "Supplier Invoice",
                        Reference = si.InvoiceNumber ?? "",
                        Source = "supplier_invoice",
                        Year = si.InvoiceDate!.Value.Year
                    })
                    .ToListAsync();

                var combinedData = supplierInvoices
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
                _logger.LogError(ex, "Failed to get supplier invoices for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve supplier invoices" });
            }
        }
    }
}
