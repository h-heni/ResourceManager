using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Dtos;
using System.Security.Claims;
using ResourceManager.DTOs;

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "SuperAdmin,Manager,FreeUser")]
    public class UsersController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly AppDbContext _context;

        public UsersController(UserManager<ApplicationUser> userManager, AppDbContext context)
        {
            _userManager = userManager;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
                return Unauthorized("No user identifier found in token.");
                
            var currentUser = await _userManager.FindByIdAsync(currentUserId);
            if (currentUser == null)
                return Unauthorized("User not found.");
                
            var currentRoles = await _userManager.GetRolesAsync(currentUser);

            if (currentRoles.Contains("SuperAdmin"))
            {
                // SuperAdmin sees ALL (excluding soft-deleted users)
                var users = await _userManager.Users
                    .Include(u => u.Profile)
                    .Include(u => u.Company)
                    .Where(u => u.Profile == null || !u.Profile.IsDeleted)
                    .ToListAsync();
                    
                var result = new List<object>();
                foreach (var u in users)
                {
                    var roles = await _userManager.GetRolesAsync(u);
                    result.Add(new 
                    {
                        u.Id,
                        u.Email,
                        FirstName = u.Profile?.FirstName ?? "",
                        LastName = u.Profile?.LastName ?? "",
                        Company = u.Company?.Name ?? "N/A",
                        CompanyId = u.CompanyId,
                        Role = roles.FirstOrDefault() ?? "Employee"
                    });
                }
               return Ok(result);
            }
            else
            {
                // Manager/FreeUser sees ONLY their company's employees (excluding soft-deleted)
                var companyId = currentUser.CompanyId;
                var users = await _userManager.Users
                    .Where(u => u.CompanyId == companyId)
                    .Where(u => u.Profile == null || !u.Profile.IsDeleted)
                    .Include(u => u.Profile)
                    .ToListAsync();
                    
                var result = new List<object>();
                foreach (var u in users)
                {
                    var roles = await _userManager.GetRolesAsync(u);
                    result.Add(new 
                    {
                        u.Id,
                        u.Email,
                        FirstName = u.Profile?.FirstName ?? "",
                        LastName = u.Profile?.LastName ?? "",
                        Role = roles.FirstOrDefault() ?? "Employee"
                    });
                }
                return Ok(result);
            }
        }

        /// <summary>
        /// Soft delete a user. SuperAdmin can delete any user, Manager can delete employees from their company.
        /// The user's work (invoices, etc.) remains intact with CreatedByUserId preserved.
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
                return Unauthorized("No user identifier found in token.");

            var currentUser = await _userManager.FindByIdAsync(currentUserId);
            if (currentUser == null)
                return Unauthorized("User not found.");

            var currentRoles = await _userManager.GetRolesAsync(currentUser);
            var isSuperAdmin = currentRoles.Contains("SuperAdmin");
            var isManager = currentRoles.Contains("Manager") || currentRoles.Contains("FreeUser");

            // Find target user
            var targetUser = await _userManager.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (targetUser == null)
                return NotFound("User not found.");

            // Prevent self-deletion
            if (targetUser.Id == currentUserId)
                return BadRequest("You cannot delete your own account.");

            var targetRoles = await _userManager.GetRolesAsync(targetUser);

            // Authorization checks
            if (isSuperAdmin)
            {
                // SuperAdmin can delete anyone except other SuperAdmins
                if (targetRoles.Contains("SuperAdmin"))
                    return Forbid("Cannot delete another SuperAdmin.");
            }
            else if (isManager)
            {
                // Manager can only delete employees from their own company
                if (targetUser.CompanyId != currentUser.CompanyId)
                    return Forbid("You can only delete users from your own company.");
                
                // Manager cannot delete other managers
                if (targetRoles.Contains("Manager") || targetRoles.Contains("FreeUser"))
                    return Forbid("Managers cannot delete other managers.");
            }
            else
            {
                return Forbid("Insufficient permissions.");
            }

            // Soft delete: mark UserProfile as deleted
            if (targetUser.Profile != null)
            {
                targetUser.Profile.IsDeleted = true;
                targetUser.Profile.DeletedAt = DateTime.UtcNow;
            }
            else
            {
                // Create a profile to mark as deleted
                targetUser.Profile = new UserProfile
                {
                    UserId = targetUser.Id,
                    IsDeleted = true,
                    DeletedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _context.UserProfiles.Add(targetUser.Profile);
            }

            // Lock the account to prevent login
            await _userManager.SetLockoutEndDateAsync(targetUser, DateTimeOffset.MaxValue);

            await _context.SaveChangesAsync();

            return Ok(new { Message = "User deleted successfully. Their work records remain intact." });
        }

        /// <summary>
        /// Reset password for a user. SuperAdmin can reset any user's password,
        /// Manager can reset employee passwords from their company.
        /// </summary>
        [HttpPost("{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(string id, [FromBody] ResetPasswordDto dto)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
                return Unauthorized("No user identifier found in token.");

            var currentUser = await _userManager.FindByIdAsync(currentUserId);
            if (currentUser == null)
                return Unauthorized("User not found.");

            var currentRoles = await _userManager.GetRolesAsync(currentUser);
            var isSuperAdmin = currentRoles.Contains("SuperAdmin");
            var isManager = currentRoles.Contains("Manager") || currentRoles.Contains("FreeUser");

            // Find target user
            var targetUser = await _userManager.FindByIdAsync(id);
            if (targetUser == null)
                return NotFound("User not found.");

            var targetRoles = await _userManager.GetRolesAsync(targetUser);

            // Authorization checks
            if (isSuperAdmin)
            {
                // SuperAdmin can reset anyone's password
            }
            else if (isManager)
            {
                // Manager can only reset passwords for employees in their company
                if (targetUser.CompanyId != currentUser.CompanyId)
                    return Forbid("You can only reset passwords for users in your own company.");
                
                // Manager cannot reset other manager's passwords
                if (targetRoles.Contains("Manager") || targetRoles.Contains("FreeUser") || targetRoles.Contains("SuperAdmin"))
                    return Forbid("You cannot reset this user's password.");
            }
            else
            {
                return Forbid("Insufficient permissions.");
            }

            // Validate new password
            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
                return BadRequest("Password must be at least 6 characters.");

            // Reset password
            var token = await _userManager.GeneratePasswordResetTokenAsync(targetUser);
            var result = await _userManager.ResetPasswordAsync(targetUser, token, dto.NewPassword);

            if (!result.Succeeded)
                return BadRequest(result.Errors);

            return Ok(new { Message = "Password reset successfully." });
        }

        /// <summary>
        /// Update user details. SuperAdmin can update any user, Manager can update employees.
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserDto dto)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
                return Unauthorized("No user identifier found in token.");

            var currentUser = await _userManager.FindByIdAsync(currentUserId);
            if (currentUser == null)
                return Unauthorized("User not found.");

            var currentRoles = await _userManager.GetRolesAsync(currentUser);
            var isSuperAdmin = currentRoles.Contains("SuperAdmin");
            var isManager = currentRoles.Contains("Manager") || currentRoles.Contains("FreeUser");

            // Find target user
            var targetUser = await _userManager.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (targetUser == null)
                return NotFound("User not found.");

            var targetRoles = await _userManager.GetRolesAsync(targetUser);

            // Authorization checks
            if (!isSuperAdmin && isManager)
            {
                if (targetUser.CompanyId != currentUser.CompanyId)
                    return Forbid("You can only modify users in your own company.");
                
                if (targetRoles.Contains("Manager") || targetRoles.Contains("FreeUser") || targetRoles.Contains("SuperAdmin"))
                    return Forbid("You cannot modify this user.");
            }

            // Update profile
            if (targetUser.Profile != null)
            {
                if (!string.IsNullOrWhiteSpace(dto.FirstName))
                    targetUser.Profile.FirstName = dto.FirstName;
                if (!string.IsNullOrWhiteSpace(dto.LastName))
                    targetUser.Profile.LastName = dto.LastName;
                targetUser.Profile.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { Message = "User updated successfully." });
        }
    }

    public class ResetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UpdateUserDto
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }
}
