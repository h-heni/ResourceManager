using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;
using ResourceManager.Services;
using Microsoft.AspNetCore.Identity;

namespace ResourceManager.Controllers
{
    public class SuppliersController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly SupabaseStorageService _storageService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<SuppliersController> _logger;

        public SuppliersController(AppDbContext context, SupabaseStorageService storageService, UserManager<ApplicationUser> userManager, ILogger<SuppliersController> logger)
        {
            _context = context;
            _storageService = storageService;
            _userManager = userManager;
            _logger = logger;
        }

        // GET: api/suppliers
        [HttpGet]
        public async Task<IActionResult> GetSuppliers([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;
                if (size > 100) size = 100;

                var query = _context.Suppliers.AsNoTracking().OrderBy(f => f.Name);

                var totalCount = await query.CountAsync();
                
                var list = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .ToListAsync();

                return Ok(new {
                    Data = list,
                    Page = page,
                    Size = size,
                    TotalCount = totalCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching suppliers");
                return Ok(new {
                    Data = Array.Empty<object>(),
                    Page = page,
                    Size = size,
                    TotalCount = 0
                });
            }
        }

        // GET: api/suppliers/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetSupplier(int id)
        {
            var f = await _context.Suppliers.FindAsync(id);
            if (f == null) return NotFound();
            return Ok(f);
        }

        // POST: api/suppliers
        [HttpPost]
        public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            
            var userId = _userManager.GetUserId(User);

            var f = new Supplier
            {
                Name = dto.Name,
                Address = dto.Address,
                TaxId = dto.TaxId,
                Phone = dto.Phone,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Suppliers.Add(f);
            
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSupplier), new { id = f.Id }, f);
        }

        // PUT: api/suppliers/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSupplier(int id, [FromBody] UpdateSupplierDto dto)
        {
             if (!ModelState.IsValid) return BadRequest(ModelState);
             
             var f = await _context.Suppliers.FindAsync(id);
             if (f == null) return NotFound();
             
             f.Name = dto.Name;
             f.Address = dto.Address;
             f.TaxId = dto.TaxId;
             f.Phone = dto.Phone;
             f.UpdatedAt = DateTime.UtcNow;
             
             await _context.SaveChangesAsync();
             return Ok(f);
        }

        // DELETE: api/suppliers/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupplier(int id)
        {
            var f = await _context.Suppliers.FindAsync(id);
            if (f == null) return NotFound();
            
            f.IsDeleted = true;
            f.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/suppliers/{id}/upload-invoice
        [HttpPost("{id}/upload-invoice")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadInvoice(int id, IFormFile file)
        {
            var f = await _context.Suppliers.FindAsync(id);
            if (f == null) return NotFound("Supplier not found");

            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "File size exceeds 10MB limit." });

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();

            // Folder structure: Suppliers/{id}/{filename}
            string folder = $"Suppliers/{id}";
            var publicUrl = await _storageService.UploadPdfAsync(fileBytes, folder, file.FileName);

            var userId = _userManager.GetUserId(User);

            // Create SupplierInvoice record
            var invoice = new SupplierInvoice
            {
                SupplierId = id,
                FileName = file.FileName,
                FilePath = publicUrl,
                FileType = Path.GetExtension(file.FileName).Replace(".", ""),
                InvoiceNumber = "UPLOADED-" + DateTime.UtcNow.Ticks,
                CreatedAt = DateTime.UtcNow,
                UserId = userId,
            };
            
            _context.Set<SupplierInvoice>().Add(invoice);

            await _context.SaveChangesAsync();

            return Ok(new { Url = publicUrl, Id = invoice.Id });
        }

        // ═══════════════════════════════════════════════════════════════
        // PART 4: PDF SCANNING & DATA EXTRACTION
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST: api/suppliers/scan-pdf
        /// Upload a supplier PDF and extract invoice data
        /// Returns extracted data for review/correction before saving
        /// </summary>
        [HttpPost("scan-pdf")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> ScanSupplierPdf(
            IFormFile file,
            [FromServices] ISupplierPdfScannerService scannerService)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Only PDF files are supported" });

            if (file.Length > 10 * 1024 * 1024) // 10MB limit
                return BadRequest(new { message = "File size exceeds 10MB limit" });

            using var stream = file.OpenReadStream();
            var result = await scannerService.ScanPdfAsync(stream, file.FileName);

            // Don't return raw PDF bytes in response
            result.PdfBytes = null;

            return Ok(new
            {
                result.Success,
                result.FileName,
                result.ScannedAt,
                result.ConfidenceScore,
                result.RequiresReview,
                extractedData = result.ExtractedData,
                result.Warnings,
                result.Errors,
                message = result.Success
                    ? (result.RequiresReview
                        ? "Data extracted successfully but requires review"
                        : "Data extracted successfully")
                    : "Failed to extract data from PDF"
            });
        }

