using System.Collections.Concurrent;
using System.Diagnostics;
using ResourceManager.Data;
using ResourceManager.Models;
using Microsoft.EntityFrameworkCore;

namespace ResourceManager.Services;

// ═══════════════════════════════════════════════════════════════
// 1. IN-MEMORY LOG SINK — Serilog writes here, Admin reads
// ═══════════════════════════════════════════════════════════════

public class LogEntry
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string Level { get; set; } = string.Empty;     // Error, Warning, Information, Fatal
    public string Message { get; set; } = string.Empty;
    public string? Source { get; set; }                     // API, Auth, Payment, PDF, Notification
    public string? CorrelationId { get; set; }
    public string? ExceptionType { get; set; }
}

public class InMemoryLogSink : Serilog.Core.ILogEventSink
{
    private static readonly ConcurrentQueue<LogEntry> _logs = new();
    private static long _nextId;
    private const int MaxEntries = 2000;

    public void Emit(Serilog.Events.LogEvent logEvent)
    {
        // Only capture Warning+ to keep volume manageable
        if (logEvent.Level < Serilog.Events.LogEventLevel.Warning)
            return;

        var entry = new LogEntry
        {
            Id = Interlocked.Increment(ref _nextId),
            Timestamp = logEvent.Timestamp.UtcDateTime,
            Level = logEvent.Level.ToString(),
            Message = logEvent.RenderMessage(),
            ExceptionType = logEvent.Exception?.GetType().Name,
            Source = InferSource(logEvent)
        };

        _logs.Enqueue(entry);

        // Evict oldest when over capacity
        while (_logs.Count > MaxEntries)
            _logs.TryDequeue(out _);
    }

    public static IReadOnlyList<LogEntry> GetLogs(int page, int pageSize, string? level = null)
    {
        var query = _logs.AsEnumerable().Reverse(); // newest first

        if (!string.IsNullOrEmpty(level))
            query = query.Where(l => l.Level.Equals(level, StringComparison.OrdinalIgnoreCase));

        return query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
    }

    public static int GetTotalCount(string? level = null)
    {
        if (!string.IsNullOrEmpty(level))
            return _logs.Count(l => l.Level.Equals(level, StringComparison.OrdinalIgnoreCase));
        return _logs.Count;
    }

