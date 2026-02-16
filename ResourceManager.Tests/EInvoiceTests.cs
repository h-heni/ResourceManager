using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging.Abstractions;
using ResourceManager.Application.EInvoicing;
using ResourceManager.Application.Interfaces;
using ResourceManager.Infrastructure.Services.EInvoicing;

namespace ResourceManager.Tests;

/// <summary>
/// Unit tests for the pure C# e-invoice generators.
/// Covers all 3 regions: Tunisia (TEIF), KSA (ZATCA), Europe (Peppol).
/// </summary>
public sealed class EInvoiceTests
{
    private readonly IEInvoiceService _service = new EInvoiceService(
        NullLogger<EInvoiceService>.Instance);

    // ════════════════════════════════════════════════════════════════════
    // Tunisia (TEIF)
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public void Tunisia_GeneratesValidXml()
    {
        var data = MakeTunisianInvoice();
        var result = _service.Generate(EInvoiceRegion.Tunisia, data);

        Assert.Equal(EInvoiceRegion.Tunisia, result.Region);
        Assert.Contains("<TEIFInvoice", result.Xml);
        Assert.Contains("<InvoiceNumber>FAC-2026-001</InvoiceNumber>", result.Xml);
        Assert.Contains("<MatriculeFiscal>1234567AM000</MatriculeFiscal>", result.Xml);
        Assert.NotEmpty(result.QrPayload);
    }

    [Fact]
    public void Tunisia_QrPayloadIsPipeDelimited()
    {
        var data = MakeTunisianInvoice();
        var qr = TunisianXmlGenerator.BuildQrString(data);

        // Format: MatriculeFiscal|InvoiceNumber|Date|TotalTTC
        Assert.Contains("1234567AM000|FAC-2026-001|", qr);
        Assert.Contains("|1547.000", qr);
    }

    [Fact]
    public void Tunisia_Uses3DecimalPrecision()
    {
        var data = MakeTunisianInvoice();
        var result = _service.Generate(EInvoiceRegion.Tunisia, data);

        // Item 1: qty=1 * 1000 = 1000 HT, Item 2: qty=1 * 300 = 300 HT
        // SubTotal = 1300, VatTotal = 247, TotalTtc = 1547
        Assert.Contains(">1000.000<", result.Xml); // UnitPrice
        Assert.Contains(">0.190<", result.Xml);    // VatRate

        var doc = XElement.Parse(result.Xml);
        var subTotal = doc.Element("Totals")?.Element("SubTotal")?.Value;
        Assert.NotNull(subTotal);
        Assert.Matches(@"^\d+\.\d{3}$", subTotal); // exactly 3 decimals
    }

