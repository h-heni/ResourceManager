namespace ResourceManager.Application.EInvoicing;

/// <summary>
/// Validation result for e-invoice data.
/// </summary>
public sealed class EInvoiceValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public List<string> Errors { get; init; } = [];

    public static EInvoiceValidationResult Success() => new();

    public static EInvoiceValidationResult Failure(params string[] errors) =>
        new() { Errors = [.. errors] };

    public static EInvoiceValidationResult Failure(IEnumerable<string> errors) =>
        new() { Errors = errors.ToList() };
}
