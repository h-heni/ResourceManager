namespace ResourceManager.Helpers;

/// <summary>
/// Shared currency normalization used by Dashboard, Expenses, and other controllers.
/// Maps common currency aliases, symbols, and abbreviations to standard ISO 4217 codes.
/// Lookup is case-insensitive: "dt", "DT", "Dt" all resolve to "TND".
/// Standard ISO codes (e.g. "eur") are upper-cased automatically even without an alias.
/// </summary>
public static class CurrencyHelper
{
    // ─── Alias table ────────────────────────────────────────────────────
    // Key = any common way users/imports might write the currency.
    // Value = canonical ISO 4217 code.
    // The dictionary uses OrdinalIgnoreCase, so only ONE casing is needed per alias.
    private static readonly Dictionary<string, string> CurrencyAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        // ── Tunisian Dinar ───────────────────────────────────────────
        ["DT"]   = "TND",
        ["دت"]   = "TND",      // Arabic abbreviation
        ["د.ت"]  = "TND",      // Arabic with dot
        ["DINAR"] = "TND",     // Common shorthand (context: Tunisian app)

        // ── Euro ─────────────────────────────────────────────────────
        ["€"]     = "EUR",
        ["EURO"]  = "EUR",
        ["EUROS"] = "EUR",

        // ── US Dollar ────────────────────────────────────────────────
        ["$"]     = "USD",
        ["US$"]   = "USD",
        ["USD$"]  = "USD",
        ["DOLLAR"]  = "USD",
        ["DOLLARS"] = "USD",

        // ── British Pound ────────────────────────────────────────────
        ["£"]     = "GBP",
        ["₤"]     = "GBP",

        // ── Japanese Yen ─────────────────────────────────────────────
        ["¥"]     = "JPY",
        ["円"]    = "JPY",

        // ── Chinese Yuan ─────────────────────────────────────────────
        ["元"]    = "CNY",
        ["圆"]    = "CNY",
        ["RMB"]   = "CNY",

        // ── Swiss Franc ──────────────────────────────────────────────
        ["SFR"]   = "CHF",
        ["FR."]   = "CHF",
        ["FRANC"] = "CHF",

        // ── Turkish Lira ─────────────────────────────────────────────
        ["₺"]     = "TRY",
        ["TL"]    = "TRY",

        // ── Indian Rupee ─────────────────────────────────────────────
        ["₹"]     = "INR",
        ["RS"]    = "INR",
        ["RS."]   = "INR",

        // ── Algerian Dinar ───────────────────────────────────────────
        ["DA"]    = "DZD",
        ["دج"]    = "DZD",      // Arabic abbreviation
        ["د.ج"]   = "DZD",      // Arabic with dot

        // ── Moroccan Dirham ──────────────────────────────────────────
        ["DH"]    = "MAD",
        ["DHS"]   = "MAD",
        ["د.م"]   = "MAD",      // Arabic abbreviation
        ["MAD."]  = "MAD",

        // ── Egyptian Pound ───────────────────────────────────────────
        ["LE"]    = "EGP",
        ["E£"]    = "EGP",
        ["ج.م"]   = "EGP",      // Arabic abbreviation

        // ── Saudi Riyal ──────────────────────────────────────────────
        ["SR"]    = "SAR",
        ["ر.س"]   = "SAR",      // Arabic abbreviation

        // ── UAE Dirham ───────────────────────────────────────────────
        ["د.إ"]   = "AED",

        // ── Lebanese Pound ───────────────────────────────────────────
        ["ل.ل"]   = "LBP",

        // ── Libyan Dinar ─────────────────────────────────────────────
        ["ل.د"]   = "LYD",
        ["LD"]    = "LYD",

        // ── Iraqi Dinar ──────────────────────────────────────────────
        ["د.ع"]   = "IQD",

        // ── Kuwaiti Dinar ────────────────────────────────────────────
        ["د.ك"]   = "KWD",

        // ── Bahraini Dinar ───────────────────────────────────────────
        ["د.ب"]   = "BHD",

        // ── Qatari Riyal ─────────────────────────────────────────────
        ["ر.ق"]   = "QAR",
        ["QR"]    = "QAR",

