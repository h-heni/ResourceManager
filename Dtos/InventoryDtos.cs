using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    // ═══════════════════════════════════════════════════════════════
    // STOCK LEVEL & MOVEMENT DTOs
    // ═══════════════════════════════════════════════════════════════

    public class StockLevelDto
    {
        public int ProductServiceId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SKU { get; set; }
        public string? Barcode { get; set; }
        public string? Category { get; set; }
        public string Type { get; set; } = "product";
        public decimal CurrentStock { get; set; }
        public decimal? ReorderPoint { get; set; }
        public decimal? MinimumStock { get; set; }
        public decimal? MaximumStock { get; set; }
        public string UnitOfMeasure { get; set; } = "unit";
        public decimal DefaultUnitPrice { get; set; }
        public decimal? CostPrice { get; set; }
        public decimal StockValue { get; set; } // CurrentStock * CostPrice
        public string? WarehouseName { get; set; }
        public int? WarehouseId { get; set; }
        public string? SupplierName { get; set; }
        public int? SupplierId { get; set; }
        public string StockStatus { get; set; } = "InStock"; // InStock, LowStock, OutOfStock, Overstock
    }

    public class StockMovementDto
    {
        public int Id { get; set; }
        public int ProductServiceId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SKU { get; set; }
        public string MovementType { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal? UnitCost { get; set; }
        public decimal StockAfter { get; set; }
        public string? ReferenceType { get; set; }
        public int? ReferenceId { get; set; }
        public string? ReferenceNumber { get; set; }
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
        public string? WarehouseName { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // STOCK ADJUSTMENT & TRANSFER DTOs
    // ═══════════════════════════════════════════════════════════════

    public class StockAdjustmentDto
    {
        [Required]
        public int ProductServiceId { get; set; }

        [Required]
        public decimal NewQuantity { get; set; }

        [StringLength(500)]
        public string? Reason { get; set; }

        public int? WarehouseId { get; set; }
    }

    public class StockTransferDto
    {
        [Required]
        public int ProductServiceId { get; set; }

        [Required]
        [Range(0.001, double.MaxValue, ErrorMessage = "Quantity must be greater than 0")]
        public decimal Quantity { get; set; }

        [Required]
        public int FromWarehouseId { get; set; }

        [Required]
        public int ToWarehouseId { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }
    }

    public class ManualStockMovementDto
    {
        [Required]
        public int ProductServiceId { get; set; }

        [Required]
        [RegularExpression("^(In|Out)$", ErrorMessage = "MovementType must be 'In' or 'Out'")]
        public string MovementType { get; set; } = "In";

        [Required]
        [Range(0.001, double.MaxValue, ErrorMessage = "Quantity must be greater than 0")]
        public decimal Quantity { get; set; }

        public decimal? UnitCost { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        public int? WarehouseId { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // STOCK ALERT DTOs
    // ═══════════════════════════════════════════════════════════════

    public class StockAlertDto
    {
        public int Id { get; set; }
        public int ProductServiceId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SKU { get; set; }
        public string AlertType { get; set; } = string.Empty;
        public decimal Threshold { get; set; }
        public decimal CurrentQuantity { get; set; }
        public bool IsRead { get; set; }
        public bool IsResolved { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // WAREHOUSE DTOs
    // ═══════════════════════════════════════════════════════════════

    public class WarehouseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Description { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
        public int ProductCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateWarehouseDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        public bool IsDefault { get; set; } = false;
    }

    public class UpdateWarehouseDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        public bool IsDefault { get; set; }
        public bool IsActive { get; set; } = true;
    }

    // ═══════════════════════════════════════════════════════════════
    // PURCHASE ORDER DTOs
    // ═══════════════════════════════════════════════════════════════

    public class PurchaseOrderListDto
    {
        public int Id { get; set; }
        public string Number { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public string Status { get; set; } = "Draft";
        public string? SupplierName { get; set; }
        public int SupplierId { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? Currency { get; set; }
        public int ItemCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? SupplierInvoiceId { get; set; }
        public string? SupplierInvoiceNumber { get; set; }
    }

    public class PurchaseOrderDetailDto : PurchaseOrderListDto
    {
        public string? Notes { get; set; }
        public decimal? SubTotal { get; set; }
        public decimal? TaxAmount { get; set; }
        public List<PurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class PurchaseOrderItemDto
    {
        public int Id { get; set; }
        public int ProductServiceId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SKU { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ReceivedQuantity { get; set; }
        public decimal RemainingQuantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal? TaxRate { get; set; }
        public decimal TotalHT { get; set; }
    }

    public class CreatePurchaseOrderDto
    {
        [Required]
        public int SupplierId { get; set; }

        public DateTime? Date { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public string? Notes { get; set; }
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        public string? PdfLanguage { get; set; }

        [Required]
        [MinLength(1, ErrorMessage = "At least one item is required")]
        public List<CreatePurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class CreatePurchaseOrderItemDto
    {
        [Required]
        public int ProductServiceId { get; set; }

        public string? Description { get; set; }

        [Required]
        [Range(0.001, double.MaxValue)]
        public decimal Quantity { get; set; }

        [Required]
        [Range(0, double.MaxValue)]
        public decimal UnitPrice { get; set; }

        public decimal? TaxRate { get; set; }
    }

    public class ReceivePurchaseOrderDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one item receipt is required")]
        public List<ReceivePurchaseOrderItemDto> Items { get; set; } = new();

        public string? Notes { get; set; }
    }

    public class ReceivePurchaseOrderItemDto
    {
        [Required]
        public int PurchaseOrderItemId { get; set; }

        [Required]
        [Range(0.001, double.MaxValue)]
        public decimal ReceivedQuantity { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // INVENTORY REPORT DTOs
    // ═══════════════════════════════════════════════════════════════

    public class InventoryValuationDto
    {
        public decimal TotalStockValue { get; set; }
        public decimal TotalRetailValue { get; set; }
        public int TotalProducts { get; set; }
        public int TrackedProducts { get; set; }
        public int LowStockCount { get; set; }
        public int OutOfStockCount { get; set; }
        public int OverstockCount { get; set; }
        public List<StockLevelDto> Items { get; set; } = new();
    }

    public class StockTurnoverDto
    {
        public int ProductServiceId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SKU { get; set; }
        public decimal TotalSold { get; set; }
        public decimal AverageStock { get; set; }
        public decimal TurnoverRate { get; set; }
        public int DaysSinceLastMovement { get; set; }
        public bool IsDeadStock { get; set; }
    }

    public class InventoryReportDto
    {
        public InventoryValuationDto Valuation { get; set; } = new();
        public List<StockTurnoverDto> Turnover { get; set; } = new();
        public List<StockAlertDto> ActiveAlerts { get; set; } = new();
        public int TotalMovements { get; set; }
        public decimal TotalStockIn { get; set; }
        public decimal TotalStockOut { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRODUCT SERVICE UPDATE DTO (Extended for inventory)
    // ═══════════════════════════════════════════════════════════════

    public class UpdateProductInventoryDto
    {
        [StringLength(100)]
        public string? SKU { get; set; }

        [StringLength(100)]
        public string? Barcode { get; set; }

        public decimal? ReorderPoint { get; set; }
        public decimal? MinimumStock { get; set; }
        public decimal? MaximumStock { get; set; }

        [StringLength(30)]
        public string? UnitOfMeasure { get; set; }

        public bool? IsStockTracked { get; set; }
        public decimal? CostPrice { get; set; }
        public int? SupplierId { get; set; }
        public decimal? Weight { get; set; }
        public int? WarehouseId { get; set; }
    }
}
