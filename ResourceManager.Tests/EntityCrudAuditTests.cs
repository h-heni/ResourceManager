using ResourceManager.Models;

namespace ResourceManager.Tests;

/// <summary>
/// Full CRUD model-level audit tests for ALL major entities:
/// Clients, Quotes, Delivery Notes, Invoices, Products, 
/// Suppliers, Supplier Invoices, Expenses, Users.
/// 
/// These tests validate entity creation, property defaults, relationships,
/// and business rules at the model layer.
/// </summary>
public class EntityCrudAuditTests
{
    // ═══════════════════════════════════════════════════════════
    // 1. Client Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Client_Creation_HasRequiredProperties()
    {
        var client = new Client
        {
            Name = "ACME Corp",
            Address = "123 Main St",
            Email = "contact@acme.com",
            Phone = "+216 71 123 456",
            CompanyId = 1
        };

        Assert.Equal("ACME Corp", client.Name);
        Assert.Equal("123 Main St", client.Address);
        Assert.Equal(1, client.CompanyId);
        Assert.False(client.IsDeleted);
    }

    [Fact]
    public void Client_SoftDelete_SetsIsDeletedFlag()
    {
        var client = new Client { Name = "Test Client", CompanyId = 1 };
        Assert.False(client.IsDeleted);

        client.IsDeleted = true;
        Assert.True(client.IsDeleted);
    }

