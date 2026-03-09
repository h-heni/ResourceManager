using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs // Namespace consistency
{
    // Re-defining or updating DeliveryNoteDto if it exists in Dtos namespace, 
    // but I'm placing it here to be safe and consistent with my new DTOs.
    // Ideally I should have checked the content of existing DeliveryNoteDto.
    
    public class DeliveryNoteDto
    {
        [MaxLength(50)]
        public string? Number { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;

        [Required]
        public int ClientId { get; set; }
        public int? QuoteId { get; set; } // Link to Quote
        public int? InvoiceId { get; set; } // For linking
        
        [Required]
        [MinLength(1, ErrorMessage = "At least one item is required.")]
        public List<DeliveryNoteItemDto> DeliveryNoteItems { get; set; } = new List<DeliveryNoteItemDto>();
    }

    public class DeliveryNoteItemDto
    {
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; }
        /// <summary>
        /// Optional link to catalog product for inventory tracking
        /// </summary>
        public int? ProductServiceId { get; set; }
    }
}