    public static Dictionary<string, int> GetCountsByLevel()
    {
        return _logs
            .GroupBy(l => l.Level)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static string InferSource(Serilog.Events.LogEvent logEvent)
    {
        var msg = logEvent.RenderMessage();
        if (msg.Contains("Auth", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("login", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("token", StringComparison.OrdinalIgnoreCase))
            return "Auth";
        if (msg.Contains("Payment", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("invoice", StringComparison.OrdinalIgnoreCase))
            return "Payment";
        if (msg.Contains("PDF", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("document", StringComparison.OrdinalIgnoreCase))
            return "PDF";
        if (msg.Contains("email", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("notification", StringComparison.OrdinalIgnoreCase) ||
            msg.Contains("smtp", StringComparison.OrdinalIgnoreCase))
            return "Notification";
        return "API";
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. APPLICATION METRICS SERVICE — Tracks request metrics
// ═══════════════════════════════════════════════════════════════

public class AppMetricsService
{
    private static readonly DateTime _startTime = DateTime.UtcNow;
    private long _totalRequests;
    private long _errorCount;
    private long _totalResponseTimeMs;

    // Sliding 24h error tracking
    private readonly ConcurrentQueue<DateTime> _recentErrors = new();

    public void RecordRequest(long elapsedMs, bool isError)
    {
        Interlocked.Increment(ref _totalRequests);
        Interlocked.Add(ref _totalResponseTimeMs, elapsedMs);

        if (isError)
        {
            Interlocked.Increment(ref _errorCount);
            _recentErrors.Enqueue(DateTime.UtcNow);

            // Evict entries older than 24h
            var cutoff = DateTime.UtcNow.AddHours(-24);
            while (_recentErrors.TryPeek(out var oldest) && oldest < cutoff)
                _recentErrors.TryDequeue(out _);
        }
    }

    public AppHealthSnapshot GetSnapshot()
    {
        var total = Interlocked.Read(ref _totalRequests);
        var errors = Interlocked.Read(ref _errorCount);
        var totalTime = Interlocked.Read(ref _totalResponseTimeMs);

        // 24h error rate
        var cutoff = DateTime.UtcNow.AddHours(-24);
        while (_recentErrors.TryPeek(out var oldest) && oldest < cutoff)
            _recentErrors.TryDequeue(out _);

        var recentErrorCount = _recentErrors.Count;

        return new AppHealthSnapshot
        {
            Status = recentErrorCount > 50 ? "Degraded" : "Healthy",
            UptimeSeconds = (long)(DateTime.UtcNow - _startTime).TotalSeconds,
            TotalRequests = total,
            AverageResponseTimeMs = total > 0 ? (double)totalTime / total : 0,
            ErrorRate24h = total > 0 ? Math.Round((double)recentErrorCount / Math.Max(total, 1) * 100, 2) : 0,
            ErrorCount24h = recentErrorCount,
            ServerStartedAt = _startTime
        };
    }
}

public class AppHealthSnapshot
{
    public string Status { get; set; } = "Healthy";
    public long UptimeSeconds { get; set; }
    public long TotalRequests { get; set; }
    public double AverageResponseTimeMs { get; set; }
    public double ErrorRate24h { get; set; }
    public int ErrorCount24h { get; set; }
    public DateTime ServerStartedAt { get; set; }
}

// ═══════════════════════════════════════════════════════════════
// 3. METRICS MIDDLEWARE — Records request timing + errors
// ═══════════════════════════════════════════════════════════════

public class MetricsMiddleware
{
    private readonly RequestDelegate _next;
    private readonly AppMetricsService _metrics;

    public MetricsMiddleware(RequestDelegate next, AppMetricsService metrics)
    {
        _next = next;
        _metrics = metrics;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var isError = context.Response.StatusCode >= 500;
            _metrics.RecordRequest(sw.ElapsedMilliseconds, isError);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. SESSION TRACKER — Tracks live connected users
// ═══════════════════════════════════════════════════════════════

public class UserSession
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime LastActivity { get; set; }
    public string? IpAddress { get; set; }
}

public class SessionTrackerService
{
    private readonly ConcurrentDictionary<string, UserSession> _sessions = new();
    private static readonly TimeSpan InactiveThreshold = TimeSpan.FromMinutes(15);

    public void TrackActivity(string userId, string email, string role, string? ipAddress)
    {
        _sessions.AddOrUpdate(userId,
            _ => new UserSession
            {
                UserId = userId,
                Email = email,
                Role = role,
                LastActivity = DateTime.UtcNow,
                IpAddress = ipAddress
            },
            (_, existing) =>
            {
                existing.LastActivity = DateTime.UtcNow;
                existing.IpAddress = ipAddress;
                existing.Role = role;
                return existing;
            });
    }

    public LiveUsersSnapshot GetSnapshot()
    {
        var cutoff = DateTime.UtcNow - InactiveThreshold;

        // Clean up old sessions
        foreach (var kvp in _sessions)
        {
            if (kvp.Value.LastActivity < cutoff)
                _sessions.TryRemove(kvp.Key, out _);
        }

        var active = _sessions.Values.Where(s => s.LastActivity >= cutoff).ToList();

        return new LiveUsersSnapshot
        {
            TotalConnected = active.Count,
            SuperAdminCount = active.Count(u => u.Role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase)),
            ManagerCount = active.Count(u => u.Role.Equals("Manager", StringComparison.OrdinalIgnoreCase) || u.Role.Equals("FreeUser", StringComparison.OrdinalIgnoreCase)),
            EmployeeCount = active.Count(u => u.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase)),
            LastUpdated = DateTime.UtcNow,
            Sessions = active.Select(s => new LiveUserInfo
            {
                Email = s.Email,
                Role = s.Role,
                IpAddress = s.IpAddress,
                LastActivity = s.LastActivity
            }).OrderByDescending(s => s.LastActivity).ToList()
        };
    }
}

public class LiveUsersSnapshot
{
    public int TotalConnected { get; set; }
    public int SuperAdminCount { get; set; }
    public int ManagerCount { get; set; }
    public int EmployeeCount { get; set; }
    public DateTime LastUpdated { get; set; }
    public List<LiveUserInfo> Sessions { get; set; } = new();
}

public class LiveUserInfo
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public DateTime LastActivity { get; set; }
}

// ═══════════════════════════════════════════════════════════════
// 5. SESSION TRACKING MIDDLEWARE — Auto-tracks authenticated users
// ═══════════════════════════════════════════════════════════════

public class SessionTrackingMiddleware
{
    private readonly RequestDelegate _next;

    public SessionTrackingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, SessionTrackerService tracker)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var email = context.User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                     ?? context.User.FindFirst("email")?.Value
                     ?? "unknown";
            var role = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Unknown";

            // ── IP Resolution: prefer X-Forwarded-For (proxy), then RemoteIpAddress ──
            var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0]?.Trim()
                  ?? context.Request.Headers["X-Real-IP"].FirstOrDefault()
                  ?? context.Connection.RemoteIpAddress?.ToString()
                  ?? "unknown";

            if (!string.IsNullOrEmpty(userId))
            {
                tracker.TrackActivity(userId, email, role, ip);
            }
        }

        await _next(context);
    }
}

// ═══════════════════════════════════════════════════════════════
// 6. SECURITY ALERT SERVICE — Detects and records security events
// ═══════════════════════════════════════════════════════════════

public class SecurityAlert
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string Severity { get; set; } = "Info";     // Info, Warning, Critical
    public string AlertType { get; set; } = string.Empty; // FailedLogin, SuspiciousIP, TokenMisuse, AbnormalRate, ExpiredRefreshToken
    public string Message { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserId { get; set; }
    public string? Details { get; set; }
}

public class SecurityAlertService
{
    private readonly ConcurrentQueue<SecurityAlert> _alerts = new();
    private readonly ConcurrentDictionary<string, List<DateTime>> _failedLoginsByIp = new();
    private readonly ConcurrentDictionary<string, List<DateTime>> _requestsByIp = new();
    private long _nextId;
    private const int MaxAlerts = 1000;
    private const int FailedLoginThreshold = 5;      // 5 failures within window
    private const int AbnormalRateThreshold = 100;    // 100 requests per minute per IP

    public void RecordFailedLogin(string? ip, string? email)
    {
        ip ??= "unknown";
        var now = DateTime.UtcNow;
        var window = TimeSpan.FromMinutes(10);

        var attempts = _failedLoginsByIp.GetOrAdd(ip, _ => new List<DateTime>());
        lock (attempts)
        {
            attempts.Add(now);
            attempts.RemoveAll(t => t < now - window);

            if (attempts.Count >= FailedLoginThreshold)
            {
                AddAlert(new SecurityAlert
                {
                    Severity = "Warning",
                    AlertType = "FailedLogin",
                    Message = $"Repeated failed login attempts ({attempts.Count} in {window.TotalMinutes}min) from IP {ip}",
                    IpAddress = ip,
                    Details = $"Last attempted email: {email ?? "unknown"}"
                });
            }
        }
    }

    public void RecordTokenMisuse(string? userId, string reason)
    {
        AddAlert(new SecurityAlert
        {
            Severity = "Critical",
            AlertType = "TokenMisuse",
            Message = $"Token misuse detected: {reason}",
            UserId = userId
        });
    }

    public void RecordExpiredRefreshAttempt(string? userId, string? ip)
    {
        AddAlert(new SecurityAlert
        {
            Severity = "Info",
            AlertType = "ExpiredRefreshToken",
            Message = $"Expired/invalid refresh token used from IP {ip ?? "unknown"}",
            IpAddress = ip,
            UserId = userId
        });
    }

    public void RecordSuspiciousIp(string ip, string reason)
    {
        AddAlert(new SecurityAlert
        {
            Severity = "Warning",
            AlertType = "SuspiciousIP",
            Message = $"Suspicious activity from IP {ip}: {reason}",
            IpAddress = ip
        });
    }

    public void CheckRequestRate(string? ip)
    {
        ip ??= "unknown";
        var now = DateTime.UtcNow;
        var window = TimeSpan.FromMinutes(1);

        var requests = _requestsByIp.GetOrAdd(ip, _ => new List<DateTime>());
        lock (requests)
        {
            requests.Add(now);
            requests.RemoveAll(t => t < now - window);

            if (requests.Count == AbnormalRateThreshold) // Alert once at threshold
            {
                AddAlert(new SecurityAlert
                {
                    Severity = "Warning",
                    AlertType = "AbnormalRate",
                    Message = $"Abnormal request rate ({requests.Count}/min) from IP {ip}",
                    IpAddress = ip
                });
            }
        }
    }

    public IReadOnlyList<SecurityAlert> GetAlerts(int page, int pageSize, string? severity = null)
    {
        var query = _alerts.AsEnumerable().Reverse(); // newest first

        if (!string.IsNullOrEmpty(severity))
            query = query.Where(a => a.Severity.Equals(severity, StringComparison.OrdinalIgnoreCase));

        return query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
    }

    public int GetTotalCount(string? severity = null)
    {
        if (!string.IsNullOrEmpty(severity))
            return _alerts.Count(a => a.Severity.Equals(severity, StringComparison.OrdinalIgnoreCase));
        return _alerts.Count;
    }

    public Dictionary<string, int> GetCountsBySeverity()
    {
        return _alerts
            .GroupBy(a => a.Severity)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private void AddAlert(SecurityAlert alert)
    {
        alert.Id = Interlocked.Increment(ref _nextId);
        alert.Timestamp = DateTime.UtcNow;
        _alerts.Enqueue(alert);

        while (_alerts.Count > MaxAlerts)
            _alerts.TryDequeue(out _);
    }
}

// ═══════════════════════════════════════════════════════════════
// 7. SECURITY MONITORING MIDDLEWARE — Rate + IP tracking
// ═══════════════════════════════════════════════════════════════

public class SecurityMonitoringMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityMonitoringMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, SecurityAlertService securityService)
    {
        // Resolve real client IP (proxy-aware)
        var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0]?.Trim()
              ?? context.Request.Headers["X-Real-IP"].FirstOrDefault()
              ?? context.Connection.RemoteIpAddress?.ToString();

        if (!string.IsNullOrEmpty(ip))
        {
            securityService.CheckRequestRate(ip);
        }

        await _next(context);
    }
}

