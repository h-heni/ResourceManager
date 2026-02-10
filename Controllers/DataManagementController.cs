using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using System.Globalization;
using System.Text;

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
        /// Export paid revenues as CSV. Payment-based only.
        /// </summary>
        [HttpGet("export/revenues")]
        public async Task<IActionResult> ExportRevenues(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string format = "csv")
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
                        Currency = i.Currency ?? defaultCurrency,
                        PaymentMethod = "Payment",
                        Reference = i.Number
                    }))
                .OrderBy(r => r.Date)
                .ToList();

            // Include historical revenues
            var historicalRevenues = await _context.HistoricalRevenues
                .Where(h => h.Date >= fromDate && h.Date <= toDate)
                .OrderBy(h => h.Date)
                .ToListAsync();

            var allRows = paymentRows
                .Select(r => new ExportRow(r.Date, r.ClientName, r.AmountPaid, r.Currency, r.PaymentMethod, r.Reference))
                .Concat(historicalRevenues.Select(h => new ExportRow(h.Date, h.ClientName, h.AmountPaid, h.Currency ?? defaultCurrency, h.PaymentMethod ?? "", h.Reference ?? "")))
                .OrderBy(r => r.Date)
                .ToList();

            var csv = BuildCsv(
                new[] { "Date", "Client Name", "Amount Paid", "Currency", "Payment Method", "Reference" },
                allRows.Select(r => new[] {
                    r.Date.ToString("yyyy-MM-dd"),
                    r.ClientName,
                    r.AmountPaid.ToString("F2", CultureInfo.InvariantCulture),
                    r.Currency,
                    r.PaymentMethod,
                    r.Reference
                }));

            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"revenues_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        /// <summary>
        /// Export paid expenses as CSV. Payment-based only.
        /// </summary>
        [HttpGet("export/expenses")]
        public async Task<IActionResult> ExportExpenses(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
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
            var supplierInvoices = await _context.FournisseurInvoices
                .Include(si => si.Fournisseur)
                .Include(si => si.Payments)
                .Where(si => si.Payments!.Any(p => p.Status == "Completed"))
                .ToListAsync();

            var supplierRows = supplierInvoices
                .SelectMany(si => (si.Payments ?? new List<SupplierPayment>())
                    .Where(p => p.Status == "Completed" && p.PaymentDate >= fromDate && p.PaymentDate <= toDate)
                    .Select(p => new
                    {
                        Date = p.PaymentDate,
                        Supplier = si.Fournisseur?.Name ?? "Unknown",
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

            var csv = BuildCsv(
                new[] { "Date", "Supplier", "Amount Paid", "Currency", "Category", "Reference" },
                allRows.Select(r => new[] {
                    r.Date.ToString("yyyy-MM-dd"),
                    r.Supplier,
                    r.AmountPaid.ToString("F2", CultureInfo.InvariantCulture),
                    r.Currency,
                    r.Category,
                    r.Reference
                }));

            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"expenses_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        /// <summary>
        /// Export clients as CSV.
        /// </summary>
        [HttpGet("export/clients")]
        public async Task<IActionResult> ExportClients()
        {
            var clients = await _context.Clients.OrderBy(c => c.Name).ToListAsync();

            var csv = BuildCsv(
                new[] { "Name", "Matricule Fiscal", "Phone Number", "Address", "Email" },
                clients.Select(c => new[] {
                    c.Name,
                    c.MatriculeFiscal,
                    c.Phone,
                    c.Address,
                    c.Email ?? ""
                }));

            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"clients_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        /// <summary>
        /// Export products as CSV.
        /// </summary>
        [HttpGet("export/products")]
        public async Task<IActionResult> ExportProducts()
        {
            var products = await _context.ProductServices.OrderBy(p => p.Name).ToListAsync();

            var csv = BuildCsv(
                new[] { "Name", "Description", "Price", "Currency", "TVA Rate" },
                products.Select(p => new[] {
                    p.Name,
                    p.Description ?? "",
                    p.DefaultUnitPrice.ToString("F2", CultureInfo.InvariantCulture),
                    "TND", // Products don't have per-item currency yet
                    p.TvaRate.ToString("F0", CultureInfo.InvariantCulture)
                }));

            return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv; charset=utf-8",
                $"products_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        // ═══════════════════════════════════════════════════════════
        // HISTORICAL DATA IMPORT — VALIDATE (DRY RUN)
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Validate imported CSV data WITHOUT saving. Returns preview + errors.
        /// </summary>
        [HttpPost("import/validate")]
        public IActionResult ValidateImport([FromBody] ImportRequest request)
        {
            if (request == null || request.Rows == null || request.Rows.Count == 0)
                return BadRequest(new { message = "No data provided" });

            var result = ValidateRows(request.DataType, request.Rows);
            return Ok(result);
        }

        /// <summary>
        /// Import validated historical data. Stores in backend with IsHistorical = true.
        /// </summary>
        [HttpPost("import/confirm")]
        public async Task<IActionResult> ConfirmImport([FromBody] ImportRequest request)
        {
            if (request == null || request.Rows == null || request.Rows.Count == 0)
                return BadRequest(new { message = "No data provided" });

            var validation = ValidateRows(request.DataType, request.Rows);
            if (validation.Errors.Count > 0)
                return BadRequest(new { message = "Validation failed", errors = validation.Errors });

            var userId = _userManager.GetUserId(User);
            int imported = 0;

            switch (request.DataType.ToLower())
            {
                case "revenues":
                    foreach (var row in validation.ValidRows)
                    {
                        _context.HistoricalRevenues.Add(new HistoricalRevenue
                        {
                            Date = DateTime.Parse(row["Date"]).ToUniversalTime(),
                            ClientName = row["Client Name"],
                            AmountPaid = decimal.Parse(row["Amount Paid"], CultureInfo.InvariantCulture),
                            Currency = row.GetValueOrDefault("Currency") ?? "TND",
                            PaymentMethod = row.GetValueOrDefault("Payment Method"),
                            Reference = row.GetValueOrDefault("Reference"),
                            IsHistorical = true,
                            CreatedAt = DateTime.UtcNow
                        });
                        imported++;
                    }
                    break;

                case "expenses":
                    foreach (var row in validation.ValidRows)
                    {
                        _context.HistoricalExpenses.Add(new HistoricalExpense
                        {
                            Date = DateTime.Parse(row["Date"]).ToUniversalTime(),
                            SupplierName = row["Supplier"],
                            AmountPaid = decimal.Parse(row["Amount Paid"], CultureInfo.InvariantCulture),
                            Currency = row.GetValueOrDefault("Currency") ?? "TND",
                            Category = row.GetValueOrDefault("Category"),
                            Reference = row.GetValueOrDefault("Reference"),
                            IsHistorical = true,
                            CreatedAt = DateTime.UtcNow
                        });
                        imported++;
                    }
                    break;

                case "clients":
                    foreach (var row in validation.ValidRows)
                    {
                        // Check for duplicates
                        var name = row["Name"].Trim();
                        var existing = await _context.Clients.FirstOrDefaultAsync(c => c.Name == name);
                        if (existing != null) continue; // Skip duplicates

                        _context.Clients.Add(new Client
                        {
                            Name = name,
                            MatriculeFiscal = row.GetValueOrDefault("Matricule Fiscal") ?? "",
                            Phone = row.GetValueOrDefault("Phone Number") ?? "",
                            Address = row.GetValueOrDefault("Address") ?? "",
                            Email = row.GetValueOrDefault("Email"),
                            CreatedAt = DateTime.UtcNow
                        });
                        imported++;
                    }
                    break;

                case "products":
                    foreach (var row in validation.ValidRows)
                    {
                        var name = row["Name"].Trim();
                        var existing = await _context.ProductServices.FirstOrDefaultAsync(p => p.Name == name);
                        if (existing != null) continue; // Skip duplicates

                        _context.ProductServices.Add(new ProductService
                        {
                            Name = name,
                            Description = row.GetValueOrDefault("Description"),
                            DefaultUnitPrice = decimal.Parse(row["Price"], CultureInfo.InvariantCulture),
                            TvaRate = decimal.Parse(row["TVA Rate"], CultureInfo.InvariantCulture),
                            Type = "product",
                            VatApplicable = true,
                            CreatedAt = DateTime.UtcNow
                        });
                        imported++;
                    }
                    break;

                default:
                    return BadRequest(new { message = $"Unknown data type: {request.DataType}" });
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Historical import: {Count} {Type} records imported by user {User}",
                imported, request.DataType, userId);

            return Ok(new { message = $"Successfully imported {imported} {request.DataType} records", imported });
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
        // PRIVATE HELPERS
        // ═══════════════════════════════════════════════════════════

        private ValidationResult ValidateRows(string dataType, List<Dictionary<string, string>> rows)
        {
            var errors = new List<ValidationError>();
            var validRows = new List<Dictionary<string, string>>();

            string[] requiredColumns;
            switch (dataType.ToLower())
            {
                case "revenues":
                    requiredColumns = new[] { "Date", "Client Name", "Amount Paid", "Currency" };
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
                default:
                    errors.Add(new ValidationError(0, $"Unknown data type: {dataType}"));
                    return new ValidationResult(errors, validRows);
            }

            // Check first row for required columns
            if (rows.Count > 0)
            {
                var firstRowKeys = rows[0].Keys.Select(k => k.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (var col in requiredColumns)
                {
                    if (!firstRowKeys.Contains(col))
                    {
                        errors.Add(new ValidationError(0, $"Required column missing: '{col}'"));
                    }
                }
                if (errors.Count > 0)
                    return new ValidationResult(errors, validRows);
            }

            for (int i = 0; i < rows.Count; i++)
            {
                var row = NormalizeKeys(rows[i]);
                var rowNum = i + 1; // 1-based for user display
                var rowErrors = new List<string>();

                // Validate required fields are non-empty
                foreach (var col in requiredColumns)
                {
                    if (!row.ContainsKey(col) || string.IsNullOrWhiteSpace(row[col]))
                    {
                        rowErrors.Add($"'{col}' is required");
                    }
                }

                // Type-specific validation
                if (dataType.ToLower() == "revenues" || dataType.ToLower() == "expenses")
                {
                    if (row.ContainsKey("Date") && !string.IsNullOrWhiteSpace(row["Date"]))
                    {
                        if (!DateTime.TryParse(row["Date"], CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                            rowErrors.Add("Invalid date format. Use YYYY-MM-DD");
                    }
                    if (row.ContainsKey("Amount Paid") && !string.IsNullOrWhiteSpace(row["Amount Paid"]))
                    {
                        if (!decimal.TryParse(row["Amount Paid"], NumberStyles.Number, CultureInfo.InvariantCulture, out var amt) || amt <= 0)
                            rowErrors.Add("'Amount Paid' must be a positive number");
                    }
                }

                if (dataType.ToLower() == "products")
                {
                    if (row.ContainsKey("Price") && !string.IsNullOrWhiteSpace(row["Price"]))
                    {
                        if (!decimal.TryParse(row["Price"], NumberStyles.Number, CultureInfo.InvariantCulture, out var price) || price < 0)
                            rowErrors.Add("'Price' must be a non-negative number");
                    }
                    if (row.ContainsKey("TVA Rate") && !string.IsNullOrWhiteSpace(row["TVA Rate"]))
                    {
                        if (!decimal.TryParse(row["TVA Rate"], NumberStyles.Number, CultureInfo.InvariantCulture, out var rate) || rate < 0 || rate > 100)
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
                    validRows.Add(row);
                }
            }

            return new ValidationResult(errors, validRows);
        }

        private static Dictionary<string, string> NormalizeKeys(Dictionary<string, string> row)
        {
            var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kvp in row)
            {
                normalized[kvp.Key.Trim()] = kvp.Value?.Trim() ?? "";
            }
            return normalized;
        }

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

        // ═══════════════════════════════════════════════════════════
        // DTOs
        // ═══════════════════════════════════════════════════════════

        public class ImportRequest
        {
            public string DataType { get; set; } = string.Empty; // "revenues", "expenses", "clients", "products"
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

        private record ExportRow(DateTime Date, string ClientName, decimal AmountPaid, string Currency, string PaymentMethod, string Reference);
    }
}
