using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using MimeKit;
using System.Text;

namespace ResourceManager.Services;

/// <summary>
/// OAuth-based email service for Gmail.
/// DOES NOT use App Passwords - uses proper OAuth 2.0 tokens.
/// </summary>
public interface IGmailOAuthService
{
    Task<EmailOAuthResult> SendEmailAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
    Task<EmailOAuthResult> SendEmailAsync(int companyId, string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null);
    Task<EmailOAuthStatus> GetConnectionStatusAsync(int companyId);
    Task<bool> TestConnectionAsync(int companyId);
    string GetAuthorizationUrl(int companyId, string redirectUri);
    Task<EmailOAuthResult> ExchangeCodeForTokenAsync(int companyId, string code, string redirectUri);
    Task<bool> DisconnectAsync(int companyId);
}

public class EmailOAuthResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorDetails { get; set; }
}

public class EmailOAuthStatus
{
    public bool IsConnected { get; set; }
    public string? ConnectedEmail { get; set; }
    public DateTime? ConnectedAt { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public bool NeedsReauth { get; set; }
    public string Provider { get; set; } = "Gmail";
}

public class GmailOAuthService : IGmailOAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GmailOAuthService> _logger;
    private readonly AppDbContext _context;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private const string ApplicationName = "Resource Manager";

    // Gmail API scopes - only request what we need
    private static readonly string[] Scopes = new[]
    {
        GmailService.Scope.GmailSend,
        GmailService.Scope.GmailReadonly // To get user email
    };

    public GmailOAuthService(
        IConfiguration configuration,
        ILogger<GmailOAuthService> logger,
        AppDbContext context)
    {
        _configuration = configuration;
        _logger = logger;
        _context = context;
        // Try GoogleOptions first (existing config), then fall back to Google section
        _clientId = configuration["GoogleOptions:ClientId"] ?? configuration["Google:ClientId"] ?? "";
        _clientSecret = configuration["GoogleOptions:ClientSecret"] ?? configuration["Google:ClientSecret"] ?? "";
    }

