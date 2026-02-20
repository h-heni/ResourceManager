using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Net;

namespace ResourceManager.Models
{
    public class Shared
    {
        [Key]
        public int Id { get; set; }

        // 1. Data Isolation: Everything belongs to a Company
        [Required]
        public int CompanyId { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        // 2. Audit: Who created this?
        public string? CreatedByUserId { get; set; }

        [ForeignKey("CreatedByUserId")]
        public ApplicationUser? CreatedByUser { get; set; }
        public string? CreatedBy { get; set; }
        public string? ModifiedBy { get; set; }
        public  DateTime CreatedAt { get; set; }
        public  DateTime? UpdatedAt { get; set; }= default;
        public  DateTime? DeletedAt { get; set; }= default;
        
        // Archival/Treatment status
        public bool Treated { get; set; } = false;
        public string? TreatedByUserId { get; set; }
        public DateTime? TreatedAt { get; set; }
        
        public bool IsDeleted { get; set; } = false;


    }
    public class Supplier : Shared
    {
        [Required(ErrorMessage = "Name is required.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "Address is required.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Tax identification number is required.")]
        public string TaxId { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public ICollection<SupplierInvoice> SupplierInvoices { get; set; } = new List<SupplierInvoice>();
    }
    public class SupplierInvoice
    {
        public int Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty; // Store relative path
        public string FileType { get; set; } = "PDF";
        public string InvoiceNumber { get; set; } = string.Empty;
        
        // Invoice details (Part 4: Extracted from PDF scan)
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TVA { get; set; }
        
        // Extraction metadata
        public string? RawExtractedText { get; set; }
        public double? ConfidenceScore { get; set; }
        public string? ExtractionStatus { get; set; } = "Pending"; // Pending, Extracted, Confirmed, Failed
        
        // Per-document currency (overrides company defaults)
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        
        public int? SupplierId { get; set; }
        public Supplier? Supplier { get; set; } = null!;
        public int? InvoiceId { get; set; }
        public Invoice? Invoice { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public bool IsDeleted { get; set; } = false;
        [Required]
        public int CompanyId { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        // 2. Audit: Who created this?
        public string? UserId { get; set; }

        [ForeignKey("UserId")]
        public ApplicationUser? CreatedByUser { get; set; }
        
        // Line items extracted from PDF
        public ICollection<SupplierInvoiceItem> Items { get; set; } = new List<SupplierInvoiceItem>();
        
        // Payment tracking
        public ICollection<SupplierPayment> Payments { get; set; } = new List<SupplierPayment>();
        
        [NotMapped]
        public decimal AmountPaid => Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal PendingAmount => Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0;
        /// <summary>
        /// Remaining = TotalTTC - (Confirmed + Pending). Never negative.
        /// </summary>
        [NotMapped]
        public decimal RemainingAmount => Math.Max(0, (TotalTTC ?? 0) - (AmountPaid + PendingAmount));
        [NotMapped]
        public string PaymentStatus => AmountPaid >= (TotalTTC ?? 0) && (TotalTTC ?? 0) > 0 ? "Paid"
            : AmountPaid > 0 ? "PartiallyPaid"
            : "Pending";
    }
    
    public class SupplierPayment
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? Notes { get; set; }
        public int SupplierInvoiceId { get; set; }
        public SupplierInvoice? SupplierInvoice { get; set; }
        public string? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Audit: Payment confirmation
        public string? ConfirmedByUserId { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public string Status { get; set; } = "Completed"; // Completed, Pending
        [NotMapped]
        public bool IsScheduled => Status == "Pending" && PaymentDate > DateTime.UtcNow;
    }
    
    public class SupplierInvoiceItem
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal? TaxRate { get; set; } = 0.19m;
        
        [NotMapped]
        public decimal TotalHT => UnitPrice * Quantity;
        [NotMapped]
        public decimal TaxAmount => TotalHT * (TaxRate ?? 0);
        [NotMapped]
        public decimal TotalTTC => TotalHT + TaxAmount;
        
        public int SupplierInvoiceId { get; set; }
        public SupplierInvoice? SupplierInvoice { get; set; }
    }
    public class Client : Shared, IClient
    {
        [Required(ErrorMessage ="Name is required.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "Address is required.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Tax identification number is required.")]
        public string TaxId { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public ICollection<Quote> Quotes { get; set; } = new List<Quote>();
        public ICollection<DeliveryNote> DeliveryNotes { get; set; } = new List<DeliveryNote>();
    }

    public class Invoice: Shared, IPdfDocumentData
    {
        [Required(ErrorMessage = "Enter the invoice number")]
        public string Number { get; set; } = string.Empty; // e.g. INV-2023-001
        public DateTime Date { get; set; }
        public DateTime? DueDate { get; set; } // Payment due date - nullable for backwards compatibility
        public int? ClientId { get; set; }
        
        [ForeignKey("ClientId")]
        public virtual Client? Client { get; set; }
        public int? QuoteId { get; set; }
        public Quote? Quote { get; set; } = null!;

        // Currency & Language inherited from linked Quote (backward compat: falls back to company settings)
        [NotMapped]
        public string? EffectiveCurrency => Quote?.Currency;
        [NotMapped]
        public string? EffectiveCurrencySymbol => Quote?.CurrencySymbol;
        [NotMapped]
        public string? EffectivePdfLanguage => Quote?.PdfLanguage;
        public string? SourceQuoteNumber { get; set; }
        public ICollection<InvoiceItem> InvoiceItems { get; set; } = new List<InvoiceItem>();
        public ICollection<Payment> Payments { get; set; } = new List<Payment>();

        // 2. Interface list for your PDF Document logic
        // This allows DeliveryNote to satisfy the IPdfDocumentData interface
        [NotMapped] // Tell EF Core NOT to try and map this to the database
        public List<IItem> Items
        {
            get => InvoiceItems.Cast<IItem>().ToList();
            set => InvoiceItems = value.Cast<InvoiceItem>().ToList();
        }
        // Configurable tax - read from CustomTaxAmount or stored value
        public decimal? Tfiscal { get; set; } = 1.000m;
        public string? TfiscalName { get; set; } = "Timbre Fiscal"; // Custom tax name for display
        public decimal? SubTotal { get; private set; }
        public decimal? TaxAmount { get; private set; }
        public decimal? TotalAmount { get; private set; }
        
        // Payment tracking - Only count completed payments for actual paid amount (revenue)
        [NotMapped]
        public decimal AmountPaid => Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal PendingAmount => Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0;
        /// <summary>
        /// Remaining = TotalAmount - (Confirmed + Pending). Never negative, never exceeds TotalAmount.
        /// </summary>
        [NotMapped]
        public decimal RemainingAmount => Math.Max(0, (TotalAmount ?? 0) - (AmountPaid + PendingAmount));
        
        // Payment due tracking
        [NotMapped]
        public bool IsOverdue => DueDate.HasValue && DueDate.Value < DateTime.UtcNow && Status != "Paid";
        [NotMapped] 
        public int? DaysUntilDue => DueDate.HasValue ? (int)(DueDate.Value - DateTime.UtcNow).TotalDays : null;
        [NotMapped]
        public int? DaysOverdue => IsOverdue && DueDate.HasValue ? (int)(DateTime.UtcNow - DueDate.Value).TotalDays : null;
        
        public Invoice(List<InvoiceItem> items)
        {
            InvoiceItems = items;
            CalculTotalAmount(); // Automatically calculate upon creation
        }
        public Invoice()
        {
            
        }
        public bool IsLocked { get; set; } = false;
        public string Status { get; set; } = "Pending"; // 'Pending', 'PartiallyPaid', 'Paid'
        
        // Token-based verification signature (Pro Invoice feature)
        public string? VerificationToken { get; set; }
        public DateTime? VerificationTokenCreatedAt { get; set; }

        public void CalculTotalAmount()
        {
            SubTotal = InvoiceItems.Sum(i => i.TotalItemHT);
            TaxAmount = InvoiceItems.Sum(i => i.ItemTaxAmount);
            TotalAmount = SubTotal + TaxAmount + Tfiscal;
        }
    }
    
    public class Payment
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? Notes { get; set; }
        public int InvoiceId { get; set; }
        public Invoice? Invoice { get; set; }
        public string? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Audit: Payment confirmation
        public string? ConfirmedByUserId { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        
        // Payment status: Completed, Pending (for future scheduled payments)
        public string Status { get; set; } = "Completed"; // Default is Completed, "Pending" for future scheduled
        
        // Computed: If PaymentDate is in future and status is Pending, it's a scheduled payment
        [NotMapped]
        public bool IsScheduled => Status == "Pending" && PaymentDate > DateTime.UtcNow;
    }

    public class InvoiceItem:IItem
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public int? Quantity { get; set; }
        public bool Tva { get; set; } // Persisted: determines if VAT applies
        
        /// <summary>
        /// Stored VAT rate override. When set, uses this rate instead of the default 19%.
        /// </summary>
        public decimal? VatRate { get; set; }
        
        [NotMapped]
        public decimal? TaxRate => Tva ? (VatRate ?? 0.19m) : 0m;
        public decimal? Price { get; set; }
        public int? InvoiceId { get; set; }
        public Invoice? Invoice { get; set; } = null!;
        [NotMapped]
        public decimal ItemTaxAmount => (Price ?? 0m) * (Quantity ?? 0) * (TaxRate ?? 0);
        [NotMapped]
        public decimal TotalItemHT => (Price ?? 0m) * (Quantity ?? 0);

    }

    public class DeliveryNote: Shared,IPdfDocumentData
    {
        public string Number { get; set; } = string.Empty; // e.g. DN-2023-001
        public DateTime Date { get; set; }
        
        public int? QuoteId { get; set; }
        public Quote? Quote { get; set; } = null!;

        // Currency & Language inherited from linked Quote (backward compat: falls back to company settings)
        [NotMapped]
        public string? EffectiveCurrency => Quote?.Currency;
        [NotMapped]
        public string? EffectiveCurrencySymbol => Quote?.CurrencySymbol;
        [NotMapped]
        public string? EffectivePdfLanguage => Quote?.PdfLanguage;
        public ICollection<DeliveryNoteItem> DeliveryNoteItems { get; set; } = new List<DeliveryNoteItem>();
        [NotMapped] // Tell EF Core NOT to try and map this to the database
        public List<IItem> Items 
        { 
            get => DeliveryNoteItems.Cast<IItem>().ToList(); 
            set => DeliveryNoteItems = value.Cast<DeliveryNoteItem>().ToList();
        }
        public int? ClientId { get; set; }
        public Client? Client { get; set; } = null!;
        public int? InvoiceId { get; set; }
        public Invoice? Invoice { get; set; } = null!;
        [NotMapped]
        public decimal? Tfiscal { get; set; } = null;
        [NotMapped]
        public string? TfiscalName { get; set; } = null; // Custom tax name for display
        [NotMapped]
        public decimal? SubTotal { get; set; } = null;

        [NotMapped]
        public decimal? TaxAmount { get; set; } = null;
        [NotMapped]
        public decimal? TotalAmount { get; set; } = null;



    }

    public class DeliveryNoteItem: IItem
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public int? Quantity { get; set; }
        public int TotalEstimated { get; set; }
        public int? DeliveryNoteId { get; set; }
        public DeliveryNote? DeliveryNote { get; set; } = null!;
        public decimal? Price { get; set ; } = null;
        public decimal? TaxRate { get; set; } = null;
        public decimal TotalItemHT { get;  } =0;
        public decimal ItemTaxAmount { get; set; } = 0;


    }
    public class Quote: Shared, IPdfDocumentData
    {
        public string Number { get; set; } = string.Empty; 
        public DateTime Date { get; set; }
        
        // Per-document currency & language (overrides company defaults)
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        public string? PdfLanguage { get; set; }
        
        public int? ClientId { get; set; }
        public Client? Client { get; set; } = null!;
        public Invoice? Invoice { get; set; } = null!;
        public ICollection<QuoteItem> QuoteItems { get; set; } = new List<QuoteItem>();
        public ICollection<DeliveryNote> DeliveryNotes { get; set; } = new List<DeliveryNote>();
        [NotMapped] // Tell EF Core NOT to try and map this to the database
        public List<IItem> Items
        {
            get => QuoteItems.Cast<IItem>().ToList();
            set => QuoteItems = value.Cast<QuoteItem>().ToList();
        }

        // Configurable tax - stored value from settings
        public decimal? Tfiscal { get; set; } = 1.000m;
        public string? TfiscalName { get; set; } = "Timbre Fiscal"; // Custom tax name for display
        public decimal? SubTotal { get; private set; }

        // Removed [NotMapped] - TaxAmount should be persisted to database like in Invoice
        public decimal? TaxAmount { get; private set; }
        public decimal? TotalAmount { get; private set; }
        public string Status { get; set; } = "Draft"; // 'Draft', 'Accepted', 'Rejected'
        public void CalculTotalAmount()
        {
            SubTotal = QuoteItems.Sum(i => i.TotalItemHT);
            TaxAmount = QuoteItems.Sum(i => i.ItemTaxAmount);
            TotalAmount = SubTotal + TaxAmount + Tfiscal;
        }
        public Quote()
        {
            
        }
        public Quote(List<QuoteItem> items)
        {
            QuoteItems = items;
            CalculTotalAmount(); // Automatically calculate upon creation
        }

    }

    public class QuoteItem:IItem
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public int? Quantity { get; set; }
        public bool Tva { get; set; }
        
        /// <summary>
        /// Stored VAT rate override. When set, uses this rate instead of the default 19%.
        /// </summary>
        public decimal? VatRate { get; set; }
        
        [NotMapped]
        public decimal? TaxRate => Tva ? (VatRate ?? 0.19m) : 0m;
        public decimal? Price { get; set; }
        public int? QuoteId { get; set; }
        public Quote? Quote { get; set; } = null!;
        public decimal ItemTaxAmount => (Price ?? 0m) * (Quantity ?? 0) * (TaxRate ?? 0);
        public decimal TotalItemHT => (Price ?? 0m) * (Quantity ?? 0);



    }
    public interface IPdfDocumentData
    {
        public string Number { get; } 
        public DateTime Date { get; set; }
        
        public Client? Client { get; }
        public List<IItem> Items { get; set; }

        public decimal? Tfiscal { get; } 
        public string? TfiscalName { get; } // Custom tax name for display
        public decimal? SubTotal { get;}
        public decimal? TaxAmount { get; }
        public decimal? TotalAmount { get;}

    }

    // Email tracking for sent invoices
    public class InvoiceEmail
    {
        public int Id { get; set; }
        public int InvoiceId { get; set; }
        public Invoice? Invoice { get; set; }
        public string RecipientEmail { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public string? CreatedByUserId { get; set; }
        public string Status { get; set; } = "Sent"; // Sent, Failed, Pending
        public string? ErrorMessage { get; set; }
    }

    // Company Settings for customization
    public class CompanySettings
    {
        public int Id { get; set; }
        public int CompanyId { get; set; }
        public Company? Company { get; set; }
        
        // Email settings
        public string? EmailTemplate { get; set; } // HTML template for invoice emails
        public string? EmailSubjectTemplate { get; set; } = "Invoice #@invoiceNumber from @companyName";
        public string? EmailSignature { get; set; } // User's email signature (can include HTML)
        
        // Default email body template with @ placeholders
        public string? DefaultEmailBody { get; set; } = @"<p>Dear @clientName,</p>
<p>Please find attached your invoice <strong>#@invoiceNumber</strong> dated @invoiceDate.</p>
<p><strong>Total Amount:</strong> @amount TND</p>
<p><strong>Due Date:</strong> @dueDate</p>
<p>Thank you for your business!</p>";
        
        // Branding
        public string? LogoUrl { get; set; } // URL to company logo (legacy, prefer Company.LogoData)
        public string? PrimaryColor { get; set; } = "#667eea"; // For PDF branding
        public string? SecondaryColor { get; set; } = "#764ba2";
        
        // Financial settings
        public string Currency { get; set; } = "TND"; // Default currency
        public string CurrencySymbol { get; set; } = "TND";
        public decimal DefaultVatRate { get; set; } = 0.19m; // 19% VAT
        
        /// <summary>
        /// JSON array of available VAT rates, e.g. "[0, 7, 13, 19]"
        /// Users can configure which rates appear in the dropdown
        /// </summary>
        public string AvailableVatRates { get; set; } = "[0, 7, 13, 19]";
        
        // Configurable tax (Timbre Fiscal / Stamp Duty / etc.)
        public bool CustomTaxEnabled { get; set; } = true; // Enable/disable the custom tax
        public string CustomTaxName { get; set; } = "Timbre Fiscal"; // Customizable name
        public decimal CustomTaxAmount { get; set; } = 1.000m; // Tax amount/value
        
        // PDF customization
        public string? PdfFooterText { get; set; }
        public bool ShowCompanyLogo { get; set; } = true;
        public string? PdfSignatureText { get; set; } // Custom signature text on PDF
        public string? PdfSignerPosition { get; set; } // Signer position/title on PDF (e.g. "Managing Director")
        public string InvoiceLanguage { get; set; } = "fr"; // "fr", "en", "de", "ar"
        
        // Signature / Cachet image
        public byte[]? SignatureImageData { get; set; }
        public string? SignatureImageContentType { get; set; }
        public bool ShowSignatureOnPdf { get; set; } = false;
        
        // Bank information for invoices
        public string? BankName { get; set; }
        public string? BankBIC { get; set; }
        public string? BankRIB { get; set; }
        public string? BankIBAN { get; set; }
        public bool ShowBankName { get; set; } = true;
        public bool ShowBankBIC { get; set; } = true;
        public bool ShowBankRIB { get; set; } = true;
        public bool ShowBankIBAN { get; set; } = true;
        
        // File-system language (set once, immutable after confirmation)
        public string? FileSystemLanguage { get; set; }
        public bool FileSystemLanguageLocked { get; set; } = false;
        
        // Gmail OAuth tokens (NO App Passwords - uses proper OAuth 2.0)
        public string? GmailAccessToken { get; set; }
        public string? GmailRefreshToken { get; set; }
        public DateTime? GmailTokenExpiry { get; set; }
        public string? GmailConnectedEmail { get; set; }
        public DateTime? GmailConnectedAt { get; set; }
        
        // Gmail API verification status - only true when Gmail API call succeeds
        public bool GmailApiVerified { get; set; } = false;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Local Storage Path & Profile Completion Guard
        public string? BaseStoragePath { get; set; } // e.g. "C:\ResourceManager\Invoices"
        public bool IsProfileComplete { get; set; } = false; // Forces manager to settings if false
        
        // Pro Invoice token signature
        public bool ProInvoiceUseTokenSignature { get; set; } = false;
    }

    /// <summary>
    /// Record of a PDF file stored locally with path tracking
    /// </summary>
    public class PdfFileRecord
    {
        public int Id { get; set; }
        
        // File information
        public string FileName { get; set; } = string.Empty;
        public string RelativePath { get; set; } = string.Empty; // Path relative to base folder
        public string FullPath { get; set; } = string.Empty; // Absolute path
        public long FileSizeBytes { get; set; }
        
        // Document information
        public PdfDocumentType DocumentType { get; set; }
        public string DocumentNumber { get; set; } = string.Empty;
        public DateTime DocumentDate { get; set; }
        
        // Related entity tracking
        public string RelatedEntityType { get; set; } = string.Empty; // "Invoice", "DeliveryNote", "Quote", "SupplierInvoice"
        public int RelatedEntityId { get; set; }
        
        // Client/Supplier names for folder organization
        public string? ClientName { get; set; }
        public string? SupplierName { get; set; }
        
        // Cloud backup URL (Supabase or other cloud storage)
        public string? CloudUrl { get; set; }
        
        // Company multi-tenancy
        [Required]
        public int CompanyId { get; set; }
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
        
        // Audit
        public string? CreatedByUserId { get; set; }
        [ForeignKey("CreatedByUserId")]
        public ApplicationUser? CreatedByUser { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
    }

    /// <summary>
    /// Type of PDF document for folder organization
    /// </summary>
    public enum PdfDocumentType
    {
        Invoice = 0,
        DeliveryNote = 1,
        Quote = 2,
        SupplierInvoice = 3
    }

    /// <summary>
    /// Other Expenses - operational costs not tied to supplier invoices
    /// </summary>
    public class OtherExpense : Shared
    {
        [Required]
        public string Description { get; set; } = string.Empty;
        
        [Required]
        public decimal Amount { get; set; }
        
        public DateTime Date { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Category: rent, utilities, office, travel, marketing, insurance, maintenance, subscription, salary, telecom, other
        /// </summary>
        [Required]
        public string Category { get; set; } = "other";
        
        public string? Notes { get; set; }
        
        /// <summary>
        /// Is this a recurring expense?
        /// </summary>
        public bool IsRecurring { get; set; } = false;

        /// <summary>
        /// Per-expense currency code (e.g., "TND", "EUR"). Nullable for backwards compatibility.
        /// Falls back to company settings when null.
        /// </summary>
        public string? Currency { get; set; }

        /// <summary>
        /// Per-expense currency symbol (e.g., "TND", "€"). Nullable for backwards compatibility.
        /// </summary>
        public string? CurrencySymbol { get; set; }
    }

    /// <summary>
    /// Saved products & services catalog for quick selection in quotes/invoices
    /// </summary>
    public class ProductService : Shared
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        
        public string? Description { get; set; }
        
        /// <summary>
        /// Default unit price
        /// </summary>
        public decimal DefaultUnitPrice { get; set; }
        // <summary>
        /// Default Tax Rate
        /// </summary>
        public decimal TvaRate { get; set; }
        /// <summary>
        /// Type: "product" or "service"
        /// </summary>
        public string Type { get; set; } = "product";
        
        /// <summary>
        /// Category for grouping (e.g. field of work)
        /// </summary>
        public string? Category { get; set; }
        
        /// <summary>
        /// Whether VAT applies to this item by default
        /// </summary>
        public bool VatApplicable { get; set; } = true;
    }

    // ═══════════════════════════════════════════════════════════════
    // REFRESH TOKEN (Secure token rotation for JWT auth)
    // ═══════════════════════════════════════════════════════════════
    public class RefreshToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        public string UserId { get; set; } = string.Empty;

        [ForeignKey("UserId")]
        public ApplicationUser? User { get; set; }

        /// <summary>
        /// Unique identifier for the token family — detects replay attacks.
        /// When a refresh token is rotated, the new token inherits the family.
        /// If a revoked token from the same family is reused, all tokens in the family are revoked.
        /// </summary>
        [Required]
        public string Family { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }

        /// <summary>
        /// The token that replaced this one (for audit trail)
        /// </summary>
        public string? ReplacedByToken { get; set; }

        /// <summary>
        /// Reason for revocation
        /// </summary>
        public string? RevokedReason { get; set; }

        [NotMapped]
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

        [NotMapped]
        public bool IsRevoked => RevokedAt != null;

        [NotMapped]
        public bool IsActive => !IsRevoked && !IsExpired;
    }

    // ═══════════════════════════════════════════════════════════════
    // USER LOGIN RECORD — Tracks login IP for country stats
    // ═══════════════════════════════════════════════════════════════

    public class UserLoginRecord
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [StringLength(45)] // IPv4 max 15, IPv6 max 45
        public string IpAddress { get; set; } = string.Empty;

        [StringLength(100)]
        public string? Country { get; set; }

        [StringLength(5)]
        public string? CountryCode { get; set; }

        public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    }

    // ═══════════════════════════════════════════════════════════════
    // HISTORICAL DATA — Imported previous revenues/expenses
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Historical revenue record imported by manager. Payment-based.
    /// </summary>
    public class HistoricalRevenue : Shared
    {
        [Required]
        public DateTime Date { get; set; }

        [Required]
        public string ClientName { get; set; } = string.Empty;

        [Required]
        public decimal AmountPaid { get; set; }

        [Required]
        [StringLength(10)]
        public string Currency { get; set; } = "TND";

        [StringLength(50)]
        public string? PaymentMethod { get; set; }

        [StringLength(100)]
        public string? InvoiceNumber { get; set; }

        /// <summary>Marks this record as imported historical data</summary>
        public bool IsHistorical { get; set; } = true;

        /// <summary>Linked Client (get-or-create during import)</summary>
        public int? ClientId { get; set; }

        [ForeignKey("ClientId")]
        public Client? Client { get; set; }

        public int? InvoiceId { get; set; }

        [ForeignKey("InvoiceId")]
        public Invoice? Invoice { get; set; }
    }

    /// <summary>
    /// Historical expense record imported by manager. Payment-based.
    /// </summary>
    public class HistoricalExpense : Shared
    {
        [Required]
        public DateTime Date { get; set; }

        [Required]
        public string SupplierName { get; set; } = string.Empty;

        [Required]
        public decimal AmountPaid { get; set; }

        [Required]
        [StringLength(10)]
        public string Currency { get; set; } = "TND";

        [StringLength(50)]
        public string? Category { get; set; }

        [StringLength(200)]
        public string? Reference { get; set; }

        /// <summary>Marks this record as imported historical data</summary>
        public bool IsHistorical { get; set; } = true;

        /// <summary>Linked Supplier (get-or-create during import)</summary>
        public int? SupplierId { get; set; }

        [ForeignKey("SupplierId")]
        public Supplier? Supplier { get; set; }
    }

    /// <summary>
    /// Pending supplier invoice uploaded by employees. PDF content is GZip-compressed.
    /// Manager syncs these to local disk via SyncToLocal endpoint.
    /// </summary>
    public class PendingInvoice : Shared
    {
        [Required]
        [StringLength(200)]
        public string SupplierName { get; set; } = string.Empty;

        [Required]
        public DateTime Date { get; set; }

        [Required]
        public decimal Amount { get; set; }

        [Required]
        [StringLength(255)]
        public string FileName { get; set; } = string.Empty;

        /// <summary>GZip-compressed PDF file content</summary>
        [Required]
        public byte[] Content { get; set; } = Array.Empty<byte>();

        /// <summary>Original uncompressed file size in bytes</summary>
        public long OriginalSize { get; set; }

        /// <summary>True once synced to Manager's local disk</summary>
        public bool IsProcessed { get; set; } = false;

        /// <summary>Optional: linked Supplier from supplier table</summary>
        public int? SupplierId { get; set; }

        [ForeignKey("SupplierId")]
        public Supplier? Supplier { get; set; }
    }
    
}
