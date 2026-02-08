using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Fournisseur (Supplier) service interface for business operations.
/// </summary>
public interface IFournisseurService
{
    Task<Result<FournisseurDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<FournisseurDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<FournisseurDto>>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Result<FournisseurDto>> CreateAsync(CreateFournisseurRequest request, CancellationToken cancellationToken = default);
    Task<Result<FournisseurDto>> UpdateAsync(int id, UpdateFournisseurRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<FournisseurInvoiceDto>> UploadInvoiceAsync(int fournisseurId, UploadFournisseurInvoiceRequest request, CancellationToken cancellationToken = default);
}

public record FournisseurDto(
    int Id,
    string Name,
    string Address,
    string MatriculeFiscal,
    string Phone,
    DateTime CreatedAt,
    List<FournisseurInvoiceDto> Invoices
);

public record FournisseurInvoiceDto(
    int Id,
    string FileName,
    string FilePath,
    string InvoiceNumber,
    DateTime CreatedAt
);

public record CreateFournisseurRequest(
    string Name,
    string Address,
    string MatriculeFiscal,
    string Phone
);

public record UpdateFournisseurRequest(
    string? Name,
    string? Address,
    string? MatriculeFiscal,
    string? Phone
);

public record UploadFournisseurInvoiceRequest(
    string FileName,
    string InvoiceNumber,
    Stream FileStream,
    string ContentType
);
