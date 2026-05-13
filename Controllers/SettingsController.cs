using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;
using QuestPDF.Fluent;

namespace ResourceManager.Controllers
{
    [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
    public class SettingsController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<SettingsController> _logger;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private const long MaxLogoSize = 2 * 1024 * 1024; // 2MB max
        private readonly string[] _allowedImageTypes = { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
            { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

        /// <summary>Normalise non-standard MIME variants (e.g. image/jpg → image/jpeg).</summary>
        private static string NormaliseMime(string contentType)
        {
            var ct = contentType?.Trim().ToLowerInvariant() ?? string.Empty;
            return ct == "image/jpg" ? "image/jpeg" : ct;
        }

        /// <summary>Validates MIME type, file extension, AND magic-byte signature (defense in depth).</summary>
        private bool IsAllowedImage(IFormFile file)
        {
            var normalisedMime = NormaliseMime(file.ContentType);
            if (!_allowedImageTypes.Contains(normalisedMime)) return false;
            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant(); // normalize before HashSet lookup
            if (string.IsNullOrEmpty(ext) || !AllowedImageExtensions.Contains(ext)) return false;
            return HasValidImageSignature(file);
        }

        /// <summary>Verifies the first bytes of the upload match a known image format signature.
        /// Prevents an attacker from renaming a non-image file (e.g. shell.php → shell.jpg).</summary>
        private static bool HasValidImageSignature(IFormFile file)
        {
            try
            {
                // IFormFile.OpenReadStream returns a fresh stream each call, so downstream
                // consumers are unaffected by us reading the header here.
                using var stream = file.OpenReadStream();
                Span<byte> header = stackalloc byte[12];
                var read = stream.Read(header);
                if (read < 4) return false;

                // JPEG: FF D8 FF
                if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return true;
                // PNG: 89 50 4E 47 0D 0A 1A 0A
                if (read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                    && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A) return true;
                // GIF: 47 49 46 38 (GIF8)
                if (read >= 6 && header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x38) return true;
                // WEBP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  (RIFF....WEBP)
                if (read >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                    && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50) return true;

                return false;
            }
            catch
            {
                return false;
            }
        }

        public SettingsController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<SettingsController> logger,
            IEmailService emailService,
            IConfiguration configuration)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _emailService = emailService;
            _configuration = configuration;
        }

        // GET: api/settings/branding - Company branding info (accessible by ALL authenticated users)
        // AllowAnonymous overrides the class-level [Authorize(Roles=...)] so Employee can access this.
        // The method still returns Unauthorized() for truly anonymous requests.
        [HttpGet("branding")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBranding()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            var company = await _context.Companies.FindAsync(user.CompanyId);

            return Ok(new {
                CompanyName = company?.Name ?? "Resource Manager",
                HasLogoData = company?.LogoData != null && company.LogoData.Length > 0,
                PrimaryColor = settings?.PrimaryColor ?? "#667eea",
                SecondaryColor = settings?.SecondaryColor ?? "#764ba2",
                Currency = settings?.Currency ?? "TND",
                CurrencySymbol = settings?.CurrencySymbol ?? "TND",
                InvoiceLanguage = settings?.InvoiceLanguage ?? "fr"
            });
        }

        // GET: api/settings
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            // If user has no company yet, return empty defaults for company-init page
            if (user.CompanyId == 0)
            {
                return Ok(new {
                    Id = 0,
                    CompanyName = (string?)null,
                    CompanyAddress = (string?)null,
                    CompanyTaxId = (string?)null,
                    CompanyPhone = (string?)null,
                    CompanyEmail = (string?)null,
                    HasLogoData = false,
                    EmailTemplate = (string?)null,
                    EmailSubjectTemplate = "Invoice #@invoiceNumber from @companyName",
                    EmailSignature = "<p>Best regards,<br/>@companyName<br/>@companyPhone<br/>@companyEmail</p>",
                    DefaultEmailBody = "<p>Dear @clientName,</p><p>Please find attached your invoice.</p>",
                    LogoUrl = (string?)null,
                    PrimaryColor = "#667eea",
                    SecondaryColor = "#764ba2",
                    Currency = "TND",
                    CurrencySymbol = "TND",
                    DefaultVatRate = 0.19m,
                    AvailableVatRates = (string?)null,
                    CustomTaxEnabled = true,
                    CustomTaxName = "Timbre Fiscal",
                    CustomTaxAmount = 1.000m,
                    PdfFooterText = (string?)null,
                    ShowCompanyLogo = true,
                    PdfSignatureText = (string?)null,
                    PdfSignerPosition = (string?)null,
                    InvoiceLanguage = "fr",
                    FileSystemLanguage = "fr",
                    FileSystemLanguageLocked = false,
                    BaseStoragePath = (string?)null,
                    IsProfileComplete = false,
                    HasSignatureImage = false,
                    ShowSignatureOnPdf = false,
                    BankName = (string?)null,
                    BankBIC = (string?)null,
                    BankRIB = (string?)null,
                    BankIBAN = (string?)null,
                    ShowBankName = false,
                    ShowBankBIC = false,
                    ShowBankRIB = false,
                    ShowBankIBAN = false,
                    ProInvoiceUseTokenSignature = false,
                    WhatsAppPhoneNumberId = (string?)null,
                    WhatsAppAccessToken = (string?)null,
                    WhatsAppBusinessAccountId = (string?)null,
                    WhatsAppDisplayPhone = (string?)null,
                    WhatsAppEnabled = false
                });
            }

            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            var company = await _context.Companies.FindAsync(user.CompanyId);

            if (settings == null)
            {
                // Create default settings if none exist
                settings = new CompanySettings
                {
                    CompanyId = user.CompanyId,
                    Currency = "TND",
                    CurrencySymbol = "TND",
                    DefaultVatRate = 0.19m,
                    CustomTaxEnabled = true,
                    CustomTaxName = "Timbre Fiscal",
                    CustomTaxAmount = 1.000m,
                    PrimaryColor = "#667eea",
                    SecondaryColor = "#764ba2",
                    ShowCompanyLogo = true,
                    EmailSubjectTemplate = "Invoice #@invoiceNumber from @companyName",
                    DefaultEmailBody = @"<p>Dear @clientName,</p>
<p>Please find attached your invoice <strong>#@invoiceNumber</strong> dated @invoiceDate.</p>
<p><strong>Total Amount:</strong> @amount TND</p>
<p><strong>Due Date:</strong> @dueDate</p>
<p>Thank you for your business!</p>",
                    EmailSignature = @"<p>Best regards,<br/>@companyName<br/>@companyPhone<br/>@companyEmail</p>",
                    CreatedAt = DateTime.UtcNow
                };
                _context.CompanySettings.Add(settings);
                await _context.SaveChangesAsync();
            }

            return Ok(new {
                settings.Id,
                
                // Company info
                CompanyName = company?.Name,
                CompanyAddress = company?.Address,
                CompanyTaxId = company?.TaxId,
                CompanyPhone = company?.Phone,
                CompanyEmail = company?.Email,
                HasLogoData = company?.LogoData != null && company.LogoData.Length > 0,
                
                // Email settings
                settings.EmailTemplate,
                settings.EmailSubjectTemplate,
                settings.EmailSignature,
                settings.DefaultEmailBody,
                
                // Branding
                settings.LogoUrl,
                settings.PrimaryColor,
                settings.SecondaryColor,
                
                // Financial
                settings.Currency,
                settings.CurrencySymbol,
                settings.DefaultVatRate,
                settings.AvailableVatRates,
                settings.CustomTaxEnabled,
                settings.CustomTaxName,
                settings.CustomTaxAmount,
                
                // PDF
                settings.PdfFooterText,
                settings.ShowCompanyLogo,
                settings.PdfSignatureText,
                settings.PdfSignerPosition,
                settings.InvoiceLanguage,
                
                // File-system language
                settings.FileSystemLanguage,
                settings.FileSystemLanguageLocked,

                // Local Storage Path & Profile Completion
                settings.BaseStoragePath,
                settings.IsProfileComplete,
                
                // Signature
                HasSignatureImage = settings.SignatureImageData != null && settings.SignatureImageData.Length > 0,
                settings.ShowSignatureOnPdf,
                
                // Bank info
                settings.BankName,
                settings.BankBIC,
                settings.BankRIB,
                settings.BankIBAN,
                settings.ShowBankName,
                settings.ShowBankBIC,
                settings.ShowBankRIB,
                settings.ShowBankIBAN,
                
                // Pro Invoice token signature
                settings.ProInvoiceUseTokenSignature,
                
                // WhatsApp Business API
                settings.WhatsAppPhoneNumberId,
                WhatsAppAccessToken = !string.IsNullOrEmpty(settings.WhatsAppAccessToken) ? "••••••••" : null,
                settings.WhatsAppBusinessAccountId,
                settings.WhatsAppDisplayPhone,
                settings.WhatsAppEnabled
            });
        }

