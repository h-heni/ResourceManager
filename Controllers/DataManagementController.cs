using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Dtos;
using ResourceManager.Helpers;
using ResourceManager.Models;
using ResourceManager.Services;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Data Export (CSV/Excel) and Historical Data Import for Managers.
    /// All financial data is PAYMENT-BASED.
    /// </summary>
    [Authorize(Roles = "Manager,SuperAdmin")]
    public class DataManagementController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<DataManagementController> _logger;

        public DataManagementController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<DataManagementController> logger)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════════
        // DATA EXPORT
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Export paid revenues as Excel/CSV. Payment-based only.
        /// </summary>
        [HttpGet("export/revenues")]
        public async Task<IActionResult> ExportRevenues(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string format = "csv")
        {
            try
            {
            var fromDate = from ?? DateTime.MinValue;
            var toDate = to ?? DateTime.MaxValue;

            // Get company default currency
            var userId = _userManager.GetUserId(User);
            string defaultCurrency = "TND";
            if (userId != null)
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    var settings = await _context.CompanySettings
                        .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                    if (settings != null)
                        defaultCurrency = settings.Currency ?? "TND";
                }
            }

            // Collect all completed payments from invoices
            var invoicePayments = await _context.Invoices
                .Include(i => i.Client)
                .Include(i => i.Payments)
                .Include(i => i.Quote)
                .Where(i => i.Payments!.Any(p => p.Status == "Completed"))
                .ToListAsync();

            var paymentRows = invoicePayments
                .SelectMany(i => (i.Payments ?? new List<Payment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= fromDate && p.PaymentDate <= toDate)
                    .Select(p => new
                    {
                        Date = p.PaymentDate,
                        ClientName = i.Client?.Name ?? "Unknown",
                        AmountPaid = p.Amount,
                        Currency = i.Quote?.Currency ?? defaultCurrency,
                        PaymentMethod = "Payment",
                        InvoiceNumber = i.Number
                    }))
                .OrderBy(r => r.Date)
                .ToList();

            // Include historical revenues
            var historicalRevenues = await _context.HistoricalRevenues
                .Include(h => h.Invoice)
                .Where(h => h.Date >= fromDate && h.Date <= toDate)
                .OrderBy(h => h.Date)
                .ToListAsync();

            var allRows = paymentRows
                .Select(r => new ExportRow(r.Date, r.ClientName, r.AmountPaid, r.Currency, r.PaymentMethod, r.InvoiceNumber))
                .Concat(historicalRevenues.Select(h => new ExportRow(
                    h.Date,
                    h.ClientName,
                    h.AmountPaid,
                    h.Currency ?? defaultCurrency,
                    h.PaymentMethod ?? "",
                    h.Invoice?.Number ?? h.InvoiceNumber ?? "")))
                .OrderBy(r => r.Date)
                .ToList();

            var headers = new[] { "Date", "Client Name", "Amount Paid", "Currency", "Payment Method", "Invoice Number" };
            var dataRows = allRows.Select(r => new object[] {
                r.Date,
                r.ClientName,
                r.AmountPaid,
                r.Currency,
                r.PaymentMethod,
                r.InvoiceNumber
            }).ToList();

            if (format?.Equals("xlsx", StringComparison.OrdinalIgnoreCase) == true)
            {
                var bytes = BuildExcel("Revenues", headers, dataRows);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"revenues_{DateTime.UtcNow:yyyyMMdd}.xlsx");
            }

            var csv = BuildCsv(headers, dataRows.Select(r => new[] {
                ((DateTime)r[0]).ToString("yyyy-MM-dd"),
                r[1].ToString()!, r[2] is decimal d2 ? d2.ToString("F2", CultureInfo.InvariantCulture) : r[2].ToString()!,
                r[3].ToString()!, r[4].ToString()!, r[5].ToString()!
            }));
            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"revenues_{DateTime.UtcNow:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting revenues");
                return StatusCode(500, new { message = "Failed to export revenues" });
            }
        }

        /// <summary>
        /// Export paid expenses as Excel/CSV. Payment-based only.
        /// </summary>
        [HttpGet("export/expenses")]
        public async Task<IActionResult> ExportExpenses(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string format = "csv")
        {
            try
            {
            var fromDate = from ?? DateTime.MinValue;
            var toDate = to ?? DateTime.MaxValue;

            var userId = _userManager.GetUserId(User);
            string defaultCurrency = "TND";
            if (userId != null)
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    var settings = await _context.CompanySettings
                        .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                    if (settings != null)
                        defaultCurrency = settings.Currency ?? "TND";
                }
            }

            // Supplier invoice paid payments
            var supplierInvoices = await _context.SupplierInvoices
                .Include(si => si.Supplier)
                .Include(si => si.Payments)
                .Where(si => si.Payments!.Any(p => p.Status == "Completed"))
                .ToListAsync();

            var supplierRows = supplierInvoices
                .SelectMany(si => (si.Payments ?? new List<SupplierPayment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= fromDate && p.PaymentDate <= toDate)
                    .Select(p => new
                    {
                        Date = p.PaymentDate,
                        Supplier = si.Supplier?.Name ?? "Unknown",
                        AmountPaid = p.Amount,
                        Currency = si.Currency ?? defaultCurrency,
                        Category = "Supplier Invoice",
                        Reference = si.InvoiceNumber
                    }))
                .ToList();

            // Other expenses (direct expenses, not payment-based — they are the amounts themselves)
            var otherExpenses = await _context.OtherExpenses
                .Where(e => e.Date >= fromDate && e.Date <= toDate)
                .OrderBy(e => e.Date)
                .ToListAsync();

            var otherRows = otherExpenses.Select(e => new
            {
                e.Date,
                Supplier = e.Description,
                AmountPaid = e.Amount,
                Currency = e.Currency ?? defaultCurrency,
                e.Category,
                Reference = e.Notes ?? ""
            });

            // Historical expenses
            var historicalExpenses = await _context.HistoricalExpenses
                .Where(h => h.Date >= fromDate && h.Date <= toDate)
                .OrderBy(h => h.Date)
                .ToListAsync();

            var allRows = supplierRows
                .Concat(otherRows.Select(r => new { r.Date, r.Supplier, r.AmountPaid, r.Currency, r.Category, r.Reference }))
                .Concat(historicalExpenses.Select(h => new { Date = h.Date, Supplier = h.SupplierName, AmountPaid = h.AmountPaid, Currency = h.Currency ?? defaultCurrency, Category = h.Category ?? "Historical", Reference = h.Reference ?? "" }))
                .OrderBy(r => r.Date)
                .ToList();

            var headers = new[] { "Date", "Supplier", "Amount Paid", "Currency", "Category", "Reference" };
            var dataRows = allRows.Select(r => new object[] {
                r.Date, r.Supplier, r.AmountPaid, r.Currency, r.Category, r.Reference
            }).ToList();

            if (format?.Equals("xlsx", StringComparison.OrdinalIgnoreCase) == true)
            {
                var bytes = BuildExcel("Expenses", headers, dataRows);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"expenses_{DateTime.UtcNow:yyyyMMdd}.xlsx");
            }

            var csv = BuildCsv(headers, dataRows.Select(r => new[] {
                ((DateTime)r[0]).ToString("yyyy-MM-dd"),
                r[1].ToString()!, r[2] is decimal d2 ? d2.ToString("F2", CultureInfo.InvariantCulture) : r[2].ToString()!,
                r[3].ToString()!, r[4].ToString()!, r[5].ToString()!
            }));
            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"expenses_{DateTime.UtcNow:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting expenses");
                return StatusCode(500, new { message = "Failed to export expenses" });
            }
        }

        /// <summary>
        /// Export clients as Excel/CSV.
        /// </summary>
        [HttpGet("export/clients")]
        public async Task<IActionResult> ExportClients([FromQuery] string format = "csv")
        {
            try
            {
            var clients = await _context.Clients.OrderBy(c => c.Name).ToListAsync();

            var headers = new[] { "Name", "Matricule Fiscal", "Phone Number", "Address", "Email" };
            var dataRows = clients.Select(c => new object[] {
                c.Name, c.TaxId ?? "", c.Phone ?? "", c.Address ?? "", c.Email ?? ""
            }).ToList();

            if (format?.Equals("xlsx", StringComparison.OrdinalIgnoreCase) == true)
            {
                var bytes = BuildExcel("Clients", headers, dataRows);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"clients_{DateTime.UtcNow:yyyyMMdd}.xlsx");
            }

            var csv = BuildCsv(headers, dataRows.Select(r => r.Select(v => v.ToString()!).ToArray()));
            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"clients_{DateTime.UtcNow:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting clients");
                return StatusCode(500, new { message = "Failed to export clients" });
            }
        }

        /// <summary>
        /// Export products/services as Excel/CSV.
        /// </summary>
        [HttpGet("export/products")]
        public async Task<IActionResult> ExportProducts([FromQuery] string format = "csv")
        {
            try
            {
            var userId = _userManager.GetUserId(User);
            string defaultCurrency = "TND";
            if (userId != null)
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    var settings = await _context.CompanySettings
                        .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                    if (settings != null)
                        defaultCurrency = settings.Currency ?? "TND";
                }
            }

            var products = await _context.ProductServices.OrderBy(p => p.Name).ToListAsync();

            var headers = new[] { "Name", "Description", "Price", "Currency", "TVA Rate" };
            var dataRows = products.Select(p => new object[] {
                p.Name, p.Description ?? "", p.DefaultUnitPrice, defaultCurrency, p.TvaRate
            }).ToList();

            if (format?.Equals("xlsx", StringComparison.OrdinalIgnoreCase) == true)
            {
                var bytes = BuildExcel("Products", headers, dataRows);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"products_{DateTime.UtcNow:yyyyMMdd}.xlsx");
            }

            var csv = BuildCsv(headers, dataRows.Select(r => new[] {
                r[0].ToString()!, r[1].ToString()!,
                r[2] is decimal d ? d.ToString("F2", CultureInfo.InvariantCulture) : r[2].ToString()!,
                r[3].ToString()!,
                r[4] is decimal t ? t.ToString("F0", CultureInfo.InvariantCulture) : r[4].ToString()!
            }));
            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"products_{DateTime.UtcNow:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting products");
                return StatusCode(500, new { message = "Failed to export products" });
            }
        }

        /// <summary>
        /// Export other expenses (operational costs) as Excel/CSV.
        /// </summary>
        [HttpGet("export/otherExpenses")]
        public async Task<IActionResult> ExportOtherExpenses(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string format = "csv")
        {
            try
            {
                var fromDate = from ?? DateTime.MinValue;
                var toDate = to ?? DateTime.MaxValue;

                var userId = _userManager.GetUserId(User);
                string defaultCurrency = "TND";
                if (userId != null)
                {
                    var user = await _userManager.FindByIdAsync(userId);
                    if (user != null)
                    {
                        var settings = await _context.CompanySettings
                            .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                        if (settings != null)
                            defaultCurrency = settings.Currency ?? "TND";
                    }
                }

                var expenses = await _context.OtherExpenses
                    .AsNoTracking()
                    .Where(e => e.Date >= fromDate && e.Date <= toDate)
                    .OrderBy(e => e.Date)
                    .ToListAsync();

                var headers = new[] { "Description", "Amount", "Date", "Category", "Currency", "Notes", "Recurring" };
                var dataRows = expenses.Select(e => new object[]
                {
                    e.Description,
                    e.Amount,
                    e.Date,
                    e.Category,
                    e.Currency ?? defaultCurrency,
                    e.Notes ?? "",
                    e.IsRecurring ? "Yes" : "No"
                }).ToList();

                if (format?.Equals("xlsx", StringComparison.OrdinalIgnoreCase) == true)
                {
                    var bytes = BuildExcel("Other Expenses", headers, dataRows);
                    return File(bytes,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        $"other_expenses_{DateTime.UtcNow:yyyyMMdd}.xlsx");
                }

                var csv = BuildCsv(headers, dataRows.Select(r => new[]
                {
                    r[0].ToString()!,
                    r[1] is decimal d ? d.ToString("F2", CultureInfo.InvariantCulture) : r[1].ToString()!,
                    ((DateTime)r[2]).ToString("yyyy-MM-dd"),
                    r[3].ToString()!,
                    r[4].ToString()!,
                    r[5].ToString()!,
                    r[6].ToString()!
                }));
                return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                    "text/csv; charset=utf-8",
                    $"other_expenses_{DateTime.UtcNow:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting other expenses");
                return StatusCode(500, new { message = "Failed to export other expenses" });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // HISTORICAL DATA IMPORT — VALIDATE (DRY RUN)
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Validate imported Excel/CSV data WITHOUT saving. Returns preview + errors.
        /// </summary>
        [HttpPost("import/validate")]
        public async Task<IActionResult> ValidateImport([FromBody] ImportRequest request)
        {
            if (request == null || request.Rows == null || request.Rows.Count == 0)
                return BadRequest(new { message = "No data provided" });

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return Unauthorized();

            var result = await ValidateRowsAsync(request.DataType, request.Rows, user.CompanyId);
            return Ok(result);
        }

        /// <summary>
        /// Import validated historical data. Stores in backend with IsHistorical = true.
        /// Crash-proof: wrapped in transaction + try-catch. No partial imports.
        /// Deduplicates based on Date + Amount + Client/Supplier (Upsert behavior).
        /// </summary>
        [HttpPost("import/confirm")]
        public async Task<IActionResult> ConfirmImport([FromBody] ImportRequest request)
        {
            if (request == null || request.Rows == null || request.Rows.Count == 0)
                return BadRequest(new { message = "No data provided" });

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return Unauthorized();

            var companyId = user.CompanyId;
            var validation = await ValidateRowsAsync(request.DataType, request.Rows, companyId);
            if (validation.Errors.Count > 0)
                return BadRequest(new { message = "Validation failed", errors = validation.Errors });

            int imported = 0;
            int updated = 0;
            int skipped = 0;
            string? unknownType = null;

            // ── NpgsqlRetryingExecutionStrategy requires wrapping user transactions ──
            var strategy = _context.Database.CreateExecutionStrategy();

            try
            {
                await strategy.ExecuteAsync(async () =>
                {
                    using var transaction = await _context.Database.BeginTransactionAsync();

                    switch (request.DataType.ToLower())
                    {
                    case "revenues":
                    {
                        // 1. Pre-load Clients
                        var existingClients = await _context.Clients
                            .Where(c => c.CompanyId == companyId)
                            .ToListAsync();
                        
                        var clientLookup = existingClients
                            .GroupBy(c => c.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                        var invoiceNumbers = validation.ValidRows
                            .Select(r => SafeGet(r, "InvoiceNumber"))
                            .Where(n => !string.IsNullOrWhiteSpace(n))
                            .Select(n => n.Trim())
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .ToList();

                        var invoiceLookup = await _context.Invoices
                            .Where(i => i.CompanyId == companyId && invoiceNumbers.Contains(i.Number))
                            .Select(i => new { i.Id, i.Number })
                            .ToDictionaryAsync(i => i.Number, StringComparer.OrdinalIgnoreCase);

                        var invoiceIds = invoiceLookup.Values.Select(i => i.Id).ToList();

                        var existingRevenueByInvoiceId = await _context.HistoricalRevenues
                            .Where(r => r.CompanyId == companyId && r.InvoiceId.HasValue && invoiceIds.Contains(r.InvoiceId.Value))
                            .GroupBy(r => r.InvoiceId!.Value)
                            .ToDictionaryAsync(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt).First());

                        var pendingHistoricalByInvoiceId = new Dictionary<int, HistoricalRevenue>();

                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var clientName = SafeGet(row, "Client Name");
                            if (string.IsNullOrWhiteSpace(clientName)) { skipped++; continue; }

                            var dateStr = SafeGet(row, "Date");
                            if (!TryParseDate(dateStr, out var parsedDate)) { skipped++; continue; }
                            var utcDate = parsedDate.ToUniversalTime();

                            var amountStr = SafeGet(row, "Amount Paid");
                            if (!TryParseAmount(amountStr, out var parsedAmount) || parsedAmount < 0) { skipped++; continue; }

                            var currency = CurrencyHelper.NormalizeCurrency(SafeGet(row, "Currency", "TND"));
                            if (string.IsNullOrEmpty(currency)) currency = "TND";
                            var paymentMethod = SafeGet(row, "Payment Method");
                            var invoiceNumber = SafeGet(row, "InvoiceNumber");

                            if (!invoiceLookup.TryGetValue(invoiceNumber, out var invoice))
                            {
                                skipped++;
                                continue;
                            }

                            // Get-or-Create Client
                            if (!clientLookup.TryGetValue(clientName, out var client))
                            {
                                client = new Client
                                {
                                    Name = clientName,
                                    Address = "",
                                    TaxId = "",
                                    Phone = "",
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };
                                _context.Clients.Add(client);
                                clientLookup[clientName] = client;
                            }

                            if (existingRevenueByInvoiceId.TryGetValue(invoice.Id, out var existingByInvoice))
                            {
                                existingByInvoice.Date = utcDate;
                                existingByInvoice.ClientName = clientName;
                                existingByInvoice.ClientId = client.Id;
                                existingByInvoice.AmountPaid = parsedAmount;
                                existingByInvoice.Currency = currency;
                                existingByInvoice.PaymentMethod = paymentMethod;
                                existingByInvoice.InvoiceNumber = invoice.Number;
                                existingByInvoice.InvoiceId = invoice.Id;
                                existingByInvoice.UpdatedAt = DateTime.UtcNow;

                                _context.HistoricalRevenues.Update(existingByInvoice);
                                updated++;
                            }
                            else if (pendingHistoricalByInvoiceId.TryGetValue(invoice.Id, out var pendingExisting))
                            {
                                pendingExisting.Date = utcDate;
                                pendingExisting.ClientName = clientName;
                                pendingExisting.ClientId = client.Id;
                                pendingExisting.AmountPaid = parsedAmount;
                                pendingExisting.Currency = currency;
                                pendingExisting.PaymentMethod = paymentMethod;
                                pendingExisting.InvoiceNumber = invoice.Number;
                                pendingExisting.InvoiceId = invoice.Id;
                                pendingExisting.UpdatedAt = DateTime.UtcNow;
                                updated++;
                            }
                            else
                            {
                                var newRevenue = new HistoricalRevenue
                                {
                                    Date = utcDate,
                                    ClientName = clientName,
                                    Client = client,
                                    AmountPaid = parsedAmount,
                                    Currency = currency,
                                    PaymentMethod = paymentMethod,
                                    InvoiceNumber = invoice.Number,
                                    InvoiceId = invoice.Id,
                                    IsHistorical = true,
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };

                                _context.HistoricalRevenues.Add(newRevenue);
                                pendingHistoricalByInvoiceId[invoice.Id] = newRevenue;
                                imported++;
                            }
                        }
                        break;
                    }

                    case "expenses":
                    {
                        // 1. Pre-load Suppliers
                        var existingSuppliers = await _context.Suppliers
                            .Where(f => f.CompanyId == companyId)
                            .ToListAsync();

                        var supplierLookup = existingSuppliers
                            .GroupBy(f => f.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                        // 2. Fetch existing for Deduplication
                        var validDates = validation.ValidRows
                            .Select(r => TryParseDate(SafeGet(r, "Date"), out var d) ? d : DateTime.MinValue)
                            .Where(d => d != DateTime.MinValue)
                            .ToList();

                        var minDate = validDates.Any() ? validDates.Min().AddDays(-1) : DateTime.MinValue;
                        var maxDate = validDates.Any() ? validDates.Max().AddDays(1) : DateTime.MaxValue;

                        var existingExpenses = await _context.HistoricalExpenses
                            .Where(e => e.CompanyId == companyId && e.Date >= minDate && e.Date <= maxDate)
                            .ToListAsync();

                        // Lookup Key: SupplierId + Date + Amount
                        var expenseLookup = existingExpenses
                            .GroupBy(e => new { Date = e.Date.Date, e.SupplierId, e.AmountPaid })
                            .ToDictionary(g => g.Key, g => g.ToList());

                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var supplierName = SafeGet(row, "Supplier");
                            if (string.IsNullOrWhiteSpace(supplierName)) { skipped++; continue; }

                            var dateStr = SafeGet(row, "Date");
                            if (!TryParseDate(dateStr, out var parsedDate)) { skipped++; continue; }
                            var utcDate = parsedDate.ToUniversalTime();

                            var amountStr = SafeGet(row, "Amount Paid");
                            if (!TryParseAmount(amountStr, out var parsedAmount) || parsedAmount < 0) { skipped++; continue; }

                            var currency = CurrencyHelper.NormalizeCurrency(SafeGet(row, "Currency", "TND"));
                            if (string.IsNullOrEmpty(currency)) currency = "TND";
                            var category = SafeGet(row, "Category");
                            var reference = SafeGet(row, "Reference");

                            // Get-or-Create Supplier
                            if (!supplierLookup.TryGetValue(supplierName, out var supplier))
                            {
                                supplier = new Supplier
                                {
                                    Name = supplierName,
                                    Address = "",
                                    TaxId = "",
                                    Phone = "",
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };
                                _context.Suppliers.Add(supplier);
                                await _context.SaveChangesAsync();
                                supplierLookup[supplierName] = supplier;
                            }

                            // Deduplication / Upsert Check
                            var lookupKey = new { Date = utcDate.Date, SupplierId = (int?)supplier.Id, AmountPaid = parsedAmount };

                            if (expenseLookup.TryGetValue(lookupKey, out var candidates) && candidates.Count > 0)
                            {
                                // MATCH FOUND: Update
                                var existing = candidates[0];
                                candidates.RemoveAt(0);

                                existing.SupplierName = supplierName;
                                existing.Currency = currency;
                                existing.Category = category;
                                existing.Reference = reference;
                                existing.UpdatedAt = DateTime.UtcNow;
                                
                                _context.HistoricalExpenses.Update(existing);
                                updated++;
                            }
                            else
                            {
                                // NO MATCH: Insert
                                _context.HistoricalExpenses.Add(new HistoricalExpense
                                {
                                    Date = utcDate,
                                    SupplierName = supplierName,
                                    SupplierId = supplier.Id,
                                    AmountPaid = parsedAmount,
                                    Currency = currency,
                                    Category = category,
                                    Reference = reference,
                                    IsHistorical = true,
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                });
                                imported++;
                            }
                        }
                        break;
                    }

                    case "clients":
                    {
                        var existingClients = await _context.Clients
                            .Where(c => c.CompanyId == companyId)
                            .ToListAsync();
                        var clientLookup = existingClients
                            .ToDictionary(c => c.Name.Trim().ToLowerInvariant(), c => c);

                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var name = SafeGet(row, "Name");
                            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

                            var key = name.Trim().ToLowerInvariant();
                            if (clientLookup.TryGetValue(key, out var existing))
                            {
                                // Upsert: update existing client fields
                                var mf = SafeGet(row, "Matricule Fiscal");
                                var phone = SafeGet(row, "Phone Number");
                                var addr = SafeGet(row, "Address");
                                var email = SafeGet(row, "Email") is { Length: > 0 } em ? em : null;
                                bool changed = false;
                                if (!string.IsNullOrWhiteSpace(mf) && mf != existing.TaxId) { existing.TaxId = mf; changed = true; }
                                if (!string.IsNullOrWhiteSpace(phone) && phone != existing.Phone) { existing.Phone = phone; changed = true; }
                                if (!string.IsNullOrWhiteSpace(addr) && addr != existing.Address) { existing.Address = addr; changed = true; }
                                if (email != null && email != existing.Email) { existing.Email = email; changed = true; }
                                if (changed) { existing.UpdatedAt = DateTime.UtcNow; imported++; }
                                else { skipped++; }
                            }
                            else
                            {
                                var client = new Client
                                {
                                    Name = name,
                                    TaxId = SafeGet(row, "Matricule Fiscal"),
                                    Phone = SafeGet(row, "Phone Number"),
                                    Address = SafeGet(row, "Address"),
                                    Email = SafeGet(row, "Email") is { Length: > 0 } email ? email : null,
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };
                                _context.Clients.Add(client);
                                clientLookup[key] = client;
                                imported++;
                            }
                        }
                        break;
                    }

                    case "suppliers":
                    {
                        var existingSuppliers = await _context.Suppliers
                            .Where(f => f.CompanyId == companyId)
                            .ToListAsync();
                        var supplierLookup = existingSuppliers
                            .ToDictionary(f => f.Name.Trim().ToLowerInvariant(), f => f);

                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var name = SafeGet(row, "Name");
                            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

                            var key = name.Trim().ToLowerInvariant();
                            if (supplierLookup.TryGetValue(key, out var existing))
                            {
                                // Upsert: update existing supplier fields
                                var mf = SafeGet(row, "Matricule Fiscal");
                                var phone = SafeGet(row, "Phone Number");
                                var addr = SafeGet(row, "Address");
                                bool changed = false;
                                if (!string.IsNullOrWhiteSpace(mf) && mf != existing.TaxId) { existing.TaxId = mf; changed = true; }
                                if (!string.IsNullOrWhiteSpace(phone) && phone != existing.Phone) { existing.Phone = phone; changed = true; }
                                if (!string.IsNullOrWhiteSpace(addr) && addr != existing.Address) { existing.Address = addr; changed = true; }
                                if (changed) { existing.UpdatedAt = DateTime.UtcNow; imported++; }
                                else { skipped++; }
                            }
                            else
                            {
                                var supplier = new Supplier
                                {
                                    Name = name,
                                    TaxId = SafeGet(row, "Matricule Fiscal"),
                                    Phone = SafeGet(row, "Phone Number"),
                                    Address = SafeGet(row, "Address"),
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };
                                _context.Suppliers.Add(supplier);
                                supplierLookup[key] = supplier;
                                imported++;
                            }
                        }
                        break;
                    }

                    case "products":
                    {
                        var existingNames = (await _context.ProductServices
                            .Where(p => p.CompanyId == companyId)
                            .Select(p => p.Name).ToListAsync())
                            .Select(n => n.Trim().ToLowerInvariant())
                            .ToHashSet();

                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var name = SafeGet(row, "Name");
                            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

                            if (existingNames.Contains(name.ToLowerInvariant()))
                            { skipped++; continue; }

                            var priceStr = SafeGet(row, "Price");
                            if (!TryParseAmount(priceStr, out var price)) { skipped++; continue; }

                            var tvaStr = SafeGet(row, "TVA Rate");
                            if (!TryParseAmount(tvaStr, out var tvaRate)) { skipped++; continue; }

                            _context.ProductServices.Add(new ProductService
                            {
                                Name = name,
                                Description = SafeGet(row, "Description") is { Length: > 0 } desc ? desc : null,
                                DefaultUnitPrice = price,
                                TvaRate = tvaRate,
                                Type = "product",
                                VatApplicable = true,
                                CompanyId = companyId,
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                            existingNames.Add(name.ToLowerInvariant());
                            imported++;
                        }
                        break;
                    }

                    case "otherexpenses":
                    {
                        // Import OtherExpense records directly (not historical).
                        // NOTE: NormalizeKeys aliases "Amount" → "Amount Paid" globally,
                        // so we read "Amount Paid" first, then fall back to "Amount".
                        foreach (var row in validation.ValidRows)
                        {
                            if (row == null) { skipped++; continue; }

                            var description = SafeGet(row, "Description");
                            if (string.IsNullOrWhiteSpace(description)) { skipped++; continue; }

                            var dateStr = SafeGet(row, "Date");
                            if (!TryParseDate(dateStr, out var parsedDate)) { skipped++; continue; }
                            // Use SpecifyKind(Utc) to avoid local → UTC shift
                            var utcDate = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc);

                            // "Amount" gets aliased to "Amount Paid" by NormalizeKeys — check both
                            var amountStr = SafeGet(row, "Amount Paid") is { Length: > 0 } ap ? ap : SafeGet(row, "Amount");
                            if (!TryParseAmount(amountStr, out var parsedAmount) || parsedAmount <= 0) { skipped++; continue; }

                            var category = ExpensesController.NormalizeCategory(SafeGet(row, "Category", "other"));
                            var currency = ExpensesController.NormalizeCurrency(SafeGet(row, "Currency", "TND"));
                            var notes = SafeGet(row, "Notes");
                            var recurringStr = SafeGet(row, "Recurring");
                            var isRecurring = recurringStr.Equals("yes", StringComparison.OrdinalIgnoreCase)
                                           || recurringStr.Equals("true", StringComparison.OrdinalIgnoreCase)
                                           || recurringStr == "1";

                            _context.OtherExpenses.Add(new OtherExpense
                            {
                                Description = description,
                                Amount = parsedAmount,
                                Date = utcDate,
                                Category = category,
                                Currency = currency,
                                CurrencySymbol = currency,
                                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes,
                                IsRecurring = isRecurring,
                                CompanyId = companyId,
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                            imported++;
                        }
                        break;
                    }

                    default:
                        unknownType = request.DataType;
                        return; // exit the lambda; controller will return BadRequest
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                });   // end strategy.ExecuteAsync

                if (unknownType != null)
                    return BadRequest(new { message = $"Unknown data type: {unknownType}" });

                _logger.LogInformation(
                    "Historical import: {Imported} new, {Updated} updated {Type} records, {Skipped} skipped, by user {User}",
                    imported, updated, request.DataType, skipped, userId);

                return Ok(new
                {
                    message = $"Import successful: {imported} new, {updated} updated." +
                              (skipped > 0 ? $" ({skipped} skipped/invalid)" : ""),
                    imported,
                    updated,
                    skipped
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Import failed for {Type} by user {User}. Imported={Imported}, Updated={Updated}, Skipped={Skipped}. Inner={Inner}",
                    request.DataType, userId, imported, updated, skipped, ex.InnerException?.Message ?? "none");

                // Provide full error chain for debugging
                var details = ex.InnerException?.Message;
                var deepDetails = ex.InnerException?.InnerException?.Message;

                return StatusCode(500, new
                {
                    message = $"Import failed: {ex.Message}",
                    details,
                    deepDetails
                });
            }
        }

        /// <summary>
        /// Get historical data summary
        /// </summary>
        [HttpGet("import/summary")]
        public async Task<IActionResult> GetImportSummary()
        {
            var revenues = await _context.HistoricalRevenues.CountAsync();
            var expenses = await _context.HistoricalExpenses.CountAsync();

            return Ok(new
            {
                historicalRevenues = revenues,
                historicalExpenses = expenses,
                totalHistorical = revenues + expenses
            });
        }

        // ═══════════════════════════════════════════════════════════
        // CSV TEMPLATE DOWNLOAD
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/DataManagement/template/{type}
        /// Returns a semicolon-separated CSV file with the correct headers + one example row.
        /// CRITICAL: Uses ';' separator to match our MiniExcel/CSV parser configuration.
        /// </summary>
        [HttpGet("template/{type}")]
        public IActionResult DownloadTemplate(string type, [FromQuery] string lang = "en")
        {
            string headers;
            string exampleRow;
            lang = lang.ToLower();

            switch (type.ToLower())
            {
                case "revenues":
                    if (lang == "fr")
                    {
                        headers = "Date;Nom Client;Montant Payé;Devise;Mode de paiement;Numéro de facture";
                        exampleRow = "31/10/2024;Nom du client;1500,50;TND;Virement bancaire;FA26-001";
                    }
                    else if (lang == "ar")
                    {
                        headers = "التاريخ;اسم العميل;المبلغ المدفوع;العملة;طريقة الدفع;رقم الفاتورة";
                        exampleRow = "31/10/2024;اسم العميل;1500.50;TND;تحويل بنكي;FA26-001";
                    }
                    else if (lang == "de")
                    {
                        headers = "Datum;Kundenname;Gezahlter Betrag;Währung;Zahlungsmethode;Rechnungsnummer";
                        exampleRow = "31.10.2024;Kundenname;1500,50;TND;Banküberweisung;FA26-001";
                    }
                    else
                    {
                        headers = "Date;Client Name;Amount Paid;Currency;Payment Method;InvoiceNumber";
                        exampleRow = "10/31/2024;Client Name;1500.50;TND;Bank Transfer;FA26-001";
                    }
                    break;
                case "expenses":
                    if (lang == "fr")
                    {
                        headers = "Date;Fournisseur;Montant Payé;Devise;Catégorie";
                        exampleRow = "31/10/2024;Nom fournisseur;500,00;TND;Fournitures de bureau";
                    }
                    else if (lang == "ar")
                    {
                        headers = "التاريخ;المزود;المبلغ المدفوع;العملة;الفئة";
                        exampleRow = "31/10/2024;اسم المزود;500.50;TND;لوازم مكتبية";
                    }
                    else if (lang == "de")
                    {
                        headers = "Datum;Lieferant;Gezahlter Betrag;Währung;Kategorie";
                        exampleRow = "31.10.2024;Lieferant Name;500,00;TND;Bürobedarf";
                    }
                    else
                    {
                        headers = "Date;Supplier;Amount Paid;Currency;Category";
                        exampleRow = "10/31/2024;Supplier Name;500.00;TND;Office Supplies";
                    }
                    break;
                case "clients":
                    if (lang == "fr")
                    {
                        headers = "Nom;Matricule Fiscal;Numéro de téléphone;Adresse;Email";
                        exampleRow = "Nom Client;MF123456;+21699123456;Tunis;client@email.com";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;المعرف الجبائي;رقم الهاتف;العنوان;البريد الإلكتروني";
                        exampleRow = "اسم العميل;MF123456;+21699123456;تونس;client@email.com";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Steuernummer;Telefonnummer;Adresse;E-Mail";
                        exampleRow = "Kundenname;MF123456;+21699123456;Berlin;client@email.com";
                    }
                    else
                    {
                        headers = "Name;Matricule Fiscal;Phone Number;Address;Email";
                        exampleRow = "Client Name;MF123456;+21699123456;City;client@email.com";
                    }
                    break;
                case "suppliers":
                    if (lang == "fr")
                    {
                        headers = "Nom;Matricule Fiscal;Numéro de téléphone;Adresse";
                        exampleRow = "Nom Fournisseur;MF654321;+21699654321;Tunis";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;المعرف الجبائي;رقم الهاتف;العنوان";
                        exampleRow = "اسم المزود;MF654321;+21699654321;تونس";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Steuernummer;Telefonnummer;Adresse";
                        exampleRow = "Lieferantenname;MF654321;+21699654321;Hamburg";
                    }
                    else
                    {
                        headers = "Name;Matricule Fiscal;Phone Number;Address";
                        exampleRow = "Supplier Name;MF654321;+21699654321;City";
                    }
                    break;
                case "products":
                    if (lang == "fr")
                    {
                        headers = "Nom;Prix;Devise;Taux TVA;Description";
                        exampleRow = "Nom Produit;100,00;TND;19;Abonnement annuel";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;السعر;العملة;نسبة الأداء;الوصف";
                        exampleRow = "اسم المنتج;100.00;TND;19;اشتراك سنوي";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Preis;Währung;MwSt-Satz;Beschreibung";
                        exampleRow = "Produktname;100,00;TND;19;Jahresabonnement";
                    }
                    else
                    {
                        headers = "Name;Price;Currency;TVA Rate;Description";
                        exampleRow = "Product Name;100.00;TND;19;Annual subscription";
                    }
                    break;
                case "otherexpenses":
                    if (lang == "fr")
                    {
                        headers = "Description;Montant;Date;Catégorie;Devise;Notes;Récurrent";
                        exampleRow = "Fournitures de bureau;150,00;31/01/2025;bureau;TND;Papeterie mensuelle;Non";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الوصف;المبلغ;التاريخ;الفئة;العملة;ملاحظات;متكرر";
                        exampleRow = "لوازم مكتبية;150.00;31/01/2025;office;TND;قرطاسية شهرية;لا";
                    }
                    else if (lang == "de")
                    {
                        headers = "Beschreibung;Betrag;Datum;Kategorie;Währung;Notizen;Wiederkehrend";
                        exampleRow = "Büromaterial;150,00;31.01.2025;office;TND;Monatlicher Schreibwarenbedarf;Nein";
                    }
                    else
                    {
                        headers = "Description;Amount;Date;Category;Currency;Notes;Recurring";
                        exampleRow = "Office Supplies;150.00;01/31/2025;office;TND;Monthly stationery;No";
                    }
                    break;
                default:
                    return BadRequest(new { message = $"Unknown template type: {type}" });
            }

            // BOM + semicolon-separated CSV
            var csv = $"{headers}\n{exampleRow}\n";
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();

            return File(bytes, "text/csv; charset=utf-8", $"{type}_template.csv");
        }

        // ═══════════════════════════════════════════════════════════
        // PRIVATE HELPERS
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Safely extract a trimmed string value from a row dictionary.
        /// Returns the fallback if the key doesn't exist, is null, or is whitespace.
        /// Handles leading/trailing spaces and prevents KeyNotFoundException.
        /// </summary>
        private static string SafeGet(Dictionary<string, string> row, string key, string fallback = "")
        {
            if (row == null) return fallback;
            if (!row.TryGetValue(key, out var value)) return fallback;
            var trimmed = value?.Trim() ?? "";
            return string.IsNullOrWhiteSpace(trimmed) ? fallback : trimmed;
        }

        private async Task<ValidationResult> ValidateRowsAsync(string dataType, List<Dictionary<string, string>> rows, int companyId)
        {
            var errors = new List<ValidationError>();
            var validRows = new List<Dictionary<string, string>>();

            string[] requiredColumns;
            switch (dataType.ToLower())
            {
                case "revenues":
                    requiredColumns = new[] { "Date", "Client Name", "Amount Paid", "Currency", "InvoiceNumber" };
                    break;
                case "expenses":
                    requiredColumns = new[] { "Date", "Supplier", "Amount Paid", "Currency" };
                    break;
                case "clients":
                    requiredColumns = new[] { "Name" };
                    break;
                case "products":
                    requiredColumns = new[] { "Name", "Price", "Currency", "TVA Rate" };
                    break;
                case "suppliers":
                    requiredColumns = new[] { "Name" };
                    break;
                case "otherexpenses":
                    requiredColumns = new[] { "Description", "Amount", "Date" };
                    break;
                default:
                    errors.Add(new ValidationError(0, $"Unknown data type: {dataType}"));
                    return new ValidationResult(errors, validRows);
            }

            // Check first row for required columns (normalize keys + apply aliases)
            if (rows.Count > 0)
            {
                var firstRowKeys = rows[0].Keys
                    .Select(k =>
                    {
                        var clean = k.Trim().TrimStart('\uFEFF', '\u200B', '\u200C', '\u200D');
                        return ColumnAliases.TryGetValue(clean, out var canonical) ? canonical : clean;
                    })
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (var col in requiredColumns)
                {
                    if (!firstRowKeys.Contains(col))
                    {
                        // Also check if this required column name has been aliased to a canonical name
                        bool foundViaAlias = ColumnAliases.TryGetValue(col, out var aliased) && firstRowKeys.Contains(aliased);
                        if (!foundViaAlias)
                            errors.Add(new ValidationError(0, $"Required column missing: '{col}'"));
                    }
                }
                if (errors.Count > 0)
                    return new ValidationResult(errors, validRows);
            }

            for (int i = 0; i < rows.Count; i++)
            {
                var row = NormalizeKeys(rows[i]);

                // For otherExpenses the template uses "Amount" but NormalizeKeys aliases it
                // to "Amount Paid".  Copy it back so both keys exist and required-column checks
                // and type-specific validation blocks all work consistently.
                if (dataType.ToLower() == "otherexpenses"
                    && row.ContainsKey("Amount Paid") && !row.ContainsKey("Amount"))
                {
                    row["Amount"] = row["Amount Paid"];
                }

                // Use i + 2 to map to Excel row number (Row 1 = Headers, Row 2 = Data Row 0)
                var rowNum = i + 2;
                var rowErrors = new List<string>();

                // Validate required fields are non-empty
                foreach (var col in requiredColumns)
                {
                    // Check canonical name first, then try if the column was aliased
                    var actualKey = row.ContainsKey(col) ? col
                        : (ColumnAliases.TryGetValue(col, out var aliased) && row.ContainsKey(aliased) ? aliased : col);
                    if (!row.ContainsKey(actualKey) || string.IsNullOrWhiteSpace(row[actualKey]))
                    {
                        rowErrors.Add($"'{col}' is required");
                    }
                }

                // Type-specific validation
                if (dataType.ToLower() == "revenues" || dataType.ToLower() == "expenses" || dataType.ToLower() == "otherexpenses")
                {
                    if (row.ContainsKey("Date") && !string.IsNullOrWhiteSpace(row["Date"]))
                    {
                        if (TryParseDate(row["Date"], out var parsedDate))
                            row["Date"] = parsedDate.ToString("yyyy-MM-dd"); // normalise for ConfirmImport
                        else
                            rowErrors.Add("Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY");
                    }
                    if (row.ContainsKey("Amount Paid") && !string.IsNullOrWhiteSpace(row["Amount Paid"]))
                    {
                        if (TryParseAmount(row["Amount Paid"], out var amt) && amt >= 0)
                        {
                            // If Amount Paid is 0 but a "Payment Method" column has a numeric
                            // value (aliased from "Payment"), use that as the actual amount.
                            if (amt == 0 && row.TryGetValue("Payment Method", out var pmVal)
                                         && TryParseAmount(pmVal, out var pmAmt) && pmAmt > 0)
                            {
                                amt = pmAmt;
                            }

                            if (amt > 0)
                                row["Amount Paid"] = amt.ToString(CultureInfo.InvariantCulture);
                            else
                                rowErrors.Add("'Amount Paid' must be a positive number (or provide a value in the Payment column)");
                        }
                        else
                        {
                            rowErrors.Add("'Amount Paid' must be a valid positive number");
                        }
                    }
                    // otherExpenses uses "Amount" column instead of "Amount Paid"
                    if (row.ContainsKey("Amount") && !string.IsNullOrWhiteSpace(row["Amount"]))
                    {
                        if (TryParseAmount(row["Amount"], out var amtDirect) && amtDirect > 0)
                            row["Amount"] = amtDirect.ToString(CultureInfo.InvariantCulture);
                        else if (amtDirect <= 0)
                            rowErrors.Add("'Amount' must be a positive number");
                    }
                }

                if (dataType.ToLower() == "products")
                {
                    if (row.ContainsKey("Price") && !string.IsNullOrWhiteSpace(row["Price"]))
                    {
                        if (TryParseAmount(row["Price"], out var price) && price >= 0)
                            row["Price"] = price.ToString(CultureInfo.InvariantCulture);
                        else
                            rowErrors.Add("'Price' must be a non-negative number");
                    }
                    if (row.ContainsKey("TVA Rate") && !string.IsNullOrWhiteSpace(row["TVA Rate"]))
                    {
                        if (TryParseAmount(row["TVA Rate"], out var rate) && rate >= 0 && rate <= 100)
                            row["TVA Rate"] = rate.ToString(CultureInfo.InvariantCulture);
                        else
                            rowErrors.Add("'TVA Rate' must be between 0 and 100");
                    }
                }

                if (rowErrors.Count > 0)
                {
                    foreach (var err in rowErrors)
                        errors.Add(new ValidationError(rowNum, err));
                }
                else
                {
                    row["__RowNumber"] = rowNum.ToString(CultureInfo.InvariantCulture);
                    validRows.Add(row);
                }
            }

            if (dataType.ToLower() == "revenues" && validRows.Count > 0)
            {
                var invoiceNumbers = validRows
                    .Select(r => SafeGet(r, "InvoiceNumber"))
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Select(n => n.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var validInvoices = await _context.Invoices
                    .Where(i => i.CompanyId == companyId && invoiceNumbers.Contains(i.Number))
                    .Select(i => i.Number)
                    .ToListAsync();

                var invoiceSet = new HashSet<string>(validInvoices, StringComparer.OrdinalIgnoreCase);
                var filteredValidRows = new List<Dictionary<string, string>>(validRows.Count);

                foreach (var row in validRows)
                {
                    var invoiceNumber = SafeGet(row, "InvoiceNumber");
                    if (!invoiceSet.Contains(invoiceNumber))
                    {
                        var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var parsedSourceRow)
                            ? parsedSourceRow
                            : 0;
                        errors.Add(new ValidationError(sourceRow, $"Invoice number '{invoiceNumber}' was not found for your company."));
                        continue;
                    }

                    row.Remove("__RowNumber");
                    filteredValidRows.Add(row);
                }

                validRows = filteredValidRows;
            }
            else
            {
                foreach (var row in validRows)
                    row.Remove("__RowNumber");
            }

            return new ValidationResult(errors, validRows);
        }

        /// <summary>
        /// Common column aliases → canonical name mapping.
        /// Users may have slightly different header names in their CSV/Excel files.
        /// </summary>
        private static readonly Dictionary<string, string> ColumnAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            // Revenue / Expense shared
            { "Date", "Date" },
            { "Datum", "Date" },                      // German
            { "التاريخ", "Date" },                    // Arabic
            
            // Revenue aliases
            { "Payment", "Payment Method" },
            { "Method", "Payment Method" },
            { "Paiement", "Payment Method" },        // French
            { "Mode de paiement", "Payment Method" }, // French
            { "طريقة الدفع", "Payment Method" },      // Arabic
            { "Zahlungsmethode", "Payment Method" },  // German
            
            { "Client", "Client Name" },
            { "Client Name", "Client Name" },
            { "Nom Client", "Client Name" },          // French
            { "Nom du client", "Client Name" },       // French
            { "اسم العميل", "Client Name" },          // Arabic
            { "Kundenname", "Client Name" },          // German
            
            { "Amount Paid", "Amount Paid" },
            { "Montant", "Amount Paid" },             // French
            { "Montant Payé", "Amount Paid" },        // French
            { "Amount", "Amount Paid" },
            { "المبلغ المدفوع", "Amount Paid" },      // Arabic
            { "Gezahlter Betrag", "Amount Paid" },    // German
            { "Betrag", "Amount Paid" },              // German
            
            { "Devise", "Currency" },                 // French
            { "العملة", "Currency" },                  // Arabic
            { "Währung", "Currency" },                // German
            
            { "Invoice Number", "InvoiceNumber" },
            { "InvoiceNumber", "InvoiceNumber" },
            { "Invoice No", "InvoiceNumber" },
            { "Ref", "InvoiceNumber" },
            { "Référence", "InvoiceNumber" },         // French
            { "Numéro de facture", "InvoiceNumber" }, // French
            { "رقم الفاتورة", "InvoiceNumber" },      // Arabic
            { "Rechnungsnummer", "InvoiceNumber" },   // German
            
            // Expense aliases
            { "Fournisseur", "Supplier" },            // French
            { "Supplier Name", "Supplier" },
            { "المزود", "Supplier" },                 // Arabic
            { "اسم المزود", "Supplier" },              // Arabic
            { "Lieferant", "Supplier" },              // German
            { "Lieferant Name", "Supplier" },         // German
            
            { "Catégorie", "Category" },              // French
            { "الفئة", "Category" },                  // Arabic
            { "Kategorie", "Category" },              // German
            
            // Client / Supplier aliases
            { "Nom", "Name" },                        // French
            { "الاسم", "Name" },                      // Arabic
            { "Téléphone", "Phone Number" },          // French
            { "Numéro de téléphone", "Phone Number" }, // French
            { "Phone", "Phone Number" },
            { "Tel", "Phone Number" },
            { "رقم الهاتف", "Phone Number" },         // Arabic
            { "Telefonnummer", "Phone Number" },      // German
            
            { "Adresse", "Address" },                 // French/German
            { "العنوان", "Address" },                 // Arabic
            
            { "Matricule", "Matricule Fiscal" },      // French
            { "Matricule Fiscal", "Matricule Fiscal" },
            { "المعرف الجبائي", "Matricule Fiscal" }, // Arabic
            { "Steuernummer", "Matricule Fiscal" },   // German
            
            // Product aliases
            { "Prix", "Price" },                      // French
            { "السعر", "Price" },                     // Arabic
            { "Preis", "Price" },                     // German
            
            { "Taux TVA", "TVA Rate" },               // French
            { "TVA", "TVA Rate" },
            { "VAT Rate", "TVA Rate" },
            { "VAT", "TVA Rate" },
            { "نسبة الأداء", "TVA Rate" },            // Arabic
            { "MwSt-Satz", "TVA Rate" },              // German
            { "MwSt", "TVA Rate" },                   // German

            // Other Expenses
            { "الوصف", "Description" },               // Arabic
            { "Beschreibung", "Description" },        // German
            { "المبلغ", "Amount" },                   // Arabic
            { "Betrag_Direct", "Amount" },
            { "Notes", "Notes" },
            { "ملاحظات", "Notes" },                   // Arabic
            { "Notizen", "Notizen" },                 // German
            { "Recurring", "Recurring" },
            { "Récurrent", "Recurring" },             // French
            { "متكرر", "Recurring" },                 // Arabic
            { "Wiederkehrend", "Recurring" },         // German
        };

        private static Dictionary<string, string> NormalizeKeys(Dictionary<string, string> row)
        {
            var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kvp in row)
            {
                // Strip BOM (\uFEFF), zero-width spaces, and trim whitespace
                var key = kvp.Key.Trim().TrimStart('\uFEFF', '\u200B', '\u200C', '\u200D');

                // Apply alias mapping if this key isn't already a canonical name
                if (ColumnAliases.TryGetValue(key, out var canonical) &&
                    !normalized.ContainsKey(canonical))
                {
                    key = canonical;
                }

                normalized[key] = kvp.Value?.Trim() ?? "";
            }
            return normalized;
        }

        // ── Date & Amount normalisation helpers ──

        /// <summary>
        /// Supported date formats (tried in order).  The first successful parse wins.
        /// After validation the value is rewritten to yyyy-MM-dd so ConfirmImport
        /// can always use InvariantCulture parsing.
        /// Covers: FR (dd/MM/yyyy), US (MM/dd/yyyy), ISO (yyyy-MM-dd), dashed EU (dd-MM-yyyy).
        /// </summary>
        private static readonly string[] DateFormats = new[]
        {
            "dd/MM/yyyy",   // French / European
            "MM/dd/yyyy",   // US
            "yyyy-MM-dd",   // ISO 8601
            "dd-MM-yyyy",   // European with dashes
        };

        private static bool TryParseDate(string raw, out DateTime result)
        {
            return DateTime.TryParseExact(
                raw.Trim(), DateFormats, CultureInfo.InvariantCulture,
                DateTimeStyles.None, out result);
        }

        /// <summary>
        /// Multi-culture decimal parser for dirty data.
        ///
        /// Algorithm:
        ///   1. Remove all spaces and non-breaking spaces (\u00A0) + currency symbols.
        ///   2. If both comma AND dot are present (e.g. "1,200.50"), treat the dot
        ///      as the decimal separator → strip commas.
        ///   3. If only a comma is present (e.g. "1500,50"), replace it with a dot
        ///      to form a standard decimal string.
        ///   4. Parse with CultureInfo.InvariantCulture.
        ///
        /// Covers: "6 922,00" (FR), "6,922.00" (US), "1500.50", "1500,50".
        /// </summary>
        private static bool TryParseAmount(string raw, out decimal result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(raw)) return false;

            // Step 1: Strip ALL whitespace (regular space, NBSP \u00A0, tabs, etc.) + currency symbols
            var cleaned = Regex.Replace(raw, @"[\s\u00A0]+", "")
                .Replace("€", "").Replace("$", "").Replace("£", "")
                .Trim();

            bool hasComma = cleaned.Contains(',');
            bool hasDot   = cleaned.Contains('.');

            if (hasComma && hasDot)
            {
                // Step 2: Both present → dot is the decimal separator, commas are thousands
                cleaned = cleaned.Replace(",", "");
            }
            else if (hasComma)
            {
                // Step 3: Only comma → it IS the decimal separator
                cleaned = cleaned.Replace(",", ".");
            }
            // else: only dot or neither → already in standard format

            // Step 4: Parse with InvariantCulture (dot = decimal)
            return decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out result);
        }

        /// <summary>
        /// Safe decimal parser that uses the global multi-culture logic.
        /// Handles: "6 922,00" (FR), "6,922.00" (US), "1500.50", "1500,50".
        /// Also handles the case where the frontend already sent a parsed decimal as a string.
        /// </summary>
        private static bool SafeParseDecimal(string raw, out decimal result)
            => TryParseAmount(raw, out result);

        /// <summary>
        /// Safe date parser that uses the global multi-culture logic.
        /// Handles: dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd, dd-MM-yyyy.
        /// Also handles the case where the frontend already normalised to yyyy-MM-dd.
        /// </summary>
        private static bool SafeParseDate(string raw, out DateTime result)
            => TryParseDate(raw, out result);

        private static string BuildCsv(string[] headers, IEnumerable<string[]> rows)
        {
            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", headers.Select(EscapeCsv)));
            foreach (var row in rows)
            {
                sb.AppendLine(string.Join(",", row.Select(EscapeCsv)));
            }
            return sb.ToString();
        }

        private static string EscapeCsv(string field)
        {
            if (string.IsNullOrEmpty(field)) return "";
            if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
            {
                return $"\"{field.Replace("\"", "\"\"")}\"";
            }
            return field;
        }

        /// <summary>
        /// Build a well-formatted Excel workbook.
        /// Types are auto-detected from data values — NO hardcoded column indices.
        /// DateTime → date cell, decimal/double → right-aligned number, else → left-aligned text.
        /// </summary>
        private static byte[] BuildExcel(
            string sheetName,
            string[] headers,
            List<object[]> rows)
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add(sheetName);

            // ── Consistent base font across the whole sheet ──
            ws.Style.Font.FontName = "Calibri";
            ws.Style.Font.FontSize = 11;
            ws.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center; // Align all vertically centered

            // ── Detect column types from first non-null value in each column ──
            var colIsNumber = new bool[headers.Length];
            for (int col = 0; col < headers.Length; col++)
            {
                foreach (var row in rows)
                {
                    if (col < row.Length && row[col] != null)
                    {
                        if (row[col] is decimal or double or float or int or long)
                            colIsNumber[col] = true;
                        break; // first non-null determines type
                    }
                }
            }

            // ── Header row ──
            for (int col = 0; col < headers.Length; col++)
            {
                var cell = ws.Cell(1, col + 1);
                cell.Value = headers[col];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontSize = 12;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#F3F4F6"); // Light gray background
                cell.Style.Border.BottomBorder = XLBorderStyleValues.Medium;
                cell.Style.Border.BottomBorderColor = XLColor.FromHtml("#9CA3AF");
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#E5E7EB");
                
                // Right-align numeric column headers for visual consistency
                cell.Style.Alignment.Horizontal = colIsNumber[col]
                    ? XLAlignmentHorizontalValues.Right
                    : XLAlignmentHorizontalValues.Left;
            }

            // ── Data rows — type auto-detected per value ──
            for (int row = 0; row < rows.Count; row++)
            {
                var data = rows[row];
                for (int col = 0; col < data.Length; col++)
                {
                    var cell = ws.Cell(row + 2, col + 1);
                    var value = data[col];

                    // Set thin borders for every cell
                    cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#E5E7EB");

                    if (value is DateTime dt)
                    {
                        cell.Value = dt;
                        cell.Style.DateFormat.Format = "yyyy-MM-dd";
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                    }
                    else if (value is decimal dec)
                    {
                        cell.Value = (double)dec;
                        cell.Style.NumberFormat.Format = "#,##0.00";
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                    }
                    else if (value is double dbl)
                    {
                        cell.Value = dbl;
                        cell.Style.NumberFormat.Format = "#,##0.00";
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                    }
                    else if (value is int or long)
                    {
                        cell.Value = Convert.ToDouble(value);
                        cell.Style.NumberFormat.Format = "#,##0";
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                    }
                    else
                    {
                        cell.Value = value?.ToString() ?? "";
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                    }
                }

                // Alternate row shading for readability
                if (row % 2 == 1)
                {
                    ws.Range(row + 2, 1, row + 2, headers.Length)
                      .Style.Fill.BackgroundColor = XLColor.FromHtml("#F9FAFB");
                }
            }

            // ── Auto-fit columns with dynamic padding ──
            for (int col = 1; col <= headers.Length; col++)
            {
                ws.Column(col).AdjustToContents();
                var currentWidth = ws.Column(col).Width;
                // Ensure column is at least as wide as its header + padding
                var headerMinWidth = Math.Max(headers[col - 1].Length + 4, 12);
                ws.Column(col).Width = Math.Max(currentWidth + 3, headerMinWidth);
            }

            // ── Freeze header row for scrollable data ──
            ws.SheetView.FreezeRows(1);

            // ── Page layout ──
            ws.PageSetup.PageOrientation = XLPageOrientation.Landscape;
            ws.PageSetup.Margins.Left = 0.5;
            ws.PageSetup.Margins.Right = 0.5;

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ms.ToArray();
        }

        /// <summary>
        /// POST: api/DataManagement/import/parse-excel — Parse an uploaded XLSX file
        /// and return the rows as JSON (same shape as CSV frontend parsing).
        /// This ensures server-side Excel parsing with header-based column reading.
        /// </summary>
        [HttpPost("import/parse-excel")]
        public IActionResult ParseExcelUpload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            if (file.Length > 10 * 1024 * 1024) // 10 MB limit
                return BadRequest(new { message = "File is too large. Max 10 MB." });

            try
            {
                using var stream = file.OpenReadStream();
                using var workbook = new XLWorkbook(stream);
                var ws = workbook.Worksheet(1); // Read first sheet

                var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
                var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;

                if (lastRow < 2 || lastCol < 1)
                    return BadRequest(new { message = "File is empty or has no data rows" });

                // Read headers from first row — by name, NOT by index.
                // Supports non-contiguous columns (empty columns are skipped).
                var headers = new List<string>();
                var headerColMap = new List<int>(); // original 1-based column positions
                for (int col = 1; col <= lastCol; col++)
                {
                    var header = ws.Cell(1, col).GetString().Trim();
                    if (!string.IsNullOrEmpty(header))
                    {
                        headers.Add(header);
                        headerColMap.Add(col);
                    }
                    // Skip empty columns without stopping
                }

                if (headers.Count == 0)
                    return BadRequest(new { message = "No headers found in first row" });

                // Read data rows — mapped by header name, not column index
                var rows = new List<Dictionary<string, string>>();
                for (int row = 2; row <= lastRow; row++)
                {
                    var rowData = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    bool hasData = false;

                    for (int col = 0; col < headers.Count; col++)
                    {
                        var cell = ws.Cell(row, headerColMap[col]);
                        string value;

                        // Preserve date format as yyyy-MM-dd for round-trip
                        if (cell.DataType == XLDataType.DateTime)
                        {
                            value = cell.GetDateTime().ToString("yyyy-MM-dd");
                        }
                        else if (cell.DataType == XLDataType.Number)
                        {
                            // Use InvariantCulture to avoid locale decimal separators
                            value = cell.GetDouble().ToString(CultureInfo.InvariantCulture);
                        }
                        else
                        {
                            value = cell.GetString().Trim();
                        }

                        rowData[headers[col]] = value;
                        if (!string.IsNullOrWhiteSpace(value)) hasData = true;
                    }

                    if (hasData) rows.Add(rowData);
                }

                return Ok(new { headers, rows, rowCount = rows.Count });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse uploaded Excel file");
                return BadRequest(new { message = "Unable to read file. Ensure it is a valid .xlsx Excel file." });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // STRICT POSITIONAL UPLOAD (MiniExcel — no header row)
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Upload an Excel file with strict positional columns (no header row).
        /// Uses MiniExcel index-based parsing. Atomic: if ANY cell fails, the
        /// entire file is rejected with a precise error location.
        ///
        /// Column layout: [0] Date, [1] Client Name, [2] Amount Paid, [3] Currency, [4] Payment Method, [5] InvoiceNumber (optional)
        /// </summary>
        [HttpPost("import/strict-upload")]
        public async Task<IActionResult> StrictPositionalUpload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });

            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "File is too large. Max 10 MB." });

            // 1. Parse & validate — atomic, all-or-nothing
            StrictExcelValidationResult validation;
            using (var stream = file.OpenReadStream())
            {
                validation = StrictExcelUploadService.Parse(stream);
            }

            if (!validation.IsValid)
            {
                return BadRequest(new
                {
                    message = validation.ErrorMessage,
                    row = validation.ErrorRow,
                    column = validation.ErrorColumn
                });
            }

            // 2. Persist as HistoricalRevenue records with Client linkage
            var userId = _userManager.GetUserId(User);
            var user = await _userManager.FindByIdAsync(userId ?? string.Empty);
            if (user == null)
                return Unauthorized();

            var companyId = user.CompanyId;
            int imported = 0;

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // ── Performance: Pre-load all Clients into a case-insensitive dictionary ──
                var existingClients = await _context.Clients
                    .Where(c => c.CompanyId == companyId)
                    .ToListAsync();
                var clientLookup = existingClients
                    .GroupBy(c => c.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                foreach (var dto in validation.Rows)
                {
                    if (dto == null) continue;

                    var clientName = (dto.ClientName ?? "Unknown").Trim();
                    if (string.IsNullOrWhiteSpace(clientName)) clientName = "Unknown";

                    // Get-or-Create Client
                    if (!clientLookup.TryGetValue(clientName, out var client))
                    {
                        client = new Client
                        {
                            Name = clientName,
                            Address = "",
                            TaxId = "",
                            Phone = "",
                            CompanyId = companyId,
                            CreatedByUserId = userId,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Clients.Add(client);
                        clientLookup[clientName] = client;
                    }

                    int? invoiceId = null;
                    string? normalizedInvoiceNumber = null;
                    if (!string.IsNullOrWhiteSpace(dto.InvoiceNumber))
                    {
                        normalizedInvoiceNumber = dto.InvoiceNumber.Trim();
                        var invoice = await _context.Invoices
                            .AsNoTracking()
                            .FirstOrDefaultAsync(i => i.CompanyId == companyId && i.Number == normalizedInvoiceNumber);

                        if (invoice == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new
                            {
                                message = $"Invoice number '{normalizedInvoiceNumber}' was not found for your company.",
                                row = imported + 2,
                                column = "InvoiceNumber"
                            });
                        }

                        invoiceId = invoice.Id;
                        normalizedInvoiceNumber = invoice.Number;
                    }

                    _context.HistoricalRevenues.Add(new HistoricalRevenue
                    {
                        Date = dto.Date.ToUniversalTime(),
                        ClientName = clientName,
                        Client = client,
                        AmountPaid = dto.AmountPaid,
                        Currency = CurrencyHelper.NormalizeCurrency(dto.Currency) is { Length: > 0 } nc ? nc : "TND",
                        PaymentMethod = dto.PaymentMethod?.Trim(),
                        InvoiceId = invoiceId,
                        InvoiceNumber = normalizedInvoiceNumber,
                        IsHistorical = true,
                        CreatedAt = DateTime.UtcNow
                    });
                    imported++;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Strict positional upload: {Count} revenue records imported by user {User}",
                    imported, userId);

                return Ok(new
                {
                    message = $"Successfully imported {imported} payment records.",
                    imported,
                    totalRows = validation.TotalRows
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();

                _logger.LogError(ex,
                    "Strict positional upload failed for user {User}. Imported={Imported}",
                    userId, imported);

                return StatusCode(500, new
                {
                    message = $"Import failed: {ex.Message}",
                    details = ex.InnerException?.Message
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // DTOs
        // ═══════════════════════════════════════════════════════════

        public class ImportRequest
        {
            public string DataType { get; set; } = string.Empty; // "revenues", "expenses", "clients", "products", "suppliers"
            public List<Dictionary<string, string>> Rows { get; set; } = new();
        }

        public class ValidationError
        {
            public int Row { get; set; }
            public string Message { get; set; }

            public ValidationError(int row, string message)
            {
                Row = row;
                Message = message;
            }
        }

        public class ValidationResult
        {
            public List<ValidationError> Errors { get; set; }
            public List<Dictionary<string, string>> ValidRows { get; set; }
            public int TotalRows => Errors.Count + ValidRows.Count;
            public int ValidCount => ValidRows.Count;
            public int ErrorCount => Errors.Count;

            public ValidationResult(List<ValidationError> errors, List<Dictionary<string, string>> validRows)
            {
                Errors = errors;
                ValidRows = validRows;
            }
        }

        private record ExportRow(DateTime Date, string ClientName, decimal AmountPaid, string Currency, string PaymentMethod, string InvoiceNumber);
    }
}
