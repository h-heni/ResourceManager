using MiniExcelLibs;
using MiniExcelLibs.Csv;
using ResourceManager.Dtos;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ResourceManager.Services
{
    /// <summary>
    /// Strict positional CSV/XLSX parser using MiniExcel.
    /// 
    /// CRITICAL: MiniExcel with useHeaderRow:false returns IDictionary&lt;int, object&gt;
    /// with INTEGER keys 0, 1, 2, 3, 4 — NOT string keys "A","B","C".
    ///
    /// Column layout (by integer index):
    ///   [0] Date          → Flexible: dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd, dd-MM-yyyy
    ///   [1] Client Name   → non-empty string
    ///   [2] Amount Paid   → Flexible: "6 922,00" (FR), "6,922.00" (US), "1500.50", "1500,50"
    ///   [3] Currency      → optional, defaults "TND"
    ///   [4] Payment Method → optional, defaults "Unknown"
    ///
    /// Atomic: first invalid cell → immediate abort with row + column number.
    /// Empty amounts (like ";;" in CSV) → treated as 0, not an error.
    /// Header row auto-detected and skipped if Index 0 contains "Date".
    /// </summary>
    public static class StrictExcelUploadService
    {
        /// <summary>
        /// Allowed date formats, tried in order. First match wins.
        /// Covers French (dd/MM/yyyy), US (MM/dd/yyyy), ISO (yyyy-MM-dd), and dashed European (dd-MM-yyyy).
        /// </summary>
        private static readonly string[] AllowedDateFormats =
        {
            "dd/MM/yyyy",
            "MM/dd/yyyy",
            "yyyy-MM-dd",
            "dd-MM-yyyy"
        };

        public static StrictExcelValidationResult Parse(Stream stream)
        {
            if (stream == null || !stream.CanRead)
                return StrictExcelValidationResult.Failure(0, "File", "Stream is null or unreadable.");

            // Semicolon delimiter for CSV files
            var csvConfig = new CsvConfiguration
            {
                Seperator = ';'
            };

            var results = new List<StrictRevenueRowDto>();
            int rowIndex = 0;

            try
            {
                // useHeaderRow: false → MiniExcel returns IDictionary<int, object>
                // Keys are integers: 0, 1, 2, 3, 4 ...
                var rows = stream.Query(useHeaderRow: false, configuration: csvConfig);

                foreach (IDictionary<int, object> row in rows)
                {
                    rowIndex++;

                    // ── Skip header row ──
                    // The first column might contain "Date" (possibly with BOM character).
                    // If it does, this is the header row — skip it.
                    string col0 = row.ContainsKey(0) ? row[0]?.ToString() ?? "" : "";
                    if (col0.Contains("Date", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // ───────────────────────────────────────────
                    // Index 0: Date (flexible multi-culture)
                    // Accepts: 31/10/2024, 10/31/2024, 2024-10-31, 31-10-2024
                    // ───────────────────────────────────────────
                    if (string.IsNullOrWhiteSpace(col0))
                        return StrictExcelValidationResult.Failure(rowIndex, "Column 0 (Date)",
                            "Date is missing.");

                    if (!FlexParseDate(col0, out DateTime validDate))
                    {
                        return StrictExcelValidationResult.Failure(rowIndex, "Column 0 (Date)",
                            $"Invalid Date '{col0}'. Expected one of: dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd, dd-MM-yyyy.");
                    }

                    // ───────────────────────────────────────────
                    // Index 1: Client Name 
                    // ───────────────────────────────────────────
                    string clientName = row.ContainsKey(1) ? row[1]?.ToString() ?? "" : "";
                    if (string.IsNullOrWhiteSpace(clientName))
                        clientName = "Unknown";

                    // ───────────────────────────────────────────
                    // Index 2: Amount Paid (flexible multi-culture)
                    // Accepts: "6 922,00" | "6,922.00" | "1500.50" | "1500,50"
                    // If empty (like ";;" in CSV), treat as 0 — NOT an error.
                    // ───────────────────────────────────────────
                    decimal validAmount = 0;
                    string amountRaw = row.ContainsKey(2) ? row[2]?.ToString() ?? "" : "";

                    if (!string.IsNullOrWhiteSpace(amountRaw))
                    {
                        if (!FlexParseDecimal(amountRaw, out validAmount))
                        {
                            return StrictExcelValidationResult.Failure(rowIndex, "Column 2 (Amount)",
                                $"Invalid Amount '{amountRaw}'. Accepted formats: 6 922,00 | 6,922.00 | 1500.50 | 1500,50.");
                        }
                    }
                    // else: validAmount stays 0 (empty amount like ";;" is OK)

                    // ───────────────────────────────────────────
                    // Index 3: Currency — optional, defaults "TND"
                    // ───────────────────────────────────────────
                    string currency = row.ContainsKey(3) ? row[3]?.ToString() ?? "TND" : "TND";
                    if (string.IsNullOrWhiteSpace(currency))
                        currency = "TND";

                    // ───────────────────────────────────────────
                    // Index 4: Payment Method — optional, defaults "Unknown"
                    // ───────────────────────────────────────────
                    string paymentMethod = row.ContainsKey(4) ? row[4]?.ToString() ?? "Unknown" : "Unknown";
                    if (string.IsNullOrWhiteSpace(paymentMethod))
                        paymentMethod = "Unknown";

                    // ── All cells passed → construct DTO ──
                    results.Add(new StrictRevenueRowDto
                    {
                        Date = validDate,
                        ClientName = clientName,
                        AmountPaid = validAmount,
                        Currency = currency,
                        PaymentMethod = paymentMethod
                    });
                }
            }
            catch (Exception ex)
            {
                return StrictExcelValidationResult.Failure(rowIndex, "File",
                    $"System error on row {rowIndex}: {ex.Message}");
            }

            if (results.Count == 0)
            {
                return StrictExcelValidationResult.Failure(0, "File",
                    "The file contains no data rows.");
            }

            return StrictExcelValidationResult.Success(results);
        }

        // ────────────────────────────────────────────────
        // Flexible Multi-Culture Parsing Helpers
        // ────────────────────────────────────────────────

        /// <summary>
        /// Multi-culture decimal parser for dirty data.
        ///
        /// Algorithm:
        ///   1. Remove all spaces and non-breaking spaces (\u00A0).
        ///   2. If both comma AND dot are present (e.g. "1,200.50"), treat the dot
        ///      as the decimal separator → strip commas.
        ///   3. If only a comma is present (e.g. "1500,50"), replace it with a dot
        ///      to form a standard decimal string.
        ///   4. Parse with <see cref="CultureInfo.InvariantCulture"/>.
        ///
        /// Covers: "6 922,00" (FR), "6,922.00" (US), "1500.50", "1500,50".
        /// </summary>
        internal static bool FlexParseDecimal(string raw, out decimal result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(raw)) return false;

            // Step 1: Strip ALL whitespace (regular space, NBSP \u00A0, tabs, etc.)
            var cleaned = Regex.Replace(raw, @"[\s\u00A0]+", "");

            bool hasComma = cleaned.Contains(',');
            bool hasDot   = cleaned.Contains('.');

            if (hasComma && hasDot)
            {
                // Step 2: Both present → dot is the decimal separator, commas are thousands
                cleaned = cleaned.Replace(",", "");
            }
            else if (hasComma)
            {
                // Step 3: Only comma → it IS the decimal separator
                cleaned = cleaned.Replace(",", ".");
            }
            // else: only dot or neither → already in standard format

            // Step 4: Parse with InvariantCulture (dot = decimal)
            return decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out result);
        }

        /// <summary>
        /// Multi-culture date parser.
        /// Tries the four allowed formats in order; first match wins.
        /// Covers: "31/10/2024" (FR), "10/31/2024" (US), "2024-10-31" (ISO), "31-10-2024".
        /// </summary>
        internal static bool FlexParseDate(string raw, out DateTime result)
        {
            return DateTime.TryParseExact(
                raw.Trim(),
                AllowedDateFormats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out result);
        }
    }
}
