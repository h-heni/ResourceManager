namespace ResourceManager.Domain.Interfaces;

/// <summary>
/// Contract for PDF-exportable documents (Invoice, Devis, DeliveryNote).
/// </summary>
public interface IPdfDocumentData
{
    string Number { get; }
    DateTime Date { get; set; }
    IClient? Client { get; }
    List<IItem> Items { get; set; }
    decimal? Tfiscal { get; }
    decimal? SubTotal { get; }
    decimal? TaxAmount { get; }
    decimal? TotalAmount { get; }
}
