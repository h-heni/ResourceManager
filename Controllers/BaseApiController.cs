using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResourceManager.Models;

namespace ResourceManager.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    [EnableRateLimiting("Moderate")]
    public abstract class BaseApiController : ControllerBase
    {
        /// <summary>
        /// Resolves the current authenticated user from the JWT claims.
        /// Returns null if the user is not authenticated or not found.
        /// </summary>
        protected async Task<ApplicationUser?> GetCurrentUserAsync(UserManager<ApplicationUser> userManager)
        {
            var userId = userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return null;
            return await userManager.FindByIdAsync(userId);
        }
    }
}
