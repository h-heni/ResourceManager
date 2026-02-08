using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using QuestPDF.Fluent;

namespace ResourceManager.Services
{
    public interface IEmailService
    {
        Task<EmailSendResult> SendEmailAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
        Task<EmailSendResult> SendEmailForCompanyAsync(int companyId, string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
        Task<EmailSendResult> SendInvoiceEmailAsync(Invoice invoice, Company? company, string recipientEmail, string subject, string body, bool attachPdf = true);
        EmailTestInfo GetTestInfo();
    }

    /// <summary>
    /// Result of email send operation with detailed status
    /// </summary>
    public class EmailSendResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public EmailSendMode Mode { get; set; }
        public string? PreviewPath { get; set; }
        public string? ErrorDetails { get; set; }
    }

    public enum EmailSendMode
    {
        Production,      // Real SMTP (Gmail, SendGrid, etc.)
        LocalSmtp,       // Local SMTP server (Mailpit, Papercut)
        Preview,         // No SMTP - saves to file for preview
        Disabled         // Email completely disabled
    }

    /// <summary>
    /// Information about email testing configuration
    /// </summary>
    public class EmailTestInfo
    {
        public EmailSendMode Mode { get; set; }
        public string ModeDescription { get; set; } = string.Empty;
        public string SmtpHost { get; set; } = string.Empty;
        public int SmtpPort { get; set; }
        public bool CredentialsConfigured { get; set; }
        public string? PreviewDirectory { get; set; }
        public List<string> SpamPreventionChecklist { get; set; } = new();
        public List<string> DnsRequirements { get; set; } = new();
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWebHostEnvironment _environment;
        private readonly string _previewDirectory;

        // Known local SMTP testing servers
        private static readonly HashSet<string> LocalSmtpHosts = new(StringComparer.OrdinalIgnoreCase)
        {
            "localhost", "127.0.0.1", "mailpit", "papercut", "mailtrap",
            "mailhog", "smtp4dev", "fakesmtp", "greenmail"
        };

        public EmailService(
            IConfiguration configuration, 
            ILogger<EmailService> logger, 
            IServiceProvider serviceProvider,
            IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;
            _environment = environment;
            
            // Setup preview directory for when SMTP is not configured
            _previewDirectory = Path.Combine(_environment.ContentRootPath, "EmailPreviews");
            if (!Directory.Exists(_previewDirectory))
            {
                Directory.CreateDirectory(_previewDirectory);
            }
        }

        /// <summary>
        /// Determines the email send mode based on configuration
        /// </summary>
        private EmailSendMode DetermineEmailMode()
        {
            var isDisabled = _configuration.GetValue<bool>("Email:Disabled", false);
            if (isDisabled) return EmailSendMode.Disabled;

            var smtpHost = _configuration["Email:SmtpHost"] ?? "";
            var smtpUser = _configuration["Email:SmtpUser"];
            var smtpPass = _configuration["Email:SmtpPassword"];

            // Check if using local SMTP server (Mailpit, Papercut, etc.)
            if (LocalSmtpHosts.Any(h => smtpHost.Contains(h, StringComparison.OrdinalIgnoreCase)))
            {
                return EmailSendMode.LocalSmtp;
            }

            // Check if production credentials are configured
            if (!string.IsNullOrEmpty(smtpUser) && !string.IsNullOrEmpty(smtpPass))
            {
                return EmailSendMode.Production;
            }

            // No credentials = preview mode (save to file)
            return EmailSendMode.Preview;
        }

        /// <summary>
        /// Get information about email testing configuration
        /// </summary>
        public EmailTestInfo GetTestInfo()
        {
            var mode = DetermineEmailMode();
            var smtpHost = _configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
            var smtpUser = _configuration["Email:SmtpUser"];
            var smtpPass = _configuration["Email:SmtpPassword"];

            return new EmailTestInfo
            {
                Mode = mode,
                ModeDescription = mode switch
                {
                    EmailSendMode.Production => "Production SMTP - Emails are sent to real recipients",
                    EmailSendMode.LocalSmtp => "Local SMTP Server - Emails captured by local mail catcher",
                    EmailSendMode.Preview => "Preview Mode - Emails saved to files (no SMTP configured)",
                    EmailSendMode.Disabled => "Email Disabled - No emails will be sent or saved",
                    _ => "Unknown mode"
                },
                SmtpHost = smtpHost,
                SmtpPort = smtpPort,
                CredentialsConfigured = !string.IsNullOrEmpty(smtpUser) && !string.IsNullOrEmpty(smtpPass),
                PreviewDirectory = mode == EmailSendMode.Preview ? _previewDirectory : null,
                SpamPreventionChecklist = new List<string>
                {
                    "✓ Use a professional domain email (not @gmail.com) for FromEmail",
                    "✓ Ensure FromEmail domain matches your actual domain",
                    "✓ Always include Reply-To header",
                    "✓ Include List-Unsubscribe header for marketing emails",
                    "✓ Use consistent From name and address",
                    "✓ Avoid spam trigger words in subject",
                    "✓ Maintain good text-to-HTML ratio",
                    "✓ Include plain-text alternative"
                },
                DnsRequirements = new List<string>
                {
                    "SPF Record: Add TXT record 'v=spf1 include:_spf.google.com ~all' (for Gmail)",
                    "DKIM: Configure in Google Admin Console or email provider",
                    "DMARC: Add TXT record '_dmarc.yourdomain.com' with 'v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com'",
                    "PTR Record: Ensure reverse DNS is configured (hosting provider)",
                    "Note: These DNS records must be configured at your domain registrar, NOT in code"
                }
            };
        }

