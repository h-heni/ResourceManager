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
    /// NO FAKE/PREVIEW MODE - emails are sent or an exception is thrown.
    /// </summary>
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly AsyncRetryPolicy _retryPolicy;

        // SMTP settings loaded from configuration
        private readonly string _smtpHost;
        private readonly int _smtpPort;
        private readonly string? _smtpUser;
        private readonly string? _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;
        private readonly string _replyToEmail;
        private readonly bool _enableSsl;

        public EmailService(
            IConfiguration configuration,
            ILogger<EmailService> logger,
            IServiceProvider serviceProvider)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;

            // Load SMTP configuration from appsettings or environment variables
            _smtpHost = configuration["Email:SmtpHost"]
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_HOST")
                ?? throw new InvalidOperationException("Email:SmtpHost is not configured. Set it in appsettings.json or EMAIL_SMTP_HOST environment variable.");

            _smtpPort = int.TryParse(configuration["Email:SmtpPort"] ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_PORT"), out var port)
                ? port
                : 587;

            _smtpUser = configuration["Email:SmtpUser"]
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_USER");

            _smtpPassword = configuration["Email:SmtpPassword"]
                ?? Environment.GetEnvironmentVariable("EMAIL_SMTP_PASSWORD");

            _fromEmail = configuration["Email:FromEmail"]
                ?? Environment.GetEnvironmentVariable("EMAIL_FROM_ADDRESS")
                ?? _smtpUser
                ?? throw new InvalidOperationException("Email:FromEmail is not configured.");

            _fromName = configuration["Email:FromName"]
                ?? Environment.GetEnvironmentVariable("EMAIL_FROM_NAME")
                ?? "Resource Manager";

            _replyToEmail = configuration["Email:ReplyToEmail"]
                ?? Environment.GetEnvironmentVariable("EMAIL_REPLY_TO")
                ?? _fromEmail;

            _enableSsl = bool.TryParse(configuration["Email:EnableSsl"] ?? Environment.GetEnvironmentVariable("EMAIL_ENABLE_SSL"), out var ssl)
                ? ssl
                : true;

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
        /// Send email via SMTP. Throws exception if sending fails.
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
            catch (SmtpException smtpEx)
            {
                _logger.LogError(smtpEx, "SMTP error sending email to {To}. Status: {Status}", to, smtpEx.StatusCode);

                var errorMessage = GetSmtpErrorMessage(smtpEx);
                throw new InvalidOperationException(
                    $"Failed to send email to {to}: {errorMessage}. SMTP Status: {smtpEx.StatusCode}",
                    smtpEx);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To}", to);
                throw new InvalidOperationException($"Failed to send email to {to}: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Send email for a specific company - uses Gmail OAuth if connected, otherwise falls back to SMTP
        /// </summary>
        public async Task<EmailSendResult> SendEmailForCompanyAsync(
            int companyId,
            string to,
            string subject,
            string htmlBody,
            byte[]? pdfAttachment = null,
            string? attachmentName = null)
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

                    if (!gmailResult.Success)
                    {
                        throw new InvalidOperationException(
                            $"Gmail OAuth send failed: {gmailResult.Message}. Details: {gmailResult.ErrorDetails}");
                    }

                    return new EmailSendResult
                    {
                        Success = true,
                        Message = gmailResult.Message
                    };
                }
            }

            // Fall back to regular SMTP
            _logger.LogInformation("Gmail OAuth not connected for company {CompanyId}, using SMTP", companyId);
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
        public string SmtpHost { get; set; } = "smtp.gmail.com";
        public int SmtpPort { get; set; } = 587;
        public string? SmtpUser { get; set; }
        public string? SmtpPassword { get; set; }
        public string? FromEmail { get; set; }
        public string? FromName { get; set; } = "Resource Manager";
        public string? ReplyToEmail { get; set; }
        public bool EnableSsl { get; set; } = true;
    }
}
