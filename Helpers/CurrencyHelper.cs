namespace ResourceManager.Helpers;

/// <summary>
/// Shared currency normalization used by Dashboard, Expenses, and other controllers.
/// Maps common currency aliases to standard ISO 4217 codes.
/// </summary>
public static class CurrencyHelper
{
    private static readonly Dictionary<string, string> CurrencyAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["DT"] = "TND",
        ["dt"] = "TND",
        // Arabic symbol for TND (دت)
        ["\u062F\u062A"] = "TND",
    };

    /// <summary>Normalize currency code: DT → TND, dt → TND, etc.</summary>
    public static string NormalizeCurrency(string? currency)
    {
        var trimmed = (currency ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(trimmed)) return trimmed;
        return CurrencyAliases.TryGetValue(trimmed, out var canonical)
            ? canonical
            : trimmed;
    }
}
