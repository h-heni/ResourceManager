using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Dtos;
using ResourceManager.Models;
using ResourceManager.Services;
using System.Security.Claims;
using System.Security.Cryptography;

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api")]
    public class InvitationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InvitationController> _logger;

        private const int InvitationExpirationHours = 48;

        public InvitationController(
            AppDbContext context,
            UserManager<ApplicationUser> userManager,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<InvitationController> logger)
        {
            _context = context;
            _userManager = userManager;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// POST /api/superadmin/invite-manager
        /// SuperAdmin sends an invitation email to a new manager.
        /// </summary>
        [HttpPost("superadmin/invite-manager")]
        [Authorize(AuthenticationSchemes = "Bearer", Roles = "SuperAdmin")]
        [EnableRateLimiting("Moderate")]
        public async Task<IActionResult> InviteManager([FromBody] InviteManagerDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var email = dto.Email.Trim().ToLowerInvariant();

            // Check if user already exists
            var existingUser = await _userManager.FindByEmailAsync(email);
            if (existingUser != null)
                return Conflict(new { error = "A user with this email already exists." });

            // Check for pending (unused, non-expired) invitation
            var pendingInvitation = await _context.ManagerInvitations
                .IgnoreQueryFilters()
                .AnyAsync(i => i.Email == email && !i.IsUsed && i.ExpirationDate > DateTime.UtcNow);

            if (pendingInvitation)
                return Conflict(new { error = "An active invitation already exists for this email." });

            // Generate secure token
            var token = GenerateInvitationToken();
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var invitation = new ManagerInvitation
            {
                Id = Guid.NewGuid(),
                Email = email,
                Token = token,
                ExpirationDate = DateTime.UtcNow.AddHours(InvitationExpirationHours),
                IsUsed = false,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = currentUserId
            };

            _context.ManagerInvitations.Add(invitation);
            await _context.SaveChangesAsync();

            // Build invitation link
            var frontendUrl = _configuration["Cors:AllowedOrigins:0"] ?? "http://localhost:5173";
            var invitationLink = $"{frontendUrl}/setup-account?token={Uri.EscapeDataString(token)}";

            // Send invitation email
            var emailBody = $@"
                <html>
                <body style='font-family: Arial, sans-serif; color: #333;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                        <h2 style='color: #065F46;'>You've been invited to Resource Manager</h2>
                        <p>You have been invited to join <strong>Resource Manager</strong> as a Manager.</p>
                        <p>Click the button below to set up your account:</p>
                        <div style='text-align: center; margin: 30px 0;'>
                            <a href='{invitationLink}' 
                               style='background-color: #065F46; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>
                                Set Up Your Account
                            </a>
                        </div>
                        <p style='color: #666; font-size: 14px;'>This invitation expires in {InvitationExpirationHours} hours.</p>
                        <p style='color: #666; font-size: 14px;'>If you didn't expect this invitation, you can safely ignore this email.</p>
                        <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'/>
                        <p style='color: #999; font-size: 12px;'>Resource Manager — Professional Invoice Management</p>
                    </div>
                </body>
                </html>";

            var emailResult = await _emailService.SendEmailAsync(
                email,
                "You're invited to Resource Manager",
                emailBody);

            _logger.LogInformation("Manager invitation sent to {Email}, email send result: {Success}", email, emailResult.Success);

            return Ok(new
            {
                message = "Invitation sent successfully.",
                emailSent = emailResult.Success,
                emailMode = emailResult.Mode.ToString()
            });
        }

        /// <summary>
        /// GET /api/invitations/validate?token=XYZ
        /// Validates an invitation token (anonymous access).
        /// </summary>
        [HttpGet("invitations/validate")]
        [AllowAnonymous]
        [EnableRateLimiting("Moderate")]
        public async Task<IActionResult> ValidateToken([FromQuery] string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest(new { valid = false, error = "Token is required." });

            var invitation = await _context.ManagerInvitations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(i => i.Token == token);

            if (invitation == null)
                return Ok(new { valid = false, error = "Invalid invitation token." });

            if (invitation.IsUsed)
                return Ok(new { valid = false, error = "This invitation has already been used." });

            if (invitation.ExpirationDate < DateTime.UtcNow)
                return Ok(new { valid = false, error = "This invitation has expired." });

            return Ok(new { valid = true, email = invitation.Email });
        }

        /// <summary>
        /// POST /api/invitations/complete
        /// Completes the invitation: creates user, company, assigns role (anonymous access).
        /// </summary>
        [HttpPost("invitations/complete")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthStrict")]
        public async Task<IActionResult> CompleteInvitation([FromBody] CompleteInvitationDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Validate token
            var invitation = await _context.ManagerInvitations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(i => i.Token == dto.Token);

            if (invitation == null)
                return BadRequest(new { error = "Invalid invitation token." });

            if (invitation.IsUsed)
                return BadRequest(new { error = "This invitation has already been used." });

            if (invitation.ExpirationDate < DateTime.UtcNow)
                return BadRequest(new { error = "This invitation has expired." });

            // Check email not taken (race condition guard)
            var existingUser = await _userManager.FindByEmailAsync(invitation.Email);
            if (existingUser != null)
                return Conflict(new { error = "A user with this email already exists." });

            // Execute everything in a transaction
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create Company
                var company = new Company
                {
                    Name = dto.CompanyName,
                    Address = dto.CompanyAddress,
                    MatriculeFiscal = dto.TaxNumber,
                    Phone = dto.Phone,
                    Email = invitation.Email,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Companies.Add(company);
                await _context.SaveChangesAsync();

                // 2. Create User
                var newUser = new ApplicationUser
                {
                    UserName = invitation.Email,
                    Email = invitation.Email,
                    CompanyId = company.Id,
                    Profile = new UserProfile
                    {
                        FirstName = dto.FirstName,
                        LastName = dto.LastName,
                        CreatedAt = DateTime.UtcNow
                    }
                };

                var result = await _userManager.CreateAsync(newUser, dto.Password);
                if (!result.Succeeded)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { error = "Failed to create account.", details = result.Errors });
                }

                // 3. Assign Manager role
                await _userManager.AddToRoleAsync(newUser, "Manager");

                // 4. Create CompanySettings
                var currencySymbol = dto.DefaultCurrency switch
                {
                    "USD" => "$",
                    "EUR" => "€",
                    "GBP" => "£",
                    _ => dto.DefaultCurrency
                };

                var companySettings = new CompanySettings
                {
                    CompanyId = company.Id,
                    Currency = dto.DefaultCurrency,
                    CurrencySymbol = currencySymbol,
                    InvoiceLanguage = dto.DefaultLanguage
                };
                _context.CompanySettings.Add(companySettings);

                // 5. Mark invitation as used
                invitation.IsUsed = true;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Manager account created for {Email}, Company: {Company}", invitation.Email, dto.CompanyName);

                return Ok(new
                {
                    message = "Account created successfully. You can now log in.",
                    userId = newUser.Id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to complete invitation for {Email}", invitation.Email);
                return StatusCode(500, new { error = "An error occurred during account setup." });
            }
        }

        /// <summary>
        /// Generates a cryptographically secure invitation token (URL-safe).
        /// </summary>
        private static string GenerateInvitationToken()
        {
            var randomBytes = new byte[64];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);
            // Use URL-safe Base64 encoding
            return Convert.ToBase64String(randomBytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }
    }
}
