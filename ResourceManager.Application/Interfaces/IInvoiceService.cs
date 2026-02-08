using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Invoice service interface for business operations.
/// </summary>
public interface IInvoiceService
{
    Task<Result<InvoiceDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<InvoiceListDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<InvoiceDto>> CreateAsync(CreateInvoiceRequest request, CancellationToken cancellationToken = default);
    Task<Result<InvoiceDto>> UpdateAsync(int id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> LockAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> MarkAsPaidAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<byte[]>> GeneratePdfAsync(int id, CancellationToken cancellationToken = default);
}

// DTOs kept in same file for simplicity - can be split later
public record InvoiceListDto(
    int Id,
    string Number,
    DateTime Date,
    string ClientName,
    decimal? TotalAmount,
    string Status,
    bool IsLocked,
    bool Treated
);

public record InvoiceDto(
    int Id,
    string Number,
    DateTime Date,
    int? ClientId,
    string? ClientName,
    int? DevisId,
    decimal? SubTotal,
    decimal? TaxAmount,
    decimal? TotalAmount,
    string Status,
    bool IsLocked,
    bool Treated,
    List<InvoiceItemDto> Items
);

public record InvoiceItemDto(
    int Id,
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva,
    decimal TotalItemHT,
    decimal ItemTaxAmount
);

public record CreateInvoiceRequest(
    string Number,
    DateTime Date,
    int? ClientId,
    int? DevisId,
    List<CreateInvoiceItemRequest> Items
);

public record CreateInvoiceItemRequest(
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva
);

public record UpdateInvoiceRequest(
    string? Number,
    DateTime? Date,
    int? ClientId,
    string? Status,
    List<CreateInvoiceItemRequest>? Items
);
