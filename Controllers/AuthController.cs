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
    [EnableRateLimiting("AuthStrict")]
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
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            if (string.IsNullOrWhiteSpace(loginDto.Email) || string.IsNullOrWhiteSpace(loginDto.Password))
                return BadRequest(new { error = "Email and password are required." });

            try
            {
                var user = await _userManager.FindByEmailAsync(loginDto.Email);

                var ip = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0]?.Trim()
                      ?? HttpContext.Request.Headers["X-Real-IP"].FirstOrDefault()
                      ?? HttpContext.Connection.RemoteIpAddress?.ToString()
                      ?? "unknown";

                if (user == null)
                {
                    _logger.LogWarning("Login failed: user not found for {Email}", loginDto.Email);
                    _securityAlerts.RecordFailedLogin(ip, loginDto.Email);
                    return Unauthorized(new { error = "Invalid credentials." });
                }

                var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, lockoutOnFailure: true);

                if (result.IsLockedOut)
                {
                    _logger.LogWarning("Account locked out for {Email}", loginDto.Email);
                    _securityAlerts.RecordFailedLogin(ip, loginDto.Email);
                    return Unauthorized(new { error = "Account locked. Try again later." });
                }

                if (!result.Succeeded)
                {
                    _logger.LogWarning("Login failed: wrong password for {Email}", loginDto.Email);
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

                _logger.LogInformation("User {Email} logged in successfully", loginDto.Email);

                // Record login for country tracking
                await RecordUserLoginAsync(user.Id, ip);

                return Ok(new
                {
                    AccessToken = accessToken,
                    ExpiresInMinutes = AccessTokenMinutes,
                    User = new { 
                        user.Id, 
                        user.Email, 
                        Role = role,
                        FirstName = userProfile?.FirstName ?? "",
                        LastName = userProfile?.LastName ?? ""
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error for {Email}", loginDto.Email);
                return StatusCode(500, new { error = "An error occurred during login." });
            }
        }

        [HttpPost("signup")]
        [AllowAnonymous]
        public async Task<IActionResult> SignUp([FromBody] CreateManagerDto createManagerDto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {

                // 1. Create the User Object
                // 1. Create the Company FIRST
                var company = new Company
                {
                    Name = createManagerDto.CompanyName,
                    Address = createManagerDto.Address,
                    MatriculeFiscal = createManagerDto.MatriculeFiscal,
                    Phone = createManagerDto.Phone,
                    CreatedAt = DateTime.UtcNow // Or _timeProvider.GetUtcNow().DateTime
                };

                _context.Companies.Add(company);
                await _context.SaveChangesAsync(); // Save to generate company.Id

                // 2. Create the Manager User linked to that Company
                var newUser = new ApplicationUser
                {
                    UserName = createManagerDto.UserEmail,
                    Email = createManagerDto.UserEmail,
                    CompanyId = company.Id, // LINK HERE
                    Profile = new UserProfile
                    {
                        FirstName = createManagerDto.UserFirstName,
                        LastName = createManagerDto.UserLastName
                    }
                };

                // 2. Use UserManager to Create (This hashes password & saves to DB)
                // ❌ REMOVED: _supabase.Auth.SignUp
                // ❌ REMOVED: _context.Users.Add
                var result = await _userManager.CreateAsync(newUser, createManagerDto.UserPassword);

                if (!result.Succeeded)
                {
                    await transaction.RollbackAsync(); // Cancel company creation
                    return BadRequest(result.Errors);
                }

                // 3. Assign Role securely
                // Public users should NOT choose their own role via DTO (Security Risk!)
                // We force them to be "FreeUser" or "Client".
                await _userManager.AddToRoleAsync(newUser, "FreeUser");

                // 4. Commit the transaction
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = "User created successfully. You can now log in.",
                    UserId = newUser.Id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Signup failed");
                return StatusCode(500, new { error = "An error occurred during signup." });
            }
        }
        [HttpPost("create-tenant")]
        [Authorize(Roles = "SuperAdmin")] // Only you can run this
        public async Task<IActionResult> CreateTenant([FromBody] CreateManagerDto createManagerDto)
        {
            // Use a Transaction to keep Data clean (if one fails, both fail)
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Create the User AND the Company in one object tree
                // 1. Create Company
                var company = new Company
                {
                    Name = createManagerDto.CompanyName,
                    Address = createManagerDto.Address,
                    MatriculeFiscal = createManagerDto.MatriculeFiscal,
                    Phone = createManagerDto.Phone,
                    Email = createManagerDto.Email,
                    EmployeeLimit = createManagerDto.EmployeeLimit

                    // Context.SaveChangesAsync will handle CreatedAt & CreatedByUserId automatically
                };

                _context.Companies.Add(company);
                await _context.SaveChangesAsync(); // Auto-stamps SuperAdmin ID here

                // 2. Create User
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

                // 3. Save User
                // This internally calls your AppDbContext.SaveChangesAsync
                var result = await _userManager.CreateAsync(newUser, createManagerDto.UserPassword);

                if (!result.Succeeded)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(result.Errors);
                }

                await _userManager.AddToRoleAsync(newUser, "Manager");

                // 4. Create CompanySettings with default currency & language
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


                return Ok(new { Message = "New paying client created." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tenant creation failed");
                return StatusCode(500, new { error = "An error occurred during tenant creation." });
            }
        }
        // ==========================================
        // 3. MANUAL REGISTER (Admin/Manager/FreeUser Only)
        // ==========================================
        [HttpPost("register-manual")]
        [Authorize(Roles = "Manager,FreeUser")] // <--- Managers and FreeUsers can add employees to their company
        public async Task<IActionResult> RegisterManual([FromBody] CreateEmployeeDto employee)
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

                // ═══ Employee limit enforcement ═══
                var company = await _context.Companies.FindAsync(companyId);
                if (company != null && company.EmployeeLimit > 0)
                {
                    var currentEmployeeCount = await _context.Users
                        .CountAsync(u => u.CompanyId == companyId);
                    // Count includes the manager, so employees = total - 1
                    if (currentEmployeeCount >= company.EmployeeLimit + 1) // +1 for manager
                    {
                        return BadRequest(new { error = $"Employee limit reached ({company.EmployeeLimit}). Contact your administrator to increase the limit." });
                    }
                }

                var newUser = new ApplicationUser
                {
                    UserName = employee.Email,
                    Email = employee.Email,
                    Profile= new UserProfile
                    {
                        FirstName = employee.FirstName,
                        LastName = employee.LastName,
                        CreatedAt= _time.GetUtcNow().DateTime
                    },
                    
                    CompanyId = companyId

                };
                // 3. Use UserManager to save User
                var result = await _userManager.CreateAsync(newUser, employee.Password);

                if (!result.Succeeded)
                {
                    await transaction.RollbackAsync(); // Cancel company creation
                    return BadRequest(result.Errors);
                }

                // 4. Assign "Manager" Role
                await _userManager.AddToRoleAsync(newUser, "Employee");

                // 5. Commit Transaction
                await transaction.CommitAsync();
                
                return Ok(new { Message = $"User {employee.Email} created with role Employee" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to register employee");
                return BadRequest(new { error = "Failed to create employee account." });
            }
        }

        // ==========================================
        // REFRESH TOKEN ENDPOINTS
        // ==========================================

        /// <summary>
        /// POST: api/auth/refresh — Exchange a valid refresh token for a new access + refresh token pair.
        /// The refresh token is read from the HttpOnly cookie.
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
                _logger.LogWarning("Refresh token not found (possible replay attack)");
                return Unauthorized(new { error = "Invalid refresh token." });
            }

            // Replay attack detection: if token is already revoked, revoke the entire family
            if (oldToken.IsRevoked)
            {
                _logger.LogWarning("Revoked refresh token reused for user {UserId} — revoking entire family {Family}",
                    oldToken.UserId, oldToken.Family);
                _securityAlerts.RecordTokenMisuse(oldToken.UserId, $"Replay attack on family {oldToken.Family}");
                await RevokeTokenFamilyAsync(oldToken.Family, "Replay attack detected");
                ClearRefreshTokenCookie();
                return Unauthorized(new { error = "Token reuse detected. All sessions revoked. Please log in again." });
            }

            if (oldToken.IsExpired)
            {
                var refreshIp = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0]?.Trim()
                             ?? HttpContext.Request.Headers["X-Real-IP"].FirstOrDefault()
                             ?? HttpContext.Connection.RemoteIpAddress?.ToString()
                             ?? "unknown";
                _logger.LogWarning("Expired refresh token used for user {UserId}", oldToken.UserId);
                _securityAlerts.RecordExpiredRefreshAttempt(oldToken.UserId, refreshIp);
                ClearRefreshTokenCookie();
                return Unauthorized(new { error = "Refresh token expired. Please log in again." });
            }

            // Rotate: revoke old token, issue new one in the same family
            var user = await _userManager.FindByIdAsync(oldToken.UserId);
            if (user == null)
                return Unauthorized(new { error = "User not found." });

            var roles = await _userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? "FreeUser";

            // Create new refresh token in the same family
            var newRefreshToken = await RotateRefreshTokenAsync(oldToken);
            SetRefreshTokenCookie(newRefreshToken.Token);

            // Issue new access token
            var accessToken = GenerateAccessToken(user.Id.ToString(), user.Email!, role, user.CompanyId);

            return Ok(new
            {
                AccessToken = accessToken,
                ExpiresInMinutes = AccessTokenMinutes
            });
        }

        /// <summary>
        /// POST: api/auth/logout — Revoke the current refresh token and clear the cookie.
        /// </summary>
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
                }
            }

            ClearRefreshTokenCookie();
            return Ok(new { message = "Logged out successfully." });
        }

        /// <summary>
        /// POST: api/auth/revoke-all — Revoke all refresh tokens for the current user (password change, security event).
        /// </summary>
        [HttpPost("revoke-all")]
        public async Task<IActionResult> RevokeAllTokens()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var activeTokens = await _context.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.RevokedAt = DateTime.UtcNow;
                token.RevokedReason = "User requested full revocation";
            }
        
            await _context.SaveChangesAsync();
            ClearRefreshTokenCookie();

            _logger.LogInformation("All refresh tokens revoked for user {UserId}", userId);
            return Ok(new { message = "All sessions revoked.", count = activeTokens.Count });
        }

        // ═══════════════════════════════════════════════════════════════
        // TOKEN HELPERS (Private)
        // ═══════════════════════════════════════════════════════════════

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
                return BadRequest(result.Errors);
            }

            return Ok(new { Message = "Password changed successfully" });
        }
    }
} 
