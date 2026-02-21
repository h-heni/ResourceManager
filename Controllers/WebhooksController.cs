using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Services;

namespace ResourceManager.Controllers
{
    /// <summary>
    /// Receives webhook events from external services (e.g. Brevo email delivery events).
    /// These endpoints are anonymous — they do NOT require JWT authentication.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<WebhooksController> _logger;

        public WebhooksController(AppDbContext context, ILogger<WebhooksController> logger)
        {
            _context = context;
            _logger = logger;
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
