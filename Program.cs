using Microsoft.AspNetCore.Authentication.JwtBearer;
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

// Load .env file if present (local development — Docker uses compose env vars)
var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envFile))
{
    foreach (var line in File.ReadAllLines(envFile))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#')) continue;
        var eqIdx = trimmed.IndexOf('=');
        if (eqIdx <= 0) continue;
        var key = trimmed[..eqIdx].Trim();
        var val = trimmed[(eqIdx + 1)..].Trim();
        // Only set if not already defined (system env vars take precedence)
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            Environment.SetEnvironmentVariable(key, val);
    }
}

var builder = WebApplication.CreateBuilder(args);

// 2. SERILOG (Logs to Console + File + InMemory sink for admin dashboard)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
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
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        // Split multi-Include queries into separate SQL queries to avoid cartesian explosion
        npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
        // Connection resiliency: retry transient failures (network blips, connection pool exhaustion)
        npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        // Command timeout for long-running queries (30s default, increase if needed)
        npgsqlOptions.CommandTimeout(30);
    });
});

// This enables UserManager, RoleManager, and links them to EF Core
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Password policy: 8+ chars with digit + uppercase + special character
    options.Password.RequiredLength = 8;
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredUniqueChars = 4;
    // Lockout: 5 failed attempts → 30-second lockout (matches rate-limiter RetryAfter)
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromSeconds(30);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// 5. AUTHENTICATION (JWT Bearer only — Auth0 temporarily disabled)
// Resolve JWT key: env var JWT_KEY > Jwt__Key > appsettings Jwt:Key
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT Key not configured. Set JWT_KEY env var or Jwt:Key in appsettings.");

if (jwtKey.Length < 32)
    throw new InvalidOperationException("JWT Key must be at least 32 characters for security. Current length: " + jwtKey.Length);

// Write resolved key back so IConfiguration reads it everywhere consistently
builder.Configuration["Jwt:Key"] = jwtKey;

Log.Information("JWT key source: {Source}, length: {Length}",
    Environment.GetEnvironmentVariable("JWT_KEY") != null ? "ENV" : "appsettings",
    jwtKey.Length);

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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
    };
});

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

// Distributed Cache (Redis with in-memory fallback)
builder.Services.AddRedisCache(builder.Configuration);

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
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .WithHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Brevo-Secret")
        .WithExposedHeaders("Retry-After", "X-Correlation-Id")
        .AllowCredentials() // Required for HttpOnly cookie refresh tokens
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));
});

// Your Custom Services
builder.Services.AddScoped<SupabaseStorageService>();

// Email Service (legacy System.Net.Mail - fallback)
builder.Services.AddScoped<ResourceManager.Services.IEmailService, ResourceManager.Services.EmailService>();

// MailKit Email Service (production-grade SMTP with templates, audit logging)
// Uses local domain SMTP - no third-party dependencies
builder.Services.AddScoped<ResourceManager.Services.IMailKitEmailService, ResourceManager.Services.MailKitEmailService>();

// Local PDF Storage Service
builder.Services.AddScoped<ResourceManager.Services.ILocalPdfStorageService, ResourceManager.Services.LocalPdfStorageService>();

// DB-compressed blob storage for supplier invoice files (GZip-compressed BYTEA in PostgreSQL)
builder.Services.AddScoped<ResourceManager.Services.IDbFileStorageService, ResourceManager.Services.DbFileStorageService>();

// WhatsApp Cloud API Service (Meta Business Platform)
builder.Services.AddHttpClient<ResourceManager.Services.IWhatsAppService, ResourceManager.Services.WhatsAppService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Short-lived signed tokens for anonymous PDF access (WhatsApp document delivery)
builder.Services.AddSingleton<ResourceManager.Services.IPdfTokenService, ResourceManager.Services.PdfTokenService>();

// Supplier PDF Scanner Service (Part 4: PDF Upload + Data Extraction)
builder.Services.AddScoped<ResourceManager.Services.ISupplierPdfScannerService, ResourceManager.Services.SupplierPdfScannerService>();

// Groq Vision LLM — structured invoice extraction (preferred over Tesseract regex)
builder.Services.AddHttpClient<ResourceManager.Services.IGeminiInvoiceExtractor, ResourceManager.Services.GeminiInvoiceExtractor>();

// Inventory Management Service
builder.Services.AddScoped<ResourceManager.Services.InventoryService>();

// Due Payment Processor — DISABLED: payments stay Pending until manually approved
// builder.Services.AddScoped<ResourceManager.Services.IDuePaymentProcessor, ResourceManager.Services.DuePaymentProcessorService>();

// Background Service for Scheduled Payments — DISABLED: no auto-completion
// builder.Services.AddHostedService<ResourceManager.Services.ScheduledPaymentService>();

// Refresh token cleanup — purges expired/revoked tokens older than 7 days (daily)
builder.Services.AddHostedService<ResourceManager.Services.RefreshTokenCleanupService>();

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
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Strict limiter for auth endpoints (login, signup, password reset)
    // Fixed window of 30 seconds — matches the RetryAfter header sent to clients
    options.AddPolicy("AuthStrict", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(30),
                QueueLimit = 0
            }));

    // Moderate limiter for search/list endpoints (SPA fires 10+ concurrent calls per page load)
    options.AddPolicy("Moderate", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 200,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Higher limit for dashboard/read-only
    options.AddPolicy("ReadHeavy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 400,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Very strict limiter for unauthenticated token validation endpoints
    // (invitation/validate, password-reset/confirm, etc.) to prevent token enumeration.
    options.AddPolicy("TokenValidation", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
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

// HSTS options (1 year, includeSubDomains, preload)
builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
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

// HTTPS redirection + HSTS — toggleable for staged HTTPS rollout.
// Default: ON in non-Development. Disable only with Security:DisableHttps=true (dev/HTTP-only fallback).
var disableHttps = builder.Configuration.GetValue<bool>("Security:DisableHttps", false);
if (!app.Environment.IsDevelopment() && !disableHttps)
{
    app.UseHsts(); // 30-day HSTS by default; configure via builder.Services.Configure<HstsOptions> if needed
    app.UseHttpsRedirection();
}
else if (!app.Environment.IsDevelopment() && disableHttps)
{
    Log.Warning("SECURITY: HTTPS redirection + HSTS are DISABLED via Security:DisableHttps=true. This is unsafe; enable HTTPS as soon as TLS is configured.");
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
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Cross-Origin-Resource-Policy"] = "same-site";
    // CSP: allow self + inline styles for Tailwind + blob: for uploaded logo/signature previews; frame-src blob: for the PDF preview iframe
    headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';";
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

// Subscription lockout middleware (blocks expired/suspended accounts)
app.UseMiddleware<SubscriptionLockoutMiddleware>();

// Health check handled by HealthController (includes DB connectivity check)

// Endpoints
app.MapControllers();

app.Run();