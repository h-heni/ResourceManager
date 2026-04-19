using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ResourceManager.Services
{
    /// <summary>
    /// Extracts structured invoice data from an image using Groq's vision LLM
    /// (Llama 4 Scout — free tier, globally available).
    /// Returns null when the API key is missing or the call fails — the
    /// caller is expected to fall back to OCR-based extraction.
    /// </summary>
    public interface IGeminiInvoiceExtractor
    {
        bool IsConfigured { get; }
        Task<SupplierExtractedData?> ExtractAsync(byte[] imageBytes, string mimeType, CancellationToken cancellationToken = default);
        Task<SupplierExtractedData?> ExtractFromTextAsync(string rawText, CancellationToken cancellationToken = default);
    }

    public class GeminiInvoiceExtractor : IGeminiInvoiceExtractor
    {
        private const string GroqEndpoint = "https://api.groq.com/openai/v1/chat/completions";

        private readonly HttpClient _httpClient;
        private readonly ILogger<GeminiInvoiceExtractor> _logger;
        private readonly string? _apiKey;
        private readonly string _model;

        private const string ExtractionPrompt =
            "You are an invoice data extraction engine. Analyze the attached invoice image " +
            "and return ONLY a valid JSON object with these exact fields: " +
            "supplierName (string — the company or person ISSUING/SELLING, i.e. the vendor whose name appears in the header or letterhead of the invoice, NOT the buyer or recipient), " +
            "email (string), phone (string), address (string — supplier address), " +
            "invoiceNumber (string), invoiceDate (string ISO 8601 yyyy-MM-dd, date only no time), " +
            "dueDate (string ISO 8601 yyyy-MM-dd, date only no time, or null), taxId (string), " +
            "currency (3-letter ISO code e.g. EUR TND USD), " +
            "totalHT (number, subtotal before tax), totalTTC (number, grand total with tax), " +
            "tva (number, total tax amount), " +
            "lineItems (array of objects each with: description, quantity, unitPrice, taxRate, totalHT). " +
            "Use null for any field not visible. Decimal separator must be a dot. " +
            "Do not invent values. Return only JSON, no markdown, no explanation.";

        public GeminiInvoiceExtractor(HttpClient httpClient, IConfiguration configuration, ILogger<GeminiInvoiceExtractor> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiKey = configuration["Groq:ApiKey"];
            _model = configuration["Groq:Model"] ?? "meta-llama/llama-4-scout-17b-16e-instruct";
            _httpClient.Timeout = TimeSpan.FromSeconds(60);
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        public async Task<SupplierExtractedData?> ExtractAsync(byte[] imageBytes, string mimeType, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                _logger.LogDebug("Groq API key not configured — skipping vision extraction.");
                return null;
            }

            if (imageBytes.Length > 18 * 1024 * 1024)
            {
                _logger.LogWarning("Image is {Mb} MB — too large for inline upload. Skipping.", imageBytes.Length / 1024 / 1024);
                return null;
            }

            var dataUrl = $"data:{mimeType};base64,{Convert.ToBase64String(imageBytes)}";

            var requestBody = new
            {
                model = _model,
                temperature = 0.1,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "text", text = ExtractionPrompt },
                            new { type = "image_url", image_url = new { url = dataUrl } }
                        }
                    }
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, GroqEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = JsonContent.Create(requestBody);

            try
            {
                using var response = await _httpClient.SendAsync(request, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning("Groq API returned {Status}: {Body}", response.StatusCode, Truncate(body, 500));
                    return null;
                }

                var apiResult = await response.Content.ReadFromJsonAsync<GroqChatResponse>(cancellationToken: cancellationToken);
                var jsonText = apiResult?.Choices?.FirstOrDefault()?.Message?.Content;

                if (string.IsNullOrWhiteSpace(jsonText))
                {
                    _logger.LogWarning("Groq returned an empty response.");
                    return null;
                }

                jsonText = StripJsonFences(jsonText);

                var extracted = JsonSerializer.Deserialize<InvoicePayload>(jsonText, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.AllowNamedFloatingPointLiterals
                });

                if (extracted == null)
                {
                    _logger.LogWarning("Failed to deserialize Groq JSON payload.");
                    return null;
                }

                var data = MapToSupplierExtractedData(extracted);
                _logger.LogInformation(
                    "Groq extracted invoice: supplier='{Supplier}', number='{Number}', total={Total}, items={Items}",
                    data.SupplierName, data.InvoiceNumber, data.TotalTTC, data.LineItems.Count);
                return data;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Groq extraction failed.");
                return null;
            }
        }

        private const string TextExtractionPrompt =
            "You are an invoice data extraction engine. Analyze the following raw text extracted from a PDF invoice " +
            "and return ONLY a valid JSON object with these exact fields: " +
            "supplierName (string — the company or person ISSUING/SELLING, i.e. the vendor whose name appears in the header or letterhead of the invoice, NOT the buyer or recipient), " +
            "email (string), phone (string), address (string — supplier address), " +
            "invoiceNumber (string), invoiceDate (string ISO 8601 yyyy-MM-dd, date only no time), " +
            "dueDate (string ISO 8601 yyyy-MM-dd, date only no time, or null), taxId (string), " +
            "currency (3-letter ISO code e.g. EUR TND USD), " +
            "totalHT (number, subtotal before tax), totalTTC (number, grand total with tax), " +
            "tva (number, total tax amount), " +
            "lineItems (array of objects each with: description, quantity, unitPrice, taxRate, totalHT). " +
            "Use null for any field not visible. Decimal separator must be a dot. " +
            "Do not invent values. Return only JSON, no markdown, no explanation.";

        public async Task<SupplierExtractedData?> ExtractFromTextAsync(string rawText, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                _logger.LogDebug("Groq API key not configured — skipping text extraction.");
                return null;
            }

            if (string.IsNullOrWhiteSpace(rawText))
            {
                _logger.LogDebug("No raw text provided — skipping Groq text extraction.");
                return null;
            }

            // Truncate very long text to avoid token limits
            var truncatedText = rawText.Length > 12000 ? rawText[..12000] : rawText;

            var requestBody = new
            {
                model = _model,
                temperature = 0.1,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = TextExtractionPrompt + "\n\n--- INVOICE TEXT ---\n" + truncatedText
                    }
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, GroqEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = JsonContent.Create(requestBody);

            try
            {
                using var response = await _httpClient.SendAsync(request, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning("Groq text API returned {Status}: {Body}", response.StatusCode, Truncate(body, 500));
                    return null;
                }

                var apiResult = await response.Content.ReadFromJsonAsync<GroqChatResponse>(cancellationToken: cancellationToken);
                var jsonText = apiResult?.Choices?.FirstOrDefault()?.Message?.Content;

                if (string.IsNullOrWhiteSpace(jsonText))
                {
                    _logger.LogWarning("Groq text extraction returned an empty response.");
                    return null;
                }

                jsonText = StripJsonFences(jsonText);

                var extracted = JsonSerializer.Deserialize<InvoicePayload>(jsonText, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.AllowNamedFloatingPointLiterals
                });

                if (extracted == null)
                {
                    _logger.LogWarning("Failed to deserialize Groq text JSON payload.");
                    return null;
                }

                var data = MapToSupplierExtractedData(extracted);
                _logger.LogInformation(
                    "Groq text-based extraction succeeded: supplier='{Supplier}', number='{Number}', total={Total}, items={Items}",
                    data.SupplierName, data.InvoiceNumber, data.TotalTTC, data.LineItems.Count);
                return data;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Groq text-based extraction failed.");
                return null;
            }
        }

        private static string StripJsonFences(string text)
        {
            text = text.Trim();
            if (text.StartsWith("```"))
            {
                var firstNewline = text.IndexOf('\n');
                if (firstNewline > 0) text = text[(firstNewline + 1)..];
                if (text.EndsWith("```")) text = text[..^3];
            }
            return text.Trim();
        }

        private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "...";

        private static SupplierExtractedData MapToSupplierExtractedData(InvoicePayload p)
        {
            return new SupplierExtractedData
            {
                SupplierName = NullIfEmpty(p.SupplierName),
                Email = NullIfEmpty(p.Email),
                Phone = NullIfEmpty(p.Phone),
                Address = NullIfEmpty(p.Address),
                InvoiceNumber = NullIfEmpty(p.InvoiceNumber),
                InvoiceDate = ParseDate(p.InvoiceDate),
                DueDate = ParseDate(p.DueDate),
                TaxId = NullIfEmpty(p.TaxId),
                Currency = NullIfEmpty(p.Currency),
                TotalHT = p.TotalHT,
                TotalTTC = p.TotalTTC,
                TVA = p.Tva,
                LineItems = (p.LineItems ?? new List<InvoiceLineItem>())
                    .Where(i => !string.IsNullOrWhiteSpace(i.Description))
                    .Select(i => new ExtractedLineItem
                    {
                        Description = i.Description!.Trim(),
                        Quantity = i.Quantity is > 0 ? (int)Math.Round(i.Quantity.Value) : 1,
                        UnitPrice = i.UnitPrice ?? 0m,
                        TaxRate = i.TaxRate,
                        TotalHT = i.TotalHT ?? ((i.UnitPrice ?? 0m) * (i.Quantity ?? 1m))
                    })
                    .ToList()
            };
        }

        private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        private static DateTime? ParseDate(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt))
                return dt.Date; // date only — strip time component
            return null;
        }

        // ─── Groq (OpenAI-compatible) response DTOs ────────────────────────────
        private sealed class GroqChatResponse
        {
            [JsonPropertyName("choices")] public List<GroqChoice>? Choices { get; set; }
        }
        private sealed class GroqChoice
        {
            [JsonPropertyName("message")] public GroqMessage? Message { get; set; }
        }
        private sealed class GroqMessage
        {
            [JsonPropertyName("content")] public string? Content { get; set; }
        }

        // ─── Extracted invoice payload ─────────────────────────────────────────
        private sealed class InvoicePayload
        {
            [JsonPropertyName("supplierName")] public string? SupplierName { get; set; }
            [JsonPropertyName("email")] public string? Email { get; set; }
            [JsonPropertyName("phone")] public string? Phone { get; set; }
            [JsonPropertyName("address")] public string? Address { get; set; }
            [JsonPropertyName("invoiceNumber")] public string? InvoiceNumber { get; set; }
            [JsonPropertyName("invoiceDate")] public string? InvoiceDate { get; set; }
            [JsonPropertyName("dueDate")] public string? DueDate { get; set; }
            [JsonPropertyName("taxId")] public string? TaxId { get; set; }
            [JsonPropertyName("currency")] public string? Currency { get; set; }
            [JsonPropertyName("totalHT")] public decimal? TotalHT { get; set; }
            [JsonPropertyName("totalTTC")] public decimal? TotalTTC { get; set; }
            [JsonPropertyName("tva")] public decimal? Tva { get; set; }
            [JsonPropertyName("lineItems")] public List<InvoiceLineItem>? LineItems { get; set; }
        }
        private sealed class InvoiceLineItem
        {
            [JsonPropertyName("description")] public string? Description { get; set; }
            [JsonPropertyName("quantity")] public decimal? Quantity { get; set; }
            [JsonPropertyName("unitPrice")] public decimal? UnitPrice { get; set; }
            [JsonPropertyName("taxRate")] public decimal? TaxRate { get; set; }
            [JsonPropertyName("totalHT")] public decimal? TotalHT { get; set; }
        }
    }
}
