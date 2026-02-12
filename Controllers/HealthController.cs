using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResourceManager.Data;

namespace ResourceManager.Controllers;

[ApiController]
[Route("[controller]")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<HealthController> _logger;

    public HealthController(AppDbContext db, ILogger<HealthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("/health")]
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
}