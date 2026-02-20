using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Quote service interface for business operations.
/// </summary>
public interface IQuoteService
{
    Task<Result<QuoteDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<QuoteListDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<QuoteDto>> CreateAsync(CreateQuoteRequest request, CancellationToken cancellationToken = default);
    Task<Result<QuoteDto>> UpdateAsync(int id, UpdateQuoteRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> AcceptAsync(int id, CancellationToken cancellationToken = default);
    Task<Result> RejectAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<byte[]>> GeneratePdfAsync(int id, CancellationToken cancellationToken = default);
}

public record QuoteListDto(
    int Id,
    string Number,
    DateTime Date,
    string ClientName,
    decimal? TotalAmount,
    string Status,
    bool Treated
);

public record QuoteDto(
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
    List<QuoteItemDto> Items
);

public record QuoteItemDto(
    int Id,
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva,
    decimal TotalItemHT,
    decimal ItemTaxAmount
);

public record CreateQuoteRequest(
    string Number,
    DateTime Date,
    int? ClientId,
    List<CreateQuoteItemRequest> Items
);

public record CreateQuoteItemRequest(
    string Description,
    int? Quantity,
    decimal? Price,
    bool Tva
);

public record UpdateQuoteRequest(
    string? Number,
    DateTime? Date,
    int? ClientId,
    string? Status,
    List<CreateQuoteItemRequest>? Items
);
