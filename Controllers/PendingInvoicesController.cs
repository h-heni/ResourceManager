using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using System.IO.Compression;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Handles employee supplier invoice uploads (compressed PDF storage in DB)
    /// and manager sync-to-local-disk operations.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PendingInvoicesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<PendingInvoicesController> _logger;
        private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

        public PendingInvoicesController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<PendingInvoicesController> logger)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
        }

        /// <summary>
        /// POST: api/PendingInvoices/upload-supplier
        /// Employee uploads a supplier invoice PDF. The file is GZip-compressed before storing in DB.
        /// </summary>
        [HttpPost("upload-supplier")]
        public async Task<IActionResult> UploadSupplierInvoice(
            [FromForm] string supplierName,
            [FromForm] DateTime date,
            [FromForm] decimal amount,
            IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file provided." });

            if (file.Length > MaxFileSizeBytes)
                return BadRequest(new { message = $"File too large. Maximum size is {MaxFileSizeBytes / (1024 * 1024)} MB." });

            // Only accept PDF files
            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            if (ext != ".pdf")
                return BadRequest(new { message = "Only PDF files are accepted." });

            if (string.IsNullOrWhiteSpace(supplierName))
                return BadRequest(new { message = "Supplier name is required." });

            var userId = _userManager.GetUserId(User);
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            try
            {
                // GZip compress the file in memory
                byte[] compressedContent;
                long originalSize = file.Length;

                using (var outputStream = new MemoryStream())
                {
                    using (var gzipStream = new GZipStream(outputStream, CompressionLevel.Optimal, leaveOpen: true))
                    {
                        await file.CopyToAsync(gzipStream);
                    }
                    compressedContent = outputStream.ToArray();
                }

                // Try to link to existing supplier (case-insensitive)
                var supplier = await _context.Fournisseurs
                    .FirstOrDefaultAsync(f => f.Name.ToLower() == supplierName.Trim().ToLower()
                                           && f.CompanyId == user.CompanyId);

                var pendingInvoice = new PendingInvoice
                {
                    SupplierName = supplierName.Trim(),
                    Date = date.ToUniversalTime(),
                    Amount = amount,
                    FileName = file.FileName,
                    Content = compressedContent,
                    OriginalSize = originalSize,
                    IsProcessed = false,
                    FournisseurId = supplier?.Id,
                    CompanyId = user.CompanyId,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.PendingInvoices.Add(pendingInvoice);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Supplier invoice uploaded: {FileName} ({OriginalSize} → {CompressedSize} bytes) for company {CompanyId}",
                    file.FileName, originalSize, compressedContent.Length, user.CompanyId);

                return Ok(new
                {
                    message = "Invoice uploaded successfully.",
                    id = pendingInvoice.Id,
                    originalSize,
                    compressedSize = compressedContent.Length,
                    compressionRatio = originalSize > 0
                        ? Math.Round((1 - (double)compressedContent.Length / originalSize) * 100, 1)
                        : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload supplier invoice");
                return StatusCode(500, new { message = "Failed to upload invoice. Please try again." });
            }
        }

        /// <summary>
        /// GET: api/PendingInvoices
        /// List all pending (unprocessed) invoices for the current company.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Manager,SuperAdmin")]
        public async Task<IActionResult> GetPendingInvoices([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.PendingInvoices
                    .Where(p => !p.IsProcessed)
                    .OrderByDescending(p => p.CreatedAt);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var invoices = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(p => new
                    {
                        p.Id,
                        p.SupplierName,
                        p.Date,
                        p.Amount,
                        p.FileName,
                        p.OriginalSize,
                        CompressedSize = p.Content != null ? p.Content.Length : 0,
                        p.IsProcessed,
                        p.CreatedAt,
                        p.CreatedByUserId
                    })
                    .ToListAsync();

                return Ok(new { Data = invoices, Page = page, Size = size, TotalCount = totalCount, TotalPages = totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pending invoices");
                return Ok(new { Data = Array.Empty<object>(), Page = page, Size = size, TotalCount = 0, TotalPages = 0 });
            }
        }

        /// <summary>
        /// GET: api/PendingInvoices/count
        /// Quick count of unprocessed invoices.
        /// </summary>
        [HttpGet("count")]
        [Authorize(Roles = "Manager,SuperAdmin")]
        public async Task<IActionResult> GetPendingCount()
        {
            try
            {
                var count = await _context.PendingInvoices
                    .Where(p => !p.IsProcessed)
                    .CountAsync();

                return Ok(new { count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pending invoices count");
                return Ok(new { count = 0 });
            }
        }

        /// <summary>
        /// POST: api/PendingInvoices/sync-local
        /// Manager-only: Download all pending invoices, decompress, and organize on local disk.
        /// Path structure: {BaseStoragePath}/{CompanyName}/{Year}/{Month}/{SupplierName}/{FileName}
        /// </summary>
        [HttpPost("sync-local")]
        [Authorize(Roles = "Manager,SuperAdmin")]
        public async Task<IActionResult> SyncToLocal()
        {
            var userId = _userManager.GetUserId(User);
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            // Get company settings for BaseStoragePath
            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            if (settings == null || string.IsNullOrEmpty(settings.BaseStoragePath))
                return BadRequest(new { message = "Base storage path is not configured. Please set it in Settings first." });

            // Get company name for folder structure
            var company = await _context.Companies.FindAsync(user.CompanyId);
            var companyName = SanitizeFileName(company?.Name ?? $"Company_{user.CompanyId}");

            var pendingInvoices = await _context.PendingInvoices
                .Where(p => !p.IsProcessed)
                .ToListAsync();

            if (pendingInvoices.Count == 0)
                return Ok(new { message = "No pending invoices to sync.", synced = 0, failed = 0 });

            int synced = 0;
            int failed = 0;
            var errors = new List<string>();

            foreach (var invoice in pendingInvoices)
            {
                try
                {
                    // Build folder path: BaseStoragePath/CompanyName/Year/Month/SupplierName/
                    var year = invoice.Date.Year.ToString();
                    var month = invoice.Date.ToString("MM - MMMM");
                    var supplierFolder = SanitizeFileName(invoice.SupplierName);

                    var folderPath = Path.Combine(
                        settings.BaseStoragePath,
                        companyName,
                        year,
                        month,
                        supplierFolder
                    );

                    // Create directory tree
                    Directory.CreateDirectory(folderPath);

                    // Build file path with sanitized name
                    var safeFileName = SanitizeFileName(invoice.FileName);
                    if (!safeFileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        safeFileName += ".pdf";

                    var filePath = Path.Combine(folderPath, safeFileName);

                    // Handle duplicate file names
                    if (System.IO.File.Exists(filePath))
                    {
                        var nameWithoutExt = Path.GetFileNameWithoutExtension(safeFileName);
                        var counter = 1;
                        do
                        {
                            filePath = Path.Combine(folderPath, $"{nameWithoutExt}_{counter}.pdf");
                            counter++;
                        } while (System.IO.File.Exists(filePath));
                    }

                    // Decompress GZip content
                    byte[] decompressedContent;
                    using (var inputStream = new MemoryStream(invoice.Content))
                    using (var gzipStream = new GZipStream(inputStream, CompressionMode.Decompress))
                    using (var outputStream = new MemoryStream())
                    {
                        await gzipStream.CopyToAsync(outputStream);
                        decompressedContent = outputStream.ToArray();
                    }

                    // Write to disk
                    await System.IO.File.WriteAllBytesAsync(filePath, decompressedContent);

                    // Mark as processed ONLY after successful write
                    invoice.IsProcessed = true;
                    synced++;

                    _logger.LogInformation("Synced invoice {InvoiceId} to {Path}", invoice.Id, filePath);
                }
                catch (Exception ex)
                {
                    failed++;
                    var errorMsg = $"Failed to sync '{invoice.FileName}' (Supplier: {invoice.SupplierName}): {ex.Message}";
                    errors.Add(errorMsg);
                    _logger.LogError(ex, "Failed to sync invoice {InvoiceId}", invoice.Id);
                }
            }

            // Save all processed flags
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Sync complete. {synced} synced, {failed} failed.",
                synced,
                failed,
                errors
            });
        }

        /// <summary>
        /// Sanitize a string for use as a Windows file/folder name.
        /// Replaces illegal characters with underscores.
        /// </summary>
        private static string SanitizeFileName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "_";

            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(name.Select(c => invalidChars.Contains(c) ? '_' : c).ToArray());

            // Also replace some additional problematic characters
            sanitized = sanitized.Replace("..", "_");

            // Trim dots and spaces from end (Windows restriction)
            sanitized = sanitized.TrimEnd('.', ' ');

            return string.IsNullOrWhiteSpace(sanitized) ? "_" : sanitized;
        }
    }
}
