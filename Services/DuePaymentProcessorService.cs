using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Services
{
    /// <summary>
    /// Scoped service that processes pending payments whose scheduled date has passed.
    /// Transitions Pending → Due and creates notifications.
    /// 
    /// Can be called from:
    /// 1. ScheduledPaymentService (background, periodic)
    /// 2. NotificationsController (on-demand, when user fetches notifications)
    /// 3. Any API endpoint that needs fresh payment status
    /// </summary>
    public interface IDuePaymentProcessor
    {
        /// <summary>
        /// Process all pending payments for all users whose PaymentDate has passed.
        /// Returns the number of payments transitioned to Due.
        /// </summary>
        Task<int> ProcessAllDuePaymentsAsync(CancellationToken ct = default);

        /// <summary>
        /// Process pending payments only for a specific user.
        /// </summary>
        Task<int> ProcessDuePaymentsForUserAsync(string userId, CancellationToken ct = default);
    }

    public class DuePaymentProcessorService : IDuePaymentProcessor
    {
        private readonly AppDbContext _context;
        private readonly ILogger<DuePaymentProcessorService> _logger;

        // Throttle: don't re-process if we ran within the last 30 seconds
        private static DateTime _lastGlobalRun = DateTime.MinValue;
        private static readonly object _lock = new();

        public DuePaymentProcessorService(AppDbContext context, ILogger<DuePaymentProcessorService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<int> ProcessAllDuePaymentsAsync(CancellationToken ct = default)
        {
            // Throttle to avoid redundant DB queries from concurrent requests
            lock (_lock)
            {
                if ((DateTime.UtcNow - _lastGlobalRun).TotalSeconds < 30)
                {
                    _logger.LogDebug("Skipping due payment processing — last run was {Seconds}s ago", 
                        (DateTime.UtcNow - _lastGlobalRun).TotalSeconds);
                    return 0;
                }
                _lastGlobalRun = DateTime.UtcNow;
            }

            return await ProcessDuePaymentsInternalAsync(userId: null, ct);
        }

        public async Task<int> ProcessDuePaymentsForUserAsync(string userId, CancellationToken ct = default)
        {
            return await ProcessDuePaymentsInternalAsync(userId, ct);
        }

        private async Task<int> ProcessDuePaymentsInternalAsync(string? userId, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            int totalTransitioned = 0;

            _logger.LogInformation(
                "DuePaymentProcessor: Starting check at {Now} (UTC) for {Scope}",
                now.ToString("yyyy-MM-dd HH:mm:ss"), 
                userId != null ? $"user {userId}" : "all users");

            // ═══════════════════════════════════════════════════════
            // CLIENT INVOICE PAYMENTS: Pending → Due
            // ═══════════════════════════════════════════════════════
            var clientPaymentQuery = _context.Payments
                .Include(p => p.Invoice)
                    .ThenInclude(i => i!.Client)
                .Where(p => p.Status == "Pending" && p.PaymentDate <= now);

            if (userId != null)
                clientPaymentQuery = clientPaymentQuery.Where(p => p.CreatedByUserId == userId);

            var pendingClientPayments = await clientPaymentQuery.ToListAsync(ct);

            foreach (var payment in pendingClientPayments)
            {
                _logger.LogWarning(
                    "DuePaymentProcessor: CLIENT payment ID={PaymentId} is PAST DUE. " +
                    "PaymentDate={PaymentDate} (UTC), Now={Now} (UTC), InvoiceId={InvoiceId}, " +
                    "Invoice#={InvoiceNumber}, Amount={Amount}. Transitioning Pending → Due.",
                    payment.Id, 
                    payment.PaymentDate.ToString("yyyy-MM-dd HH:mm:ss"),
                    now.ToString("yyyy-MM-dd HH:mm:ss"),
                    payment.InvoiceId,
                    payment.Invoice?.Number ?? "Unknown",
                    payment.Amount);

                // Transition status
                payment.Status = "Due";
                totalTransitioned++;

                // Create notification if one doesn't already exist (regardless of read status to avoid duplicates)
                var hasExistingNotification = await _context.PaymentNotifications
                    .AnyAsync(n => n.PaymentId == payment.Id, ct);

                if (!hasExistingNotification)
                {
                    var clientName = payment.Invoice?.Client?.Name ?? "Unknown";
                    var invoiceNumber = payment.Invoice?.Number ?? "Unknown";
                    var currencySymbol = payment.Invoice?.CurrencySymbol ?? "TND";

                    var notification = new PaymentNotification
                    {
                        PaymentId = payment.Id,
                        InvoiceId = payment.InvoiceId,
                        Message = $"💰 Scheduled payment of {payment.Amount:N3} {currencySymbol} for Invoice #{invoiceNumber} ({clientName}) is now due. Is the money received in the bank?",
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false,
                        UserId = payment.CreatedByUserId
                    };
                    _context.PaymentNotifications.Add(notification);

                    _logger.LogInformation(
                        "DuePaymentProcessor: Created notification for client payment {PaymentId}, " +
                        "Invoice #{InvoiceNumber}, Client={ClientName}",
                        payment.Id, invoiceNumber, clientName);
                }
            }

            // ═══════════════════════════════════════════════════════
            // SUPPLIER INVOICE PAYMENTS: Pending → Due
            // ═══════════════════════════════════════════════════════
            var supplierPaymentQuery = _context.SupplierPayments
                .Include(p => p.FournisseurInvoice)
                    .ThenInclude(fi => fi!.Fournisseur)
                .Where(p => p.Status == "Pending" && p.PaymentDate <= now);

            if (userId != null)
                supplierPaymentQuery = supplierPaymentQuery.Where(p => p.CreatedByUserId == userId);

            var pendingSupplierPayments = await supplierPaymentQuery.ToListAsync(ct);

            foreach (var payment in pendingSupplierPayments)
            {
                _logger.LogWarning(
                    "DuePaymentProcessor: SUPPLIER payment ID={PaymentId} is PAST DUE. " +
                    "PaymentDate={PaymentDate} (UTC), Now={Now} (UTC), SupplierInvoiceId={InvoiceId}, " +
                    "Invoice#={InvoiceNumber}, Supplier={SupplierName}, Amount={Amount}. Transitioning Pending → Due.",
                    payment.Id,
                    payment.PaymentDate.ToString("yyyy-MM-dd HH:mm:ss"),
                    now.ToString("yyyy-MM-dd HH:mm:ss"),
                    payment.FournisseurInvoiceId,
                    payment.FournisseurInvoice?.InvoiceNumber ?? "Unknown",
                    payment.FournisseurInvoice?.Fournisseur?.Name ?? "Unknown",
                    payment.Amount);

                // Transition status
                payment.Status = "Due";
                totalTransitioned++;

                // Create notification if one doesn't already exist (regardless of read status to avoid duplicates)
                var hasExistingNotification = await _context.PaymentNotifications
                    .AnyAsync(n => n.SupplierPaymentId == payment.Id, ct);

                if (!hasExistingNotification)
                {
                    var supplierName = payment.FournisseurInvoice?.Fournisseur?.Name ?? "Unknown";
                    var invoiceNumber = payment.FournisseurInvoice?.InvoiceNumber ?? "Unknown";
                    var currencySymbol = payment.FournisseurInvoice?.CurrencySymbol ?? "TND";

                    var notification = new PaymentNotification
                    {
                        PaymentId = 0,
                        InvoiceId = 0,
                        SupplierPaymentId = payment.Id,
                        SupplierInvoiceId = payment.FournisseurInvoiceId,
                        Message = $"📦 Scheduled supplier payment of {payment.Amount:N3} {currencySymbol} for Invoice #{invoiceNumber} ({supplierName}) is now due. Has the payment been sent?",
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false,
                        UserId = payment.CreatedByUserId
                    };
                    _context.PaymentNotifications.Add(notification);

                    _logger.LogInformation(
                        "DuePaymentProcessor: Created notification for supplier payment {PaymentId}, " +
                        "Invoice #{InvoiceNumber}, Supplier={SupplierName}",
                        payment.Id, invoiceNumber, supplierName);
                }
            }

            // Save all changes
            if (totalTransitioned > 0)
            {
                await _context.SaveChangesAsync(ct);
                _logger.LogWarning(
                    "DuePaymentProcessor: COMPLETED — Transitioned {Count} payments from Pending → Due " +
                    "({ClientCount} client, {SupplierCount} supplier)",
                    totalTransitioned, pendingClientPayments.Count, pendingSupplierPayments.Count);
            }
            else
            {
                _logger.LogDebug("DuePaymentProcessor: No pending payments past their due date.");
            }

            return totalTransitioned;
        }
    }
}
