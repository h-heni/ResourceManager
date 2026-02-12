using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations;

/// <summary>
/// Performance indexes for multi-tenant query optimization.
/// Covers global query filter columns (CompanyId + IsDeleted) and frequently filtered/sorted columns.
/// </summary>

// ─── Shared-based entities: CompanyId + IsDeleted composite index (global query filter) ───

public class ClientIndexConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_Clients_CompanyId_IsDeleted");
    }
}

public class InvoiceIndexConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_Invoices_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_Invoices_Date");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("IX_Invoices_Status");
    }
}

public class DevisIndexConfiguration : IEntityTypeConfiguration<Devis>
{
    public void Configure(EntityTypeBuilder<Devis> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_Devis_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_Devis_Date");
    }
}

public class DeliveryNoteIndexConfiguration : IEntityTypeConfiguration<DeliveryNote>
{
    public void Configure(EntityTypeBuilder<DeliveryNote> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_DeliveryNotes_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_DeliveryNotes_Date");
    }
}

public class FournisseurIndexConfiguration : IEntityTypeConfiguration<Fournisseur>
{
    public void Configure(EntityTypeBuilder<Fournisseur> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_Fournisseurs_CompanyId_IsDeleted");
    }
}

public class FournisseurInvoiceIndexConfiguration : IEntityTypeConfiguration<FournisseurInvoice>
{
    public void Configure(EntityTypeBuilder<FournisseurInvoice> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_FournisseurInvoices_CompanyId_IsDeleted");
    }
}

public class OtherExpenseIndexConfiguration : IEntityTypeConfiguration<OtherExpense>
{
    public void Configure(EntityTypeBuilder<OtherExpense> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_OtherExpenses_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_OtherExpenses_Date");
    }
}

public class ProductServiceIndexConfiguration : IEntityTypeConfiguration<ProductService>
{
    public void Configure(EntityTypeBuilder<ProductService> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_ProductServices_CompanyId_IsDeleted");
    }
}

public class HistoricalRevenueIndexConfiguration : IEntityTypeConfiguration<HistoricalRevenue>
{
    public void Configure(EntityTypeBuilder<HistoricalRevenue> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_HistoricalRevenues_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_HistoricalRevenues_Date");
    }
}

public class HistoricalExpenseIndexConfiguration : IEntityTypeConfiguration<HistoricalExpense>
{
    public void Configure(EntityTypeBuilder<HistoricalExpense> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_HistoricalExpenses_CompanyId_IsDeleted");

        builder.HasIndex(e => e.Date)
            .HasDatabaseName("IX_HistoricalExpenses_Date");
    }
}

public class PendingInvoiceIndexConfiguration : IEntityTypeConfiguration<PendingInvoice>
{
    public void Configure(EntityTypeBuilder<PendingInvoice> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_PendingInvoices_CompanyId_IsDeleted");
    }
}

// ─── Non-Shared entities: targeted indexes ───

public class PaymentIndexConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.HasIndex(e => new { e.InvoiceId, e.Status })
            .HasDatabaseName("IX_Payments_InvoiceId_Status");
    }
}

public class SupplierPaymentIndexConfiguration : IEntityTypeConfiguration<SupplierPayment>
{
    public void Configure(EntityTypeBuilder<SupplierPayment> builder)
    {
        builder.HasIndex(e => new { e.FournisseurInvoiceId, e.Status })
            .HasDatabaseName("IX_SupplierPayments_FournisseurInvoiceId_Status");
    }
}

public class CompanySettingsIndexConfiguration : IEntityTypeConfiguration<CompanySettings>
{
    public void Configure(EntityTypeBuilder<CompanySettings> builder)
    {
        builder.HasIndex(e => e.CompanyId)
            .IsUnique()
            .HasDatabaseName("IX_CompanySettings_CompanyId");
    }
}

public class PdfFileRecordIndexConfiguration : IEntityTypeConfiguration<PdfFileRecord>
{
    public void Configure(EntityTypeBuilder<PdfFileRecord> builder)
    {
        builder.HasIndex(e => new { e.CompanyId, e.IsDeleted })
            .HasDatabaseName("IX_PdfFileRecords_CompanyId_IsDeleted");
    }
}
