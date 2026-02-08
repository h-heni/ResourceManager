using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;

namespace ResourceManager.Services
{
    /// <summary>
    /// Background service that processes scheduled payments when their date arrives.
    /// Runs every hour to check for payments that are due.
    /// OPTIMIZED: Delays initial run to avoid blocking startup, handles DB errors gracefully.
    /// </summary>
    public class ScheduledPaymentService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScheduledPaymentService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);
        private readonly TimeSpan _initialDelay = TimeSpan.FromMinutes(2); // Delay first run to let app fully start
        private readonly TimeSpan _retryDelay = TimeSpan.FromMinutes(5); // Retry delay on DB errors
        private int _consecutiveErrors = 0;
        private const int MaxConsecutiveErrors = 5; // Stop logging after repeated DB failures

        public ScheduledPaymentService(IServiceProvider serviceProvider, ILogger<ScheduledPaymentService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Scheduled Payment Service started. Will begin processing in {Delay} minutes.", _initialDelay.TotalMinutes);

            // OPTIMIZATION: Delay initial run so app can start quickly
            try
            {
                await Task.Delay(_initialDelay, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessScheduledPaymentsAsync(stoppingToken);
                    _consecutiveErrors = 0; // Reset error counter on success
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    // App is shutting down, exit gracefully
                    break;
                }
                catch (Exception ex) when (IsDatabaseConnectionError(ex))
                {
                    _consecutiveErrors++;
                    
                    // Only log first few DB errors to avoid log spam
                    if (_consecutiveErrors <= MaxConsecutiveErrors)
                    {
                        _logger.LogWarning("Database connection unavailable for scheduled payments (attempt {Count}). Will retry in {Delay} minutes.", 
                            _consecutiveErrors, _retryDelay.TotalMinutes);
                    }
                    else if (_consecutiveErrors == MaxConsecutiveErrors + 1)
                    {
                        _logger.LogWarning("Suppressing repeated database connection errors. Service will continue retrying silently.");
                    }
                    
                    // Wait shorter on DB errors before retry
                    try
                    {
                        await Task.Delay(_retryDelay, stoppingToken);
                    }
                    catch (TaskCanceledException)
                    {
                        break;
                    }
                    continue; // Skip the normal wait interval
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error processing scheduled payments");
                }

                try
                {
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
            
            _logger.LogInformation("Scheduled Payment Service stopped.");
        }

        private static bool IsDatabaseConnectionError(Exception ex)
        {
            // Check for common DB connection errors
            return ex is System.Net.Sockets.SocketException ||
                   ex.InnerException is System.Net.Sockets.SocketException ||
                   ex.Message.Contains("connection", StringComparison.OrdinalIgnoreCase) ||
                   ex.Message.Contains("timeout", StringComparison.OrdinalIgnoreCase);
        }

        private async Task ProcessScheduledPaymentsAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var now = DateTime.UtcNow;

            // Get all pending payments where the scheduled date has arrived
            var duePendingPayments = await context.Payments
                .Include(p => p.Invoice)
                .Where(p => p.Status == "Pending" && p.PaymentDate <= now)
                .ToListAsync(stoppingToken);

            if (duePendingPayments.Count == 0)
            {
                return;
            }

            _logger.LogInformation("Processing {Count} scheduled payments that are now due.", duePendingPayments.Count);

            foreach (var payment in duePendingPayments)
            {
                // Check if a notification already exists for this payment
                var existingNotification = await context.PaymentNotifications
                    .AnyAsync(n => n.PaymentId == payment.Id && !n.IsRead, stoppingToken);

                if (existingNotification)
                {
                    // Already has an unread notification, skip
                    continue;
                }

                // DON'T auto-complete. Instead, mark as "Due" and create a notification asking the user
                payment.Status = "Due";

                // Create notification asking user to confirm
                var notification = new PaymentNotification
                {
                    PaymentId = payment.Id,
                    InvoiceId = payment.InvoiceId,
                    Message = $"💰 Scheduled payment of {payment.Amount:N3} TND for Invoice #{payment.Invoice?.Number ?? "Unknown"} is now due. Is the money received in the bank?",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false,
                    UserId = payment.CreatedByUserId
                };
                context.PaymentNotifications.Add(notification);

                _logger.LogInformation("Created notification for due payment {PaymentId} for invoice {InvoiceId}", 
                    payment.Id, payment.InvoiceId);
            }

            await context.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("Successfully processed {Count} scheduled payments.", duePendingPayments.Count);
        }
    }

    /// <summary>
    /// Notification entity for persistent payment notifications
    /// </summary>
    public class PaymentNotification
    {
        public int Id { get; set; }
        public int PaymentId { get; set; }
        public int InvoiceId { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;
        public DateTime? ReadAt { get; set; }
        public string? UserId { get; set; }
    }
}
