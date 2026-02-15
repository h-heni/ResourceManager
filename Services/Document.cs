using ResourceManager.Models;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;
using System.Xml.Linq;
using QRCoder;
namespace ResourceManager.Services
{
    // Settings class for PDF customization
    public class PdfSettings
    {
        public string PrimaryColor { get; set; } = "#00AEEF";
        public string SecondaryColor { get; set; } = "#764ba2";
        public string CurrencySymbol { get; set; } = string.Empty;
        public bool ShowLogo { get; set; } = true;
        public string? FooterText { get; set; }
        public List<string> PaymentMethods { get; set; } = new();
        
        // Company info for the PDF
        public string CompanyName { get; set; }= string.Empty;
        public string CompanyAddress { get; set; } = string.Empty;
        public string CompanyTaxId { get; set; } = string.Empty;
        public string CompanyPhone { get; set; } = string.Empty;
        
        // Company logo binary data (from Company.LogoData)
        public byte[]? LogoData { get; set; }
        
        // Custom tax settings
        public bool CustomTaxEnabled { get; set; } = true;
        public string CustomTaxName { get; set; } = "Timbre Fiscal";
        public decimal CustomTaxAmount { get; set; } = 1.000m;
        
        // Creator name (manager or user who created/prints the document)
        public string CreatedByName { get; set; } = string.Empty;
        
        // PDF signature & language
        public string? PdfSignatureText { get; set; }
        public string? PdfSignerPosition { get; set; }
        public string InvoiceLanguage { get; set; } = "fr"; // fr, en, de, ar
        
        // Signature / Cachet image
        public byte[]? SignatureImageData { get; set; }
        public bool ShowSignatureOnPdf { get; set; } = false;
        public bool ShowSignature { get; set; } = false;
        public bool ShowStamp { get; set; } = false;
        
        // Bank information
        public string? BankName { get; set; }
        public string? BankBIC { get; set; }
        public string? BankRIB { get; set; }
        public string? BankIBAN { get; set; }
        public bool ShowBankName { get; set; } = true;
        public bool ShowBankBIC { get; set; } = true;
        public bool ShowBankRIB { get; set; } = true;
        public bool ShowBankIBAN { get; set; } = true;
        
        // Token-based verification signature
        public string? VerificationToken { get; set; }
        public string? VerificationUrl { get; set; }

        /// <summary>
        /// Creates PdfSettings from company configuration.
        /// </summary>
        /// <param name="settings">Company settings (nullable).</param>
        /// <param name="company">Company entity (nullable).</param>
        /// <param name="creatorName">Name of the user generating the PDF.</param>
        /// <param name="currencyOverride">Entity-level currency override (e.g. invoice.CurrencySymbol).</param>
        /// <param name="languageOverride">Entity-level language override (e.g. invoice.PdfLanguage).</param>
        /// <param name="previewDefaults">When true, uses preview-friendly defaults for empty fields.</param>
        public static PdfSettings FromCompanySettings(
            CompanySettings? settings,
            Company? company,
            string creatorName = "",
            string? currencyOverride = null,
            string? languageOverride = null,
            bool previewDefaults = false)
        {
            return new PdfSettings
            {
                PrimaryColor = settings?.PrimaryColor ?? (previewDefaults ? "#667eea" : "#00AEEF"),
                SecondaryColor = settings?.SecondaryColor ?? "#764ba2",
                CurrencySymbol = currencyOverride ?? settings?.CurrencySymbol ?? (previewDefaults ? "TND" : "DT"),
                ShowLogo = settings?.ShowCompanyLogo ?? true,
                LogoData = company?.LogoData,
                FooterText = settings?.PdfFooterText,
                PaymentMethods = company?.PaymentMethods ?? new List<string>(),
                CompanyName = company?.Name ?? (previewDefaults ? "Your Company" : ""),
                CompanyAddress = company?.Address ?? (previewDefaults ? "123 Business St" : ""),
                CompanyTaxId = company?.MatriculeFiscal ?? (previewDefaults ? "000ABC000" : ""),
                CompanyPhone = company?.Phone ?? (previewDefaults ? "+216 00 000 000" : ""),
                CustomTaxEnabled = settings?.CustomTaxEnabled ?? true,
                CustomTaxName = settings?.CustomTaxName ?? "Timbre Fiscal",
                CustomTaxAmount = settings?.CustomTaxAmount ?? 1.000m,
                CreatedByName = creatorName,
                PdfSignatureText = settings?.PdfSignatureText,
                PdfSignerPosition = settings?.PdfSignerPosition,
                InvoiceLanguage = languageOverride ?? settings?.InvoiceLanguage ?? "fr",
                SignatureImageData = settings?.SignatureImageData,
                ShowSignatureOnPdf = settings?.ShowSignatureOnPdf ?? false,
                ShowSignature = settings?.ShowSignatureOnPdf ?? false,
                ShowStamp = settings?.ShowSignatureOnPdf ?? false,
                BankName = settings?.BankName,
                BankBIC = settings?.BankBIC,
                BankRIB = settings?.BankRIB,
                BankIBAN = settings?.BankIBAN,
                ShowBankName = settings?.ShowBankName ?? true,
                ShowBankBIC = settings?.ShowBankBIC ?? true,
                ShowBankRIB = settings?.ShowBankRIB ?? true,
                ShowBankIBAN = settings?.ShowBankIBAN ?? true
            };
        }
    }

    public class Document<T> : IDocument where T : class, IPdfDocumentData
    {
        public T Model { get; }
        public PdfSettings Settings { get; }
        
        // Dynamic brand colors from settings
        private string BrandBlue => Settings.PrimaryColor;
        private static readonly string HeaderDark = "#232323";
        private static readonly string TextGrey = "#666666";
        private static readonly string ZebraGrey = "#F0F0F0";
        private static readonly CultureInfo MoneyCulture = CultureInfo.GetCultureInfo("en-US");

        private string CurrencyCode => Settings.CurrencySymbol;

        


        public readonly byte[] LogoBytes;


