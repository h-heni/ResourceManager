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
    ///   [0] Date          → dd/MM/yyyy (fr-FR culture)
    ///   [1] Client Name   → non-empty string
    ///   [2] Amount Paid   → French decimal, e.g. "13 017,00" (comma = decimal, NBSP = thousands)
    ///   [3] Currency      → optional, defaults "TND"
    ///   [4] Payment Method → optional, defaults "Unknown"
    ///
    /// Atomic: first invalid cell → immediate abort with row + column number.
    /// Empty amounts (like ";;" in CSV) → treated as 0, not an error.
    /// Header row auto-detected and skipped if Index 0 contains "Date".
    /// </summary>
    public static class StrictExcelUploadService
    {
        private static readonly CultureInfo FrenchCulture = new("fr-FR");

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
                    // Index 0: Date — e.g. "31/10/2024"
                    // ───────────────────────────────────────────
                    if (string.IsNullOrWhiteSpace(col0))
                        return StrictExcelValidationResult.Failure(rowIndex, "Column 0 (Date)",
                            "Date is missing.");

                    if (!DateTime.TryParseExact(col0, "dd/MM/yyyy", FrenchCulture,
                            DateTimeStyles.None, out DateTime validDate))
                    {
                        return StrictExcelValidationResult.Failure(rowIndex, "Column 0 (Date)",
                            $"Invalid Date '{col0}'. Expected dd/MM/yyyy.");
                    }

                    // ───────────────────────────────────────────
                    // Index 1: Client Name — e.g. "Laboratoire Biostyle"
                    // ───────────────────────────────────────────
                    string clientName = row.ContainsKey(1) ? row[1]?.ToString() : "";
                    if (string.IsNullOrWhiteSpace(clientName))
                        clientName = "Unknown";

                    // ───────────────────────────────────────────
                    // Index 2: Amount Paid — e.g. "13 017,00"
                    // If empty (like ";;" in CSV), treat as 0 — NOT an error.
                    // ───────────────────────────────────────────
                    decimal validAmount = 0;
                    string amountStr = row.ContainsKey(2) ? row[2]?.ToString() : "";

                    if (!string.IsNullOrWhiteSpace(amountStr))
                    {
                        // CRITICAL: Remove ALL whitespace (Space, NBSP \u00A0, etc.) in one Regex pass
                        amountStr = Regex.Replace(amountStr, @"[\s\u00A0]+", "");

                        if (!decimal.TryParse(amountStr, NumberStyles.Number, FrenchCulture, out validAmount))
                        {
                            return StrictExcelValidationResult.Failure(rowIndex, "Column 2 (Amount)",
                                $"Invalid Amount '{row[2]}'.");
                        }
                    }
                    // else: validAmount stays 0 (empty amount like ";;" is OK)

                    // ───────────────────────────────────────────
                    // Index 3: Currency — optional, defaults "TND"
                    // ───────────────────────────────────────────
                    string currency = row.ContainsKey(3) ? row[3]?.ToString() : "TND";
                    if (string.IsNullOrWhiteSpace(currency))
                        currency = "TND";

                    // ───────────────────────────────────────────
                    // Index 4: Payment Method — optional, defaults "Unknown"
                    // ───────────────────────────────────────────
                    string paymentMethod = row.ContainsKey(4) ? row[4]?.ToString() : "Unknown";
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
    }
}
