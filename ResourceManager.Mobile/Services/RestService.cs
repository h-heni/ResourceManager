using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace ResourceManager.Mobile.Services;

public class RestService
{
    private readonly HttpClient _client;
    // For Android Emulator -> Localhost is 10.0.2.2
    // For Windows -> Localhost is localhost
    // We'll use a helper to detect platform or just use a generic BaseAddress and let user override
    private const string DefaultUrl = "http://localhost:5276/api/"; 

    public RestService(string baseUrl = DefaultUrl)
    {
        _client = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = TimeSpan.FromSeconds(120) // OCR processing can take time
        };
    }

    public void SetAuthToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<AuthResponse?> LoginAsync(string email, string password)
    {
        try
        {
            var response = await _client.PostAsJsonAsync("auth/login", new { Email = email, Password = password });
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<AuthResponse>();
            }
        }
        catch (Exception ex)
        {
             // Log error
             System.Diagnostics.Debug.WriteLine(ex.Message);
        }
        return null;
    }

    public async Task<List<InvoiceDTO>?> GetInvoicesAsync()
    {
        try
        {
             return await _client.GetFromJsonAsync<List<InvoiceDTO>>("invoices?page=1&size=10");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(ex.Message);
            return new List<InvoiceDTO>();
        }
    }
    
    public async Task<DashboardSummary?> GetDashboardSummaryAsync()
    {
         try
        {
             return await _client.GetFromJsonAsync<DashboardSummary>("dashboard/summary");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(ex.Message);
            return null;
        }
    }

    /// <summary>
    /// Upload a preprocessed invoice image to the backend for OCR extraction.
    /// Sends as multipart/form-data to /SupplierInvoices/upload.
    /// </summary>
    public async Task<SupplierExtractionResult?> UploadSupplierInvoiceAsync(byte[] imageData, string fileName)
    {
        try
        {
            using var content = new MultipartFormDataContent();
            using var fileContent = new ByteArrayContent(imageData);
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
            content.Add(fileContent, "file", fileName);

            var response = await _client.PostAsync("SupplierInvoices/upload", content);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<SupplierExtractionResult>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            else
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"Upload failed ({response.StatusCode}): {errorBody}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Upload error: {ex.Message}");
        }
        return null;
    }

    /// <summary>
    /// Get the list of supplier invoices.
    /// </summary>
    public async Task<List<SupplierInvoiceDTO>?> GetSupplierInvoicesAsync()
    {
        try
        {
            return await _client.GetFromJsonAsync<List<SupplierInvoiceDTO>>("SupplierInvoices");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(ex.Message);
            return new List<SupplierInvoiceDTO>();
        }
    }
}

public class AuthResponse
{
    public string Token { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public object? User { get; set; }
}

public class InvoiceDTO 
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string ClientName { get; set; } = "";
    public string Amount { get; set; } = "";
    public DateTime Date { get; set; }
}

public class DashboardSummary
{
    public decimal TotalRevenue { get; set; }
    public int UnpaidCount { get; set; }
}

/// <summary>
/// Represents the OCR extraction result from the backend.
/// </summary>
public class SupplierExtractionResult
{
    public string? FournisseurName { get; set; }
    public string? FournisseurEmail { get; set; }
    public string? FournisseurPhone { get; set; }
    public string? FournisseurAddress { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? InvoiceDate { get; set; }
    public string? DueDate { get; set; }
    public string? TaxId { get; set; }
    public string? Currency { get; set; }
    public decimal TotalTTC { get; set; }
    public decimal TotalHT { get; set; }
    public decimal TVA { get; set; }
    public double ConfidenceScore { get; set; }
    public string? TempFilePath { get; set; }
    public string? RawText { get; set; }
    public int ItemCount { get; set; }
    public List<ExtractedLineItem>? Items { get; set; }
}

public class ExtractedLineItem
{
    public string Description { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalHT { get; set; }
    public decimal TaxRate { get; set; }
}

public class SupplierInvoiceDTO
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = "";
    public string FournisseurName { get; set; } = "";
    public decimal TotalTTC { get; set; }
    public string? InvoiceDate { get; set; }
    public string? PaymentStatus { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal RemainingAmount { get; set; }
}