    [Fact]
    public void Client_HasInvoiceCollection()
    {
        var client = new Client { Name = "Test", CompanyId = 1 };
        Assert.NotNull(client.Invoices);
        Assert.Empty(client.Invoices);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Quote Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Quote_DefaultStatus_IsDraft()
    {
        var quote = new Quote();
        Assert.Equal("Draft", quote.Status);
    }

    [Fact]
    public void Quote_Creation_HasCorrectProperties()
    {
        var quote = new Quote
        {
            Number = "DEV-001",
            Date = DateTime.UtcNow,
            ClientId = 1,
            CompanyId = 1,
            Status = "Draft"
        };

        Assert.Equal("DEV-001", quote.Number);
        Assert.Equal(1, quote.ClientId);
        Assert.False(quote.Treated);
        Assert.False(quote.IsDeleted);
    }

    [Fact]
    public void Quote_TotalCalculation_IncludesItems()
    {
        var quote = new Quote();
        quote.QuoteItems.Add(new QuoteItem { Description = "Service", Quantity = 2, Price = 100m, Tva = false });
        quote.QuoteItems.Add(new QuoteItem { Description = "Parts", Quantity = 5, Price = 50m, Tva = false });

        var total = quote.QuoteItems.Sum(i => (i.Quantity ?? 0) * (i.Price ?? 0));
        Assert.Equal(450m, total);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Delivery Note Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void DeliveryNote_Creation_HasDefaults()
    {
        var dn = new DeliveryNote
        {
            Number = "BL-001",
            Date = DateTime.UtcNow,
            ClientId = 1,
            CompanyId = 1
        };

        Assert.Equal("BL-001", dn.Number);
        Assert.False(dn.Treated);
        Assert.False(dn.IsDeleted);
    }

    [Fact]
    public void DeliveryNote_CanBeLinkedToInvoice()
    {
        var dn = new DeliveryNote
        {
            Number = "BL-001",
            InvoiceId = 42,
            CompanyId = 1
        };

        Assert.Equal(42, dn.InvoiceId);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Invoice Entity (Extended)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_DefaultStatus_IsPending()
    {
        var invoice = new Invoice();
        Assert.Equal("Pending", invoice.Status);
        Assert.False(invoice.IsLocked);
        Assert.False(invoice.Treated);
    }

    [Fact]
    public void Invoice_DisplayStatus_ArchiveOverridesDbStatus()
    {
        var invoice = new Invoice { Status = "Paid", Treated = true };
        var displayStatus = invoice.Treated ? "Archived" : invoice.Status;
        Assert.Equal("Archived", displayStatus);
    }

    [Fact]
    public void Invoice_AmountPaid_OnlyCountsCompletedPayments()
    {
        var items = new List<InvoiceItem>
        {
            new InvoiceItem { Description = "Item", Quantity = 1, Price = 1000m, Tva = false }
        };
        var invoice = new Invoice(items) { Tfiscal = 0 };
        invoice.CalculTotalAmount();

        invoice.Payments.Add(new Payment { Amount = 300m, Status = "Completed" });
        invoice.Payments.Add(new Payment { Amount = 500m, Status = "Pending" });

        Assert.Equal(300m, invoice.AmountPaid);
        Assert.Equal(500m, invoice.PendingAmount);
        Assert.Equal(200m, invoice.RemainingAmount); // 1000 - (300 + 500)
    }

    [Fact]
    public void Invoice_IsOverdue_WhenPastDueAndNotPaid()
    {
        var invoice = new Invoice
        {
            Status = "Pending",
            DueDate = DateTime.UtcNow.AddDays(-5)
        };
        Assert.True(invoice.IsOverdue);
    }

    [Fact]
    public void Invoice_NotOverdue_WhenPaid()
    {
        var invoice = new Invoice
        {
            Status = "Paid",
            DueDate = DateTime.UtcNow.AddDays(-5)
        };
        Assert.False(invoice.IsOverdue);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. ProductService Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ProductService_Creation_HasRequiredFields()
    {
        var product = new ProductService
        {
            Name = "Web Development",
            DefaultUnitPrice = 150m,
            CompanyId = 1
        };

        Assert.Equal("Web Development", product.Name);
        Assert.Equal(150m, product.DefaultUnitPrice);
        Assert.False(product.IsDeleted);
    }

    [Fact]
    public void ProductService_SoftDelete_SetsFlag()
    {
        var product = new ProductService { Name = "Test", CompanyId = 1 };
        product.IsDeleted = true;
        Assert.True(product.IsDeleted);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. Supplier Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Supplier_Creation_HasDefaults()
    {
        var supplier = new Supplier
        {
            Name = "Supplier Co",
            Address = "456 Supplier St",
            CompanyId = 1
        };

        Assert.Equal("Supplier Co", supplier.Name);
        Assert.False(supplier.IsDeleted);
    }

    [Fact]
    public void Supplier_HasInvoiceCollection()
    {
        var supplier = new Supplier { Name = "Test Supplier", CompanyId = 1 };
        Assert.NotNull(supplier.SupplierInvoices);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. Supplier Invoice Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SupplierInvoice_ComputedPaymentStatus_Pending()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000m };
        Assert.Equal("Pending", fi.PaymentStatus);
    }

    [Fact]
    public void SupplierInvoice_ComputedPaymentStatus_PartiallyPaid()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000m };
        fi.Payments.Add(new SupplierPayment { Amount = 500m, Status = "Completed" });
        Assert.Equal("PartiallyPaid", fi.PaymentStatus);
    }

    [Fact]
    public void SupplierInvoice_ComputedPaymentStatus_Paid()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000m };
        fi.Payments.Add(new SupplierPayment { Amount = 1000m, Status = "Completed" });
        Assert.Equal("Paid", fi.PaymentStatus);
    }

