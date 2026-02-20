using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Services
{
    /// <summary>
    /// Manages local PDF storage with organized folder structure:
    /// CompanyName/Year/Clients/ClientName/Month/DocumentType/files
    /// CompanyName/Year/Suppliers/SupplierName/Month/Invoices/files
    /// </summary>
    public interface ILocalPdfStorageService
    {
        /// <summary>
        /// Saves a PDF file for a client document (Invoice, DeliveryNote, Quote)
        /// </summary>
        Task<PdfFileInfo> SaveClientPdfAsync(
            byte[] pdfBytes,
            string documentNumber,
            PdfDocumentType documentType,
            string clientName,
            string companyName,
            DateTime documentDate,
            int relatedEntityId);

        /// <summary>
        /// Saves a PDF file for a supplier invoice
        /// </summary>
        Task<PdfFileInfo> SaveSupplierPdfAsync(
            byte[] pdfBytes,
            string fileName,
            string supplierName,
            string companyName,
            DateTime documentDate,
            int supplierInvoiceId);

        /// <summary>
        /// Gets the configured base folder path
        /// </summary>
        string GetBaseFolderPath();

        /// <summary>
        /// Sets the base folder path (must have write permissions)
        /// </summary>
        Task<bool> SetBaseFolderPathAsync(string path);

        /// <summary>
        /// Checks if a file exists at the specified path
        /// </summary>
        bool FileExists(string filePath);

        /// <summary>
        /// Gets file bytes from the specified path
        /// </summary>
        byte[]? GetFileBytes(string filePath);

        /// <summary>
        /// Gets all registered PDF files for a company
        /// </summary>
        Task<List<PdfFileRecord>> GetAllPdfRecordsAsync(int companyId);

        /// <summary>
        /// Verifies all registered PDFs exist, returns missing files
        /// </summary>
        Task<FileConsistencyReport> CheckFileConsistencyAsync(int companyId);

        /// <summary>
        /// Re-downloads missing files from cloud storage (if available)
        /// </summary>
        Task<FileRecoveryResult> RecoverMissingFilesAsync(int companyId, List<int> fileIds);

        /// <summary>
        /// Deletes a PDF file and its record
        /// </summary>
        Task<bool> DeletePdfAsync(int pdfFileId);
    }

    public class LocalPdfStorageService : ILocalPdfStorageService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LocalPdfStorageService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly string _configFilePath;

        // French month names for folder structure
        private static readonly string[] FrenchMonths = 
        {
            "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        };

        public LocalPdfStorageService(
            IConfiguration configuration,
            ILogger<LocalPdfStorageService> logger,
            IServiceProvider serviceProvider,
            IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;
            
            // Store config in the app's data folder
            _configFilePath = Path.Combine(environment.ContentRootPath, "pdfStorageConfig.json");
        }

        /// <summary>
        /// Gets the configured base folder path or returns default
        /// </summary>
        public string GetBaseFolderPath()
        {
            // Priority: 1. Config file, 2. appsettings, 3. Default
            if (File.Exists(_configFilePath))
            {
                try
                {
                    var config = JsonSerializer.Deserialize<PdfStorageConfig>(File.ReadAllText(_configFilePath));
                    if (config != null && !string.IsNullOrEmpty(config.BaseFolderPath))
                    {
                        return config.BaseFolderPath;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to read PDF storage config file");
                }
            }

            var configPath = _configuration["PdfStorage:BaseFolderPath"];
            if (!string.IsNullOrEmpty(configPath))
            {
                return configPath;
            }

            // Default to user's Documents folder
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "InvoiceManager",
                "PDFs"
            );
        }

        /// <summary>
        /// Sets the base folder path after validating it
        /// </summary>
        public async Task<bool> SetBaseFolderPathAsync(string path)
        {
            try
            {
                // Validate the path
                if (string.IsNullOrWhiteSpace(path))
                {
                    _logger.LogWarning("Cannot set empty base folder path");
                    return false;
                }

                // Create directory if it doesn't exist
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                }

                // Test write permissions by creating a test file
                var testFile = Path.Combine(path, $".write_test_{Guid.NewGuid()}.tmp");
                await File.WriteAllTextAsync(testFile, "test");
                File.Delete(testFile);

                // Save configuration
                var config = new PdfStorageConfig
                {
                    BaseFolderPath = path,
                    ConfiguredAt = DateTime.UtcNow
                };

                await File.WriteAllTextAsync(_configFilePath, JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));
                
                _logger.LogInformation("PDF storage base folder set to: {Path}", path);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to set base folder path to: {Path}", path);
                return false;
            }
        }

        /// <summary>
        /// Saves a client document PDF with proper folder structure
        /// </summary>
        public async Task<PdfFileInfo> SaveClientPdfAsync(
            byte[] pdfBytes,
            string documentNumber,
            PdfDocumentType documentType,
            string clientName,
            string companyName,
            DateTime documentDate,
            int relatedEntityId)
        {
            var basePath = GetBaseFolderPath();
            var sanitizedCompanyName = SanitizeFolderName(companyName);
            var sanitizedClientName = SanitizeFolderName(clientName);
            var year = documentDate.Year.ToString();
            var month = GetFrenchMonth(documentDate.Month);
            var docTypeFolder = GetDocumentTypeFolder(documentType);

            // Build folder path: CompanyName/Year/Clients/ClientName/Month/DocumentType
            var folderPath = Path.Combine(
                basePath,
                sanitizedCompanyName,
                year,
                "Clients",
                sanitizedClientName,
                month,
                docTypeFolder
            );

            // Create directory structure
            Directory.CreateDirectory(folderPath);

            // Generate filename
            var sanitizedNumber = SanitizeFileName(documentNumber);
            var fileName = $"{docTypeFolder}_{sanitizedNumber}_{documentDate:yyyyMMdd}.pdf";
            var fullPath = Path.Combine(folderPath, fileName);

            // Handle duplicates
            fullPath = GetUniqueFilePath(fullPath);

            // Write file
            await File.WriteAllBytesAsync(fullPath, pdfBytes);

            // Calculate relative path from base
            var relativePath = Path.GetRelativePath(basePath, fullPath);

            // Create and save PdfFileRecord
            var record = new PdfFileRecord
            {
                FileName = Path.GetFileName(fullPath),
                RelativePath = relativePath,
                FullPath = fullPath,
                DocumentType = documentType,
                DocumentNumber = documentNumber,
                RelatedEntityType = documentType switch
                {
                    PdfDocumentType.Invoice => "Invoice",
                    PdfDocumentType.DeliveryNote => "DeliveryNote",
                    PdfDocumentType.Quote => "Quote",
                    _ => "Unknown"
                },
                RelatedEntityId = relatedEntityId,
                ClientName = clientName,
                DocumentDate = documentDate,
                FileSizeBytes = pdfBytes.Length,
                CreatedAt = DateTime.UtcNow
            };

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            context.PdfFileRecords.Add(record);
            await context.SaveChangesAsync();

            _logger.LogInformation("PDF saved: {Path} ({Size} bytes)", relativePath, pdfBytes.Length);

            return new PdfFileInfo
            {
                Id = record.Id,
                FileName = record.FileName,
                RelativePath = relativePath,
                FullPath = fullPath,
                FileSizeBytes = pdfBytes.Length
            };
        }

        /// <summary>
        /// Saves a supplier invoice PDF with proper folder structure
        /// </summary>
        public async Task<PdfFileInfo> SaveSupplierPdfAsync(
            byte[] pdfBytes,
            string fileName,
            string supplierName,
            string companyName,
            DateTime documentDate,
            int supplierInvoiceId)
        {
            var basePath = GetBaseFolderPath();
            var sanitizedCompanyName = SanitizeFolderName(companyName);
            var sanitizedSupplierName = SanitizeFolderName(supplierName);
            var year = documentDate.Year.ToString();
            var month = GetFrenchMonth(documentDate.Month);

            // Build folder path: CompanyName/Year/Suppliers/SupplierName/Month/Invoices
            var folderPath = Path.Combine(
                basePath,
                sanitizedCompanyName,
                year,
                "Suppliers",
                sanitizedSupplierName,
                month,
                "Invoices"
            );

            // Create directory structure
            Directory.CreateDirectory(folderPath);

            // Sanitize filename
            var sanitizedFileName = SanitizeFileName(fileName);
            if (!sanitizedFileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                sanitizedFileName += ".pdf";
            }

            var fullPath = Path.Combine(folderPath, sanitizedFileName);

            // Handle duplicates
            fullPath = GetUniqueFilePath(fullPath);

            // Write file
            await File.WriteAllBytesAsync(fullPath, pdfBytes);

            // Calculate relative path from base
            var relativePath = Path.GetRelativePath(basePath, fullPath);

            // Create and save PdfFileRecord
            var record = new PdfFileRecord
            {
                FileName = Path.GetFileName(fullPath),
                RelativePath = relativePath,
                FullPath = fullPath,
                DocumentType = PdfDocumentType.SupplierInvoice,
                DocumentNumber = Path.GetFileNameWithoutExtension(fileName),
                RelatedEntityType = "SupplierInvoice",
                RelatedEntityId = supplierInvoiceId,
                SupplierName = supplierName,
                DocumentDate = documentDate,
                FileSizeBytes = pdfBytes.Length,
                CreatedAt = DateTime.UtcNow
            };

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            context.PdfFileRecords.Add(record);
            await context.SaveChangesAsync();

            _logger.LogInformation("Supplier PDF saved: {Path} ({Size} bytes)", relativePath, pdfBytes.Length);

            return new PdfFileInfo
            {
                Id = record.Id,
                FileName = record.FileName,
                RelativePath = relativePath,
                FullPath = fullPath,
                FileSizeBytes = pdfBytes.Length
            };
        }

        public bool FileExists(string filePath)
        {
            return File.Exists(filePath);
        }

        public byte[]? GetFileBytes(string filePath)
        {
            if (File.Exists(filePath))
            {
                return File.ReadAllBytes(filePath);
            }
            return null;
        }

        public async Task<List<PdfFileRecord>> GetAllPdfRecordsAsync(int companyId)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            return await context.PdfFileRecords
                .Where(r => r.CompanyId == companyId && !r.IsDeleted)
                .OrderByDescending(r => r.DocumentDate)
                .ToListAsync();
        }

        public async Task<FileConsistencyReport> CheckFileConsistencyAsync(int companyId)
        {
            var report = new FileConsistencyReport
            {
                CheckedAt = DateTime.UtcNow,
                CompanyId = companyId
            };

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            var allRecords = await context.PdfFileRecords
                .Where(r => r.CompanyId == companyId && !r.IsDeleted)
                .ToListAsync();

            report.TotalFiles = allRecords.Count;

            foreach (var record in allRecords)
            {
                if (File.Exists(record.FullPath))
                {
                    report.ExistingFiles++;
                }
                else
                {
                    report.MissingFiles++;
                    report.MissingFileRecords.Add(new MissingFileInfo
                    {
                        Id = record.Id,
                        FileName = record.FileName,
                        RelativePath = record.RelativePath,
                        ExpectedPath = record.FullPath,
                        DocumentType = record.DocumentType.ToString(),
                        DocumentNumber = record.DocumentNumber,
                        DocumentDate = record.DocumentDate,
                        HasCloudBackup = !string.IsNullOrEmpty(record.CloudUrl)
                    });
                }
            }

            return report;
        }

        public async Task<FileRecoveryResult> RecoverMissingFilesAsync(int companyId, List<int> fileIds)
        {
            var result = new FileRecoveryResult();

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var records = await context.PdfFileRecords
                .Where(r => r.CompanyId == companyId && fileIds.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync();

            foreach (var record in records)
            {
                if (File.Exists(record.FullPath))
                {
                    result.AlreadyExisted++;
                    continue;
                }

                if (string.IsNullOrEmpty(record.CloudUrl))
                {
                    result.Failed++;
                    result.Errors.Add($"{record.FileName}: No cloud backup available");
                    continue;
                }

                try
                {
                    // Download from cloud
                    using var httpClient = new HttpClient();
                    var pdfBytes = await httpClient.GetByteArrayAsync(record.CloudUrl);

                    // Ensure directory exists
                    var directory = Path.GetDirectoryName(record.FullPath);
                    if (!string.IsNullOrEmpty(directory))
                    {
                        Directory.CreateDirectory(directory);
                    }

                    // Save file
                    await File.WriteAllBytesAsync(record.FullPath, pdfBytes);
                    
                    result.Recovered++;
                    _logger.LogInformation("Recovered file: {Path}", record.RelativePath);
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    result.Errors.Add($"{record.FileName}: {ex.Message}");
                    _logger.LogError(ex, "Failed to recover file: {Path}", record.RelativePath);
                }
            }

            return result;
        }

        public async Task<bool> DeletePdfAsync(int pdfFileId)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            var record = await context.PdfFileRecords.FindAsync(pdfFileId);
            if (record == null) return false;

            // Delete file if exists
            if (File.Exists(record.FullPath))
            {
                try
                {
                    File.Delete(record.FullPath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete file: {Path}", record.FullPath);
                }
            }

            // Soft delete record
            record.IsDeleted = true;
            record.DeletedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();

            return true;
        }

        #region Helper Methods

        private static string SanitizeFolderName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "Unknown";
            
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(name.Where(c => !invalidChars.Contains(c)).ToArray());
            
            // Remove leading/trailing dots and spaces
            sanitized = sanitized.Trim('.', ' ');
            
            // Limit length
            if (sanitized.Length > 100)
            {
                sanitized = sanitized.Substring(0, 100);
            }
            
            return string.IsNullOrEmpty(sanitized) ? "Unknown" : sanitized;
        }

        private static string SanitizeFileName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "document";
            
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(name.Where(c => !invalidChars.Contains(c)).ToArray());
            
            sanitized = sanitized.Trim('.', ' ');
            
            if (sanitized.Length > 200)
            {
                sanitized = sanitized.Substring(0, 200);
            }
            
            return string.IsNullOrEmpty(sanitized) ? "document" : sanitized;
        }

        private static string GetFrenchMonth(int month)
        {
            if (month < 1 || month > 12) return "Unknown";
            return FrenchMonths[month - 1];
        }

        private static string GetDocumentTypeFolder(PdfDocumentType type)
        {
            return type switch
            {
                PdfDocumentType.Invoice => "Factures",
                PdfDocumentType.DeliveryNote => "BonsLivraison",
                PdfDocumentType.Quote => "Quotes",
                PdfDocumentType.SupplierInvoice => "SupplierInvoices",
                _ => "Autres"
            };
        }

        private static string GetUniqueFilePath(string filePath)
        {
            if (!File.Exists(filePath)) return filePath;

            var directory = Path.GetDirectoryName(filePath)!;
            var fileNameWithoutExt = Path.GetFileNameWithoutExtension(filePath);
            var extension = Path.GetExtension(filePath);
            var counter = 1;

            string newPath;
            do
            {
                newPath = Path.Combine(directory, $"{fileNameWithoutExt}_{counter}{extension}");
                counter++;
            }
            while (File.Exists(newPath));

            return newPath;
        }

        #endregion
    }

    #region Supporting Types

    public class PdfStorageConfig
    {
        public string BaseFolderPath { get; set; } = string.Empty;
        public DateTime ConfiguredAt { get; set; }
    }

    public class PdfFileInfo
    {
        public int Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string RelativePath { get; set; } = string.Empty;
        public string FullPath { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
    }

    public class FileConsistencyReport
    {
        public DateTime CheckedAt { get; set; }
        public int CompanyId { get; set; }
        public int TotalFiles { get; set; }
        public int ExistingFiles { get; set; }
        public int MissingFiles { get; set; }
        public List<MissingFileInfo> MissingFileRecords { get; set; } = new();
    }

    public class MissingFileInfo
    {
        public int Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string RelativePath { get; set; } = string.Empty;
        public string ExpectedPath { get; set; } = string.Empty;
        public string DocumentType { get; set; } = string.Empty;
        public string DocumentNumber { get; set; } = string.Empty;
        public DateTime DocumentDate { get; set; }
        public bool HasCloudBackup { get; set; }
    }

    public class FileRecoveryResult
    {
        public int Recovered { get; set; }
        public int AlreadyExisted { get; set; }
        public int Failed { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    #endregion
}
