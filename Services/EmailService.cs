using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using QuestPDF.Fluent;
using Polly;
using Polly.Retry;

namespace ResourceManager.Services
{
    public interface IEmailService
    {
        Task<EmailSendResult> SendEmailAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
        Task<EmailSendResult> SendEmailForCompanyAsync(int companyId, string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
        Task<EmailSendResult> SendInvoiceEmailAsync(Invoice invoice, Company? company, string recipientEmail, string subject, string body, bool attachPdf = true);
        EmailConfiguration GetConfiguration();
    }

    /// <summary>
    /// Result of email send operation with detailed status
    /// </summary>
    public class EmailSendResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? ErrorDetails { get; set; }
        public int RetryCount { get; set; } = 0;
        /// <summary>
        /// True if this is a preview/dev mode result (email not actually sent)
        /// </summary>
        public bool IsPreview { get; set; } = false;
        /// <summary>
        /// Bounce type: null (no bounce), "hard" (permanent - mailbox doesn't exist), "soft" (temporary)
        /// </summary>
        public string? BounceType { get; set; }
        /// <summary>
        /// Human-readable bounce status for the UI
        /// </summary>
        public string? BounceStatus { get; set; }
    }

    /// <summary>
    /// Email configuration details (for diagnostics, no secrets exposed)
    /// </summary>
    public class EmailConfiguration
    {
        public string SmtpHost { get; set; } = string.Empty;
        public int SmtpPort { get; set; }
        public bool EnableSsl { get; set; }
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = string.Empty;
        public bool IsConfigured { get; set; }
        public string? ConfigurationError { get; set; }
    }

    /// <summary>
    /// Production email service using real SMTP.
    /// In Development mode, emails are logged but not sent (unless SMTP is properly configured).
    /// </summary>
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly AsyncRetryPolicy _retryPolicy;
        private readonly IWebHostEnvironment _environment;

        // SMTP settings loaded from configuration
        private readonly string _smtpHost;
        private readonly int _smtpPort;
        private readonly string? _smtpUser;
        private readonly string? _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;
        private readonly string _replyToEmail;
        private readonly bool _enableSsl;
        private readonly bool _isDevMode;

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
            _isDevMode = environment.IsDevelopment();

            // Load SMTP configuration: environment variables take priority over appsettings
            // This prevents appsettings placeholder strings from poisoning the config
            _smtpHost = GetConfigValue(configuration, "Email:SmtpHost", "EMAIL_SMTP_HOST")
                ?? (_isDevMode ? "localhost" : throw new InvalidOperationException("Email:SmtpHost is not configured. Set it in appsettings.json or EMAIL_SMTP_HOST environment variable."));

            _smtpPort = int.TryParse(
                GetConfigValue(configuration, "Email:SmtpPort", "EMAIL_SMTP_PORT"), out var port)
                ? port
                : (_isDevMode ? 1025 : 587); // MailHog default port for dev

            _smtpUser = GetConfigValue(configuration, "Email:SmtpUser", "EMAIL_SMTP_USER");

            _smtpPassword = GetConfigValue(configuration, "Email:SmtpPassword", "EMAIL_SMTP_PASSWORD");

            _fromEmail = GetConfigValue(configuration, "Email:FromEmail", "EMAIL_FROM_ADDRESS")
                ?? _smtpUser
                ?? (_isDevMode ? "noreply@localhost" : throw new InvalidOperationException("Email:FromEmail is not configured."));

            _fromName = GetConfigValue(configuration, "Email:FromName", "EMAIL_FROM_NAME")
                ?? "Resource Manager";

            _replyToEmail = GetConfigValue(configuration, "Email:ReplyToEmail", "EMAIL_REPLY_TO")
                ?? _fromEmail;

            _enableSsl = bool.TryParse(
                GetConfigValue(configuration, "Email:EnableSsl", "EMAIL_ENABLE_SSL"), out var ssl)
                ? ssl
                : !_isDevMode; // Disable SSL in dev (MailHog doesn't need it)

