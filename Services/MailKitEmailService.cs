using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using Polly;
using Polly.Retry;
using System.Security.Cryptography;
using System.Text;

namespace ResourceManager.Services
{
    /// <summary>
    /// Production-grade email service using MailKit for SMTP operations.
    /// Supports: Password reset, Invoice delivery, Generic notifications.
    /// Features: Retry policy, audit logging, HTML templates, PDF attachments.
    /// </summary>
    public interface IMailKitEmailService
    {
        /// <summary>
        /// Send a generic email
        /// </summary>
        Task<EmailSendResult> SendEmailAsync(
            string to, 
            string subject, 
            string htmlBody, 
            byte[]? attachment = null, 
            string? attachmentName = null,
            string? attachmentContentType = null);

        /// <summary>
        /// Send password reset email with secure token
        /// </summary>
        Task<EmailSendResult> SendPasswordResetEmailAsync(
            ApplicationUser user, 
            string resetToken, 
            string? ipAddress = null);

        /// <summary>
        /// Send invoice email with PDF attachment
        /// </summary>
        Task<EmailSendResult> SendInvoiceDeliveryEmailAsync(
            Invoice invoice,
            Company company,
            string recipientEmail,
            string? customSubject = null,
            string? customBody = null,
            byte[]? pdfAttachment = null,
            string? senderName = null);

        /// <summary>
        /// Test SMTP connection (heartbeat check)
        /// </summary>
        Task<SmtpHealthCheckResult> TestConnectionAsync();

        /// <summary>
        /// Get current configuration (no secrets exposed)
        /// </summary>
        SmtpConfiguration GetConfiguration();
    }

