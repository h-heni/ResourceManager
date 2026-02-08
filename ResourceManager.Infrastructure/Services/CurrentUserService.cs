using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using ResourceManager.Application.Interfaces;

namespace ResourceManager.Infrastructure.Services;

/// <summary>
/// Provides current user context from HTTP request.
/// </summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    
    public string? Email => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value;

    public int CompanyId
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User?.FindFirst("CompanyId");
            return claim != null && int.TryParse(claim.Value, out var id) ? id : 0;
        }
    }

    public bool IsSuperAdmin => _httpContextAccessor.HttpContext?.User?.IsInRole("SuperAdmin") ?? false;

    public IReadOnlyList<string> Roles
    {
        get
        {
            var claims = _httpContextAccessor.HttpContext?.User?.FindAll(ClaimTypes.Role);
            return claims?.Select(c => c.Value).ToList() ?? new List<string>();
        }
    }
}
