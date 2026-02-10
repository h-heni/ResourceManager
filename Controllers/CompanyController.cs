using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CompanyController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public CompanyController(AppDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        /// <summary>
        /// Setup company for users who signed up via Google (no company yet)
        /// </summary>
        [HttpPost("setup")]
        public async Task<IActionResult> Setup([FromBody] CompanySetupDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return NotFound("User not found");

            // Check if user already has a company
            if (user.CompanyId != 0)
                return BadRequest("User already has a company assigned");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Create new company
                var company = new Company
                {
                    Name = dto.CompanyName,
                    Address = dto.Address,
                    MatriculeFiscal = dto.MatriculeFiscal,
                    Phone = dto.Phone,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Companies.Add(company);
                await _context.SaveChangesAsync();

                // Link user to company
                user.CompanyId = company.Id;
                await _userManager.UpdateAsync(user);

                // Upgrade role to FreeUser if needed (they might already be)
                if (!await _userManager.IsInRoleAsync(user, "FreeUser"))
                {
                    await _userManager.AddToRoleAsync(user, "FreeUser");
                }

                await transaction.CommitAsync();

                return Ok(new { Message = "Company created successfully", CompanyId = company.Id });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Get current user's company details
        /// </summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMyCompany()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
            
            if (user == null || user.CompanyId == 0)
                return NotFound("No company found");

            var company = await _context.Companies.FindAsync(user.CompanyId);
            return Ok(company);
        }
    }

    public class CompanySetupDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }
}
