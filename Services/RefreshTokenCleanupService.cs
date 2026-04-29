using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;

namespace ResourceManager.Services
{
    /// <summary>
    /// Background service that deletes expired and revoked refresh tokens older than 7 days.
    /// Runs once at startup and then every 24 hours, preventing unbounded DB table growth
    /// and ensuring stale hashed tokens cannot persist in the system indefinitely.
    /// </summary>
    public sealed class RefreshTokenCleanupService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<RefreshTokenCleanupService> _logger;

        // How often to sweep the table (once per day is sufficient — tokens expire in 7 days)
        private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(24);

        // Retain revoked/expired rows for this long before deletion (useful for audit/replay detection)
        private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(7);

        public RefreshTokenCleanupService(
            IServiceScopeFactory scopeFactory,
            ILogger<RefreshTokenCleanupService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("RefreshTokenCleanupService started — interval={Interval}h, retention={Retention}d.",
                CleanupInterval.TotalHours, RetentionPeriod.TotalDays);

            while (!stoppingToken.IsCancellationRequested)
            {
                await CleanupAsync(stoppingToken);

                // Wait for next cycle; ignore cancellation on the delay itself (checked on next loop)
                await Task.Delay(CleanupInterval, stoppingToken)
                    .ContinueWith(_ => { }, CancellationToken.None);
            }
        }

        private async Task CleanupAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var cutoff = DateTime.UtcNow.Subtract(RetentionPeriod);

                // Delete tokens that are:
                //   (a) naturally expired AND past the retention window, OR
                //   (b) explicitly revoked AND past the retention window
                var deleted = await db.RefreshTokens
                    .Where(t =>
                        (t.ExpiresAt < DateTime.UtcNow && t.CreatedAt < cutoff) ||
                        (t.RevokedAt != null && t.RevokedAt < cutoff))
                    .ExecuteDeleteAsync(ct);

                if (deleted > 0)
                    _logger.LogInformation("RefreshTokenCleanup: deleted {Count} stale tokens.", deleted);
                else
                    _logger.LogDebug("RefreshTokenCleanup: no stale tokens found.");
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown — do not log as error
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RefreshTokenCleanupService: cleanup cycle failed.");
            }
        }
    }
}
