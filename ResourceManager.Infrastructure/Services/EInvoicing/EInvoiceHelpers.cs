using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace ResourceManager.Infrastructure.Services.EInvoicing;

/// <summary>
/// Shared formatting and cryptographic helpers for e-invoice generators.
/// </summary>
internal static class EInvoiceHelpers
{
    /// <summary>Format a decimal to exactly 3 decimal places (TND). Uses invariant culture.</summary>
    internal static string Fmt3(decimal value) => value.ToString("F3", CultureInfo.InvariantCulture);

    /// <summary>Format a decimal to exactly 2 decimal places (SAR / EUR). Uses invariant culture.</summary>
    internal static string Fmt2(decimal value) => value.ToString("F2", CultureInfo.InvariantCulture);

    /// <summary>SHA-256 digest of <paramref name="text"/> encoded as Base64.</summary>
    internal static string Sha256Base64(string text)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text));
        return Convert.ToBase64String(hash);
    }

    /// <summary>Strip &amp; upper-case a currency code.</summary>
    internal static string NormalizeCurrency(string? code) =>
        string.IsNullOrWhiteSpace(code) ? "" : code.Trim().ToUpperInvariant();
}
