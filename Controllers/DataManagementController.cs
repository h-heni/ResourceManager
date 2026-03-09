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
    /// Data Export (CSV/Excel) and Data Import into core tables for Managers.
    /// All financial data is PAYMENT-BASED.
    /// </summary>
    [Authorize(Roles = "Manager,SuperAdmin")]
    public class DataManagementController : BaseApiController
    {
        private const string ImportedCategory = "imported";
        private const string ImportedRevenueLineDescription = "Imported Revenue";
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
                .Include(i => i.Quotes)
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
                        Currency = i.Quotes.FirstOrDefault()?.Currency ?? defaultCurrency,
                        PaymentMethod = "Payment",
                        InvoiceNumber = i.Number
                    }))
                .OrderBy(r => r.Date)
                .ToList();

            var allRows = paymentRows
                .Select(r => new ExportRow(r.Date, r.ClientName, r.AmountPaid, r.Currency, r.PaymentMethod, r.InvoiceNumber))
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

            var allRows = supplierRows
                .Concat(otherRows.Select(r => new { r.Date, r.Supplier, r.AmountPaid, r.Currency, r.Category, r.Reference }))
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
        // DATA IMPORT - VALIDATE (DRY RUN)
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

            var result = await ValidateRowsAsync(request.DataType, request.Rows, user.CompanyId, request.CustomCategories);
            return Ok(result);
        }

        /// <summary>
        /// Import validated data into core tables.
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
            var validation = await ValidateRowsAsync(request.DataType, request.Rows, companyId, request.CustomCategories);
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

                        var existingInvoices = invoiceNumbers.Count == 0
                            ? new List<Invoice>()
                            : await _context.Invoices
                                .Include(i => i.Payments)
                                .Include(i => i.InvoiceItems)
                                .Where(i => i.CompanyId == companyId && invoiceNumbers.Contains(i.Number))
                                .ToListAsync();

                        var invoiceLookup = existingInvoices
                            .Where(i => !string.IsNullOrWhiteSpace(i.Number))
                            .GroupBy(i => i.Number.Trim(), StringComparer.OrdinalIgnoreCase)
                            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

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
                            if (string.IsNullOrWhiteSpace(invoiceNumber)) { skipped++; continue; }

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

                            if (!invoiceLookup.TryGetValue(invoiceNumber, out var invoice))
                            {
                                invoice = new Invoice
                                {
                                    Number = invoiceNumber,
                                    Date = utcDate,
                                    Client = client,
                                    DueDate = utcDate,
                                    Category = ImportedCategory,
                                    Status = "Paid",
                                    Tfiscal = 0m,
                                    CompanyId = companyId,
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };

                                if (client.Id > 0)
                                    invoice.ClientId = client.Id;

                                invoice.InvoiceItems.Add(new InvoiceItem
                                {
                                    Description = ImportedRevenueLineDescription,
                                    Quantity = 1,
                                    Price = parsedAmount,
                                    Tva = false,
                                    VatRate = 0m
                                });
                                invoice.CalculTotalAmount();

                                invoice.Payments.Add(new Payment
                                {
                                    Amount = parsedAmount,
                                    PaymentDate = utcDate,
                                    Notes = string.IsNullOrWhiteSpace(paymentMethod)
                                        ? "Imported via Data Management"
                                        : $"Imported via Data Management ({paymentMethod})",
                                    Status = "Completed",
                                    CreatedByUserId = userId,
                                    ConfirmedByUserId = userId,
                                    ConfirmedAt = DateTime.UtcNow,
                                    CreatedAt = DateTime.UtcNow
                                });

                                _context.Invoices.Add(invoice);
                                invoiceLookup[invoiceNumber] = invoice;
                                imported++;
                                continue;
                            }

                            invoice.Date = utcDate;
                            invoice.DueDate ??= utcDate;
                            invoice.Client = client;
                            if (client.Id > 0)
                                invoice.ClientId = client.Id;
                            invoice.Category = ImportedCategory;
                            invoice.Status = "Paid";
                            invoice.Tfiscal = 0m;

                            invoice.InvoiceItems ??= new List<InvoiceItem>();
                            if (!invoice.InvoiceItems.Any())
                            {
                                invoice.InvoiceItems.Add(new InvoiceItem
                                {
                                    Description = ImportedRevenueLineDescription,
                                    Quantity = 1,
                                    Price = parsedAmount,
                                    Tva = false,
                                    VatRate = 0m
                                });
                            }
                            else if (invoice.InvoiceItems.Count == 1
                                && string.Equals(invoice.InvoiceItems.First().Description, ImportedRevenueLineDescription, StringComparison.OrdinalIgnoreCase))
                            {
                                var importedItem = invoice.InvoiceItems.First();
                                importedItem.Quantity = 1;
                                importedItem.Price = parsedAmount;
                                importedItem.Tva = false;
                                importedItem.VatRate = 0m;
                            }
                            invoice.CalculTotalAmount();

                            invoice.Payments ??= new List<Payment>();
                            var completedPaid = invoice.Payments
                                .Where(p => string.Equals(p.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                                .Sum(p => p.Amount);

                            if (completedPaid < parsedAmount)
                            {
                                var topUpAmount = parsedAmount - completedPaid;
                                invoice.Payments.Add(new Payment
                                {
                                    Amount = topUpAmount,
                                    PaymentDate = utcDate,
                                    Notes = string.IsNullOrWhiteSpace(paymentMethod)
                                        ? "Imported via Data Management"
                                        : $"Imported via Data Management ({paymentMethod})",
                                    Status = "Completed",
                                    CreatedByUserId = userId,
                                    ConfirmedByUserId = userId,
                                    ConfirmedAt = DateTime.UtcNow,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }

                            updated++;
                        }
                        break;
                    }

                    case "expenses":
                    {
                        var existingSuppliers = await _context.Suppliers
                            .Where(f => f.CompanyId == companyId)
                            .ToListAsync();

                        var supplierLookup = existingSuppliers
                            .GroupBy(f => f.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                        var invoiceNumberKeys = validation.ValidRows
                            .Select(r => SafeGet(r, "InvoiceNumber"))
                            .Where(n => !string.IsNullOrWhiteSpace(n))
                            .Select(n => n.Trim().ToLowerInvariant())
                            .Distinct()
                            .ToList();

                        var existingSupplierInvoices = invoiceNumberKeys.Count == 0
                            ? new List<SupplierInvoice>()
                            : await _context.SupplierInvoices
                                .Include(si => si.Payments)
                                .Where(si => si.CompanyId == companyId
                                    && invoiceNumberKeys.Contains((si.InvoiceNumber ?? "").ToLower()))
                                .ToListAsync();

                        var supplierInvoiceLookup = existingSupplierInvoices
                            .Where(si => !string.IsNullOrWhiteSpace(si.InvoiceNumber))
                            .GroupBy(si => si.InvoiceNumber.Trim(), StringComparer.OrdinalIgnoreCase)
                            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

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
                            var category = ImportedCategory;
                            var invNum = SafeGet(row, "InvoiceNumber");
                            if (string.IsNullOrWhiteSpace(invNum)) { skipped++; continue; }

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
                                supplierLookup[supplierName] = supplier;
                            }

                            if (!supplierInvoiceLookup.TryGetValue(invNum, out var supplierInvoice))
                            {
                                supplierInvoice = new SupplierInvoice
                                {
                                    FileName = $"import-{invNum}.csv",
                                    FilePath = "imports/data-management",
                                    FileType = "Import",
                                    Category = category,
                                    InvoiceNumber = invNum,
                                    InvoiceDate = utcDate,
                                    DueDate = utcDate,
                                    TotalHT = parsedAmount,
                                    TotalTTC = parsedAmount,
                                    TVA = 0m,
                                    ExtractionStatus = "Confirmed",
                                    ConfidenceScore = 1.0,
                                    Currency = currency,
                                    CurrencySymbol = currency,
                                    Supplier = supplier,
                                    CompanyId = companyId,
                                    UserId = userId,
                                    PaymentStatus = "Paid",
                                    CreatedAt = DateTime.UtcNow
                                };
                                if (supplier.Id > 0)
                                    supplierInvoice.SupplierId = supplier.Id;
                                
                                _context.SupplierInvoices.Add(supplierInvoice);
                                supplierInvoiceLookup[invNum] = supplierInvoice;
                                imported++;
                            }
                            else
                            {
                                supplierInvoice.Supplier = supplier;
                                if (supplier.Id > 0)
                                    supplierInvoice.SupplierId = supplier.Id;
                                supplierInvoice.InvoiceDate = utcDate;
                                supplierInvoice.DueDate = utcDate;
                                supplierInvoice.TotalHT = parsedAmount;
                                supplierInvoice.TotalTTC = parsedAmount;
                                supplierInvoice.TVA = 0m;
                                supplierInvoice.Category = category;
                                supplierInvoice.ExtractionStatus = "Confirmed";
                                supplierInvoice.Currency = currency;
                                supplierInvoice.CurrencySymbol = currency;
                                if (string.IsNullOrWhiteSpace(supplierInvoice.UserId))
                                    supplierInvoice.UserId = userId;
                                updated++;
                            }

                            supplierInvoice.Payments ??= new List<SupplierPayment>();
                            var completedPaid = supplierInvoice.Payments
                                .Where(p => string.Equals(p.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                                .Sum(p => p.Amount);

                            if (completedPaid < parsedAmount)
                            {
                                var topUpAmount = parsedAmount - completedPaid;
                                supplierInvoice.Payments.Add(new SupplierPayment
                                {
                                    Amount = topUpAmount,
                                    PaymentDate = utcDate,
                                    Notes = "Imported via Data Management",
                                    Status = "Completed",
                                    CreatedByUserId = userId,
                                    ConfirmedByUserId = userId,
                                    ConfirmedAt = DateTime.UtcNow,
                                    CreatedAt = DateTime.UtcNow
                                });
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
                                IsStockTracked = TryParseAmount(SafeGet(row, "Stock"), out var stockVal) && stockVal > 0,
                                CurrentStock = TryParseAmount(SafeGet(row, "Stock"), out var stockParsed) ? stockParsed : 0,
                                ReorderPoint = TryParseAmount(SafeGet(row, "Limit"), out var limitVal) ? limitVal : null,
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
                        // Import OtherExpense records directly into the core table.
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

                            var rawCategory = SafeGet(row, "Category");
                            var category = string.IsNullOrWhiteSpace(rawCategory)
                                ? ImportedCategory
                                : ExpensesController.NormalizeCategory(rawCategory);
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
                    "Data import: {Imported} new, {Updated} updated {Type} records, {Skipped} skipped, by user {User}",
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

                return StatusCode(500, new
                {
                    message = "Import failed. Check server logs for details."
                });
            }
        }

        /// <summary>
        /// Handles user choice for conflicts (Update vs Keep Original).
        /// </summary>
        [HttpPost("import/resolve-conflicts")]
        public async Task<IActionResult> ResolveConflicts([FromBody] ConflictResolutionRequest request)
        {
            if (request == null || request.Resolutions == null || request.Resolutions.Count == 0)
                return BadRequest(new { message = "No resolutions provided" });

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return Unauthorized();

            var companyId = user.CompanyId;
            var dataType = request.DataType?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(dataType))
                return BadRequest(new { message = "Data type is required" });

            var strategy = _context.Database.CreateExecutionStrategy();
            int updated = 0;
            int skipped = 0;
            int requestedUpdates = 0;
            int affectedRows = 0;

            try
            {
                await strategy.ExecuteAsync(async () =>
                {
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    var clientLookup = new Dictionary<string, Client>(StringComparer.OrdinalIgnoreCase);
                    var supplierLookup = new Dictionary<string, Supplier>(StringComparer.OrdinalIgnoreCase);

                    foreach (var resolution in request.Resolutions)
                    {
                        var choice = (resolution.Choice ?? string.Empty).Trim().ToLowerInvariant();
                        if (choice != "update")
                        {
                            skipped++;
                            continue;
                        }
                        requestedUpdates++;

                        var row = resolution.NewData ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        var didUpdate = false;

                        switch (dataType)
                        {
                            case "revenues":
                                {
                                    var invoiceNumber = SafeGet(row, "InvoiceNumber");
                                    var existing = await _context.Invoices
                                        .Include(i => i.Payments)
                                        .Include(i => i.InvoiceItems)
                                        .FirstOrDefaultAsync(i => i.Id == resolution.ExistingId && i.CompanyId == companyId);
                                    if (existing == null && !string.IsNullOrWhiteSpace(invoiceNumber))
                                    {
                                        existing = await _context.Invoices
                                            .Include(i => i.Payments)
                                            .Include(i => i.InvoiceItems)
                                            .Where(i => i.CompanyId == companyId && i.Number == invoiceNumber)
                                            .OrderByDescending(i => i.UpdatedAt ?? i.CreatedAt)
                                            .FirstOrDefaultAsync();
                                    }
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (revenues): existing record not found. ExistingId={ExistingId}, InvoiceNumber={InvoiceNumber}, CompanyId={CompanyId}",
                                            resolution.ExistingId, invoiceNumber, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    if (TryParseDate(SafeGet(row, "Date"), out var d)) existing.Date = d.ToUniversalTime();

                                    var clientName = SafeGet(row, "Client Name");
                                    if (!string.IsNullOrWhiteSpace(clientName))
                                    {
                                        if (!clientLookup.TryGetValue(clientName, out var client))
                                        {
                                            client = await _context.Clients
                                                .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Name == clientName);
                                            if (client == null)
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
                                            }
                                            clientLookup[clientName] = client;
                                        }

                                        existing.ClientId = client.Id > 0 ? client.Id : existing.ClientId;
                                    }

                                    var amountFromRow = 0m;
                                    var hasAmount = TryParseAmount(SafeGet(row, "Amount Paid"), out amountFromRow);
                                    var paymentMethod = SafeGet(row, "Payment Method");

                                    if (!string.IsNullOrWhiteSpace(invoiceNumber))
                                    {
                                        existing.Number = invoiceNumber;
                                    }

                                    existing.Category = ImportedCategory;
                                    existing.Status = "Paid";
                                    existing.Tfiscal = 0m;

                                    if (hasAmount)
                                    {
                                        existing.InvoiceItems ??= new List<InvoiceItem>();
                                        if (!existing.InvoiceItems.Any())
                                        {
                                            existing.InvoiceItems.Add(new InvoiceItem
                                            {
                                                Description = ImportedRevenueLineDescription,
                                                Quantity = 1,
                                                Price = amountFromRow,
                                                Tva = false,
                                                VatRate = 0m
                                            });
                                        }
                                        else if (existing.InvoiceItems.Count == 1
                                            && string.Equals(existing.InvoiceItems.First().Description, ImportedRevenueLineDescription, StringComparison.OrdinalIgnoreCase))
                                        {
                                            var importedItem = existing.InvoiceItems.First();
                                            importedItem.Quantity = 1;
                                            importedItem.Price = amountFromRow;
                                            importedItem.Tva = false;
                                            importedItem.VatRate = 0m;
                                        }

                                        existing.CalculTotalAmount();

                                        existing.Payments ??= new List<Payment>();
                                        var completedPaid = existing.Payments
                                            .Where(p => string.Equals(p.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                                            .Sum(p => p.Amount);
                                        if (completedPaid < amountFromRow)
                                        {
                                            existing.Payments.Add(new Payment
                                            {
                                                Amount = amountFromRow - completedPaid,
                                                PaymentDate = existing.Date,
                                                Notes = string.IsNullOrWhiteSpace(paymentMethod)
                                                    ? "Imported via Data Management"
                                                    : $"Imported via Data Management ({paymentMethod})",
                                                Status = "Completed",
                                                CreatedByUserId = userId,
                                                ConfirmedByUserId = userId,
                                                ConfirmedAt = DateTime.UtcNow,
                                                CreatedAt = DateTime.UtcNow
                                            });
                                        }
                                    }

                                    existing.UpdatedAt = DateTime.UtcNow;
                                    _context.Invoices.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            case "expenses":
                                {
                                    var invoiceNumber = SafeGet(row, "InvoiceNumber");
                                    var existing = await _context.SupplierInvoices
                                        .Include(si => si.Payments)
                                        .FirstOrDefaultAsync(si => si.Id == resolution.ExistingId && si.CompanyId == companyId);
                                    if (existing == null && !string.IsNullOrWhiteSpace(invoiceNumber))
                                    {
                                        existing = await _context.SupplierInvoices
                                            .Include(si => si.Payments)
                                            .Where(si => si.CompanyId == companyId && si.InvoiceNumber == invoiceNumber)
                                            .OrderByDescending(si => si.CreatedAt)
                                            .FirstOrDefaultAsync();
                                    }
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (expenses): existing record not found. ExistingId={ExistingId}, InvoiceNumber={InvoiceNumber}, CompanyId={CompanyId}",
                                            resolution.ExistingId, invoiceNumber, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    if (TryParseDate(SafeGet(row, "Date"), out var d))
                                    {
                                        existing.InvoiceDate = d.ToUniversalTime();
                                        existing.DueDate = existing.InvoiceDate;
                                    }

                                    var supplierName = SafeGet(row, "Supplier");
                                    if (!string.IsNullOrWhiteSpace(supplierName))
                                    {
                                        if (!supplierLookup.TryGetValue(supplierName, out var supplier))
                                        {
                                            supplier = await _context.Suppliers
                                                .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Name == supplierName);
                                            if (supplier == null)
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
                                            }
                                            supplierLookup[supplierName] = supplier;
                                        }

                                        if (supplier.Id > 0)
                                            existing.SupplierId = supplier.Id;
                                    }

                                    decimal? importedAmount = null;
                                    if (TryParseAmount(SafeGet(row, "Amount Paid"), out var amt))
                                    {
                                        importedAmount = amt;
                                        existing.TotalHT = amt;
                                        existing.TotalTTC = amt;
                                        existing.TVA = 0m;
                                    }

                                    var currency = CurrencyHelper.NormalizeCurrency(SafeGet(row, "Currency", existing.Currency ?? "TND"));
                                    existing.Currency = string.IsNullOrWhiteSpace(currency) ? (existing.Currency ?? "TND") : currency;
                                    existing.CurrencySymbol = existing.Currency;
                                    existing.Category = ImportedCategory;
                                    existing.ExtractionStatus = "Confirmed";
                                    if (!string.IsNullOrWhiteSpace(invoiceNumber))
                                        existing.InvoiceNumber = invoiceNumber;
                                    if (TryParseDate(SafeGet(row, "Date"), out var date))
                                    {
                                        existing.InvoiceDate = date.ToUniversalTime();
                                        existing.DueDate = existing.InvoiceDate;
                                    }

                                    if (importedAmount.HasValue && importedAmount.Value > 0)
                                    {
                                        existing.Payments ??= new List<SupplierPayment>();
                                        var completedPaid = existing.Payments
                                            .Where(p => string.Equals(p.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                                            .Sum(p => p.Amount);
                                        if (completedPaid < importedAmount.Value)
                                        {
                                            existing.Payments.Add(new SupplierPayment
                                            {
                                                Amount = importedAmount.Value - completedPaid,
                                                PaymentDate = existing.InvoiceDate ?? DateTime.UtcNow,
                                                Notes = "Imported via Data Management",
                                                Status = "Completed",
                                                CreatedByUserId = userId,
                                                ConfirmedByUserId = userId,
                                                ConfirmedAt = DateTime.UtcNow,
                                                CreatedAt = DateTime.UtcNow
                                            });
                                        }
                                    }

                                    _context.SupplierInvoices.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            case "clients":
                                {
                                    var existing = await _context.Clients
                                        .FirstOrDefaultAsync(c => c.Id == resolution.ExistingId && c.CompanyId == companyId);
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (clients): existing record not found. ExistingId={ExistingId}, CompanyId={CompanyId}",
                                            resolution.ExistingId, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    var name = SafeGet(row, "Name");
                                    if (!string.IsNullOrWhiteSpace(name)) existing.Name = name;
                                    var address = SafeGet(row, "Address");
                                    if (!string.IsNullOrWhiteSpace(address)) existing.Address = address;
                                    var phone = SafeGet(row, "Phone Number");
                                    if (!string.IsNullOrWhiteSpace(phone)) existing.Phone = phone;
                                    var taxId = SafeGet(row, "Matricule Fiscal");
                                    if (!string.IsNullOrWhiteSpace(taxId)) existing.TaxId = taxId;
                                    var email = SafeGet(row, "Email");
                                    if (!string.IsNullOrWhiteSpace(email)) existing.Email = email;
                                    existing.UpdatedAt = DateTime.UtcNow;
                                    _context.Clients.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            case "suppliers":
                                {
                                    var existing = await _context.Suppliers
                                        .FirstOrDefaultAsync(s => s.Id == resolution.ExistingId && s.CompanyId == companyId);
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (suppliers): existing record not found. ExistingId={ExistingId}, CompanyId={CompanyId}",
                                            resolution.ExistingId, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    var name = SafeGet(row, "Name");
                                    if (!string.IsNullOrWhiteSpace(name)) existing.Name = name;
                                    var address = SafeGet(row, "Address");
                                    if (!string.IsNullOrWhiteSpace(address)) existing.Address = address;
                                    var phone = SafeGet(row, "Phone Number");
                                    if (!string.IsNullOrWhiteSpace(phone)) existing.Phone = phone;
                                    var taxId = SafeGet(row, "Matricule Fiscal");
                                    if (!string.IsNullOrWhiteSpace(taxId)) existing.TaxId = taxId;
                                    existing.UpdatedAt = DateTime.UtcNow;
                                    _context.Suppliers.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            case "products":
                                {
                                    var existing = await _context.ProductServices
                                        .FirstOrDefaultAsync(p => p.Id == resolution.ExistingId && p.CompanyId == companyId);
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (products): existing record not found. ExistingId={ExistingId}, CompanyId={CompanyId}",
                                            resolution.ExistingId, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    var name = SafeGet(row, "Name");
                                    if (!string.IsNullOrWhiteSpace(name)) existing.Name = name;
                                    if (TryParseAmount(SafeGet(row, "Price"), out var price)) existing.DefaultUnitPrice = price;
                                    if (TryParseAmount(SafeGet(row, "TVA Rate"), out var tva)) existing.TvaRate = tva;
                                    existing.Description = SafeGet(row, "Description");
                                    if (TryParseAmount(SafeGet(row, "Stock"), out var stock))
                                    {
                                        existing.CurrentStock = stock;
                                        existing.IsStockTracked = stock > 0;
                                    }
                                    if (TryParseAmount(SafeGet(row, "Limit"), out var limit))
                                    {
                                        existing.ReorderPoint = limit;
                                    }
                                    existing.UpdatedAt = DateTime.UtcNow;
                                    _context.ProductServices.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            case "otherexpenses":
                                {
                                    var existing = await _context.OtherExpenses
                                        .FirstOrDefaultAsync(e => e.Id == resolution.ExistingId && e.CompanyId == companyId);
                                    if (existing == null)
                                    {
                                        var amountProbeRaw = SafeGet(row, "Amount");
                                        if (string.IsNullOrWhiteSpace(amountProbeRaw))
                                            amountProbeRaw = SafeGet(row, "Amount Paid");

                                        var descProbe = SafeGet(row, "Description");
                                        if (TryParseDate(SafeGet(row, "Date"), out var dateProbe)
                                            && TryParseAmount(amountProbeRaw, out var amountProbe)
                                            && !string.IsNullOrWhiteSpace(descProbe))
                                        {
                                            var utcProbe = DateTime.SpecifyKind(dateProbe, DateTimeKind.Utc);
                                            existing = await _context.OtherExpenses
                                                .Where(e => e.CompanyId == companyId
                                                            && e.Date.Date == utcProbe.Date
                                                            && e.Amount == amountProbe
                                                            && e.Description == descProbe)
                                                .OrderByDescending(e => e.UpdatedAt ?? e.CreatedAt)
                                                .FirstOrDefaultAsync();
                                        }
                                    }
                                    if (existing == null)
                                    {
                                        _logger.LogWarning(
                                            "Conflict update skipped (otherexpenses): existing record not found. ExistingId={ExistingId}, CompanyId={CompanyId}",
                                            resolution.ExistingId, companyId);
                                        skipped++;
                                        continue;
                                    }

                                    if (TryParseDate(SafeGet(row, "Date"), out var d))
                                        existing.Date = DateTime.SpecifyKind(d, DateTimeKind.Utc);

                                    var description = SafeGet(row, "Description");
                                    if (!string.IsNullOrWhiteSpace(description))
                                        existing.Description = description;

                                    var amountRaw = SafeGet(row, "Amount");
                                    if (string.IsNullOrWhiteSpace(amountRaw))
                                        amountRaw = SafeGet(row, "Amount Paid");
                                    if (TryParseAmount(amountRaw, out var amt))
                                        existing.Amount = amt;

                                    var rawCat = SafeGet(row, "Category");
                                    existing.Category = string.IsNullOrWhiteSpace(rawCat)
                                        ? ImportedCategory
                                        : ExpensesController.NormalizeCategory(rawCat);
                                    var currency = ExpensesController.NormalizeCurrency(SafeGet(row, "Currency", existing.Currency ?? "TND"));
                                    existing.Currency = string.IsNullOrWhiteSpace(currency) ? "TND" : currency;
                                    existing.CurrencySymbol = existing.Currency;

                                    var notes = SafeGet(row, "Notes");
                                    existing.Notes = string.IsNullOrWhiteSpace(notes) ? null : notes;

                                    var recurring = SafeGet(row, "Recurring");
                                    if (!string.IsNullOrWhiteSpace(recurring))
                                    {
                                        existing.IsRecurring = recurring.Equals("yes", StringComparison.OrdinalIgnoreCase)
                                            || recurring.Equals("true", StringComparison.OrdinalIgnoreCase)
                                            || recurring == "1";
                                    }

                                    existing.UpdatedAt = DateTime.UtcNow;
                                    _context.OtherExpenses.Update(existing);
                                    didUpdate = true;
                                }
                                break;

                            default:
                                skipped++;
                                continue;
                        }

                        if (didUpdate)
                            updated++;
                        else
                            skipped++;
                    }

                    affectedRows = await _context.SaveChangesAsync();
                    if (requestedUpdates > 0 && affectedRows == 0)
                    {
                        throw new InvalidOperationException(
                            $"Conflict resolution requested {requestedUpdates} updates but no database rows were written.");
                    }
                    await transaction.CommitAsync();
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving conflicts for {Type}", request.DataType);
                return StatusCode(500, new { message = "Failed to resolve conflicts" });
            }

            if (affectedRows > 0)
            {
                var successLog =
                    $"[ConflictResolution] DB write confirmed for {dataType}. affectedRows={affectedRows}, requestedUpdates={requestedUpdates}, updated={updated}, skipped={skipped}.";
                _logger.LogInformation(successLog);
                Console.WriteLine(successLog);
            }

            return Ok(new
            {
                success = true,
                updated,
                skipped,
                affectedRows,
                message = $"Conflict resolution completed: {updated} updated, {skipped} skipped."
            });
        }

        /// <summary>
        /// Get imported data summary from core tables.
        /// </summary>
        [HttpGet("import/summary")]
        public async Task<IActionResult> GetImportSummary()
        {
            var importedRevenues = await _context.Invoices.CountAsync(i => i.Category == ImportedCategory);
            var importedExpenses = await _context.SupplierInvoices.CountAsync(si => si.Category == ImportedCategory);
            var importedOtherExpenses = await _context.OtherExpenses.CountAsync(e => e.Category == ImportedCategory);

            return Ok(new
            {
                importedRevenues,
                importedExpenses,
                importedOtherExpenses,
                totalImported = importedRevenues + importedExpenses + importedOtherExpenses
            });
        }

        // ═══════════════════════════════════════════════════════════
        // CSV TEMPLATE DOWNLOAD
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/DataManagement/template/{type}
        /// Returns a semicolon-separated CSV file with the correct headers + one example row.
        /// CRITICAL: Uses ';' separator to match our MiniExcel/CSV parser configuration.
        /// Supports 'lang' query parameter (en, fr, ar, de).
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
                        exampleRow = "31/10/2024;Nom du Client;1500,50;TND;Virement bancaire;FA26-001";
                    }
                    else if (lang == "ar")
                    {
                        headers = "التاريخ;اسم العميل;المبلغ المدفوع;العملة;طريقة الدفع;رقم الفاتورة";
                        exampleRow = "31/10/2024;اسم العميل;1500,50;TND;تحويل بنكي;FA26-001";
                    }
                    else if (lang == "de")
                    {
                        headers = "Datum;Kundenname;Gezahlter Betrag;Währung;Zahlungsmethode;Rechnungsnummer";
                        exampleRow = "31.10.2024;Kundenname;1500,50;TND;Banküberweisung;FA26-001";
                    }
                    else
                    {
                        headers = "Date;Client Name;Amount Paid;Currency;Payment Method;InvoiceNumber";
                        exampleRow = "31/10/2024;Client Name;1500,50;TND;Bank Transfer;FA26-001";
                    }
                    break;

                case "expenses":
                    if (lang == "fr")
                    {
                        headers = "Date;Fournisseur;Montant Payé;Devise;Catégorie;Numéro de facture";
                        exampleRow = "31/10/2024;Nom du Fournisseur;500,00;TND;Fournitures de bureau;SUP-2024-001";
                    }
                    else if (lang == "ar")
                    {
                        headers = "التاريخ;المزود;المبلغ المدفوع;العملة;الفئة;رقم الفاتورة";
                        exampleRow = "31/10/2024;اسم المزود;500,00;TND;لوازم مكتبية;SUP-2024-001";
                    }
                    else if (lang == "de")
                    {
                        headers = "Datum;Lieferant;Gezahlter Betrag;Währung;Kategorie;Rechnungsnummer";
                        exampleRow = "31.10.2024;Lieferantenname;500,00;TND;Büromaterial;SUP-2024-001";
                    }
                    else
                    {
                        headers = "Date;Supplier;Amount Paid;Currency;Category;InvoiceNumber";
                        exampleRow = "31/10/2024;Supplier Name;500,00;TND;Office Supplies;SUP-2024-001";
                    }
                    break;

                case "clients":
                    if (lang == "fr")
                    {
                        headers = "Nom;Matricule Fiscal;Téléphone;Adresse;Email";
                        exampleRow = "Nom du Client;MF123456;+21699123456;Tunis;client@email.com";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;المعرف الجبائي;الهاتف;العنوان;البريد الإلكتروني";
                        exampleRow = "اسم العميل;MF123456;+21699123456;تونس;client@email.com";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Steuernummer;Telefon;Adresse;E-Mail";
                        exampleRow = "Kundenname;MF123456;+21699123456;Berlin;client@email.com";
                    }
                    else
                    {
                        headers = "Name;Matricule Fiscal;Phone Number;Address;Email";
                        exampleRow = "Client Name;MF123456;+21699123456;Tunis;client@email.com";
                    }
                    break;

                case "suppliers":
                    if (lang == "fr")
                    {
                        headers = "Nom;Matricule Fiscal;Téléphone;Adresse";
                        exampleRow = "Nom du Fournisseur;MF654321;+21699654321;Tunis";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;المعرف الجبائي;الهاتف;العنوان";
                        exampleRow = "اسم المزود;MF654321;+21699654321;تونس";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Steuernummer;Telefon;Adresse";
                        exampleRow = "Lieferantenname;MF654321;+21699654321;Berlin";
                    }
                    else
                    {
                        headers = "Name;Matricule Fiscal;Phone Number;Address";
                        exampleRow = "Supplier Name;MF654321;+21699654321;Tunis";
                    }
                    break;

                case "products":
                    if (lang == "fr")
                    {
                        headers = "Nom;Description;Prix;Devise;Taux TVA;Stock;Limite";
                        exampleRow = "Nom du Produit;Abonnement annuel;100,00;TND;19;50;10";
                    }
                    else if (lang == "ar")
                    {
                        headers = "الاسم;الوصف;السعر;العملة;نسبة الأداء;المخزون;الحد";
                        exampleRow = "اسم المنتج;اشتراك سنوي;100,00;TND;19;50;10";
                    }
                    else if (lang == "de")
                    {
                        headers = "Name;Beschreibung;Preis;Währung;USt-Satz;Bestand;Limit";
                        exampleRow = "Produktname;Jahresabonnement;100,00;TND;19;50;10";
                    }
                    else
                    {
                        headers = "Name;Description;Price;Currency;TVA Rate;Stock;Limit";
                        exampleRow = "Product Name;Annual subscription;100,00;TND;19;50;10";
                    }
                    break;

                case "otherexpenses":
                    if (lang == "fr")
                    {
                        headers = "Date;Description;Montant;Catégorie;Devise;Notes;Récurrent";
                        exampleRow = "31/01/2025;Fournitures bureau;150,00;office;TND;Papeterie mensuelle;Non";
                    }
                    else if (lang == "ar")
                    {
                        headers = "التاريخ;الوصف;المبلغ;الفئة;العملة;ملاحظات;متكرر";
                        exampleRow = "31/01/2025;لوازم مكتبية;150,00;office;TND;قرطاسية شهرية;لا";
                    }
                    else if (lang == "de")
                    {
                        headers = "Datum;Beschreibung;Betrag;Kategorie;Währung;Notizen;Wiederkehrend";
                        exampleRow = "31.01.2025;Büromaterial;150,00;office;TND;Monatliche Schreibwaren;Nein";
                    }
                    else
                    {
                        headers = "Date;Description;Amount;Category;Currency;Notes;Recurring";
                        exampleRow = "31/01/2025;Office Supplies;150,00;office;TND;Monthly stationery;No";
                    }
                    break;

                default:
                    return BadRequest(new { message = $"Unknown template type: {type}" });
            }

            // Category is hardcoded as "imported" during backend import mapping for expenses.
            // Keep localized templates but remove category columns for expense import files.
            // Note: otherExpenses KEEPS the Category column so users can specify it.
            if (type.Equals("expenses", StringComparison.OrdinalIgnoreCase))
            {
                headers = RemoveSemicolonColumn(headers, 4);
                exampleRow = RemoveSemicolonColumn(exampleRow, 4);
            }

            // BOM + semicolon-separated CSV
            var csv = $"{headers}\n{exampleRow}\n";
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();

            return File(bytes, "text/csv; charset=utf-8", $"{type}_template_{lang}.csv");
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

        private static string RemoveSemicolonColumn(string line, int columnIndex)
        {
            if (string.IsNullOrWhiteSpace(line) || columnIndex < 0)
                return line;

            var columns = line.Split(';').ToList();
            if (columnIndex >= columns.Count)
                return line;

            columns.RemoveAt(columnIndex);
            return string.Join(';', columns);
        }

        private async Task<ValidationResult> ValidateRowsAsync(string dataType, List<Dictionary<string, string>> rows, int companyId, List<string>? customCategories = null)
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
                    requiredColumns = new[] { "Date", "Supplier", "Amount Paid", "Currency", "InvoiceNumber" };
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
                    requiredColumns = new[] { "Date", "Description", "Amount", "Category" };
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

                // Prefer source row metadata when available so reported row numbers stay exact.
                var rowNum = i + 2;
                if (int.TryParse(SafeGet(row, "__SourceRowNumber"), out var sourceRowNum) && sourceRowNum > 0)
                    rowNum = sourceRowNum;
                else if (int.TryParse(SafeGet(row, "__RowNumber"), out var existingRowNum) && existingRowNum > 0)
                    rowNum = existingRowNum;
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

                    // String length checks for Revenues and Expenses
                    if (dataType.ToLower() == "revenues")
                    {
                        var invNum = SafeGet(row, "InvoiceNumber");
                        if (!string.IsNullOrWhiteSpace(invNum) && invNum.Length > 100) rowErrors.Add("'InvoiceNumber' cannot exceed 100 characters");

                        var clientName = SafeGet(row, "Client Name");
                        if (!string.IsNullOrWhiteSpace(clientName) && clientName.Length > 200) rowErrors.Add("'Client Name' cannot exceed 200 characters");

                        var reference = SafeGet(row, "Reference");
                        if (!string.IsNullOrWhiteSpace(reference) && reference.Length > 200) rowErrors.Add("'Reference' cannot exceed 200 characters");

                        var payMethod = SafeGet(row, "Payment Method");
                        if (!string.IsNullOrWhiteSpace(payMethod) && payMethod.Length > 100) rowErrors.Add("'Payment Method' cannot exceed 100 characters");
                    }
                    else if (dataType.ToLower() == "expenses")
                    {
                        var invNum = SafeGet(row, "InvoiceNumber");
                        if (!string.IsNullOrWhiteSpace(invNum) && invNum.Length > 100) rowErrors.Add("'InvoiceNumber' cannot exceed 100 characters");

                        var supplierName = SafeGet(row, "Supplier");
                        if (!string.IsNullOrWhiteSpace(supplierName) && supplierName.Length > 200) rowErrors.Add("'Supplier' name cannot exceed 200 characters");

                        var reference = SafeGet(row, "Reference");
                        if (!string.IsNullOrWhiteSpace(reference) && reference.Length > 200) rowErrors.Add("'Reference' cannot exceed 200 characters");

                        var category = SafeGet(row, "Category");
                        if (!string.IsNullOrWhiteSpace(category) && category.Length > 50) rowErrors.Add("'Category' cannot exceed 50 characters");
                    }
                    // otherExpenses: validate Category against known built-in + custom categories
                    if (dataType.ToLower() == "otherexpenses")
                    {
                        var catRaw = SafeGet(row, "Category");
                        if (!string.IsNullOrWhiteSpace(catRaw))
                        {
                            var normalized = ExpensesController.NormalizeCategory(catRaw);
                            var validKeys = ExpensesController.GetValidCategoryKeys();
                            var isBuiltIn = validKeys.Contains(normalized);
                            var isCustom = customCategories != null && customCategories.Contains(normalized, StringComparer.OrdinalIgnoreCase);
                            if (validKeys.Count > 0 && !isBuiltIn && !isCustom)
                            {
                                rowErrors.Add($"Unknown category '{catRaw}'. Please add this category in the Expenses page before importing.");
                            }
                            else
                            {
                                // Store normalized value back so ConfirmImport gets the canonical key
                                row["Category"] = normalized;
                            }
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

                if (dataType.ToLower() == "clients" || dataType.ToLower() == "suppliers")
                {
                    var name = SafeGet(row, "Name");
                    if (!string.IsNullOrWhiteSpace(name) && name.Length > 200) rowErrors.Add("'Name' cannot exceed 200 characters");

                    var taxId = SafeGet(row, "Matricule Fiscal");
                    if (!string.IsNullOrWhiteSpace(taxId) && taxId.Length > 100) rowErrors.Add("'Matricule Fiscal' cannot exceed 100 characters");

                    var phone = SafeGet(row, "Phone Number");
                    if (!string.IsNullOrWhiteSpace(phone) && phone.Length > 50) rowErrors.Add("'Phone Number' cannot exceed 50 characters");

                    var address = SafeGet(row, "Address");
                    if (!string.IsNullOrWhiteSpace(address) && address.Length > 500) rowErrors.Add("'Address' cannot exceed 500 characters");
                    
                    if (dataType.ToLower() == "clients")
                    {
                        var email = SafeGet(row, "Email");
                        if (!string.IsNullOrWhiteSpace(email) && email.Length > 200) rowErrors.Add("'Email' cannot exceed 200 characters");
                    }
                }

                if (dataType.ToLower() == "products")
                {
                    var name = SafeGet(row, "Name");
                    if (!string.IsNullOrWhiteSpace(name) && name.Length > 200) rowErrors.Add("'Name' cannot exceed 200 characters");

                    var description = SafeGet(row, "Description");
                    if (!string.IsNullOrWhiteSpace(description) && description.Length > 500) rowErrors.Add("'Description' cannot exceed 500 characters");

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

            if (validRows.Count > 0)
            {
                var conflicts = new List<ImportConflict>();

                if (dataType.ToLower() == "revenues")
                {
                    var invoiceNumbers = validRows
                        .Select(r => SafeGet(r, "InvoiceNumber"))
                        .Where(n => !string.IsNullOrWhiteSpace(n))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    var existingInvoices = await _context.Invoices
                        .AsNoTracking()
                        .Include(i => i.Client)
                        .Include(i => i.Quotes)
                        .Include(i => i.Payments)
                        .Where(i => i.CompanyId == companyId && invoiceNumbers.Contains(i.Number))
                        .ToListAsync();

                    var invoiceLookup = existingInvoices
                        .GroupBy(i => i.Number, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt).First(), StringComparer.OrdinalIgnoreCase);

                    foreach (var row in validRows)
                    {
                        var invNum = SafeGet(row, "InvoiceNumber");
                        if (invoiceLookup.TryGetValue(invNum, out var existing))
                        {
                            var amountPaid = existing.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0m;
                            var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var parsedSourceRow) ? parsedSourceRow : 0;
                            conflicts.Add(new ImportConflict
                            {
                                Identifier = invNum,
                                ExistingId = existing.Id,
                                ExistingData = new Dictionary<string, string>
                                {
                                    { "Date", existing.Date.ToString("yyyy-MM-dd") },
                                    { "Client Name", existing.Client?.Name ?? "" },
                                    { "Amount Paid", amountPaid.ToString(CultureInfo.InvariantCulture) },
                                    { "Currency", existing.Quotes.FirstOrDefault()?.Currency ?? "" },
                                    { "Payment Method", "" }
                                },
                                NewData = new Dictionary<string, string>(row),
                                RowIndex = sourceRow
                            });
                        }
                    }
                }
                else if (dataType.ToLower() == "clients" || dataType.ToLower() == "suppliers")
                {
                    var names = validRows.Select(r => SafeGet(r, "Name")).Where(n => !string.IsNullOrWhiteSpace(n)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    
                    if (dataType.ToLower() == "clients")
                    {
                        var existingClients = await _context.Clients
                            .Where(c => c.CompanyId == companyId && names.Contains(c.Name))
                            .ToDictionaryAsync(c => c.Name, c => c, StringComparer.OrdinalIgnoreCase);

                        foreach (var row in validRows)
                        {
                            var name = SafeGet(row, "Name");
                            if (existingClients.TryGetValue(name, out var existing))
                            {
                                var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var pr) ? pr : 0;
                                conflicts.Add(new ImportConflict
                                {
                                    Identifier = name,
                                    ExistingId = existing.Id,
                                    ExistingData = new Dictionary<string, string>
                                    {
                                        { "Name", existing.Name },
                                        { "Address", existing.Address ?? "" },
                                        { "Phone Number", existing.Phone ?? "" },
                                        { "Matricule Fiscal", existing.TaxId ?? "" }
                                    },
                                    NewData = new Dictionary<string, string>(row),
                                    RowIndex = sourceRow
                                });
                            }
                        }
                    }
                    else
                    {
                        var existingSuppliers = await _context.Suppliers
                            .Where(s => s.CompanyId == companyId && names.Contains(s.Name))
                            .ToDictionaryAsync(s => s.Name, s => s, StringComparer.OrdinalIgnoreCase);

                        foreach (var row in validRows)
                        {
                            var name = SafeGet(row, "Name");
                            if (existingSuppliers.TryGetValue(name, out var existing))
                            {
                                var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var pr) ? pr : 0;
                                conflicts.Add(new ImportConflict
                                {
                                    Identifier = name,
                                    ExistingId = existing.Id,
                                    ExistingData = new Dictionary<string, string>
                                    {
                                        { "Name", existing.Name },
                                        { "Address", existing.Address ?? "" },
                                        { "Phone Number", existing.Phone ?? "" },
                                        { "Matricule Fiscal", existing.TaxId ?? "" }
                                    },
                                    NewData = new Dictionary<string, string>(row),
                                    RowIndex = sourceRow
                                });
                            }
                        }
                    }
                }
                else if (dataType.ToLower() == "products")
                {
                    var names = validRows.Select(r => SafeGet(r, "Name")).Where(n => !string.IsNullOrWhiteSpace(n)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var existingProducts = await _context.ProductServices
                        .Where(p => p.CompanyId == companyId && names.Contains(p.Name))
                        .ToDictionaryAsync(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);

                    foreach (var row in validRows)
                    {
                        var name = SafeGet(row, "Name");
                        if (existingProducts.TryGetValue(name, out var existing))
                        {
                            var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var pr) ? pr : 0;
                            conflicts.Add(new ImportConflict
                            {
                                Identifier = name,
                                ExistingId = existing.Id,
                                ExistingData = new Dictionary<string, string>
                                {
                                    { "Name", existing.Name },
                                    { "Price", existing.DefaultUnitPrice.ToString(CultureInfo.InvariantCulture) },
                                    { "TVA Rate", existing.TvaRate.ToString(CultureInfo.InvariantCulture) }
                                },
                                NewData = new Dictionary<string, string>(row),
                                RowIndex = sourceRow
                            });
                        }
                    }
                }
                else if (dataType.ToLower() == "expenses")
                {
                    var invNums = validRows.Select(r => SafeGet(r, "InvoiceNumber")).Where(n => !string.IsNullOrWhiteSpace(n)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var existingExpenses = await _context.SupplierInvoices
                        .AsNoTracking()
                        .Include(e => e.Supplier)
                        .Include(e => e.Payments)
                        .Where(e => e.CompanyId == companyId && invNums.Contains(e.InvoiceNumber ?? ""))
                        .ToDictionaryAsync(e => e.InvoiceNumber ?? "", e => e, StringComparer.OrdinalIgnoreCase);

                    foreach (var row in validRows)
                    {
                        var invNum = SafeGet(row, "InvoiceNumber");
                        if (existingExpenses.TryGetValue(invNum, out var existing))
                        {
                            var amountPaid = existing.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0m;
                            var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var pr) ? pr : 0;
                            conflicts.Add(new ImportConflict
                            {
                                Identifier = invNum,
                                ExistingId = existing.Id,
                                ExistingData = new Dictionary<string, string>
                                {
                                    { "Date", (existing.InvoiceDate ?? existing.CreatedAt).ToString("yyyy-MM-dd") },
                                    { "Supplier", existing.Supplier?.Name ?? "" },
                                    { "Amount Paid", amountPaid.ToString(CultureInfo.InvariantCulture) },
                                    { "Currency", existing.Currency ?? "TND" },
                                    { "InvoiceNumber", existing.InvoiceNumber ?? "" }
                                },
                                NewData = new Dictionary<string, string>(row),
                                RowIndex = sourceRow
                            });
                        }
                    }
                }
                else if (dataType.ToLower() == "otherexpenses")
                {
                    foreach (var row in validRows)
                    {
                        if (TryParseDate(SafeGet(row, "Date"), out var d) && TryParseAmount(SafeGet(row, "Amount"), out var amt))
                        {
                            var utcDate = d.ToUniversalTime();
                            var desc = SafeGet(row, "Description");
                            var existing = await _context.OtherExpenses
                                .Where(e => e.CompanyId == companyId && e.Date.Date == utcDate.Date && e.Amount == amt && e.Description == desc)
                                .OrderByDescending(e => e.UpdatedAt ?? e.CreatedAt)
                                .FirstOrDefaultAsync();

                            if (existing != null)
                            {
                                var sourceRow = int.TryParse(SafeGet(row, "__RowNumber"), out var pr) ? pr : 0;
                                conflicts.Add(new ImportConflict
                                {
                                    Identifier = $"{desc} / {d:yyyy-MM-dd} / {amt}",
                                    ExistingId = existing.Id,
                                    ExistingData = new Dictionary<string, string>
                                    {
                                        { "Date", existing.Date.ToString("yyyy-MM-dd") },
                                        { "Description", existing.Description },
                                        { "Amount", existing.Amount.ToString(CultureInfo.InvariantCulture) },
                                        { "Category", existing.Category ?? "" }
                                    },
                                    NewData = new Dictionary<string, string>(row),
                                    RowIndex = sourceRow
                                });
                            }
                        }
                    }
                }
                return new ValidationResult(errors, validRows, conflicts);
            }

            return new ValidationResult(errors, validRows);
        }

        /// <summary>
        /// Common column aliases → canonical name mapping.
        /// Users may have slightly different header names in their CSV/Excel files.
        /// </summary>
        private static readonly Dictionary<string, string> ColumnAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            // Revenue aliases
            { "Payment", "Payment Method" },
            { "Method", "Payment Method" },
            { "Paiement", "Payment Method" },        // French
            { "Mode de paiement", "Payment Method" }, // French
            { "طريقة الدفع", "Payment Method" },      // Arabic
            { "Zahlungsmethode", "Payment Method" }, // German
            { "Client", "Client Name" },
            { "Nom Client", "Client Name" },          // French
            { "اسم العميل", "Client Name" },          // Arabic
            { "Kundenname", "Client Name" },          // German
            { "Montant", "Amount Paid" },
            { "Montant Payé", "Amount Paid" },        // French
            { "المبلغ المدفوع", "Amount Paid" },      // Arabic
            { "Gezahlter Betrag", "Amount Paid" },    // German
            { "Amount", "Amount Paid" },
            { "Devise", "Currency" },                 // French
            { "العملة", "Currency" },                 // Arabic
            { "Währung", "Currency" },                // German
            { "Invoice Number", "InvoiceNumber" },
            { "InvoiceNumber", "InvoiceNumber" },
            { "Invoice No", "InvoiceNumber" },
            { "Ref", "InvoiceNumber" },
            { "Référence", "InvoiceNumber" },         // French
            { "رقم الفاتورة", "InvoiceNumber" },      // Arabic
            { "Rechnungsnummer", "InvoiceNumber" },    // German
            { "Numéro de facture", "InvoiceNumber" }, // French
            // Expense aliases
            { "Fournisseur", "Supplier" },            // French
            { "Supplier Name", "Supplier" },
            { "المزود", "Supplier" },                 // Arabic
            { "Lieferant", "Supplier" },              // German
            { "Catégorie", "Category" },              // French
            { "الفئة", "Category" },                  // Arabic
            { "Kategorie", "Category" },              // German
            // Client aliases
            { "Nom", "Name" },                        // French
            { "الاسم", "Name" },                      // Arabic
            { "Téléphone", "Phone Number" },          // French
            { "Phone", "Phone Number" },
            { "Tel", "Phone Number" },
            { "الهاتف", "Phone Number" },             // Arabic
            { "Telefon", "Phone Number" },            // German
            { "Adresse", "Address" },                 // French
            { "العنوان", "Address" },                 // Arabic
            { "Matricule", "Matricule Fiscal" },
            { "المعرف الجبائي", "Matricule Fiscal" }, // Arabic
            { "Steuernummer", "Matricule Fiscal" },   // German
            { "البريد الإلكتروني", "Email" },         // Arabic
            { "E-Mail", "Email" },                    // German
            // Product aliases
            { "Prix", "Price" },                      // French
            { "السعر", "Price" },                     // Arabic
            { "Preis", "Price" },                     // German
            { "Taux TVA", "TVA Rate" },               // French
            { "TVA", "TVA Rate" },
            { "VAT Rate", "TVA Rate" },
            { "VAT", "TVA Rate" },
            { "نسبة الأداء", "TVA Rate" },            // Arabic
            { "USt-Satz", "TVA Rate" },               // German
            { "الوصف", "Description" },               // Arabic
            // Other Expenses
            { "Récurrent", "Recurring" },             // French
            { "متكرر", "Recurring" },                 // Arabic
            { "Wiederkehrend", "Recurring" },         // German
            { "Notizen", "Notes" },                   // German
            { "ملاحظات", "Notes" },                   // Arabic
            { "Betrag", "Amount" },                    // German
            // Product Stock aliases
            { "المخزون", "Stock" },                   // Arabic
            { "Bestand", "Stock" },                   // German
            { "Limite", "Limit" },                    // French
            { "الحد", "Limit" },                      // Arabic
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
        [RequestSizeLimit(10 * 1024 * 1024)]
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

                    if (hasData)
                    {
                        rowData["__SourceRowNumber"] = row.ToString(CultureInfo.InvariantCulture);
                        rows.Add(rowData);
                    }
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
        [RequestSizeLimit(10 * 1024 * 1024)]
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

            // 2. Persist into core Invoice records with Client linkage
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

                    var normalizedInvoiceNumber = !string.IsNullOrWhiteSpace(dto.InvoiceNumber)
                        ? dto.InvoiceNumber.Trim()
                        : $"IMP-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{imported + 1}";

                    var invoice = await _context.Invoices
                        .Include(i => i.Payments)
                        .Include(i => i.InvoiceItems)
                        .FirstOrDefaultAsync(i => i.CompanyId == companyId && i.Number == normalizedInvoiceNumber);

                    if (invoice == null)
                    {
                        invoice = new Invoice
                        {
                            Number = normalizedInvoiceNumber,
                            Date = dto.Date.ToUniversalTime(),
                            DueDate = dto.Date.ToUniversalTime(),
                            Client = client,
                            Category = ImportedCategory,
                            Status = "Paid",
                            Tfiscal = 0m,
                            CompanyId = companyId,
                            CreatedByUserId = userId,
                            CreatedAt = DateTime.UtcNow
                        };
                        if (client.Id > 0)
                            invoice.ClientId = client.Id;

                        invoice.InvoiceItems.Add(new InvoiceItem
                        {
                            Description = ImportedRevenueLineDescription,
                            Quantity = 1,
                            Price = dto.AmountPaid,
                            Tva = false,
                            VatRate = 0m
                        });
                        invoice.CalculTotalAmount();

                        _context.Invoices.Add(invoice);
                    }
                    else
                    {
                        invoice.Date = dto.Date.ToUniversalTime();
                        invoice.DueDate ??= dto.Date.ToUniversalTime();
                        invoice.ClientId = client.Id > 0 ? client.Id : invoice.ClientId;
                        invoice.Category = ImportedCategory;
                        invoice.Status = "Paid";
                        invoice.Tfiscal = 0m;

                        invoice.InvoiceItems ??= new List<InvoiceItem>();
                        if (!invoice.InvoiceItems.Any())
                        {
                            invoice.InvoiceItems.Add(new InvoiceItem
                            {
                                Description = ImportedRevenueLineDescription,
                                Quantity = 1,
                                Price = dto.AmountPaid,
                                Tva = false,
                                VatRate = 0m
                            });
                        }
                        else if (invoice.InvoiceItems.Count == 1
                            && string.Equals(invoice.InvoiceItems.First().Description, ImportedRevenueLineDescription, StringComparison.OrdinalIgnoreCase))
                        {
                            var importedItem = invoice.InvoiceItems.First();
                            importedItem.Quantity = 1;
                            importedItem.Price = dto.AmountPaid;
                            importedItem.Tva = false;
                            importedItem.VatRate = 0m;
                        }
                        invoice.CalculTotalAmount();
                    }

                    invoice.Payments ??= new List<Payment>();
                    var completedPaid = invoice.Payments
                        .Where(p => string.Equals(p.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                        .Sum(p => p.Amount);
                    if (completedPaid < dto.AmountPaid)
                    {
                        invoice.Payments.Add(new Payment
                        {
                            Amount = dto.AmountPaid - completedPaid,
                            PaymentDate = dto.Date.ToUniversalTime(),
                            Notes = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? "Imported via Data Management" : $"Imported via Data Management ({dto.PaymentMethod})",
                            Status = "Completed",
                            CreatedByUserId = userId,
                            ConfirmedByUserId = userId,
                            ConfirmedAt = DateTime.UtcNow,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

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
                    message = "Import failed. Check server logs for details."
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
            public List<string>? CustomCategories { get; set; }
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
            public List<ImportConflict> Conflicts { get; set; } = new();
            public int TotalRows => Errors.Count + ValidRows.Count;
            public int ValidCount => ValidRows.Count;
            public int ErrorCount => Errors.Count;
            public int ConflictCount => Conflicts.Count;

            public ValidationResult(List<ValidationError> errors, List<Dictionary<string, string>> validRows, List<ImportConflict>? conflicts = null)
            {
                Errors = errors;
                ValidRows = validRows;
                Conflicts = conflicts ?? new List<ImportConflict>();
            }
        }

        public class ImportConflict
        {
            public string Identifier { get; set; } = string.Empty;
            public int ExistingId { get; set; }
            public Dictionary<string, string> ExistingData { get; set; } = new();
            public Dictionary<string, string> NewData { get; set; } = new();
            public int RowIndex { get; set; }
        }

        public class ConflictResolutionRequest
        {
            public string DataType { get; set; } = string.Empty;
            public List<ConflictResolution> Resolutions { get; set; } = new();
        }

        public class ConflictResolution
        {
            public int ExistingId { get; set; }
            public string Choice { get; set; } = "skip"; // update, keep_original
            public Dictionary<string, string> NewData { get; set; } = new();
        }

        private record ExportRow(DateTime Date, string ClientName, decimal AmountPaid, string Currency, string PaymentMethod, string InvoiceNumber);
    }
}
