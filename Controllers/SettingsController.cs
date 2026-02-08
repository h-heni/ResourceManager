using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        private const long MaxLogoSize = 2 * 1024 * 1024; // 2MB max
        private readonly string[] _allowedImageTypes = { "image/jpeg", "image/png", "image/gif", "image/webp" };

        public SettingsController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<SettingsController> logger,
            IEmailService emailService)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _emailService = emailService;
        }

        // GET: api/settings
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            
            if (user == null) return Unauthorized();

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
                CompanyMatriculeFiscal = company?.MatriculeFiscal,
                CompanyPhone = company?.Phone,
                CompanyEmail = company?.Email,
                HasLogo = company?.LogoData != null && company.LogoData.Length > 0,
                
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
                settings.InvoiceLanguage,
                
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
                settings.ShowBankIBAN
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

            if (!_allowedImageTypes.Contains(file.ContentType.ToLower()))
            {
                return BadRequest(new { message = "Only JPEG, PNG, GIF, and WebP images are allowed" });
            }

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
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
                string contentType = file.ContentType;
                
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
                        using var resizedBitmap = bitmap.Resize(new SkiaSharp.SKImageInfo(newWidth, newHeight), SkiaSharp.SKFilterQuality.High);
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

                await _context.SaveChangesAsync();

                _logger.LogInformation("Logo uploaded for company {CompanyId}, size: {Size} bytes", 
                    company.Id, company.LogoData.Length);

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
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company == null) return NotFound("Company not found");

            company.LogoData = null;
            company.LogoContentType = null;
            company.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Logo removed for company {CompanyId}", company.Id);

            return Ok(new { message = "Logo removed successfully" });
        }

        // POST: api/settings/signature - Upload signature/cachet image
        [HttpPost("signature")]
        public async Task<IActionResult> UploadSignature(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file uploaded" });
            if (file.Length > MaxLogoSize) return BadRequest(new { message = "File must be less than 2MB" });
            if (!_allowedImageTypes.Contains(file.ContentType.ToLower()))
                return BadRequest(new { message = "Only JPEG, PNG, GIF, and WebP images are allowed" });

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            if (settings == null) return NotFound("Settings not found");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            settings.SignatureImageData = ms.ToArray();
            settings.SignatureImageContentType = file.ContentType;
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
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
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
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
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

            var pdfSettings = new ResourceManager.Services.PdfSettings
            {
                PrimaryColor = companySettings?.PrimaryColor ?? "#667eea",
                SecondaryColor = companySettings?.SecondaryColor ?? "#764ba2",
                CurrencySymbol = companySettings?.CurrencySymbol ?? "TND",
                ShowLogo = companySettings?.ShowCompanyLogo ?? true,
                LogoData = company?.LogoData,
                FooterText = companySettings?.PdfFooterText,
                CompanyName = company?.Name ?? "Your Company",
                CompanyAddress = company?.Address ?? "123 Business St",
                CompanyTaxId = company?.MatriculeFiscal ?? "000ABC000",
                CompanyPhone = company?.Phone ?? "+216 00 000 000",
                CustomTaxEnabled = companySettings?.CustomTaxEnabled ?? true,
                CustomTaxName = companySettings?.CustomTaxName ?? "Timbre Fiscal",
                CustomTaxAmount = companySettings?.CustomTaxAmount ?? 1.000m,
                CreatedByName = creatorName,
                PdfSignatureText = companySettings?.PdfSignatureText,
                InvoiceLanguage = companySettings?.InvoiceLanguage ?? "fr",
                SignatureImageData = companySettings?.SignatureImageData,
                ShowSignatureOnPdf = companySettings?.ShowSignatureOnPdf ?? false,
                BankName = companySettings?.BankName,
                BankBIC = companySettings?.BankBIC,
                BankRIB = companySettings?.BankRIB,
                BankIBAN = companySettings?.BankIBAN,
                ShowBankName = companySettings?.ShowBankName ?? true,
                ShowBankBIC = companySettings?.ShowBankBIC ?? true,
                ShowBankRIB = companySettings?.ShowBankRIB ?? true,
                ShowBankIBAN = companySettings?.ShowBankIBAN ?? true
            };

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
                    MatriculeFiscal = "999XYZ999",
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
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            
            if (user == null) return Unauthorized();

            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            if (settings == null)
            {
                settings = new CompanySettings { CompanyId = user.CompanyId };
                _context.CompanySettings.Add(settings);
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
            if (dto.PdfSignatureText != null) settings.PdfSignatureText = dto.PdfSignatureText;
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
            
            settings.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Settings updated for company {CompanyId}", user.CompanyId);

            return Ok(new { message = "Settings updated successfully." });
        }

        // PUT: api/settings/company
        [HttpPut("company")]
        public async Task<IActionResult> UpdateCompanyInfo([FromBody] UpdateCompanyDto dto)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            
            if (user == null) return Unauthorized();

            var company = await _context.Companies.FindAsync(user.CompanyId);
            if (company == null) return NotFound("Company not found");

            if (dto.Name != null) company.Name = dto.Name;
            if (dto.Address != null) company.Address = dto.Address;
            if (dto.MatriculeFiscal != null) company.MatriculeFiscal = dto.MatriculeFiscal;
            if (dto.Phone != null) company.Phone = dto.Phone;
            if (dto.Email != null) company.Email = dto.Email;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Company info updated for {CompanyId}", user.CompanyId);

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

        // GET: api/settings/email-status - Get email configuration status and testing info
        [HttpGet("email-status")]
        public IActionResult GetEmailStatus()
        {
            var testInfo = _emailService.GetTestInfo();
            return Ok(new
            {
                testInfo.Mode,
                testInfo.ModeDescription,
                testInfo.SmtpHost,
                testInfo.SmtpPort,
                testInfo.CredentialsConfigured,
                testInfo.PreviewDirectory,
                testInfo.SpamPreventionChecklist,
                testInfo.DnsRequirements,
                localTestingOptions = new object[]
                {
                    new { 
                        name = "Mailpit", 
                        description = "Modern email testing tool with web UI", 
                        configExample = "SmtpHost: localhost, SmtpPort: 1025",
                        webUI = "http://localhost:8025",
                        installCommand = "docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit"
                    },
                    new { 
                        name = "Papercut SMTP", 
                        description = "Lightweight Windows email testing tool", 
                        configExample = "SmtpHost: localhost, SmtpPort: 25",
                        webUI = "Desktop app",
                        installCommand = "Download from https://github.com/ChangemakerStudios/Papercut-SMTP/releases"
                    },
                    new { 
                        name = "Preview Mode (Current)", 
                        description = "Emails saved to files - no SMTP needed", 
                        configExample = "SmtpHost: smtp.gmail.com, SmtpPort: 587, SmtpUser: empty, SmtpPassword: empty",
                        webUI = testInfo.PreviewDirectory,
                        installCommand = "No installation needed - just leave SMTP credentials empty"
                    }
                },
                productionSetup = new
                {
                    gmailInstructions = new[]
                    {
                        "1. Enable 2FA on your Google account",
                        "2. Go to https://myaccount.google.com/apppasswords",
                        "3. Generate an App Password for 'Mail'",
                        "4. Use that 16-character password as SmtpPassword",
                        "5. Set SmtpUser to your full Gmail address"
                    },
                    appsettingsExample = @"{
  ""Email"": {
    ""SmtpHost"": ""smtp.gmail.com"",
    ""SmtpPort"": 587,
    ""SmtpUser"": ""your-email@gmail.com"",
    ""SmtpPassword"": ""your-16-char-app-password"",
    ""FromEmail"": ""your-email@gmail.com"",
    ""FromName"": ""Your Company Name"",
    ""ReplyToEmail"": ""your-email@gmail.com"",
    ""EnableSsl"": true
  }
}"
                }
            });
        }

        // POST: api/settings/test-email - Send a test email (uses Gmail OAuth if connected, otherwise SMTP)
        [HttpPost("test-email")]
        public async Task<IActionResult> SendTestEmail(
            [FromBody] TestEmailDto dto,
            [FromServices] IGmailOAuthService gmailService)
        {
            if (string.IsNullOrEmpty(dto.ToEmail))
            {
                return BadRequest(new { success = false, message = "Email address is required" });
            }

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            // Check if Gmail OAuth is connected and verified
            var gmailStatus = await gmailService.GetConnectionStatusAsync(user.CompanyId);
            
            if (gmailStatus.IsConnected)
            {
                // Use Gmail OAuth
                _logger.LogInformation("Sending test email via Gmail OAuth to {To}", dto.ToEmail);
                var gmailResult = await gmailService.SendEmailAsync(
                    user.CompanyId,
                    dto.ToEmail,
                    dto.Subject ?? "Resource Manager Test Email - Gmail OAuth",
                    dto.Body ?? @"<html><body>
                        <h2>Test Email from Resource Manager</h2>
                        <p>This is a test email sent via <strong>Gmail OAuth</strong>.</p>
                        <p>If you received this email, your Gmail integration is working correctly!</p>
                        <hr/>
                        <p style='color: #666; font-size: 12px;'>Sent at: " + DateTime.Now.ToString("f") + @"</p>
                    </body></html>"
                );

                if (gmailResult.Success)
                {
                    return Ok(new
                    {
                        success = true,
                        message = gmailResult.Message,
                        mode = "GmailOAuth",
                        info = "Email sent via Gmail OAuth integration"
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = gmailResult.Message,
                        mode = "GmailOAuth",
                        errorDetails = gmailResult.ErrorDetails
                    });
                }
            }
            
            // Fall back to SMTP
            _logger.LogInformation("Sending test email via SMTP to {To} (Gmail OAuth not connected)", dto.ToEmail);
            var result = await _emailService.SendEmailAsync(
                dto.ToEmail,
                dto.Subject ?? "Resource Manager Test Email",
                dto.Body ?? @"<html><body>
                    <h2>Test Email from Resource Manager</h2>
                    <p>This is a test email to verify your email configuration is working correctly.</p>
                    <p>If you received this email, your SMTP settings are properly configured!</p>
                    <hr/>
                    <p style='color: #666; font-size: 12px;'>Sent at: " + DateTime.Now.ToString("f") + @"</p>
                </body></html>"
            );

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    mode = result.Mode.ToString(),
                    previewPath = result.PreviewPath
                });
            }
            else
            {
                return BadRequest(new
                {
                    success = false,
                    message = result.Message,
                    mode = result.Mode.ToString(),
                    errorDetails = result.ErrorDetails
                });
            }
        }

        // ============================================
        // GMAIL OAUTH ENDPOINTS (NO APP PASSWORDS!)
        // ============================================

        // GET: api/settings/email/oauth/status - Get Gmail OAuth connection status
        [HttpGet("email/oauth/status")]
        public async Task<IActionResult> GetGmailOAuthStatus([FromServices] IGmailOAuthService gmailService)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var status = await gmailService.GetConnectionStatusAsync(user.CompanyId);
            
            return Ok(new
            {
                status.IsConnected,
                status.ConnectedEmail,
                status.ConnectedAt,
                status.NeedsReauth,
                status.Provider,
                message = status.IsConnected 
                    ? $"Connected to {status.ConnectedEmail}" 
                    : "Not connected. Click 'Connect Gmail' to authorize."
            });
        }

        // GET: api/settings/email/oauth/connect - Get OAuth authorization URL
        [HttpGet("email/oauth/connect")]
        public async Task<IActionResult> GetGmailOAuthUrl([FromServices] IGmailOAuthService gmailService, [FromQuery] string? redirectUri)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            try
            {
                // Use provided redirect URI or default to frontend callback
                var callbackUri = redirectUri ?? $"{Request.Scheme}://{Request.Host}/settings/email/callback";
                
                _logger.LogInformation(
                    "OAuth connect requested. Frontend redirect URI: '{RedirectUri}', Final callback URI: '{CallbackUri}'",
                    redirectUri, callbackUri);
                
                var authUrl = gmailService.GetAuthorizationUrl(user.CompanyId, callbackUri);
                
                _logger.LogInformation("Generated Google auth URL. Redirect URI registered: '{CallbackUri}'", callbackUri);
                
                return Ok(new
                {
                    authorizationUrl = authUrl,
                    redirectUri = callbackUri,  // Return the URI so frontend can verify it matches
                    message = "Redirect user to this URL to connect their Gmail account"
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // POST: api/settings/email/oauth/callback - Exchange authorization code for tokens
        [HttpPost("email/oauth/callback")]
        public async Task<IActionResult> HandleGmailOAuthCallback(
            [FromServices] IGmailOAuthService gmailService,
            [FromBody] OAuthCallbackDto dto)
        {
            _logger.LogInformation("OAuth callback received. Code length: {CodeLen}, RedirectUri: {RedirectUri}",
                dto.Code?.Length ?? 0, dto.RedirectUri);
            
            // Validate required parameters
            if (string.IsNullOrEmpty(dto.Code))
            {
                _logger.LogWarning("OAuth callback missing authorization code");
                return BadRequest(new
                {
                    success = false,
                    message = "Authorization code is missing. Please try connecting Gmail again.",
                    errorDetails = "The 'code' parameter was not provided in the callback."
                });
            }
            
            if (string.IsNullOrEmpty(dto.RedirectUri))
            {
                _logger.LogWarning("OAuth callback missing redirectUri");
                return BadRequest(new
                {
                    success = false,
                    message = "Redirect URI is missing. Please try connecting Gmail again.",
                    errorDetails = "The 'redirectUri' parameter was not provided in the callback."
                });
            }
            
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var result = await gmailService.ExchangeCodeForTokenAsync(user.CompanyId, dto.Code, dto.RedirectUri);
            
            if (result.Success)
            {
                _logger.LogInformation("OAuth callback succeeded for company {CompanyId}", user.CompanyId);
                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            else
            {
                _logger.LogWarning("OAuth callback failed for company {CompanyId}: {Message} | {Details}",
                    user.CompanyId, result.Message, result.ErrorDetails);
                return BadRequest(new
                {
                    success = false,
                    message = result.Message,
                    errorDetails = result.ErrorDetails
                });
            }
        }

        // DELETE: api/settings/email/oauth/disconnect - Remove Gmail connection
        [HttpDelete("email/oauth/disconnect")]
        public async Task<IActionResult> DisconnectGmail([FromServices] IGmailOAuthService gmailService)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            await gmailService.DisconnectAsync(user.CompanyId);
            
            return Ok(new { message = "Gmail disconnected successfully" });
        }

        // POST: api/settings/email/oauth/test - Test Gmail OAuth connection
        [HttpPost("email/oauth/test")]
        public async Task<IActionResult> TestGmailOAuth([FromServices] IGmailOAuthService gmailService)
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var isConnected = await gmailService.TestConnectionAsync(user.CompanyId);
            
            return Ok(new
            {
                success = isConnected,
                message = isConnected ? "Gmail connection is working!" : "Gmail connection test failed. Please reconnect."
            });
        }
    }

    public class OAuthCallbackDto
    {
        public string Code { get; set; } = string.Empty;
        public string RedirectUri { get; set; } = string.Empty;
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
        public string? PdfSignatureText { get; set; }
        public string? InvoiceLanguage { get; set; }
        
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
    }

    public class UpdateCompanyDto
    {
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? MatriculeFiscal { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }
}
