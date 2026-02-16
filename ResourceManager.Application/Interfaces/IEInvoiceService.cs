using ResourceManager.Application.EInvoicing;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Generates region-specific e-invoice XML and QR payloads.
/// </summary>
public interface IEInvoiceService
{
    /// <summary>
    /// Generate a compliant e-invoice for the given <paramref name="region"/>.
    /// </summary>
    EInvoiceResult Generate(EInvoiceRegion region, InvoiceData data);

    /// <summary>
    /// Validate invoice data for the given <paramref name="region"/>.
    /// </summary>
    EInvoiceValidationResult Validate(EInvoiceRegion region, InvoiceData data);
}
