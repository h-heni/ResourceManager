using System.Xml.Linq;
using ResourceManager.Application.EInvoicing;
using static ResourceManager.Infrastructure.Services.EInvoicing.EInvoiceHelpers;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// Europe – Peppol BIS 3.0 (UBL 2.1) XML generator.
/// <para>
/// Uses <see cref="XNamespace"/> for <c>cac</c>, <c>cbc</c>, and <c>ext</c> namespaces.
/// Implements the EPC QR code standard for SEPA payments in the
/// <c>cac:PaymentMeans</c> section.
/// </para>
/// Currency: EUR (2 decimal places).
/// </summary>
internal static class PeppolXmlGenerator
{
    // ── UBL 2.1 namespaces ──────────────────────────────────────────────
    private static readonly XNamespace NsInv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
    private static readonly XNamespace NsCac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace NsCbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    private const string CustomizationId =
        "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";
    private const string ProfileId =
        "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

    // ── Public API ──────────────────────────────────────────────────────

    /// <summary>
    /// Build an EPC QR-Code string per the European Payments Council standard (BCD).
    /// <para>
    /// Format (newline-separated):<br/>
    /// BCD / 002 / 1 / SCT / {BIC} / {Name} / {IBAN} / EUR{Amount} / / / {Ref} /
    /// </para>
    /// </summary>
    internal static string GenerateEpcQrString(
        string bic, string name, string iban, string amountEur, string invoiceRef) =>
        $"BCD\n002\n1\nSCT\n{bic}\n{name[..Math.Min(name.Length, 70)]}\n{iban}\nEUR{amountEur}\n\n\n{invoiceRef}\n";

