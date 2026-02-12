using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Application.Interfaces;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;

namespace ResourceManager.Controllers;

/// <summary>
/// SuperAdmin-only controller for application health, observability, and security monitoring.
/// All endpoints require the SuperAdmin role.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[EnableRateLimiting("Moderate")]
public class AdminController : BaseApiController
{
    private readonly AppDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppMetricsService _metrics;
    private readonly SessionTrackerService _sessionTracker;
    private readonly SecurityAlertService _securityAlerts;
    private readonly UserCountryService _countryService;
    private readonly ICacheService _cache;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        AppDbContext context,
        UserManager<ApplicationUser> userManager,
        AppMetricsService metrics,
        SessionTrackerService sessionTracker,
        SecurityAlertService securityAlerts,
        UserCountryService countryService,
        ICacheService cache,
        ILogger<AdminController> logger)
    {
        _context = context;
        _userManager = userManager;
        _metrics = metrics;
        _sessionTracker = sessionTracker;
        _securityAlerts = securityAlerts;
        _countryService = countryService;
        _cache = cache;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════════
    // A. APPLICATION HEALTH
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/health — Real-time application health metrics.
    /// </summary>
    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            var snapshot = _metrics.GetSnapshot();

            // Check database connectivity
            string dbStatus = "Healthy";
            try
            {
                await _context.Database.CanConnectAsync();
            }
            catch
            {
                dbStatus = "Down";
                snapshot.Status = "Degraded";
            }

            return Ok(new
            {
                snapshot.Status,
                snapshot.UptimeSeconds,
                snapshot.TotalRequests,
                snapshot.AverageResponseTimeMs,
                ErrorRate = snapshot.ErrorRate24h,
                Errors24h = snapshot.ErrorCount24h,
                DatabaseConnected = dbStatus == "Healthy",
                Timestamp = snapshot.ServerStartedAt,
                LogCounts = InMemoryLogSink.GetCountsByLevel()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching health status");
            return Ok(new { Status = "Unknown", DatabaseConnected = false });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // B. LOGS VIEWER
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/logs — Paginated application logs (Warning+ severity).
    /// No sensitive data exposed — messages only, no stack traces.
    /// </summary>
    [HttpGet("logs")]
    public IActionResult GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? level = null)
    {
        try
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 50;

            var logs = InMemoryLogSink.GetLogs(page, pageSize, level);
            var totalCount = InMemoryLogSink.GetTotalCount(level);

            return Ok(new
            {
                items = logs.Select(l => new
                {
                    l.Id,
                    l.Timestamp,
                    l.Level,
                    l.Message,
                    l.Source,
                    l.ExceptionType
                }),
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                countsByLevel = InMemoryLogSink.GetCountsByLevel()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching logs");
            return Ok(new { items = Array.Empty<object>(), totalCount = 0, page, pageSize, totalPages = 0, countsByLevel = new Dictionary<string, int>() });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // C. USERS BY COUNTRY (IP-Based)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/users-by-country — IP-based user country statistics.
    /// Cached for 1 hour to avoid overloading geolocation API.
    /// </summary>
    [HttpGet("users-by-country")]
    public async Task<IActionResult> GetUsersByCountry()
    {
        try
        {
        const string cacheKey = "admin_users_by_country";
        
        var response = await _cache.GetOrCreateAsync(
            cacheKey,
            async _ =>
            {
                // Get distinct login IPs from login records
                var loginRecords = await _context.UserLoginRecords
                    .GroupBy(r => new { r.UserId, r.IpAddress })
                    .Select(g => new { g.Key.UserId, g.Key.IpAddress, Country = g.Max(r => r.Country), CountryCode = g.Max(r => r.CountryCode) })
                    .ToListAsync();

                // Aggregate by country (use already-resolved countries from DB)
                var countryCounts = new Dictionary<string, (int Count, string Code)>(StringComparer.OrdinalIgnoreCase);

                foreach (var record in loginRecords)
                {
                    var country = record.Country ?? "Unknown";
                    var code = record.CountryCode ?? "XX";

                    if (countryCounts.TryGetValue(country, out var existing))
                        countryCounts[country] = (existing.Count + 1, code);
                    else
                        countryCounts[country] = (1, code);
                }

                var totalUsers = countryCounts.Values.Sum(v => v.Count);

                var result = countryCounts
                    .OrderByDescending(kv => kv.Value.Count)
                    .Select(kv => new UsersByCountryItem
                    {
                        Country = kv.Key,
                        CountryCode = kv.Value.Code,
                        Count = kv.Value.Count,
                        Percentage = totalUsers > 0 ? Math.Round((double)kv.Value.Count / totalUsers * 100, 1) : 0
                    })
                    .ToList();

                return new UsersByCountryResponse
                {
                    Countries = result,
                    TotalLogins = totalUsers
                };
            },
            absoluteExpiration: TimeSpan.FromHours(1));
        
        return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching users by country");
            return Ok(new { Countries = Array.Empty<object>(), TotalLogins = 0 });
        }
    }

    // DTOs for cache serialization
    private class UsersByCountryResponse
    {
        public List<UsersByCountryItem> Countries { get; set; } = new();
        public int TotalLogins { get; set; }
    }

    private class UsersByCountryItem
    {
        public string Country { get; set; } = string.Empty;
        public string CountryCode { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // D. LIVE CONNECTED USERS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/live-users — Currently connected users with role breakdown.
    /// </summary>
    [HttpGet("live-users")]
    public IActionResult GetLiveUsers()
    {
        try
        {
            var snapshot = _sessionTracker.GetSnapshot();

            // Map to shape expected by frontend LiveUsersData interface
            return Ok(new
            {
                ActiveCount = snapshot.TotalConnected,
                Users = snapshot.Sessions.Select(s => new
                {
                    UserId = s.Email, // frontend uses email as identifier
                    s.Email,
                    s.Role,
                    IpAddress = s.IpAddress ?? "unknown",
                    s.LastActivity,
                    SessionDurationMinutes = (DateTime.UtcNow - s.LastActivity).TotalMinutes
                }),
                ByRole = new Dictionary<string, int>
                {
                    ["SuperAdmin"] = snapshot.SuperAdminCount,
                    ["Manager"] = snapshot.ManagerCount,
                    ["Employee"] = snapshot.EmployeeCount
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching live users");
            return Ok(new { ActiveCount = 0, Users = Array.Empty<object>(), ByRole = new Dictionary<string, int>() });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // E. SECURITY ALERTS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/security-alerts — Paginated security alerts (read-only).
    /// </summary>
    [HttpGet("security-alerts")]
    public IActionResult GetSecurityAlerts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? severity = null)
    {
        try
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 50;

            var alerts = _securityAlerts.GetAlerts(page, pageSize, severity);
            var totalCount = _securityAlerts.GetTotalCount(severity);

            return Ok(new
            {
                items = alerts,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                countsBySeverity = _securityAlerts.GetCountsBySeverity()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching security alerts");
            return Ok(new { items = Array.Empty<object>(), totalCount = 0, page, pageSize, totalPages = 0, countsBySeverity = new Dictionary<string, int>() });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // F. ADMIN OVERVIEW (Combined endpoint for dashboard initial load)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// GET: api/admin/overview — Combined health + live users + alert summary.
    /// Single request for initial dashboard load to reduce API calls.
    /// </summary>
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        try
        {
        var health = _metrics.GetSnapshot();
        var liveUsers = _sessionTracker.GetSnapshot();
        var alertSummary = _securityAlerts.GetCountsBySeverity();
        var logSummary = InMemoryLogSink.GetCountsByLevel();

        string dbStatus = "Healthy";
        try
        {
            await _context.Database.CanConnectAsync();
        }
        catch
        {
            dbStatus = "Down";
            health.Status = "Degraded";
        }

        var liveMapped = new
        {
            ActiveCount = liveUsers.TotalConnected,
            Users = liveUsers.Sessions.Select(s => new
            {
                UserId = s.Email,
                s.Email,
                s.Role,
                IpAddress = s.IpAddress ?? "unknown",
                s.LastActivity,
                SessionDurationMinutes = (DateTime.UtcNow - s.LastActivity).TotalMinutes
            }),
            ByRole = new Dictionary<string, int>
            {
                ["SuperAdmin"] = liveUsers.SuperAdminCount,
                ["Manager"] = liveUsers.ManagerCount,
                ["Employee"] = liveUsers.EmployeeCount
            }
        };

        return Ok(new
        {
            Health = new
            {
                health.Status,
                health.UptimeSeconds,
                health.TotalRequests,
                health.AverageResponseTimeMs,
                ErrorRate = health.ErrorRate24h,
                Errors24h = health.ErrorCount24h,
                DatabaseConnected = dbStatus == "Healthy",
                Timestamp = health.ServerStartedAt
            },
            LiveUsers = liveMapped,
            TotalAlertCount = _securityAlerts.GetTotalCount(null),
            TotalLogCount = InMemoryLogSink.GetTotalCount(null),
            RecentAlerts = _securityAlerts.GetAlerts(1, 5),
            RecentLogs = InMemoryLogSink.GetLogs(1, 5)
        });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching admin overview");
            return Ok(new { Health = new { Status = "Unknown" }, LiveUsers = new { ActiveCount = 0 }, TotalAlertCount = 0, TotalLogCount = 0 });
        }
    }
}
