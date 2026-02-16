namespace ResourceManager.Application.EInvoicing;

/// <summary>
/// Seller / supplier details shared across all regional formats.
/// <para>
/// For Tunisia, <see cref="TaxId"/> holds the Matricule Fiscal (13 chars).<br/>
/// For KSA, it holds the ZATCA Registration Number (15 digits, starts/ends with '3').<br/>
/// For EU, it holds the VAT ID (e.g. FR12345678901).
/// </para>
/// </summary>
public sealed record SellerInfo(
    string Name,
    string TaxId,
    string Address = "",
    string Phone = "",
    string Bic = "",
    string Iban = "")
{
    /// <summary>
    /// Tunisia-specific alias: the Matricule Fiscal (13-character Tunisian tax identifier).
    /// Maps to <see cref="TaxId"/>.
    /// </summary>
    public string MatriculeFiscal => TaxId;
}

/// <summary>
/// Buyer / client details.
/// </summary>
public sealed record BuyerInfo(
    string Name,
    string TaxId = "",
    string Address = "",
    string Phone = "");

/// <summary>
/// Banking details for EU / SEPA payments.
/// </summary>
public sealed record BankInfo(
    string Bic,
    string Iban,
    string BankName = "");

/// <summary>
/// A single invoice line item. All monetary fields use <see cref="decimal"/> for precision.
/// </summary>
public sealed class LineItem(
    string description,
    decimal quantity,
    decimal unitPrice,
    decimal vatRate = 0.19m)
{
    public string Description { get; } = description;
    public decimal Quantity { get; } = quantity;
    public decimal UnitPrice { get; } = unitPrice;
    public decimal VatRate { get; } = vatRate;

    /// <summary>Line total excluding tax.</summary>
    public decimal LineTotalHt => Quantity * UnitPrice;

    /// <summary>VAT amount for this line.</summary>
    public decimal LineVat => LineTotalHt * VatRate;
}

/// <summary>
/// Normalised invoice data consumed by all three regional generators.
/// </summary>
public sealed class InvoiceData
{
    public required string InvoiceNumber { get; init; }
    public required DateTime IssueDate { get; init; }
    public required SellerInfo Seller { get; init; }
    public required BuyerInfo Buyer { get; init; }
    public List<LineItem> Items { get; init; } = [];
    public string Currency { get; init; } = "TND";

    /// <summary>Tunisia: unique TTN reference ID.</summary>
    public string TtnReference { get; init; } = "";

    /// <summary>EU: banking details for SEPA block.</summary>
    public BankInfo? Bank { get; init; }

    // ── Computed totals ──────────────────────────────────────────────────
    public decimal SubTotal => Items.Sum(i => i.LineTotalHt);
    public decimal VatTotal => Items.Sum(i => i.LineVat);
    public decimal TotalTtc => SubTotal + VatTotal;
}

/// <summary>
/// Supported e-invoicing regions.
/// </summary>
public enum EInvoiceRegion
{
    Tunisia,
    Ksa,
    Europe
}

/// <summary>
/// Result of generating an e-invoice.
/// </summary>
public sealed record EInvoiceResult(
    string Xml,
    string QrPayload,
    EInvoiceRegion Region);