    /// <summary>
    /// SMTP connection health check result
    /// </summary>
    public class SmtpHealthCheckResult
    {
        public bool IsHealthy { get; set; }
        public string Message { get; set; } = string.Empty;
        public int ResponseTimeMs { get; set; }
        public string? SmtpGreeting { get; set; }
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// SMTP configuration details (for diagnostics)
    /// </summary>
    public class SmtpConfiguration
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; }
        public bool UseTls { get; set; }
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = string.Empty;
        public bool IsConfigured { get; set; }
        public string? ConfigurationError { get; set; }
    }

    /// <summary>
    /// MailKit-based email service implementation
    /// </summary>
    public class MailKitEmailService : IMailKitEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<MailKitEmailService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly AsyncRetryPolicy _retryPolicy;

        // SMTP settings
        private readonly string _smtpHost;
        private readonly int _smtpPort;
        private readonly string? _smtpUser;
        private readonly string? _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;
        private readonly bool _useTls;
        private readonly string _baseUrl;

        public MailKitEmailService(
            IConfiguration configuration,
            ILogger<MailKitEmailService> logger,
            IServiceProvider serviceProvider)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;

            // Load SMTP configuration from environment variables (preferred) or appsettings
            _smtpHost = Environment.GetEnvironmentVariable("EMAIL_SMTP_HOST")
                ?? configuration["Email:SmtpHost"]
                ?? throw new InvalidOperationException("EMAIL_SMTP_HOST is required");

            _smtpPort = int.TryParse(
                Environment.GetEnvironmentVariable("EMAIL_SMTP_PORT") ?? configuration["Email:SmtpPort"],
                out var port) ? port : 587;

            _smtpUser = Environment.GetEnvironmentVariable("EMAIL_SMTP_USER")
                ?? configuration["Email:SmtpUser"];

            _smtpPassword = Environment.GetEnvironmentVariable("EMAIL_SMTP_PASSWORD")
                ?? configuration["Email:SmtpPassword"];

            _fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM_ADDRESS")
                ?? configuration["Email:FromEmail"]
                ?? _smtpUser
                ?? throw new InvalidOperationException("EMAIL_FROM_ADDRESS is required");

            _fromName = Environment.GetEnvironmentVariable("EMAIL_FROM_NAME")
                ?? configuration["Email:FromName"]
                ?? "Resource Manager";

            _useTls = bool.TryParse(
                Environment.GetEnvironmentVariable("EMAIL_USE_TLS") ?? configuration["Email:EnableSsl"],
                out var tls) ? tls : true;

            _baseUrl = Environment.GetEnvironmentVariable("APP_BASE_URL")
                ?? configuration["App:BaseUrl"]
                ?? "https://rscmanager.com";

            // Configure retry policy with exponential backoff
            _retryPolicy = Policy
                .Handle<SmtpCommandException>(ex => IsTransientError(ex))
                .Or<SmtpProtocolException>()
                .Or<TimeoutException>()
                .Or<System.IO.IOException>()
                .WaitAndRetryAsync(
                    retryCount: 3,
                    sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                    onRetry: (ex, delay, attempt, ctx) =>
                    {
                        _logger.LogWarning(ex,
                            "Email send retry {Attempt}/3 after {Delay}s",
                            attempt, delay.TotalSeconds);
                    });

            _logger.LogInformation(
                "MailKitEmailService initialized - SMTP: {Host}:{Port}, TLS: {Tls}, From: {From}",
                _smtpHost, _smtpPort, _useTls, _fromEmail);
        }

        /// <inheritdoc/>
        public SmtpConfiguration GetConfiguration()
        {
            return new SmtpConfiguration
            {
                Host = _smtpHost,
                Port = _smtpPort,
                UseTls = _useTls,
                FromEmail = _fromEmail,
                FromName = _fromName,
                IsConfigured = !string.IsNullOrEmpty(_smtpHost) && !string.IsNullOrEmpty(_smtpUser),
                ConfigurationError = string.IsNullOrEmpty(_smtpUser) || string.IsNullOrEmpty(_smtpPassword)
                    ? "SMTP credentials not configured"
                    : null
            };
        }

        /// <inheritdoc/>
        public async Task<SmtpHealthCheckResult> TestConnectionAsync()
        {
            var result = new SmtpHealthCheckResult();
            var sw = System.Diagnostics.Stopwatch.StartNew();

            try
            {
                using var client = new SmtpClient();
                client.Timeout = 10000; // 10 second timeout for health check

                await client.ConnectAsync(_smtpHost, _smtpPort, 
                    _useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto);

                result.SmtpGreeting = client.Capabilities.ToString();

                if (!string.IsNullOrEmpty(_smtpUser) && !string.IsNullOrEmpty(_smtpPassword))
                {
                    await client.AuthenticateAsync(_smtpUser, _smtpPassword);
                }

                await client.DisconnectAsync(true);

                sw.Stop();
                result.IsHealthy = true;
                result.Message = "SMTP connection successful";
                result.ResponseTimeMs = (int)sw.ElapsedMilliseconds;

                _logger.LogInformation("SMTP health check passed in {Ms}ms", result.ResponseTimeMs);
            }
            catch (Exception ex)
            {
                sw.Stop();
                result.IsHealthy = false;
                result.Message = $"SMTP connection failed: {ex.Message}";
                result.ResponseTimeMs = (int)sw.ElapsedMilliseconds;

                _logger.LogError(ex, "SMTP health check failed");
            }

            return result;
        }

        /// <inheritdoc/>
        public async Task<EmailSendResult> SendEmailAsync(
            string to,
            string subject,
            string htmlBody,
            byte[]? attachment = null,
            string? attachmentName = null,
            string? attachmentContentType = null)
        {
            if (string.IsNullOrWhiteSpace(to))
                throw new ArgumentException("Recipient email is required", nameof(to));

            _logger.LogInformation("Sending email to {To}, Subject: {Subject}", to, subject);

            var retryCount = 0;

            try
            {
                await _retryPolicy.ExecuteAsync(async () =>
                {
                    retryCount++;
                    await SendViaSMTPAsync(to, subject, htmlBody, attachment, attachmentName, attachmentContentType);
                });

                _logger.LogInformation("Email sent successfully to {To} (attempts: {Attempts})", to, retryCount);

                return new EmailSendResult
                {
                    Success = true,
                    Message = $"Email sent successfully to {to}",
                    RetryCount = retryCount - 1
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To} after {Attempts} attempts", to, retryCount);

                return new EmailSendResult
                {
                    Success = false,
                    Message = $"Failed to send email to {to}",
                    ErrorDetails = ex.Message,
                    RetryCount = retryCount - 1
                };
            }
        }

        /// <inheritdoc/>
        public async Task<EmailSendResult> SendPasswordResetEmailAsync(
            ApplicationUser user,
            string resetToken,
            string? ipAddress = null)
        {
            var resetLink = $"{_baseUrl}/reset-password?token={Uri.EscapeDataString(resetToken)}&email={Uri.EscapeDataString(user.Email!)}";

            var htmlBody = GetPasswordResetEmailTemplate(user, resetLink);
            var subject = "Reset Your Password - Resource Manager";

            var result = await SendEmailAsync(user.Email!, subject, htmlBody);

            // Log to audit
            await LogEmailAuditAsync(
                emailType: "PasswordReset",
                recipientEmail: user.Email!,
                subject: subject,
                status: result.Success ? "Sent" : "Failed",
                errorMessage: result.ErrorDetails,
                ipAddress: ipAddress,
                metadata: $"{{\"userId\":\"{user.Id}\"}}"
            );

            return result;
        }

        /// <inheritdoc/>
        public async Task<EmailSendResult> SendInvoiceDeliveryEmailAsync(
            Invoice invoice,
            Company company,
            string recipientEmail,
            string? customSubject = null,
            string? customBody = null,
            byte[]? pdfAttachment = null,
            string? senderName = null)
        {
            var subject = customSubject ?? $"Invoice #{invoice.Number} from {company.Name}";
            var htmlBody = customBody ?? GetInvoiceEmailTemplate(invoice, company);

            var attachmentName = $"Invoice_{invoice.Number}_{DateTime.UtcNow:yyyyMMdd}.pdf";

            var result = await SendEmailAsync(
                recipientEmail,
                subject,
                htmlBody,
                pdfAttachment,
                attachmentName,
                "application/pdf"
            );

            // Log to audit with sender info
            await LogEmailAuditAsync(
                emailType: "InvoiceDelivery",
                recipientEmail: recipientEmail,
                subject: subject,
                status: result.Success ? "Sent" : "Failed",
                errorMessage: result.ErrorDetails,
                triggeredByName: senderName,
                companyId: company.Id,
                metadata: $"{{\"invoiceId\":{invoice.Id},\"invoiceNumber\":\"{invoice.Number}\"}}"
            );

            return result;
        }

        /// <summary>
        /// Send email using MailKit SMTP client
        /// </summary>
        private async Task SendViaSMTPAsync(
            string to,
            string subject,
            string htmlBody,
            byte[]? attachment,
            string? attachmentName,
            string? attachmentContentType)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_fromName, _fromEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            // Set message ID for tracking
            var domain = _fromEmail.Contains('@') ? _fromEmail.Split('@')[1] : "rscmanager.com";
            message.MessageId = $"{Guid.NewGuid()}@{domain}";

            // Headers for deliverability
            message.Headers.Add("X-Mailer", "ResourceManager/2.0");
            message.Headers.Add("Precedence", "bulk");
            message.Headers.Add("Auto-Submitted", "auto-generated");

            // Build message body
            var builder = new BodyBuilder();

            // Plain text version for better deliverability
            builder.TextBody = ConvertHtmlToPlainText(htmlBody);
            builder.HtmlBody = htmlBody;

            // Add attachment if provided
            if (attachment != null && attachment.Length > 0)
            {
                var contentType = ContentType.Parse(attachmentContentType ?? "application/octet-stream");
                builder.Attachments.Add(attachmentName ?? "attachment", attachment, contentType);
            }

            message.Body = builder.ToMessageBody();

            // Send via SMTP
            using var client = new SmtpClient();
            client.Timeout = 30000; // 30 second timeout

            await client.ConnectAsync(_smtpHost, _smtpPort,
                _useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto);

            if (!string.IsNullOrEmpty(_smtpUser) && !string.IsNullOrEmpty(_smtpPassword))
            {
                await client.AuthenticateAsync(_smtpUser, _smtpPassword);
            }

            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }

        /// <summary>
        /// Log email to audit table
        /// </summary>
        private async Task LogEmailAuditAsync(
            string emailType,
            string recipientEmail,
            string subject,
            string status,
            string? errorMessage = null,
            string? triggeredByUserId = null,
            string? triggeredByName = null,
            string? ipAddress = null,
            int? companyId = null,
            string? metadata = null)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var auditLog = new EmailAuditLog
                {
                    EmailType = emailType,
                    RecipientEmail = recipientEmail,
                    Subject = subject,
                    Status = status,
                    ErrorMessage = errorMessage,
                    TriggeredByUserId = triggeredByUserId,
                    TriggeredByName = triggeredByName,
                    IpAddress = ipAddress,
                    CompanyId = companyId,
                    Metadata = metadata,
                    SentAt = DateTime.UtcNow
                };

                context.Set<EmailAuditLog>().Add(auditLog);
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log email audit for {Type} to {Email}", emailType, recipientEmail);
            }
        }

        /// <summary>
        /// Professional HTML template for password reset emails
        /// </summary>
        private string GetPasswordResetEmailTemplate(ApplicationUser user, string resetLink)
        {
            return $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Reset Your Password</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 0; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"">
                <h1 style=""color: white; margin: 0; font-size: 28px;"">Resource Manager</h1>
            </td>
        </tr>
    </table>
    
    <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"">
        <tr>
            <td style=""padding: 40px;"">
                <h2 style=""color: #333; margin-top: 0;"">Password Reset Request</h2>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Hello,
                </p>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    We received a request to reset the password for your account associated with <strong>{user.Email}</strong>.
                </p>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.
                </p>
                
                <table role=""presentation"" style=""margin: 30px 0;"">
                    <tr>
                        <td style=""background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px;"">
                            <a href=""{resetLink}"" style=""display: inline-block; padding: 14px 32px; color: white; text-decoration: none; font-weight: bold; font-size: 16px;"">
                                Reset Password
                            </a>
                        </td>
                    </tr>
                </table>
                
                <p style=""color: #888; font-size: 14px; line-height: 1.6;"">
                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                
                <p style=""color: #888; font-size: 14px; line-height: 1.6;"">
                    If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style=""color: #667eea; font-size: 12px; word-break: break-all;"">
                    {resetLink}
                </p>
                
                <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
                
                <p style=""color: #999; font-size: 12px;"">
                    This email was sent by Resource Manager. If you have questions, contact support.
                </p>
            </td>
        </tr>
    </table>
    
    <table role=""presentation"" style=""width: 100%; margin-top: 20px;"">
        <tr>
            <td style=""text-align: center; padding: 20px; color: #999; font-size: 12px;"">
                &copy; {DateTime.UtcNow.Year} Resource Manager. All rights reserved.
            </td>
        </tr>
    </table>
</body>
</html>";
        }

        /// <summary>
        /// Professional HTML template for invoice delivery emails
        /// </summary>
        private string GetInvoiceEmailTemplate(Invoice invoice, Company company)
        {
            var clientName = invoice.Client?.Name ?? "Valued Customer";
            var dueSection = invoice.DueDate.HasValue
                ? $"<p style=\"color: #555; font-size: 16px;\"><strong>Due Date:</strong> {invoice.DueDate.Value:MMMM dd, yyyy}</p>"
                : "";

            return $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Invoice #{invoice.Number}</title>
</head>
<body style=""margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td style=""padding: 40px 0; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"">
                <h1 style=""color: white; margin: 0; font-size: 28px;"">{company.Name}</h1>
            </td>
        </tr>
    </table>
    
    <table role=""presentation"" style=""max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"">
        <tr>
            <td style=""padding: 40px;"">
                <h2 style=""color: #333; margin-top: 0;"">Invoice #{invoice.Number}</h2>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Dear {clientName},
                </p>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Please find attached your invoice <strong>#{invoice.Number}</strong> dated <strong>{invoice.Date:MMMM dd, yyyy}</strong>.
                </p>
                
                <table role=""presentation"" style=""width: 100%; margin: 30px 0; border-collapse: collapse;"">
                    <tr>
                        <td style=""padding: 15px; background-color: #f8f9fa; border-radius: 6px;"">
                            <table role=""presentation"" style=""width: 100%;"">
                                <tr>
                                    <td style=""color: #666; font-size: 14px;"">Invoice Number:</td>
                                    <td style=""color: #333; font-weight: bold; text-align: right;"">{invoice.Number}</td>
                                </tr>
                                <tr>
                                    <td style=""color: #666; font-size: 14px; padding-top: 10px;"">Invoice Date:</td>
                                    <td style=""color: #333; text-align: right; padding-top: 10px;"">{invoice.Date:MMM dd, yyyy}</td>
                                </tr>
                                {(invoice.DueDate.HasValue ? $@"
                                <tr>
                                    <td style=""color: #666; font-size: 14px; padding-top: 10px;"">Due Date:</td>
                                    <td style=""color: #333; text-align: right; padding-top: 10px;"">{invoice.DueDate.Value:MMM dd, yyyy}</td>
                                </tr>" : "")}
                                <tr>
                                    <td style=""color: #666; font-size: 14px; padding-top: 10px; border-top: 1px solid #ddd;"">Total Amount:</td>
                                    <td style=""color: #667eea; font-weight: bold; font-size: 18px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd;"">{invoice.TotalAmount:N3} TND</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    The invoice PDF is attached to this email for your records.
                </p>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Thank you for your business!
                </p>
                
                <p style=""color: #555; font-size: 16px; line-height: 1.6;"">
                    Best regards,<br>
                    <strong>{company.Name}</strong>
                </p>
                
                <hr style=""border: none; border-top: 1px solid #eee; margin: 30px 0;"">
                
                <p style=""color: #999; font-size: 12px;"">
                    {company.Address}<br>
                    {(string.IsNullOrEmpty(company.Phone) ? "" : $"Phone: {company.Phone}<br>")}
                    {(string.IsNullOrEmpty(company.Email) ? "" : $"Email: {company.Email}")}
                </p>
            </td>
        </tr>
    </table>
    
    <table role=""presentation"" style=""width: 100%; margin-top: 20px;"">
        <tr>
            <td style=""text-align: center; padding: 20px; color: #999; font-size: 12px;"">
                &copy; {DateTime.UtcNow.Year} {company.Name}. All rights reserved.
            </td>
        </tr>
    </table>
</body>
</html>";
        }

        /// <summary>
        /// Convert HTML to plain text for email alternative view
        /// </summary>
        private static string ConvertHtmlToPlainText(string html)
        {
            var text = html;
            text = System.Text.RegularExpressions.Regex.Replace(text, @"<br\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</p>", "\n\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</div>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"</tr>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"<[^>]+>", "");
            text = System.Net.WebUtility.HtmlDecode(text);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"[ \t]+", " ");
            return text.Trim();
        }

        /// <summary>
        /// Determine if SMTP error is transient (retryable)
        /// </summary>
        private static bool IsTransientError(SmtpCommandException ex)
        {
            // 4xx errors are temporary, 5xx are permanent
            return (int)ex.StatusCode >= 400 && (int)ex.StatusCode < 500;
        }
    }
}
