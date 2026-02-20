
using Microsoft.AspNetCore.Http; // Needed to get current user
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ResourceManager.Models;
using System.Security.Claims;
using System.Reflection.Emit;
using ResourceManager.Services;
namespace ResourceManager.Data;


public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    // This variable will hold the CompanyId for the CURRENT request
    private readonly int _currentCompanyId;
    private readonly bool _isSuperAdmin;

    // Inject HttpContextAccessor to know WHO is logged in
    public AppDbContext(DbContextOptions options, IHttpContextAccessor httpContextAccessor)
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
        // 1. RESOLVE TENANT ID IN CONSTRUCTOR
        // This runs every time a page loads.
        var user = _httpContextAccessor.HttpContext?.User;
        var companyClaim = user?.FindFirst("CompanyId"); // Use string "CompanyId"
        _isSuperAdmin = user?.IsInRole("SuperAdmin") ?? false;

        if (companyClaim != null && int.TryParse(companyClaim.Value, out int companyId))
        {
            _currentCompanyId = companyId;
        }
        else
        {
            // If not logged in (or SuperAdmin), 0 means "No Filter" or "No Company"
            _currentCompanyId = 0;
        }
    }

    public DbSet<Client> Clients { get; set; }
    public DbSet<Invoice> Invoices { get; set; }
    public DbSet<DeliveryNote> DeliveryNotes { get; set; }
    public DbSet<Quote> Quotes { get; set; }
    public DbSet<InvoiceItem> InvoiceItems { get; set; }
    public DbSet<DeliveryNoteItem> DeliveryNoteItems { get; set; }
    public DbSet<QuoteItem> QuoteItems { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<Supplier> Suppliers { get; set; }
    public DbSet<SupplierInvoice> SupplierInvoices { get; set; }
    public DbSet<SupplierInvoiceItem> SupplierInvoiceItems { get; set; }
    public DbSet<SupplierPayment> SupplierPayments { get; set; }
    public DbSet<Company> Companies { get; set; }
    public DbSet<UserProfile> UserProfiles { get; set; }
    public DbSet<InvoiceEmail> InvoiceEmails { get; set; }
    public DbSet<CompanySettings> CompanySettings { get; set; }
    public DbSet<PdfFileRecord> PdfFileRecords { get; set; }
    public DbSet<ResourceManager.Services.PaymentNotification> PaymentNotifications { get; set; } 
    public DbSet<OtherExpense> OtherExpenses { get; set; }
    public DbSet<ProductService> ProductServices { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserLoginRecord> UserLoginRecords { get; set; }
    public DbSet<ManagerInvitation> ManagerInvitations { get; set; }
    public DbSet<HistoricalRevenue> HistoricalRevenues { get; set; }
    public DbSet<HistoricalExpense> HistoricalExpenses { get; set; }
    public DbSet<PendingInvoice> PendingInvoices { get; set; }
    public DbSet<EmailAuditLog> EmailAuditLogs { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        // 2. APPLY GLOBAL QUERY FILTER
        // We use the fields `_currentCompanyId` and `_isSuperAdmin` inside the lambda. 
        // EF Core is smart enough to read the value from the instance.

        // Fix: Apply filter ALWAYS. Control bypass via expression.
        
        // Apply to ALL tables that inherit from Shared (or have CompanyId)
        // Expression: (SuperAdmin OR User matches Company) AND NotDeleted
        // Wait, strictly: If SuperAdmin, showing deleted might be okay, but let's be consistent.
        // Let's assume SuperAdmin wants to see ALL companies data, but respecter IsDeleted for now unless manually requested.
        // Actually, let's keep it simple: SuperAdmin sees EVERYTHING (including deleted). 
        // Normal users see ONLY their Company AND NotDeleted.
        
        builder.Entity<Client>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<Invoice>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<DeliveryNote>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<Quote>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<Supplier>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<SupplierInvoice>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<PdfFileRecord>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<OtherExpense>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<ProductService>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<HistoricalRevenue>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<HistoricalExpense>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));
        builder.Entity<CompanySettings>().HasQueryFilter(e => _isSuperAdmin || e.CompanyId == _currentCompanyId);
        builder.Entity<PendingInvoice>().HasQueryFilter(e => _isSuperAdmin || (e.CompanyId == _currentCompanyId && !e.IsDeleted));

        // Matching query filters for dependent entities with required FK to a filtered parent
        // (prevents EF Core warning about required-end relationship with global-filtered entity)
        builder.Entity<Payment>().HasQueryFilter(p => _isSuperAdmin || p.Invoice!.CompanyId == _currentCompanyId);
        builder.Entity<InvoiceEmail>().HasQueryFilter(e => _isSuperAdmin || e.Invoice!.CompanyId == _currentCompanyId);
        builder.Entity<SupplierInvoiceItem>().HasQueryFilter(i => _isSuperAdmin || i.SupplierInvoice!.CompanyId == _currentCompanyId);
        builder.Entity<SupplierPayment>().HasQueryFilter(p => _isSuperAdmin || p.SupplierInvoice!.CompanyId == _currentCompanyId);

        builder.Entity<HistoricalRevenue>()
            .HasOne(e => e.Invoice)
            .WithMany()
            .HasForeignKey(e => e.InvoiceId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<HistoricalRevenue>()
            .HasIndex(e => e.InvoiceId);

        builder.Entity<HistoricalRevenue>()
            .HasIndex(e => new { e.CompanyId, e.InvoiceId })
            .IsUnique()
            .HasFilter("\"InvoiceId\" IS NOT NULL");

        // RefreshToken indexes for fast lookup
        builder.Entity<RefreshToken>().HasIndex(e => e.Token).IsUnique();
        builder.Entity<RefreshToken>().HasIndex(e => e.UserId);

        // UserLoginRecord indexes
        builder.Entity<UserLoginRecord>().HasIndex(e => e.UserId);
        builder.Entity<UserLoginRecord>().HasIndex(e => e.IpAddress);

        // ManagerInvitation indexes
        builder.Entity<ManagerInvitation>().HasIndex(e => e.Token).IsUnique();
        builder.Entity<ManagerInvitation>().HasIndex(e => e.Email);

        // Business document number uniqueness per company
        builder.Entity<Invoice>()
            .HasIndex(e => new { e.CompanyId, e.Number })
            .IsUnique();
        builder.Entity<Quote>()
            .HasIndex(e => new { e.CompanyId, e.Number })
            .IsUnique();
    }

    // 3. AUTO-FILL COMPANY ID ON SAVE
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {

        // 1. Get the current User's ID and Company ID from the HTTP Context
        // We grab these once so we don't look them up inside the loop (Optimization)
        var user = _httpContextAccessor.HttpContext?.User;

        // Get Company ID (int)
        int currentCompanyId = 0;
        var companyClaim = user?.FindFirst("CompanyId");
        if (companyClaim != null) int.TryParse(companyClaim.Value, out currentCompanyId);

        // Get User ID (string)
        string? currentUserId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        string? currentUserFirstName = user?.FindFirst("FirstName")?.Value
            ?? user?.FindFirst(ClaimTypes.GivenName)?.Value;

        // 2. Look at the Change Tracker
        var addedEntities = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added); // Only new items

        foreach (var entry in addedEntities)
        {
            // --- STAMP 1: COMPANY ID ---
            // Check if the object has a "CompanyId" property
            var companyProp = entry.Entity.GetType().GetProperty("CompanyId");

            // Only run this logic if the User is logged in (currentCompanyId != 0)
            // AND the entity actually has a CompanyId property
            if (companyProp != null && currentCompanyId != 0)
            {
                // 1. Check what value is CURRENTLY inside the object
                var currentValue = companyProp.GetValue(entry.Entity);

                // 2. Convert to int safely (handle nulls if nullable)
                int currentIdValue = 0;
                if (currentValue != null)
                {
                    int.TryParse(currentValue.ToString(), out currentIdValue);
                }

                // 3. THE FIX: Only overwrite if it is 0 (Default/Empty)
                // If you manually set it to 'newCompany.Id' in your controller, we respect that.
                if (currentIdValue == 0)
                {
                    companyProp.SetValue(entry.Entity, currentCompanyId);
                }
            }

            // --- STAMP 2: USER ID (AUDIT) ---
            // Check if the object has a "CreatedByUserId" or "UserId" property
            // Note: Make sure your Shared class uses "CreatedByUserId"
            var userProp = entry.Entity.GetType().GetProperty("CreatedByUserId");
            if (userProp != null && !string.IsNullOrEmpty(currentUserId))
            {
                // Force the value to the logged-in user
                userProp.SetValue(entry.Entity, currentUserId);
            }

            var createdByNameProp = entry.Entity.GetType().GetProperty("CreatedBy");
            if (createdByNameProp != null && !string.IsNullOrWhiteSpace(currentUserFirstName))
            {
                createdByNameProp.SetValue(entry.Entity, currentUserFirstName);
            }

            // --- STAMP 3: CREATED DATE ---
            // While we are here, let's auto-set the date too!
            var dateProp = entry.Entity.GetType().GetProperty("CreatedAt");
            if (dateProp != null)
            {
                dateProp.SetValue(entry.Entity, DateTime.UtcNow);
            }
        }

        var modifiedEntities = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified);

        foreach (var entry in modifiedEntities)
        {
            var updatedAtProp = entry.Entity.GetType().GetProperty("UpdatedAt");
            if (updatedAtProp != null)
            {
                updatedAtProp.SetValue(entry.Entity, DateTime.UtcNow);
            }

            var modifiedByNameProp = entry.Entity.GetType().GetProperty("ModifiedBy");
            if (modifiedByNameProp != null && !string.IsNullOrWhiteSpace(currentUserFirstName))
            {
                modifiedByNameProp.SetValue(entry.Entity, currentUserFirstName);
            }
        }

        // 3. Send to Database
        return base.SaveChangesAsync(cancellationToken);
    }

}
