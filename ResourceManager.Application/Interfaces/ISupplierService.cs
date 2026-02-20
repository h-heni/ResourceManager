using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Supplier service interface for business operations.
/// </summary>
public interface ISupplierService
{
    Task<Result<SupplierDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<SupplierDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<SupplierDto>>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Result<SupplierDto>> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken = default);
    Task<Result<SupplierDto>> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<SupplierInvoiceDto>> UploadInvoiceAsync(int supplierId, UploadSupplierInvoiceRequest request, CancellationToken cancellationToken = default);
}

public record SupplierDto(
    int Id,
    string Name,
    string Address,
    string TaxId,
    string Phone,
    DateTime CreatedAt,
    List<SupplierInvoiceDto> Invoices
);

public record SupplierInvoiceDto(
    int Id,
    string FileName,
    string FilePath,
    string InvoiceNumber,
    DateTime CreatedAt
);

public record CreateSupplierRequest(
    string Name,
    string Address,
    string TaxId,
    string Phone
);

public record UpdateSupplierRequest(
    string? Name,
    string? Address,
    string? TaxId,
    string? Phone
);

public record UploadSupplierInvoiceRequest(
    string FileName,
    string InvoiceNumber,
    Stream FileStream,
    string ContentType
);
