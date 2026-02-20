using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

public static class SeedDatabase
{
    public static async Task SeedDatabaseSuperAdmin(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var services = scope.ServiceProvider;

        try
        {
            // 1. Get Services
            var context = services.GetRequiredService<AppDbContext>();
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>(); // Or ApplicationRole if you switched

            // 2. Ensure Database is Created & Migrated
            await context.Database.MigrateAsync();

            // 3. Create Roles
            string[] roleNames = { "SuperAdmin", "Manager", "Employee", "FreeUser" };
            foreach (var roleName in roleNames)
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    await roleManager.CreateAsync(new IdentityRole(roleName));
                }
            }

            // 4. CREATE SYSTEM COMPANY (Critical Fix!)
            // We need a company for the SuperAdmin to belong to
            var adminCompany = await context.Companies.FirstOrDefaultAsync(c => c.Name == "SYSTEM");
            if (adminCompany == null)
            {
                adminCompany = new Company
                {
                    Name = "SYSTEM",
                    Address = "HQ",
                    TaxId = "000000",
                    Phone = "00000000",
                    CreatedAt = DateTime.UtcNow
                };
                context.Companies.Add(adminCompany);
                await context.SaveChangesAsync(); // Save to get the ID
            }

            // 5. Create SuperAdmin
            var adminEmail = "heni@ResourceManager.com";
            var adminUser = await userManager.FindByEmailAsync(adminEmail);

            if (adminUser == null)
            {
                var newAdmin = new ApplicationUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    EmailConfirmed = true,

                    // LINK TO THE SYSTEM COMPANY
                    CompanyId = adminCompany.Id,

                    Profile = new UserProfile
                    {
                        FirstName = "Heni",
                        LastName = "Hasnaoui"
                    }
                };

                var result = await userManager.CreateAsync(newAdmin, "April14@2024.ThingtoRemember@"); // Use a strong password in production!

                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(newAdmin, "SuperAdmin");
                    Console.WriteLine("✅ SuperAdmin Created Successfully!");
                }
                else
                {
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    Console.WriteLine($"❌ Error creating Admin: {errors}");
                }
            }

            
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ CRITICAL SEED ERROR: {ex.Message}");
        }
    }
}