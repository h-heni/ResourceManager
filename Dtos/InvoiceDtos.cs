using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateInvoiceDto
    {
        [MaxLength(50)]
        public string Number { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Category { get; set; }
        
        [Required]
        public DateTime Date { get; set; }
        
        public DateTime? DueDate { get; set; } // Payment due date
        
        [Required]
        public int ClientId { get; set; }
        
        public List<int>? QuoteIds { get; set; } // Optional: link to one or more quotes
        public List<int>? DeliveryNoteIds { get; set; } // Link Delivery Notes
        
        [Required]
        [MinLength(1, ErrorMessage = "At least one item is required.")]
        public List<CreateInvoiceItemDto> Items { get; set; } = new List<CreateInvoiceItemDto>();
    }

    public class CreateInvoiceItemDto
    {
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; }

        [Range(0, 999999999)]
        public decimal Price { get; set; }
        public bool Tva { get; set; }
        /// <summary>
        /// VAT rate as percentage (e.g. 19, 7, 0). Converted to decimal on the backend.
        /// </summary>
        public decimal? VatRate { get; set; }
        /// <summary>
        /// Optional link to catalog product for inventory tracking
        /// </summary>
        public int? ProductServiceId { get; set; }
    }

    public class UpdateInvoiceDto
    {
        [MaxLength(50)]
        public string Number { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Category { get; set; }
        public DateTime Date { get; set; }
        public DateTime? DueDate { get; set; } // Payment due date

        [Required]
        public int ClientId { get; set; }
        
        [Required]
        [MinLength(1, ErrorMessage = "At least one item is required.")]
        public List<CreateInvoiceItemDto> Items { get; set; } = new();
    }

    public class AddPaymentDto
    {
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }
        
        public DateTime? PaymentDate { get; set; } // If null, defaults to now (Completed)
        
        [MaxLength(500)]
        public string? Notes { get; set; }
        
        // Status: "Completed" for immediate payments, "Pending" for scheduled future payments
        [MaxLength(20)]
        public string Status { get; set; } = "Completed";
    }
}
