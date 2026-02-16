using ResourceManager.Application.EInvoicing;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// Validates e-invoice data per regional requirements.
/// </summary>
internal static class EInvoiceValidationService
{
    internal static EInvoiceValidationResult Validate(EInvoiceRegion region, InvoiceData data)
    {
        var errors = new List<string>();

        // ── Common checks ───────────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(data.InvoiceNumber))
            errors.Add("InvoiceNumber is required.");

        if (data.IssueDate == default)
            errors.Add("IssueDate is required.");

        if (string.IsNullOrWhiteSpace(data.Seller.Name))
            errors.Add("Seller Name is required.");

        if (string.IsNullOrWhiteSpace(data.Seller.TaxId))
            errors.Add("Seller TaxId is required.");

        if (data.Items.Count == 0)
            errors.Add("At least one line item is required.");

        foreach (var (item, idx) in data.Items.Select((it, i) => (it, i)))
        {
            if (item.Quantity <= 0)
                errors.Add($"Item[{idx}]: Quantity must be positive.");
            if (item.UnitPrice < 0)
                errors.Add($"Item[{idx}]: UnitPrice cannot be negative.");
        }

        // ── Region-specific ─────────────────────────────────────────────
        switch (region)
        {
            case EInvoiceRegion.Tunisia:
                ValidateTunisia(data, errors);
                break;

            case EInvoiceRegion.Ksa:
                ValidateKsa(data, errors);
                break;

            case EInvoiceRegion.Europe:
                ValidateEurope(data, errors);
                break;
        }

        return errors.Count == 0
            ? EInvoiceValidationResult.Success()
            : EInvoiceValidationResult.Failure(errors);
    }

    // ── Tunisia ─────────────────────────────────────────────────────────

    private static void ValidateTunisia(InvoiceData data, List<string> errors)
    {
        // Tunisian Matricule Fiscal must be exactly 13 characters
        if (data.Seller.MatriculeFiscal.Length != 13)
            errors.Add($"Tunisia: Seller MatriculeFiscal must be exactly 13 characters (got {data.Seller.MatriculeFiscal.Length}).");

        if (string.IsNullOrWhiteSpace(data.TtnReference))
            errors.Add("Tunisia: TtnReference is required.");
    }

    // ── KSA (ZATCA) ─────────────────────────────────────────────────────

    private static void ValidateKsa(InvoiceData data, List<string> errors)
    {
        var taxId = data.Seller.TaxId;

        // KSA Tax ID is 15 chars and starts/ends with '3'
        if (taxId.Length != 15)
            errors.Add($"KSA: Seller TaxId must be exactly 15 characters (got {taxId.Length}).");

        if (taxId.Length >= 1 && taxId[0] != '3')
            errors.Add("KSA: Seller TaxId must start with '3'.");

        if (taxId.Length >= 15 && taxId[14] != '3')
            errors.Add("KSA: Seller TaxId must end with '3'.");
    }

    // ── Europe (Peppol) ─────────────────────────────────────────────────

    private static void ValidateEurope(InvoiceData data, List<string> errors)
    {
        // IBAN should be present for SEPA payments
        var iban = data.Bank?.Iban ?? data.Seller.Iban;
        if (string.IsNullOrWhiteSpace(iban))
            errors.Add("Europe: IBAN is required for SEPA payment (provide Bank.Iban or Seller.Iban).");
    }
}
