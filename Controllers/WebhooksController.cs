using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Services;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Receives webhook events from external services (e.g. Brevo email delivery events).
    /// These endpoints are anonymous — they do NOT require JWT authentication.
    /// Secured via shared secret header (X-Brevo-Secret).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    [EnableRateLimiting("Moderate")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<WebhooksController> _logger;
        private readonly string? _webhookSecret;
        private readonly bool _requireWebhookSecrets;
        private readonly string? _whatsAppVerifyToken;

        public WebhooksController(AppDbContext context, ILogger<WebhooksController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _webhookSecret = configuration["Brevo:WebhookSecret"];
            _requireWebhookSecrets = configuration.GetValue<bool>("Security:RequireWebhookSecrets", true);
            _whatsAppVerifyToken = configuration["WhatsApp:WebhookVerifyToken"];
        }

        /// <summary>
        /// Brevo (Sendinblue) transactional email webhook.
        /// Configure this URL in Brevo Dashboard → Transactional → Settings → Webhook.
        /// URL: https://yourdomain.com/api/webhooks/brevo
        /// Events to subscribe: hard_bounce, soft_bounce, delivered, blocked, spam, invalid
        /// </summary>
        [HttpPost("brevo")]
        public async Task<IActionResult> BrevoWebhook([FromBody] BrevoWebhookEvent payload)
        {
            // Fail-closed: in environments that require webhook secrets, refuse if not configured.
            if (string.IsNullOrEmpty(_webhookSecret))
            {
                if (_requireWebhookSecrets)
                {
                    _logger.LogCritical("Brevo webhook rejected: Brevo:WebhookSecret is not configured in this environment.");
                    return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "Webhook endpoint not configured." });
                }
                _logger.LogWarning("Brevo webhook accepted without secret validation (Security:RequireWebhookSecrets=false). Do not use in production.");
            }
            else
            {
                if (!Request.Headers.TryGetValue("X-Brevo-Secret", out var secretHeader)
                    || !FixedTimeEquals(secretHeader.ToString(), _webhookSecret))
                {
                    _logger.LogWarning("Brevo webhook: invalid or missing secret header from {IP}", HttpContext.Connection.RemoteIpAddress);
                    return Unauthorized();
                }
            }

            if (payload == null || string.IsNullOrEmpty(payload.Event))
            {
                _logger.LogWarning("Brevo webhook: empty or invalid payload");
                return BadRequest();
            }

            _logger.LogInformation(
                "Brevo webhook received: Event={Event}, Email={Email}, MessageId={MessageId}, Reason={Reason}",
                payload.Event, payload.Email, payload.MessageId, payload.Reason);

            // Map Brevo event to our email status
            var (status, errorMessage) = MapBrevoEventToStatus(payload);

            if (status == null)
            {
                // Event type we don't track (e.g. click, open) — acknowledge but skip
                _logger.LogDebug("Brevo webhook: ignoring event type {Event}", payload.Event);
                return Ok(new { received = true, action = "ignored" });
            }

            // Find the matching InvoiceEmail record
            // Try by MessageId first (most reliable), then fall back to email + recent timestamp
            Models.InvoiceEmail? emailRecord = null;

            if (!string.IsNullOrEmpty(payload.MessageId))
            {
                emailRecord = await _context.InvoiceEmails
                    .IgnoreQueryFilters() // Webhook doesn't have tenant context
                    .FirstOrDefaultAsync(e => e.MessageId == payload.MessageId);
            }

            if (emailRecord == null && !string.IsNullOrEmpty(payload.Email))
            {
                // Fallback: find most recent email to this recipient sent within the last 24h
                var cutoff = DateTime.UtcNow.AddHours(-24);
                emailRecord = await _context.InvoiceEmails
                    .IgnoreQueryFilters()
                    .Where(e => e.RecipientEmail == payload.Email && e.SentAt >= cutoff)
                    .OrderByDescending(e => e.SentAt)
                    .FirstOrDefaultAsync();
            }

            if (emailRecord == null)
            {
                _logger.LogWarning(
                    "Brevo webhook: no matching InvoiceEmail found for MessageId={MessageId}, Email={Email}",
                    payload.MessageId, payload.Email);
                return Ok(new { received = true, action = "no_match" });
            }

            // Update the email record status
            var previousStatus = emailRecord.Status;
            emailRecord.Status = status;
            if (!string.IsNullOrEmpty(errorMessage))
                emailRecord.ErrorMessage = errorMessage;

            // For failure events, create a bell notification so the user knows
            var failureStatuses = new[] { "Bounced", "Blocked", "Spam", "Invalid", "SoftBounce" };
            if (failureStatuses.Contains(status) && !string.IsNullOrEmpty(emailRecord.CreatedByUserId))
            {
                // Load the invoice to get the invoice number for the notification message
                var invoice = await _context.Invoices
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Id == emailRecord.InvoiceId);

                var invoiceRef = invoice?.Number ?? $"#{emailRecord.InvoiceId}";
                var friendlyReason = status switch
                {
                    "Bounced"    => "The email account does not exist.",
                    "Blocked"    => "The email was blocked by the recipient server.",
                    "Spam"       => "The email was marked as spam.",
                    "Invalid"    => "The email address is invalid.",
                    "SoftBounce" => "The mailbox is temporarily unavailable.",
                    _            => "Delivery failed."
                };
                var message = $"Invoice {invoiceRef}: email to {emailRecord.RecipientEmail} failed — {friendlyReason}";

                _context.PaymentNotifications.Add(new PaymentNotification
                {
                    PaymentId = 0, // Not a payment notification
                    InvoiceId = emailRecord.InvoiceId,
                    UserId = emailRecord.CreatedByUserId,
                    Message = message,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                });
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Brevo webhook: Updated InvoiceEmail {Id} status from {OldStatus} to {NewStatus} (Event={Event})",
                emailRecord.Id, previousStatus, status, payload.Event);

            return Ok(new { received = true, action = "updated", emailId = emailRecord.Id, status });
        }

        /// <summary>
        /// Meta hub-challenge verification.
        /// Meta calls this GET to confirm the webhook URL before enabling delivery.
        /// Register this URL in the Meta App Dashboard → WhatsApp → Configuration → Webhook.
        /// URL: https://yourdomain.com/api/webhooks/whatsapp
        /// Subscribe to the "messages" field.
        /// </summary>
        [HttpGet("whatsapp")]
        public IActionResult WhatsAppVerify(
            [FromQuery(Name = "hub.mode")] string? mode,
            [FromQuery(Name = "hub.verify_token")] string? token,
            [FromQuery(Name = "hub.challenge")] string? challenge)
        {
            if (mode != "subscribe")
                return BadRequest(new { error = "Unexpected hub.mode" });

            if (string.IsNullOrEmpty(_whatsAppVerifyToken) || _whatsAppVerifyToken == "SET_VIA_ENVIRONMENT")
            {
                _logger.LogCritical("WhatsApp webhook verification failed: WhatsApp:WebhookVerifyToken is not configured.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "Webhook not configured." });
            }

            if (!FixedTimeEquals(token ?? "", _whatsAppVerifyToken))
            {
                _logger.LogWarning("WhatsApp webhook: invalid verify_token from {IP}", HttpContext.Connection.RemoteIpAddress);
                return Unauthorized();
            }

            _logger.LogInformation("WhatsApp webhook verified successfully.");
            return Content(challenge ?? "", "text/plain");
        }

        /// <summary>
        /// Meta WhatsApp Cloud API delivery status webhook.
        /// Updates DocumentSendAudit status when messages are delivered, read, or fail.
        /// </summary>
        [HttpPost("whatsapp")]
        public async Task<IActionResult> WhatsAppWebhook([FromBody] WhatsAppWebhookPayload? payload)
        {
            if (payload?.Entry == null)
                return Ok(new { received = true }); // Always return 200 to Meta

            foreach (var entry in payload.Entry)
            {
                foreach (var change in entry.Changes ?? [])
                {
                    if (change.Field != "messages") continue;

                    foreach (var status in change.Value?.Statuses ?? [])
                    {
                        if (string.IsNullOrEmpty(status.Id)) continue;

                        var mapped = status.Status?.ToLower() switch
                        {
                            "sent"      => "Sent",
                            "delivered" => "Delivered",
                            "read"      => "Read",
                            "failed"    => "Failed",
                            _           => null
                        };

                        if (mapped == null) continue;

                        var audit = await _context.DocumentSendAudits
                            .IgnoreQueryFilters()
                            .FirstOrDefaultAsync(a => a.MessageId == status.Id);

                        if (audit == null)
                        {
                            _logger.LogDebug("WhatsApp webhook: no DocumentSendAudit found for MessageId={MessageId}", status.Id);
                            continue;
                        }

                        audit.Status = mapped;
                        if (mapped == "Failed" && status.Errors?.Count > 0)
                            audit.ErrorMessage = status.Errors[0].Title ?? status.Errors[0].Message;

                        _logger.LogInformation(
                            "WhatsApp webhook: updated audit {AuditId} to {Status} for MessageId={MessageId}",
                            audit.Id, mapped, status.Id);
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { received = true });
        }

        // Constant-time string comparison to avoid timing side-channel on secret check.
        private static bool FixedTimeEquals(string a, string b)
        {
            if (a is null || b is null) return false;
            var ab = System.Text.Encoding.UTF8.GetBytes(a);
            var bb = System.Text.Encoding.UTF8.GetBytes(b);
            return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ab, bb);
        }

        private static (string? Status, string? ErrorMessage) MapBrevoEventToStatus(BrevoWebhookEvent payload)
        {
            return payload.Event?.ToLower() switch
            {
                "delivered" => ("Delivered", null),
                "hard_bounce" => ("Bounced", $"Hard bounce: {payload.Reason}"),
                "soft_bounce" => ("SoftBounce", $"Soft bounce: {payload.Reason}"),
                "blocked" => ("Blocked", $"Blocked: {payload.Reason}"),
                "spam" => ("Spam", "Reported as spam by recipient"),
                "invalid" => ("Invalid", $"Invalid email: {payload.Reason}"),
                "deferred" => ("Deferred", $"Delivery deferred: {payload.Reason}"),
                _ => (null, null) // click, open, unsubscribe, etc. — don't update status
            };
        }
    }

    // ── WhatsApp Cloud API webhook payload models ──────────────────────────────

    public class WhatsAppWebhookPayload
    {
        [System.Text.Json.Serialization.JsonPropertyName("object")]
        public string? Object { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("entry")]
        public List<WhatsAppEntry>? Entry { get; set; }
    }

    public class WhatsAppEntry
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string? Id { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("changes")]
        public List<WhatsAppChange>? Changes { get; set; }
    }

    public class WhatsAppChange
    {
        [System.Text.Json.Serialization.JsonPropertyName("field")]
        public string? Field { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("value")]
        public WhatsAppChangeValue? Value { get; set; }
    }

    public class WhatsAppChangeValue
    {
        [System.Text.Json.Serialization.JsonPropertyName("messaging_product")]
        public string? MessagingProduct { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("statuses")]
        public List<WhatsAppStatusUpdate>? Statuses { get; set; }
    }

    public class WhatsAppStatusUpdate
    {
        /// <summary>The WhatsApp message ID returned by the send API.</summary>
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string? Id { get; set; }

        /// <summary>sent | delivered | read | failed</summary>
        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string? Status { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("timestamp")]
        public string? Timestamp { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("recipient_id")]
        public string? RecipientId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("errors")]
        public List<WhatsAppWebhookError>? Errors { get; set; }
    }

    public class WhatsAppWebhookError
    {
        [System.Text.Json.Serialization.JsonPropertyName("code")]
        public int Code { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("title")]
        public string? Title { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    /// <summary>
    /// Brevo webhook event payload.
    /// See: https://developers.brevo.com/docs/transactional-webhooks
    /// </summary>
    public class BrevoWebhookEvent
    {
        /// <summary>Event type: delivered, hard_bounce, soft_bounce, blocked, spam, invalid, deferred, click, open, etc.</summary>
        [System.Text.Json.Serialization.JsonPropertyName("event")]
        public string? Event { get; set; }

        /// <summary>Recipient email address</summary>
        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string? Email { get; set; }

        /// <summary>SMTP Message-ID header value</summary>
        [System.Text.Json.Serialization.JsonPropertyName("message-id")]
        public string? MessageId { get; set; }

        /// <summary>Unix timestamp of the event</summary>
        [System.Text.Json.Serialization.JsonPropertyName("ts_event")]
        public long? TsEvent { get; set; }

        /// <summary>Bounce/block reason from the receiving server</summary>
        [System.Text.Json.Serialization.JsonPropertyName("reason")]
        public string? Reason { get; set; }

        /// <summary>Subject of the email</summary>
        [System.Text.Json.Serialization.JsonPropertyName("subject")]
        public string? Subject { get; set; }

        /// <summary>Tag if any was set</summary>
        [System.Text.Json.Serialization.JsonPropertyName("tag")]
        public string? Tag { get; set; }

        /// <summary>Sending IP address</summary>
        [System.Text.Json.Serialization.JsonPropertyName("sending_ip")]
        public string? SendingIp { get; set; }
    }
}
