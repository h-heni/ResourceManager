using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using ResourceManager.Data;
using ResourceManager.Dtos;
using ResourceManager.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.RateLimiting;
using ResourceManager.Services;

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public class AuthController : ControllerBase
    {
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SecurityAlertService _securityAlerts;
        private readonly UserCountryService _countryService;

        // Token configuration
        private const int AccessTokenMinutes = 15;
        private const int RefreshTokenDays = 7;


        public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, AppDbContext context, ILogger<AuthController> logger, IConfiguration configuration, TimeProvider time, SecurityAlertService securityAlerts, UserCountryService countryService)
        {
            _logger = logger;
            _configuration = configuration;
            _context = context;
            _time = time;
            _signInManager = signInManager;
            _userManager = userManager;
            _securityAlerts = securityAlerts;
            _countryService = countryService;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            if (string.IsNullOrWhiteSpace(loginDto.Email) || string.IsNullOrWhiteSpace(loginDto.Password))
                return BadRequest(new { error = "Email and password are required." });

            try
            {
                var user = await _userManager.FindByEmailAsync(loginDto.Email);

                var ip = GetClientIp();

                if (user == null)
                {
                    _logger.LogWarning("Login failed: user not found. Email={Email}, IP={IpAddress}", loginDto.Email, ip);
                    _securityAlerts.RecordFailedLogin(ip, loginDto.Email);
                    return Unauthorized(new { error = "Invalid credentials." });
                }

                var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, lockoutOnFailure: true);

                if (result.IsLockedOut)
                {
                    var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
                    var remainingSeconds = lockoutEnd.HasValue
                        ? (int)Math.Ceiling((lockoutEnd.Value - DateTimeOffset.UtcNow).TotalSeconds)
                        : 30;
                    if (remainingSeconds < 1) remainingSeconds = 1;

                    _logger.LogWarning("Account locked. Email={Email}, IP={IpAddress}, RemainingSeconds={RemainingSeconds}", loginDto.Email, ip, remainingSeconds);
                    _securityAlerts.RecordFailedLogin(ip, loginDto.Email);

                    // Return 429 so the frontend shows the countdown timer
                    Response.Headers["Retry-After"] = remainingSeconds.ToString();
                    return StatusCode(429, new { error = $"Account locked. Try again in {remainingSeconds} seconds.", retryAfter = remainingSeconds });
                }

                if (!result.Succeeded)
                {
                    _logger.LogWarning("Login failed: invalid password. Email={Email}, IP={IpAddress}", loginDto.Email, ip);
                    _securityAlerts.RecordFailedLogin(ip, loginDto.Email);
                    return Unauthorized(new { error = "Invalid credentials." });
                }

                var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == user.Id);
                var roles = await _userManager.GetRolesAsync(user);
                var role = roles.FirstOrDefault() ?? "FreeUser";

                // Generate short-lived access token (15 min)
                var accessToken = GenerateAccessToken(user.Id.ToString(), user.Email!, role, user.CompanyId);

                // Generate & persist refresh token (7 days, HttpOnly cookie)
                var refreshToken = await CreateRefreshTokenAsync(user.Id);
                SetRefreshTokenCookie(refreshToken.Token);

                _logger.LogInformation("User logged in. UserId={UserId}, Email={Email}, IP={IpAddress}", user.Id, loginDto.Email, ip);

                // Record login for country tracking (fire-and-forget, non-blocking)
                await RecordUserLoginAsync(user.Id, ip);

                // Fetch company settings BYPASSING tenant filter (user not yet authenticated in this request)
                var companySettings = await _context.CompanySettings
                    .IgnoreQueryFilters()
                    .Where(s => s.CompanyId == user.CompanyId)
                    .Select(s => new { s.IsProfileComplete, s.BaseStoragePath })
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    AccessToken = accessToken,
                    ExpiresInMinutes = AccessTokenMinutes,
                    User = new { 
                        user.Id, 
                        user.Email, 
                        Role = role,
                        FirstName = userProfile?.FirstName ?? "",
                        LastName = userProfile?.LastName ?? "",
                        IsProfileComplete = companySettings?.IsProfileComplete ?? false,
                        BaseStoragePath = companySettings?.BaseStoragePath
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error. Email={Email}", loginDto.Email);
                return StatusCode(500, new { error = "An error occurred during login." });
            }
        }

        [HttpPost("signup")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> SignUp([FromBody] CreateManagerDto createManagerDto)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    // 1. Create the Company FIRST
                    var company = new Company
                    {
                        Name = createManagerDto.CompanyName,
                        Address = createManagerDto.Address,
                        MatriculeFiscal = createManagerDto.MatriculeFiscal,
                        Phone = createManagerDto.Phone,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Companies.Add(company);
                    await _context.SaveChangesAsync();

                    // 2. Create the Manager User linked to that Company
                    var newUser = new ApplicationUser
                    {
                        UserName = createManagerDto.UserEmail,
                        Email = createManagerDto.UserEmail,
                        CompanyId = company.Id,
                        Profile = new UserProfile
                        {
                            FirstName = createManagerDto.UserFirstName,
                            LastName = createManagerDto.UserLastName
                        }
                    };

                    var result = await _userManager.CreateAsync(newUser, createManagerDto.UserPassword);

                    if (!result.Succeeded)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogWarning("Signup failed validation. Email={Email}, Errors={@Errors}", createManagerDto.UserEmail, result.Errors.Select(e => e.Description));
                        return BadRequest(new { error = "Signup failed.", errors = result.Errors });
                    }

                    await _userManager.AddToRoleAsync(newUser, "FreeUser");
                    await transaction.CommitAsync();

                    _logger.LogInformation("User signed up. UserId={UserId}, Email={Email}, CompanyId={CompanyId}", newUser.Id, newUser.Email, company.Id);

                    return Ok(new
                    {
                        Message = "User created successfully. You can now log in.",
                        UserId = newUser.Id
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Signup failed. Email={Email}", createManagerDto.UserEmail);
                    return StatusCode(500, new { error = "An error occurred during signup." });
                }
            });
        }
        [HttpPost("create-tenant")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> CreateTenant([FromBody] CreateManagerDto createManagerDto)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    var company = new Company
                    {
                        Name = createManagerDto.CompanyName,
                        Address = createManagerDto.Address,
                        MatriculeFiscal = createManagerDto.MatriculeFiscal,
                        Phone = createManagerDto.Phone,
                        Email = createManagerDto.Email,
                        EmployeeLimit = createManagerDto.EmployeeLimit
                    };

                    _context.Companies.Add(company);
                    await _context.SaveChangesAsync();

                    var newUser = new ApplicationUser
                    {
                        UserName = createManagerDto.UserEmail,
                        Email = createManagerDto.UserEmail,
                        CompanyId = company.Id,
                        Profile = new UserProfile
                        {
                            FirstName = createManagerDto.UserFirstName,
                            LastName = createManagerDto.UserLastName,
                        }
                    };

                    var result = await _userManager.CreateAsync(newUser, createManagerDto.UserPassword);

                    if (!result.Succeeded)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogWarning("Tenant creation failed validation. Email={Email}, Errors={@Errors}", createManagerDto.UserEmail, result.Errors.Select(e => e.Description));
                        return BadRequest(new { error = "Tenant creation failed.", errors = result.Errors });
                    }

                    await _userManager.AddToRoleAsync(newUser, "Manager");

                    var currencySymbol = createManagerDto.DefaultCurrency switch
                    {
                        "USD" => "$",
                        "EUR" => "€",
                        "GBP" => "£",
                        _ => createManagerDto.DefaultCurrency
                    };
                    var companySettings = new CompanySettings
                    {
                        CompanyId = company.Id,
                        Currency = createManagerDto.DefaultCurrency,
                        CurrencySymbol = currencySymbol,
                        InvoiceLanguage = createManagerDto.DefaultLanguage
                    };
                    _context.CompanySettings.Add(companySettings);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();

                    _logger.LogInformation("Tenant created. CompanyId={CompanyId}, UserId={UserId}, Email={Email}", company.Id, newUser.Id, newUser.Email);

                    return Ok(new { Message = "New paying client created." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Tenant creation failed. Email={Email}", createManagerDto.UserEmail);
                    return StatusCode(500, new { error = "An error occurred during tenant creation." });
                }
            });
        }
        [HttpPost("register-manual")]
        [Authorize(Roles = "Manager,FreeUser")]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> RegisterManual([FromBody] CreateEmployeeDto employee)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var currentUser = await _context.Users
                        .Where(u => u.Id == User.FindFirstValue(ClaimTypes.NameIdentifier))
                        .FirstOrDefaultAsync();

                    if (currentUser == null)
                        return Unauthorized(new { error = "User not found." });

                    var companyId = currentUser.CompanyId;

                    // Employee limit enforcement
                    var company = await _context.Companies.FindAsync(companyId);
                    if (company != null && company.EmployeeLimit > 0)
                    {
                        var currentEmployeeCount = await _context.Users
                            .CountAsync(u => u.CompanyId == companyId);
                        if (currentEmployeeCount >= company.EmployeeLimit + 1)
                        {
                            _logger.LogWarning("Employee limit reached. CompanyId={CompanyId}, Limit={Limit}, Current={Current}",
                                companyId, company.EmployeeLimit, currentEmployeeCount);
                            return BadRequest(new { error = $"Employee limit reached ({company.EmployeeLimit}). Contact your administrator to increase the limit." });
                        }
                    }

                    var newUser = new ApplicationUser
                    {
                        UserName = employee.Email,
                        Email = employee.Email,
                        Profile = new UserProfile
                        {
                            FirstName = employee.FirstName,
                            LastName = employee.LastName,
                            CreatedAt = _time.GetUtcNow().DateTime
                        },
                        CompanyId = companyId
                    };

                    var result = await _userManager.CreateAsync(newUser, employee.Password);

                    if (!result.Succeeded)
                    {
                        _logger.LogWarning("Employee creation failed. Email={Email}, Errors={@Errors}",
                            employee.Email, result.Errors.Select(e => e.Description));
                        await transaction.RollbackAsync();
                        return BadRequest(new { error = "Employee creation failed.", errors = result.Errors });
                    }

                    await _userManager.AddToRoleAsync(newUser, "Employee");
                    await transaction.CommitAsync();

                    _logger.LogInformation("Employee created. UserId={UserId}, Email={Email}, CompanyId={CompanyId}",
                        newUser.Id, employee.Email, companyId);

                    return Ok(new { Message = $"User {employee.Email} created with role Employee" });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Failed to register employee. Email={Email}", employee.Email);
                    return StatusCode(500, new { error = "Failed to create employee account." });
                }
            });
        }

        // ==========================================
        // REFRESH TOKEN ENDPOINTS
        // ==========================================

        /// <summary>
        /// POST: api/auth/refresh — Exchange a valid refresh token for a new access + refresh token pair.
        /// The refresh token is read from the HttpOnly cookie.
        /// Handles multi-tab race conditions gracefully.
        /// </summary>
        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> RefreshToken()
        {
            var oldTokenValue = Request.Cookies["refreshToken"];
            if (string.IsNullOrEmpty(oldTokenValue))
                return Unauthorized(new { error = "No refresh token provided." });

            var oldToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(t => t.Token == oldTokenValue);

            if (oldToken == null)
            {
                _logger.LogWarning("Refresh token not found in database (cookie corruption or cleanup)");
                ClearRefreshTokenCookie();
                return Unauthorized(new { error = "Session expired. Please log in again." });
            }

            // ═══════════════════════════════════════════════════════════════
            // RACE CONDITION HANDLING: If token was already rotated by another
            // tab/request, try to find the new token and use that instead of
            // triggering security lockout.
            // ═══════════════════════════════════════════════════════════════
            if (oldToken.IsRevoked)
            {
                // Check if this token was rotated (legitimately replaced)
                if (!string.IsNullOrEmpty(oldToken.ReplacedByToken) && oldToken.RevokedReason == "Rotated")
                {
                    var replacementToken = await _context.RefreshTokens
                        .FirstOrDefaultAsync(t => t.Token == oldToken.ReplacedByToken);

                    // If replacement is still valid, use it (multi-tab race condition)
                    if (replacementToken != null && replacementToken.IsActive)
                    {
                        _logger.LogInformation("Multi-tab race detected: reusing rotated token. UserId={UserId}", oldToken.UserId);
                        return await BuildRefreshResponse(oldToken.UserId, replacementToken.Token);
                    }
                }

                // True replay attack: token was revoked but not due to rotation, or replacement is also invalid
                _logger.LogWarning("Revoked refresh token reused — revoking entire family. UserId={UserId}, Family={Family}",
                    oldToken.UserId, oldToken.Family);
                _securityAlerts.RecordTokenMisuse(oldToken.UserId, $"Replay attack on family {oldToken.Family}");
                await RevokeTokenFamilyAsync(oldToken.Family, "Replay attack detected");
                ClearRefreshTokenCookie();
                return Unauthorized(new { error = "Token reuse detected. All sessions revoked. Please log in again." });
            }

            if (oldToken.IsExpired)
            {
                var refreshIp = GetClientIp();
                _logger.LogWarning("Expired refresh token used. UserId={UserId}, IP={IpAddress}", oldToken.UserId, refreshIp);
                _securityAlerts.RecordExpiredRefreshAttempt(oldToken.UserId, refreshIp);
                ClearRefreshTokenCookie();
                return Unauthorized(new { error = "Session expired. Please log in again." });
            }

            // Rotate: revoke old token, issue new one in the same family
            var newRefreshToken = await RotateRefreshTokenAsync(oldToken);
            return await BuildRefreshResponse(oldToken.UserId, newRefreshToken.Token);
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout()
        {
            var tokenValue = Request.Cookies["refreshToken"];
            if (!string.IsNullOrEmpty(tokenValue))
            {
                var token = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == tokenValue);
                if (token != null && token.IsActive)
                {
                    token.RevokedAt = DateTime.UtcNow;
                    token.RevokedReason = "Logout";
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("User logged out. UserId={UserId}", token.UserId);
                }
            }

            ClearRefreshTokenCookie();
            return Ok(new { message = "Logged out successfully." });
        }

        [HttpPost("revoke-all")]
        public async Task<IActionResult> RevokeAllTokens()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var count = await RevokeAllUserTokensAsync(userId, "User requested full revocation");
            ClearRefreshTokenCookie();

            _logger.LogInformation("All refresh tokens revoked. UserId={UserId}, Count={Count}", userId, count);
            return Ok(new { message = "All sessions revoked.", count });
        }

        // ═══════════════════════════════════════════════════════════════
        // HELPERS (Private)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Builds the standard refresh response with user profile, role, and company settings.
        /// Shared by the normal refresh path and the multi-tab race condition path.
        /// </summary>
        private async Task<IActionResult> BuildRefreshResponse(string userId, string refreshTokenValue)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return Unauthorized(new { error = "User not found." });

            var roles = await _userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? "FreeUser";

            var accessToken = GenerateAccessToken(user.Id.ToString(), user.Email!, role, user.CompanyId);
            SetRefreshTokenCookie(refreshTokenValue);

            // Fetch profile + company settings bypassing tenant filter (refresh is [AllowAnonymous])
            var userProfile = await _context.UserProfiles
                .IgnoreQueryFilters()
                .Where(p => p.UserId == user.Id)
                .Select(p => new { p.FirstName, p.LastName })
                .FirstOrDefaultAsync();

            var companySettings = await _context.CompanySettings
                .IgnoreQueryFilters()
                .Where(s => s.CompanyId == user.CompanyId)
                .Select(s => new { s.IsProfileComplete, s.BaseStoragePath })
                .FirstOrDefaultAsync();

            _logger.LogInformation("Refresh token issued. UserId={UserId}", userId);

            return Ok(new
            {
                AccessToken = accessToken,
                ExpiresInMinutes = AccessTokenMinutes,
                User = new
                {
                    user.Id,
                    user.Email,
                    Role = role,
                    FirstName = userProfile?.FirstName ?? "",
                    LastName = userProfile?.LastName ?? "",
                    IsProfileComplete = companySettings?.IsProfileComplete ?? false,
                    BaseStoragePath = companySettings?.BaseStoragePath
                }
            });
        }

        /// <summary>
        /// Revoke all active refresh tokens for a user. Returns the count of revoked tokens.
        /// </summary>
        private async Task<int> RevokeAllUserTokensAsync(string userId, string reason)
        {
            var activeTokens = await _context.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.RevokedAt = DateTime.UtcNow;
                token.RevokedReason = reason;
            }

            await _context.SaveChangesAsync();
            return activeTokens.Count;
        }

        /// <summary>
        /// Extract client IP from forwarded headers or connection info.
        /// </summary>
        private string GetClientIp()
        {
            return HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0]?.Trim()
                ?? HttpContext.Request.Headers["X-Real-IP"].FirstOrDefault()
                ?? HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown";
        }

        private string GenerateAccessToken(string userId, string email, string role, int companyId)
        {
            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("JWT Key not configured");
            var key = Encoding.UTF8.GetBytes(jwtKey);
            var tokenHandler = new JwtSecurityTokenHandler();

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, userId),
                new(JwtRegisteredClaimNames.Email, email),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // Unique token ID
                new(ClaimTypes.Role, role),
                new Claim("CompanyId", companyId.ToString())
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        private async Task<RefreshToken> CreateRefreshTokenAsync(string userId)
        {
            var refreshToken = new RefreshToken
            {
                Token = GenerateSecureToken(),
                UserId = userId,
                Family = Guid.NewGuid().ToString(), // New family for fresh login
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();
            return refreshToken;
        }

        private async Task<RefreshToken> RotateRefreshTokenAsync(RefreshToken oldToken)
        {
            // Revoke the old token
            oldToken.RevokedAt = DateTime.UtcNow;
            oldToken.RevokedReason = "Rotated";

            // Create new token in the same family
            var newToken = new RefreshToken
            {
                Token = GenerateSecureToken(),
                UserId = oldToken.UserId,
                Family = oldToken.Family, // Same family for replay detection
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
            };

            oldToken.ReplacedByToken = newToken.Token;

            _context.RefreshTokens.Add(newToken);
            await _context.SaveChangesAsync();
            return newToken;
        }

        private async Task RevokeTokenFamilyAsync(string family, string reason)
        {
            var tokens = await _context.RefreshTokens
                .Where(t => t.Family == family && t.RevokedAt == null)
                .ToListAsync();

            foreach (var token in tokens)
            {
                token.RevokedAt = DateTime.UtcNow;
                token.RevokedReason = reason;
            }

            await _context.SaveChangesAsync();
        }

        private async Task RecordUserLoginAsync(string userId, string ip)
        {
            try
            {
                var (country, countryCode) = await _countryService.ResolveCountryAsync(ip);
                _context.UserLoginRecords.Add(new UserLoginRecord
                {
                    UserId = userId,
                    IpAddress = ip,
                    Country = country,
                    CountryCode = countryCode,
                    LoginAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record login for user {UserId}", userId);
            }
        }

        private static string GenerateSecureToken()
        {
            var randomBytes = new byte[64];
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);
            return Convert.ToBase64String(randomBytes);
        }

        private void SetRefreshTokenCookie(string token)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = false, // Temporarily disabled for HTTP deployment
                SameSite = SameSiteMode.Lax, // Lax required for HTTP cross-site
                Expires = DateTime.UtcNow.AddDays(RefreshTokenDays),
                Path = "/api/auth"  // Only sent to auth endpoints
            };
            Response.Cookies.Append("refreshToken", token, cookieOptions);
        }

        private void ClearRefreshTokenCookie()
        {
            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = false,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth"
            });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto model)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
            if (!result.Succeeded)
            {
                _logger.LogWarning("Password change failed. UserId={UserId}, Errors={@Errors}",
                    userId, result.Errors.Select(e => e.Description));
                return BadRequest(new { error = "Password change failed.", errors = result.Errors });
            }

            // Revoke all refresh tokens after password change (security best practice)
            var revokedCount = await RevokeAllUserTokensAsync(userId, "Password changed");
            ClearRefreshTokenCookie();

            _logger.LogInformation("Password changed. UserId={UserId}, TokensRevoked={Count}", userId, revokedCount);
            return Ok(new { Message = "Password changed successfully. Please log in again." });
        }
    }
} 