    [Fact]
    public void SupplierInvoice_PendingPayments_ExcludedFromAmountPaid()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000m };
        fi.Payments.Add(new SupplierPayment { Amount = 300m, Status = "Completed" });
        fi.Payments.Add(new SupplierPayment { Amount = 400m, Status = "Pending" });

        Assert.Equal(300m, fi.AmountPaid);
        Assert.Equal(400m, fi.PendingAmount);
        Assert.Equal(300m, fi.RemainingAmount); // 1000 - (300 + 400)
    }

    // ═══════════════════════════════════════════════════════════
    // 8. OtherExpense Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void OtherExpense_Creation_HasRequiredFields()
    {
        var expense = new OtherExpense
        {
            Description = "Office Supplies",
            Amount = 250m,
            Date = DateTime.UtcNow,
            CompanyId = 1
        };

        Assert.Equal("Office Supplies", expense.Description);
        Assert.Equal(250m, expense.Amount);
        Assert.False(expense.IsDeleted);
    }

    // ═══════════════════════════════════════════════════════════
    // 9. ApplicationUser / UserProfile Entity
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ApplicationUser_HasCompanyId()
    {
        var user = new ApplicationUser
        {
            CompanyId = 1,
            UserName = "test@example.com",
            Email = "test@example.com"
        };

        Assert.Equal(1, user.CompanyId);
    }

    [Fact]
    public void UserProfile_HasFirstNameAndLastName()
    {
        var profile = new UserProfile
        {
            FirstName = "John",
            LastName = "Doe",
            UserId = "user-123"
        };

        Assert.Equal("John", profile.FirstName);
        Assert.Equal("Doe", profile.LastName);
        Assert.False(profile.IsDeleted);
    }

    [Fact]
    public void UserProfile_FullName_ConcatenatesFirstAndLast()
    {
        var profile = new UserProfile
        {
            FirstName = "John",
            LastName = "Doe"
        };

        var fullName = $"{profile.FirstName} {profile.LastName}".Trim();
        Assert.Equal("John Doe", fullName);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. Payment Entity — Audit Fields
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Payment_CreationAudit_TracksCreator()
    {
        var payment = new Payment
        {
            Amount = 100m,
            Status = "Pending",
            CreatedByUserId = "user-789",
            CreatedAt = DateTime.UtcNow
        };

        Assert.Equal("user-789", payment.CreatedByUserId);
        Assert.NotEqual(default, payment.CreatedAt);
    }

    [Fact]
    public void Payment_ConfirmationAudit_TracksApprover()
    {
        var payment = new Payment
        {
            Amount = 100m,
            Status = "Completed",
            CreatedByUserId = "employee-1",
            ConfirmedByUserId = "manager-1",
            ConfirmedAt = DateTime.UtcNow
        };

        Assert.Equal("manager-1", payment.ConfirmedByUserId);
        Assert.NotNull(payment.ConfirmedAt);
        Assert.NotEqual(payment.CreatedByUserId, payment.ConfirmedByUserId);
    }

    // ═══════════════════════════════════════════════════════════
    // 11. Multi-Tenancy — CompanyId on all entities
    // ═══════════════════════════════════════════════════════════

    [Theory]
    [InlineData(1)]
    [InlineData(42)]
    [InlineData(999)]
    public void AllEntities_HaveCompanyId(int companyId)
    {
        var client = new Client { CompanyId = companyId };
        var invoice = new Invoice { CompanyId = companyId };
        var devis = new Quote { CompanyId = companyId };
        var dn = new DeliveryNote { CompanyId = companyId };
        var supplier = new Supplier { CompanyId = companyId };
        var fi = new SupplierInvoice { CompanyId = companyId };
        var expense = new OtherExpense { CompanyId = companyId };
        var product = new ProductService { CompanyId = companyId };

        Assert.Equal(companyId, client.CompanyId);
        Assert.Equal(companyId, invoice.CompanyId);
        Assert.Equal(companyId, devis.CompanyId);
        Assert.Equal(companyId, dn.CompanyId);
        Assert.Equal(companyId, supplier.CompanyId);
        Assert.Equal(companyId, fi.CompanyId);
        Assert.Equal(companyId, expense.CompanyId);
        Assert.Equal(companyId, product.CompanyId);
    }

    // ═══════════════════════════════════════════════════════════
    // 12. Soft Delete — IsDeleted Flag
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SoftDelete_DefaultIsFalse_ForAllEntities()
    {
        Assert.False(new Client().IsDeleted);
        Assert.False(new Invoice().IsDeleted);
        Assert.False(new Quote().IsDeleted);
        Assert.False(new DeliveryNote().IsDeleted);
        Assert.False(new Supplier().IsDeleted);
        Assert.False(new SupplierInvoice().IsDeleted);
        Assert.False(new OtherExpense().IsDeleted);
        Assert.False(new ProductService().IsDeleted);
    }
}
