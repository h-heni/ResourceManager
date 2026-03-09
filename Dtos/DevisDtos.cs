using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateQuoteDto
    {
        [MaxLength(50)]
        public string Number { get; set; } = string.Empty;
        
        [Required]
        public DateTime Date { get; set; }
        
        [Required]
        public int ClientId { get; set; }
        
        // Per-document currency & language (overrides company defaults)
        [MaxLength(10)]
        public string? Currency { get; set; }
        [MaxLength(5)]
        public string? CurrencySymbol { get; set; }
        [MaxLength(10)]
        public string? PdfLanguage { get; set; }
        
        [Required]
        [MinLength(1, ErrorMessage = "At least one item is required.")]
        public List<CreateQuoteItemDto> Items { get; set; } = new List<CreateQuoteItemDto>();
    }

    public class CreateQuoteItemDto
    {
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; }

        [Range(0, 999999999)]
        public decimal Price { get; set; }
        public bool Tva { get; set; }
        public decimal? VatRate { get; set; } // Rate as decimal, e.g. 0.19
        /// <summary>
        /// Optional link to catalog product for inventory tracking
        /// </summary>
        public int? ProductServiceId { get; set; }
    }

    public class UpdateQuoteDto : CreateQuoteDto { }
}