    [Fact]
    public void Tunisia_ValidationRejects_WrongTaxIdLength()
    {
        var bad = new InvoiceData
        {
            InvoiceNumber = "FAC-2026-001",
            IssueDate = new DateTime(2026, 2, 16, 0, 0, 0, DateTimeKind.Utc),
            Seller = new SellerInfo("Test", "SHORT"),
            Buyer = new BuyerInfo("Client SARL", "9876543AM000"),
            Items = [new LineItem("Service", 1, 1000, 0.19m)],
            Currency = "TND",
            TtnReference = "TTN-REF-001",
        };

        var validation = _service.Validate(EInvoiceRegion.Tunisia, bad);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("MatriculeFiscal") && e.Contains("13 characters"));
    }

    // ════════════════════════════════════════════════════════════════════
    // KSA (ZATCA)
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public void Ksa_GeneratesValidUblXml()
    {
        var data = MakeKsaInvoice();
        var result = _service.Generate(EInvoiceRegion.Ksa, data);

        Assert.Equal(EInvoiceRegion.Ksa, result.Region);
        Assert.Contains("Invoice", result.Xml);
        Assert.Contains("SAR", result.Xml);
        Assert.Contains("388", result.Xml); // InvoiceTypeCode
    }

    [Fact]
    public void Ksa_TlvQrIsBase64Encoded()
    {
        var qr = ZatcaTlvEncoder.GenerateBase64Tlv(
            "Example Company Ltd",
            "310123456789013",
            new DateTime(2026, 2, 16, 10, 30, 0, DateTimeKind.Utc),
            1150.00m,
            150.00m);

        Assert.NotEmpty(qr);

        // Decode and verify TLV structure
        var bytes = Convert.FromBase64String(qr);
        Assert.True(bytes.Length > 10);

        // Tag 1 = seller name
        Assert.Equal(1, bytes[0]);
        var nameLen = bytes[1];
        var name = Encoding.UTF8.GetString(bytes, 2, nameLen);
        Assert.Equal("Example Company Ltd", name);
    }

    [Fact]
    public void Ksa_TlvContainsAll5Tags()
    {
        var qr = ZatcaTlvEncoder.GenerateBase64Tlv(
            "Seller", "310123456789013",
            DateTime.UtcNow, 1000m, 150m);

        var bytes = Convert.FromBase64String(qr);
        var tags = new List<int>();
        var offset = 0;
        while (offset < bytes.Length)
        {
            var tag = bytes[offset];
            var len = bytes[offset + 1];
            tags.Add(tag);
            offset += 2 + len;
        }

        Assert.Equal([1, 2, 3, 4, 5], tags);
    }

    [Fact]
    public void Ksa_ValidationRejects_WrongTaxId()
    {
        var bad = new InvoiceData
        {
            InvoiceNumber = "INV-001",
            IssueDate = DateTime.UtcNow,
            Seller = new SellerInfo("Test", "1234567890"),
            Buyer = new BuyerInfo("Client"),
            Items = [new LineItem("Service", 1, 100)],
        };

        var validation = _service.Validate(EInvoiceRegion.Ksa, bad);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("15 characters"));
    }

    [Fact]
    public void Ksa_ValidationRejects_TaxIdNotStartingWith3()
    {
        var bad = new InvoiceData
        {
            InvoiceNumber = "INV-001",
            IssueDate = DateTime.UtcNow,
            Seller = new SellerInfo("Test", "110123456789013"),
            Buyer = new BuyerInfo("Client"),
            Items = [new LineItem("Service", 1, 100)],
        };

        var validation = _service.Validate(EInvoiceRegion.Ksa, bad);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("start with '3'"));
    }

    // ════════════════════════════════════════════════════════════════════
    // Europe (Peppol BIS 3.0 / EPC QR)
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public void Europe_GeneratesValidPeppolXml()
    {
        var data = MakeEuropeanInvoice();
        var result = _service.Generate(EInvoiceRegion.Europe, data);

        Assert.Equal(EInvoiceRegion.Europe, result.Region);
        Assert.Contains("urn:cen.eu:en16931", result.Xml);
        Assert.Contains("EUR", result.Xml);
        Assert.Contains("380", result.Xml); // InvoiceTypeCode
    }

    [Fact]
    public void Europe_EpcQrStringFollowsBcdFormat()
    {
        var qr = PeppolXmlGenerator.GenerateEpcQrString(
            "XXXXXXXX", "European Tech Solutions",
            "FR7612345678901234567890189", "120.00", "INV-2026-001");

        var lines = qr.Split('\n');
        Assert.Equal("BCD", lines[0]);
        Assert.Equal("002", lines[1]);
        Assert.Equal("1", lines[2]);
        Assert.Equal("SCT", lines[3]);
        Assert.Equal("XXXXXXXX", lines[4]);
        Assert.Equal("European Tech Solutions", lines[5]);
        Assert.Equal("FR7612345678901234567890189", lines[6]);
        Assert.Equal("EUR120.00", lines[7]);
        Assert.Equal("INV-2026-001", lines[10]);
    }

    [Fact]
    public void Europe_ContainsPaymentMeansWithEpcQr()
    {
        var data = MakeEuropeanInvoice();
        var result = _service.Generate(EInvoiceRegion.Europe, data);

        Assert.Contains("BCD", result.QrPayload);
        Assert.Contains("SCT", result.QrPayload);
        Assert.Contains("FR7612345678901234567890189", result.QrPayload);
    }

    [Fact]
    public void Europe_ValidationRejects_MissingIban()
    {
        var bad = new InvoiceData
        {
            InvoiceNumber = "INV-001",
            IssueDate = DateTime.UtcNow,
            Seller = new SellerInfo("Test", "FR12345678901"),
            Buyer = new BuyerInfo("Client"),
            Items = [new LineItem("Service", 1, 100)],
        };

        var validation = _service.Validate(EInvoiceRegion.Europe, bad);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("IBAN"));
    }

    // ════════════════════════════════════════════════════════════════════
    // Cross-cutting
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public void Validation_RejectsEmptyInvoiceNumber()
    {
        var bad = new InvoiceData
        {
            InvoiceNumber = "",
            IssueDate = DateTime.UtcNow,
            Seller = new SellerInfo("Test", "1234567AM000"),
            Buyer = new BuyerInfo("Client"),
            Items = [new LineItem("Service", 1, 100)],
        };

        var validation = _service.Validate(EInvoiceRegion.Tunisia, bad);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("InvoiceNumber"));
    }

    [Fact]
    public void Validation_RejectsZeroQuantityItems()
    {
        var data = new InvoiceData
        {
            InvoiceNumber = "INV-001",
            IssueDate = DateTime.UtcNow,
            Seller = new SellerInfo("Test", "1234567AM000"),
            Buyer = new BuyerInfo("Client"),
            Items = [new LineItem("Service", 0, 100)],
            TtnReference = "TTN-001"
        };

        var validation = _service.Validate(EInvoiceRegion.Tunisia, data);
        Assert.False(validation.IsValid);
        Assert.Contains(validation.Errors, e => e.Contains("Quantity"));
    }

    // ── Test data factories ─────────────────────────────────────────────

    private static InvoiceData MakeTunisianInvoice() => new()
    {
        InvoiceNumber = "FAC-2026-001",
        IssueDate = new DateTime(2026, 2, 16, 0, 0, 0, DateTimeKind.Utc),
        Currency = "TND",
        TtnReference = "TTN-REF-001",
        Seller = new SellerInfo("ACME SARL", "1234567AM000", "Tunis, Tunisia", "71000000"),
        Buyer = new BuyerInfo("Client SARL", "9876543AM000", "Sfax, Tunisia"),
        Items =
        [
            new LineItem("Consulting Service", 1m, 1000m, 0.19m),
            new LineItem("Software License", 1m, 300m, 0.19m),
        ]
    };

    private static InvoiceData MakeKsaInvoice() => new()
    {
        InvoiceNumber = "INV-2026-001",
        IssueDate = new DateTime(2026, 2, 16, 10, 30, 0, DateTimeKind.Utc),
        Currency = "SAR",
        Seller = new SellerInfo("Example Company Ltd", "310123456789013", "Riyadh, KSA", "+966500000000"),
        Buyer = new BuyerInfo("Customer Co", "300000000000003", "Jeddah, KSA"),
        Items =
        [
            new LineItem("Professional Services", 1m, 1000m, 0.15m),
        ]
    };

    private static InvoiceData MakeEuropeanInvoice() => new()
    {
        InvoiceNumber = "INV-2026-001",
        IssueDate = new DateTime(2026, 2, 16, 0, 0, 0, DateTimeKind.Utc),
        Currency = "EUR",
        Seller = new SellerInfo(
            "European Tech Solutions", "FR12345678901",
            "Paris, France", "+33100000000",
            "BNPAFRPP", "FR7612345678901234567890189"),
        Buyer = new BuyerInfo("German Client GmbH", "DE123456789", "Berlin, Germany"),
        Items =
        [
            new LineItem("Cloud Hosting", 1m, 100m, 0.20m),
        ]
    };
}
