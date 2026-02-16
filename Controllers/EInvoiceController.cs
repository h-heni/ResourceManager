using Microsoft.AspNetCore.Mvc;
using ResourceManager.Application.EInvoicing;
using ResourceManager.Application.Interfaces;

namespace ResourceManager.Controllers;

/// <summary>
/// E-invoicing endpoints — generate region-compliant XML and QR payloads.
/// </summary>
public sealed class EInvoiceController(IEInvoiceService eInvoiceService) : BaseApiController
{
    /// <summary>
    /// Generate an e-invoice for the specified region.
    /// </summary>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(EInvoiceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public IActionResult Generate([FromBody] EInvoiceRequest request)
    {
        if (!Enum.TryParse<EInvoiceRegion>(request.Region, ignoreCase: true, out var region))
            return BadRequest(new { error = $"Unknown region '{request.Region}'. Supported: Tunisia, Ksa, Europe." });

        var data = MapToInvoiceData(request);

        // Validate first
        var validation = eInvoiceService.Validate(region, data);
        if (!validation.IsValid)
            return BadRequest(new { errors = validation.Errors });

        var result = eInvoiceService.Generate(region, data);

        return Ok(new EInvoiceResponse
        {
            Xml = result.Xml,
            QrPayload = result.QrPayload,
            Region = result.Region.ToString()
        });
    }

    /// <summary>
    /// Validate invoice data without generating.
    /// </summary>
    [HttpPost("validate")]
    [ProducesResponseType(typeof(EInvoiceValidationResult), StatusCodes.Status200OK)]
    public IActionResult Validate([FromBody] EInvoiceRequest request)
    {
        if (!Enum.TryParse<EInvoiceRegion>(request.Region, ignoreCase: true, out var region))
            return BadRequest(new { error = $"Unknown region '{request.Region}'." });

        var data = MapToInvoiceData(request);
        var result = eInvoiceService.Validate(region, data);

        return Ok(result);
    }

    private static InvoiceData MapToInvoiceData(EInvoiceRequest r) => new()
    {
        InvoiceNumber = r.InvoiceNumber,
        IssueDate = r.IssueDate,
        Currency = r.Currency ?? "TND",
        TtnReference = r.TtnReference ?? "",
        Seller = new SellerInfo(
            r.SellerName, r.SellerMatriculeFiscal ?? r.SellerTaxId,
            r.SellerAddress ?? "", r.SellerPhone ?? "",
            r.SellerBic ?? "", r.SellerIban ?? ""),
        Buyer = new BuyerInfo(
            r.BuyerName, r.BuyerTaxId ?? "",
            r.BuyerAddress ?? "", r.BuyerPhone ?? ""),
        Bank = !string.IsNullOrEmpty(r.BankIban)
            ? new BankInfo(r.BankBic ?? "", r.BankIban, r.BankName ?? "")
            : null,
        Items = r.Items.Select(i =>
            new LineItem(i.Description, i.Quantity, i.UnitPrice, i.VatRate)).ToList()
    };
}

// ── Request / Response DTOs ─────────────────────────────────────────────────

public sealed class EInvoiceRequest
{
    public required string Region { get; init; }
    public required string InvoiceNumber { get; init; }
    public DateTime IssueDate { get; init; } = DateTime.UtcNow;
    public string? Currency { get; init; }
    public string? TtnReference { get; init; }

    // Seller
    public required string SellerName { get; init; }
    public required string SellerTaxId { get; init; }

    /// <summary>
    /// Tunisia-specific alias for <see cref="SellerTaxId"/>.
    /// When Region=Tunisia, this is the 13-character Matricule Fiscal.
    /// Either <see cref="SellerTaxId"/> or <see cref="SellerMatriculeFiscal"/> can be used.
    /// </summary>
    public string? SellerMatriculeFiscal { get; init; }

    public string? SellerAddress { get; init; }
    public string? SellerPhone { get; init; }
    public string? SellerBic { get; init; }
    public string? SellerIban { get; init; }

    // Buyer
    public required string BuyerName { get; init; }
    public string? BuyerTaxId { get; init; }
    public string? BuyerAddress { get; init; }
    public string? BuyerPhone { get; init; }

    // Bank (EU/SEPA)
    public string? BankBic { get; init; }
    public string? BankIban { get; init; }
    public string? BankName { get; init; }

    // Line items
    public List<EInvoiceLineItemRequest> Items { get; init; } = [];
}

public sealed class EInvoiceLineItemRequest
{
    public required string Description { get; init; }
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal VatRate { get; init; } = 0.19m;
}

public sealed class EInvoiceResponse
{
    public required string Xml { get; init; }
    public required string QrPayload { get; init; }
    public required string Region { get; init; }
}