// ═══════════════════════════════════════════════════════════════
// 8. USER COUNTRY SERVICE — IP-based geolocation (cached)
// ═══════════════════════════════════════════════════════════════

// UserLoginRecord entity is defined in Models/Models.cs (canonical location)

public class UserCountryService
{
    private readonly ResourceManager.Application.Interfaces.ICacheService _cache;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<UserCountryService> _logger;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

    public UserCountryService(ResourceManager.Application.Interfaces.ICacheService cache, IHttpClientFactory httpClientFactory, ILogger<UserCountryService> logger)
    {
        _cache = cache;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Resolves country from IP using ip-api.com free tier (non-commercial, 45 req/min).
    /// Results are cached for 24h per IP.
    /// </summary>
    public async Task<(string Country, string CountryCode)> ResolveCountryAsync(string ipAddress)
    {
        // Skip private/loopback IPs
        if (string.IsNullOrEmpty(ipAddress) || ipAddress == "::1" || ipAddress.StartsWith("127.") || ipAddress.StartsWith("10.") || ipAddress.StartsWith("192.168."))
        {
            return ("Local Network", "LO");
        }

        var cacheKey = ResourceManager.Application.Interfaces.CacheKeys.GeoLocation(ipAddress);
        
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            async _ =>
            {
                try
                {
                    using var client = _httpClientFactory.CreateClient();
                    client.Timeout = TimeSpan.FromSeconds(5);

                    // Free, no API key needed, 45 req/min limit
                    var response = await client.GetFromJsonAsync<IpApiResponse>($"http://ip-api.com/json/{ipAddress}?fields=status,country,countryCode");

                    if (response?.Status == "success" && !string.IsNullOrEmpty(response.Country))
                    {
                        return new GeoLocationResult(response.Country, response.CountryCode ?? "XX");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "IP geolocation failed for {IP}", ipAddress);
                }
                
                return new GeoLocationResult("Unknown", "XX");
            },
            absoluteExpiration: CacheDuration);

        return result != null ? (result.Country, result.CountryCode) : ("Unknown", "XX");
    }

    private class IpApiResponse
    {
        public string? Status { get; set; }
        public string? Country { get; set; }
        public string? CountryCode { get; set; }
    }

    private record GeoLocationResult(string Country, string CountryCode);
}
