namespace ResourceManager.Domain.Common;

/// <summary>
/// Base entity for all tenant-scoped domain entities.
/// Provides multi-tenancy isolation, audit trails, and soft delete.
/// </summary>
public abstract class BaseEntity
{
    public int Id { get; set; }
    
    // Multi-tenancy
    public int CompanyId { get; set; }
    
    // Audit
    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    
    // Workflow
    public bool Treated { get; set; } = false;
}
