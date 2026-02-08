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
        public string InvoiceLanguage { get; set; } = "fr"; // fr, en, de, ar
        
        // Signature / Cachet image
        public byte[]? SignatureImageData { get; set; }
        public bool ShowSignatureOnPdf { get; set; } = false;
        
        // Bank information
        public string? BankName { get; set; }
        public string? BankBIC { get; set; }
        public string? BankRIB { get; set; }
        public string? BankIBAN { get; set; }
        public bool ShowBankName { get; set; } = true;
        public bool ShowBankBIC { get; set; } = true;
        public bool ShowBankRIB { get; set; } = true;
        public bool ShowBankIBAN { get; set; } = true;
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
            // Tunisian format: space for thousands, comma for decimals (1 000,000 DT)
            var tndFormat = new NumberFormatInfo
            {
                NumberGroupSeparator = "\u00A0", // non-breaking space
                NumberDecimalSeparator = ",",
                NumberGroupSizes = new[] { 3 }
            };

            return value.ToString("N3", tndFormat) + " " + CurrencyCode;
        }
        private static string FormatAmountWithoutCurrency(decimal value)
        {
            var tndFormat = new NumberFormatInfo
            {
                NumberGroupSeparator = "\u00A0",
                NumberDecimalSeparator = ",",
                NumberGroupSizes = new[] { 3 }
            };

            return value.ToString("N3", tndFormat);
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
                (DeliveryNote, "ar") => "إذن تسليم",
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
                        .FontSize(20).Bold().FontColor(Colors.Blue.Medium);
                    column.Item().PaddingTop(2)
                        .Text($"{Model.Number}")
                        .FontSize(15).Bold().FontColor(Colors.Blue.Medium);

                    column.Item().Text(text =>
                    {
                        text.Span($"{dateLabel}: ").SemiBold();
                        text.Span(Model.Date.ToString("D", culture));
                    });

                    // Show linked quote reference for invoices
                    if (Model is Invoice invoice && invoice.DevisId.HasValue && invoice.Devis != null)
                    {
                        var refLabel = lang switch { "fr" => "Réf. Devis", "de" => "Angebot-Ref.", "ar" => "مرجع عرض السعر", _ => "Quote Ref." };
                        column.Item().Text(text =>
                        {
                            text.Span($"{refLabel}: ").SemiBold();
                            text.Span(invoice.Devis.Number);
                        });
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
            var descLabel = lang switch { "fr" => "Désignation", "de" => "Bezeichnung", "ar" => "الوصف", _ => "Description" };
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
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
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
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text($"{i+ 1}");
                        table.Cell().Element(e => CellStyle(e, isEven)).Text(item.Description);
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignRight().Text(item.Quantity?.ToString("N0", qtyFormat).Replace("\u0020", "\u00A0"));
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text($"{item.TaxRate:P0}");
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text(FormatAmountWithoutCurrency(item.Price??0));
                        table.Cell().Element(e => CellStyle(e, isEven)).AlignCenter().Text(FormatAmountWithoutCurrency(item.TotalItemHT));
                        static IContainer CellStyle(IContainer container,bool isEven)
                        {
                            return container.Background(isEven ? ZebraGrey : Colors.White).PaddingVertical(5);
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

            var owner = new Client
            {
                Name = Settings.CompanyName,
                Address = Settings.CompanyAddress,
                MatriculeFiscal = Settings.CompanyTaxId,
                Phone = Settings.CompanyPhone
            };
            container.PaddingVertical(20).Column(column =>
            {
                column.Spacing(5);

                column.Item().Row(row =>
                {
                    row.RelativeItem().Component(new AddressComponent(fromLabel, owner));
                    row.ConstantItem(50);
                    row.RelativeItem().Component(new AddressComponent(clientLabel, Model.Client!));
                });

                column.Item().Element(ComposeTable);

                
                column.Item().PaddingTop(25).Element(compose => ComposeTotals(compose));
                
                // Bank info section (only for invoices)
                if (Model is Invoice && HasBankInfo())
                {
                    column.Item().PaddingTop(15).Element(compose => ComposeBankInfo(compose));
                }
                
                // QR code + Signature row
                column.Item().PaddingTop(20).Row(row =>
                {
                    // QR Code on the left (only for invoices)
                    if (Model is Invoice)
                    {
                        row.ConstantItem(110).Column(qrCol =>
                        {
                            var qrBytes = GenerateQrCode();
                            if (qrBytes.Length > 0)
                            {
                                qrCol.Item().Width(100).Height(100).Image(qrBytes).FitArea();
                            }
                        });
                        row.ConstantItem(20); // spacer
                    }
                    
                    // Signature on the right (takes remaining space)
                    row.RelativeItem().Element(compose => ComposeSignature(compose));
                });
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
        /// Generate QR code containing invoice XML data as PNG bytes
        /// </summary>
        byte[] GenerateQrCode()
        {
            try
            {
                var xmlData = GenerateInvoiceXml();
                if (string.IsNullOrEmpty(xmlData)) return Array.Empty<byte>();
                
                // Truncate for QR code size limits — include essential data
                // Full XML could be too large for QR; include a compact summary  
                var compactXml = new XElement("Inv",
                    new XAttribute("n", Model.Number ?? ""),
                    new XAttribute("d", Model.Date.ToString("yyyy-MM-dd")),
                    new XElement("Co", Settings.CompanyName),
                    new XElement("Cl", Model.Client?.Name ?? ""),
                    new XElement("ST", Model.SubTotal?.ToString("F3") ?? "0"),
                    new XElement("Tax", Model.TaxAmount?.ToString("F3") ?? "0"),
                    new XElement("TTC", Model.TotalAmount?.ToString("F3") ?? "0"),
                    new XElement("Cur", Settings.CurrencySymbol)
                ).ToString();
                
                using var qrGenerator = new QRCodeGenerator();
                var qrCodeData = qrGenerator.CreateQrCode(compactXml, QRCodeGenerator.ECCLevel.M);
                using var qrCode = new PngByteQRCode(qrCodeData);
                return qrCode.GetGraphic(5);
            }
            catch
            {
                return Array.Empty<byte>();
            }
        }
        void ComposeTotals(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";

            // Translated labels
            var paymentMethodsLabel = lang switch { "fr" => "Modes de paiement", "de" => "Zahlungsmethoden", "ar" => "طرق الدفع", _ => "Payment Methods" };
            var paymentMethodsLine1 = lang switch { "fr" => "Virement bancaire / Chèque /", "de" => "Überweisung / Scheck /", "ar" => "تحويل بنكي / شيك /", _ => "Bank Transfer / Check /" };
            var paymentMethodsLine2 = lang switch { "fr" => "Traite / Espèces", "de" => "Wechsel / Bargeld", "ar" => "كمبيالة / نقد", _ => "Bank Draft / Cash" };
            var subtotalLabel = lang switch { "fr" => "Sous-total", "de" => "Zwischensumme", "ar" => "المجموع الفرعي", _ => "Subtotal" };
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
                            c.Item().Text(paymentMethodsLabel).Bold().FontColor(BrandBlue);
                            c.Item().Text(paymentMethodsLine1);
                            c.Item().Text(paymentMethodsLine2);
                        });
                    }
                    // Left Side: Terms
                    row.RelativeItem(2).Column(c =>
                    { });
                    // Right Side: Numbers
                    row.RelativeItem(3).AlignRight().Column(c =>
                    {
               
                        c.Item().Table(t =>
                        {
                            t.ColumnsDefinition(cols => { cols.RelativeColumn(); cols.RelativeColumn(); });

                            t.Cell().Padding(5).Text(subtotalLabel);
                            t.Cell().AlignRight().Padding(5).Text(FormatAmount(Model.SubTotal??0));

                            // Show actual tax rate: check if any items have TVA
                            var hasVat = Model.Items.Any(i => (i.TaxRate ?? 0) > 0);
                            var vatLabelText = hasVat ? $"{vatPrefix} ({Model.Items.Where(i => (i.TaxRate ?? 0) > 0).Select(i => i.TaxRate ?? 0).First():P0})" : $"{vatPrefix} (0%)";
                            t.Cell().Padding(5).Text(vatLabelText);
                            t.Cell().AlignRight().Padding(5).Text(FormatAmount(Model.TaxAmount??0));

                            // Only show custom tax if enabled and has a value
                            if (Model.Tfiscal.HasValue && Model.Tfiscal.Value > 0)
                            {
                                var taxName = Model.TfiscalName ?? Settings.CustomTaxName ?? "Timbre fiscal";
                                t.Cell().Padding(5).Text(taxName);
                                t.Cell().AlignRight().Padding(5).Text(FormatAmount(Model.Tfiscal.Value));
                            }

                            t.Cell().ColumnSpan(2).PaddingTop(10).BorderTop(2).BorderColor(BrandBlue).PaddingTop(5).Row(r =>
                            {
                                r.RelativeItem().Text(totalTtcLabel).Bold().FontSize(14).FontColor(BrandBlue);
                                r.RelativeItem().AlignRight().Text(FormatAmount(Model.TotalAmount??0)).Bold().FontSize(14).FontColor(BrandBlue);
                            });
                        });
                 
                    });
                    
                }
            
            });
        }
        void ComposeSignature(IContainer container)
        {
            var lang = Settings.InvoiceLanguage?.ToLower() ?? "fr";
            var thankYou = lang switch
            {
                "fr" => "MERCI POUR VOTRE CONFIANCE",
                "de" => "VIELEN DANK FÜR IHR VERTRAUEN",
                "ar" => "شكراً لثقتكم",
                _ => "THANK YOU FOR YOUR BUSINESS"
            };
            container.Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().PaddingTop(15).Text(thankYou).FontSize(10).SemiBold();
                });

                row.RelativeItem().AlignRight().Column(c =>
                {
                    // Vertical signature layout:
                    // 1. Name entered by user
                    // 2. Horizontal line
                    // 3. Optional title (pdfSignatureText)
                    // 4. Signature/cachet image (if enabled)
                    
                    var signatureName = !string.IsNullOrEmpty(Settings.CreatedByName)
                        ? Settings.CreatedByName
                        : Settings.CompanyName;
                    
                    // 1. Name
                    if (!string.IsNullOrEmpty(signatureName))
                    {
                        c.Item().AlignCenter().PaddingBottom(5).Text(signatureName).FontSize(14).SemiBold();
                    }
                    
                    // 2. Horizontal line
                    c.Item().BorderTop(1).BorderColor(Colors.Grey.Medium).PaddingTop(5);
                    
                    // 3. Optional title
                    if (!string.IsNullOrEmpty(Settings.PdfSignatureText))
                    {
                        c.Item().AlignCenter().PaddingTop(3).Text(Settings.PdfSignatureText).FontSize(9).Italic().FontColor(TextGrey);
                    }
                    
                    // 4. Signature/cachet image if enabled
                    if (Settings.ShowSignatureOnPdf && Settings.SignatureImageData != null && Settings.SignatureImageData.Length > 0)
                    {
                        c.Item().PaddingTop(5).AlignCenter().Width(140).Height(60).Image(Settings.SignatureImageData).FitArea();
                    }
                });
            });
        }

    }

}