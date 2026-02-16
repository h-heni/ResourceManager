using System.Text;
using System.Xml.Linq;
using ResourceManager.Application.EInvoicing;
using static ResourceManager.Infrastructure.Services.EInvoicing.EInvoiceHelpers;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// Saudi Arabia – ZATCA Phase 2 TLV encoder &amp; UBL 2.1 XML generator.
/// <para>
/// Uses <see cref="List{T}"/> (byte) for Tag-Length-Value construction —
/// <b>no string concatenation</b> for the QR code binary payload.
/// </para>
/// Currency: SAR (2 decimal places).
/// </summary>
internal static class ZatcaTlvEncoder
{
    // ── UBL 2.1 / ZATCA namespaces ──────────────────────────────────────
    private static readonly XNamespace NsInv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
    private static readonly XNamespace NsCac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace NsCbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace NsExt = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

    // ── Public API ──────────────────────────────────────────────────────

    /// <summary>
    /// Build the ZATCA Phase 2 TLV QR code as a Base64 string.
    /// <para>
    /// Tag-Length-Value structure (5 mandatory tags):<br/>
    /// Tag 1 – Seller Name<br/>
    /// Tag 2 – VAT Registration Number (15-digit string)<br/>
    /// Tag 3 – Timestamp  (ISO 8601)<br/>
    /// Tag 4 – Invoice Total with VAT<br/>
    /// Tag 5 – VAT Total
    /// </para>
    /// </summary>
    internal static string GenerateBase64Tlv(
        string seller, string vat, DateTime stamp, decimal total, decimal tax)
    {
        var timestamp = stamp.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");

        var payload = new List<byte>(256);
        EncodeTlvField(payload, 1, seller);
        EncodeTlvField(payload, 2, vat);
        EncodeTlvField(payload, 3, timestamp);
        EncodeTlvField(payload, 4, Fmt2(total));
        EncodeTlvField(payload, 5, Fmt2(tax));

        return Convert.ToBase64String(payload.ToArray());
    }

    /// <summary>
    /// Generate a complete ZATCA-compliant UBL 2.1 Invoice XML.
    /// </summary>
    internal static (string Xml, string QrPayload) Generate(InvoiceData data)
    {
        var issueUtc = data.IssueDate.ToUniversalTime();
        var timestampStr = issueUtc.ToString("yyyy-MM-ddTHH:mm:ssZ");

        // ── TLV QR code ─────────────────────────────────────────────────
        var qrB64 = GenerateBase64Tlv(
            data.Seller.Name,
            data.Seller.TaxId,
            issueUtc,
            data.TotalTtc,
            data.VatTotal);

        // ── Build unsigned body first (for hashing) ─────────────────────
        var unsigned = BuildUnsignedBody(data, issueUtc, qrB64);
        var unsignedStr = unsigned.ToString(SaveOptions.DisableFormatting);
        var docHash = Sha256Base64(unsignedStr);

        // ── Full document with UBLExtensions ────────────────────────────
        var root = new XElement(NsInv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cac", NsCac),
            new XAttribute(XNamespace.Xmlns + "cbc", NsCbc),
            new XAttribute(XNamespace.Xmlns + "ext", NsExt));

        // Extensions / hash placeholder (XAdES-EPES stub)
        root.Add(new XElement(NsExt + "UBLExtensions",
            new XElement(NsExt + "UBLExtension",
                new XElement(NsExt + "ExtensionContent",
                    new XElement("Hash", docHash)))));

        // Copy children from unsigned body
        foreach (var child in unsigned.Elements())
            root.Add(child);

        return (root.ToString(SaveOptions.DisableFormatting), qrB64);
    }

    // ── Private helpers ─────────────────────────────────────────────────

    /// <summary>
    /// Encode a single TLV field into the <paramref name="buffer"/>.
    /// Uses <see cref="List{T}"/> — no string concatenation.
    /// </summary>
    private static void EncodeTlvField(List<byte> buffer, byte tag, string value)
    {
        var valueBytes = Encoding.UTF8.GetBytes(value ?? "");
        var length = (byte)Math.Min(valueBytes.Length, 255);
        buffer.Add(tag);
        buffer.Add(length);
        buffer.AddRange(valueBytes.AsSpan(0, length).ToArray());
    }