        // ── Omani Rial ───────────────────────────────────────────────
        ["ر.ع"]   = "OMR",

        // ── Jordanian Dinar ──────────────────────────────────────────
        ["د.أ"]   = "JOD",
        ["JD"]    = "JOD",

        // ── CFA Franc (West Africa) ──────────────────────────────────
        ["CFA"]   = "XOF",
        ["FCFA"]  = "XOF",

        // ── CFA Franc (Central Africa) ───────────────────────────────
        ["FCFA-C"] = "XAF",

        // ── South African Rand ───────────────────────────────────────
        ["ZAR"]   = "ZAR",  // Already ISO but included for completeness

        // ── South Korean Won ─────────────────────────────────────────
        ["₩"]     = "KRW",

        // ── Russian Ruble ────────────────────────────────────────────
        ["₽"]     = "RUB",
        ["РУБ"]   = "RUB",     // Cyrillic abbreviation

        // ── Ukrainian Hryvnia ────────────────────────────────────────
        ["₴"]     = "UAH",

        // ── Brazilian Real ───────────────────────────────────────────
        ["R$"]    = "BRL",

        // ── Malaysian Ringgit ────────────────────────────────────────
        ["RM"]    = "MYR",

        // ── Polish Zloty ─────────────────────────────────────────────
        ["ZŁ"]    = "PLN",
        ["ZL"]    = "PLN",

        // ── Thai Baht ────────────────────────────────────────────────
        ["฿"]     = "THB",

        // ── Nigerian Naira ───────────────────────────────────────────
        ["₦"]     = "NGN",

        // ── Ghanaian Cedi ────────────────────────────────────────────
        ["₵"]     = "GHS",
        ["GH₵"]   = "GHS",

        // ── Kenyan Shilling ──────────────────────────────────────────
        ["KSH"]   = "KES",

        // ── Pakistani Rupee ──────────────────────────────────────────
        ["PKR"]   = "PKR",
        ["₨"]     = "PKR",

        // ── Canadian Dollar ──────────────────────────────────────────
        ["C$"]    = "CAD",
        ["CA$"]   = "CAD",
        ["CAD$"]  = "CAD",

        // ── Australian Dollar ────────────────────────────────────────
        ["A$"]    = "AUD",
        ["AU$"]   = "AUD",

        // ── New Zealand Dollar ───────────────────────────────────────
        ["NZ$"]   = "NZD",

        // ── Hong Kong Dollar ─────────────────────────────────────────
        ["HK$"]   = "HKD",

        // ── Singapore Dollar ─────────────────────────────────────────
        ["SG$"]   = "SGD",
        ["S$"]    = "SGD",

        // ── Swedish Krona ────────────────────────────────────────────
        ["KR"]    = "SEK",     // "kr" most commonly Swedish; NOK/DKK users enter ISO

        // ── Israeli Shekel ───────────────────────────────────────────
        ["₪"]     = "ILS",
        ["NIS"]   = "ILS",

        // ── Philippine Peso ──────────────────────────────────────────
        ["₱"]     = "PHP",

        // ── Vietnamese Dong ──────────────────────────────────────────
        ["₫"]     = "VND",

        // ── Indonesian Rupiah ────────────────────────────────────────
        ["RP"]    = "IDR",
        ["RP."]   = "IDR",
    };

    /// <summary>
    /// Normalize a raw currency string to its canonical ISO 4217 code.
    /// Examples: "DT" → "TND", "€" → "EUR", "dollar" → "USD", "eur" → "EUR".
    /// Returns the upper-cased input when no alias match is found.
    /// Returns empty string for null/empty/whitespace input.
    /// </summary>
    public static string NormalizeCurrency(string? currency)
    {
        var trimmed = (currency ?? "").Trim();
        if (string.IsNullOrEmpty(trimmed)) return string.Empty;

        // Try alias lookup first (case-insensitive)
        if (CurrencyAliases.TryGetValue(trimmed, out var canonical))
            return canonical;

        // No alias found — upper-case the raw input (handles "eur" → "EUR" etc.)
        return trimmed.ToUpperInvariant();
    }
}
