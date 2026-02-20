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
        public async Task<IActionResult> GetStorageConfig()
        {
            try
            {
                var user = await GetCurrentUserAsync(_userManager);
                if (user == null) return Unauthorized();

                var settings = await _context.CompanySettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

                var basePath = !string.IsNullOrWhiteSpace(settings?.BaseStoragePath)
                    ? settings!.BaseStoragePath!
                    : _pdfStorageService.GetBaseFolderPath();
                var exists = Directory.Exists(basePath);
                
                return Ok(new
                {
                    baseFolderPath = basePath,
                    folderExists = exists,
                    folderStructure = new
                    {
                        description = "PDFs are organized in the following structure:",
                        clientDocuments = "[CompanyName]/[Year]/Clients/[ClientName]/[Month]/[DocumentType]/",
                        supplierDocuments = "[CompanyName]/[Year]/Suppliers/[SupplierName]/[Month]/Invoices/",
                        documentTypes = new[] { "Invoices", "DeliveryNotes", "Quotes" },
                        months = new[] { "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                                        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre" }
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching storage config");
                return StatusCode(500, new { message = "Failed to retrieve storage configuration" });
            }
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

            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            if (settings == null)
            {
                settings = new CompanySettings { CompanyId = user.CompanyId };
                _context.CompanySettings.Add(settings);
            }

            if (!string.IsNullOrEmpty(settings.BaseStoragePath) &&
                !string.Equals(settings.BaseStoragePath, dto.BaseFolderPath, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Storage Path is locked and cannot be changed." });
            }

            var success = await _pdfStorageService.SetBaseFolderPathAsync(dto.BaseFolderPath);
            
            if (success)
            {
                settings.BaseStoragePath = dto.BaseFolderPath;
                settings.IsProfileComplete = true;
                settings.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

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

        /// <summary>
        /// POST: api/pdf-storage/test-path - Test if a path is writable without persisting
        /// Used during company setup to validate the storage path before committing
        /// </summary>
        [HttpPost("test-path")]
        public IActionResult TestPath([FromBody] TestPathDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Path))
            {
                return BadRequest(new { message = "Path is required" });
            }

            var path = dto.Path.Trim();

            try
            {
                // Check if the path is an absolute path
                if (!Path.IsPathRooted(path))
                {
                    return BadRequest(new { message = "Please provide an absolute path (e.g., C:\\PDFs or /home/user/pdfs)" });
                }

                // Check if directory exists, or try to create it
                if (!Directory.Exists(path))
                {
                    try
                    {
                        Directory.CreateDirectory(path);
                        _logger.LogInformation("Test-path created directory: {Path}", path);
                    }
                    catch (UnauthorizedAccessException)
                    {
                        return BadRequest(new { message = "Permission denied. Cannot create directory at the specified path." });
                    }
                    catch (IOException ex)
                    {
                        return BadRequest(new { message = $"Cannot create directory: {ex.Message}" });
                    }
                }

                // Try to create and delete a test file to verify write permissions
                var testFileName = Path.Combine(path, $".write_test_{Guid.NewGuid():N}.tmp");
                try
                {
                    System.IO.File.WriteAllText(testFileName, "Test write permission");
                    System.IO.File.Delete(testFileName);
                    
                    _logger.LogInformation("Test-path write test passed for: {Path}", path);
                    return Ok(new { 
                        message = "Path is valid and writable",
                        path = path,
                        exists = true,
                        writable = true
                    });
                }
                catch (UnauthorizedAccessException)
                {
                    return BadRequest(new { message = "Directory exists but is not writable. Check folder permissions." });
                }
                catch (IOException ex)
                {
                    return BadRequest(new { message = $"Cannot write to directory: {ex.Message}" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing path: {Path}", path);
                return BadRequest(new { message = $"Invalid path: {ex.Message}" });
            }
        }

        /// <summary>
        /// POST: api/pdf-storage/resolve-folder - Find the full path of a folder using its name + contents fingerprint
        /// The browser's native folder picker only returns the folder name, so we match by
        /// checking which directory on this machine has the same name AND contains the same entries.
        /// </summary>
        [HttpPost("resolve-folder")]
        public IActionResult ResolveFolder([FromBody] ResolveFolderDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Folder name is required" });

            var folderName = dto.Name.Trim();
            var entries = dto.Entries ?? Array.Empty<string>();

            try
            {
                var candidates = new List<string>();

                // Search all fixed drives
                var drives = DriveInfo.GetDrives()
                    .Where(d => d.IsReady && d.DriveType == DriveType.Fixed)
                    .Select(d => d.RootDirectory.FullName)
                    .ToList();

                foreach (var drive in drives)
                {
                    try
                    {
                        // Recursively search for directories with this name (max 4 levels deep to avoid slow scanning)
                        SearchForFolder(drive, folderName, 0, 4, candidates);
                    }
                    catch (UnauthorizedAccessException) { }
                    catch (IOException) { }

                    if (candidates.Count >= 20) break;
                }

                // If we have fingerprint entries, rank candidates by how many entries match
                if (entries.Length > 0 && candidates.Count > 0)
                {
                    var ranked = candidates
                        .Select(c =>
                        {
                            try
                            {
                                var dirEntries = Directory.GetFileSystemEntries(c)
                                    .Select(Path.GetFileName)
                                    .Where(n => n != null)
                                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                                var matchCount = entries.Count(e => dirEntries.Contains(e));
                                return new { Path = c, MatchCount = matchCount };
                            }
                            catch
                            {
                                return new { Path = c, MatchCount = 0 };
                            }
                        })
                        .OrderByDescending(x => x.MatchCount)
                        .ToList();

                    // If top result matches most entries, that's our answer
                    if (ranked.Count > 0 && ranked[0].MatchCount > 0)
                    {
                        return Ok(new { fullPath = ranked[0].Path });
                    }
                }

                // Fallback: return first candidate or empty
                return Ok(new { fullPath = candidates.FirstOrDefault() ?? "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving folder: {Name}", folderName);
                return BadRequest(new { message = $"Error resolving folder: {ex.Message}" });
            }
        }

        private static void SearchForFolder(string currentDir, string targetName, int depth, int maxDepth, List<string> results)
        {
            if (depth > maxDepth || results.Count >= 20) return;

            try
            {
                foreach (var subDir in Directory.EnumerateDirectories(currentDir))
                {
                    try
                    {
                        var name = Path.GetFileName(subDir);
                        if (string.Equals(name, targetName, StringComparison.OrdinalIgnoreCase))
                        {
                            results.Add(subDir);
                        }

                        if (depth < maxDepth && results.Count < 20)
                        {
                            // Skip known heavy directories
                            var lower = name?.ToLowerInvariant() ?? "";
                            if (lower is "windows" or "program files" or "program files (x86)" 
                                or "$recycle.bin" or "recovery" or "node_modules" or ".git" 
                                or "obj" or "bin" or "appdata")
                                continue;

                            SearchForFolder(subDir, targetName, depth + 1, maxDepth, results);
                        }
                    }
                    catch (UnauthorizedAccessException) { }
                    catch (IOException) { }
                }
            }
            catch (UnauthorizedAccessException) { }
            catch (IOException) { }
        }

        /// <summary>
        /// GET: api/pdf-storage/browse-system - Browse server directories for folder selection
        /// Used in company setup to let users navigate and select a storage folder
        /// </summary>
        [HttpGet("browse-system")]
        public IActionResult BrowseDirectories([FromQuery] string? path)
        {
            try
            {
                string currentPath;
                
                // Determine the starting path
                if (string.IsNullOrWhiteSpace(path))
                {
                    // Return available drives on Windows, or root on Linux
                    if (OperatingSystem.IsWindows())
                    {
                        var drives = DriveInfo.GetDrives()
                            .Where(d => d.IsReady && d.DriveType == DriveType.Fixed)
                            .Select(d => new DirectoryItem
                            {
                                Name = d.Name.TrimEnd(Path.DirectorySeparatorChar),
                                Path = d.Name,
                                IsDirectory = true,
                                IsDrive = true
                            })
                            .ToList();

                        return Ok(new BrowseResult
                        {
                            CurrentPath = "",
                            ParentPath = null,
                            Items = drives
                        });
                    }
                    else
                    {
                        currentPath = "/";
                    }
                }
                else
                {
                    currentPath = path.Trim();
                }

                // Validate the path
                if (!Path.IsPathRooted(currentPath))
                {
                    return BadRequest(new { message = "Invalid path" });
                }

                if (!Directory.Exists(currentPath))
                {
                    return BadRequest(new { message = "Directory not found" });
                }

                // Get parent path
                var dirInfo = new DirectoryInfo(currentPath);
                var parentPath = dirInfo.Parent?.FullName;

                // List subdirectories only (not files)
                var items = new List<DirectoryItem>();
                try
                {
                    var subDirs = Directory.GetDirectories(currentPath)
                        .OrderBy(d => Path.GetFileName(d), StringComparer.OrdinalIgnoreCase);

                    foreach (var dir in subDirs)
                    {
                        var name = Path.GetFileName(dir);
                        // Skip hidden and system directories
                        if (name.StartsWith(".") || name.StartsWith("$")) continue;
                        
                        try
                        {
                            // Check if we can access the directory
                            var testAccess = Directory.GetDirectories(dir).Length >= 0;
                            items.Add(new DirectoryItem
                            {
                                Name = name,
                                Path = dir,
                                IsDirectory = true,
                                IsDrive = false
                            });
                        }
                        catch (UnauthorizedAccessException)
                        {
                            // Include but mark as inaccessible
                            items.Add(new DirectoryItem
                            {
                                Name = name,
                                Path = dir,
                                IsDirectory = true,
                                IsDrive = false,
                                IsAccessible = false
                            });
                        }
                    }
                }
                catch (UnauthorizedAccessException)
                {
                    return BadRequest(new { message = "Access denied to this directory" });
                }

                return Ok(new BrowseResult
                {
                    CurrentPath = currentPath,
                    ParentPath = parentPath,
                    Items = items
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error browsing directories: {Path}", path);
                return BadRequest(new { message = $"Error browsing: {ex.Message}" });
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
            try
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking file consistency");
                return Ok(new { CheckedAt = DateTime.UtcNow, TotalFiles = 0, ExistingFiles = 0, MissingFiles = 0, hasMissingFiles = false, missingFileDetails = Array.Empty<object>() });
            }
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
            try
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
                        r.SupplierName,
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching PDF files");
                return Ok(new { data = Array.Empty<object>(), page, size, totalCount = 0, totalPages = 0 });
            }
        }

        /// <summary>
        /// GET: api/pdf-storage/files/{id} - Get a specific PDF file
        /// </summary>
        [HttpGet("files/{id}")]
        public async Task<IActionResult> GetFile(int id)
        {
            var record = await _context.PdfFileRecords.FindAsync(id);
            if (record == null) return NotFound();

            var fullPath = record.FullPath;
            if (string.IsNullOrWhiteSpace(fullPath) && !string.IsNullOrWhiteSpace(record.RelativePath))
            {
                fullPath = Path.Combine(_pdfStorageService.GetBaseFolderPath(), record.RelativePath);
            }
            else if (!string.IsNullOrWhiteSpace(fullPath) && !Path.IsPathRooted(fullPath))
            {
                fullPath = Path.Combine(_pdfStorageService.GetBaseFolderPath(), fullPath);
            }

            if (string.IsNullOrWhiteSpace(fullPath))
            {
                _logger.LogWarning("PDF record {RecordId} is missing a valid file path", id);
                return NotFound(new { message = "File path not configured", canRecover = !string.IsNullOrEmpty(record.CloudUrl) });
            }

            try
            {
                if (!System.IO.File.Exists(fullPath))
                {
                    _logger.LogWarning("PDF file missing for record {RecordId}: {Path}", id, fullPath);
                    return NotFound(new { message = "File not found on disk", canRecover = !string.IsNullOrEmpty(record.CloudUrl) });
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(fullPath);
                return File(fileBytes, "application/pdf", record.FileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load PDF for record {RecordId} from {Path}", id, fullPath);
                return StatusCode(500, new { message = "Failed to load PDF file" });
            }
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

    public class TestPathDto
    {
        public string Path { get; set; } = string.Empty;
    }

    public class RecoverFilesDto
    {
        public List<int> FileIds { get; set; } = new();
    }

    public class ResolveFolderDto
    {
        public string Name { get; set; } = string.Empty;
        public string[] Entries { get; set; } = Array.Empty<string>();
    }

    public class BrowseResult
    {
        public string CurrentPath { get; set; } = string.Empty;
        public string? ParentPath { get; set; }
        public List<DirectoryItem> Items { get; set; } = new();
    }

    public class DirectoryItem
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public bool IsDirectory { get; set; } = true;
        public bool IsDrive { get; set; }
        public bool IsAccessible { get; set; } = true;
    }
}
