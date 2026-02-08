using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Devis (Quote) service interface for business operations.
/// </summary>
public interface IDevisService
{
    Task<Result<DevisDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<DevisListDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<DevisDto>> CreateAsync(CreateDevisRequest request, CancellationToken cancellationToken = default);
    Task<Result<DevisDto>> UpdateAsync(int id, UpdateDevisRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> AcceptAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> RejectAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<byte[]>> GeneratePdfAsync(int id, CancellationToken cancellationToken = default);
}

public record DevisListDto(
    int Id,
    string Number,
    DateTime Date,
    string ClientName,
    decimal? TotalAmount,
    string Status,
    bool Treated
);

public record DevisDto(
    int Id,
    string Number,
    DateTime Date,
    int? ClientId,
    string? ClientName,
    decimal? SubTotal,
    decimal? TaxAmount,
    decimal? TotalAmount,
    string Status,
    bool Treated,
    List<DevisItemDto> Items
);

public record DevisItemDto(
    int Id,
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva,
    decimal TotalItemHT,
    decimal ItemTaxAmount
);

public record CreateDevisRequest(
    string Number,
    DateTime Date,
    int? ClientId,
    List<CreateDevisItemRequest> Items
);

public record CreateDevisItemRequest(
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva
);

public record UpdateDevisRequest(
    string? Number,
    DateTime? Date,
    int? ClientId,
    string? Status,
    List<CreateDevisItemRequest>? Items
);
