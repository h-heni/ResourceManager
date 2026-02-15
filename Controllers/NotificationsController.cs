using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Controllers
{
    [Authorize]
    public class NotificationsController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<NotificationsController> _logger;

        public NotificationsController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<NotificationsController> logger)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
        }

        // GET: api/notifications - Get all unread notifications for current user
        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] bool includeRead = false)
        {
            try
            {
                var userId = _userManager.GetUserId(User);
                
                var query = _context.PaymentNotifications
                    .Where(n => n.UserId == userId);

                if (!includeRead)
                {
                    query = query.Where(n => !n.IsRead);
                }

                var notifications = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .Select(n => new {
                        n.Id,
                        n.PaymentId,
                        n.InvoiceId,
                        n.Message,
                        n.CreatedAt,
                        n.IsRead,
                        n.ReadAt
                    })
                    .ToListAsync();

                return Ok(notifications);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching notifications");
                return Ok(Array.Empty<object>());
            }
        }

        // GET: api/notifications/count - Get unread notification count
        [HttpGet("count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = _userManager.GetUserId(User);
            
            var count = await _context.PaymentNotifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .CountAsync();

            return Ok(new { count });
        }

        // POST: api/notifications/{id}/read - Mark a notification as read
        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = _userManager.GetUserId(User);
            
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

            if (notification == null)
            {
                return NotFound();
            }

            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();

            return Ok(new { message = "Notification marked as read" });
        }

        // POST: api/notifications/read-all - Mark all notifications as read
        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = _userManager.GetUserId(User);
            
            var unreadNotifications = await _context.PaymentNotifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            var now = DateTime.UtcNow;
            foreach (var notification in unreadNotifications)
            {
                notification.IsRead = true;
                notification.ReadAt = now;
            }
            
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Marked {unreadNotifications.Count} notifications as read" });
        }

        // DELETE: api/notifications/{id} - Delete a notification
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNotification(int id)
        {
            var userId = _userManager.GetUserId(User);
            
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

            if (notification == null)
            {
                return NotFound();
            }

            _context.PaymentNotifications.Remove(notification);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Notification deleted" });
        }

        // POST: api/notifications/{id}/confirm-payment - Confirm a due payment
        [HttpPost("{id}/confirm-payment")]
        public async Task<IActionResult> ConfirmPayment(int id)
        {
            var userId = _userManager.GetUserId(User);
            
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

            if (notification == null) return NotFound();

            var payment = await _context.Payments
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Payments)
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Devis)
                .FirstOrDefaultAsync(p => p.Id == notification.PaymentId);

            if (payment == null) return NotFound(new { message = "Payment not found" });

            // Mark payment as Completed
            payment.Status = "Completed";
            payment.PaymentDate = DateTime.UtcNow;
            
            // Audit: Who confirmed it?
            payment.ConfirmedByUserId = userId;
            payment.ConfirmedAt = DateTime.UtcNow;

            // Mark notification as read
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;

            // Recalculate invoice status
            if (payment.Invoice != null)
            {
                var totalPaid = payment.Invoice.Payments
                    .Where(p => p.Status == "Completed")
                    .Sum(p => p.Amount);
                var totalAmount = payment.Invoice.TotalAmount ?? 0;

                if (totalPaid >= totalAmount)
                {
                    payment.Invoice.Status = "Paid";
                    
                    // Mark related devis as treated
                    if (payment.Invoice.Devis != null)
                    {
                        payment.Invoice.Devis.Status = "Completed";
                        payment.Invoice.Devis.Treated = true;
                    }
                    
                    // Mark related delivery notes as treated  
                    var deliveryNotes = await _context.DeliveryNotes
                        .Where(dn => dn.InvoiceId == payment.InvoiceId)
                        .ToListAsync();
                    foreach (var dn in deliveryNotes)
                    {
                        dn.Treated = true;
                    }
                }
                else if (totalPaid > 0)
                {
                    payment.Invoice.Status = "PartiallyPaid";
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Payment confirmed successfully",
                paymentId = payment.Id,
                invoiceStatus = payment.Invoice?.Status
            });
        }

        // POST: api/notifications/{id}/extend-payment - Extend a due payment date
        [HttpPost("{id}/extend-payment")]
        public async Task<IActionResult> ExtendPayment(int id, [FromBody] ExtendPaymentDto dto)
        {
            var userId = _userManager.GetUserId(User);
            
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

            if (notification == null) return NotFound();

            var payment = await _context.Payments
                .Include(p => p.Invoice)
                .FirstOrDefaultAsync(p => p.Id == notification.PaymentId);

            if (payment == null) return NotFound(new { message = "Payment not found" });

            // Extend the payment date and reset status to Pending
            payment.PaymentDate = dto.NewDate.ToUniversalTime();
            payment.Status = "Pending";
            if (!string.IsNullOrWhiteSpace(dto.Notes))
            {
                payment.Notes = (payment.Notes ?? "") + $" | Extended to {dto.NewDate:d}: {dto.Notes}";
            }

            // Mark notification as read
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Payment date extended",
                newDate = payment.PaymentDate,
                paymentId = payment.Id
            });
        }

        // POST: api/notifications/process-due — DISABLED: auto-completion removed, payments stay Pending until manually approved
        [HttpPost("process-due")]
        public IActionResult ProcessDuePayments()
        {
            return Ok(new { processed = 0, message = "Auto-completion disabled. Payments must be manually approved." });
        }

        // GET: api/notifications/due-payments - Get payments that are due (for notification display)
        [HttpGet("due-payments")]
        public async Task<IActionResult> GetDuePayments()
        {
            try
            {
                var userId = _userManager.GetUserId(User);

                // List pending payments that need manual approval (Status == Pending AND due date <= today)
                var duePayments = await _context.Payments
                    .Include(p => p.Invoice)
                        .ThenInclude(i => i!.Client)
                    .Include(p => p.Invoice)
                        .ThenInclude(i => i!.Devis)
                    .Where(p => p.CreatedByUserId == userId && p.Status == "Pending" && p.PaymentDate <= DateTime.UtcNow)
                    .Select(p => new
                    {
                        p.Id,
                        p.Amount,
                        p.PaymentDate,
                        p.InvoiceId,
                        InvoiceNumber = p.Invoice!.Number,
                        ClientName = p.Invoice != null && p.Invoice.Client != null ? p.Invoice.Client.Name : "Unknown",
                        InvoiceTotal = p.Invoice != null ? p.Invoice.TotalAmount : 0m,
                        p.Notes,
                        InvoiceCurrencySymbol = p.Invoice != null && p.Invoice.Devis != null ? p.Invoice.Devis.CurrencySymbol : "TND"
                    })
                    .ToListAsync();

                return Ok(duePayments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching due payments");
                return Ok(Array.Empty<object>());
            }
        }

        // POST: api/notifications/confirm-payment-by-id/{paymentId} - Confirm a due payment directly by payment ID
        [HttpPost("confirm-payment-by-id/{paymentId}")]
        public async Task<IActionResult> ConfirmPaymentById(int paymentId)
        {
            var userId = _userManager.GetUserId(User);

            var payment = await _context.Payments
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Payments)
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Devis)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.CreatedByUserId == userId);

            if (payment == null) return NotFound(new { message = "Payment not found" });

            // Mark payment as Completed
            payment.Status = "Completed";
            payment.PaymentDate = DateTime.UtcNow;
            
            // Audit: Who confirmed it?
            payment.ConfirmedByUserId = userId;
            payment.ConfirmedAt = DateTime.UtcNow;

            // Mark any related notification as read
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.PaymentId == paymentId && n.UserId == userId);
            if (notification != null)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            // Recalculate invoice status
            if (payment.Invoice != null)
            {
                var totalPaid = payment.Invoice.Payments
                    .Where(p => p.Status == "Completed")
                    .Sum(p => p.Amount);
                var totalAmount = payment.Invoice.TotalAmount ?? 0;

                if (totalPaid >= totalAmount)
                {
                    payment.Invoice.Status = "Paid";
                    payment.Invoice.Treated = true;
                    payment.Invoice.TreatedByUserId = userId;
                    payment.Invoice.TreatedAt = DateTime.UtcNow;
                    if (payment.Invoice.Devis != null)
                    {
                        payment.Invoice.Devis.Status = "Completed";
                        payment.Invoice.Devis.Treated = true;
                    }
                    var deliveryNotes = await _context.DeliveryNotes
                        .Where(dn => dn.InvoiceId == payment.InvoiceId)
                        .ToListAsync();
                    foreach (var dn in deliveryNotes) { dn.Treated = true; }
                }
                else if (totalPaid > 0)
                {
                    payment.Invoice.Status = "PartiallyPaid";
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Payment confirmed successfully",
                paymentId = payment.Id,
                invoiceStatus = payment.Invoice?.Status
            });
        }

        // POST: api/notifications/extend-payment-by-id/{paymentId} - Extend a due payment directly by payment ID
        [HttpPost("extend-payment-by-id/{paymentId}")]
        public async Task<IActionResult> ExtendPaymentById(int paymentId, [FromBody] ExtendPaymentDto dto)
        {
            var userId = _userManager.GetUserId(User);

            var payment = await _context.Payments
                .Include(p => p.Invoice)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.CreatedByUserId == userId);

            if (payment == null) return NotFound(new { message = "Payment not found" });

            // Extend the payment date and reset status to Pending
            payment.PaymentDate = dto.NewDate.ToUniversalTime();
            payment.Status = "Pending";
            if (!string.IsNullOrWhiteSpace(dto.Notes))
            {
                payment.Notes = (payment.Notes ?? "") + $" | Extended to {dto.NewDate:d}: {dto.Notes}";
            }

            // Mark any related notification as read
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.PaymentId == paymentId && n.UserId == userId);
            if (notification != null)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Payment date extended",
                newDate = payment.PaymentDate,
                paymentId = payment.Id
            });
        }

        // ═══════════════════════════════════════════════════════════
        // SUPPLIER PAYMENT ENDPOINTS
        // ═══════════════════════════════════════════════════════════

        // GET: api/notifications/due-supplier-payments - Get supplier payments that are due
        [HttpGet("due-supplier-payments")]
        public async Task<IActionResult> GetDueSupplierPayments()
        {
            try
            {
                var userId = _userManager.GetUserId(User);

                // List pending supplier payments that need manual approval (Status == Pending AND due date <= today)
                var dueSupplierPayments = await _context.SupplierPayments
                    .Include(p => p.FournisseurInvoice)
                        .ThenInclude(fi => fi!.Fournisseur)
                    .Where(p => p.CreatedByUserId == userId && p.Status == "Pending" && p.PaymentDate <= DateTime.UtcNow)
                    .Select(p => new
                    {
                        p.Id,
                        p.Amount,
                        p.PaymentDate,
                        SupplierInvoiceId = p.FournisseurInvoiceId,
                        InvoiceNumber = p.FournisseurInvoice != null ? (p.FournisseurInvoice.InvoiceNumber ?? "Unknown") : "Unknown",
                        SupplierName = p.FournisseurInvoice != null && p.FournisseurInvoice.Fournisseur != null ? p.FournisseurInvoice.Fournisseur.Name : "Unknown",
                        InvoiceTotal = p.FournisseurInvoice != null ? p.FournisseurInvoice.TotalTTC : 0m,
                        p.Notes,
                        InvoiceCurrencySymbol = p.FournisseurInvoice != null ? p.FournisseurInvoice.CurrencySymbol : "TND"
                    })
                    .ToListAsync();

                return Ok(dueSupplierPayments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching due supplier payments");
                return Ok(Array.Empty<object>());
            }
        }

        // POST: api/notifications/confirm-supplier-payment/{paymentId} - Confirm a due supplier payment
        [HttpPost("confirm-supplier-payment/{paymentId}")]
        public async Task<IActionResult> ConfirmSupplierPayment(int paymentId)
        {
            var userId = _userManager.GetUserId(User);

            var payment = await _context.SupplierPayments
                .Include(p => p.FournisseurInvoice)
                    .ThenInclude(fi => fi!.Payments)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.CreatedByUserId == userId);

            if (payment == null) return NotFound(new { message = "Supplier payment not found" });

            // Mark payment as Completed
            payment.Status = "Completed";
            payment.PaymentDate = DateTime.UtcNow;

            // Mark any related notification as read
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.SupplierPaymentId == paymentId && n.UserId == userId);
            if (notification != null)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Get updated payment status
            var paymentStatus = payment.FournisseurInvoice?.PaymentStatus ?? "Unknown";

            return Ok(new { 
                message = "Supplier payment confirmed successfully",
                paymentId = payment.Id,
                paymentStatus
            });
        }

        // POST: api/notifications/extend-supplier-payment/{paymentId} - Extend a due supplier payment date
        [HttpPost("extend-supplier-payment/{paymentId}")]
        public async Task<IActionResult> ExtendSupplierPayment(int paymentId, [FromBody] ExtendPaymentDto dto)
        {
            var userId = _userManager.GetUserId(User);

            var payment = await _context.SupplierPayments
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.CreatedByUserId == userId);

            if (payment == null) return NotFound(new { message = "Supplier payment not found" });

            // Extend the payment date and reset status to Pending
            payment.PaymentDate = dto.NewDate.ToUniversalTime();
            payment.Status = "Pending";
            if (!string.IsNullOrWhiteSpace(dto.Notes))
            {
                payment.Notes = (payment.Notes ?? "") + $" | Extended to {dto.NewDate:d}: {dto.Notes}";
            }

            // Mark any related notification as read
            var notification = await _context.PaymentNotifications
                .FirstOrDefaultAsync(n => n.SupplierPaymentId == paymentId && n.UserId == userId);
            if (notification != null)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Supplier payment date extended",
                newDate = payment.PaymentDate,
                paymentId = payment.Id
            });
        }
    }

    public class ExtendPaymentDto
    {
        public DateTime NewDate { get; set; }
        public string? Notes { get; set; }
    }
}
