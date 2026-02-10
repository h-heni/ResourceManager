using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Controller for PDF storage management and file consistency checking
    /// </summary>
    [Route("api/pdf-storage")]  // Explicit route with hyphen to match frontend API calls
    [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
    public class PdfStorageController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILocalPdfStorageService _pdfStorageService;
        private readonly ILogger<PdfStorageController> _logger;
        private readonly IConfiguration _configuration;

        public PdfStorageController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILocalPdfStorageService pdfStorageService,
            ILogger<PdfStorageController> logger,
            IConfiguration configuration)
        {
            _context = context;
            _userManager = userManager;
            _pdfStorageService = pdfStorageService;
            _logger = logger;
            _configuration = configuration;
        }

        // ═══════════════════════════════════════════════════════════════
        // PDF FOLDER CONFIGURATION
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/pdf-storage/config - Get current PDF storage configuration
        /// </summary>
        [HttpGet("config")]
        public IActionResult GetStorageConfig()
        {
            var basePath = _pdfStorageService.GetBaseFolderPath();
            var exists = Directory.Exists(basePath);
            
            return Ok(new
            {
                baseFolderPath = basePath,
                folderExists = exists,
                folderStructure = new
                {
                    description = "PDFs are organized in the following structure:",
                    clientDocuments = "[CompanyName]/[Year]/Clients/[ClientName]/[Month]/[DocumentType]/",
                    fournisseurDocuments = "[CompanyName]/[Year]/Fournisseurs/[FournisseurName]/[Month]/Invoices/",
                    documentTypes = new[] { "Factures", "BonsLivraison", "Devis" },
                    months = new[] { "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                                    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre" }
                }
            });
        }

        /// <summary>
        /// PUT: api/pdf-storage/config - Set the base folder for PDF storage
        /// </summary>
        [HttpPut("config")]
        public async Task<IActionResult> SetStorageConfig([FromBody] SetFolderPathDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.BaseFolderPath))
            {
                return BadRequest(new { message = "Base folder path is required" });
            }

            var success = await _pdfStorageService.SetBaseFolderPathAsync(dto.BaseFolderPath);
            
            if (success)
            {
                _logger.LogInformation("PDF storage base folder updated to: {Path}", dto.BaseFolderPath);
                return Ok(new
                {
                    message = "PDF storage folder configured successfully",
                    baseFolderPath = dto.BaseFolderPath
                });
            }
            else
            {
                return BadRequest(new
                {
                    message = "Failed to set PDF storage folder. Make sure the path is valid and you have write permissions."
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FILE CONSISTENCY CHECK (Part 3 - App Launch Check)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/pdf-storage/check-consistency - Check if all registered PDFs exist locally
        /// This should be called on app launch to detect missing files
        /// </summary>
        [HttpGet("check-consistency")]
        public async Task<IActionResult> CheckFileConsistency()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var report = await _pdfStorageService.CheckFileConsistencyAsync(user.CompanyId);

            return Ok(new
            {
                report.CheckedAt,
                report.TotalFiles,
                report.ExistingFiles,
                report.MissingFiles,
                hasMissingFiles = report.MissingFiles > 0,
                missingFileDetails = report.MissingFileRecords.Select(f => new
                {
                    f.Id,
                    f.FileName,
                    f.RelativePath,
                    f.DocumentType,
                    f.DocumentNumber,
                    f.DocumentDate,
                    f.HasCloudBackup,
                    canRecover = f.HasCloudBackup
                })
            });
        }

        /// <summary>
        /// POST: api/pdf-storage/recover - Download and restore missing files from cloud backup
        /// </summary>
        [HttpPost("recover")]
        public async Task<IActionResult> RecoverMissingFiles([FromBody] RecoverFilesDto dto)
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            if (dto.FileIds == null || !dto.FileIds.Any())
            {
                return BadRequest(new { message = "No file IDs provided for recovery" });
            }

            var result = await _pdfStorageService.RecoverMissingFilesAsync(user.CompanyId, dto.FileIds);

            return Ok(new
            {
                result.Recovered,
                result.AlreadyExisted,
                result.Failed,
                result.Errors,
                message = $"Recovery complete: {result.Recovered} recovered, {result.AlreadyExisted} already existed, {result.Failed} failed"
            });
        }

        /// <summary>
        /// POST: api/pdf-storage/recover-all - Attempt to recover all missing files
        /// </summary>
        [HttpPost("recover-all")]
        public async Task<IActionResult> RecoverAllMissingFiles()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            // First check consistency to get missing files
            var report = await _pdfStorageService.CheckFileConsistencyAsync(user.CompanyId);
            
            if (report.MissingFiles == 0)
            {
                return Ok(new { message = "No missing files to recover" });
            }

            // Get IDs of all recoverable files (those with cloud backup)
            var recoverableIds = report.MissingFileRecords
                .Where(f => f.HasCloudBackup)
                .Select(f => f.Id)
                .ToList();

            if (!recoverableIds.Any())
            {
                return Ok(new
                {
                    message = "No files can be recovered - none have cloud backups",
                    missingWithoutBackup = report.MissingFiles
                });
            }

            var result = await _pdfStorageService.RecoverMissingFilesAsync(user.CompanyId, recoverableIds);

            return Ok(new
            {
                result.Recovered,
                result.AlreadyExisted,
                result.Failed,
                result.Errors,
                cannotRecover = report.MissingFileRecords.Count(f => !f.HasCloudBackup),
                message = $"Recovery complete: {result.Recovered} recovered, {result.Failed} failed, " +
                         $"{report.MissingFileRecords.Count(f => !f.HasCloudBackup)} cannot be recovered (no cloud backup)"
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // PDF FILE MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/pdf-storage/files - List all registered PDF files
        /// </summary>
        [HttpGet("files")]
        public async Task<IActionResult> GetAllFiles([FromQuery] string? documentType = null, [FromQuery] int page = 1, [FromQuery] int size = 50)
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var query = _context.PdfFileRecords
                .Where(r => r.CompanyId == user.CompanyId && !r.IsDeleted);

            if (!string.IsNullOrEmpty(documentType) && Enum.TryParse<PdfDocumentType>(documentType, true, out var docType))
            {
                query = query.Where(r => r.DocumentType == docType);
            }

            var totalCount = await query.CountAsync();
            
            var files = await query
                .OrderByDescending(r => r.DocumentDate)
                .Skip((page - 1) * size)
                .Take(size)
                .Select(r => new
                {
                    r.Id,
                    r.FileName,
                    r.RelativePath,
                    r.DocumentType,
                    r.DocumentNumber,
                    r.DocumentDate,
                    r.ClientName,
                    r.FournisseurName,
                    r.FileSizeBytes,
                    r.CreatedAt,
                    hasCloudBackup = !string.IsNullOrEmpty(r.CloudUrl),
                    fileExists = System.IO.File.Exists(r.FullPath)
                })
                .ToListAsync();

            return Ok(new
            {
                data = files,
                page,
                size,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)size)
            });
        }

        /// <summary>
        /// GET: api/pdf-storage/files/{id} - Get a specific PDF file
        /// </summary>
        [HttpGet("files/{id}")]
        public async Task<IActionResult> GetFile(int id)
        {
            var record = await _context.PdfFileRecords.FindAsync(id);
            if (record == null) return NotFound();

            if (!System.IO.File.Exists(record.FullPath))
            {
                return NotFound(new { message = "File not found on disk", canRecover = !string.IsNullOrEmpty(record.CloudUrl) });
            }

            var fileBytes = await System.IO.File.ReadAllBytesAsync(record.FullPath);
            return File(fileBytes, "application/pdf", record.FileName);
        }

        /// <summary>
        /// DELETE: api/pdf-storage/files/{id} - Delete a PDF file and its record
        /// </summary>
        [HttpDelete("files/{id}")]
        public async Task<IActionResult> DeleteFile(int id)
        {
            var success = await _pdfStorageService.DeletePdfAsync(id);
            
            if (success)
            {
                return Ok(new { message = "File deleted successfully" });
            }
            
            return NotFound(new { message = "File not found" });
        }

        // ═══════════════════════════════════════════════════════════════
        // FOLDER BROWSER — Restricted to SuperAdmin only
        // Scoped to a safe base directory to prevent filesystem traversal
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET: api/pdf-storage/browse - List directories within the configured PDF storage base path.
        /// Restricted to SuperAdmin role to prevent filesystem enumeration.
        /// </summary>
        [HttpGet("browse")]
        [Authorize(Roles = "SuperAdmin")]
        public IActionResult BrowseFolders([FromQuery] string? path = null)
        {
            try
            {
                // Determine the safe base directory for browsing
                var basePath = _configuration["PdfStorage:BasePath"]
                    ?? Path.Combine(Directory.GetCurrentDirectory(), "PdfStorage");

                if (!Directory.Exists(basePath))
                    Directory.CreateDirectory(basePath);

                string targetPath;
                
                if (string.IsNullOrEmpty(path))
                {
                    targetPath = basePath;
                }
                else
                {
                    // Resolve and validate the path is within the base directory
                    targetPath = Path.GetFullPath(path);
                    var resolvedBase = Path.GetFullPath(basePath);
                    
                    if (!targetPath.StartsWith(resolvedBase, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Path traversal attempt blocked: {AttemptedPath} (base: {BasePath})", path, resolvedBase);
                        return Forbid();
                    }
                }

                if (!Directory.Exists(targetPath))
                    return BadRequest(new { message = "Path does not exist" });

                var directories = Directory.GetDirectories(targetPath)
                    .Select(d => new DirectoryInfo(d))
                    .Where(d => (d.Attributes & FileAttributes.Hidden) == 0)
                    .Select(d => new
                    {
                        name = d.Name,
                        path = d.FullName,
                        type = "folder"
                    })
                    .ToList();

                // Only allow navigating up to the base path
                var parentPath = Directory.GetParent(targetPath)?.FullName;
                var resolvedBasePath = Path.GetFullPath(basePath);
                if (parentPath != null && !parentPath.StartsWith(resolvedBasePath, StringComparison.OrdinalIgnoreCase)
                    && !parentPath.Equals(resolvedBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    parentPath = null; // Don't allow navigating above base
                }

                return Ok(new
                {
                    currentPath = targetPath,
                    parent = parentPath,
                    items = directories
                });
            }
            catch (UnauthorizedAccessException)
            {
                return BadRequest(new { message = "Access denied to this folder" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error browsing folder: {Path}", path);
                return BadRequest(new { message = "Failed to browse folder" });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DTOs
    // ═══════════════════════════════════════════════════════════════

    public class SetFolderPathDto
    {
        public string BaseFolderPath { get; set; } = string.Empty;
    }

    public class RecoverFilesDto
    {
        public List<int> FileIds { get; set; } = new();
    }
}
