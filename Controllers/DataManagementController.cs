using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Dtos;
using ResourceManager.Models;
using ResourceManager.Services;
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
        /// Export paid revenues as Excel/CSV. Payment-based only.
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

            var headers = new[] { "Date", "Client Name", "Amount Paid", "Currency", "Payment Method", "Reference" };
            var dataRows = allRows.Select(r => new object[] {
                r.Date,
                r.ClientName,
                r.AmountPaid,
                r.Currency,
                r.PaymentMethod,
                r.Reference
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

        /// <summary>
        /// Export paid expenses as Excel/CSV. Payment-based only.
        /// </summary>
        [HttpGet("export/expenses")]
        public async Task<IActionResult> ExportExpenses(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string format = "csv")
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

        /// <summary>
        /// Export clients as Excel/CSV.
        /// </summary>
        [HttpGet("export/clients")]
        public async Task<IActionResult> ExportClients([FromQuery] string format = "csv")
        {
            var clients = await _context.Clients.OrderBy(c => c.Name).ToListAsync();

            var headers = new[] { "Name", "Matricule Fiscal", "Phone Number", "Address", "Email" };
            var dataRows = clients.Select(c => new object[] {
                c.Name, c.MatriculeFiscal ?? "", c.Phone ?? "", c.Address ?? "", c.Email ?? ""
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

        /// <summary>
        /// Export products/services as Excel/CSV.
        /// </summary>
        [HttpGet("export/products")]
        public async Task<IActionResult> ExportProducts([FromQuery] string format = "csv")
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

        // ═══════════════════════════════════════════════════════════
        // HISTORICAL DATA IMPORT — VALIDATE (DRY RUN)
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Validate imported Excel/CSV data WITHOUT saving. Returns preview + errors.
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
                // Use i + 2 to map to Excel row number (Row 1 = Headers, Row 2 = Data Row 0)
                var rowNum = i + 2;
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
        /// Column layout: [0] Date, [1] Client Name, [2] Amount Paid, [3] Currency, [4] Payment Method
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

            // 2. Persist as HistoricalRevenue records
            var userId = _userManager.GetUserId(User);
            int imported = 0;

            foreach (var dto in validation.Rows)
            {
                _context.HistoricalRevenues.Add(new HistoricalRevenue
                {
                    Date = dto.Date.ToUniversalTime(),
                    ClientName = dto.ClientName,
                    AmountPaid = dto.AmountPaid,
                    Currency = dto.Currency,
                    PaymentMethod = dto.PaymentMethod,
                    IsHistorical = true,
                    CreatedAt = DateTime.UtcNow
                });
                imported++;
            }

            await _context.SaveChangesAsync();

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