        public Document(T model, PdfSettings? settings = null)
        {
            Model = model;
            Settings = settings ?? new PdfSettings();
            
            // Required for the free community version
            QuestPDF.Settings.License = LicenseType.Community;

            // 1) Prefer LogoData from company settings (uploaded logo)
            if (Settings.LogoData != null && Settings.LogoData.Length > 0)
            {
                LogoBytes = Settings.LogoData;
            }
            else
            {
                // 2) Fallback: read from wwwroot/images/logo.png
                var logoPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "logo.png");
                if (!File.Exists(logoPath))
                    logoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images", "logo.png");

                LogoBytes = File.Exists(logoPath) ? File.ReadAllBytes(logoPath) : Array.Empty<byte>();
            }
        }
        
        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;
        public DocumentSettings GetSettings() => DocumentSettings.Default;
        
        private string FormatAmount(decimal value)
        {
            var currency = string.IsNullOrWhiteSpace(CurrencyCode) ? "EUR" : CurrencyCode.Trim();
            return $"{value.ToString("N2", MoneyCulture)}\u00A0{currency}";
        }

        private static string FormatAmountWithoutCurrency(decimal value)
        {
            return value.ToString("N2", MoneyCulture);
        }

        private static float ResolveAmountFontSize(string formattedAmount, float baseFontSize = 10)
        {
            if (formattedAmount.Length >= 24) return Math.Max(7.5f, baseFontSize - 2.5f);
            if (formattedAmount.Length >= 20) return Math.Max(8f, baseFontSize - 2f);
            if (formattedAmount.Length >= 17) return Math.Max(8.5f, baseFontSize - 1.5f);
            if (formattedAmount.Length >= 15) return Math.Max(9f, baseFontSize - 1f);
            return baseFontSize;
        }


