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
                var query = _userManager.Users
                    .Include(u => u.Profile)
                    .Include(u => u.Company)
                    .Where(u => u.Profile == null || !u.Profile.IsDeleted);

                var users = await query
                    .OrderByDescending(u => u.Profile != null ? u.Profile.CreatedAt : DateTime.MinValue)
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
                        Role = roles.FirstOrDefault() ?? "Employee",
                        EmployeeLimit = u.Company?.EmployeeLimit ?? 0,
                        SubscriptionExpiryDate = u.Company?.SubscriptionExpiryDate,
                        AccountStatus = u.Company?.AccountStatus.ToString() ?? "Active"
                    });
                }

                // Build per-company capacity summary
                var companies = await _context.Companies
                    .Where(c => !c.IsDeleted)
                    .Select(c => new
                    {
                        c.Id,
                        c.Name,
                        c.EmployeeLimit,
                        EmployeeCount = _context.Users.Count(u => u.CompanyId == c.Id),
                        c.SubscriptionExpiryDate,
                        AccountStatus = c.AccountStatus.ToString()
                    })
                    .OrderBy(c => c.Name)
                    .ToListAsync();

               return Ok(new { Data = result, Companies = companies });
            }
            else
            {
                // Manager/FreeUser sees ONLY their company's employees (excluding soft-deleted)
                var companyId = currentUser.CompanyId;

                // Fetch company capacity info
                var company = await _context.Companies.FindAsync(companyId);
                var employeeLimit = company?.EmployeeLimit ?? 0;

                var query = _userManager.Users
                    .Where(u => u.CompanyId == companyId)
                    .Where(u => u.Profile == null || !u.Profile.IsDeleted)
                    .Include(u => u.Profile);

                var users = await query
                    .OrderByDescending(u => u.Profile != null ? u.Profile.CreatedAt : DateTime.MinValue)
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
                return Ok(new { 
                    Data = result,
                    EmployeeLimit = employeeLimit,
                    EmployeeCount = result.Count
                });
            }
        }

        /// <summary>
        /// Delete a user. SuperAdmin performs full cascading delete (company + all data).
        /// Manager performs soft delete on employees.
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

            // ═══ SuperAdmin: Full cascading delete ═══
            if (isSuperAdmin && (targetRoles.Contains("Manager") || targetRoles.Contains("FreeUser")))
            {
                // Deleting a tenant owner → cascade-delete entire company + all data
                var companyId = targetUser.CompanyId;

                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    // 1. Delete all invoice items → payments → invoices
                    var invoiceIds = await _context.Invoices.IgnoreQueryFilters()
                        .Where(i => i.CompanyId == companyId).Select(i => i.Id).ToListAsync();
                    _context.InvoiceItems.RemoveRange(
                        await _context.InvoiceItems.IgnoreQueryFilters()
                            .Where(ii => ii.InvoiceId.HasValue && invoiceIds.Contains(ii.InvoiceId.Value)).ToListAsync());
                    _context.Payments.RemoveRange(
                        await _context.Payments.Where(p => invoiceIds.Contains(p.InvoiceId)).ToListAsync());
                    _context.InvoiceEmails.RemoveRange(
                        await _context.InvoiceEmails.Where(e => invoiceIds.Contains(e.InvoiceId)).ToListAsync());
                    _context.Invoices.RemoveRange(
                        await _context.Invoices.IgnoreQueryFilters()
                            .Where(i => i.CompanyId == companyId).ToListAsync());

                    // 2. Delete delivery note items → delivery notes
                    var dnIds = await _context.DeliveryNotes.IgnoreQueryFilters()
                        .Where(d => d.CompanyId == companyId).Select(d => d.Id).ToListAsync();
                    _context.DeliveryNoteItems.RemoveRange(
                        await _context.DeliveryNoteItems.IgnoreQueryFilters()
                            .Where(di => di.DeliveryNoteId.HasValue && dnIds.Contains(di.DeliveryNoteId.Value)).ToListAsync());
                    _context.DeliveryNotes.RemoveRange(
                        await _context.DeliveryNotes.IgnoreQueryFilters()
                            .Where(d => d.CompanyId == companyId).ToListAsync());

                    // 3. Delete quote items → quotes
                    var quoteIds = await _context.Quotes.IgnoreQueryFilters()
                        .Where(d => d.CompanyId == companyId).Select(d => d.Id).ToListAsync();
                    _context.QuoteItems.RemoveRange(
                        await _context.QuoteItems.IgnoreQueryFilters()
                            .Where(di => di.QuoteId.HasValue && quoteIds.Contains(di.QuoteId.Value)).ToListAsync());
                    _context.Quotes.RemoveRange(
                        await _context.Quotes.IgnoreQueryFilters()
                            .Where(d => d.CompanyId == companyId).ToListAsync());

                    // 4. Delete supplier invoice items → payments → supplier invoices
                    var siIds = await _context.SupplierInvoices.IgnoreQueryFilters()
                        .Where(si => si.CompanyId == companyId).Select(si => si.Id).ToListAsync();
                    _context.SupplierInvoiceItems.RemoveRange(
                        await _context.SupplierInvoiceItems.IgnoreQueryFilters()
                            .Where(sii => siIds.Contains(sii.SupplierInvoiceId)).ToListAsync());
                    _context.SupplierPayments.RemoveRange(
                        await _context.SupplierPayments.Where(sp => siIds.Contains(sp.SupplierInvoiceId)).ToListAsync());
                    _context.SupplierInvoices.RemoveRange(
                        await _context.SupplierInvoices.IgnoreQueryFilters()
                            .Where(si => si.CompanyId == companyId).ToListAsync());

                    // 5. Delete other expenses, clients, suppliers, products, PDF records
                    _context.OtherExpenses.RemoveRange(
                        await _context.OtherExpenses.IgnoreQueryFilters()
                            .Where(e => e.CompanyId == companyId).ToListAsync());
                    _context.Clients.RemoveRange(
                        await _context.Clients.IgnoreQueryFilters()
                            .Where(c => c.CompanyId == companyId).ToListAsync());
                    _context.Suppliers.RemoveRange(
                        await _context.Suppliers.IgnoreQueryFilters()
                            .Where(f => f.CompanyId == companyId).ToListAsync());
                    _context.ProductServices.RemoveRange(
                        await _context.ProductServices.IgnoreQueryFilters()
                            .Where(ps => ps.CompanyId == companyId).ToListAsync());
                    _context.PdfFileRecords.RemoveRange(
                        await _context.PdfFileRecords.IgnoreQueryFilters()
                            .Where(p => p.CompanyId == companyId).ToListAsync());

                    // 6. Delete payment notifications for this company's users
                    var companyUserIds = await _context.Users
                        .Where(u => u.CompanyId == companyId).Select(u => u.Id).ToListAsync();
                    _context.PaymentNotifications.RemoveRange(
                        await _context.PaymentNotifications
                            .Where(n => n.UserId != null && companyUserIds.Contains(n.UserId)).ToListAsync());

                    // 7. Delete company settings
                    _context.CompanySettings.RemoveRange(
                        await _context.CompanySettings.Where(s => s.CompanyId == companyId).ToListAsync());

                    // 8. Delete all company users (profiles + identity)
                    var companyUsers = await _context.Users
                        .Include(u => u.Profile)
                        .Where(u => u.CompanyId == companyId)
                        .ToListAsync();
                    foreach (var u in companyUsers)
                    {
                        if (u.Profile != null)
                            _context.UserProfiles.Remove(u.Profile);
                        await _userManager.DeleteAsync(u);
                    }

                    // 9. Delete the company itself
                    var company = await _context.Companies.FindAsync(companyId);
                    if (company != null)
                        _context.Companies.Remove(company);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = $"Tenant and all associated data deleted permanently." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { Message = $"Cascading delete failed: {ex.Message}" });
                }
            }
            else if (isSuperAdmin)
            {
                // SuperAdmin deleting an Employee: soft delete only
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

        /// <summary>
        /// Reset a Manager's settings (BaseStoragePath + IsProfileComplete).
        /// SuperAdmin only. Forces the Manager to re-configure from scratch.
        /// </summary>
        [HttpPost("{id}/reset-settings")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> ResetUserSettings(string id)
        {
            var targetUser = await _userManager.FindByIdAsync(id);
            if (targetUser == null)
                return NotFound("User not found.");

            var targetRoles = await _userManager.GetRolesAsync(targetUser);
            if (!targetRoles.Contains("Manager") && !targetRoles.Contains("FreeUser"))
                return BadRequest(new { Message = "Can only reset settings for Manager accounts." });

            var settings = await _context.CompanySettings
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.CompanyId == targetUser.CompanyId);

            if (settings == null)
                return NotFound(new { Message = "No settings found for this user's company." });

            settings.BaseStoragePath = null;
            settings.IsProfileComplete = false;
            settings.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "User settings reset. The Manager will be redirected to Settings on next login." });
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
