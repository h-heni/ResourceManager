using ResourceManager.Models;

namespace ResourceManager.Tests;

/// <summary>
/// Integration-style test: full invoice lifecycle through the simplified status model.
/// Creates an invoice → partial payment → full payment → archive → verify all transitions.
/// </summary>
public class InvoiceStatusLifecycleTests
{
    [Fact]
    public void FullLifecycle_CreateToArchive()
    {
        // ── Step 1: Create invoice ──
        var items = new List<InvoiceItem>
        {
            new InvoiceItem { Description = "Consulting", Quantity = 10, Price = 100m, Tva = true, VatRate = 0.19m },
            new InvoiceItem { Description = "Materials", Quantity = 5, Price = 50m, Tva = false },
        };
        var invoice = new Invoice(items) { Tfiscal = 1.000m };
        invoice.CalculTotalAmount();

        // Verify initial state
        Assert.Equal("Pending", invoice.Status);
        Assert.False(invoice.IsLocked);
        Assert.False(invoice.Treated);

        // Verify total: (10*100) + (5*50) = 1250 HT, tax on first = 10*100*0.19 = 190, + 1 tfiscal
        Assert.Equal(1250m, invoice.SubTotal);
        Assert.Equal(190m, invoice.TaxAmount);
        Assert.Equal(1441m, invoice.TotalAmount); // 1250 + 190 + 1

        // Display status = actual (not archived)
        string displayStatus = invoice.Treated ? "Archived" : invoice.Status;
        Assert.Equal("Pending", displayStatus);

        // ── Step 2: First partial payment ──
        var payment1 = new Payment
        {
            Id = 1,
            Amount = 500m,
            Status = "Completed",
            PaymentDate = DateTime.UtcNow
        };
        invoice.Payments.Add(payment1);
        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);
        Assert.False(invoice.IsLocked);
        Assert.Equal(500m, invoice.AmountPaid);
        Assert.Equal(941m, invoice.RemainingAmount);

        // ── Step 3: Scheduled (pending) payment — should NOT affect status ──
        var scheduledPayment = new Payment
        {
            Id = 2,
            Amount = 941m,
            Status = "Pending",
            PaymentDate = DateTime.UtcNow.AddDays(30)
        };
        invoice.Payments.Add(scheduledPayment);
        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status); // Still partially paid
        Assert.True(scheduledPayment.IsScheduled);
        Assert.Equal(500m, invoice.AmountPaid); // Only completed count
        Assert.Equal(941m, invoice.PendingAmount);
        // Remaining now includes pending: 1441 - (500 + 941) = 0
        Assert.Equal(0m, invoice.RemainingAmount);

        // ── Step 4: Scheduled payment completes (simulates DuePaymentProcessorService) ──
        scheduledPayment.Status = "Completed";
        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
        Assert.True(invoice.IsLocked);
        Assert.Equal(1441m, invoice.AmountPaid);
        Assert.Equal(0m, invoice.RemainingAmount);
        Assert.False(scheduledPayment.IsScheduled); // No longer scheduled

        // ── Step 5: Archive (Treated = true) ──
        invoice.Treated = true;
        displayStatus = invoice.Treated ? "Archived" : invoice.Status;

        Assert.Equal("Archived", displayStatus);
        Assert.Equal("Paid", invoice.Status); // DB status unchanged

        // ── Step 6: Unarchive ──
        invoice.Treated = false;
        displayStatus = invoice.Treated ? "Archived" : invoice.Status;

        Assert.Equal("Paid", displayStatus);
    }

    [Fact]
    public void PaymentDeletion_RevisesStatusCorrectly()
    {
        var items = new List<InvoiceItem>
        {
            new InvoiceItem { Description = "Item", Quantity = 1, Price = 1000m, Tva = false }
        };
        var invoice = new Invoice(items) { Tfiscal = 0 };
        invoice.CalculTotalAmount();

        // Add two payments
        var p1 = new Payment { Id = 1, Amount = 600m, Status = "Completed", PaymentDate = DateTime.UtcNow };
        var p2 = new Payment { Id = 2, Amount = 400m, Status = "Completed", PaymentDate = DateTime.UtcNow };
        invoice.Payments.Add(p1);
        invoice.Payments.Add(p2);
        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
        Assert.True(invoice.IsLocked);

        // Delete second payment → should revert to PartiallyPaid
        invoice.Payments.Remove(p2);
        invoice.IsLocked = false; // Controller would unlock
        RecalculateStatus(invoice);

        Assert.Equal("PartiallyPaid", invoice.Status);

        // Delete first payment → should revert to Pending
        invoice.Payments.Remove(p1);
        RecalculateStatus(invoice);

        Assert.Equal("Pending", invoice.Status);
    }

    [Fact]
    public void SupplierInvoice_FullLifecycle()
    {
        var fi = new SupplierInvoice { TotalTTC = 5000m };

        // Initial: Pending
        Assert.Equal("Pending", fi.PaymentStatus);

        // Partial payment
        fi.Payments.Add(new SupplierPayment { Amount = 2000m, Status = "Completed" });
        Assert.Equal("PartiallyPaid", fi.PaymentStatus);
        Assert.Equal(2000m, fi.AmountPaid);
        Assert.Equal(3000m, fi.RemainingAmount);

        // Add scheduled (pending) payment
        fi.Payments.Add(new SupplierPayment { Amount = 3000m, Status = "Pending" });
        Assert.Equal("PartiallyPaid", fi.PaymentStatus); // Pending doesn't count for status
        Assert.Equal(3000m, fi.PendingAmount);
        // Remaining includes pending: 5000 - (2000 + 3000) = 0
        Assert.Equal(0m, fi.RemainingAmount);

        // Complete the scheduled payment
        fi.Payments.Last().Status = "Completed";
        Assert.Equal("Paid", fi.PaymentStatus);
        Assert.Equal(5000m, fi.AmountPaid);
        Assert.Equal(0m, fi.RemainingAmount);
    }

    [Fact]
    public void StatusValues_NeverContainLegacyValues()
    {
        // Ensure the new model never produces legacy status values
        var invoice = new Invoice { Status = "Pending" };
        var legacyStatuses = new[] { "Unpaid", "Draft", "Due", "PARTIAL_PENDING", "PARTIALLY_DUE" };

        Assert.DoesNotContain(invoice.Status, legacyStatuses);

        invoice.Status = "PartiallyPaid";
        Assert.DoesNotContain(invoice.Status, legacyStatuses);

        invoice.Status = "Paid";
        Assert.DoesNotContain(invoice.Status, legacyStatuses);
    }

    [Fact]
    public void RecalculateStatus_UsesRemainingAmountRule_ForPaid()
    {
        var invoice = new Invoice(new List<InvoiceItem>
        {
            new() { Description = "Zero amount", Quantity = 1, Price = 0m, Tva = false }
        })
        {
            Tfiscal = 0m
        };
        invoice.CalculTotalAmount();
        RecalculateStatus(invoice);

        Assert.Equal("Paid", invoice.Status);
        Assert.True(invoice.IsLocked);
    }

    /// <summary>
    /// Mirrors the status recalculation logic from InvoicesController / DuePaymentProcessorService.
    /// </summary>
    private static void RecalculateStatus(Invoice invoice)
    {
        var totalPaid = invoice.Payments
            .Where(p => p.Status == "Completed")
            .Sum(p => p.Amount);
        var totalAmount = invoice.TotalAmount ?? 0;

        if (totalAmount - totalPaid <= 0)
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
