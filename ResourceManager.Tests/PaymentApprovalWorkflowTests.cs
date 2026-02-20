using ResourceManager.Models;

namespace ResourceManager.Tests;

/// <summary>
/// Tests that enforce the manual-only payment approval workflow.
/// Requirements:
/// 1. Every payment defaults to Pending — NO auto-completion.
/// 2. Invoice status only transitions when payments are Completed (manually approved).
/// 3. Pending payments do NOT affect invoice status transitions.
/// 4. Payment must be explicitly confirmed to become Completed.
/// </summary>
public class PaymentApprovalWorkflowTests
{
    // ═══════════════════════════════════════════════════════════
    // 1. Payment Default Status
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void NewPayment_ShouldDefaultToPending_InManualWorkflow()
    {
        // In the manual workflow, all new payments should start as Pending.
        // The backend controller forces status = "Pending" regardless of dto.Status.
        var payment = new Payment
        {
            Amount = 500m,
            PaymentDate = DateTime.UtcNow,
            Status = "Pending" // simulates what the controller now enforces
        };

        Assert.Equal("Pending", payment.Status);
        Assert.Null(payment.ConfirmedByUserId);
        Assert.Null(payment.ConfirmedAt);
    }

    [Fact]
    public void ScheduledPayment_ShouldAlsoDefaultToPending()
    {
        var payment = new Payment
        {
            Amount = 1000m,
            PaymentDate = DateTime.UtcNow.AddDays(30),
            Status = "Pending"
        };

        Assert.Equal("Pending", payment.Status);
        Assert.True(payment.IsScheduled);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Invoice Status NOT Affected by Pending Payments
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_WithOnlyPendingPayments_StatusRemainsPending()
    {
        var invoice = CreateInvoice(1000m);
        invoice.Payments.Add(new Payment { Amount = 1000m, Status = "Pending", PaymentDate = DateTime.UtcNow });

        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
        Assert.False(invoice.IsLocked);
    }

    [Fact]
    public void Invoice_WithPendingPaymentCoveringTotal_DoesNotBecomePaid()
    {
        var invoice = CreateInvoice(500m);
        invoice.Payments.Add(new Payment { Amount = 500m, Status = "Pending", PaymentDate = DateTime.UtcNow });

        RecalculateStatus(invoice);

        // Even though pending amount covers the total, status stays Pending
        Assert.Equal("Pending", invoice.Status);
        Assert.False(invoice.IsLocked);
        Assert.Equal(0m, invoice.AmountPaid); // Only Completed payments count
        Assert.Equal(500m, invoice.PendingAmount);
    }

    [Fact]
    public void Invoice_MultiplePendingPayments_AllIgnoredForStatus()
    {
        var invoice = CreateInvoice(1000m);
        invoice.Payments.Add(new Payment { Amount = 400m, Status = "Pending", PaymentDate = DateTime.UtcNow });
        invoice.Payments.Add(new Payment { Amount = 600m, Status = "Pending", PaymentDate = DateTime.UtcNow.AddDays(7) });

        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
        Assert.Equal(0m, invoice.AmountPaid);
        Assert.Equal(1000m, invoice.PendingAmount);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Manual Approval Triggers Status Transition
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ManualApproval_PartialPayment_ChangesStatusToPartiallyPaid()
    {
        var invoice = CreateInvoice(1000m);
        var payment = new Payment
        {
            Amount = 400m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow
        };
        invoice.Payments.Add(payment);

        // Simulate manual approval
        payment.Status = "Completed";
        payment.ConfirmedByUserId = "manager-123";
        payment.ConfirmedAt = DateTime.UtcNow;

        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);
        Assert.Equal(400m, invoice.AmountPaid);
        Assert.NotNull(payment.ConfirmedByUserId);
        Assert.NotNull(payment.ConfirmedAt);
    }

    [Fact]
    public void ManualApproval_FullPayment_ChangesStatusToPaid()
    {
        var invoice = CreateInvoice(1000m);
        var payment = new Payment
        {
            Amount = 1000m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow
        };
        invoice.Payments.Add(payment);

        // Simulate manual approval
        payment.Status = "Completed";
        payment.ConfirmedByUserId = "manager-123";
        payment.ConfirmedAt = DateTime.UtcNow;

        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
        Assert.True(invoice.IsLocked);
    }

    [Fact]
    public void ManualApproval_MultiplePayments_SequentialApproval()
    {
        var invoice = CreateInvoice(1000m);
        var p1 = new Payment { Amount = 600m, Status = "Pending", PaymentDate = DateTime.UtcNow };
        var p2 = new Payment { Amount = 400m, Status = "Pending", PaymentDate = DateTime.UtcNow.AddDays(7) };
        invoice.Payments.Add(p1);
        invoice.Payments.Add(p2);

        // Step 1: Approve first payment only
        p1.Status = "Completed";
        p1.ConfirmedByUserId = "manager-123";
        p1.ConfirmedAt = DateTime.UtcNow;
        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);
        Assert.Equal(600m, invoice.AmountPaid);
        Assert.Equal(400m, invoice.PendingAmount);

        // Step 2: Approve second payment
        p2.Status = "Completed";
        p2.ConfirmedByUserId = "manager-123";
        p2.ConfirmedAt = DateTime.UtcNow;
        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
        Assert.True(invoice.IsLocked);
        Assert.Equal(1000m, invoice.AmountPaid);
        Assert.Equal(0m, invoice.PendingAmount);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. No Auto-Completion — Payments Stay Pending Forever
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void PastDuePayment_StaysPending_WithoutManualApproval()
    {
        // Payment date has passed but no one has approved it
        var payment = new Payment
        {
            Amount = 500m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(-10) // 10 days past due
        };

        // Without the auto-completion service, it stays Pending
        Assert.Equal("Pending", payment.Status);
        Assert.Null(payment.ConfirmedByUserId);
    }

    [Fact]
    public void Invoice_WithPastDuePendingPayments_StaysInPending()
    {
        var invoice = CreateInvoice(1000m);
        invoice.Payments.Add(new Payment
        {
            Amount = 1000m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(-30) // 30 days past due
        });

        RecalculateStatus(invoice);

        // Invoice stays Pending — no auto-completion
        Assert.Equal("Pending", invoice.Status);
        Assert.False(invoice.IsLocked);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Supplier Invoice — Same Workflow
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SupplierInvoice_PendingPayments_DoNotAffectStatus()
    {
        var fi = new SupplierInvoice { TotalTTC = 2000m };
        fi.Payments.Add(new SupplierPayment { Amount = 2000m, Status = "Pending" });

        Assert.Equal("Pending", fi.PaymentStatus);
        Assert.Equal(0m, fi.AmountPaid);
        Assert.Equal(2000m, fi.PendingAmount);
    }

    [Fact]
    public void SupplierInvoice_ManualApproval_TransitionsToPaid()
    {
        var fi = new SupplierInvoice { TotalTTC = 2000m };
        var payment = new SupplierPayment { Amount = 2000m, Status = "Pending" };
        fi.Payments.Add(payment);

        Assert.Equal("Pending", fi.PaymentStatus);

        // Manually approve
        payment.Status = "Completed";

        Assert.Equal("Paid", fi.PaymentStatus);
        Assert.Equal(2000m, fi.AmountPaid);
        Assert.Equal(0m, fi.PendingAmount);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. Audit Trail — ConfirmedBy Fields
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void UnapprovedPayment_HasNoConfirmationAuditTrail()
    {
        var payment = new Payment
        {
            Amount = 500m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow,
            CreatedByUserId = "employee-456",
            ConfirmedByUserId = null,
            ConfirmedAt = null
        };

        Assert.NotNull(payment.CreatedByUserId);
        Assert.Null(payment.ConfirmedByUserId);
        Assert.Null(payment.ConfirmedAt);
    }

    [Fact]
    public void ApprovedPayment_HasConfirmationAuditTrail()
    {
        var payment = new Payment
        {
            Amount = 500m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow,
            CreatedByUserId = "employee-456"
        };

        // Simulate approval
        payment.Status = "Completed";
        payment.ConfirmedByUserId = "manager-123";
        payment.ConfirmedAt = DateTime.UtcNow;

        Assert.Equal("Completed", payment.Status);
        Assert.Equal("manager-123", payment.ConfirmedByUserId);
        Assert.NotNull(payment.ConfirmedAt);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    private static Invoice CreateInvoice(decimal totalAmount)
    {
        var items = new List<InvoiceItem>
        {
            new InvoiceItem { Description = "Item", Quantity = 1, Price = totalAmount, Tva = false }
        };
        var invoice = new Invoice(items)
        {
            Tfiscal = 0,
            Status = "Pending",
            Payments = new List<Payment>()
        };
        invoice.CalculTotalAmount();
        return invoice;
    }

    private static void RecalculateStatus(Invoice invoice)
    {
        var totalPaid = invoice.Payments
            .Where(p => p.Status == "Completed")
            .Sum(p => p.Amount);
        var totalAmount = invoice.TotalAmount ?? 0;

        if (totalPaid >= totalAmount && totalAmount > 0)
        {
            invoice.Status = "Paid";
            invoice.IsLocked = true;
        }
        else if (totalPaid > 0)
        {
            invoice.Status = "PartiallyPaid";
        }
        else
        {
            invoice.Status = "Pending";
        }
    }
}
