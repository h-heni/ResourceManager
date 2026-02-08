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
        public  DateTime CreatedAt { get; set; }
        public  DateTime? UpdatedAt { get; set; }= default;
        public  DateTime? DeletedAt { get; set; }= default;
        public bool Treated { get; set; } = false;
        public bool IsDeleted { get; set; } = false;


    }
    public class Fournisseur : Shared
    {
        [Required(ErrorMessage = "Le nom est obligatoire.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "L'adresse est obligatoire.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Le numéro d'identification fiscale est obligatoire.")]
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public ICollection<FournisseurInvoice> FournisseurInvoices { get; set; } = new List<FournisseurInvoice>();
    }
    public class FournisseurInvoice
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
        
        public int? FournisseurId { get; set; }
        public Fournisseur? Fournisseur { get; set; } = null!;
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
        public ICollection<FournisseurInvoiceItem> Items { get; set; } = new List<FournisseurInvoiceItem>();
        
        // Payment tracking
        public ICollection<SupplierPayment> Payments { get; set; } = new List<SupplierPayment>();
        
        [NotMapped]
        public decimal AmountPaid => Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal PendingAmount => Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal RemainingAmount => (TotalTTC ?? 0) - AmountPaid;
        [NotMapped]
        public string PaymentStatus => AmountPaid >= (TotalTTC ?? 0) && (TotalTTC ?? 0) > 0 ? "Paid"
            : AmountPaid > 0 ? "PartiallyPaid"
            : PendingAmount > 0 ? "Pending"
            : "Unpaid";
    }
    
    public class SupplierPayment
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? Notes { get; set; }
        public int FournisseurInvoiceId { get; set; }
        public FournisseurInvoice? FournisseurInvoice { get; set; }
        public string? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "Completed"; // Completed, Pending
        [NotMapped]
        public bool IsScheduled => Status == "Pending" && PaymentDate > DateTime.UtcNow;
    }
    
    public class FournisseurInvoiceItem
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
        
        public int FournisseurInvoiceId { get; set; }
        public FournisseurInvoice? FournisseurInvoice { get; set; }
    }
    public class Client : Shared, IClient
    {
        [Required(ErrorMessage ="Le nom est obligatoire.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "L'adresse est obligatoire.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Le numéro d'identification fiscale est obligatoire.")]
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public ICollection<Devis> Devis { get; set; } = new List<Devis>();
        public ICollection<DeliveryNote> DeliveryNotes { get; set; } = new List<DeliveryNote>();
    }

    public class Invoice: Shared, IPdfDocumentData
    {
        [Required(ErrorMessage = "Saisissez le numéro de facture")]
        public string Number { get; set; } = string.Empty; // e.g. INV-2023-001
        public DateTime Date { get; set; }
        public DateTime? DueDate { get; set; } // Payment due date - nullable for backwards compatibility
        public int? ClientId { get; set; }
        [ForeignKey("ClientId")]
        public virtual Client? Client { get; set; }
        public int? DevisId { get; set; }
        public Devis? Devis { get; set; } = null!;
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
        
        // Payment tracking - Only count completed payments for actual paid amount
        [NotMapped]
        public decimal AmountPaid => Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal PendingAmount => Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0;
        [NotMapped]
        public decimal RemainingAmount => (TotalAmount ?? 0) - AmountPaid;
        
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
        public string Status { get; set; } = "Unpaid"; // 'Paid', 'Unpaid', 'PartiallyPaid', 'Draft'

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
        public int? DevisId { get; set; }
        public Devis? Devis { get; set; } = null!;
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
    public class Devis: Shared, IPdfDocumentData
    {
        public string Number { get; set; } = string.Empty; 
        public DateTime Date { get; set; }
        public int? ClientId { get; set; }
        public Client? Client { get; set; } = null!;
        public Invoice? Invoice { get; set; } = null!;
        public ICollection<DevisItem> DevisItems { get; set; } = new List<DevisItem>();
        public ICollection<DeliveryNote> DeliveryNotes { get; set; } = new List<DeliveryNote>();
        [NotMapped] // Tell EF Core NOT to try and map this to the database
        public List<IItem> Items
        {
            get => DevisItems.Cast<IItem>().ToList();
            set => DevisItems = value.Cast<DevisItem>().ToList();
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
            SubTotal = DevisItems.Sum(i => i.TotalItemHT);
            TaxAmount = DevisItems.Sum(i => i.ItemTaxAmount);
            TotalAmount = SubTotal + TaxAmount + Tfiscal;
        }
        public Devis()
        {
            
        }
        public Devis(List<DevisItem> items)
        {
            DevisItems = items;
            CalculTotalAmount(); // Automatically calculate upon creation
        }

    }

    public class DevisItem:IItem
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
        public int? DevisId { get; set; }
        public Devis? Devis { get; set; } = null!;
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
        
        // PDF Storage configuration
        public string? PdfBaseFolderPath { get; set; } // User-selected base folder for PDFs
        
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
        public string RelatedEntityType { get; set; } = string.Empty; // "Invoice", "DeliveryNote", "Devis", "FournisseurInvoice"
        public int RelatedEntityId { get; set; }
        
        // Client/Fournisseur names for folder organization
        public string? ClientName { get; set; }
        public string? FournisseurName { get; set; }
        
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
        FournisseurInvoice = 3
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
    
}