using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateInvoiceDto
    {
        public string Number { get; set; } = string.Empty;
        
        [Required]
        public DateTime Date { get; set; }
        
        public DateTime? DueDate { get; set; } // Payment due date
        
        public int? ClientId { get; set; }
        
        public int? DevisId { get; set; } // Optional: link to a quote
        public List<int>? DeliveryNoteIds { get; set; } // Link Delivery Notes
        
        public List<CreateInvoiceItemDto> Items { get; set; } = new List<CreateInvoiceItemDto>();
    }

    public class CreateInvoiceItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public bool Tva { get; set; }
        /// <summary>
        /// VAT rate as percentage (e.g. 19, 7, 0). Converted to decimal on the backend.
        /// </summary>
        public decimal? VatRate { get; set; }
    }

    public class UpdateInvoiceDto
    {
        public string Number { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public DateTime? DueDate { get; set; } // Payment due date
        public int? ClientId { get; set; }
        
        public List<CreateInvoiceItemDto> Items { get; set; } = new();
    }

    public class AddPaymentDto
    {
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }
        
        public DateTime? PaymentDate { get; set; } // If null, defaults to now (Completed)
        
        public string? Notes { get; set; }
        
        // Status: "Completed" for immediate payments, "Pending" for scheduled future payments
        public string Status { get; set; } = "Completed";
    }
}
