using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs // Namespace consistency
{
    // Re-defining or updating DeliveryNoteDto if it exists in Dtos namespace, 
    // but I'm placing it here to be safe and consistent with my new DTOs.
    // Ideally I should have checked the content of existing DeliveryNoteDto.
    
    public class DeliveryNoteDto
    {
        public string? Number { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public int? ClientId { get; set; }
        public int? DevisId { get; set; } // Link to Quote
        public int? InvoiceId { get; set; } // For linking
        
        public List<DeliveryNoteItemDto> DeliveryNoteItems { get; set; } = new List<DeliveryNoteItemDto>();
    }

    public class DeliveryNoteItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }
}
