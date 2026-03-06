using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;
using ResourceManager.DTOs;

namespace ResourceManager.Controllers
{
    [Authorize]
    public class SupplierInvoicesController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<SupplierInvoicesController> _logger;
        private readonly ILocalPdfStorageService _pdfStorage;
        private readonly InventoryService _inventoryService;

        public SupplierInvoicesController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<SupplierInvoicesController> logger,
            ILocalPdfStorageService pdfStorage,
            InventoryService inventoryService)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _pdfStorage = pdfStorage;
            _inventoryService = inventoryService;
        }

        // ═══════════════════════════════════════════════════════════════
        // GET: api/SupplierInvoices - List all supplier invoices
        // ═══════════════════════════════════════════════════════════════
        [HttpGet]
        public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int size = 20,
        [FromQuery] int? year = null,
        [FromQuery] string? status = null,
        [FromQuery] bool onlyCount = false)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.SupplierInvoices.AsNoTracking().Include(f => f.Supplier)
                    .Include(f => f.Items)
                    .Include(f => f.Payments).AsQueryable();

                // 1. Filter by Year (if provided)
                if (year.HasValue && year.Value > 0)
                {
                    query = query.Where(f => f.InvoiceDate.HasValue && f.InvoiceDate.Value.Year == year.Value);
                }

                // 2. Filter by Status 
                // We use AmountPaid and TotalTTC to avoid the EF Core Translation error on 'PaymentStatus'
                if (!string.IsNullOrEmpty(status))
                {
                    if (status == "Paid")
                    {
                        // Archived: Bring ONLY Paid
                        // The AmountPaid covers or is greater than the TotalTTC
                        query = query.Where(f => f.PaymentStatus == "Paid");
                    }
                    else if (status == "Pending")    
                    {
                        // Active: Bring ALL NOT PAID
                        // The AmountPaid is strictly less than TotalTTC, or Total is 0/null
                        query = query.Where(f => f.PaymentStatus != "Paid");
                    }
                }

                // 3. Return Count Only (For the fast badging feature)
                if (onlyCount)
                {
                    var count = await query.CountAsync();
                    return Ok(new { TotalCount = count });
                }

                // 4. Return Full Objects
                query = query
                    .OrderByDescending(f => f.CreatedAt);

                var totalCount = await query.CountAsync();
                var list = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .ToListAsync();

                // 5. Fetch linked PO numbers for these invoices
                var invoiceIds = list.Select(f => f.Id).ToList();
                var linkedPOs = await _context.PurchaseOrders.AsNoTracking()
                    .Where(po => po.SupplierInvoiceId.HasValue && invoiceIds.Contains(po.SupplierInvoiceId.Value))
                    .Select(po => new { po.SupplierInvoiceId, po.Id, po.Number })
                    .ToListAsync();
                var poLookup = linkedPOs.ToDictionary(po => po.SupplierInvoiceId!.Value, po => new { po.Id, po.Number });

                // 6. Select Data
                // Mapping `f.PaymentStatus` here works perfectly because `ToListAsync()` 
                // has already downloaded the data into memory.
                var result = list.Select(f => new
                {
                    f.Id,
                    f.FileName,
                    f.InvoiceNumber,
                    f.InvoiceDate,
                    f.DueDate,
                    f.TotalHT,
                    f.TotalTTC,
                    f.TVA,
                    f.ExtractionStatus,
                    f.ConfidenceScore,
                    f.CreatedAt,
                    SupplierName = f.Supplier?.Name,
                    f.SupplierId,
                    ItemCount = f.Items?.Count ?? 0,
                    f.AmountPaid,
                    f.PendingAmount,
                    f.RemainingAmount,
                    f.PaymentStatus,
                    PaymentCount = f.Payments?.Count ?? 0,
                    f.FilePath,
                    f.IsDeleted,
                    f.Currency,
                    f.CurrencySymbol,
                    PurchaseOrderId = poLookup.ContainsKey(f.Id) ? (int?)poLookup[f.Id].Id : null,
                    PurchaseOrderNumber = poLookup.ContainsKey(f.Id) ? poLookup[f.Id].Number : null,
                    Payments = f.Payments?.OrderByDescending(p => p.PaymentDate).Select(p => new
                    {
                        p.Id,
                        p.Amount,
                        p.PaymentDate,
                        p.Notes,
                        p.Status,
                        p.IsScheduled,
                        p.CreatedAt
                    }) ?? Enumerable.Empty<object>()
                });

                return Ok(new
                {
                    Data = result,
                    Page = page,
                    Size = size,
                    TotalCount = totalCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching supplier invoices");
                return Ok(new
                {
                    Data = Array.Empty<object>(),
                    Page = page,
                    Size = size,
                    TotalCount = 0
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // GET: api/SupplierInvoices/{id}
        // ═══════════════════════════════════════════════════════════════
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var invoice = await _context.SupplierInvoices
                .Include(f => f.Supplier)
                .Include(f => f.Items)
                .Include(f => f.Payments)
                .FirstOrDefaultAsync(f => f.Id == id);

            if (invoice == null) return NotFound();

            // Audit: Resolve User Names
            var userIds = new HashSet<string>();
            if (invoice.Payments != null)
            {
                foreach (var p in invoice.Payments)
                {
                    if (!string.IsNullOrEmpty(p.CreatedByUserId)) userIds.Add(p.CreatedByUserId);
                    if (!string.IsNullOrEmpty(p.ConfirmedByUserId)) userIds.Add(p.ConfirmedByUserId);
                }
            }
            var userMap = new Dictionary<string, string>();
            if (userIds.Any())
            {
                var users = await _context.Users.AsNoTracking()
                    .Where(u => userIds.Contains(u.Id))
                    .Select(u => new { u.Id, Name = u.UserName ?? u.Email })
                    .ToListAsync();
                foreach (var u in users) userMap[u.Id] = u.Name ?? "Unknown";
            }

            // Look up linked Purchase Order
            var linkedPO = await _context.PurchaseOrders.AsNoTracking()
                .Where(po => po.SupplierInvoiceId == invoice.Id)
                .Select(po => new { po.Id, po.Number })
                .FirstOrDefaultAsync();

            return Ok(new
            {
                invoice.Id,
                invoice.FileName,
                invoice.FilePath,
                invoice.FileType,
                invoice.InvoiceNumber,
                invoice.InvoiceDate,
                invoice.DueDate,
                invoice.TotalHT,
                invoice.TotalTTC,
                invoice.TVA,
                invoice.ExtractionStatus,
                invoice.ConfidenceScore,
                invoice.RawExtractedText,
                invoice.CreatedAt,
                invoice.SupplierId,
                SupplierName = invoice.Supplier?.Name,
                SupplierAddress = invoice.Supplier?.Address,
                SupplierPhone = invoice.Supplier?.Phone,
                invoice.AmountPaid,
                invoice.PendingAmount,
                invoice.RemainingAmount,
                invoice.PaymentStatus,
                PurchaseOrderId = linkedPO?.Id,
                PurchaseOrderNumber = linkedPO?.Number,
                Items = invoice.Items.Select(i => new
                {
                    i.Id, i.Description, i.Quantity, i.UnitPrice, i.TaxRate,
                    i.TotalHT, i.TaxAmount, i.TotalTTC
                }),
                Payments = (invoice.Payments ?? Enumerable.Empty<SupplierPayment>()).OrderByDescending(p => p.PaymentDate).Select(p => new
                {
                    p.Id, p.Amount, p.PaymentDate, p.Notes, p.Status, p.IsScheduled, p.CreatedAt,
                    ConfirmedBy = (p.ConfirmedByUserId != null && userMap.ContainsKey(p.ConfirmedByUserId)) ? userMap[p.ConfirmedByUserId] : null,
                    ConfirmedAt = p.ConfirmedAt,
                    CreatedBy = (p.CreatedByUserId != null && userMap.ContainsKey(p.CreatedByUserId)) ? userMap[p.CreatedByUserId] : null
                })
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // GET: api/SupplierInvoices/{id}/file — serve the invoice file
        // ═══════════════════════════════════════════════════════════════
        [HttpGet("temp-file")]
        public async Task<IActionResult> GetTempFile([FromQuery] string tempFilePath)
        {
            if (string.IsNullOrWhiteSpace(tempFilePath))
                return BadRequest(new { message = "tempFilePath is required" });

            if (!tempFilePath.StartsWith("/uploads/supplier-invoices/", StringComparison.OrdinalIgnoreCase)
                || tempFilePath.Contains("..", StringComparison.Ordinal))
            {
                return BadRequest(new { message = "Invalid temp file path" });
            }

            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", tempFilePath.TrimStart('/'));

            if (!System.IO.File.Exists(fullPath))
                return NotFound(new { message = "Temporary preview file not found" });

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".bmp" => "image/bmp",
                ".tif" or ".tiff" => "image/tiff",
                ".webp" => "image/webp",
                _ => "application/pdf"
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            return File(bytes, contentType, Path.GetFileName(fullPath));
        }

        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetFile(int id)
        {
            var invoice = await _context.SupplierInvoices.FindAsync(id);
            if (invoice == null) return NotFound();
            if (string.IsNullOrEmpty(invoice.FilePath)) return NotFound(new { message = "No file associated" });

            string fullPath;
            if (invoice.FilePath.StartsWith("/"))
                fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", invoice.FilePath.TrimStart('/'));
            else
                fullPath = Path.Combine(_pdfStorage.GetBaseFolderPath(), invoice.FilePath);

            if (!System.IO.File.Exists(fullPath))
                return NotFound(new { message = "File not found on disk" });

            var contentType = invoice.FileType?.ToLowerInvariant() switch
            {
                "image/png" => "image/png",
                "image/jpeg" or "image/jpg" => "image/jpeg",
                _ => "application/pdf"
            };
            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            return File(bytes, contentType, invoice.FileName ?? "supplier-invoice.pdf");
        }

        // ═══════════════════════════════════════════════════════════════
        // POST: api/SupplierInvoices/upload
        // ═══════════════════════════════════════════════════════════════
        [HttpPost("upload")]
        public async Task<IActionResult> UploadAndExtract(
            IFormFile file,
            [FromQuery] int? supplierId,
            [FromServices] ISupplierPdfScannerService scannerService)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var isImage = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp" }.Contains(fileExtension);

            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new { message = "Supported formats: PDF, JPG, PNG, BMP, TIFF, WebP" });

            if (file.Length > 15 * 1024 * 1024)
                return BadRequest(new { message = "File size exceeds 15MB limit" });

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            try
            {
                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                var pdfBytes = memoryStream.ToArray();

                SupplierScanResult scanResult;
                if (isImage)
                {
                    using var extractStream = new MemoryStream(pdfBytes);
                    scanResult = await scannerService.ScanImageAsync(extractStream, file.FileName);
                }
                else
                {
                    using var extractStream = new MemoryStream(pdfBytes);
                    scanResult = await scannerService.ScanPdfAsync(extractStream, file.FileName);
                }

                // Store temp file for preview during review
                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "supplier-invoices");
                Directory.CreateDirectory(uploadsPath);
                var safeFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{fileExtension}";
                var fullPath = Path.Combine(uploadsPath, safeFileName);
                await System.IO.File.WriteAllBytesAsync(fullPath, pdfBytes);

                var tempFilePath = $"/uploads/supplier-invoices/{safeFileName}";

                _logger.LogInformation("Supplier invoice uploaded. File: {File}, Items: {Count}, Confidence: {Score:P0}",
                    file.FileName, scanResult.ExtractedData.LineItems.Count, scanResult.ConfidenceScore);

                return Ok(new
                {
                    success = scanResult.Success,
                    tempFilePath,
                    fileName = file.FileName,
                    fileType = isImage ? $"image/{fileExtension.TrimStart('.')}" : "application/pdf",
                    rawExtractedText = scanResult.RawExtractedText,
                    extractedData = new
                    {
                        scanResult.ExtractedData.SupplierName,
                        scanResult.ExtractedData.InvoiceNumber,
                        scanResult.ExtractedData.InvoiceDate,
                        scanResult.ExtractedData.DueDate,
                        scanResult.ExtractedData.TotalHT,
                        scanResult.ExtractedData.TotalTTC,
                        scanResult.ExtractedData.TVA,
                        scanResult.ExtractedData.Email,
                        scanResult.ExtractedData.Phone,
                        scanResult.ExtractedData.Address,
                        scanResult.ExtractedData.TaxId,
                        scanResult.ExtractedData.Currency,
                        lineItems = scanResult.ExtractedData.LineItems.Select(i => new
                        {
                            i.Description, i.Quantity, i.UnitPrice, i.TaxRate, i.TotalHT
                        })
                    },
                    confidenceScore = scanResult.ConfidenceScore,
                    requiresReview = scanResult.RequiresReview,
                    warnings = scanResult.Warnings,
                    errors = scanResult.Errors,
                    message = scanResult.Success
                        ? (scanResult.RequiresReview ? "Data extracted - please review" : "Data extracted successfully")
                        : "Failed to extract data. You can enter data manually."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading supplier invoice PDF");
                return StatusCode(500, new { message = "Failed to process PDF", error = ex.Message });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // POST: api/SupplierInvoices/confirm-new
        // ═══════════════════════════════════════════════════════════════
        [HttpPost("confirm-new")]
        public async Task<IActionResult> ConfirmNew([FromBody] ConfirmNewSupplierInvoiceDto dto)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            if (!dto.InvoiceDate.HasValue)
                return BadRequest(new { message = "Invoice Date is required." });

            if (string.IsNullOrWhiteSpace(dto.TempFilePath))
                return BadRequest(new { message = "No file path provided" });

            var tempFullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", dto.TempFilePath.TrimStart('/'));
            if (!System.IO.File.Exists(tempFullPath))
                return BadRequest(new { message = "Uploaded file not found. Please re-upload." });

            // Handle supplier
            int? supplierId = dto.SupplierId;
            string supplierName = dto.SupplierName ?? "Unknown";

            // If SupplierId is provided, always look up the name from DB
            if (supplierId.HasValue)
            {
                var existingById = await _context.Suppliers.FindAsync(supplierId.Value);
                if (existingById != null)
                {
                    supplierName = existingById.Name;
                }
            }
            else if (!string.IsNullOrWhiteSpace(dto.SupplierName))
            {
                var existing = await _context.Suppliers
                    .FirstOrDefaultAsync(f => f.Name == dto.SupplierName && !f.IsDeleted);
                if (existing != null)
                {
                    supplierId = existing.Id;
                    supplierName = existing.Name;
                }
                else
                {
                    var newF = new Supplier
                    {
                        Name = dto.SupplierName, Address = dto.SupplierAddress ?? string.Empty,
                        TaxId = string.Empty, Phone = dto.SupplierPhone ?? string.Empty,
                        CreatedByUserId = userId, CreatedAt = DateTime.UtcNow
                    };
                    _context.Suppliers.Add(newF);
                    await _context.SaveChangesAsync();
                    supplierId = newF.Id;
                    supplierName = newF.Name;
                }
            }

            var invoice = new SupplierInvoice
            {
                FileName = dto.FileName ?? "unknown",
                FilePath = dto.TempFilePath,
                FileType = dto.FileType ?? "pdf",
                InvoiceNumber = dto.InvoiceNumber ?? "",
                InvoiceDate = dto.InvoiceDate,
                DueDate = dto.DueDate,
                TotalHT = dto.TotalHT,
                TotalTTC = dto.TotalTTC,
                TVA = dto.TVA,
                RawExtractedText = dto.RawExtractedText,
                ConfidenceScore = dto.ConfidenceScore,
                ExtractionStatus = "Confirmed",
                SupplierId = supplierId,
                // Per-document currency
                Currency = dto.Currency,
                CurrencySymbol = dto.CurrencySymbol,
                CreatedAt = DateTime.UtcNow,
                UserId = userId
            };
            _context.SupplierInvoices.Add(invoice);
            await _context.SaveChangesAsync();

            // Move temp file → organized storage
            try
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(tempFullPath);
                var company = await _context.Companies.FindAsync(user.CompanyId);
                var companyName = company?.Name ?? "Default";
                var docDate = dto.InvoiceDate ?? DateTime.UtcNow;
                var pdfInfo = await _pdfStorage.SaveSupplierPdfAsync(
                    fileBytes, dto.FileName ?? $"supplier_{invoice.Id}",
                    supplierName, companyName, docDate, invoice.Id);
                invoice.FilePath = pdfInfo.RelativePath;
                _logger.LogInformation("Supplier invoice stored: {Path}", pdfInfo.RelativePath);
                System.IO.File.Delete(tempFullPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Organized storage failed, keeping temp path");
            }

            // Add line items
            if (dto.Items != null)
            {
                foreach (var item in dto.Items)
                {
                    _context.SupplierInvoiceItems.Add(new SupplierInvoiceItem
                    {
                        SupplierInvoiceId = invoice.Id,
                        Description = item.Description,
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPrice,
                        TaxRate = item.TaxRate ?? 0.19m,
                        ProductServiceId = item.ProductServiceId
                    });
                }
            }
            await _context.SaveChangesAsync();

            // Auto-add stock for stock-tracked items (supplier invoice = goods received)
            try
            {
                await _inventoryService.AddStockForSupplierInvoiceAsync(invoice.Id, invoice.InvoiceNumber ?? $"SI-{invoice.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stock update failed for supplier invoice {Id}, continuing", invoice.Id);
            }

            // Link to purchase order if specified
            if (dto.PurchaseOrderId.HasValue)
            {
                var po = await _context.PurchaseOrders.FindAsync(dto.PurchaseOrderId.Value);
                if (po != null)
                {
                    po.SupplierInvoiceId = invoice.Id;
                    po.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            return Ok(new { message = "Supplier invoice confirmed and saved", invoiceId = invoice.Id, supplierId });
        }

        // ═══════════════════════════════════════════════════════════════
        // PUT: api/SupplierInvoices/{id}/confirm
        // ═══════════════════════════════════════════════════════════════
        [HttpPut("{id}/confirm")]
        public async Task<IActionResult> ConfirmExtraction(int id, [FromBody] ConfirmSupplierInvoiceDto dto)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var invoice = await _context.SupplierInvoices
                .Include(f => f.Items)
                .FirstOrDefaultAsync(f => f.Id == id);
            if (invoice == null) return NotFound();

            if (!dto.InvoiceDate.HasValue && !invoice.InvoiceDate.HasValue)
                return BadRequest(new { message = "Invoice Date is required." });

            invoice.InvoiceNumber = dto.InvoiceNumber ?? invoice.InvoiceNumber;
            invoice.InvoiceDate = dto.InvoiceDate ?? invoice.InvoiceDate;
            invoice.DueDate = dto.DueDate ?? invoice.DueDate;
            invoice.TotalHT = dto.TotalHT ?? invoice.TotalHT;
            invoice.TotalTTC = dto.TotalTTC ?? invoice.TotalTTC;
            invoice.TVA = dto.TVA ?? invoice.TVA;
            invoice.ExtractionStatus = "Confirmed";

            if (dto.SupplierId.HasValue)
            {
                invoice.SupplierId = dto.SupplierId;
            }
            else if (!string.IsNullOrWhiteSpace(dto.SupplierName))
            {
                var existing = await _context.Suppliers
                    .FirstOrDefaultAsync(f => f.Name == dto.SupplierName && !f.IsDeleted);
                if (existing != null) { invoice.SupplierId = existing.Id; }
                else
                {
                    var newF = new Supplier
                    {
                        Name = dto.SupplierName, Address = dto.SupplierAddress ?? string.Empty,
                        TaxId = string.Empty, Phone = dto.SupplierPhone ?? string.Empty,
                        CreatedByUserId = userId, CreatedAt = DateTime.UtcNow
                    };
                    _context.Suppliers.Add(newF);
                    await _context.SaveChangesAsync();
                    invoice.SupplierId = newF.Id;
                }
            }

            if (dto.Items != null)
            {
                _context.SupplierInvoiceItems.RemoveRange(invoice.Items);
                foreach (var item in dto.Items)
                {
                    _context.SupplierInvoiceItems.Add(new SupplierInvoiceItem
                    {
                        SupplierInvoiceId = invoice.Id,
                        Description = item.Description,
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPrice,
                        TaxRate = item.TaxRate ?? 0.19m
                    });
                }
            }
            await _context.SaveChangesAsync();

            // Handle purchase order linking/unlinking
            var previousPO = await _context.PurchaseOrders
                .FirstOrDefaultAsync(po => po.SupplierInvoiceId == invoice.Id);

            if (dto.PurchaseOrderId.HasValue)
            {
                // Unlink previous PO if it's different
                if (previousPO != null && previousPO.Id != dto.PurchaseOrderId.Value)
                {
                    previousPO.SupplierInvoiceId = null;
                    previousPO.UpdatedAt = DateTime.UtcNow;
                }
                // Link new PO
                var newPO = dto.PurchaseOrderId.Value == previousPO?.Id
                    ? previousPO
                    : await _context.PurchaseOrders.FindAsync(dto.PurchaseOrderId.Value);
                if (newPO != null)
                {
                    newPO.SupplierInvoiceId = invoice.Id;
                    newPO.UpdatedAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync();
            }
            else if (previousPO != null)
            {
                // PurchaseOrderId is null — unlink the previous PO
                previousPO.SupplierInvoiceId = null;
                previousPO.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Supplier invoice updated", invoiceId = invoice.Id, supplierId = invoice.SupplierId });
        }

        // ═══════════════════════════════════════════════════════════════
        // POST: api/SupplierInvoices/{id}/payments
        // ═══════════════════════════════════════════════════════════════
        [HttpPost("{id}/payments")]
        public async Task<IActionResult> AddPayment(int id, [FromBody] SupplierPaymentDto dto)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var invoice = await _context.SupplierInvoices
                .Include(f => f.Payments)
                .FirstOrDefaultAsync(f => f.Id == id);
            if (invoice == null) return NotFound();
            if (dto.Amount <= 0) return BadRequest(new { message = "Payment amount must be positive" });

            // Over-allocation guard: confirmed + pending must not exceed totalAmount
            var totalAmount = invoice.TotalTTC ?? 0;
            var existingPaid = invoice.AmountPaid;
            var existingPending = invoice.PendingAmount;
            var newPending = (dto.Status ?? "Completed") == "Pending" ? dto.Amount : 0;
            var newCompleted = (dto.Status ?? "Completed") == "Completed" ? dto.Amount : 0;
            if (totalAmount > 0 && (existingPaid + newCompleted + existingPending + newPending) > totalAmount)
            {
                var maxAllowed = Math.Max(0, totalAmount - existingPaid - existingPending);
                return BadRequest(new { message = $"Payment would exceed invoice total. Maximum allowed: {maxAllowed:N3}" });
            }
            var  TotalPaidAfter = existingPaid + newCompleted + existingPending + newPending;
            if (TotalPaidAfter >= totalAmount)
            {
                invoice.PaymentStatus = "Paid";
            }
            else if (TotalPaidAfter > 0 && TotalPaidAfter<= totalAmount)
            {
                invoice.PaymentStatus = "PartiallyPaid";
            }
            else
            {
                invoice.PaymentStatus = "Pending";
            }

            var payment = new SupplierPayment
                {
                    SupplierInvoiceId = id,
                    Amount = dto.Amount,
                    PaymentDate = dto.PaymentDate ?? DateTime.UtcNow,
                    Notes = dto.Notes,
                    Status = dto.Status ?? "Completed",
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow,
                    ConfirmedByUserId = (dto.Status ?? "Completed") == "Completed" ? userId : null,
                    ConfirmedAt = (dto.Status ?? "Completed") == "Completed" ? DateTime.UtcNow : null
                };

            _context.SupplierPayments.Add(payment);
            await _context.SaveChangesAsync();

            await _context.Entry(invoice).Collection(f => f.Payments).LoadAsync();

            return Ok(new
            {
                message = "Payment recorded",
                paymentId = payment.Id,
                paymentStatus = invoice.PaymentStatus,
                amountPaid = invoice.AmountPaid,
                pendingAmount = invoice.PendingAmount,
                remainingAmount = invoice.RemainingAmount
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // GET: api/SupplierInvoices/{id}/payments
        // ═══════════════════════════════════════════════════════════════
        [HttpGet("{id}/payments")]
        public async Task<IActionResult> GetPayments(int id)
        {
            var invoice = await _context.SupplierInvoices
                .Include(f => f.Payments)
                .FirstOrDefaultAsync(f => f.Id == id);
            if (invoice == null) return NotFound();

            return Ok(new
            {
                payments = invoice.Payments.OrderByDescending(p => p.PaymentDate).Select(p => new
                {
                    p.Id, p.Amount, p.PaymentDate, p.Notes, p.Status, p.IsScheduled, p.CreatedAt
                }),
                summary = new
                {
                    invoice.AmountPaid, invoice.PendingAmount, invoice.RemainingAmount,
                    invoice.PaymentStatus, totalTTC = invoice.TotalTTC ?? 0
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // DELETE: api/SupplierInvoices/{id}/payments/{paymentId}
        // ═══════════════════════════════════════════════════════════════
        [HttpDelete("{id}/payments/{paymentId}")]
        public async Task<IActionResult> DeletePayment(int id, int paymentId)
        {
            var payment = await _context.SupplierPayments
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.SupplierInvoiceId == id);
            if (payment == null) return NotFound();
            _context.SupplierPayments.Remove(payment);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Payment deleted" });
        }

        // ═══════════════════════════════════════════════════════════════
        // POST: api/SupplierInvoices/validate - Consistency check
        // ═══════════════════════════════════════════════════════════════
        [HttpPost("validate")]
        public async Task<IActionResult> ValidateConsistency()
        {
            var invoices = await _context.SupplierInvoices
                .Include(f => f.Items)
                .Include(f => f.Supplier)
                .Where(f => !f.IsDeleted)
                .ToListAsync();

            var issues = new List<object>();

            foreach (var inv in invoices)
            {
                var invIssues = new List<string>();

                if (string.IsNullOrWhiteSpace(inv.InvoiceNumber))
                    invIssues.Add("Missing invoice number");
                if (!inv.InvoiceDate.HasValue)
                    invIssues.Add("Missing invoice date");
                if (inv.SupplierId == null)
                    invIssues.Add("No supplier linked");
                if (!inv.TotalTTC.HasValue || inv.TotalTTC == 0)
                    invIssues.Add("Missing total amount (TTC)");

                // Line items are informational only — no total comparison checks
                if (!inv.Items.Any())
                {
                    invIssues.Add("No line items");
                }

                if (!string.IsNullOrEmpty(inv.FilePath))
                {
                    var filePath = inv.FilePath.StartsWith("/")
                        ? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", inv.FilePath.TrimStart('/'))
                        : Path.Combine(_pdfStorage.GetBaseFolderPath(), inv.FilePath);
                    if (!System.IO.File.Exists(filePath))
                        invIssues.Add("Source file missing from disk");
                }
                else
                {
                    invIssues.Add("No file path recorded");
                }

                if (invIssues.Any())
                {
                    issues.Add(new
                    {
                        invoiceId = inv.Id,
                        invoiceNumber = inv.InvoiceNumber,
                        supplierName = inv.Supplier?.Name ?? "Unknown",
                        issueCount = invIssues.Count,
                        issues = invIssues
                    });
                }
            }

            return Ok(new
            {
                checkedAt = DateTime.UtcNow,
                totalInvoices = invoices.Count,
                invoicesWithIssues = issues.Count,
                cleanInvoices = invoices.Count - issues.Count,
                issues
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // DELETE: api/SupplierInvoices/{id}
        // ═══════════════════════════════════════════════════════════════
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var invoice = await _context.SupplierInvoices.FindAsync(id);
            if (invoice == null) return NotFound();
            invoice.IsDeleted = true;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ═══════════════════════════════════════════════════════════════
        // POST: api/SupplierInvoices/discard
        // ═══════════════════════════════════════════════════════════════
        [HttpPost("discard")]
        public IActionResult Discard([FromBody] DiscardSupplierInvoiceDto dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.TempFilePath))
            {
                var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", dto.TempFilePath.TrimStart('/'));
                if (System.IO.File.Exists(fullPath))
                {
                    System.IO.File.Delete(fullPath);
                    _logger.LogInformation("Discarded temp file: {Path}", dto.TempFilePath);
                }
            }
            return Ok(new { message = "Discarded" });
        }
    }
}
