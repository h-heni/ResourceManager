namespace ResourceManager.DTOs
{
    public class ConfirmNewSupplierInvoiceDto
    {
        public string? TempFilePath { get; set; }
        public string? FileName { get; set; }
        public string? FileType { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TVA { get; set; }
        public string? RawExtractedText { get; set; }
        public double? ConfidenceScore { get; set; }
        public int? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? SupplierAddress { get; set; }
        public string? SupplierPhone { get; set; }
        
        // Per-document currency
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        
        /// <summary>
        /// Optional link to a Purchase Order
        /// </summary>
        public int? PurchaseOrderId { get; set; }
        
        public List<ConfirmSupplierItemDto>? Items { get; set; }
    }

    public class ConfirmSupplierInvoiceDto
    {
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TVA { get; set; }
        public int? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? SupplierAddress { get; set; }
        public string? SupplierPhone { get; set; }
        public int? PurchaseOrderId { get; set; }
        public List<ConfirmSupplierItemDto>? Items { get; set; }
    }

    public class ConfirmSupplierItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal? TaxRate { get; set; }
        public decimal TotalHT { get; set; }
        public int? ProductServiceId { get; set; }
    }

    public class DiscardSupplierInvoiceDto
    {
        public string? TempFilePath { get; set; }
    }

    public class SupplierPaymentDto
    {
        public decimal Amount { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? Notes { get; set; }
        public string? Status { get; set; } = "Completed";
    }
}
