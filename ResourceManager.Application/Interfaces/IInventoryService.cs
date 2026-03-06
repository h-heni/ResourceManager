namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Inventory service interface for stock management operations.
/// </summary>
public interface IInventoryService
{
    /// <summary>
    /// Record a stock-in movement (e.g., from purchase/supplier invoice)
    /// </summary>
    Task RecordStockInAsync(int productServiceId, decimal quantity, decimal? unitCost,
        string referenceType, int? referenceId, string? referenceNumber, string? notes, int? warehouseId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Record a stock-out movement (e.g., from invoice/delivery note)
    /// </summary>
    Task RecordStockOutAsync(int productServiceId, decimal quantity,
        string referenceType, int? referenceId, string? referenceNumber, string? notes, int? warehouseId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Adjust stock to a specific quantity (physical count correction)
    /// </summary>
    Task AdjustStockAsync(int productServiceId, decimal newQuantity, string? reason, int? warehouseId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Check and generate stock alerts for products below reorder point
    /// </summary>
    Task CheckAndGenerateAlertsAsync(int? productServiceId = null,
        CancellationToken cancellationToken = default);
}
