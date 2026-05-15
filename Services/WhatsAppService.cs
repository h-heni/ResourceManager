using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;

namespace ResourceManager.Services
{
    public interface IWhatsAppService
    {
        /// <summary>
        /// Send an invoice message with PDF attachment via WhatsApp Cloud API
        /// </summary>
        Task<WhatsAppSendResponse> SendInvoiceMessageAsync(Invoice invoice, Client client, string pdfUrl, string? customMessage = null);

        /// <summary>
        /// Send a payment reminder message via WhatsApp Cloud API
        /// </summary>
        Task<WhatsAppSendResponse> SendPaymentReminderAsync(Invoice invoice, Client client, string pdfUrl);

        /// <summary>
        /// Send a text-only message via WhatsApp Cloud API
        /// </summary>
        Task<WhatsAppSendResponse> SendTextMessageAsync(string phoneNumber, string message);

        /// <summary>
        /// Send a generic document (PDF) via WhatsApp Cloud API
        /// </summary>
        Task<WhatsAppSendResponse> SendDocumentMessageAsync(string phoneNumber, string pdfUrl, string fileName, string? customMessage = null);

        /// <summary>
        /// Exchange Embedded Signup code for permanent credentials and save them
        /// </summary>
        Task<EmbeddedSignupResult> ExchangeEmbeddedSignupCodeAsync(string code, int companyId);
    }

    public class WhatsAppService : IWhatsAppService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<WhatsAppService> _logger;
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public WhatsAppService(HttpClient httpClient, IConfiguration configuration, ILogger<WhatsAppService> logger, AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private async Task<CompanySettings?> GetCompanySettingsAsync()
        {
            var companyIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("CompanyId")?.Value;
            if (string.IsNullOrEmpty(companyIdClaim) || !int.TryParse(companyIdClaim, out var companyId))
                return null;

            return await _context.CompanySettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CompanyId == companyId);
        }

        public async Task<WhatsAppSendResponse> SendInvoiceMessageAsync(Invoice invoice, Client client, string pdfUrl, string? customMessage = null)
        {
            if (string.IsNullOrEmpty(client.Phone))
                throw new ArgumentException("Client phone number is required for WhatsApp messaging");

            var phoneNumber = NormalizePhoneNumber(client.Phone);
            var message = customMessage ?? GenerateInvoiceMessage(invoice, client);
            message = AppendPromoFooter(message);

            // Send the PDF document first
            var docResult = await SendDocumentAsync(phoneNumber, pdfUrl, $"Invoice-{invoice.Number}.pdf", message);

            return docResult;
        }

        public async Task<WhatsAppSendResponse> SendPaymentReminderAsync(Invoice invoice, Client client, string pdfUrl)
        {
            if (string.IsNullOrEmpty(client.Phone))
                throw new ArgumentException("Client phone number is required for WhatsApp messaging");

            var phoneNumber = NormalizePhoneNumber(client.Phone);
            var message = GeneratePaymentReminderMessage(invoice, client);
            message = AppendPromoFooter(message);

            var docResult = await SendDocumentAsync(phoneNumber, pdfUrl, $"Invoice-{invoice.Number}.pdf", message);

            return docResult;
        }

        public async Task<WhatsAppSendResponse> SendTextMessageAsync(string phoneNumber, string message)
        {
            if (string.IsNullOrEmpty(phoneNumber))
                throw new ArgumentException("Phone number is required");

            var normalized = NormalizePhoneNumber(phoneNumber);
            message = AppendPromoFooter(message);

            return await SendTextAsync(normalized, message);
        }

        public async Task<WhatsAppSendResponse> SendDocumentMessageAsync(string phoneNumber, string pdfUrl, string fileName, string? customMessage = null)
        {
            if (string.IsNullOrEmpty(phoneNumber))
                throw new ArgumentException("Phone number is required");

            var normalized = NormalizePhoneNumber(phoneNumber);
            var message = customMessage ?? $"Please find the attached document: {fileName}";
            message = AppendPromoFooter(message);

            return await SendDocumentAsync(normalized, pdfUrl, fileName, message);
        }

