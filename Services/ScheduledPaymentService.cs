namespace ResourceManager.Services
{
    /// <summary>
    /// Background service that periodically calls IDuePaymentProcessor to transition
    /// Pending payments to Due. This is a SAFETY NET — the primary trigger is the
    /// on-demand check in NotificationsController when the frontend polls.
    /// 
    /// Runs every 15 minutes (reduced from 1 hour) with a 30-second initial delay
    /// (reduced from 2 minutes).
    /// </summary>
    public class ScheduledPaymentService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScheduledPaymentService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);
        private readonly TimeSpan _initialDelay = TimeSpan.FromSeconds(30);
        private readonly TimeSpan _retryDelay = TimeSpan.FromMinutes(2);
        private int _consecutiveErrors = 0;
        private const int MaxConsecutiveErrors = 5;

        public ScheduledPaymentService(IServiceProvider serviceProvider, ILogger<ScheduledPaymentService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ScheduledPaymentService: Started. First run in {Delay}s.", _initialDelay.TotalSeconds);

            try { await Task.Delay(_initialDelay, stoppingToken); }
            catch (TaskCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var processor = scope.ServiceProvider.GetRequiredService<IDuePaymentProcessor>();
                    var count = await processor.ProcessAllDuePaymentsAsync(stoppingToken);
                    
                    if (count > 0)
                        _logger.LogInformation("ScheduledPaymentService: Background run transitioned {Count} payments.", count);
                    
                    _consecutiveErrors = 0;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _consecutiveErrors++;
                    if (_consecutiveErrors <= MaxConsecutiveErrors)
                    {
                        _logger.LogWarning(ex, "ScheduledPaymentService: Error processing payments (attempt {Count}).", _consecutiveErrors);
                    }

                    try { await Task.Delay(_retryDelay, stoppingToken); }
                    catch (TaskCanceledException) { break; }
                    continue;
                }

                try { await Task.Delay(_checkInterval, stoppingToken); }
                catch (TaskCanceledException) { break; }
            }
            
            _logger.LogInformation("ScheduledPaymentService: Stopped.");
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
        // Supplier payment support
        public int? SupplierPaymentId { get; set; }
        public int? SupplierInvoiceId { get; set; }
    }
}
