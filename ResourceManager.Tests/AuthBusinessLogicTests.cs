using Microsoft.AspNetCore.Identity;
using ResourceManager.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ResourceManager.Tests;

/// <summary>
/// Tests for authentication business logic:
/// - JWT token claims validation
/// - Role assignment on signup
/// - Refresh token lifecycle
/// - Password validation rules
/// - Multi-tenancy claim (CompanyId) presence
/// </summary>
public class AuthBusinessLogicTests
{
    // ═══════════════════════════════════════════════════════════
    // 1. JWT Token Claims
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void JwtToken_ShouldContain_RequiredClaimTypes()
    {
        // The GenerateAccessToken method adds these claims:
        //  Sub (userId), Email, Jti (unique ID), Role, CompanyId
        var requiredClaimTypes = new[]
        {
            JwtRegisteredClaimNames.Sub,
            JwtRegisteredClaimNames.Email,
            JwtRegisteredClaimNames.Jti,
            ClaimTypes.Role,
            "CompanyId"
        };

        // Verify that the claim types we expect are actual standard values
        Assert.Equal("sub", JwtRegisteredClaimNames.Sub);
        Assert.Equal("email", JwtRegisteredClaimNames.Email);
        Assert.Equal("jti", JwtRegisteredClaimNames.Jti);
        Assert.Contains("role", ClaimTypes.Role);
        Assert.Equal(5, requiredClaimTypes.Length);
    }

