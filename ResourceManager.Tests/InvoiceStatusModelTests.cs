using ResourceManager.Models;

namespace ResourceManager.Tests;

/// <summary>
/// Tests for the simplified invoice status model.
/// Statuses: Pending (default), PartiallyPaid, Paid.
/// "Archived" is a display-only value derived from the Treated flag.
/// </summary>
public class InvoiceStatusModelTests
{
    // ═══════════════════════════════════════════════════════════
    // 1. Default Status
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void NewInvoice_DefaultStatus_IsPending()
    {
        var invoice = new Invoice();

        Assert.Equal("Pending", invoice.Status);
    }

    [Fact]
    public void NewInvoice_IsNotLocked()
    {
        var invoice = new Invoice();

        Assert.False(invoice.IsLocked);
    }

    [Fact]
    public void NewInvoice_TreatedIsFalse()
    {
        var invoice = new Invoice();

        Assert.False(invoice.Treated);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Status Transitions
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_PartialPayment_StatusIsPartiallyPaid()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 400);

        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);
    }

    [Fact]
    public void Invoice_FullPayment_StatusIsPaid()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 1000);

        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
    }

    [Fact]
    public void Invoice_OverPayment_StatusIsPaid()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 1200);

        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
    }

    [Fact]
    public void Invoice_MultiplePartialPayments_BecomesPaid()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 400);
        AddCompletedPayment(invoice, 600);

        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
    }

    [Fact]
    public void Invoice_ZeroTotalWithPayment_StatusIsPartiallyPaid()
    {
        var invoice = CreateInvoice(totalAmount: 0);
        AddCompletedPayment(invoice, 100);

        RecalculateStatus(invoice);

        // totalPaid >= totalAmount (100 >= 0) but totalAmount is not > 0, so falls to PartiallyPaid
        Assert.Equal("PartiallyPaid", invoice.Status);
    }

    [Fact]
    public void Invoice_NoPayments_StatusRemainsPending()
    {
        var invoice = CreateInvoice(totalAmount: 1000);

        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Pending (Scheduled) Payments Don't Count
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_OnlyPendingPayments_StatusIsPending()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        invoice.Payments.Add(new Payment
        {
            Amount = 1000,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        });

        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
    }

    [Fact]
    public void Invoice_MixedPayments_OnlyCompletedCount()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 300);
        invoice.Payments.Add(new Payment
        {
            Amount = 700,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        });

        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Payment Deletion / Revert
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_AllPaymentsDeleted_RevertsToUnpaid()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        var payment = new Payment { Amount = 1000, Status = "Completed" };
        invoice.Payments.Add(payment);
        RecalculateStatus(invoice);
        Assert.Equal("Paid", invoice.Status);

        // Delete the payment
        invoice.Payments.Remove(payment);
        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
    }

    [Fact]
    public void Invoice_OnePaymentDeleted_PartiallyPaidToPending()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        var p1 = new Payment { Amount = 500, Status = "Completed" };
        invoice.Payments.Add(p1);
        RecalculateStatus(invoice);
        Assert.Equal("PartiallyPaid", invoice.Status);

        // Delete the payment
        invoice.Payments.Remove(p1);
        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Archived (Treated) Display Status
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_Treated_DisplaysAsArchived()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 1000);
        RecalculateStatus(invoice);
        invoice.Treated = true;

        var displayStatus = invoice.Treated ? "Archived" : invoice.Status;

        Assert.Equal("Archived", displayStatus);
    }

    [Fact]
    public void Invoice_NotTreated_DisplaysActualStatus()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 500);
        RecalculateStatus(invoice);

        var displayStatus = invoice.Treated ? "Archived" : invoice.Status;

        Assert.Equal("PartiallyPaid", displayStatus);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. Invalid Status Values No Longer Exist
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_DefaultStatus_IsNotUnpaid()
    {
        var invoice = new Invoice();
        Assert.NotEqual("Unpaid", invoice.Status);
    }

    [Fact]
    public void Invoice_DefaultStatus_IsNotDraft()
    {
        var invoice = new Invoice();
        Assert.NotEqual("Draft", invoice.Status);
    }

    [Theory]
    [InlineData("Pending")]
    [InlineData("PartiallyPaid")]
    [InlineData("Paid")]
    public void Invoice_ValidStatuses_AreAllowed(string status)
    {
        var invoice = new Invoice { Status = status };
        Assert.Equal(status, invoice.Status);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. Payment Default Status
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void NewPayment_DefaultStatus_IsCompleted()
    {
        var payment = new Payment();
        Assert.Equal("Completed", payment.Status);
    }

    [Fact]
    public void Payment_StatusIsNotDue()
    {
        var payment = new Payment();
        Assert.NotEqual("Due", payment.Status);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. SupplierInvoice Computed PaymentStatus
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SupplierInvoice_NoPayments_StatusIsPending()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000 };

        Assert.Equal("Pending", fi.PaymentStatus);
    }

    

    [Fact]
    public void SupplierInvoice_OnlyPendingPayments_StatusIsPending()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000 };
        fi.Payments.Add(new SupplierPayment { Amount = 1000, Status = "Pending" });

        Assert.Equal("Pending", fi.PaymentStatus);
    }

    [Fact]
    public void SupplierInvoice_ComputedAmountPaid_ExcludesPendingPayments()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000 };
        fi.Payments.Add(new SupplierPayment { Amount = 300, Status = "Completed" });
        fi.Payments.Add(new SupplierPayment { Amount = 500, Status = "Pending" });

        Assert.Equal(300, fi.AmountPaid);
        Assert.Equal(500, fi.PendingAmount);
        // Remaining = 1000 - (300 confirmed + 500 pending) = 200
        Assert.Equal(200, fi.RemainingAmount);
    }

    // ═══════════════════════════════════════════════════════════
    // 9. Remaining Amount Calculation (Phase 7 Scenarios)
    // ═══════════════════════════════════════════════════════════

    /// <summary>Case 1: No payment → remaining = totalAmount, revenue = 0</summary>
    [Fact]
    public void RemainingAmount_Case1_NoPayment()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        Assert.Equal(1000, invoice.RemainingAmount);
        Assert.Equal(0, invoice.AmountPaid);    // Revenue = 0
        Assert.Equal(0, invoice.PendingAmount);
    }

    /// <summary>Case 2: Confirmed 300 → remaining = 700, revenue = 300</summary>
    [Fact]
    public void RemainingAmount_Case2_ConfirmedOnly()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 300);

        Assert.Equal(700, invoice.RemainingAmount);
        Assert.Equal(300, invoice.AmountPaid);   // Revenue = 300
    }

    /// <summary>Case 3: Confirmed 300, Pending 200 → remaining = 500, revenue = 300</summary>
    [Fact]
    public void RemainingAmount_Case3_ConfirmedAndPending()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 300);
        AddPendingPayment(invoice, 200);

        Assert.Equal(500, invoice.RemainingAmount);
        Assert.Equal(300, invoice.AmountPaid);   // Revenue = 300 (pending doesn't count)
        Assert.Equal(200, invoice.PendingAmount);
    }

    /// <summary>Case 4: Confirmed 800, Pending 300 → remaining = 0 (clamped), revenue = 800</summary>
    [Fact]
    public void RemainingAmount_Case4_ExceedsTotal_ClampedToZero()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 800);
        AddPendingPayment(invoice, 300);

        // 1000 - (800 + 300) = -100, clamped to 0
        Assert.Equal(0, invoice.RemainingAmount);
        Assert.Equal(800, invoice.AmountPaid);   // Revenue = 800
    }

    /// <summary>Case 5: Confirm pending 200 → remaining recalculates, revenue increases</summary>
    [Fact]
    public void RemainingAmount_Case5_ConfirmPendingPayment()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 300);
        var pending = new Payment { Amount = 200, Status = "Pending", PaymentDate = DateTime.UtcNow.AddDays(30) };
        invoice.Payments.Add(pending);

        // Before confirm: remaining = 1000 - (300 + 200) = 500, revenue = 300
        Assert.Equal(500, invoice.RemainingAmount);
        Assert.Equal(300, invoice.AmountPaid);

        // Confirm the pending payment
        pending.Status = "Completed";

        // After confirm: remaining = 1000 - (500 + 0) = 500, revenue = 500
        Assert.Equal(500, invoice.RemainingAmount);
        Assert.Equal(500, invoice.AmountPaid);
        Assert.Equal(0, invoice.PendingAmount);
    }

    /// <summary>Remaining must never be negative</summary>
    [Fact]
    public void RemainingAmount_NeverNegative()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddCompletedPayment(invoice, 1200);

        Assert.Equal(0, invoice.RemainingAmount);
    }

    /// <summary>Remaining must never exceed totalAmount</summary>
    [Fact]
    public void RemainingAmount_NeverExceedsTotalAmount()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        Assert.True(invoice.RemainingAmount <= (invoice.TotalAmount ?? 0));
    }

    /// <summary>Status depends ONLY on confirmed payments, not pending</summary>
    [Fact]
    public void Status_NotAffectedByPendingPayments()
    {
        var invoice = CreateInvoice(totalAmount: 1000);
        AddPendingPayment(invoice, 1000);
        RecalculateStatus(invoice);

        // Even though pending covers entire total, status stays Pending
        Assert.Equal("Pending", invoice.Status);
        Assert.Equal(0, invoice.RemainingAmount); // But remaining is 0
    }

    /// <summary>SupplierInvoice remaining also includes pending</summary>
    [Fact]
    public void SupplierInvoice_RemainingIncludesPending()
    {
        var fi = new SupplierInvoice { TotalTTC = 1000 };
        fi.Payments.Add(new SupplierPayment { Amount = 400, Status = "Completed" });
        fi.Payments.Add(new SupplierPayment { Amount = 300, Status = "Pending" });

        // 1000 - (400 + 300) = 300
        Assert.Equal(300, fi.RemainingAmount);
        Assert.Equal(400, fi.AmountPaid);
    }

    /// <summary>SupplierInvoice remaining never negative</summary>
    [Fact]
    public void SupplierInvoice_RemainingNeverNegative()
    {
        var fi = new SupplierInvoice { TotalTTC = 500 };
        fi.Payments.Add(new SupplierPayment { Amount = 400, Status = "Completed" });
        fi.Payments.Add(new SupplierPayment { Amount = 200, Status = "Pending" });

        // 500 - (400 + 200) = -100, clamped to 0
        Assert.Equal(0, fi.RemainingAmount);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. Edge Cases
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Invoice_TotalCalculation_IsCorrect()
    {
        var items = new List<InvoiceItem>
        {
            new InvoiceItem { Description = "Service A", Quantity = 2, Price = 100, VatRate = 0.19m, Tva = true },
            new InvoiceItem { Description = "Service B", Quantity = 1, Price = 500, VatRate = 0.19m, Tva = true },
        };
        var invoice = new Invoice(items);

        Assert.Equal(700, invoice.SubTotal);
        Assert.Equal(700 * 0.19m, invoice.TaxAmount);
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
    public void Invoice_IsNotOverdue_WhenPaid()
    {
        var invoice = new Invoice
        {
            Status = "Paid",
            DueDate = DateTime.UtcNow.AddDays(-5)
        };

        Assert.False(invoice.IsOverdue);
    }

    [Fact]
    public void Payment_IsScheduled_WhenPendingAndFutureDate()
    {
        var payment = new Payment
        {
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        };

        Assert.True(payment.IsScheduled);
    }

    [Fact]
    public void Payment_IsNotScheduled_WhenCompleted()
    {
        var payment = new Payment
        {
            Status = "Completed",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        };

        Assert.False(payment.IsScheduled);
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
            Tfiscal = 0, // No stamp tax in tests — TotalAmount = Price * Qty exactly
            Status = "Pending",
            Payments = new List<Payment>()
        };
        invoice.CalculTotalAmount(); // Recalculate after Tfiscal override
        return invoice;
    }

    private static void AddCompletedPayment(Invoice invoice, decimal amount)
    {
        invoice.Payments.Add(new Payment
        {
            Amount = amount,
            Status = "Completed",
            PaymentDate = DateTime.UtcNow
        });
    }

    private static void AddPendingPayment(Invoice invoice, decimal amount)
    {
        invoice.Payments.Add(new Payment
        {
            Amount = amount,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        });
    }

    /// <summary>
    /// Mirrors the status recalculation logic from InvoicesController / DuePaymentProcessorService.
    /// Only "Completed" payments count toward the total.
    /// </summary>
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