    /// <summary>
    /// Get OAuth authorization URL for user to consent
    /// </summary>
    public string GetAuthorizationUrl(int companyId, string redirectUri)
    {
        if (string.IsNullOrEmpty(_clientId) || string.IsNullOrEmpty(_clientSecret))
        {
            throw new InvalidOperationException("Google OAuth not configured. Set Google:ClientId and Google:ClientSecret in appsettings.json");
        }

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _clientId,
                ClientSecret = _clientSecret
            },
            Scopes = Scopes
        });

        // Include state parameter with company ID for security
        var state = Convert.ToBase64String(Encoding.UTF8.GetBytes($"company:{companyId}"));
        
        var uri = flow.CreateAuthorizationCodeRequest(redirectUri);
        uri.State = state;
        
        // Build the base authorization URL
        var authUrl = uri.Build();
        
        // FIX: Properly add OAuth parameters without duplication
        // The error "OAuth 2 parameters can only have a single value: access_type" 
        // occurs when access_type appears multiple times in the URL
        var uriBuilder = new UriBuilder(authUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uriBuilder.Query);
        
        // Set access_type and prompt - this ensures they're set exactly once
        // Remove any existing values first to prevent duplicates
        query.Remove("access_type");
        query.Remove("prompt");
        query["access_type"] = "offline";  // Required to get refresh token
        query["prompt"] = "consent";        // Force consent screen to ensure refresh token is issued
        
        uriBuilder.Query = query.ToString();
        var finalUrl = uriBuilder.ToString();
        
        // Log the redirect_uri that was embedded in the authorization URL
        var redirectUriInUrl = query["redirect_uri"];
        _logger.LogInformation(
            "Generated OAuth URL. redirect_uri in URL: '{RedirectUri}', InputRedirectUri: '{InputRedirectUri}'",
            redirectUriInUrl, redirectUri);
        
        return finalUrl;
    }

    /// <summary>
    /// Exchange authorization code for access/refresh tokens
    /// </summary>
    public async Task<EmailOAuthResult> ExchangeCodeForTokenAsync(int companyId, string code, string redirectUri)
    {
        try
        {
            _logger.LogInformation(
                "OAuth token exchange starting. CompanyId: {CompanyId}, RedirectUri: '{RedirectUri}', CodePrefix: '{CodePrefix}', ClientIdPrefix: '{ClientIdPrefix}'",
                companyId, redirectUri, code?.Substring(0, Math.Min(10, code?.Length ?? 0)) + "...", _clientId?.Substring(0, Math.Min(15, _clientId?.Length ?? 0)) + "...");
            
            if (string.IsNullOrEmpty(_clientId) || string.IsNullOrEmpty(_clientSecret))
            {
                _logger.LogError("OAuth failed: Google ClientId or ClientSecret is not configured");
                return new EmailOAuthResult
                {
                    Success = false,
                    Message = "Gmail OAuth not configured on the server.",
                    ErrorDetails = "Missing Google ClientId or ClientSecret in server configuration. Check appsettings.json GoogleOptions section."
                };
            }
            
            var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
            {
                ClientSecrets = new ClientSecrets
                {
                    ClientId = _clientId,
                    ClientSecret = _clientSecret
                },
                Scopes = Scopes
            });

            _logger.LogInformation("Calling Google token endpoint with redirect_uri='{RedirectUri}'", redirectUri);
            
            TokenResponse tokenResponse;
            try
            {
                tokenResponse = await flow.ExchangeCodeForTokenAsync(
                    "user",
                    code,
                    redirectUri,
                    CancellationToken.None);
                
                _logger.LogInformation(
                    "Token exchange succeeded. AccessToken present: {HasAccess}, RefreshToken present: {HasRefresh}, ExpiresIn: {ExpiresIn}s",
                    !string.IsNullOrEmpty(tokenResponse.AccessToken),
                    !string.IsNullOrEmpty(tokenResponse.RefreshToken),
                    tokenResponse.ExpiresInSeconds);
            }
            catch (TokenResponseException tokenEx)
            {
                _logger.LogError(tokenEx,
                    "Google token exchange FAILED. Error: '{Error}', Description: '{Description}', ErrorUri: '{ErrorUri}', RedirectUri used: '{RedirectUri}'",
                    tokenEx.Error?.Error, tokenEx.Error?.ErrorDescription, tokenEx.Error?.ErrorUri, redirectUri);
                
                var errorDetail = tokenEx.Error?.Error ?? "Unknown error";
                var errorDescription = tokenEx.Error?.ErrorDescription ?? tokenEx.Message;
                
                var userMessage = errorDetail switch
                {
                    "invalid_grant" => "Authorization code expired or already used. Please try connecting again.",
                    "redirect_uri_mismatch" => $"OAuth redirect URI mismatch. The redirect URI '{redirectUri}' does not match what is configured in Google Cloud Console. Go to Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID and add this exact URI as an Authorized redirect URI.",
                    "invalid_client" => "Invalid OAuth client configuration. Check Google API credentials in appsettings.json.",
                    "unauthorized_client" => "This client is not authorized. Verify the OAuth consent screen and client type in Google Cloud Console.",
                    _ => $"Google OAuth error: {errorDescription}"
                };
                
                return new EmailOAuthResult
                {
                    Success = false,
                    Message = userMessage,
                    ErrorDetails = $"{errorDetail}: {errorDescription}"
                };
            }

            // Get or create settings record
            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
            if (settings == null)
            {
                settings = new CompanySettings { CompanyId = companyId };
                _context.CompanySettings.Add(settings);
            }

            // CRITICAL: Verify Gmail API works BEFORE saving tokens
            // This prevents the "connected but not working" state
            string? userEmail = null;
            try
            {
                var credential = new UserCredential(flow, "user", tokenResponse);
                var gmailService = new GmailService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = ApplicationName
                });

                var profile = await gmailService.Users.GetProfile("me").ExecuteAsync();
                userEmail = profile.EmailAddress;
                _logger.LogInformation("Gmail API verified for company {CompanyId}, email: {Email}", companyId, userEmail);
            }
            catch (Google.GoogleApiException apiEx) when (apiEx.HttpStatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogWarning(apiEx, "Gmail API not enabled for company {CompanyId}. User must enable it in Google Cloud Console.", companyId);
                
                // CRITICAL: Do NOT save tokens if Gmail API is not enabled
                // This prevents showing "connected" when it's not actually functional
                // Clear any existing tokens to ensure clean state
                settings.GmailAccessToken = null;
                settings.GmailRefreshToken = null;
                settings.GmailTokenExpiry = null;
                settings.GmailConnectedEmail = null;
                settings.GmailConnectedAt = null;
                settings.GmailApiVerified = false;
                await _context.SaveChangesAsync();
                
                return new EmailOAuthResult
                {
                    Success = false,
                    Message = "Gmail API is not enabled in your Google Cloud project. Please enable it at: console.cloud.google.com/apis/library/gmail.googleapis.com",
                    ErrorDetails = "Enable Gmail API in Google Cloud Console, wait a few minutes, then try again."
                };
            }

            // Gmail API verified! Now save all the tokens
            settings.GmailAccessToken = tokenResponse.AccessToken;
            settings.GmailRefreshToken = tokenResponse.RefreshToken ?? settings.GmailRefreshToken; // Refresh token only sent on first auth
            settings.GmailTokenExpiry = tokenResponse.IssuedUtc.AddSeconds(tokenResponse.ExpiresInSeconds ?? 3600);
            settings.GmailConnectedEmail = userEmail;
            settings.GmailConnectedAt = DateTime.UtcNow;
            settings.GmailApiVerified = true; // Mark as verified - Gmail API call succeeded
            
            await _context.SaveChangesAsync();

            _logger.LogInformation("Gmail OAuth connected for company {CompanyId}, email: {Email}", companyId, userEmail);

            return new EmailOAuthResult
            {
                Success = true,
                Message = $"Successfully connected to {userEmail}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in OAuth flow for company {CompanyId}: {Message}", companyId, ex.Message);
            return new EmailOAuthResult
            {
                Success = false,
                Message = "Failed to connect Gmail. Please try again.",
                ErrorDetails = $"{ex.GetType().Name}: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Get current connection status
    /// CRITICAL: Only returns IsConnected=true if Gmail API was verified working
    /// </summary>
    public async Task<EmailOAuthStatus> GetConnectionStatusAsync(int companyId)
    {
        var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);

        // Not connected if: no settings, no refresh token, OR API not verified
        if (settings == null || 
            string.IsNullOrEmpty(settings.GmailRefreshToken) ||
            !settings.GmailApiVerified)
        {
            return new EmailOAuthStatus
            {
                IsConnected = false,
                NeedsReauth = false
            };
        }

        var needsReauth = settings.GmailTokenExpiry.HasValue && 
                          settings.GmailTokenExpiry.Value < DateTime.UtcNow &&
                          string.IsNullOrEmpty(settings.GmailRefreshToken);

        return new EmailOAuthStatus
        {
            IsConnected = true,
            ConnectedEmail = settings.GmailConnectedEmail,
            ConnectedAt = settings.GmailConnectedAt,
            TokenExpiresAt = settings.GmailTokenExpiry,
            NeedsReauth = needsReauth,
            Provider = "Gmail"
        };
    }

    /// <summary>
    /// Test the connection by getting user profile
    /// Updates GmailApiVerified based on result
    /// </summary>
    public async Task<bool> TestConnectionAsync(int companyId)
    {
        try
        {
            var gmailService = await GetGmailServiceAsync(companyId);
            if (gmailService == null) 
            {
                _logger.LogWarning("Gmail test: No Gmail service available for company {CompanyId}", companyId);
                return false;
            }

            var profile = await gmailService.Users.GetProfile("me").ExecuteAsync();
            var success = !string.IsNullOrEmpty(profile.EmailAddress);
            
            if (success)
            {
                // Update verified status on successful test
                var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
                if (settings != null && !settings.GmailApiVerified)
                {
                    settings.GmailApiVerified = true;
                    settings.GmailConnectedEmail = profile.EmailAddress;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Gmail API verified via test for company {CompanyId}, email: {Email}", companyId, profile.EmailAddress);
                }
            }
            
            return success;
        }
        catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            _logger.LogError(ex, "Gmail API not enabled for company {CompanyId}", companyId);
            
            // Mark as not verified
            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
            if (settings != null)
            {
                settings.GmailApiVerified = false;
                await _context.SaveChangesAsync();
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail connection test failed for company {CompanyId}", companyId);
            
            // Mark as not verified on any error
            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
            if (settings != null)
            {
                settings.GmailApiVerified = false;
                await _context.SaveChangesAsync();
            }
            return false;
        }
    }

    /// <summary>
    /// Disconnect Gmail (remove stored tokens)
    /// </summary>
    public async Task<bool> DisconnectAsync(int companyId)
    {
        var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
        if (settings == null) return true;

        settings.GmailAccessToken = null;
        settings.GmailRefreshToken = null;
        settings.GmailTokenExpiry = null;
        settings.GmailConnectedEmail = null;
        settings.GmailConnectedAt = null;
        settings.GmailApiVerified = false; // Clear verified status

        await _context.SaveChangesAsync();
        _logger.LogInformation("Gmail disconnected for company {CompanyId}", companyId);
        return true;
    }

    /// <summary>
    /// Send email using OAuth (no App Password needed!)
    /// </summary>
    public async Task<EmailOAuthResult> SendEmailAsync(string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null)
    {
        // Get company ID from current context - this would need to be passed in or resolved
        // For now, throw an error - the caller should use company-specific method
        throw new InvalidOperationException("Use SendEmailAsync with companyId parameter");
    }

    /// <summary>
    /// Send email for specific company using their OAuth tokens
    /// </summary>
    public async Task<EmailOAuthResult> SendEmailAsync(int companyId, string to, string subject, string htmlBody, byte[]? pdfAttachment = null, string? attachmentName = null)
    {
        try
        {
            // First check if Gmail is properly connected and verified
            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
            if (settings == null || !settings.GmailApiVerified || string.IsNullOrEmpty(settings.GmailRefreshToken))
            {
                _logger.LogWarning("Gmail send attempted but not properly connected for company {CompanyId}. Verified: {Verified}", 
                    companyId, settings?.GmailApiVerified);
                return new EmailOAuthResult
                {
                    Success = false,
                    Message = "Gmail not connected. Please connect your Gmail account first."
                };
            }
            
            var gmailService = await GetGmailServiceAsync(companyId);
            if (gmailService == null)
            {
                return new EmailOAuthResult
                {
                    Success = false,
                    Message = "Gmail not connected. Please connect your Gmail account first."
                };
            }

            var fromEmail = settings.GmailConnectedEmail ?? "noreply@example.com";

            // Build the email using MimeKit
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Resource Manager", fromEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            var builder = new BodyBuilder { HtmlBody = htmlBody };

            if (pdfAttachment != null && !string.IsNullOrEmpty(attachmentName))
            {
                builder.Attachments.Add(attachmentName, pdfAttachment, ContentType.Parse("application/pdf"));
            }

            message.Body = builder.ToMessageBody();

            // Convert to RFC 2822 format and Base64 encode
            using var stream = new MemoryStream();
            await message.WriteToAsync(stream);
            var rawMessage = Convert.ToBase64String(stream.ToArray())
                .Replace('+', '-')
                .Replace('/', '_')
                .Replace("=", "");

            var gmailMessage = new Message { Raw = rawMessage };
            var sentMessage = await gmailService.Users.Messages.Send(gmailMessage, "me").ExecuteAsync();
            
            // Log success with message ID for verification
            _logger.LogInformation("✅ Email sent via Gmail OAuth to {To}, company {CompanyId}, MessageId: {MessageId}", 
                to, companyId, sentMessage.Id);

            return new EmailOAuthResult
            {
                Success = true,
                Message = $"Email sent successfully to {to}"
            };
        }
        catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            _logger.LogError(ex, "Gmail API not enabled or forbidden for company {CompanyId}", companyId);
            
            // Mark as not verified since API is not working
            var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
            if (settings != null)
            {
                settings.GmailApiVerified = false;
                await _context.SaveChangesAsync();
            }
            
            return new EmailOAuthResult
            {
                Success = false,
                Message = "Gmail API is not enabled. Please enable it at: console.cloud.google.com/apis/library/gmail.googleapis.com",
                ErrorDetails = ex.Message
            };
        }
        catch (Google.GoogleApiException ex) when (ex.Error?.Code == 401)
        {
            _logger.LogWarning("Gmail OAuth token expired for company, needs re-auth");
            return new EmailOAuthResult
            {
                Success = false,
                Message = "Gmail connection expired. Please reconnect your account.",
                ErrorDetails = "Token expired"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email via Gmail OAuth");
            return new EmailOAuthResult
            {
                Success = false,
                Message = "Failed to send email",
                ErrorDetails = ex.Message
            };
        }
    }

    /// <summary>
    /// Get authenticated Gmail service, refreshing token if needed
    /// </summary>
    private async Task<GmailService?> GetGmailServiceAsync(int companyId)
    {
        var settings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);

        if (settings == null || string.IsNullOrEmpty(settings.GmailRefreshToken))
        {
            return null;
        }

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _clientId,
                ClientSecret = _clientSecret
            },
            Scopes = Scopes
        });

        var tokenResponse = new TokenResponse
        {
            AccessToken = settings.GmailAccessToken,
            RefreshToken = settings.GmailRefreshToken,
            ExpiresInSeconds = settings.GmailTokenExpiry.HasValue 
                ? (long)(settings.GmailTokenExpiry.Value - DateTime.UtcNow).TotalSeconds 
                : 0,
            IssuedUtc = settings.GmailConnectedAt ?? DateTime.UtcNow
        };

        var credential = new UserCredential(flow, "user", tokenResponse);

        // Check if token needs refresh
        if (credential.Token.IsStale)
        {
            if (await credential.RefreshTokenAsync(CancellationToken.None))
            {
                // Save new access token
                settings.GmailAccessToken = credential.Token.AccessToken;
                settings.GmailTokenExpiry = credential.Token.IssuedUtc.AddSeconds(credential.Token.ExpiresInSeconds ?? 3600);
                await _context.SaveChangesAsync();
            }
        }

        return new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = ApplicationName
        });
    }
}