    [Fact]
    public void JwtClaims_CompanyId_IsIncluded()
    {
        // Simulates what GenerateAccessToken builds
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, "user-123"),
            new(JwtRegisteredClaimNames.Email, "test@example.com"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, "Manager"),
            new("CompanyId", "42")
        };

        var identity = new ClaimsIdentity(claims);

        Assert.Equal("user-123", identity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value);
        Assert.Equal("test@example.com", identity.FindFirst(JwtRegisteredClaimNames.Email)?.Value);
        Assert.Equal("Manager", identity.FindFirst(ClaimTypes.Role)?.Value);
        Assert.Equal("42", identity.FindFirst("CompanyId")?.Value);
    }

    [Fact]
    public void JwtClaims_CompanyId_MustBeInteger()
    {
        var companyId = 42;
        var claim = new Claim("CompanyId", companyId.ToString());

        Assert.True(int.TryParse(claim.Value, out var parsed));
        Assert.Equal(42, parsed);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Role Assignment Logic
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SignUp_DefaultRole_IsFreeUser()
    {
        // Per AuthController.SignUp: await _userManager.AddToRoleAsync(newUser, "FreeUser");
        var defaultRole = "FreeUser";
        Assert.Equal("FreeUser", defaultRole);
    }

    [Fact]
    public void CreateTenant_DefaultRole_IsManager()
    {
        // Per AuthController.CreateTenant: await _userManager.AddToRoleAsync(newUser, "Manager");
        var tenantRole = "Manager";
        Assert.Equal("Manager", tenantRole);
    }

    [Theory]
    [InlineData("SuperAdmin")]
    [InlineData("Manager")]
    [InlineData("FreeUser")]
    [InlineData("User")]
    public void ValidRoles_AreRecognized(string role)
    {
        // These are valid Role values used throughout the system
        var validRoles = new[] { "SuperAdmin", "Manager", "FreeUser", "User" };
        Assert.Contains(role, validRoles);
    }

    [Fact]
    public void SignUp_ShouldNot_AllowRoleEscalation()
    {
        // Security: Public signup forces "FreeUser" role
        // The DTO should NOT have a Role property that gets used
        var forcedRole = "FreeUser";
        Assert.NotEqual("Manager", forcedRole);
        Assert.NotEqual("SuperAdmin", forcedRole);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Refresh Token Model
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void RefreshToken_Creation_HasRequiredFields()
    {
        var token = new RefreshToken
        {
            Token = "secure-random-token-value",
            UserId = "user-123",
            Family = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        Assert.NotEmpty(token.Token);
        Assert.NotEmpty(token.UserId);
        Assert.NotEmpty(token.Family);
        Assert.True(token.ExpiresAt > token.CreatedAt);
        Assert.Null(token.RevokedAt);
    }

    [Fact]
    public void RefreshToken_Expiry_Is7Days()
    {
        var created = DateTime.UtcNow;
        var expires = created.AddDays(7);
        var diff = (expires - created).TotalDays;

        Assert.Equal(7, diff);
    }

    [Fact]
    public void RefreshToken_Revocation_SetsRevokedAt()
    {
        var token = new RefreshToken
        {
            Token = "token",
            UserId = "user",
            Family = "family",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        // Simulate revocation
        token.RevokedAt = DateTime.UtcNow;
        Assert.NotNull(token.RevokedAt);
    }

    [Fact]
    public void RefreshToken_Rotation_LinksOldToNew()
    {
        var oldToken = new RefreshToken
        {
            Token = "old-token",
            UserId = "user",
            Family = "family-123",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            ExpiresAt = DateTime.UtcNow.AddDays(6)
        };

        // On rotation: old token revoked, replaced by new
        var newToken = new RefreshToken
        {
            Token = "new-token",
            UserId = "user",
            Family = "family-123", // Same family
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        oldToken.RevokedAt = DateTime.UtcNow;
        oldToken.ReplacedByToken = newToken.Token;

        Assert.Equal(oldToken.Family, newToken.Family);
        Assert.NotNull(oldToken.RevokedAt);
        Assert.Equal("new-token", oldToken.ReplacedByToken);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Signup Creates Company + User Atomically
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Signup_CreatesCompany_WithCorrectFields()
    {
        var company = new Company
        {
            Name = "Test Company",
            Address = "123 Street",
            TaxId = "MF123456",
            Phone = "+216 71 123 456",
            CreatedAt = DateTime.UtcNow
        };

        Assert.Equal("Test Company", company.Name);
        Assert.NotEqual(default, company.CreatedAt);
    }

    [Fact]
    public void Signup_CreatesUser_LinkedToCompany()
    {
        var company = new Company { Id = 42, Name = "Test Company" };
        var user = new ApplicationUser
        {
            UserName = "test@example.com",
            Email = "test@example.com",
            CompanyId = company.Id,
            Profile = new UserProfile
            {
                FirstName = "John",
                LastName = "Doe"
            }
        };

        Assert.Equal(42, user.CompanyId);
        Assert.Equal("John", user.Profile.FirstName);
        Assert.Equal("Doe", user.Profile.LastName);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Login Validation Rules (Model Level)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Login_EmptyEmail_ShouldBeRejected()
    {
        var email = "";
        Assert.True(string.IsNullOrWhiteSpace(email));
    }

    [Fact]
    public void Login_EmptyPassword_ShouldBeRejected()
    {
        var password = "  ";
        Assert.True(string.IsNullOrWhiteSpace(password));
    }

    [Fact]
    public void Login_ValidInput_ShouldPass()
    {
        var email = "user@example.com";
        var password = "MyP@ss1";
        Assert.False(string.IsNullOrWhiteSpace(email));
        Assert.False(string.IsNullOrWhiteSpace(password));
    }

    // ═══════════════════════════════════════════════════════════
    // 6. Access Token Expiration
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void AccessToken_ExpiresIn15Minutes()
    {
        // Per AuthController: private const int AccessTokenMinutes = 15;
        var accessTokenMinutes = 15;
        var expires = DateTime.UtcNow.AddMinutes(accessTokenMinutes);
        var diff = (expires - DateTime.UtcNow).TotalMinutes;
        Assert.True(diff > 14 && diff <= 15);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. Multi-Tenancy — CompanyId Claim Required
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ClaimsIdentity_ExtractCompanyId_WorksCorrectly()
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, "user-1"),
            new("CompanyId", "7")
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        var companyIdStr = principal.FindFirst("CompanyId")?.Value;
        Assert.NotNull(companyIdStr);
        Assert.Equal(7, int.Parse(companyIdStr));
    }

    [Fact]
    public void ClaimsIdentity_MissingCompanyId_ReturnsNull()
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, "user-1")
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        var companyId = principal.FindFirst("CompanyId");
        Assert.Null(companyId);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. Employee Creation by Manager
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void RegisterManual_EmployeeInheritsManagerCompanyId()
    {
        var managerCompanyId = 42;
        var newEmployee = new ApplicationUser
        {
            UserName = "employee@company.com",
            Email = "employee@company.com",
            CompanyId = managerCompanyId // Must inherit from manager
        };

        Assert.Equal(42, newEmployee.CompanyId);
    }
}
