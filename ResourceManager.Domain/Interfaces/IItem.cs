namespace ResourceManager.Domain.Interfaces;

/// <summary>
/// Contract for line items (InvoiceItem, DevisItem, DeliveryNoteItem).
/// Used for polymorphic PDF generation.
/// </summary>
public interface IItem
{
    int Id { get; set; }
    string Description { get; set; }
    decimal? Price { get; set; }
    int? Quantity { get; set; }
    decimal? TaxRate { get; }
    decimal TotalItemHT { get; }
    decimal ItemTaxAmount { get; }
}
