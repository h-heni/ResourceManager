using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using ResourceManager.Application.EInvoicing;
using static ResourceManager.Infrastructure.Services.EInvoicing.EInvoiceHelpers;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// Tunisia – TEIF / El Fatoora XML generator.
/// Produces a <c>&lt;TEIFInvoice&gt;</c> document with Header, Seller, Buyer,
/// Items, Totals, DigitalSignature, and QR payload.
/// Currency: TND (3 decimal places).
/// </summary>
internal static class TunisianXmlGenerator
{
    private const string SchemaVersion = "1.8.7";

    /// <summary>
    /// Generate a complete TEIF XML string for a Tunisian invoice.
    /// </summary>
    internal static (string Xml, string QrPayload) Generate(InvoiceData data)
    {
        var issueUtc = data.IssueDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
        var currency = NormalizeCurrency(data.Currency) is { Length: > 0 } c ? c : "TND";

        // ── Signature source (pipe-delimited canonical form) ────────────
        var signatureSource =
            $"TEIF|{SchemaVersion}|{data.TtnReference}|{data.InvoiceNumber}" +
            $"|{issueUtc}|{Fmt3(data.TotalTtc)}|{Fmt3(data.VatTotal)}";
        var digest = Sha256Base64(signatureSource);

        // ── Root ────────────────────────────────────────────────────────
        var root = new XElement("TEIFInvoice",
            new XAttribute("schemaVersion", SchemaVersion));

        // ── 1. Header (Entête) ──────────────────────────────────────────
        root.Add(new XElement("Header",
            new XElement("UniqueReferenceId", data.TtnReference),
            new XElement("InvoiceNumber", data.InvoiceNumber),
            new XElement("IssueDate", issueUtc),
            new XElement("Currency", currency)));

        // ── 2. Seller ───────────────────────────────────────────────────
        root.Add(new XElement("Seller",
            new XElement("Name", data.Seller.Name),
            new XElement("MatriculeFiscal", data.Seller.MatriculeFiscal),
            new XElement("Address", data.Seller.Address),
            new XElement("Phone", data.Seller.Phone)));

        // ── 3. Buyer ────────────────────────────────────────────────────
        root.Add(new XElement("Buyer",
            new XElement("Name", data.Buyer.Name),
            new XElement("MatriculeFiscal", data.Buyer.TaxId),
            new XElement("Address", data.Buyer.Address),
            new XElement("Phone", data.Buyer.Phone)));

        // ── 4. Line items ───────────────────────────────────────────────
        var items = new XElement("Items");
        foreach (var item in data.Items)
        {
            items.Add(new XElement("Item",
                new XElement("Description", item.Description),
                new XElement("Quantity", Fmt3(item.Quantity)),
                new XElement("UnitPrice", Fmt3(item.UnitPrice)),
                new XElement("VatRate", Fmt3(item.VatRate)),
                new XElement("LineTotal", Fmt3(item.LineTotalHt)),
                new XElement("LineVat", Fmt3(item.LineVat))));
        }
        root.Add(items);

        // ── 5. Totals ───────────────────────────────────────────────────
        root.Add(new XElement("Totals",
            new XElement("SubTotal", Fmt3(data.SubTotal)),
            new XElement("VatTotal", Fmt3(data.VatTotal)),
            new XElement("InvoiceTotal", Fmt3(data.TotalTtc))));

        // ── 6. Digital Signature placeholder ────────────────────────────
        root.Add(new XElement("DigitalSignature",
            new XElement("DigestMethod", "SHA-256"),
            new XElement("DigestValue", digest),
            new XElement("Signer", data.Seller.Name)));

        // ── 7. QR Payload (visible electronic seal) ─────────────────────
        var qrPayload = BuildTndQrBase64(data, currency, issueUtc, digest);
        root.Add(new XElement("QRPayload", qrPayload));

        return (root.ToString(SaveOptions.DisableFormatting), qrPayload);
    }

    /// <summary>
    /// Build the simple pipe-delimited QR string:
    /// <c>MatriculeFiscal|InvoiceNumber|Date|TotalTTC</c>.
    /// </summary>
    internal static string BuildQrString(InvoiceData data)
    {
        var issueUtc = data.IssueDate.ToUniversalTime().ToString("yyyy-MM-dd");
        return $"{data.Seller.MatriculeFiscal}|{data.InvoiceNumber}|{issueUtc}|{Fmt3(data.TotalTtc)}";
    }

    // ── Private ─────────────────────────────────────────────────────────

    private static string BuildTndQrBase64(
        InvoiceData data, string currency, string issueUtc, string digest)
    {
        var itemsList = data.Items.Select(item => new
        {
            description = item.Description,
            quantity = Fmt3(item.Quantity),
            unitPrice = Fmt3(item.UnitPrice),
            vatRate = Fmt3(item.VatRate),
            lineTotal = Fmt3(item.LineTotalHt),
            lineVat = Fmt3(item.LineVat),
        });

        var payload = new
        {
            schemaVersion = SchemaVersion,
            header = new
            {
                invoiceNumber = data.InvoiceNumber,
                issueDate = issueUtc,
                currency,
                ttnReference = data.TtnReference,
            },
            seller = new
            {
                name = data.Seller.Name,
                matriculeFiscal = data.Seller.MatriculeFiscal,
                address = data.Seller.Address,
                phone = data.Seller.Phone,
            },
            buyer = new
            {
                name = data.Buyer.Name,
                matriculeFiscal = data.Buyer.TaxId,
                address = data.Buyer.Address,
                phone = data.Buyer.Phone,
            },
            items = itemsList,
            totals = new
            {
                subTotal = Fmt3(data.SubTotal),
                vatTotal = Fmt3(data.VatTotal),
                invoiceTotal = Fmt3(data.TotalTtc),
            },
            signatureBlock = new
            {
                method = "SHA-256",
                digest,
                signer = data.Seller.Name,
            },
        };

        var json = JsonSerializer.Serialize(payload,
            new JsonSerializerOptions { WriteIndented = false });
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
    }
}
