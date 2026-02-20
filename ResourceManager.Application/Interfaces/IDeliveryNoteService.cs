using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Delivery Note service interface for business operations.
/// </summary>
public interface IDeliveryNoteService
{
    Task<Result<DeliveryNoteDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<DeliveryNoteListDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<DeliveryNoteListDto>>> GetPendingAsync(CancellationToken cancellationToken = default);
    Task<Result<DeliveryNoteDto>> CreateAsync(CreateDeliveryNoteRequest request, CancellationToken cancellationToken = default);
    Task<Result<DeliveryNoteDto>> UpdateAsync(int id, UpdateDeliveryNoteRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<Result<byte[]>> GeneratePdfAsync(int id, CancellationToken cancellationToken = default);
}

public record DeliveryNoteListDto(
    int Id,
    string Number,
    DateTime Date,
    string ClientName,
    bool Treated,
    int? InvoiceId
);

public record DeliveryNoteDto(
    int Id,
    string Number,
    DateTime Date,
    int? ClientId,
    string? ClientName,
    int? QuoteId,
    int? InvoiceId,
    bool Treated,
    List<DeliveryNoteItemDto> Items
);

public record DeliveryNoteItemDto(
    int Id,
    string Description,
    int? Quantity,
    int TotalEstimated
);

public record CreateDeliveryNoteRequest(
    string Number,
    DateTime Date,
    int? ClientId,
    int? QuoteId,
    List<CreateDeliveryNoteItemRequest> Items
);

public record CreateDeliveryNoteItemRequest(
    string Description,
    int? Quantity,
    int TotalEstimated
);

public record UpdateDeliveryNoteRequest(
    string? Number,
    DateTime? Date,
    int? ClientId,
    List<CreateDeliveryNoteItemRequest>? Items
);