            // Configure retry policy for transient SMTP errors
            _retryPolicy = Policy
                .Handle<SmtpException>(ex => IsTransientError(ex))
                .Or<TimeoutException>()
                .WaitAndRetryAsync(
                    retryCount: 3,
                    sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)), // Exponential backoff: 2s, 4s, 8s
                    onRetry: (exception, timeSpan, retryCount, context) =>
                    {
                        _logger.LogWarning(
                            exception,
                            "Email send retry {RetryCount}/3 after {Delay}s for {To}",
                            retryCount, timeSpan.TotalSeconds, context["To"]);
                    });

            _logger.LogInformation(
                "EmailService initialized - SMTP: {Host}:{Port}, SSL: {Ssl}, From: {From}",
                _smtpHost, _smtpPort, _enableSsl, _fromEmail);
        }

        /// <summary>
        /// Get a config value, preferring environment variables over appsettings.
        /// Filters out placeholder strings like "OVERRIDE_VIA_ENVIRONMENT_VARIABLE".
        /// </summary>
        private static string? GetConfigValue(IConfiguration configuration, string configKey, string envVarName)
        {
            // Environment variable takes highest priority
            var envValue = Environment.GetEnvironmentVariable(envVarName);
            if (!string.IsNullOrWhiteSpace(envValue))
                return envValue;

            // Fall back to appsettings, but filter out placeholder strings
            var configValue = configuration[configKey];
            if (!string.IsNullOrWhiteSpace(configValue) &&
                !configValue.Contains("OVERRIDE", StringComparison.OrdinalIgnoreCase) &&
                !configValue.Contains("REPLACE_ME", StringComparison.OrdinalIgnoreCase) &&
                !configValue.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
            {
                return configValue;
            }

            return null;
        }

        /// <summary>
        /// Get current email configuration (for diagnostics)
        /// </summary>
        public EmailConfiguration GetConfiguration()
        {
            var config = new EmailConfiguration
            {
                SmtpHost = _smtpHost,
                SmtpPort = _smtpPort,
                EnableSsl = _enableSsl,
                FromEmail = _fromEmail,
                FromName = _fromName,
                IsConfigured = !string.IsNullOrEmpty(_smtpHost) && !string.IsNullOrEmpty(_fromEmail)
            };

            if (string.IsNullOrEmpty(_smtpUser) || string.IsNullOrEmpty(_smtpPassword))
            {
                config.ConfigurationError = "SMTP credentials not configured. Set Email:SmtpUser and Email:SmtpPassword.";
            }

            return config;
        }

        /// <summary>
        /// Send email via SMTP. In Development, returns preview success if SMTP fails.
        /// </summary>
        public async Task<EmailSendResult> SendEmailAsync(
            string to,
            string subject,
            string htmlBody,
            byte[]? pdfAttachment = null,
            string? attachmentName = null)
        {
            if (string.IsNullOrWhiteSpace(to))
                throw new ArgumentException("Recipient email is required.", nameof(to));

            if (string.IsNullOrWhiteSpace(subject))
                throw new ArgumentException("Email subject is required.", nameof(subject));

            _logger.LogInformation("Sending email to {To}, Subject: {Subject}", to, subject);

            var retryCount = 0;
            var context = new Context { ["To"] = to };

            try
            {
                await _retryPolicy.ExecuteAsync(async (ctx) =>
                {
                    retryCount++;
                    await SendViaSmtpAsync(to, subject, htmlBody, pdfAttachment, attachmentName);
                }, context);

                _logger.LogInformation("Email sent successfully to {To} (retries: {Retries})", to, retryCount - 1);

                return new EmailSendResult
                {
                    Success = true,
                    Message = $"Email sent successfully to {to}",
                    RetryCount = retryCount - 1
                };
            }
            catch (Exception ex) when (_isDevMode)
            {
                // In Development mode, log the email details and return success (preview mode)
                _logger.LogWarning(
                    "DEV MODE: Email not sent (SMTP unavailable). Would have sent to {To}. Subject: {Subject}. Error: {Error}",
                    to, subject, ex.Message);

                return new EmailSendResult
                {
                    Success = true,
                    Message = $"[DEV MODE] Email preview - would send to {to}. SMTP not configured.",
                    RetryCount = 0,
                    IsPreview = true
                };
            }
            catch (SmtpException smtpEx)
            {
                _logger.LogError(smtpEx, "SMTP error sending email to {To}. Status: {Status}", to, smtpEx.StatusCode);

                var errorMessage = GetSmtpErrorMessage(smtpEx);
                var isHardBounce = IsHardBounceStatus(smtpEx.StatusCode);
                var isSoftBounce = smtpEx.StatusCode == SmtpStatusCode.MailboxBusy ||
                                   smtpEx.StatusCode == SmtpStatusCode.InsufficientStorage;

                return new EmailSendResult
                {
                    Success = false,
                    Message = isHardBounce
                        ? "The email account that you tried to reach does not exist."
                        : $"SMTP error sending email to {to}: {errorMessage}",
                    ErrorDetails = $"SMTP Status: {smtpEx.StatusCode}. {smtpEx.Message}",
                    RetryCount = retryCount - 1,
                    BounceType = isHardBounce ? "hard" : (isSoftBounce ? "soft" : null),
                    BounceStatus = isHardBounce ? $"Hard bounce ({smtpEx.StatusCode})"
                                 : isSoftBounce ? $"Soft bounce ({smtpEx.StatusCode})"
                                 : null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To}", to);
                return new EmailSendResult
                {
                    Success = false,
                    Message = $"Failed to send email to {to}",
                    ErrorDetails = ex.Message,
                    RetryCount = retryCount - 1
                };
            }
        }

        /// <summary>
        /// Send email for a specific company using SMTP
        /// </summary>
        public async Task<EmailSendResult> SendEmailForCompanyAsync(
            int companyId,
            string to,
            string subject,
            string htmlBody,
            byte[]? pdfAttachment = null,
            string? attachmentName = null)
        {
            // Use direct SMTP - no third-party OAuth dependencies
            _logger.LogInformation("Sending email via SMTP for company {CompanyId} to {To}", companyId, to);
            return await SendEmailAsync(to, subject, htmlBody, pdfAttachment, attachmentName);
        }

        /// <summary>
        /// Send invoice email with optional PDF attachment
        /// </summary>
        public async Task<EmailSendResult> SendInvoiceEmailAsync(
            Invoice invoice,
            Company? company,
            string recipientEmail,
            string subject,
            string body,
            bool attachPdf = true)
        {
            byte[]? pdfBytes = null;

            if (attachPdf)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    var fullInvoice = await context.Invoices
                        .Include(i => i.Client)
                        .Include(i => i.InvoiceItems)
                        .FirstOrDefaultAsync(i => i.Id == invoice.Id);

                    if (fullInvoice != null && company != null)
                    {
                        var settings = await context.CompanySettings
                            .FirstOrDefaultAsync(s => s.CompanyId == company.Id);

                        var pdfSettings = PdfSettings.FromCompanySettings(settings, company);
                        var document = new Document<Invoice>(fullInvoice, pdfSettings);
                        pdfBytes = document.GeneratePdf();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to generate PDF for invoice {InvoiceId}", invoice.Id);
                    // Continue without attachment but log the error
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

            return await SendEmailAsync(
                recipientEmail,
                subject,
                body,
                pdfBytes,
                $"Facture_{invoice.Number}.pdf"
            );
        }

        /// <summary>
        /// Send email via SMTP with proper headers for deliverability
        /// </summary>
        private async Task SendViaSmtpAsync(
            string to,
            string subject,
            string htmlBody,
            byte[]? pdfAttachment,
            string? attachmentName)
        {
            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                EnableSsl = _enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 30000 // 30 seconds
            };

            // Set credentials if configured
            if (!string.IsNullOrEmpty(_smtpUser) && !string.IsNullOrEmpty(_smtpPassword))
            {
                client.Credentials = new NetworkCredential(_smtpUser, _smtpPassword);
            }

            using var message = new MailMessage
            {
                From = new MailAddress(_fromEmail, _fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                SubjectEncoding = Encoding.UTF8,
                BodyEncoding = Encoding.UTF8
            };
            message.To.Add(to);

            // ═══════════════════════════════════════════════════════════
            // EMAIL HEADERS FOR DELIVERABILITY
            // ═══════════════════════════════════════════════════════════

            // Reply-To header
            message.ReplyToList.Add(new MailAddress(_replyToEmail));

            // Message-ID header (prevents duplicate detection issues)
            var domain = _fromEmail.Contains('@') ? _fromEmail.Split('@')[1] : "resourcemanager.local";
            message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@{domain}>");

            // X-Mailer header
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
                    attachmentName ?? "attachment.pdf",
                    "application/pdf"
                );
                message.Attachments.Add(attachment);
            }

            await client.SendMailAsync(message);
        }

        /// <summary>
        /// Converts HTML to plain text for email alternative view
        /// </summary>
        private static string ConvertHtmlToPlainText(string html)
        {
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

        /// <summary>
        /// Determine if an SMTP exception is transient (retryable)
        /// </summary>
        private static bool IsTransientError(SmtpException ex)
        {
            return ex.StatusCode switch
            {
                SmtpStatusCode.ServiceNotAvailable => true,
                SmtpStatusCode.MailboxBusy => true,
                SmtpStatusCode.LocalErrorInProcessing => true,
                SmtpStatusCode.InsufficientStorage => true,
                _ => false
            };
        }

        /// <summary>
        /// Determine if an SMTP status code indicates a hard bounce (permanent delivery failure)
        /// </summary>
        private static bool IsHardBounceStatus(SmtpStatusCode statusCode)
        {
            return statusCode switch
            {
                SmtpStatusCode.MailboxUnavailable => true,    // 550 - mailbox not found
                SmtpStatusCode.UserNotLocalTryAlternatePath => true, // 551
                SmtpStatusCode.ExceededStorageAllocation => true, // 552
                SmtpStatusCode.MailboxNameNotAllowed => true,  // 553 - invalid address
                SmtpStatusCode.TransactionFailed => true,      // 554
                _ => false
            };
        }

        /// <summary>
        /// Get human-readable error message for SMTP exceptions
        /// </summary>
        private static string GetSmtpErrorMessage(SmtpException ex)
        {
            return ex.StatusCode switch
            {
                SmtpStatusCode.MailboxBusy => "Recipient mailbox is busy. Try again later.",
                SmtpStatusCode.MailboxUnavailable => "Recipient mailbox not found or unavailable.",
                SmtpStatusCode.MailboxNameNotAllowed => "Invalid recipient email address.",
                SmtpStatusCode.ClientNotPermitted => "SMTP authentication failed. Check credentials.",
                SmtpStatusCode.MustIssueStartTlsFirst => "SMTP server requires TLS. Enable SSL in configuration.",
                SmtpStatusCode.ServiceNotAvailable => "SMTP server is temporarily unavailable.",
                SmtpStatusCode.InsufficientStorage => "Recipient mailbox is full.",
                SmtpStatusCode.ExceededStorageAllocation => "Message size exceeds server limits.",
                _ => ex.Message
            };
        }
    }

    /// <summary>
    /// Email configuration section for appsettings
    /// </summary>
    public class EmailSettings
    {
        public string SmtpHost { get; set; } = "mail.rscmanager.com";
        public int SmtpPort { get; set; } = 587;
        public string? SmtpUser { get; set; }
        public string? SmtpPassword { get; set; }
        public string? FromEmail { get; set; }
        public string? FromName { get; set; } = "Resource Manager";
        public string? ReplyToEmail { get; set; }
        public bool EnableSsl { get; set; } = true;
    }
}