        /// <summary>
        /// POST: api/suppliers/save-scanned
        /// Save the scanned/corrected supplier data and invoice PDF
        /// </summary>
        [HttpPost("save-scanned")]
        public async Task<IActionResult> SaveScannedSupplier(
            [FromForm] SaveScannedFournisseurDto dto,
            [FromServices] ISupplierPdfScannerService scannerService,
            [FromServices] ILocalPdfStorageService? pdfStorageService = null)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            // Check if supplier with this name already exists
            var existingSupplier = await _context.Suppliers
                .FirstOrDefaultAsync(f => f.Name == dto.FournisseurName && !f.IsDeleted);

            Supplier supplier;

            if (existingSupplier != null)
            {
                // Update existing supplier
                supplier = existingSupplier;
                if (!string.IsNullOrWhiteSpace(dto.Phone))
                    supplier.Phone = dto.Phone;
                if (!string.IsNullOrWhiteSpace(dto.Address))
                    supplier.Address = dto.Address;
                supplier.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Create new supplier
                supplier = new Supplier
                {
                    CompanyId = user.CompanyId,
                    Name = dto.FournisseurName ?? "Unknown Supplier",
                    Phone = dto.Phone ?? string.Empty,
                    Address = dto.Address ?? string.Empty,
                    TaxId = string.Empty, // Can be updated later
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Suppliers.Add(supplier);
                await _context.SaveChangesAsync();
            }

            // Handle the PDF file
            string? pdfUrl = null;
            string? localPath = null;
            int? supplierInvoiceId = null;

            if (dto.PdfFile != null && dto.PdfFile.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await dto.PdfFile.CopyToAsync(memoryStream);
                var fileBytes = memoryStream.ToArray();

                // Upload to cloud storage
                string folder = $"Suppliers/{supplier.Id}";
                pdfUrl = await _storageService.UploadPdfAsync(fileBytes, folder, dto.PdfFile.FileName);

                // Create SupplierInvoice record first to get the ID
                var invoice = new SupplierInvoice
                {
                    SupplierId = supplier.Id,
                    FileName = dto.PdfFile.FileName,
                    FilePath = pdfUrl,
                    FileType = "pdf",
                    InvoiceNumber = dto.InvoiceNumber ?? $"SCAN-{DateTime.UtcNow:yyyyMMddHHmmss}",
                    InvoiceDate = dto.InvoiceDate,
                    TotalHT = dto.TotalHT,
                    TotalTTC = dto.TotalTTC,
                    TVA = dto.TVA,
                    CreatedAt = DateTime.UtcNow,
                    UserId = userId
                };
                _context.Set<SupplierInvoice>().Add(invoice);
                await _context.SaveChangesAsync();
                supplierInvoiceId = invoice.Id;

                // Also save locally if local storage service is available
                if (pdfStorageService != null)
                {
                    var company = await _context.Companies.FindAsync(user.CompanyId);
                    if (company != null)
                    {
                        var saveResult = await pdfStorageService.SaveSupplierPdfAsync(
                            fileBytes,
                            dto.PdfFile.FileName,
                            supplier.Name,
                            company.Name ?? "Default",
                            dto.InvoiceDate ?? DateTime.UtcNow,
                            invoice.Id);

                        localPath = saveResult?.FullPath;
                    }
                }
            }

            return Ok(new
            {
                message = existingSupplier != null
                    ? "Supplier updated and invoice saved"
                    : "Supplier created and invoice saved",
                supplierId = supplier.Id,
                supplierName = supplier.Name,
                supplierInvoiceId,
                pdfUrl,
                localPath,
                isNewSupplier = existingSupplier == null
            });
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// DTO for saving scanned supplier data
// ═══════════════════════════════════════════════════════════════

namespace ResourceManager.DTOs
{
    public class SaveScannedFournisseurDto
    {
        public IFormFile? PdfFile { get; set; }
        public string? FournisseurName { get; set; } // kept for backward compat with frontend form field
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TVA { get; set; }
    }
}