        public async Task<EmailSendResult> SendEmailAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null)
        {
            var mode = DetermineEmailMode();
            
            _logger.LogInformation("Email send initiated - Mode: {Mode}, To: {To}, Subject: {Subject}", 
                mode, to, subject);

            return mode switch
            {
                EmailSendMode.Disabled => new EmailSendResult
                {
                    Success = false,
                    Message = "Email sending is disabled in configuration",
                    Mode = mode
                },
                EmailSendMode.Preview => await SaveEmailPreviewAsync(to, subject, htmlBody, pdfAttachment, attachmentName),
                _ => await SendViaSmtpAsync(to, subject, htmlBody, pdfAttachment, attachmentName, mode)
            };
        }

        /// <summary>
        /// Send email for a specific company - uses Gmail OAuth if connected, otherwise falls back to SMTP
        /// </summary>
        public async Task<EmailSendResult> SendEmailForCompanyAsync(int companyId, string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null)
        {
            using var scope = _serviceProvider.CreateScope();
            
            // Check if Gmail OAuth is connected for this company
            var gmailService = scope.ServiceProvider.GetService<IGmailOAuthService>();
            if (gmailService != null)
            {
                var gmailStatus = await gmailService.GetConnectionStatusAsync(companyId);
                if (gmailStatus.IsConnected)
                {
                    _logger.LogInformation("Sending email via Gmail OAuth for company {CompanyId} to {To}", companyId, to);
                    var gmailResult = await gmailService.SendEmailAsync(companyId, to, subject, htmlBody, pdfAttachment, attachmentName);
                    
                    return new EmailSendResult
                    {
                        Success = gmailResult.Success,
                        Message = gmailResult.Message,
                        Mode = EmailSendMode.Production, // Gmail OAuth counts as production
                        ErrorDetails = gmailResult.ErrorDetails
                    };
                }
            }
            
            // Fall back to regular SMTP
            _logger.LogInformation("Gmail OAuth not connected for company {CompanyId}, falling back to SMTP", companyId);
            return await SendEmailAsync(to, subject, htmlBody, pdfAttachment, attachmentName);
        }