    /// <summary>
    /// Generate a complete Peppol BIS 3.0 UBL 2.1 Invoice XML.
    /// </summary>
    internal static (string Xml, string QrPayload) Generate(InvoiceData data)
    {
        var issueUtc = data.IssueDate.ToUniversalTime();

        // ── Root ────────────────────────────────────────────────────────
        var root = new XElement(NsInv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cac", NsCac),
            new XAttribute(XNamespace.Xmlns + "cbc", NsCbc));

        // ── Peppol identifiers ──────────────────────────────────────────
        root.Add(new XElement(NsCbc + "CustomizationID", CustomizationId));
        root.Add(new XElement(NsCbc + "ProfileID", ProfileId));

        // ── Basic fields ────────────────────────────────────────────────
        root.Add(new XElement(NsCbc + "ID", data.InvoiceNumber));
        root.Add(new XElement(NsCbc + "IssueDate", issueUtc.ToString("yyyy-MM-dd")));
        root.Add(new XElement(NsCbc + "InvoiceTypeCode", "380")); // Commercial invoice
        root.Add(new XElement(NsCbc + "DocumentCurrencyCode", "EUR"));

        // ── Supplier ────────────────────────────────────────────────────
        var supParty = new XElement(NsCac + "Party",
            new XElement(NsCbc + "EndpointID",
                new XAttribute("schemeID", "0088"), data.Seller.TaxId),
            new XElement(NsCac + "PartyName",
                new XElement(NsCbc + "Name", data.Seller.Name)),
            new XElement(NsCac + "PartyTaxScheme",
                new XElement(NsCbc + "CompanyID", data.Seller.TaxId),
                new XElement(NsCac + "TaxScheme",
                    new XElement(NsCbc + "ID", "VAT"))),
            new XElement(NsCac + "PartyLegalEntity",
                new XElement(NsCbc + "RegistrationName", data.Seller.Name)));

        if (!string.IsNullOrEmpty(data.Seller.Address))
        {
            supParty.Add(new XElement(NsCac + "PostalAddress",
                new XElement(NsCbc + "StreetName", data.Seller.Address)));
        }

        root.Add(new XElement(NsCac + "AccountingSupplierParty", supParty));

        // ── Customer ────────────────────────────────────────────────────
        var custParty = new XElement(NsCac + "Party",
            new XElement(NsCbc + "EndpointID",
                new XAttribute("schemeID", "0088"), data.Buyer.TaxId ?? "0000000000"),
            new XElement(NsCac + "PartyName",
                new XElement(NsCbc + "Name", data.Buyer.Name)),
            new XElement(NsCac + "PartyLegalEntity",
                new XElement(NsCbc + "RegistrationName", data.Buyer.Name)));

        if (!string.IsNullOrEmpty(data.Buyer.Address))
        {
            custParty.Add(new XElement(NsCac + "PostalAddress",
                new XElement(NsCbc + "StreetName", data.Buyer.Address)));
        }

        root.Add(new XElement(NsCac + "AccountingCustomerParty", custParty));

        // ── Payment Means (EPC QR / SEPA Credit Transfer) ───────────────
        var sellerBic = data.Bank?.Bic ?? data.Seller.Bic;
        var sellerIban = data.Bank?.Iban ?? data.Seller.Iban;
        var qrPayload = "";

        var pm = new XElement(NsCac + "PaymentMeans",
            new XElement(NsCbc + "PaymentMeansCode", "30")); // Credit transfer

        if (!string.IsNullOrEmpty(sellerIban))
        {
            qrPayload = GenerateEpcQrString(
                sellerBic, data.Seller.Name, sellerIban,
                Fmt2(data.TotalTtc), data.InvoiceNumber);

            pm.Add(new XElement(NsCbc + "PaymentNote", qrPayload));

            var fa = new XElement(NsCac + "PayeeFinancialAccount",
                new XElement(NsCbc + "ID", sellerIban),
                new XElement(NsCbc + "Name", data.Seller.Name));

            if (!string.IsNullOrEmpty(sellerBic))
            {
                fa.Add(new XElement(NsCac + "FinancialInstitutionBranch",
                    new XElement(NsCbc + "ID", sellerBic)));
            }

            pm.Add(fa);
        }

        root.Add(pm);

        // ── Tax totals ──────────────────────────────────────────────────
        var taxTotal = new XElement(NsCac + "TaxTotal",
            new XElement(NsCbc + "TaxAmount",
                new XAttribute("currencyID", "EUR"), Fmt2(data.VatTotal)));

        // Tax subtotal grouped by rate
        var rates = new Dictionary<string, (decimal Taxable, decimal Tax)>();
        foreach (var item in data.Items)
        {
            var key = Fmt2(item.VatRate * 100m);
            if (rates.TryGetValue(key, out var existing))
                rates[key] = (existing.Taxable + item.LineTotalHt, existing.Tax + item.LineVat);
            else
                rates[key] = (item.LineTotalHt, item.LineVat);
        }

        foreach (var (pct, vals) in rates)
        {
            taxTotal.Add(new XElement(NsCac + "TaxSubtotal",
                new XElement(NsCbc + "TaxableAmount",
                    new XAttribute("currencyID", "EUR"), Fmt2(vals.Taxable)),
                new XElement(NsCbc + "TaxAmount",
                    new XAttribute("currencyID", "EUR"), Fmt2(vals.Tax)),
                new XElement(NsCac + "TaxCategory",
                    new XElement(NsCbc + "ID", "S"),
                    new XElement(NsCbc + "Percent", pct),
                    new XElement(NsCac + "TaxScheme",
                        new XElement(NsCbc + "ID", "VAT")))));
        }

        root.Add(taxTotal);

        // ── Monetary totals ─────────────────────────────────────────────
        root.Add(new XElement(NsCac + "LegalMonetaryTotal",
            new XElement(NsCbc + "LineExtensionAmount",
                new XAttribute("currencyID", "EUR"), Fmt2(data.SubTotal)),
            new XElement(NsCbc + "TaxExclusiveAmount",
                new XAttribute("currencyID", "EUR"), Fmt2(data.SubTotal)),
            new XElement(NsCbc + "TaxInclusiveAmount",
                new XAttribute("currencyID", "EUR"), Fmt2(data.TotalTtc)),
            new XElement(NsCbc + "PayableAmount",
                new XAttribute("currencyID", "EUR"), Fmt2(data.TotalTtc))));

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
                    new XAttribute("currencyID", "EUR"), Fmt2(item.LineTotalHt)),
                new XElement(NsCac + "Item",
                    new XElement(NsCbc + "Name", item.Description),
                    new XElement(NsCac + "ClassifiedTaxCategory",
                        new XElement(NsCbc + "ID", "S"),
                        new XElement(NsCbc + "Percent", Fmt2(item.VatRate * 100m)),
                        new XElement(NsCac + "TaxScheme",
                            new XElement(NsCbc + "ID", "VAT")))),
                new XElement(NsCac + "Price",
                    new XElement(NsCbc + "PriceAmount",
                        new XAttribute("currencyID", "EUR"), Fmt2(item.UnitPrice)))));
        }

        return (root.ToString(SaveOptions.DisableFormatting), qrPayload);
    }
}
