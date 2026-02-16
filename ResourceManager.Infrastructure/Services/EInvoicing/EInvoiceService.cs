using Microsoft.Extensions.Logging;
using ResourceManager.Application.EInvoicing;
using ResourceManager.Application.Interfaces;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// E-invoice service that dispatches to <see cref="TunisianXmlGenerator"/>,
/// <see cref="ZatcaTlvEncoder"/>, or <see cref="PeppolXmlGenerator"/> based on region.
/// </summary>
public sealed class EInvoiceService(ILogger<EInvoiceService> logger) : IEInvoiceService
{
    public EInvoiceResult Generate(EInvoiceRegion region, InvoiceData data)
    {
        logger.LogInformation("Generating {Region} e-invoice for {InvoiceNumber}",
            region, data.InvoiceNumber);

        var (xml, qr) = region switch
        {
            EInvoiceRegion.Tunisia => TunisianXmlGenerator.Generate(data),
            EInvoiceRegion.Ksa => ZatcaTlvEncoder.Generate(data),
            EInvoiceRegion.Europe => PeppolXmlGenerator.Generate(data),
            _ => throw new ArgumentOutOfRangeException(nameof(region), region, "Unsupported region.")
        };

        logger.LogDebug("Generated {Region} XML ({Length} chars) with QR payload ({QrLength} chars)",
            region, xml.Length, qr.Length);

        return new EInvoiceResult(xml, qr, region);
    }

    public EInvoiceValidationResult Validate(EInvoiceRegion region, InvoiceData data)
    {
        logger.LogDebug("Validating {Region} e-invoice data for {InvoiceNumber}",
            region, data.InvoiceNumber);

        return EInvoiceValidationService.Validate(region, data);
    }
}