    private static XElement BuildUnsignedBody(InvoiceData data, DateTime issueUtc, string qrB64)
    {
        var root = new XElement(NsInv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cac", NsCac),
            new XAttribute(XNamespace.Xmlns + "cbc", NsCbc));

        // ── Basic fields ────────────────────────────────────────────────
        root.Add(new XElement(NsCbc + "ID", data.InvoiceNumber));
        root.Add(new XElement(NsCbc + "IssueDate", issueUtc.ToString("yyyy-MM-dd")));
        root.Add(new XElement(NsCbc + "IssueTime", issueUtc.ToString("HH:mm:ss")));
        root.Add(new XElement(NsCbc + "InvoiceTypeCode",
            new XAttribute("name", "0100000"), "388")); // Standard tax invoice
        root.Add(new XElement(NsCbc + "DocumentCurrencyCode", "SAR"));

        // ── QR code as AdditionalDocumentReference ──────────────────────
        root.Add(new XElement(NsCac + "AdditionalDocumentReference",
            new XElement(NsCbc + "ID", "QR"),
            new XElement(NsCac + "Attachment",
                new XElement(NsCbc + "EmbeddedDocumentBinaryObject",
                    new XAttribute("mimeCode", "text/plain"), qrB64))));

        // ── Supplier ────────────────────────────────────────────────────
        var supParty = new XElement(NsCac + "Party",
            new XElement(NsCac + "PartyName",
                new XElement(NsCbc + "Name", data.Seller.Name)),
            new XElement(NsCac + "PartyTaxScheme",
                new XElement(NsCbc + "CompanyID", data.Seller.TaxId),
                new XElement(NsCac + "TaxScheme",
                    new XElement(NsCbc + "ID", "VAT"))));

        if (!string.IsNullOrEmpty(data.Seller.Address))
        {
            supParty.Add(new XElement(NsCac + "PostalAddress",
                new XElement(NsCbc + "StreetName", data.Seller.Address)));
        }

        root.Add(new XElement(NsCac + "AccountingSupplierParty", supParty));

        // ── Customer ────────────────────────────────────────────────────
        var custParty = new XElement(NsCac + "Party",
            new XElement(NsCac + "PartyName",
                new XElement(NsCbc + "Name", data.Buyer.Name)));

        if (!string.IsNullOrEmpty(data.Buyer.TaxId))
        {
            custParty.Add(new XElement(NsCac + "PartyTaxScheme",
                new XElement(NsCbc + "CompanyID", data.Buyer.TaxId),
                new XElement(NsCac + "TaxScheme",
                    new XElement(NsCbc + "ID", "VAT"))));
        }

        root.Add(new XElement(NsCac + "AccountingCustomerParty", custParty));

        // ── Tax total ───────────────────────────────────────────────────
        root.Add(new XElement(NsCac + "TaxTotal",
            new XElement(NsCbc + "TaxAmount",
                new XAttribute("currencyID", "SAR"), Fmt2(data.VatTotal))));

        // ── Monetary total ──────────────────────────────────────────────
        root.Add(new XElement(NsCac + "LegalMonetaryTotal",
            new XElement(NsCbc + "TaxExclusiveAmount",
                new XAttribute("currencyID", "SAR"), Fmt2(data.SubTotal)),
            new XElement(NsCbc + "TaxInclusiveAmount",
                new XAttribute("currencyID", "SAR"), Fmt2(data.TotalTtc)),
            new XElement(NsCbc + "PayableAmount",
                new XAttribute("currencyID", "SAR"), Fmt2(data.TotalTtc))));

        // ── Invoice lines ───────────────────────────────────────────────
        var idx = 0;
        foreach (var item in data.Items)
        {
            idx++;
            root.Add(new XElement(NsCac + "InvoiceLine",
                new XElement(NsCbc + "ID", idx.ToString()),
                new XElement(NsCbc + "InvoicedQuantity",
                    new XAttribute("unitCode", "EA"), Fmt2(item.Quantity)),
                new XElement(NsCbc + "LineExtensionAmount",
                    new XAttribute("currencyID", "SAR"), Fmt2(item.LineTotalHt)),
                new XElement(NsCac + "TaxTotal",
                    new XElement(NsCbc + "TaxAmount",
                        new XAttribute("currencyID", "SAR"), Fmt2(item.LineVat))),
                new XElement(NsCac + "Item",
                    new XElement(NsCbc + "Name", item.Description)),
                new XElement(NsCac + "Price",
                    new XElement(NsCbc + "PriceAmount",
                        new XAttribute("currencyID", "SAR"), Fmt2(item.UnitPrice)))));
        }

        return root;
    }
}
