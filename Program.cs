using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ResourceManager.Data;
using ResourceManager.Infrastructure;
using ResourceManager.Models;
using ResourceManager.Services;
using Serilog;
using System.Security.Claims;
using System.Text;

// 1. Timezone Fix for Postgres
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// 2. SERILOG (Logs to Console + File)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 3. DATABASE - Support both SQLite (local dev) and PostgreSQL (cloud)
var databaseProvider = builder.Configuration["DatabaseProvider"] ?? "PostgreSQL";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (databaseProvider.Equals("SQLite", StringComparison.OrdinalIgnoreCase))
    {
        Log.Information("Using SQLite database for local development");
        options.UseSqlite(connectionString);
    }
    else
    {
        Log.Information("Using PostgreSQL database");
        options.UseNpgsql(connectionString);
    }
});

// This enables UserManager, RoleManager, and links them to EF Core
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false; // Adjust as needed
    options.Password.RequiredLength = 6;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// 5. AUTHENTICATION (Hybrid: JWT Bearer + Auth0 OIDC)
builder.Services.AddAuthentication(options =>
{
    // Default to JWT Bearer for API requests
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultSignInScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured"))),
    };
})
// Auth0 OpenID Connect Configuration
.AddOpenIdConnect("Auth0", options =>
{
    var auth0Config = builder.Configuration.GetSection("Auth0");
    
    options.Authority = $"https://{auth0Config["Domain"]}";
    options.ClientId = auth0Config["ClientId"];
    options.ClientSecret = auth0Config["ClientSecret"];
    
    options.ResponseType = "code";
    options.CallbackPath = new PathString(auth0Config["CallbackPath"] ?? "/callback");
    options.ClaimsIssuer = "Auth0";
    
    options.SaveTokens = true;
    options.GetClaimsFromUserInfoEndpoint = true;

    // Configure scopes
    options.Scope.Clear();
    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.Scope.Add("email");

    // Map Auth0 claims to standard claims
    options.TokenValidationParameters = new TokenValidationParameters
    {
        NameClaimType = ClaimTypes.Name,
        RoleClaimType = ClaimTypes.Role
    };

    options.Events = new OpenIdConnectEvents
    {
        // Handle token validation to add CompanyId claim for multi-tenancy
        OnTokenValidated = async context =>
        {
            if (context.Principal?.Identity is ClaimsIdentity identity)
            {
                var email = identity.FindFirst(ClaimTypes.Email)?.Value;
                if (!string.IsNullOrEmpty(email))
                {
                    // Look up user in database and add CompanyId claim
                    var userManager = context.HttpContext.RequestServices
                        .GetRequiredService<UserManager<ApplicationUser>>();
                    var user = await userManager.FindByEmailAsync(email);
                    if (user != null)
                    {
                        identity.AddClaim(new Claim("CompanyId", user.CompanyId.ToString()));
                        var roles = await userManager.GetRolesAsync(user);
                        foreach (var role in roles)
                        {
                            identity.AddClaim(new Claim(ClaimTypes.Role, role));
                        }
                    }
                }
            }
        },
        OnRedirectToIdentityProviderForSignOut = context =>
        {
            var logoutUri = $"https://{builder.Configuration["Auth0:Domain"]}/v2/logout?" +
                $"client_id={builder.Configuration["Auth0:ClientId"]}&" +
                $"returnTo={Uri.EscapeDataString(context.Request.Scheme + "://" + context.Request.Host)}";
            context.Response.Redirect(logoutUri);
            context.HandleResponse();
            return Task.CompletedTask;
        }
    };
});

// 6. MVC & API
builder.Services.AddRazorPages();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Prevents error if Object A -> Object B -> Object A
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// 7. CORE SERVICES (Dependency Injection)
builder.Services.AddHttpContextAccessor(); // Critical for Multi-tenancy

// Clean Architecture - Infrastructure layer services
builder.Services.AddInfrastructure<AppDbContext>();

// Health Checks
builder.Services.AddHealthChecks();

// CORS (Allow Mobile App access)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        b => b.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// Your Custom Services
builder.Services.AddScoped<GoogleIntegrationService>();
builder.Services.AddScoped<SupabaseStorageService>();

// Email Service
builder.Services.AddScoped<ResourceManager.Services.IEmailService, ResourceManager.Services.EmailService>();

// Gmail OAuth Service (NO App Passwords - uses OAuth 2.0)
builder.Services.AddScoped<ResourceManager.Services.IGmailOAuthService, ResourceManager.Services.GmailOAuthService>();

// Local PDF Storage Service
builder.Services.AddScoped<ResourceManager.Services.ILocalPdfStorageService, ResourceManager.Services.LocalPdfStorageService>();

// Fournisseur PDF Scanner Service (Part 4: PDF Upload + Data Extraction)
builder.Services.AddScoped<ResourceManager.Services.IFournisseurPdfScannerService, ResourceManager.Services.FournisseurPdfScannerService>();

// Background Service for Scheduled Payments
builder.Services.AddHostedService<ResourceManager.Services.ScheduledPaymentService>();

// Supabase Client Configuration
builder.Services.AddScoped<Supabase.Client>(provider =>
{
    var config = provider.GetRequiredService<IConfiguration>();
    return new Supabase.Client(
        config["Supabase:Url"] ?? throw new InvalidOperationException("Supabase URL not configured"), 
        config["Supabase:Key"], 
        new Supabase.SupabaseOptions
        {
            AutoRefreshToken = true,
            AutoConnectRealtime = false
        });
});
// This registers the system's real clock as the default
builder.Services.AddSingleton(TimeProvider.System);
// Caching
builder.Services.AddOutputCache();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// 8. SWAGGER (Documentation)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Resource Manager API", Version = "v1" });

    // Add JWT Lock icon in Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your token here"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[] {}
        }
    });
});

// ==========================================
// BUILD THE APP
// ==========================================
var app = builder.Build();

// 9. SEED DATABASE (Create Admin user if missing)
// We run this inside a scope
using (var scope = app.Services.CreateScope())
{
    try
    {
        // Just call your helper class here
        await SeedDatabase.SeedDatabaseSuperAdmin(app);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error during database seeding.");
    }
}

// 10. MIDDLEWARE PIPELINE (Traffic Control)

app.UseExceptionHandler("/Error"); // Handle crashes gracefully

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Swagger (Available in Dev and Prod for now)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Resource Manager API v1");
    // Optional: This makes Swagger appear at the root url (localhost:7175/)
    c.RoutePrefix = string.Empty; 

});

app.UseStaticFiles(); // Load CSS/Images

app.UseSerilogRequestLogging(); // Log every request

app.UseRouting();

app.UseCors("AllowAll");

app.UseSession(); // Must be before Auth

// The Security Checkpoint
app.UseAuthentication(); 
app.UseAuthorization();  

app.UseOutputCache();

// Health check endpoint for Docker/K8s
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .AllowAnonymous()
   .WithTags("Health");

// Endpoints
app.MapRazorPages();
app.MapControllers();

app.Run();