        public async Task<EmbeddedSignupResult> ExchangeEmbeddedSignupCodeAsync(string code, int companyId)
        {
            var appId = _configuration["WhatsApp:MetaAppId"];
            var appSecret = _configuration["WhatsApp:MetaAppSecret"];
            var apiVersion = _configuration["WhatsApp:ApiVersion"] ?? "v21.0";

            _logger.LogInformation("[WA-DEBUG] ExchangeEmbeddedSignupCodeAsync start — companyId={CompanyId} apiVersion={ApiVersion} codeLen={CodeLen}",
                companyId, apiVersion, code?.Length ?? 0);

            if (string.IsNullOrEmpty(appId) || string.IsNullOrEmpty(appSecret))
            {
                _logger.LogError("[WA-DEBUG] MetaAppId or MetaAppSecret is missing from configuration");
                throw new InvalidOperationException("WhatsApp MetaAppId and MetaAppSecret must be configured on the server.");
            }

            // Step 1: Exchange authorization code for a short-lived user token
            var tokenUrl = $"https://graph.facebook.com/{apiVersion}/oauth/access_token" +
                $"?client_id={Uri.EscapeDataString(appId)}" +
                $"&client_secret={Uri.EscapeDataString(appSecret)}" +
                $"&code={Uri.EscapeDataString(code)}";

            _logger.LogInformation("[WA-DEBUG] Step 1: POST token exchange to {Url}", tokenUrl.Replace(appSecret, "***").Replace(code, "***"));
            var tokenRes = await _httpClient.GetAsync(tokenUrl);
            var tokenBody = await tokenRes.Content.ReadAsStringAsync();
            _logger.LogInformation("[WA-DEBUG] Step 1 response: HTTP {Status} | Body: {Body}", (int)tokenRes.StatusCode, tokenBody);

            if (!tokenRes.IsSuccessStatusCode)
            {
                _logger.LogError("[WA-DEBUG] Step 1 FAILED — Meta token exchange: {Body}", tokenBody);
                return new EmbeddedSignupResult { Success = false, Error = "Failed to exchange authorization code. Please try again." };
            }

            var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenBody);
            var userAccessToken = tokenData.GetProperty("access_token").GetString()!;
            _logger.LogInformation("[WA-DEBUG] Step 1 OK — user access token obtained (length={Len})", userAccessToken.Length);

            // Step 2: Get shared WABA info from the user's business integrations
            var sharedWabaUrl = $"https://graph.facebook.com/{apiVersion}/debug_token?input_token={Uri.EscapeDataString(userAccessToken)}";
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", $"{appId}|{appSecret}");
            _logger.LogInformation("[WA-DEBUG] Step 2: debug_token call");
            var debugRes = await _httpClient.GetAsync(sharedWabaUrl);
            var debugBody = await debugRes.Content.ReadAsStringAsync();
            _httpClient.DefaultRequestHeaders.Authorization = null;
            _logger.LogInformation("[WA-DEBUG] Step 2 debug_token HTTP {Status} | Body: {Body}", (int)debugRes.StatusCode, debugBody);

            // Step 3: List WABAs shared with the app via Business Management API
            var wabaListUrl = $"https://graph.facebook.com/{apiVersion}/{appId}/message_template_previews".Replace("message_template_previews", "");
            // Actually use the Shared WABA endpoint:
            var sharedWabasUrl = $"https://graph.facebook.com/{apiVersion}/{appId}/subscribed_apps".Replace("subscribed_apps", "");

