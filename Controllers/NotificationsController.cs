using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;

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

        // GET: api/notifications/due-payments - Get payments that are due (for notification display)
        [HttpGet("due-payments")]
        public async Task<IActionResult> GetDuePayments()
        {
            var userId = _userManager.GetUserId(User);
            
            var duePayments = await _context.Payments
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Client)
                .Where(p => p.CreatedByUserId == userId && p.Status == "Due")
                .Select(p => new
                {
                    p.Id,
                    p.Amount,
                    p.PaymentDate,
                    p.InvoiceId,
                    InvoiceNumber = p.Invoice!.Number,
                    ClientName = p.Invoice.Client != null ? p.Invoice.Client.Name : "Unknown",
                    InvoiceTotal = p.Invoice.TotalAmount,
                    p.Notes
                })
                .ToListAsync();

            return Ok(duePayments);
        }
    }

    public class ExtendPaymentDto
    {
        public DateTime NewDate { get; set; }
        public string? Notes { get; set; }
    }
}