        public void Compose(IDocumentContainer container)
        {
            container
                .Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(50);
                    page.DefaultTextStyle(x => x.FontSize(10).FontColor(TextGrey));
                    page.Header().Element(ComposeHeader);
                    page.Content().Element(ComposeContent);

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.CurrentPageNumber();
                        x.Span(" / ");
                        x.TotalPages();
                    });
                });
        }

        void ComposeHeader(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            string title = (Model, lang) switch
            {
                (Invoice, "fr") => "Facture",
                (Invoice, "de") => "Rechnung",
                (Invoice, "ar") => "فاتورة",
                (Invoice, _)    => "Invoice",
                (Devis, "fr") => "Devis",
                (Devis, "de") => "Angebot",
                (Devis, "ar") => "عرض سعر",
                (Devis, _)    => "Quote",
                (DeliveryNote, "fr") => "Bon de livraison",
                (DeliveryNote, "de") => "Lieferschein",
                (DeliveryNote, "ar") => "وصل التسليم",
                (DeliveryNote, _)    => "Delivery Note",
                _ => "Document"
            };

            var culture = lang switch
            {
                "fr" => new CultureInfo("fr-FR"),
                "de" => new CultureInfo("de-DE"),
                "ar" => new CultureInfo("ar-TN"),
                _    => new CultureInfo("en-US")
            };

            var dateLabel = lang switch { "fr" => "Date", "de" => "Datum", "ar" => "التاريخ", _ => "Date" };

            container.Row(row =>
            {
                row.RelativeItem().Column(column =>
                {
                    column.Item().PaddingTop(20)
                        .Text($"{title}")
                        .FontSize(20).Bold().FontColor(BrandBlue);
                    column.Item().PaddingTop(2)
                        .Text($"{Model.Number}")
                        .FontSize(15).Bold().FontColor(BrandBlue);

                    column.Item().Text(text =>
                    {
                        text.Span($"{dateLabel}: ").SemiBold();
                        text.Span(Model.Date.ToString("D", culture));
                    });

                    // Show linked quote reference for invoices
                    if (Model is Invoice invoice && (invoice.DevisId.HasValue || !string.IsNullOrWhiteSpace(invoice.SourceDevisNumber)))
                    {
                        var refLabel = lang switch { "fr" => "Réf. Devis", "de" => "Angebot-Ref.", "ar" => "مرجع عرض السعر", _ => "Quote Ref." };
                        var quoteReference = !string.IsNullOrWhiteSpace(invoice.SourceDevisNumber)
                            ? invoice.SourceDevisNumber
                            : invoice.Devis?.Number;

                        if (!string.IsNullOrWhiteSpace(quoteReference))
                        {
                            column.Item().Text(text =>
                            {
                                text.Span($"{refLabel}: ").SemiBold();
                                text.Span(quoteReference);
                            });
                        }
                    }

                    // Show linked quote reference for delivery notes
                    if (Model is DeliveryNote dn && dn.DevisId.HasValue && dn.Devis != null)
                    {
                        var refLabel = lang switch { "fr" => "Réf. Devis", "de" => "Angebot-Ref.", "ar" => "مرجع عرض السعر", _ => "Quote Ref." };
                        column.Item().Text(text =>
                        {
                            text.Span($"{refLabel}: ").SemiBold();
                            text.Span(dn.Devis.Number);
                        });
                    }

                });

                if (Settings.ShowLogo && LogoBytes.Length > 0)
                {
                    row.ConstantItem(120).Height(120).Image(LogoBytes).FitUnproportionally();
                }
            });
        }


        void ComposeTable(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var descLabel = lang switch { "fr" => "Déscription", "de" => "Bezeichnung", "ar" => "الوصف", _ => "Description" };
            var qtyLabel = lang switch { "fr" => "Qté", "de" => "Menge", "ar" => "الكمية", _ => "Qty" };
            var taxLabel = lang switch { "fr" => "TVA", "de" => "MwSt", "ar" => "ضريبة", _ => "Tax" };
            var upLabel = lang switch { "fr" => "Prix Unit.", "de" => "Einzelpreis", "ar" => "سعر الوحدة", _ => "Unit Price" };
            var totalLabel = lang switch { "fr" => "Total", "de" => "Gesamt", "ar" => "المجموع", _ => "Total" };

            var qtyFormat = lang switch { "fr" => new CultureInfo("fr-FR"), "de" => new CultureInfo("de-DE"), _ => CultureInfo.InvariantCulture };

            container.PaddingVertical(20).Table(table =>
            {
                if (Model is DeliveryNote)
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(30);
                        columns.RelativeColumn(1);
                        columns.ConstantColumn(60);
                    });
                    table.Header(header =>
                    {
                        header.Cell().Element(CellStyle).Text("#");
                        header.Cell().Element(CellStyle).Text(descLabel);
                        header.Cell().Element(CellStyle).AlignRight().Text(qtyLabel);

                        IContainer CellStyle(IContainer c)
                        {
                            return c.Background(HeaderDark).BorderBottom(5).BorderColor(BrandBlue).Padding(5).DefaultTextStyle(x => x.FontColor(Colors.White).SemiBold());
                        }
                    });

                    for (int i = 0; i < Model.Items.Count; i++)
                    {
                        var item = Model.Items[i];
                        var isEven = i % 2 == 0;

                        table.Cell().Element(e => CellStyle(e, isEven)).Text($"{i + 1}");
                        table.Cell().Element(e => CellStyle(e, isEven)).Text($"{item.Description}");
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignRight().Text(item.Quantity?.ToString("N0", qtyFormat).Replace("\u0020", "\u00A0"));

                         static IContainer CellStyle(IContainer container, bool isEven)
                        {
                            return container.Background(isEven ? ZebraGrey : Colors.White).PaddingVertical(5);
                            //return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5);
                        }
                    }
                }
                else
                {
                    
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(25);
                        columns.RelativeColumn(3);
                        columns.ConstantColumn(55);
                        columns.ConstantColumn(65);
                        columns.ConstantColumn(110);
                        columns.ConstantColumn(120);
                    });
                    table.Header(header =>
                    {
                        header.Cell().Element(CellStyle).AlignCenter().Text("#");
                        header.Cell().Element(CellStyle).Text(descLabel);
                        header.Cell().Element(CellStyle).AlignRight().Text(qtyLabel);
                        header.Cell().Element(CellStyle).AlignCenter().Text(taxLabel);
                        header.Cell().Element(CellStyle).AlignCenter().Text(upLabel);
                        header.Cell().Element(CellStyle).AlignCenter().Text(totalLabel);

                        IContainer CellStyle(IContainer container)
                        {
                            return container.Background(HeaderDark).BorderBottom(5).BorderColor(BrandBlue).Padding(5).DefaultTextStyle(x => x.FontColor(Colors.White).SemiBold());
                        }
                    });

                    for (int i=0;i< Model.Items.Count; i++) 
                    {
                        var item = Model.Items[i];
                        var isEven = i % 2 == 0;
                        var unitPriceFormatted = FormatAmount(item.Price ?? 0);
                        var totalFormatted = FormatAmount(item.TotalItemHT);
                        var unitPriceFontSize = ResolveAmountFontSize(unitPriceFormatted, 9.5f);
                        var totalFontSize = ResolveAmountFontSize(totalFormatted, 9.5f);

                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text($"{i+ 1}");
                        table.Cell().Element(e => CellStyle(e, isEven)).Text(item.Description);
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignRight().Text(item.Quantity?.ToString("N0", qtyFormat).Replace("\u0020", "\u00A0"));
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text($"{item.TaxRate:P0}");
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignRight().Text(text =>
                        {
                            text.DefaultTextStyle(x => x.FontSize(unitPriceFontSize));
                            text.Span(unitPriceFormatted);
                        });
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignRight().Text(text =>
                        {
                            text.DefaultTextStyle(x => x.FontSize(totalFontSize).SemiBold());
                            text.Span(totalFormatted);
                        });
                        static IContainer CellStyle(IContainer container,bool isEven)
                        {
                            return container.Background(isEven ? ZebraGrey : Colors.White).PaddingVertical(5).PaddingHorizontal(4);
                        }
                    }
                }
            });
        }
        void ComposeContent(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var fromLabel = lang switch { "fr" => "De", "de" => "Von", "ar" => "من", _ => "From" };
            var clientLabel = lang switch { "fr" => "Client", "de" => "Kunde", "ar" => "العميل", _ => "Client" };

            var unknownClientName = lang switch { "fr" => "Client inconnu", "de" => "Unbekannter Kunde", "ar" => "عميل غير معروف", _ => "Unknown Client" };
            var owner = new Client
            {
                Name = Settings.CompanyName,
                Address = Settings.CompanyAddress,
                MatriculeFiscal = Settings.CompanyTaxId,
                Phone = Settings.CompanyPhone
            };
            var client = Model.Client ?? new Client
            {
                Name = unknownClientName,
                Address = string.Empty,
                MatriculeFiscal = string.Empty,
                Phone = string.Empty
            };
            container.PaddingVertical(20).Column(column =>
            {
                column.Spacing(5);

                column.Item().Row(row =>
                {
                    row.RelativeItem().Component(new AddressComponent(fromLabel, owner));
                    row.ConstantItem(50);
                    row.RelativeItem().Component(new AddressComponent(clientLabel, client));
                });

                column.Item().Element(ComposeTable);

                
                column.Item().PaddingTop(25).Element(compose => ComposeTotals(compose));
                
                // Bank info section (only for invoices)
                if (Model is Invoice && HasBankInfo())
                {
                    column.Item().PaddingTop(15).Element(compose => ComposeBankInfo(compose));
                }

                if (Settings.ShowSignature || Settings.ShowStamp)
                {
                    column.Item().PaddingTop(16).Element(ComposeSignature);
                }
                
                column.Item().PaddingTop(30).Element(ComposeFooterSection);
            });
        }

        bool HasBankInfo()
        {
            return (!string.IsNullOrEmpty(Settings.BankName) && Settings.ShowBankName)
                || (!string.IsNullOrEmpty(Settings.BankBIC) && Settings.ShowBankBIC)
                || (!string.IsNullOrEmpty(Settings.BankRIB) && Settings.ShowBankRIB)
                || (!string.IsNullOrEmpty(Settings.BankIBAN) && Settings.ShowBankIBAN);
        }

        void ComposeBankInfo(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var bankLabel = lang switch { "fr" => "Coordonnées bancaires", "de" => "Bankverbindung", "ar" => "المعلومات البنكية", _ => "Bank Details" };
            
            container.Background("#F8F9FA").Border(1).BorderColor("#E0E0E0").Padding(10).Column(col =>
            {
                col.Item().Text(bankLabel).Bold().FontSize(9).FontColor(BrandBlue);
                col.Item().PaddingTop(4).Row(row =>
                {
                    if (!string.IsNullOrEmpty(Settings.BankName) && Settings.ShowBankName)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(lang switch { "fr" => "Banque", "de" => "Bank", "ar" => "البنك", _ => "Bank" }).FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankName).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankBIC) && Settings.ShowBankBIC)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("BIC / SWIFT").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankBIC).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankRIB) && Settings.ShowBankRIB)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("RIB").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankRIB).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankIBAN) && Settings.ShowBankIBAN)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("IBAN").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankIBAN).FontSize(9).SemiBold();
                        });
                    }
                });
            });
        }

        /// <summary>
        /// Generate XML representation of the invoice data
        /// </summary>
        string GenerateInvoiceXml()
        {
            if (Model is not Invoice invoice) return "";
            
            var xml = new XElement("Invoice",
                new XElement("Number", invoice.Number),
                new XElement("Date", invoice.Date.ToString("yyyy-MM-dd")),
                new XElement("DueDate", invoice.DueDate?.ToString("yyyy-MM-dd") ?? ""),
                new XElement("Status", invoice.Status),
                new XElement("Company",
                    new XElement("Name", Settings.CompanyName),
                    new XElement("Address", Settings.CompanyAddress),
                    new XElement("TaxId", Settings.CompanyTaxId),
                    new XElement("Phone", Settings.CompanyPhone)
                ),
                new XElement("Client",
                    new XElement("Name", invoice.Client?.Name ?? ""),
                    new XElement("Address", invoice.Client?.Address ?? ""),
                    new XElement("TaxId", invoice.Client?.MatriculeFiscal ?? ""),
                    new XElement("Phone", invoice.Client?.Phone ?? "")
                ),
                new XElement("Items",
                    invoice.Items.Select(item => new XElement("Item",
                        new XElement("Description", item.Description),
                        new XElement("Quantity", item.Quantity),
                        new XElement("UnitPrice", item.Price),
                        new XElement("TaxRate", item.TaxRate),
                        new XElement("TotalHT", item.TotalItemHT)
                    ))
                ),
                new XElement("Totals",
                    new XElement("SubTotal", invoice.SubTotal),
                    new XElement("TaxAmount", invoice.TaxAmount),
                    new XElement("CustomTax", new XAttribute("name", invoice.TfiscalName ?? ""), invoice.Tfiscal),
                    new XElement("TotalTTC", invoice.TotalAmount),
                    new XElement("Currency", Settings.CurrencySymbol)
                ),
                new XElement("Payments",
                    invoice.Payments?.Select(p => new XElement("Payment",
                        new XElement("Amount", p.Amount),
                        new XElement("Date", p.PaymentDate.ToString("yyyy-MM-dd")),
                        new XElement("Status", p.Status)
                    )) ?? Enumerable.Empty<XElement>()
                )
            );
            
            return xml.ToString();
        }

        /// <summary>
        /// Generate QR code containing invoice summary payload as PNG bytes
        /// </summary>
        byte[] GenerateQrCode()
        {
            try
            {
                if (Model is not Invoice) return Array.Empty<byte>();

                var currency = string.IsNullOrWhiteSpace(Settings.CurrencySymbol) ? "EUR" : Settings.CurrencySymbol.Trim();
                var secureUrl = BuildSecureVerificationUrl();
                var qrPayload =
                    "{" +
                    $"\"invoiceNumber\":\"{EscapeJsonValue(Model.Number ?? string.Empty)}\"," +
                    $"\"companyName\":\"{EscapeJsonValue(Settings.CompanyName ?? string.Empty)}\"," +
                    $"\"totalAmount\":\"{(Model.TotalAmount ?? 0).ToString("F3", CultureInfo.InvariantCulture)}\"," +
                    $"\"currency\":\"{EscapeJsonValue(currency)}\"," +
                    $"\"secureUrl\":\"{EscapeJsonValue(secureUrl)}\"" +
                    "}";
                
                using var qrGenerator = new QRCodeGenerator();
                var qrCodeData = qrGenerator.CreateQrCode(qrPayload, QRCodeGenerator.ECCLevel.M);
                using var qrCode = new PngByteQRCode(qrCodeData);
                return qrCode.GetGraphic(8);
            }
            catch
            {
                return Array.Empty<byte>();
            }
        }

        private string BuildSecureVerificationUrl()
        {
            if (!string.IsNullOrWhiteSpace(Settings.VerificationUrl) && !string.IsNullOrWhiteSpace(Settings.VerificationToken))
                return $"{Settings.VerificationUrl!.TrimEnd('/')}/{Settings.VerificationToken}";

            if (!string.IsNullOrWhiteSpace(Settings.VerificationUrl))
                return Settings.VerificationUrl!;

            return string.Empty;
        }

        private static string EscapeJsonValue(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"");
        }
        void ComposeTotals(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            var paymentMethodsLabel = lang switch { "fr" => "Modes de paiement", "de" => "Zahlungsmethoden", "ar" => "طرق الدفع", _ => "Payment Methods" };
            var paymentMethods = (Settings.PaymentMethods ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var subtotalLabel = lang switch { "fr" => "Total H TVA", "de" => "Zwischensumme", "ar" => "المجموع الفرعي", _ => "Subtotal" };
            var vatPrefix = lang switch { "fr" => "TVA", "de" => "MwSt", "ar" => "ضريبة", _ => "VAT" };
            var totalTtcLabel = lang switch { "fr" => "Total TTC", "de" => "Gesamtbetrag", "ar" => "المجموع الكلي", _ => "Total" };

            container.Row(row =>
            {
                if (Model is not DeliveryNote)
                {
                    if (Model is not Devis)
                    {
                        row.RelativeItem(2).Column(c =>
                        {
                            if (paymentMethods.Any())
                            {
                                c.Item().Text(paymentMethodsLabel).Bold().FontColor(BrandBlue);
                                foreach (var method in paymentMethods)
                                    c.Item().Text(method);
                            }
                        });
                    }

                    row.RelativeItem(2).Column(c => { });

                    row.RelativeItem(3).AlignRight().Column(c =>
                    {
                        var subtotalFormatted = FormatAmount(Model.SubTotal ?? 0);
                        var taxFormatted = FormatAmount(Model.TaxAmount ?? 0);
                        var totalFormatted = FormatAmount(Model.TotalAmount ?? 0);
                        var subtotalFontSize = ResolveAmountFontSize(subtotalFormatted, 10f);
                        var taxFontSize = ResolveAmountFontSize(taxFormatted, 10f);
                        var totalFontSize = ResolveAmountFontSize(totalFormatted, 14f);

                        c.Item().Table(t =>
                        {
                            t.ColumnsDefinition(cols => { cols.RelativeColumn(); cols.RelativeColumn(); });

                            t.Cell().Padding(5).Text(subtotalLabel);
                            t.Cell().AlignRight().Padding(5).Text(text =>
                            {
                                text.DefaultTextStyle(x => x.FontSize(subtotalFontSize).SemiBold());
                                text.Span(subtotalFormatted);
                            });

                            var hasVat = Model.Items.Any(i => (i.TaxRate ?? 0) > 0);
                            var vatLabelText = hasVat
                                ? $"{vatPrefix} ({Model.Items.Where(i => (i.TaxRate ?? 0) > 0).Select(i => i.TaxRate ?? 0).First():P0})"
                                : $"{vatPrefix} (0%)";

                            t.Cell().Padding(5).Text(vatLabelText);
                            t.Cell().AlignRight().Padding(5).Text(text =>
                            {
                                text.DefaultTextStyle(x => x.FontSize(taxFontSize).SemiBold());
                                text.Span(taxFormatted);
                            });

                            if (Model.Tfiscal.HasValue && Model.Tfiscal.Value > 0)
                            {
                                var taxName = Model.TfiscalName ?? Settings.CustomTaxName ?? "Timbre fiscal";
                                var customTaxFormatted = FormatAmount(Model.Tfiscal.Value);
                                var customTaxFontSize = ResolveAmountFontSize(customTaxFormatted, 10f);

                                t.Cell().Padding(5).Text(taxName);
                                t.Cell().AlignRight().Padding(5).Text(text =>
                                {
                                    text.DefaultTextStyle(x => x.FontSize(customTaxFontSize).SemiBold());
                                    text.Span(customTaxFormatted);
                                });
                            }

                            t.Cell().ColumnSpan(2).PaddingTop(10).BorderTop(2).BorderColor(BrandBlue).PaddingTop(5).Row(r =>
                            {
                                r.RelativeItem().Text(totalTtcLabel).Bold().FontSize(14).FontColor(BrandBlue);
                                r.RelativeItem().AlignRight().Text(text =>
                                {
                                    text.DefaultTextStyle(x => x.Bold().FontSize(totalFontSize).FontColor(BrandBlue));
                                    text.Span(totalFormatted);
                                });
                            });
                        });
                    });
                }
            });
        }

        private string ResolveDefaultFooterText(string lang)
        {
            return lang switch
            {
                "fr" => "Merci pour votre confiance",
                "de" => "Vielen Dank für Ihr Vertrauen",
                "ar" => "شكراً لثقتكم",
                _ => "Thank you for your business"
            };
        }

        

        private void ComposeFooterSection(IContainer container)
        {
            if (string.IsNullOrWhiteSpace(Settings.FooterText))
                return;

            var footerText = Settings.FooterText;

            var qrBytes = Model is Invoice ? GenerateQrCode() : Array.Empty<byte>();

            container.Column(col =>
            {
                col.Spacing(6);

                col.Item().Row(row =>
                {
                    row.RelativeItem().Column(leftCol =>
                    {
                        if (qrBytes.Length > 0)
                            leftCol.Item().Width(96).Height(96).Image(qrBytes).FitArea();
                    });

                });

                col.Item().Row(row =>
                {
                    row.RelativeItem().Text(footerText).FontSize(10).FontColor("#4A5568").Italic();
                    row.ConstantItem(20);
                    row.RelativeItem();
                });
            });
        }

        void ComposeSignature(IContainer container)
        {
            if (!Settings.ShowSignature && !Settings.ShowStamp)
                return;

            var hasSignatureContent = !string.IsNullOrWhiteSpace(Settings.PdfSignatureText)
                || !string.IsNullOrWhiteSpace(Settings.PdfSignerPosition)
                || (Settings.ShowSignatureOnPdf && Settings.SignatureImageData?.Length > 0);

            if (!hasSignatureContent)
                return;

            container.Column(sigCol =>
            {
                sigCol.Item().PaddingTop(8).AlignRight().Column(innerCol =>
                {
                    if (!string.IsNullOrWhiteSpace(Settings.PdfSignatureText))
                        innerCol.Item().AlignCenter().Text(Settings.PdfSignatureText).FontSize(16).Italic().Bold().FontColor("#1A202C");

                    innerCol.Item().PaddingTop(4).AlignCenter().Width(220).LineHorizontal(2).LineColor("#E2E8F0");

                    if (!string.IsNullOrWhiteSpace(Settings.PdfSignerPosition))
                        innerCol.Item().PaddingTop(4).AlignCenter().Text(Settings.PdfSignerPosition).FontSize(10).FontColor(Colors.Grey.Medium);

                    if (Settings.ShowSignatureOnPdf && Settings.SignatureImageData?.Length > 0)
                        innerCol.Item().PaddingTop(6).AlignCenter().Width(120).Height(50).Image(Settings.SignatureImageData).FitArea();

                    else
                    {
                        innerCol.Item().PaddingTop(16).AlignCenter().Width(160).BorderBottom(1).BorderColor("#CBD5E0").PaddingBottom(20);
                    }
                });
            });
        }

    }

    /// <summary>
    /// Generates a "Remaining Payment Notice" PDF for an invoice.
    /// Shows invoice number, client, total, paid, remaining, due date & a professional reminder.
    /// Reuses the same brand styling, colors, signature block, and currency from the invoice PDF.
    /// </summary>
    public class RemainingPaymentDocument : IDocument
    {
        public Invoice Invoice { get; }
        public PdfSettings Settings { get; }

        private string BrandBlue => Settings.PrimaryColor;
        private static readonly string HeaderDark = "#232323";
        private static readonly string TextGrey = "#666666";
        private static readonly CultureInfo MoneyCulture = CultureInfo.GetCultureInfo("en-US");
        private string CurrencyCode => Settings.CurrencySymbol;
        private readonly byte[] LogoBytes;

        public RemainingPaymentDocument(Invoice invoice, PdfSettings settings)
        {
            Invoice = invoice;
            Settings = settings ?? new PdfSettings();
            QuestPDF.Settings.License = LicenseType.Community;

            if (Settings.LogoData != null && Settings.LogoData.Length > 0)
            {
                LogoBytes = Settings.LogoData;
            }
            else
            {
                var logoPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "logo.png");
                if (!File.Exists(logoPath))
                    logoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "images", "logo.png");
                LogoBytes = File.Exists(logoPath) ? File.ReadAllBytes(logoPath) : Array.Empty<byte>();
            }
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;
        public DocumentSettings GetSettings() => DocumentSettings.Default;

        private string FormatAmount(decimal value)
        {
            var currency = string.IsNullOrWhiteSpace(CurrencyCode) ? "EUR" : CurrencyCode.Trim();
            return $"{value.ToString("N2", MoneyCulture)}\u00A0{currency}";
        }

        private static float ResolveAmountFontSize(string formatted, float baseFontSize = 10)
        {
            if (formatted.Length >= 24) return Math.Max(7.5f, baseFontSize - 2.5f);
            if (formatted.Length >= 20) return Math.Max(8f, baseFontSize - 2f);
            if (formatted.Length >= 17) return Math.Max(8.5f, baseFontSize - 1.5f);
            if (formatted.Length >= 15) return Math.Max(9f, baseFontSize - 1f);
            return baseFontSize;
        }

        public void Compose(IDocumentContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(50);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(TextGrey));

                // ── Watermark ──
                page.Background().AlignCenter().AlignMiddle()
                    .Text(lang switch
                    {
                        "fr" => "Rappel de Paiement",
                        "de" => "Zahlungserinnerung",
                        "ar" => "تذكير بالدفع",
                        _ => "Payment Reminder"
                    })
                    .FontSize(60)
                    .Bold()
                    .FontColor("#00000008");

                page.Header().Element(ComposeHeader);
                page.Content().Element(ComposeContent);

                page.Footer().AlignCenter().Text(x =>
                {
                    x.CurrentPageNumber();
                    x.Span(" / ");
                    x.TotalPages();
                });
            });
        }

        private void ComposeHeader(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var title = lang switch
            {
                "fr" => "Avis de Reste à Payer",
                "de" => "Restbetrag-Zahlungsaufforderung",
                "ar" => "إشعار بالمبلغ المتبقي",
                _ => "Remaining Payment Notice"
            };

            var culture = lang switch
            {
                "fr" => new CultureInfo("fr-FR"),
                "de" => new CultureInfo("de-DE"),
                "ar" => new CultureInfo("ar-TN"),
                _ => new CultureInfo("en-US")
            };

            var dateLabel = lang switch { "fr" => "Date", "de" => "Datum", "ar" => "التاريخ", _ => "Date" };
            var refLabel = lang switch { "fr" => "Réf. Facture", "de" => "Rechnungs-Nr.", "ar" => "رقم الفاتورة", _ => "Invoice Ref." };

            container.Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().PaddingTop(20)
                        .Text(title)
                        .FontSize(20).Bold().FontColor(BrandBlue);

                    col.Item().PaddingTop(2)
                        .Text(Invoice.Number)
                        .FontSize(15).Bold().FontColor(BrandBlue);

                    col.Item().Text(text =>
                    {
                        text.Span($"{dateLabel}: ").SemiBold();
                        text.Span(DateTime.UtcNow.ToString("D", culture));
                    });

                    col.Item().Text(text =>
                    {
                        text.Span($"{refLabel}: ").SemiBold();
                        text.Span(Invoice.Number);
                    });
                });

                if (Settings.ShowLogo && LogoBytes.Length > 0)
                {
                    row.ConstantItem(120).Height(120).Image(LogoBytes).FitUnproportionally();
                }
            });
        }

        private void ComposeContent(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            var fromLabel = lang switch { "fr" => "De", "de" => "Von", "ar" => "من", _ => "From" };
            var clientLabel = lang switch { "fr" => "Client", "de" => "Kunde", "ar" => "العميل", _ => "Client" };
            var unknownClient = lang switch { "fr" => "Client inconnu", "de" => "Unbekannter Kunde", "ar" => "عميل غير معروف", _ => "Unknown Client" };

            var owner = new Client
            {
                Name = Settings.CompanyName,
                Address = Settings.CompanyAddress,
                MatriculeFiscal = Settings.CompanyTaxId,
                Phone = Settings.CompanyPhone
            };
            var client = Invoice.Client ?? new Client
            {
                Name = unknownClient,
                Address = string.Empty,
                MatriculeFiscal = string.Empty,
                Phone = string.Empty
            };

            container.PaddingVertical(20).Column(column =>
            {
                column.Spacing(5);

                // ── From / Client addresses ──
                column.Item().Row(row =>
                {
                    row.RelativeItem().Component(new AddressComponent(fromLabel, owner));
                    row.ConstantItem(50);
                    row.RelativeItem().Component(new AddressComponent(clientLabel, client));
                });

                // ── Payment Summary Table ──
                column.Item().PaddingTop(30).Element(ComposePaymentSummary);

                // ── Professional Reminder Message ──
                column.Item().PaddingTop(30).Element(ComposeReminderMessage);

                // ── Bank info (if available) ──
                if (HasBankInfo())
                {
                    column.Item().PaddingTop(15).Element(ComposeBankInfo);
                }

                if (Settings.ShowSignature || Settings.ShowStamp)
                {
                    column.Item().PaddingTop(16).Element(ComposeSignature);
                }

                column.Item().PaddingTop(30).Element(ComposeFooterSection);
            });
        }

        private void ComposePaymentSummary(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            var invoiceNumberLabel = lang switch { "fr" => "N° Facture", "de" => "Rechnungs-Nr.", "ar" => "رقم الفاتورة", _ => "Invoice Number" };
            var clientNameLabel = lang switch { "fr" => "Client", "de" => "Kunde", "ar" => "العميل", _ => "Client" };
            var invoiceDateLabel = lang switch { "fr" => "Date de facture", "de" => "Rechnungsdatum", "ar" => "تاريخ الفاتورة", _ => "Invoice Date" };
            var dueDateLabel = lang switch { "fr" => "Date d'échéance", "de" => "Fälligkeitsdatum", "ar" => "تاريخ الاستحقاق", _ => "Due Date" };
            var totalAmountLabel = lang switch { "fr" => "Montant Total TTC", "de" => "Gesamtbetrag", "ar" => "المبلغ الإجمالي", _ => "Total Amount" };
            var paidAmountLabel = lang switch { "fr" => "Montant Payé", "de" => "Bezahlter Betrag", "ar" => "المبلغ المدفوع", _ => "Amount Paid" };
            var remainingLabel = lang switch { "fr" => "Reste à Payer", "de" => "Restbetrag", "ar" => "المبلغ المتبقي", _ => "Remaining Balance" };
            var notApplicable = lang switch { "fr" => "Non défini", "de" => "Nicht festgelegt", "ar" => "غير محدد", _ => "Not set" };

            var culture = lang switch
            {
                "fr" => new CultureInfo("fr-FR"),
                "de" => new CultureInfo("de-DE"),
                "ar" => new CultureInfo("ar-TN"),
                _ => new CultureInfo("en-US")
            };

            var totalFormatted = FormatAmount(Invoice.TotalAmount ?? 0);
            var paidFormatted = FormatAmount(Invoice.AmountPaid);
            var remainingFormatted = FormatAmount(Invoice.RemainingAmount);

            container.Table(table =>
            {
                table.ColumnsDefinition(cols =>
                {
                    cols.RelativeColumn(3);
                    cols.RelativeColumn(4);
                });

                // Helper for label rows
                void AddRow(string label, string value, bool isAmount = false, bool isHighlight = false)
                {
                    table.Cell().Background("#F8F9FA").Border(1).BorderColor("#E2E8F0").Padding(10)
                        .Text(label).SemiBold().FontSize(10).FontColor(HeaderDark);

                    var cell = table.Cell().Background(isHighlight ? BrandBlue : Colors.White)
                        .Border(1).BorderColor("#E2E8F0").Padding(10);

                    if (isAmount)
                    {
                        var fontSize = ResolveAmountFontSize(value, isHighlight ? 14f : 11f);
                        cell.AlignRight().Text(text =>
                        {
                            text.DefaultTextStyle(x => x
                                .FontSize(fontSize)
                                .Bold()
                                .FontColor(isHighlight ? Colors.White : HeaderDark));
                            text.Span(value);
                        });
                    }
                    else
                    {
                        cell.Text(value).FontSize(10).FontColor(isHighlight ? Colors.White : HeaderDark);
                    }
                }

                AddRow(invoiceNumberLabel, Invoice.Number);
                AddRow(clientNameLabel, Invoice.Client?.Name ?? unknownClient(lang));
                AddRow(invoiceDateLabel, Invoice.Date.ToString("D", culture));
                AddRow(dueDateLabel, Invoice.DueDate?.ToString("D", culture) ?? notApplicable);

                // Separator
                table.Cell().ColumnSpan(2).PaddingVertical(5);

                AddRow(totalAmountLabel, totalFormatted, isAmount: true);
                AddRow(paidAmountLabel, paidFormatted, isAmount: true);
                AddRow(remainingLabel, remainingFormatted, isAmount: true, isHighlight: true);
            });
        }

        private static string unknownClient(string lang) => lang switch
        {
            "fr" => "Client inconnu",
            "de" => "Unbekannter Kunde",
            "ar" => "عميل غير معروف",
            _ => "Unknown Client"
        };

        private void ComposeReminderMessage(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            var reminderTitle = lang switch
            {
                "fr" => "Rappel de paiement",
                "de" => "Zahlungserinnerung",
                "ar" => "تذكير بالدفع",
                _ => "Payment Reminder"
            };

            var reminderBody = lang switch
            {
                "fr" => "Nous vous rappelons que le solde mentionné ci-dessus reste dû au titre de la facture référencée. " +
                        "Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais. " +
                        "Si le paiement a déjà été effectué, veuillez ne pas tenir compte de cet avis.",
                "de" => "Wir möchten Sie daran erinnern, dass der oben genannte Restbetrag für die referenzierte Rechnung fällig ist. " +
                        "Bitte veranlassen Sie die Zahlung baldmöglichst. " +
                        "Sollte die Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben als gegenstandslos.",
                "ar" => "نود تذكيركم بأن المبلغ المتبقي المذكور أعلاه مستحق بموجب الفاتورة المشار إليها. " +
                        "يرجى إجراء الدفع في أقرب وقت ممكن. " +
                        "إذا كان الدفع قد تم بالفعل، يرجى تجاهل هذا الإشعار.",
                _ => "This is a friendly reminder that the outstanding balance shown above remains due for the referenced invoice. " +
                     "We kindly request that you arrange payment at your earliest convenience. " +
                     "If payment has already been made, please disregard this notice."
            };

            container.Background("#FFFBEB").Border(1).BorderColor("#FDE68A").Padding(15).Column(col =>
            {
                col.Item().Text(reminderTitle).Bold().FontSize(12).FontColor("#92400E");
                col.Item().PaddingTop(8).Text(reminderBody).FontSize(10).FontColor("#78350F").LineHeight(1.5f);
            });
        }

        private string ResolveDefaultFooterText(string lang)
        {
            return lang switch
            {
                "fr" => "Merci pour votre confiance",
                "de" => "Vielen Dank für Ihr Vertrauen",
                "ar" => "شكراً لثقتكم",
                _ => "Thank you for your business"
            };
        }

        private byte[] GenerateQrCode()
        {
            try
            {
                var currency = string.IsNullOrWhiteSpace(Settings.CurrencySymbol) ? "EUR" : Settings.CurrencySymbol.Trim();
                var secureUrl = BuildSecureVerificationUrl();
                var qrPayload =
                    "{" +
                    $"\"invoiceNumber\":\"{EscapeJsonValue(Invoice.Number ?? string.Empty)}\"," +
                    $"\"companyName\":\"{EscapeJsonValue(Settings.CompanyName ?? string.Empty)}\"," +
                    $"\"totalAmount\":\"{(Invoice.TotalAmount ?? 0).ToString("F3", CultureInfo.InvariantCulture)}\"," +
                    $"\"currency\":\"{EscapeJsonValue(currency)}\"," +
                    $"\"secureUrl\":\"{EscapeJsonValue(secureUrl)}\"" +
                    "}";

                using var qrGenerator = new QRCodeGenerator();
                var qrCodeData = qrGenerator.CreateQrCode(qrPayload, QRCodeGenerator.ECCLevel.M);
                using var qrCode = new PngByteQRCode(qrCodeData);
                return qrCode.GetGraphic(8);
            }
            catch
            {
                return Array.Empty<byte>();
            }
        }

        private string BuildSecureVerificationUrl()
        {
            if (!string.IsNullOrWhiteSpace(Settings.VerificationUrl) && !string.IsNullOrWhiteSpace(Settings.VerificationToken))
                return $"{Settings.VerificationUrl!.TrimEnd('/')}/{Settings.VerificationToken}";

            if (!string.IsNullOrWhiteSpace(Settings.VerificationUrl))
                return Settings.VerificationUrl!;

            return string.Empty;
        }

        private static string EscapeJsonValue(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"");
        }

        private void ComposeFooterSection(IContainer container)
        {
            if (string.IsNullOrWhiteSpace(Settings.FooterText))
                return;

            var footerText = Settings.FooterText;

            var qrBytes = GenerateQrCode();

            container.Column(col =>
            {
                col.Spacing(6);

                col.Item().Row(row =>
                {
                    row.RelativeItem().Column(leftCol =>
                    {
                        if (qrBytes.Length > 0)
                            leftCol.Item().Width(96).Height(96).Image(qrBytes).FitArea();
                    });

                });

                col.Item().Row(row =>
                {
                    row.RelativeItem().Text(footerText).FontSize(10).FontColor("#4A5568").Italic();
                    row.ConstantItem(20);
                    row.RelativeItem();
                });
            });
        }

        private void ComposeSignature(IContainer container)
        {
            if (!Settings.ShowSignature && !Settings.ShowStamp)
                return;

            var hasSignatureContent = !string.IsNullOrWhiteSpace(Settings.PdfSignatureText)
                || !string.IsNullOrWhiteSpace(Settings.PdfSignerPosition)
                || (Settings.ShowSignatureOnPdf && Settings.SignatureImageData?.Length > 0);

            if (!hasSignatureContent)
                return;

            container.Column(sigCol =>
            {
                sigCol.Item().PaddingTop(8).AlignRight().Column(innerCol =>
                {
                    if (!string.IsNullOrWhiteSpace(Settings.PdfSignatureText))
                    {
                        innerCol.Item().AlignCenter().Text(Settings.PdfSignatureText).FontSize(16).Italic().Bold().FontColor("#1A202C");
                    }

                    innerCol.Item().PaddingTop(4).AlignCenter().Width(220).LineHorizontal(2).LineColor("#E2E8F0");

                    if (!string.IsNullOrWhiteSpace(Settings.PdfSignerPosition))
                    {
                        innerCol.Item().PaddingTop(4).AlignCenter().Text(Settings.PdfSignerPosition).FontSize(10).FontColor(Colors.Grey.Medium);
                    }

                    if (Settings.ShowSignatureOnPdf && Settings.SignatureImageData?.Length > 0)
                    {
                        innerCol.Item().PaddingTop(6).AlignCenter().Width(120).Height(50).Image(Settings.SignatureImageData).FitArea();
                    }


                });
            });
        }

        private bool HasBankInfo()
        {
            return (!string.IsNullOrEmpty(Settings.BankName) && Settings.ShowBankName)
                || (!string.IsNullOrEmpty(Settings.BankBIC) && Settings.ShowBankBIC)
                || (!string.IsNullOrEmpty(Settings.BankRIB) && Settings.ShowBankRIB)
                || (!string.IsNullOrEmpty(Settings.BankIBAN) && Settings.ShowBankIBAN);
        }

        private void ComposeBankInfo(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var bankLabel = lang switch { "fr" => "Coordonnées bancaires", "de" => "Bankverbindung", "ar" => "المعلومات البنكية", _ => "Bank Details" };

            container.Background("#F8F9FA").Border(1).BorderColor("#E0E0E0").Padding(10).Column(col =>
            {
                col.Item().Text(bankLabel).Bold().FontSize(9).FontColor(BrandBlue);
                col.Item().PaddingTop(4).Row(row =>
                {
                    if (!string.IsNullOrEmpty(Settings.BankName) && Settings.ShowBankName)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(lang switch { "fr" => "Banque", "de" => "Bank", "ar" => "البنك", _ => "Bank" }).FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankName).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankBIC) && Settings.ShowBankBIC)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("BIC / SWIFT").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankBIC).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankRIB) && Settings.ShowBankRIB)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("RIB").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankRIB).FontSize(9).SemiBold();
                        });
                    }
                    if (!string.IsNullOrEmpty(Settings.BankIBAN) && Settings.ShowBankIBAN)
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("IBAN").FontSize(7).FontColor("#999");
                            c.Item().Text(Settings.BankIBAN).FontSize(9).SemiBold();
                        });
                    }
                });
            });
        }
    }

}
