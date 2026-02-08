namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Current user context for multi-tenancy and audit.
/// </summary>
public interface ICurrentUserService
{
    string? UserId { get; }
    string? Email { get; }
    int CompanyId { get; }
    bool IsSuperAdmin { get; }
    IReadOnlyList<string> Roles { get; }
}
