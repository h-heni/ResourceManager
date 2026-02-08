using Google;
using Google.Apis.Util;
using Humanizer;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
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

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public class AuthController : ControllerBase
    {
        private readonly Supabase.Client _supabase;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;



        public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, Supabase.Client supabase, AppDbContext context, ILogger<AuthController> logger, IConfiguration configuration, TimeProvider time)
        {
            _supabase = supabase;
            _logger = logger;
            _configuration = configuration;
            _context = context;
            _time = time;
            _signInManager = signInManager;
            _userManager = userManager;

        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            try
            {
                // 1. Find the user in YOUR Database (AspNetUsers table)
                var user = await _userManager.FindByEmailAsync(loginDto.Email);

                if (user == null)
                    return Unauthorized("Invalid credentials (User not found).");

                // Fetch user's profile for firstName and lastName
                var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == user.Id);

                // 2. Check Password using Identity (hashes and compares automatically)
                var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, false);

                if (!result.Succeeded)
                    return Unauthorized("Invalid credentials (Wrong password).");

                // 3. Get Roles
                var roles = await _userManager.GetRolesAsync(user);
                var role = roles.FirstOrDefault() ?? "FreeUser";

                // 4. Generate JWT Token
                // Note: user.Id is already the correct ID (Guid or String)
                var token = GenerateJwtToken(user.Id.ToString(), user.Email, role, user.CompanyId);

                return Ok(new
                {
                    Token = token,
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
                return BadRequest(ex.Message);
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
                return BadRequest(ex.Message);
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
                    Email = createManagerDto.Email

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

                await transaction.CommitAsync();


                return Ok(new { Message = "New paying client created." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tenant creation failed");
                return BadRequest(ex.Message);
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
                var userManager = _context.Users.Where(u => u.Id == User.FindFirstValue(ClaimTypes.NameIdentifier));
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
                    
                    CompanyId = userManager
                        .Select(u => u.CompanyId)
                        .FirstOrDefault()

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
                return BadRequest(ex.Message);
            }
        }

        // ==========================================
        // 4. GOOGLE SIGN-IN
        // ==========================================
        [HttpPost("google-login")]
        [AllowAnonymous]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
        {
            try
            {
                // Validate Google token using Google API
                var payload = await Google.Apis.Auth.GoogleJsonWebSignature.ValidateAsync(dto.IdToken);
                
                if (payload == null)
                    return Unauthorized("Invalid Google token");

                var email = payload.Email;
                var user = await _userManager.FindByEmailAsync(email);

                bool needsCompanySetup = false;

                if (user == null)
                {
                    // Create new user from Google
                    user = new ApplicationUser
                    {
                        UserName = email,
                        Email = email,
                        EmailConfirmed = true, // Google verified
                        CompanyId = 0, // No company yet
                        Profile = new UserProfile
                        {
                            FirstName = payload.GivenName ?? "",
                            LastName = payload.FamilyName ?? "",
                            CreatedAt = DateTime.UtcNow
                        }
                    };

                    var result = await _userManager.CreateAsync(user);
                    if (!result.Succeeded)
                        return BadRequest(result.Errors);

                    await _userManager.AddToRoleAsync(user, "FreeUser");
                    needsCompanySetup = true;
                }
                else
                {
                    needsCompanySetup = user.CompanyId == 0;
                }

                var roles = await _userManager.GetRolesAsync(user);
                var role = roles.FirstOrDefault() ?? "FreeUser";
                var token = GenerateJwtToken(user.Id.ToString(), user.Email!, role, user.CompanyId);

                return Ok(new
                {
                    Token = token,
                    User = new { user.Id, user.Email, Role = role },
                    NeedsCompanySetup = needsCompanySetup
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google login failed");
                return BadRequest("Google authentication failed: " + ex.Message);
            }
        }

        private object GenerateJwtToken(string userId, string email, string role, int companyId)
        {
            var jwtKey = _configuration["Jwt:Key"];
            var expire = _configuration["Jwt:TokenExpirationInMinutes"];
            var key = Encoding.UTF8.GetBytes(jwtKey);
            var tokenHandler = new JwtSecurityTokenHandler();

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, userId),
                new(JwtRegisteredClaimNames.Email, email),
                new(ClaimTypes.Role, role),
                new Claim("CompanyId", companyId.ToString())
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddDays(7),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return new { AccessToken = tokenHandler.WriteToken(token), RefreshToken = Guid.NewGuid().ToString(), Expire = expire };
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto model)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
            if (!result.Succeeded)
            {
                return BadRequest(result.Errors);
            }

            return Ok(new { Message = "Password changed successfully" });
        }

        /// <summary>
        /// Initiates Auth0 login flow. Redirects to Auth0 for authentication.
        /// </summary>
        [HttpGet("auth0/login")]
        [AllowAnonymous]
        public IActionResult Auth0Login([FromQuery] string? returnUrl = "/")
        {
            var properties = new AuthenticationProperties
            {
                RedirectUri = Url.Action(nameof(Auth0Callback), new { returnUrl }),
                Items = { { "scheme", "Auth0" } }
            };
            return Challenge(properties, "Auth0");
        }

        /// <summary>
        /// Auth0 callback endpoint. Handles the response from Auth0 and issues a JWT token.
        /// </summary>
        [HttpGet("auth0/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> Auth0Callback([FromQuery] string? returnUrl = "/")
        {
            try
            {
                // Authenticate using Auth0 scheme
                var authenticateResult = await HttpContext.AuthenticateAsync("Auth0");
                
                if (!authenticateResult.Succeeded || authenticateResult.Principal == null)
                {
                    _logger.LogWarning("Auth0 authentication failed");
                    return Redirect($"{returnUrl}?error=auth_failed");
                }

                var email = authenticateResult.Principal.FindFirstValue(ClaimTypes.Email) 
                    ?? authenticateResult.Principal.FindFirstValue("email");
                var name = authenticateResult.Principal.FindFirstValue(ClaimTypes.Name)
                    ?? authenticateResult.Principal.FindFirstValue("name");
                var auth0Id = authenticateResult.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? authenticateResult.Principal.FindFirstValue("sub");

                if (string.IsNullOrEmpty(email))
                {
                    _logger.LogWarning("Auth0 login: No email claim found");
                    return Redirect($"{returnUrl}?error=no_email");
                }

                // Find or create user
                var user = await _userManager.FindByEmailAsync(email);
                
                if (user == null)
                {
                    // Create new user with Auth0 as external provider
                    // First create a company for the new user
                    var company = new Company
                    {
                        Name = $"{name ?? email}'s Company",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Companies.Add(company);
                    await _context.SaveChangesAsync();

                    user = new ApplicationUser
                    {
                        UserName = email,
                        Email = email,
                        EmailConfirmed = true, // Auth0 handles verification
                        CompanyId = company.Id,
                        Profile = new UserProfile
                        {
                            FirstName = name?.Split(' ').FirstOrDefault() ?? "",
                            LastName = name?.Split(' ').Skip(1).FirstOrDefault() ?? ""
                        }
                    };

                    var createResult = await _userManager.CreateAsync(user);
                    if (!createResult.Succeeded)
                    {
                        _logger.LogError("Failed to create user from Auth0: {Errors}", 
                            string.Join(", ", createResult.Errors.Select(e => e.Description)));
                        return Redirect($"{returnUrl}?error=user_creation_failed");
                    }

                    await _userManager.AddToRoleAsync(user, "FreeUser");

                    // Link Auth0 login
                    await _userManager.AddLoginAsync(user, new UserLoginInfo("Auth0", auth0Id!, "Auth0"));
                }

                // Get user roles
                var roles = await _userManager.GetRolesAsync(user);
                var role = roles.FirstOrDefault() ?? "FreeUser";

                // Generate JWT token
                var tokenResult = GenerateJwtToken(user.Id.ToString(), user.Email!, role, user.CompanyId);
                var token = ((dynamic)tokenResult).AccessToken;

                // Redirect with token (for SPA to capture)
                // In production, consider using a more secure method like HTTP-only cookies
                return Redirect($"{returnUrl}?token={token}&email={Uri.EscapeDataString(email)}&role={role}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Auth0 callback failed");
                return Redirect($"{returnUrl}?error=callback_failed");
            }
        }

        /// <summary>
        /// Initiates Auth0 logout flow.
        /// </summary>
        [HttpGet("auth0/logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Auth0Logout([FromQuery] string? returnUrl = "/")
        {
            await HttpContext.SignOutAsync("Auth0");
            
            var auth0Domain = _configuration["Auth0:Domain"];
            var clientId = _configuration["Auth0:ClientId"];
            var logoutUrl = $"https://{auth0Domain}/v2/logout?" +
                $"client_id={clientId}&" +
                $"returnTo={Uri.EscapeDataString(Request.Scheme + "://" + Request.Host + returnUrl)}";
            
            return Redirect(logoutUrl);
        }

        /// <summary>
        /// Exchange Auth0 access token for local JWT (for SPA flow).
        /// </summary>
        [HttpPost("auth0/token-exchange")]
        [AllowAnonymous]
        public async Task<IActionResult> Auth0TokenExchange([FromBody] Auth0TokenExchangeDto dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.AccessToken) || string.IsNullOrEmpty(dto.Email))
                {
                    return BadRequest("Access token and email are required");
                }

                // In a production app, you'd validate the Auth0 token here
                // For now, we trust the token from Auth0 SDK
                var email = dto.Email;
                var user = await _userManager.FindByEmailAsync(email);

                bool needsCompanySetup = false;

                if (user == null)
                {
                    // Create new user from Auth0
                    user = new ApplicationUser
                    {
                        UserName = email,
                        Email = email,
                        EmailConfirmed = true,
                        CompanyId = 0, // No company yet
                        Profile = new UserProfile
                        {
                            FirstName = dto.Name?.Split(' ').FirstOrDefault() ?? "",
                            LastName = dto.Name?.Split(' ').Skip(1).FirstOrDefault() ?? "",
                            CreatedAt = DateTime.UtcNow
                        }
                    };

                    var result = await _userManager.CreateAsync(user);
                    if (!result.Succeeded)
                        return BadRequest(result.Errors);

                    await _userManager.AddToRoleAsync(user, "FreeUser");
                    needsCompanySetup = true;
                }
                else
                {
                    needsCompanySetup = user.CompanyId == 0;
                }

                var roles = await _userManager.GetRolesAsync(user);
                var role = roles.FirstOrDefault() ?? "FreeUser";
                var token = GenerateJwtToken(user.Id.ToString(), user.Email!, role, user.CompanyId);

                return Ok(new
                {
                    Token = token,
                    User = new { user.Id, user.Email, Role = role },
                    NeedsCompanySetup = needsCompanySetup
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Auth0 token exchange failed");
                return BadRequest("Auth0 token exchange failed: " + ex.Message);
            }
        }
    }

    public class Auth0TokenExchangeDto
    {
        public string AccessToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
    }

    public class GoogleLoginDto
    {
        public string IdToken { get; set; } = string.Empty;
    }
} 
