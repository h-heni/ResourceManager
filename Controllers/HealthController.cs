using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResourceManager.Data;
using ResourceManager.Services;

namespace ResourceManager.Controllers;

[ApiController]
[Route("[controller]")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<HealthController> _logger;
    private readonly IServiceProvider _serviceProvider;

    public HealthController(AppDbContext db, ILogger<HealthController> logger, IServiceProvider serviceProvider)
    {
        _db = db;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    [HttpGet("/health")]
    [HttpGet("/api/health")]
    public async Task<IActionResult> Get()
    {
        try
        {
            var canConnect = await _db.Database.CanConnectAsync();
            if (!canConnect)
            {
                _logger.LogError("Health check failed: cannot connect to database");
                return StatusCode(503, new { status = "unhealthy", reason = "database" });
            }

            return Ok(new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                version = typeof(HealthController).Assembly
                    .GetName().Version?.ToString() ?? "1.0.0"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check exception");
            return StatusCode(503, new { status = "unhealthy", reason = ex.Message });
        }
    }

    /// <summary>
    /// Detailed health check including all services
    /// </summary>
    [HttpGet("/api/health/detailed")]
    public async Task<IActionResult> GetDetailed()
    {
        var checks = new Dictionary<string, object>();
        var overallHealthy = true;

        // Database check
        try
        {
            var canConnect = await _db.Database.CanConnectAsync();
            checks["database"] = new { healthy = canConnect, message = canConnect ? "Connected" : "Connection failed" };
            if (!canConnect) overallHealthy = false;
        }
        catch (Exception ex)
        {
            checks["database"] = new { healthy = false, message = ex.Message };
            overallHealthy = false;
        }

        // SMTP check
        try
        {
            var emailService = _serviceProvider.GetService<IMailKitEmailService>();
            if (emailService != null)
            {
                var smtpResult = await emailService.TestConnectionAsync();
                checks["smtp"] = new
                {
                    healthy = smtpResult.IsHealthy,
                    message = smtpResult.Message,
                    responseTimeMs = smtpResult.ResponseTimeMs,
                    greeting = smtpResult.SmtpGreeting
                };
                // SMTP failure is a warning, not critical
            }
            else
            {
                checks["smtp"] = new { healthy = false, message = "MailKitEmailService not registered" };
            }
        }
        catch (Exception ex)
        {
            checks["smtp"] = new { healthy = false, message = ex.Message };
        }

        // SMTP configuration check (no actual connection)
        try
        {
            var emailService = _serviceProvider.GetService<IMailKitEmailService>();
            if (emailService != null)
            {
                var config = emailService.GetConfiguration();
                checks["smtpConfig"] = new
                {
                    healthy = config.IsConfigured,
                    host = config.Host,
                    port = config.Port,
                    useTls = config.UseTls,
                    fromEmail = config.FromEmail,
                    error = config.ConfigurationError
                };
            }
        }
        catch (Exception ex)
        {
            checks["smtpConfig"] = new { healthy = false, message = ex.Message };
        }

        return Ok(new
        {
            status = overallHealthy ? "healthy" : "degraded",
            timestamp = DateTime.UtcNow,
            version = typeof(HealthController).Assembly.GetName().Version?.ToString() ?? "1.0.0",
            checks
        });
    }

    /// <summary>
    /// SMTP heartbeat check endpoint
    /// </summary>
    [HttpGet("/api/health/smtp")]
    public async Task<IActionResult> CheckSmtp()
    {
        try
        {
            var emailService = _serviceProvider.GetService<IMailKitEmailService>();
            if (emailService == null)
            {
                return StatusCode(503, new
                {
                    healthy = false,
                    message = "Email service not configured"
                });
            }

            var result = await emailService.TestConnectionAsync();
            
            if (result.IsHealthy)
            {
                return Ok(new
                {
                    healthy = true,
                    message = result.Message,
                    responseTimeMs = result.ResponseTimeMs,
                    checkedAt = result.CheckedAt
                });
            }
            else
            {
                return StatusCode(503, new
                {
                    healthy = false,
                    message = result.Message,
                    responseTimeMs = result.ResponseTimeMs,
                    checkedAt = result.CheckedAt
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP health check failed");
            return StatusCode(503, new
            {
                healthy = false,
                message = ex.Message
            });
        }
    }
}