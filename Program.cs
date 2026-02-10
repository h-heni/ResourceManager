using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
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
using System.Threading.RateLimiting;

// 1. Timezone Fix for Postgres
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// 2. SERILOG (Logs to Console + File + InMemory sink for admin dashboard)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .WriteTo.Sink(new InMemoryLogSink())
    .CreateLogger();

builder.Host.UseSerilog();

// 3. DATABASE — PostgreSQL always (Dev via appsettings, Prod via env vars)
var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("No connection string configured. Set CONNECTION_STRING env var or ConnectionStrings:DefaultConnection in appsettings.");

Log.Information("Database: PostgreSQL | Connection source: {Source}",
    Environment.GetEnvironmentVariable("CONNECTION_STRING") != null ? "ENV" : "appsettings");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
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
});

// Auth0 OpenID Connect Configuration (only register if Auth0 credentials are configured)
var auth0ClientId = builder.Configuration["Auth0:ClientId"];
if (!string.IsNullOrEmpty(auth0ClientId) && auth0ClientId != "YOUR_AUTH0_CLIENT_ID")
{
    builder.Services.AddAuthentication()
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
}
else
{
    Console.WriteLine("⚠️  Auth0 not configured — OIDC login disabled. Set Auth0:ClientId to enable.");
}

// 6. MVC & API
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

// HTTP client factory (for IP geolocation API)
builder.Services.AddHttpClient();

// ── Admin Observability Services (Singletons — shared app-wide) ──
builder.Services.AddSingleton<AppMetricsService>();
builder.Services.AddSingleton<SessionTrackerService>();
builder.Services.AddSingleton<SecurityAlertService>();
builder.Services.AddScoped<UserCountryService>();

// CORS (Restrict to known origins — no wildcard in production)
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "https://localhost:5173" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", b => b
        .WithOrigins(allowedOrigins)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials()); // Required for HttpOnly cookie refresh tokens
});

// Your Custom Services
builder.Services.AddScoped<SupabaseStorageService>();

// Email Service
builder.Services.AddScoped<ResourceManager.Services.IEmailService, ResourceManager.Services.EmailService>();

// Gmail OAuth Service (NO App Passwords - uses OAuth 2.0)
builder.Services.AddScoped<ResourceManager.Services.IGmailOAuthService, ResourceManager.Services.GmailOAuthService>();

// Local PDF Storage Service
builder.Services.AddScoped<ResourceManager.Services.ILocalPdfStorageService, ResourceManager.Services.LocalPdfStorageService>();

// Fournisseur PDF Scanner Service (Part 4: PDF Upload + Data Extraction)
builder.Services.AddScoped<ResourceManager.Services.IFournisseurPdfScannerService, ResourceManager.Services.FournisseurPdfScannerService>();

// Due Payment Processor (scoped service — called on-demand + by background worker)
builder.Services.AddScoped<ResourceManager.Services.IDuePaymentProcessor, ResourceManager.Services.DuePaymentProcessorService>();

// Background Service for Scheduled Payments (safety net — runs every 15 min)
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

// RATE LIMITING (per-IP + per-user + endpoint-specific)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "30";
        Log.Warning("Rate limit exceeded for {IP} on {Path}",
            context.HttpContext.Connection.RemoteIpAddress, context.HttpContext.Request.Path);
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Please try again later." }, ct);
    };

    // Global per-IP limiter (fallback)
    options.AddPolicy("PerIp", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Strict limiter for auth endpoints (login, signup, password reset)
    options.AddPolicy("AuthStrict", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5),
                SegmentsPerWindow = 5,
                QueueLimit = 0
            }));

    // Moderate limiter for search/list endpoints
    options.AddPolicy("Moderate", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Higher limit for dashboard/read-only
    options.AddPolicy("ReadHeavy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 200,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// RESPONSE COMPRESSION (gzip + brotli)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = new[]
    {
        "application/json",
        "text/plain",
        "text/html",
        "application/xml",
        "text/xml"
    };
});

// IN-MEMORY CACHE for dashboard/read-heavy data
builder.Services.AddMemoryCache();

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
        // Auto-apply pending EF migrations at startup
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
        if (pendingMigrations.Any())
        {
            Log.Information("Applying {Count} pending migration(s)...", pendingMigrations.Count());
            await db.Database.MigrateAsync();
            Log.Information("Migrations applied successfully.");
        }

        // Seed admin user if missing
        await SeedDatabase.SeedDatabaseSuperAdmin(app);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error during database migration/seeding.");
    }
}

// 10. MIDDLEWARE PIPELINE (Traffic Control)

// Response compression (must be first)
app.UseResponseCompression();

// Metrics middleware (tracks request timing + errors)
app.UseMiddleware<MetricsMiddleware>();

// Security monitoring middleware (rate + IP anomaly detection)
app.UseMiddleware<SecurityMonitoringMiddleware>();

// HTTPS redirection
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
    app.UseHsts();
}

// Security headers middleware
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
    headers["X-XSS-Protection"] = "1; mode=block";
    // CSP: allow self + inline styles for Tailwind, block everything else
    headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';";
    await next();
});

// Global error handler — returns JSON for API errors (no stack traces)
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        var correlationId = Guid.NewGuid().ToString("N")[..12];
        Log.Error("Unhandled exception [CorrelationId={CorrelationId}]", correlationId);
        await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred.", correlationId });
    });
});

// Swagger (ONLY in Development)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Resource Manager API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseStaticFiles(); // Load CSS/Images

app.UseSerilogRequestLogging(); // Log every request

app.UseRouting();

app.UseCors("Default");

// Rate limiting (after routing, before auth)
app.UseRateLimiter();

// The Security Checkpoint
app.UseAuthentication(); 
app.UseAuthorization();  

// Session tracking middleware (tracks active authenticated users)
app.UseMiddleware<SessionTrackingMiddleware>();

// Health check endpoint for Docker/K8s
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .AllowAnonymous()
   .WithTags("Health");

// Endpoints
app.MapControllers();

app.Run();