        // GET: api/settings/logo - Get company logo as image
        [HttpGet("logo")]
        [AllowAnonymous] // Allow logo to be accessed for PDF/email rendering
        public async Task<IActionResult> GetLogo()
        {
            var userId = _userManager.GetUserId(User);
            if (userId == null)
            {
                // For anonymous access, we'd need a different approach (company ID in query)
                return NotFound("Logo not found");
            }
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company?.LogoData == null || company.LogoData.Length == 0)
            {
                return NotFound("Logo not found");
            }

            return File(company.LogoData, company.LogoContentType ?? "image/png");
        }

        // POST: api/settings/logo - Upload company logo
        [HttpPost("logo")]
        [RequestSizeLimit(2 * 1024 * 1024)]
        public async Task<IActionResult> UploadLogo(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded" });
            }

            if (file.Length > MaxLogoSize)
            {
                return BadRequest(new { message = "File size must be less than 2MB" });
            }

            var normalisedMime = NormaliseMime(file.ContentType);
            if (!IsAllowedImage(file))
            {
                return BadRequest(new { message = "Only JPEG, PNG, GIF, and WebP images are allowed (check file extension and type)" });
            }

            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company == null) return NotFound("Company not found");

            try
            {
                // Read and compress image to reduce database storage size
                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                var originalBytes = memoryStream.ToArray();
                
                // If image is larger than 200KB, compress it using SkiaSharp or similar
                // For now, limit to 500KB to avoid timeout issues with remote database
                const int maxCompressedSize = 500 * 1024; // 500KB
                
                byte[] finalBytes = originalBytes;
                string contentType = normalisedMime;
                
                if (originalBytes.Length > maxCompressedSize)
                {
                    // Use SkiaSharp for cross-platform image processing
                    using var inputStream = new MemoryStream(originalBytes);
                    using var bitmap = SkiaSharp.SKBitmap.Decode(inputStream);
                    
                    if (bitmap != null)
                    {
                        // Calculate new dimensions (max 400px width for logos)
                        int maxWidth = 400;
                        int newWidth = Math.Min(bitmap.Width, maxWidth);
                        int newHeight = (int)((float)bitmap.Height / bitmap.Width * newWidth);
                        
                        // Resize image
#pragma warning disable CS0618 // SKFilterQuality is obsolete but SKSamplingOptions not available in this SkiaSharp version
                        using var resizedBitmap = bitmap.Resize(new SkiaSharp.SKImageInfo(newWidth, newHeight), SkiaSharp.SKFilterQuality.High);
#pragma warning restore CS0618
                        if (resizedBitmap != null)
                        {
                            using var image = SkiaSharp.SKImage.FromBitmap(resizedBitmap);
                            // Encode as JPEG with 80% quality for smaller size
                            using var encoded = image.Encode(SkiaSharp.SKEncodedImageFormat.Jpeg, 80);
                            finalBytes = encoded.ToArray();
                            contentType = "image/jpeg";
                            
                            _logger.LogInformation("Logo compressed from {Original} to {Compressed} bytes", 
                                originalBytes.Length, finalBytes.Length);
                        }
                    }
                }
                
                company.LogoData = finalBytes;
                company.LogoContentType = contentType;
                company.UpdatedAt = DateTime.UtcNow;
                company.ModifiedBy = user.Id;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Logo uploaded for company {CompanyId} by {UserId}, size: {Size} bytes", 
                    company.Id, user.Id, company.LogoData.Length);

                return Ok(new { 
                    message = "Logo uploaded successfully",
                    size = company.LogoData.Length,
                    contentType = company.LogoContentType
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading logo for company");
                return StatusCode(500, new { message = "Failed to upload logo. Please try a smaller image." });
            }
        }

        // DELETE: api/settings/logo - Remove company logo
        [HttpDelete("logo")]
        public async Task<IActionResult> DeleteLogo()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company == null) return NotFound("Company not found");

            company.LogoData = null;
            company.LogoContentType = null;
            company.UpdatedAt = DateTime.UtcNow;
            company.ModifiedBy = user.Id;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Logo removed for company {CompanyId} by {UserId}", company.Id, user.Id);

            return Ok(new { message = "Logo removed successfully" });
        }

        // POST: api/settings/signature - Upload signature/cachet image
        [HttpPost("signature")]
        [RequestSizeLimit(2 * 1024 * 1024)]
        public async Task<IActionResult> UploadSignature(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file uploaded" });
            if (file.Length > MaxLogoSize) return BadRequest(new { message = "File must be less than 2MB" });
            var normalisedSigMime = NormaliseMime(file.ContentType);
            if (!IsAllowedImage(file))
                return BadRequest(new { message = "Only JPEG, PNG, GIF, and WebP images are allowed (check file extension and type)" });

            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            if (settings == null) return NotFound("Settings not found");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            settings.SignatureImageData = ms.ToArray();
            settings.SignatureImageContentType = normalisedSigMime;
            settings.ShowSignatureOnPdf = true;
            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Signature uploaded for company {CompanyId}, size: {Size} bytes", user.CompanyId, settings.SignatureImageData.Length);
            return Ok(new { message = "Signature uploaded successfully", size = settings.SignatureImageData.Length });
        }

        // GET: api/settings/signature - Get signature image
        [HttpGet("signature")]
        public async Task<IActionResult> GetSignature()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            if (settings?.SignatureImageData == null || settings.SignatureImageData.Length == 0)
                return NotFound("Signature not found");

            return File(settings.SignatureImageData, settings.SignatureImageContentType ?? "image/png");
        }

        // DELETE: api/settings/signature - Remove signature image
        [HttpDelete("signature")]
        public async Task<IActionResult> DeleteSignature()
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            if (settings == null) return NotFound("Settings not found");

            settings.SignatureImageData = null;
            settings.SignatureImageContentType = null;
            settings.ShowSignatureOnPdf = false;
            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Signature removed successfully" });
        }

        // POST: api/settings/preview-pdf - Generate a sample PDF preview  
        [HttpPost("preview-pdf")]
        public async Task<IActionResult> PreviewPdf()
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var companySettings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            var company = await _context.Companies.FindAsync(user.CompanyId);

            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
            var creatorName = userProfile != null ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() : user.UserName ?? "";

            var pdfSettings = PdfSettings.FromCompanySettings(
                companySettings, company, creatorName,
                previewDefaults: true);

            var lang = pdfSettings.InvoiceLanguage?.ToLower() ?? "fr";

            // Create a sample invoice for preview
            var sampleInvoice = new Invoice
            {
                Number = lang switch { "fr" => "FACT-APERÇU", "de" => "RE-VORSCHAU", "ar" => "فاتورة-معاينة", _ => "INV-PREVIEW" },
                Date = DateTime.UtcNow,
                DueDate = DateTime.UtcNow.AddDays(30),
                Status = lang switch { "fr" => "Non payé", "de" => "Unbezahlt", _ => "Unpaid" },
                Client = new Client
                {
                    Name = lang switch { "fr" => "Client Exemple", "de" => "Beispielkunde", "ar" => "عميل مثال", _ => "Sample Client" },
                    Address = lang switch { "fr" => "456 Rue du Client, Tunis", "de" => "456 Kundenstr., Berlin", _ => "456 Client Street" },
                    TaxId = "999XYZ999",
                    Phone = "+216 99 999 999"
                },
                Tfiscal = pdfSettings.CustomTaxEnabled ? pdfSettings.CustomTaxAmount : 0,
                TfiscalName = pdfSettings.CustomTaxName,
                CompanyId = user.CompanyId
            };

            var descService = lang switch { "fr" => "Service de consultation", "de" => "Beratungsdienstleistung", "ar" => "خدمة استشارية", _ => "Consulting Service" };
            var descLicense = lang switch { "fr" => "Licence logiciel annuelle", "de" => "Jährliche Softwarelizenz", "ar" => "ترخيص برمجيات سنوي", _ => "Annual Software License" };

            sampleInvoice.InvoiceItems = new List<InvoiceItem>
            {
                new() { Description = descService, Quantity = 5, Price = 200.000m, Tva = true },
                new() { Description = descLicense, Quantity = 1, Price = 500.000m, Tva = true }
            };
            sampleInvoice.CalculTotalAmount();

            var document = new ResourceManager.Services.Document<Invoice>(sampleInvoice, pdfSettings);
            var pdfData = document.GeneratePdf();

            return File(pdfData, "application/pdf", "preview.pdf");
        }

        // PUT: api/settings
        [HttpPut]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto dto)
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            // Log incoming signature fields for debugging
            _logger.LogInformation("UpdateSettings received - PdfSignatureText: '{SignatureText}' (IsNull: {IsNull}), PdfSignerPosition: '{SignerPosition}' (IsNull: {IsNull2})",
                dto.PdfSignatureText, dto.PdfSignatureText == null, dto.PdfSignerPosition, dto.PdfSignerPosition == null);

            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            if (settings == null)
            {
                settings = new CompanySettings { CompanyId = user.CompanyId };
                _context.CompanySettings.Add(settings);
            }

            // Handle BaseStoragePath Locking Logic
            if (!string.IsNullOrEmpty(dto.BaseStoragePath))
            {
                if (!string.IsNullOrEmpty(settings.BaseStoragePath) && settings.BaseStoragePath != dto.BaseStoragePath)
                {
                    // Allow SuperAdmin to override the lock
                    var userRoles = await _userManager.GetRolesAsync(user);
                    if (dto.OverrideLock == true && userRoles.Contains("SuperAdmin"))
                    {
                        _logger.LogWarning("SuperAdmin override: changing BaseStoragePath for company {CompanyId}", user.CompanyId);
                        settings.BaseStoragePath = dto.BaseStoragePath;
                    }
                    else
                    {
                        _logger.LogWarning("Attempt to change locked BaseStoragePath for company {CompanyId}", user.CompanyId);
                        return BadRequest(new { message = "Storage Path is locked and cannot be changed." });
                    }
                }

                // If setting for the first time
                if (string.IsNullOrEmpty(settings.BaseStoragePath))
                {
                    settings.BaseStoragePath = dto.BaseStoragePath;
                    settings.IsProfileComplete = true; // Mark profile as complete once path is set
                }
            }

            // Update settings
            if (dto.EmailTemplate != null) settings.EmailTemplate = dto.EmailTemplate;
            if (dto.EmailSubjectTemplate != null) settings.EmailSubjectTemplate = dto.EmailSubjectTemplate;
            if (dto.EmailSignature != null) settings.EmailSignature = dto.EmailSignature;
            if (dto.DefaultEmailBody != null) settings.DefaultEmailBody = dto.DefaultEmailBody;
            if (dto.LogoUrl != null) settings.LogoUrl = dto.LogoUrl;
            if (dto.PrimaryColor != null) settings.PrimaryColor = dto.PrimaryColor;
            if (dto.SecondaryColor != null) settings.SecondaryColor = dto.SecondaryColor;
            if (dto.Currency != null) settings.Currency = dto.Currency;
            if (dto.CurrencySymbol != null) settings.CurrencySymbol = dto.CurrencySymbol;
            if (dto.DefaultVatRate.HasValue) settings.DefaultVatRate = dto.DefaultVatRate.Value;
            if (dto.AvailableVatRates != null) settings.AvailableVatRates = dto.AvailableVatRates;
            if (dto.CustomTaxEnabled.HasValue) settings.CustomTaxEnabled = dto.CustomTaxEnabled.Value;
            if (dto.CustomTaxName != null) settings.CustomTaxName = dto.CustomTaxName;
            if (dto.CustomTaxAmount.HasValue) settings.CustomTaxAmount = dto.CustomTaxAmount.Value;
            if (dto.PdfFooterText != null) settings.PdfFooterText = dto.PdfFooterText;
            if (dto.ShowCompanyLogo.HasValue) settings.ShowCompanyLogo = dto.ShowCompanyLogo.Value;
            
            // Signature fields - always save when provided (empty string clears the field)
            // Frontend sends trimmed strings (empty string = clear, non-empty = set value)
            if (dto.PdfSignatureText != null)
            {
                settings.PdfSignatureText = string.IsNullOrWhiteSpace(dto.PdfSignatureText) ? null : dto.PdfSignatureText.Trim();
            }
            if (dto.PdfSignerPosition != null)
            {
                settings.PdfSignerPosition = string.IsNullOrWhiteSpace(dto.PdfSignerPosition) ? null : dto.PdfSignerPosition.Trim();
            }
            
            _logger.LogInformation("Signature fields saved - Text: '{SignatureText}', Position: '{SignerPosition}'", 
                settings.PdfSignatureText ?? "(null)", settings.PdfSignerPosition ?? "(null)");
            
            if (dto.InvoiceLanguage != null) settings.InvoiceLanguage = dto.InvoiceLanguage;
            if (dto.ShowSignatureOnPdf.HasValue) settings.ShowSignatureOnPdf = dto.ShowSignatureOnPdf.Value;
            if (dto.BankName != null) settings.BankName = dto.BankName;
            if (dto.BankBIC != null) settings.BankBIC = dto.BankBIC;
            if (dto.BankRIB != null) settings.BankRIB = dto.BankRIB;
            if (dto.BankIBAN != null) settings.BankIBAN = dto.BankIBAN;
            if (dto.ShowBankName.HasValue) settings.ShowBankName = dto.ShowBankName.Value;
            if (dto.ShowBankBIC.HasValue) settings.ShowBankBIC = dto.ShowBankBIC.Value;
            if (dto.ShowBankRIB.HasValue) settings.ShowBankRIB = dto.ShowBankRIB.Value;
            if (dto.ShowBankIBAN.HasValue) settings.ShowBankIBAN = dto.ShowBankIBAN.Value;
            if (dto.ProInvoiceUseTokenSignature.HasValue) settings.ProInvoiceUseTokenSignature = dto.ProInvoiceUseTokenSignature.Value;
            
            // WhatsApp Business API
            if (dto.WhatsAppPhoneNumberId != null) settings.WhatsAppPhoneNumberId = string.IsNullOrWhiteSpace(dto.WhatsAppPhoneNumberId) ? null : dto.WhatsAppPhoneNumberId.Trim();
            if (dto.WhatsAppAccessToken != null && dto.WhatsAppAccessToken != "••••••••") settings.WhatsAppAccessToken = string.IsNullOrWhiteSpace(dto.WhatsAppAccessToken) ? null : dto.WhatsAppAccessToken.Trim();
            if (dto.WhatsAppBusinessAccountId != null) settings.WhatsAppBusinessAccountId = string.IsNullOrWhiteSpace(dto.WhatsAppBusinessAccountId) ? null : dto.WhatsAppBusinessAccountId.Trim();
            if (dto.WhatsAppEnabled.HasValue) settings.WhatsAppEnabled = dto.WhatsAppEnabled.Value;
            
            // File-system language: set once, immutable after lock
            if (dto.FileSystemLanguage != null)
            {
                if (settings.FileSystemLanguageLocked)
                {
                    if (!string.Equals(settings.FileSystemLanguage, dto.FileSystemLanguage, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Attempt to change locked FileSystemLanguage for company {CompanyId}", user.CompanyId);
                        return BadRequest(new { message = "File-system language is locked and cannot be changed." });
                    }
                }
                else
                {
                    settings.FileSystemLanguage = dto.FileSystemLanguage;
                    settings.FileSystemLanguageLocked = true; // Lock immediately upon first set
                }
            }
            
            settings.UpdatedAt = DateTime.UtcNow;

            _logger.LogInformation("Saving settings for company {CompanyId}", user.CompanyId);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Settings updated for company {CompanyId}", user.CompanyId);

            return Ok(new { message = "Settings updated successfully." });
        }

        // PUT: api/settings/company
        [HttpPut("company")]
        public async Task<IActionResult> UpdateCompanyInfo([FromBody] UpdateCompanyDto dto)
        {
            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company == null) return NotFound("Company not found");

            if (dto.Name != null) company.Name = dto.Name;
            if (dto.Address != null) company.Address = dto.Address;
            if (dto.TaxId != null) company.TaxId = dto.TaxId;
            if (dto.Phone != null) company.Phone = dto.Phone;
            if (dto.Email != null) company.Email = dto.Email;
            
            // Audit trail
            company.UpdatedAt = DateTime.UtcNow;
            company.ModifiedBy = user.Id;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Company info updated for {CompanyId} by {UserId}", user.CompanyId, user.Id);

            return Ok(new { message = "Company information updated successfully." });
        }

        // GET: api/settings/email-placeholders - Get available email placeholders
        [HttpGet("email-placeholders")]
        public IActionResult GetEmailPlaceholders()
        {
            var placeholders = new[]
            {
                new { name = "@clientName", description = "Client's full name" },
                new { name = "@clientEmail", description = "Client's email address" },
                new { name = "@clientAddress", description = "Client's address" },
                new { name = "@clientPhone", description = "Client's phone number" },
                new { name = "@invoiceNumber", description = "Invoice number" },
                new { name = "@invoiceDate", description = "Invoice date" },
                new { name = "@dueDate", description = "Payment due date" },
                new { name = "@amount", description = "Total amount" },
                new { name = "@amountPaid", description = "Amount already paid" },
                new { name = "@remainingAmount", description = "Remaining balance" },
                new { name = "@status", description = "Invoice status" },
                new { name = "@companyName", description = "Your company name" },
                new { name = "@companyPhone", description = "Your company phone" },
                new { name = "@companyAddress", description = "Your company address" },
                new { name = "@companyEmail", description = "Your company email" }
            };

            return Ok(placeholders);
        }

        // GET: api/settings/email-status - Get email configuration status
        [HttpGet("email-status")]
        public IActionResult GetEmailStatus()
        {
            var config = _emailService.GetConfiguration();
            return Ok(new
            {
                config.SmtpHost,
                config.SmtpPort,
                config.EnableSsl,
                config.FromEmail,
                config.FromName,
                config.IsConfigured,
                config.ConfigurationError,
                productionSetup = new
                {
                    instructions = new[]
                    {
                        "1. Configure your domain's mail server (e.g., mail.rscmanager.com)",
                        "2. Create SMTP credentials for your application",
                        "3. Set environment variables for HOST, USER, PASSWORD",
                        "4. Use port 587 with STARTTLS for secure delivery",
                        "5. Configure SPF, DKIM, and DMARC DNS records"
                    },
                    appsettingsExample = @"{
  ""Email"": {
    ""SmtpHost"": ""mail.rscmanager.com"",
    ""SmtpPort"": 587,
    ""SmtpUser"": ""noreply@rscmanager.com"",
    ""SmtpPassword"": ""your-smtp-password"",
    ""FromEmail"": ""noreply@rscmanager.com"",
    ""FromName"": ""Resource Manager"",
    ""ReplyToEmail"": ""support@rscmanager.com"",
    ""EnableSsl"": true
  }
}",
                    environmentVariables = new[]
                    {
                        "EMAIL_SMTP_HOST",
                        "EMAIL_SMTP_PORT",
                        "EMAIL_SMTP_USER",
                        "EMAIL_SMTP_PASSWORD",
                        "EMAIL_FROM_ADDRESS",
                        "EMAIL_FROM_NAME",
                        "EMAIL_ENABLE_SSL"
                    }
                }
            });
        }

        // POST: api/settings/test-email - Send a test email via SMTP
        [HttpPost("test-email")]
        public async Task<IActionResult> SendTestEmail([FromBody] TestEmailDto dto)
        {
            if (string.IsNullOrEmpty(dto.ToEmail))
            {
                return BadRequest(new { success = false, message = "Email address is required" });
            }

            var user = await GetCurrentUserAsync(_userManager);
            if (user == null) return Unauthorized();

            _logger.LogInformation("Sending test email via SMTP to {To}", dto.ToEmail);
            var result = await _emailService.SendEmailAsync(
                dto.ToEmail,
                dto.Subject ?? "Resource Manager Test Email",
                dto.Body ?? @"<html><body>
                    <h2>Test Email from Resource Manager</h2>
                    <p>This is a test email to verify your email configuration is working correctly.</p>
                    <p>If you received this email, your SMTP settings are properly configured!</p>
                    <hr/>
                    <p style='color: #666; font-size: 12px;'>Sent at: " + DateTime.UtcNow.ToString("f") + @" (UTC)</p>
                </body></html>"
            );

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    mode = "SMTP"
                });
            }
            else
            {
                return StatusCode(result.BounceType != null ? 422 : 400, new
                {
                    success = false,
                    message = result.Message,
                    mode = "SMTP",
                    errorDetails = result.ErrorDetails,
                    bounceType = result.BounceType,
                    bounceStatus = result.BounceStatus
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // WHATSAPP EMBEDDED SIGNUP
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Returns the Meta App ID needed by the frontend Facebook SDK
        /// </summary>
        [HttpGet("whatsapp/app-id")]
        public IActionResult GetWhatsAppAppId()
        {
            var appId = _configuration["WhatsApp:MetaAppId"];
            if (string.IsNullOrEmpty(appId) || appId == "SET_VIA_ENVIRONMENT")
                return Ok(new { appId = (string?)null, configId = (string?)null, configured = false });

            var configId = _configuration["WhatsApp:EmbeddedSignupConfigId"];
            return Ok(new { appId, configId, configured = true });
        }

        /// <summary>
        /// Exchange Embedded Signup authorization code for WhatsApp credentials
        /// </summary>
        [HttpPost("whatsapp/connect")]
        public async Task<IActionResult> ConnectWhatsApp([FromBody] WhatsAppConnectDto dto, [FromServices] IWhatsAppService whatsAppService)
        {
            if (string.IsNullOrEmpty(dto.Code))
                return BadRequest(new { error = "Authorization code is required" });

            var companyId = GetCompanyId();
            if (companyId == null)
                return BadRequest(new { error = "Company not found" });

            try
            {
                var result = await whatsAppService.ExchangeEmbeddedSignupCodeAsync(dto.Code, companyId.Value);
                if (!result.Success)
                    return BadRequest(new { error = result.Error });

                return Ok(new
                {
                    success = true,
                    phoneNumberId = result.PhoneNumberId,
                    businessAccountId = result.BusinessAccountId,
                    displayPhone = result.DisplayPhone
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WhatsApp Embedded Signup failed for Company {CompanyId}", companyId);
                return StatusCode(500, new { error = "Failed to connect WhatsApp. Please try again." });
            }
        }

        /// <summary>
        /// Disconnect WhatsApp — clears all stored credentials
        /// </summary>
        [HttpPost("whatsapp/disconnect")]
        public async Task<IActionResult> DisconnectWhatsApp()
        {
            var companyId = GetCompanyId();
            if (companyId == null)
                return BadRequest(new { error = "Company not found" });

            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == companyId);

            if (settings == null)
                return NotFound(new { error = "Settings not found" });

            settings.WhatsAppPhoneNumberId = null;
            settings.WhatsAppAccessToken = null;
            settings.WhatsAppBusinessAccountId = null;
            settings.WhatsAppDisplayPhone = null;
            settings.WhatsAppEnabled = false;

            await _context.SaveChangesAsync();

            _logger.LogInformation("WhatsApp disconnected for Company {CompanyId}", companyId);
            return Ok(new { success = true });
        }

        private int? GetCompanyId()
        {
            var claim = User.FindFirst("CompanyId")?.Value;
            return int.TryParse(claim, out var id) ? id : null;
        }
    }

    public class TestEmailDto
    {
        public string ToEmail { get; set; } = string.Empty;
        public string? Subject { get; set; }
        public string? Body { get; set; }
    }

    public class UpdateSettingsDto
    {
        public string? EmailTemplate { get; set; }
        public string? EmailSubjectTemplate { get; set; }
        public string? EmailSignature { get; set; }
        public string? DefaultEmailBody { get; set; }
        public string? LogoUrl { get; set; }
        public string? PrimaryColor { get; set; }
        public string? SecondaryColor { get; set; }
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        public decimal? DefaultVatRate { get; set; }
        public string? AvailableVatRates { get; set; }
        public bool? CustomTaxEnabled { get; set; }
        public string? CustomTaxName { get; set; }
        public decimal? CustomTaxAmount { get; set; }
        public string? PdfFooterText { get; set; }
        public bool? ShowCompanyLogo { get; set; }
        
        /// <summary>Signature name/text displayed on PDF (e.g., "John Smith")</summary>
        [MaxLength(100, ErrorMessage = "Signature text cannot exceed 100 characters")]
        public string? PdfSignatureText { get; set; }
        
        /// <summary>Signer position/title displayed on PDF (e.g., "Managing Director")</summary>
        [MaxLength(100, ErrorMessage = "Signer position cannot exceed 100 characters")]
        public string? PdfSignerPosition { get; set; }
        
        public string? InvoiceLanguage { get; set; }
        
        // File-system language (set once, immutable after lock)
        public string? FileSystemLanguage { get; set; }

        // Local Storage Path & Profile Completion
        public string? BaseStoragePath { get; set; }

        /// <summary>If true and caller is SuperAdmin, allows overriding a locked BaseStoragePath.</summary>
        public bool? OverrideLock { get; set; }
        
        // Signature
        public bool? ShowSignatureOnPdf { get; set; }
        
        // Bank info
        public string? BankName { get; set; }
        public string? BankBIC { get; set; }
        public string? BankRIB { get; set; }
        public string? BankIBAN { get; set; }
        public bool? ShowBankName { get; set; }
        public bool? ShowBankBIC { get; set; }
        public bool? ShowBankRIB { get; set; }
        public bool? ShowBankIBAN { get; set; }
        
        // Pro Invoice token signature
        public bool? ProInvoiceUseTokenSignature { get; set; }
        
        // WhatsApp Business API
        public string? WhatsAppPhoneNumberId { get; set; }
        public string? WhatsAppAccessToken { get; set; }
        public string? WhatsAppBusinessAccountId { get; set; }
        public bool? WhatsAppEnabled { get; set; }
    }

    public class UpdateCompanyDto
    {
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? TaxId { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }

    public class WhatsAppConnectDto
    {
        [Required]
        public string Code { get; set; } = string.Empty;
    }
}