            // Use the user token to get their business list and find WABAs
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userAccessToken);

            // Get the WhatsApp Business Account(s) associated with this user
            var businessUrl = $"https://graph.facebook.com/{apiVersion}/me/businesses?fields=id,name";
            _logger.LogInformation("[WA-DEBUG] Step 3a: GET {Url}", businessUrl);
            var bizRes = await _httpClient.GetAsync(businessUrl);
            var bizBody = await bizRes.Content.ReadAsStringAsync();
            _logger.LogInformation("[WA-DEBUG] Step 3a businesses HTTP {Status} | Body: {Body}", (int)bizRes.StatusCode, bizBody);

            // Find WABAs via the Business Management API - list all WABAs the user has access to
            string? wabaId = null;
            string? phoneNumberId = null;
            string? displayPhone = null;

            // Try direct approach: list WhatsApp Business Accounts accessible by the user
            var wabasUrl = $"https://graph.facebook.com/{apiVersion}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{{id,display_phone_number,verified_name}}";
            _logger.LogInformation("[WA-DEBUG] Step 3b: GET {Url}", wabasUrl);
            var wabasRes = await _httpClient.GetAsync(wabasUrl);
            var wabasBody = await wabasRes.Content.ReadAsStringAsync();
            _logger.LogInformation("[WA-DEBUG] Step 3b WABAs HTTP {Status} | Body: {Body}", (int)wabasRes.StatusCode, wabasBody);

            if (wabasRes.IsSuccessStatusCode)
            {
                var wabasData = JsonSerializer.Deserialize<JsonElement>(wabasBody);
                if (wabasData.TryGetProperty("data", out var wabaArray) && wabaArray.GetArrayLength() > 0)
                {
                    // Take the first (most recently shared) WABA
                    var waba = wabaArray[0];
                    wabaId = waba.GetProperty("id").GetString();

                    // Get the phone number from nested data
                    if (waba.TryGetProperty("phone_numbers", out var phones) &&
                        phones.TryGetProperty("data", out var phoneArray) &&
                        phoneArray.GetArrayLength() > 0)
                    {
                        var phone = phoneArray[0];
                        phoneNumberId = phone.GetProperty("id").GetString();
                        displayPhone = phone.TryGetProperty("display_phone_number", out var dp) ? dp.GetString() : null;
                    }
                }
            }

            _logger.LogInformation("[WA-DEBUG] Step 3b result — wabaId={WabaId} phoneNumberId={PhoneId} displayPhone={Phone}", wabaId, phoneNumberId, displayPhone);

            if (string.IsNullOrEmpty(wabaId))
            {
                _logger.LogError("[WA-DEBUG] Step 3b FAILED — no WABA found in response. Full body was: {Body}", wabasBody);
                _httpClient.DefaultRequestHeaders.Authorization = null;
                return new EmbeddedSignupResult { Success = false, Error = "No WhatsApp Business Account found. Please complete the signup process." };
            }

            // Step 4: Subscribe the app to the WABA for webhooks
            var subscribeUrl = $"https://graph.facebook.com/{apiVersion}/{wabaId}/subscribed_apps";
            _logger.LogInformation("[WA-DEBUG] Step 4: subscribing app to WABA {WabaId}", wabaId);
            var subscribeRes = await _httpClient.PostAsync(subscribeUrl, null);
            var subBody2 = await subscribeRes.Content.ReadAsStringAsync();
            _logger.LogInformation("[WA-DEBUG] Step 4 subscribe HTTP {Status} | Body: {Body}", (int)subscribeRes.StatusCode, subBody2);
            if (!subscribeRes.IsSuccessStatusCode)
                _logger.LogWarning("[WA-DEBUG] Step 4 FAILED to subscribe app to WABA: {Body}", subBody2);

            // Step 5: Generate a System User Access Token (long-lived) for the WABA
            // For embedded signup, the user token can be exchanged for a long-lived token
            var longLivedUrl = $"https://graph.facebook.com/{apiVersion}/oauth/access_token" +
                $"?grant_type=fb_exchange_token" +
                $"&client_id={Uri.EscapeDataString(appId)}" +
                $"&client_secret={Uri.EscapeDataString(appSecret)}" +
                $"&fb_exchange_token={Uri.EscapeDataString(userAccessToken)}";

            _httpClient.DefaultRequestHeaders.Authorization = null;
            _logger.LogInformation("[WA-DEBUG] Step 5: long-lived token exchange");
            var llRes = await _httpClient.GetAsync(longLivedUrl);
            var llBody = await llRes.Content.ReadAsStringAsync();
            _logger.LogInformation("[WA-DEBUG] Step 5 HTTP {Status} | Body: {Body}", (int)llRes.StatusCode, llBody);

            string permanentToken;
            if (llRes.IsSuccessStatusCode)
            {
                var llData = JsonSerializer.Deserialize<JsonElement>(llBody);
                permanentToken = llData.GetProperty("access_token").GetString()!;
                _logger.LogInformation("[WA-DEBUG] Step 5 OK — long-lived token obtained (length={Len})", permanentToken.Length);
            }
            else
            {
                _logger.LogWarning("[WA-DEBUG] Step 5 FAILED — using short-lived token. Body: {Body}", llBody);
                permanentToken = userAccessToken;
            }

            // If we still don't have a phone number ID, fetch it from the WABA
            if (string.IsNullOrEmpty(phoneNumberId))
            {
                _logger.LogInformation("[WA-DEBUG] Step 5b: no phoneNumberId yet, fetching from WABA {WabaId}", wabaId);
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", permanentToken);
                var phonesUrl = $"https://graph.facebook.com/{apiVersion}/{wabaId}/phone_numbers?fields=id,display_phone_number,verified_name";
                var phonesRes = await _httpClient.GetAsync(phonesUrl);
                var phonesBody = await phonesRes.Content.ReadAsStringAsync();
                _logger.LogInformation("[WA-DEBUG] Step 5b phone_numbers HTTP {Status} | Body: {Body}", (int)phonesRes.StatusCode, phonesBody);

                if (phonesRes.IsSuccessStatusCode)
                {
                    var phonesData = JsonSerializer.Deserialize<JsonElement>(phonesBody);
                    if (phonesData.TryGetProperty("data", out var phoneArr) && phoneArr.GetArrayLength() > 0)
                    {
                        phoneNumberId = phoneArr[0].GetProperty("id").GetString();
                        displayPhone = phoneArr[0].TryGetProperty("display_phone_number", out var dp) ? dp.GetString() : null;
                    }
                }
                _httpClient.DefaultRequestHeaders.Authorization = null;
            }

            if (string.IsNullOrEmpty(phoneNumberId))
            {
                _logger.LogError("[WA-DEBUG] Step 5b FAILED — still no phoneNumberId after WABA phone_numbers call");
                return new EmbeddedSignupResult { Success = false, Error = "WhatsApp Business Account was linked but no phone number was registered. Please add a phone number in Meta Business Suite." };
            }

            _logger.LogInformation("[WA-DEBUG] Step 6: saving credentials — wabaId={WabaId} phoneNumberId={PhoneId} displayPhone={Phone}", wabaId, phoneNumberId, displayPhone);
            // Step 6: Save credentials to company settings
            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == companyId);

            if (settings == null)
            {
                return new EmbeddedSignupResult { Success = false, Error = "Company settings not found." };
            }

            settings.WhatsAppPhoneNumberId = phoneNumberId;
            settings.WhatsAppAccessToken = permanentToken;
            settings.WhatsAppBusinessAccountId = wabaId;
            settings.WhatsAppDisplayPhone = displayPhone;
            settings.WhatsAppEnabled = true;

            await _context.SaveChangesAsync();

            _logger.LogInformation("WhatsApp Embedded Signup completed for Company {CompanyId}: WABA={WabaId}, Phone={PhoneNumberId}", companyId, wabaId, phoneNumberId);

            return new EmbeddedSignupResult
            {
                Success = true,
                PhoneNumberId = phoneNumberId,
                BusinessAccountId = wabaId,
                DisplayPhone = displayPhone
            };
        }

        private async Task<WhatsAppSendResponse> SendDocumentAsync(string to, string documentUrl, string filename, string caption)
        {
            var cs = await GetCompanySettingsAsync();
            var phoneNumberId = cs?.WhatsAppPhoneNumberId ?? _configuration["WhatsApp:PhoneNumberId"];
            var apiVersion = _configuration["WhatsApp:ApiVersion"] ?? "v21.0";

            var payload = new
            {
                messaging_product = "whatsapp",
                to,
                type = "document",
                document = new
                {
                    link = documentUrl,
                    filename,
                    caption
                }
            };

            var accessToken = cs?.WhatsAppAccessToken ?? _configuration["WhatsApp:AccessToken"];
            return await CallWhatsAppApiAsync($"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages", payload, accessToken);
        }

        private async Task<WhatsAppSendResponse> SendTextAsync(string to, string text)
        {
            var cs = await GetCompanySettingsAsync();
            var phoneNumberId = cs?.WhatsAppPhoneNumberId ?? _configuration["WhatsApp:PhoneNumberId"];
            var apiVersion = _configuration["WhatsApp:ApiVersion"] ?? "v21.0";

            var payload = new
            {
                messaging_product = "whatsapp",
                to,
                type = "text",
                text = new { body = text }
            };

            var accessToken = cs?.WhatsAppAccessToken ?? _configuration["WhatsApp:AccessToken"];
            return await CallWhatsAppApiAsync($"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages", payload, accessToken);
        }

        private async Task<WhatsAppSendResponse> CallWhatsAppApiAsync(string url, object payload, string? accessToken)
        {
            if (string.IsNullOrEmpty(accessToken))
                throw new InvalidOperationException("WhatsApp access token is not configured. Please configure it in Settings → WhatsApp.");

            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull });
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("WhatsApp API error: {StatusCode} - {Body}", response.StatusCode, responseBody);
                var errorResponse = JsonSerializer.Deserialize<WhatsAppApiErrorWrapper>(responseBody, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                return new WhatsAppSendResponse
                {
                    Success = false,
                    Error = errorResponse?.Error?.Message ?? $"WhatsApp API error: {response.StatusCode}"
                };
            }

            var apiResponse = JsonSerializer.Deserialize<WhatsAppApiResponse>(responseBody, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            _logger.LogInformation("WhatsApp message sent successfully. MessageId: {MessageId}", apiResponse?.Messages?.FirstOrDefault()?.Id);

            return new WhatsAppSendResponse
            {
                Success = true,
                MessageId = apiResponse?.Messages?.FirstOrDefault()?.Id ?? "",
                PhoneNumber = apiResponse?.Contacts?.FirstOrDefault()?.Input ?? ""
            };
        }

        private string NormalizePhoneNumber(string phone)
        {
            var cleaned = System.Text.RegularExpressions.Regex.Replace(phone, @"[^\d]", "");
            if (string.IsNullOrEmpty(cleaned))
                throw new ArgumentException("Phone number must contain at least one digit");

            var defaultCountryCode = _configuration["WhatsApp:DefaultCountryCode"] ?? "1";
            if (cleaned.Length <= 10 && !cleaned.StartsWith(defaultCountryCode))
                cleaned = defaultCountryCode + cleaned;

            return cleaned;
        }

        private string AppendPromoFooter(string message)
        {
            var websiteUrl = _configuration["WhatsApp:WebsiteUrl"] ?? "https://rscmanager.com";
            return message + $"\n\n---\n📨 Sent via RSC Manager — {websiteUrl}";
        }

        private string GenerateInvoiceMessage(Invoice invoice, Client client)
        {
            var companyName = _configuration["CompanySettings:Name"] ?? "Our Company";
            var dueDateString = invoice.DueDate.HasValue
                ? invoice.DueDate.Value.ToString("yyyy-MM-dd")
                : "N/A";

            return $@"Dear {client.Name},

Please find attached invoice #{invoice.Number} from {companyName}.

📄 Invoice Details:
• Invoice Number: {invoice.Number}
• Date: {invoice.Date:yyyy-MM-dd}
• Due Date: {dueDateString}
• Total Amount: {invoice.TotalAmount:C}

Thank you for your business!";
        }

        private string GeneratePaymentReminderMessage(Invoice invoice, Client client)
        {
            var companyName = _configuration["CompanySettings:Name"] ?? "Our Company";
            var daysOverdue = invoice.IsOverdue ? invoice.DaysOverdue : 0;
            var daysUntilDue = invoice.DaysUntilDue;

            string greeting;
            if (invoice.Status == "Paid")
                greeting = "Thank you for your payment!";
            else if (invoice.IsOverdue)
                greeting = $"This is a friendly reminder that invoice #{invoice.Number} is {daysOverdue} days overdue.";
            else if (daysUntilDue.HasValue && daysUntilDue <= 3)
                greeting = $"This is a friendly reminder that invoice #{invoice.Number} is due in {daysUntilDue} day{(daysUntilDue > 1 ? "s" : "")}.";
            else
                greeting = $"This is a friendly reminder about invoice #{invoice.Number}.";

            return $@"Dear {client.Name},

{greeting}

📄 Invoice Details:
• Invoice Number: {invoice.Number}
• Total Amount: {invoice.TotalAmount:C}
• Amount Paid: {invoice.AmountPaid:C}
• Remaining: {invoice.RemainingAmount:C}

Please let us know if you have any questions.

Thank you,
{companyName}";
        }
    }

    // Internal classes for deserializing Meta API responses
    public class WhatsAppApiResponse
    {
        [JsonPropertyName("messaging_product")]
        public string? MessagingProduct { get; set; }
        [JsonPropertyName("contacts")]
        public List<WhatsAppContact>? Contacts { get; set; }
        [JsonPropertyName("messages")]
        public List<WhatsAppMessageInfo>? Messages { get; set; }
    }

    public class WhatsAppContact
    {
        [JsonPropertyName("input")]
        public string? Input { get; set; }
        [JsonPropertyName("wa_id")]
        public string? WaId { get; set; }
    }

    public class WhatsAppMessageInfo
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }
        [JsonPropertyName("message_status")]
        public string? MessageStatus { get; set; }
    }

    public class WhatsAppApiErrorWrapper
    {
        [JsonPropertyName("error")]
        public WhatsAppApiError? Error { get; set; }
    }

    public class WhatsAppApiError
    {
        [JsonPropertyName("message")]
        public string? Message { get; set; }
        [JsonPropertyName("type")]
        public string? Type { get; set; }
        [JsonPropertyName("code")]
        public int Code { get; set; }
        [JsonPropertyName("fbtrace_id")]
        public string? FbTraceId { get; set; }
    }

    public class EmbeddedSignupResult
    {
        public bool Success { get; set; }
        public string? PhoneNumberId { get; set; }
        public string? BusinessAccountId { get; set; }
        public string? DisplayPhone { get; set; }
        public string? Error { get; set; }
    }
}