        /// <summary>
        /// Saves email to file for preview when SMTP is not configured
        /// </summary>
        private async Task<EmailSendResult> SaveEmailPreviewAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment, string? attachmentName)
        {
            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss_fff");
                var safeSubject = string.Join("_", subject.Split(Path.GetInvalidFileNameChars())).Substring(0, Math.Min(50, subject.Length));
                var folderName = $"{timestamp}_{safeSubject}";
                var emailFolder = Path.Combine(_previewDirectory, folderName);
                
                Directory.CreateDirectory(emailFolder);

                // Save email metadata as JSON
                var metadata = new
                {
                    To = to,
                    Subject = subject,
                    Timestamp = DateTime.Now,
                    HasAttachment = pdfAttachment != null,
                    AttachmentName = attachmentName
                };
                
                var metadataPath = Path.Combine(emailFolder, "metadata.json");
                await File.WriteAllTextAsync(metadataPath, JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));

                // Save HTML body
                var htmlPath = Path.Combine(emailFolder, "email.html");
                await File.WriteAllTextAsync(htmlPath, htmlBody);

                // Save PDF attachment if present
                if (pdfAttachment != null && pdfAttachment.Length > 0)
                {
                    var pdfPath = Path.Combine(emailFolder, attachmentName ?? "attachment.pdf");
                    await File.WriteAllBytesAsync(pdfPath, pdfAttachment);
                }

                _logger.LogInformation("Email preview saved to {Path}", emailFolder);
                _logger.LogWarning(
                    "📧 EMAIL PREVIEW MODE - No SMTP configured!\n" +
                    "To: {To}\n" +
                    "Subject: {Subject}\n" +
                    "Preview saved to: {Path}\n" +
                    "To enable real email sending, configure SMTP credentials in appsettings.json or use local SMTP (Mailpit/Papercut)",
                    to, subject, emailFolder);

                return new EmailSendResult
                {
                    Success = true,
                    Message = $"Email saved to preview folder (SMTP not configured). Path: {emailFolder}",
                    Mode = EmailSendMode.Preview,
                    PreviewPath = emailFolder
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save email preview");
                return new EmailSendResult
                {
                    Success = false,
                    Message = "Failed to save email preview",
                    Mode = EmailSendMode.Preview,
                    ErrorDetails = ex.Message
                };
            }
        }

        /// <summary>
        /// Sends email via SMTP with proper headers for spam prevention
        /// </summary>
        private async Task<EmailSendResult> SendViaSmtpAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment, string? attachmentName, EmailSendMode mode)
        {
            try
            {
                var smtpHost = _configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
                var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
                var smtpUser = _configuration["Email:SmtpUser"];
                var smtpPass = _configuration["Email:SmtpPassword"];
                var fromEmail = _configuration["Email:FromEmail"] ?? smtpUser ?? "noreply@invoicemanager.local";
                var fromName = _configuration["Email:FromName"] ?? "Resource Manager";
                var replyToEmail = _configuration["Email:ReplyToEmail"] ?? fromEmail;
                var enableSsl = _configuration.GetValue<bool>("Email:EnableSsl", true);

                // For local SMTP servers, SSL might not be needed
                if (mode == EmailSendMode.LocalSmtp)
                {
                    enableSsl = _configuration.GetValue<bool>("Email:EnableSsl", false);
                }

                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = enableSsl,
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    Timeout = 30000 // 30 seconds
                };

                // Only set credentials for production SMTP
                if (mode == EmailSendMode.Production && !string.IsNullOrEmpty(smtpUser) && !string.IsNullOrEmpty(smtpPass))
                {
                    client.Credentials = new NetworkCredential(smtpUser, smtpPass);
                }

                var message = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true,
                    SubjectEncoding = Encoding.UTF8,
                    BodyEncoding = Encoding.UTF8
                };
                message.To.Add(to);

                // ═══════════════════════════════════════════════════════════
                // SPAM PREVENTION HEADERS
                // ═══════════════════════════════════════════════════════════
                
                // Reply-To header (helps with deliverability)
                message.ReplyToList.Add(new MailAddress(replyToEmail));

                // Message-ID header (prevents duplicate detection issues)
                message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@invoicemanager.local>");

                // X-Mailer header (identifies the sending application)
                message.Headers.Add("X-Mailer", "Resource Manager v1.0");

                // Precedence header (indicates transactional email)
                message.Headers.Add("Precedence", "bulk");

                // Auto-Submitted header (indicates automated email)
                message.Headers.Add("Auto-Submitted", "auto-generated");

                // Add plain-text alternative for better deliverability
                var plainTextBody = ConvertHtmlToPlainText(htmlBody);
                var plainTextView = AlternateView.CreateAlternateViewFromString(plainTextBody, Encoding.UTF8, "text/plain");
                var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, "text/html");
                message.AlternateViews.Add(plainTextView);
                message.AlternateViews.Add(htmlView);

                // Add PDF attachment if provided
                if (pdfAttachment != null && pdfAttachment.Length > 0)
                {
                    var attachment = new Attachment(
                        new MemoryStream(pdfAttachment), 
                        attachmentName ?? "invoice.pdf", 
                        "application/pdf"
                    );
                    message.Attachments.Add(attachment);
                }

                await client.SendMailAsync(message);
                
                _logger.LogInformation("Email sent successfully via {Mode} to {To}", mode, to);

                return new EmailSendResult
                {
                    Success = true,
                    Message = mode == EmailSendMode.LocalSmtp 
                        ? $"Email sent to local SMTP server ({smtpHost}:{smtpPort}). Check your mail catcher."
                        : $"Email sent successfully to {to}",
                    Mode = mode
                };
            }
            catch (SmtpException smtpEx)
            {
                _logger.LogError(smtpEx, "SMTP error sending email to {To}. Status: {Status}", to, smtpEx.StatusCode);
                
                var errorMessage = smtpEx.StatusCode switch
                {
                    SmtpStatusCode.MailboxBusy => "Recipient mailbox is busy. Try again later.",
                    SmtpStatusCode.MailboxUnavailable => "Recipient mailbox not found.",
                    SmtpStatusCode.ClientNotPermitted => "SMTP authentication failed. Check credentials.",
                    SmtpStatusCode.MustIssueStartTlsFirst => "SMTP server requires TLS. Enable SSL in configuration.",
                    _ => $"SMTP error: {smtpEx.Message}"
                };

                return new EmailSendResult
                {
                    Success = false,
                    Message = errorMessage,
                    Mode = mode,
                    ErrorDetails = $"StatusCode: {smtpEx.StatusCode}, Message: {smtpEx.Message}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To}", to);
                return new EmailSendResult
                {
                    Success = false,
                    Message = "Failed to send email. Check logs for details.",
                    Mode = mode,
                    ErrorDetails = ex.Message
                };
            }
        }

        /// <summary>
        /// Converts HTML to plain text for email alternative view
        /// </summary>
        private static string ConvertHtmlToPlainText(string html)
        {
            // Basic HTML to text conversion
            var text = html;
            
            // Replace common HTML elements
            text = System.Text.RegularExpressions.Regex.Replace(text, @"<br\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</p>", "\n\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</div>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</li>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"<li[^>]*>", "• ", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            
            // Remove all remaining HTML tags
            text = System.Text.RegularExpressions.Regex.Replace(text, @"<[^>]+>", "");
            
            // Decode HTML entities
            text = System.Net.WebUtility.HtmlDecode(text);
            
            // Clean up whitespace
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");
            
            return text.Trim();
        }

        public async Task<EmailSendResult> SendInvoiceEmailAsync(Invoice invoice, Company? company, string recipientEmail, string subject, string body, bool attachPdf = true)
        {
            byte[]? pdfBytes = null;
            
            if (attachPdf)
            {
                try
                {
                    // Generate PDF using QuestPDF
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    
                    // Get full invoice with items
                    var fullInvoice = await context.Invoices
                        .Include(i => i.Client)
                        .Include(i => i.InvoiceItems)
                        .FirstOrDefaultAsync(i => i.Id == invoice.Id);
                    
                    if (fullInvoice != null)
                    {
                        var settings = await context.CompanySettings
                            .FirstOrDefaultAsync(s => s.CompanyId == company!.Id);
                        
                        // Create PDF settings
                        var pdfSettings = new PdfSettings
                        {
                            CompanyName = company?.Name ?? "",
                            CompanyAddress = company?.Address ?? "",
                            CompanyTaxId = company?.MatriculeFiscal ?? "",
                            CompanyPhone = company?.Phone ?? "",
                            CustomTaxEnabled = settings?.CustomTaxEnabled ?? true,
                            CustomTaxName = settings?.CustomTaxName ?? "Timbre Fiscal",
                            CustomTaxAmount = settings?.CustomTaxAmount ?? 1.000m,
                            LogoData = company?.LogoData,
                            PdfSignatureText = settings?.PdfSignatureText,
                            InvoiceLanguage = settings?.InvoiceLanguage ?? "fr",
                            SignatureImageData = settings?.SignatureImageData,
                            ShowSignatureOnPdf = settings?.ShowSignatureOnPdf ?? false,
                            BankName = settings?.BankName,
                            BankBIC = settings?.BankBIC,
                            BankRIB = settings?.BankRIB,
                            BankIBAN = settings?.BankIBAN,
                            ShowBankName = settings?.ShowBankName ?? true,
                            ShowBankBIC = settings?.ShowBankBIC ?? true,
                            ShowBankRIB = settings?.ShowBankRIB ?? true,
                            ShowBankIBAN = settings?.ShowBankIBAN ?? true
                        };
                        
                        var document = new Document<Invoice>(fullInvoice, pdfSettings);
                        pdfBytes = document.GeneratePdf();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to generate PDF for invoice {InvoiceId}", invoice.Id);
                    // Continue without attachment
                }
            }

            // Use Gmail OAuth if company is provided and Gmail is connected
            if (company != null)
            {
                return await SendEmailForCompanyAsync(
                    company.Id,
                    recipientEmail, 
                    subject, 
                    body, 
                    pdfBytes, 
                    $"Facture_{invoice.Number}.pdf"
                );
            }
            
            // Fall back to regular SMTP
            return await SendEmailAsync(
                recipientEmail, 
                subject, 
                body, 
                pdfBytes, 
                $"Facture_{invoice.Number}.pdf"
            );
        }
    }

    // Email configuration section for appsettings
    public class EmailSettings
    {
        public string SmtpHost { get; set; } = "smtp.gmail.com";
        public int SmtpPort { get; set; } = 587;
        public string? SmtpUser { get; set; }
        public string? SmtpPassword { get; set; }
        public string? FromEmail { get; set; }
        public string? FromName { get; set; } = "Resource Manager";
        public string? ReplyToEmail { get; set; }
        public bool EnableSsl { get; set; } = true;
        public bool Disabled { get; set; } = false;
    }
}
