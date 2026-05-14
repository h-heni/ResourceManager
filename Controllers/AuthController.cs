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
                var accessToken = GenerateAccessToken(user.Id.ToString(), user.Email!, role, user.CompanyId, userProfile?.FirstName);

                // Generate & persist refresh token (7 days, HttpOnly cookie)
                var (refreshToken, rawRefreshToken) = await CreateRefreshTokenAsync(user.Id);
                SetRefreshTokenCookie(rawRefreshToken);

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
                    // 0. Unique email check (before creating anything)
                    var emailConflict = await CheckEmailUniqueness(createManagerDto.UserEmail);
                    if (emailConflict != null)
                    {
                        await transaction.RollbackAsync();
                        return Conflict(new { error = emailConflict });
                    }

                    // 1. Create the Company FIRST
                    var company = new Company
                    {
                        Name = createManagerDto.CompanyName,
                        Address = createManagerDto.Address,
                        TaxId = createManagerDto.TaxId,
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
                        PhoneNumber = string.IsNullOrWhiteSpace(createManagerDto.Phone) ? null : createManagerDto.Phone.Trim(),
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

        // ==========================================
        // PASSWORD RESET ENDPOINTS
        // ==========================================

        /// <summary>
        /// POST: api/auth/forgot-password — Request password reset email
        /// Always returns success message to prevent email enumeration attacks
        /// </summary>
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> ForgotPassword([FromBody] Dtos.ForgotPasswordRequestDto request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var ip = GetClientIp();
            _logger.LogInformation("Password reset requested for {Email} from IP {IP}", request.Email, ip);

            try
            {
                var user = await _userManager.FindByEmailAsync(request.Email);
                
                // Always return success to prevent email enumeration
                if (user == null)
                {
                    _logger.LogWarning("Password reset requested for non-existent email: {Email}", request.Email);
                    return Ok(new Dtos.ForgotPasswordResponseDto { EmailSent = false });
                }

                // Generate ASP.NET Identity password reset token
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);

                // Store token hash for auditing (optional - Identity handles token validation)
                var resetToken = new PasswordResetToken
                {
                    UserId = user.Id,
                    TokenHash = ComputeTokenHash(token),
                    ExpiresAt = DateTime.UtcNow.AddHours(_configuration.GetValue<int>("PasswordReset:TokenExpirationHours", 1)),
                    RequestIpAddress = ip
                };
                _context.PasswordResetTokens.Add(resetToken);
                await _context.SaveChangesAsync();

                // Send email using MailKit service
                using var scope = HttpContext.RequestServices.CreateScope();
                var emailService = scope.ServiceProvider.GetService<IMailKitEmailService>();
                
                if (emailService != null)
                {
                    var result = await emailService.SendPasswordResetEmailAsync(user, token, ip);
                    
                    if (!result.Success)
                    {
                        _logger.LogError("Failed to send password reset email to {Email}: {Error}", request.Email, result.ErrorDetails);
                    }
                }
                else
                {
                    _logger.LogWarning("MailKitEmailService not registered - password reset email not sent");
                }

                return Ok(new Dtos.ForgotPasswordResponseDto { EmailSent = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing password reset for {Email}", request.Email);
                return Ok(new Dtos.ForgotPasswordResponseDto { EmailSent = false });
            }
        }

        /// <summary>
        /// POST: api/auth/reset-password — Complete password reset with token
        /// </summary>
        [HttpPost("reset-password")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> ResetPassword([FromBody] Dtos.ResetPasswordRequestDto request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var ip = GetClientIp();
            _logger.LogInformation("Password reset attempt for {Email} from IP {IP}", request.Email, ip);

            try
            {
                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user == null)
                {
                    _logger.LogWarning("Password reset attempt for non-existent email: {Email}", request.Email);
                    return BadRequest(new Dtos.ResetPasswordResponseDto
                    {
                        Success = false,
                        Message = "Invalid or expired reset token."
                    });
                }

                // Validate and reset password using ASP.NET Identity
                var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);

                if (result.Succeeded)
                {
                    // Mark token as used in our audit table
                    var tokenHash = ComputeTokenHash(request.Token);
                    var storedToken = await _context.PasswordResetTokens
                        .FirstOrDefaultAsync(t => t.UserId == user.Id && t.TokenHash == tokenHash && !t.IsUsed);
                    
                    if (storedToken != null)
                    {
                        storedToken.IsUsed = true;
                        storedToken.UsedAt = DateTime.UtcNow;
                        storedToken.UsedIpAddress = ip;
                        await _context.SaveChangesAsync();
                    }

                    // Revoke all existing refresh tokens for security
                    var activeTokens = await _context.RefreshTokens
                        .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
                        .ToListAsync();

                    foreach (var token in activeTokens)
                    {
                        token.RevokedAt = DateTime.UtcNow;
                        token.RevokedReason = "Password reset";
                    }
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("Password reset successful for {Email}", request.Email);

                    return Ok(new Dtos.ResetPasswordResponseDto
                    {
                        Success = true,
                        Message = "Password has been reset successfully. Please log in with your new password."
                    });
                }
                else
                {
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    _logger.LogWarning("Password reset failed for {Email}: {Errors}", request.Email, errors);

                    return BadRequest(new Dtos.ResetPasswordResponseDto
                    {
                        Success = false,
                        Message = result.Errors.Any(e => e.Code == "InvalidToken")
                            ? "Invalid or expired reset token."
                            : errors
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting password for {Email}", request.Email);
                return StatusCode(500, new Dtos.ResetPasswordResponseDto
                {
                    Success = false,
                    Message = "An error occurred while resetting your password."
                });
            }
        }

        /// <summary>
        /// Compute SHA256 hash of token for storage
        /// </summary>
        private static string ComputeTokenHash(string token)
        {
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(bytes);
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
                    // 0. Unique email check — Company email and User email may match (Manager/Company pair exception)
                    var userEmailConflict = await CheckEmailUniqueness(createManagerDto.UserEmail);
                    if (userEmailConflict != null)
                    {
                        await transaction.RollbackAsync();
                        return Conflict(new { error = userEmailConflict });
                    }
                    // If company email differs from user email, validate it too
                    if (!string.IsNullOrWhiteSpace(createManagerDto.Email)
                        && !string.Equals(createManagerDto.Email.Trim(), createManagerDto.UserEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        var companyEmailConflict = await CheckEmailUniqueness(createManagerDto.Email);
                        if (companyEmailConflict != null)
                        {
                            await transaction.RollbackAsync();
                            return Conflict(new { error = companyEmailConflict });
                        }
                    }

                    var company = new Company
                    {
                        Name = createManagerDto.CompanyName,
                        Address = createManagerDto.Address,
                        TaxId = createManagerDto.TaxId,
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

                    // Unique email check — employee email must not conflict with any existing user/company
                    // Exception: allowed to match the company they're being added to
                    var emailConflict = await CheckEmailUniqueness(employee.Email, companyId);
                    if (emailConflict != null)
                        return Conflict(new { error = emailConflict });

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
                        PhoneNumber = string.IsNullOrWhiteSpace(employee.PhoneNumber) ? null : employee.PhoneNumber.Trim(),
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
                .FirstOrDefaultAsync(t => t.Token == ComputeTokenHash(oldTokenValue));

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

                    // If replacement is still valid, rotate it to issue a fresh raw token (multi-tab race condition)
                    if (replacementToken != null && replacementToken.IsActive)
                    {
                        _logger.LogInformation("Multi-tab race detected: rotating active replacement token. UserId={UserId}", oldToken.UserId);
                        var (_, rawRaceToken) = await RotateRefreshTokenAsync(replacementToken);
                        return await BuildRefreshResponse(oldToken.UserId, rawRaceToken);
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
            var (_, rawRotated) = await RotateRefreshTokenAsync(oldToken);
            return await BuildRefreshResponse(oldToken.UserId, rawRotated);
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout()
        {
            var tokenValue = Request.Cookies["refreshToken"];
            if (!string.IsNullOrEmpty(tokenValue))
            {
                var token = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == ComputeTokenHash(tokenValue));
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

            // Fetch profile + company settings bypassing tenant filter (refresh is [AllowAnonymous])
            var userProfile = await _context.UserProfiles
                .IgnoreQueryFilters()
                .Where(p => p.UserId == user.Id)
                .Select(p => new { p.FirstName, p.LastName })
                .FirstOrDefaultAsync();

            var accessToken = GenerateAccessToken(user.Id.ToString(), user.Email!, role, user.CompanyId, userProfile?.FirstName);
            SetRefreshTokenCookie(refreshTokenValue);

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

        /// <summary>
        /// Check if an email is already in use by another user or company.
        /// Returns null if the email is available, or an error message if it conflicts.
        /// Exception: A Company and its Manager are allowed to share the same email.
        /// </summary>
        private async Task<string?> CheckEmailUniqueness(string email, int? allowedCompanyId = null)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();

            // 1. Check AspNetUsers table (Identity)
            var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
            if (existingUser != null)
            {
                // If the existing user belongs to the same company we're creating/updating, allow it
                // (Manager + Company share the same email is the permitted exception)
                if (allowedCompanyId.HasValue && existingUser.CompanyId == allowedCompanyId.Value)
                    return null;

                return $"The email '{normalizedEmail}' is already registered by another user.";
            }

            // 2. Check Companies table (company contact email)
            var existingCompany = await _context.Companies
                .IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && c.Email != null && c.Email.ToLower() == normalizedEmail)
                .Select(c => new { c.Id })
                .FirstOrDefaultAsync();

            if (existingCompany != null)
            {
                // If we're creating a user FOR this company, allow it (Manager/Company pair exception)
                if (allowedCompanyId.HasValue && existingCompany.Id == allowedCompanyId.Value)
                    return null;

                return $"The email '{normalizedEmail}' is already associated with another company.";
            }

            return null; // Email is available
        }

        private string GenerateAccessToken(string userId, string email, string role, int companyId, string? firstName = null)
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
            if (!string.IsNullOrWhiteSpace(firstName))
            {
                claims.Add(new Claim("FirstName", firstName));
            }

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

        /// <param name="userId">Owner of the new token.</param>
        /// <returns>The persisted <see cref="RefreshToken"/> entity (Token = SHA-256 hash) and the raw token value to send in the cookie.</returns>
        private async Task<(RefreshToken token, string rawValue)> CreateRefreshTokenAsync(string userId)
        {
            var rawValue = GenerateSecureToken();
            var refreshToken = new RefreshToken
            {
                Token = ComputeTokenHash(rawValue), // Only the hash is persisted; raw never touches the DB
                UserId = userId,
                Family = Guid.NewGuid().ToString(),
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();
            return (refreshToken, rawValue);
        }

        /// <returns>The new persisted <see cref="RefreshToken"/> entity (Token = SHA-256 hash) and the raw token value to send in the cookie.</returns>
        private async Task<(RefreshToken token, string rawValue)> RotateRefreshTokenAsync(RefreshToken oldToken)
        {
            // Revoke the old token
            oldToken.RevokedAt = DateTime.UtcNow;
            oldToken.RevokedReason = "Rotated";

            // Create new token in the same family — only the SHA-256 hash is persisted
            var rawValue = GenerateSecureToken();
            var newToken = new RefreshToken
            {
                Token = ComputeTokenHash(rawValue), // Only the hash is persisted; raw never touches the DB
                UserId = oldToken.UserId,
                Family = oldToken.Family,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
            };

            // Store hash of new token so the audit chain lookup (race condition path) still works
            oldToken.ReplacedByToken = newToken.Token;

            _context.RefreshTokens.Add(newToken);
            await _context.SaveChangesAsync();
            return (newToken, rawValue);
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
            var (secure, sameSite) = GetCookieSecurity();
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = sameSite,
                Expires = DateTime.UtcNow.AddDays(RefreshTokenDays),
                Path = "/api/auth"  // Only sent to auth endpoints
            };
            Response.Cookies.Append("refreshToken", token, cookieOptions);
        }

        private void ClearRefreshTokenCookie()
        {
            var (secure, sameSite) = GetCookieSecurity();
            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = sameSite,
                Path = "/api/auth"
            });
        }

        // Resolve cookie security from configuration. Defaults are SECURE:
        //   Secure=true, SameSite=Strict.
        // Overrides (for HTTP-only fallback, dev, or cross-subdomain):
        //   Security:CookieSecure   = true|false
        //   Security:CookieSameSite = Strict|Lax|None
        private (bool Secure, SameSiteMode SameSite) GetCookieSecurity()
        {
            var secure = _configuration.GetValue<bool?>("Security:CookieSecure") ?? true;
            var sameSiteRaw = _configuration["Security:CookieSameSite"];
            var sameSite = sameSiteRaw?.ToLowerInvariant() switch
            {
                "none" => SameSiteMode.None,
                "lax" => SameSiteMode.Lax,
                _ => SameSiteMode.Strict,
            };
            // SameSite=None requires Secure=true per spec
            if (sameSite == SameSiteMode.None && !secure) secure = true;
            return (secure, sameSite);
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
