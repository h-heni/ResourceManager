using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateDevisDto
    {
        [Required]
        public string Number { get; set; } = string.Empty;
        
        [Required]
        public DateTime Date { get; set; }
        
        public int? ClientId { get; set; }
        
        // Per-document currency & language (overrides company defaults)
        public string? Currency { get; set; }
        public string? CurrencySymbol { get; set; }
        public string? PdfLanguage { get; set; }
        
        public List<CreateDevisItemDto> Items { get; set; } = new List<CreateDevisItemDto>();
    }

    public class CreateDevisItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public bool Tva { get; set; }
        public decimal? VatRate { get; set; } // Rate as decimal, e.g. 0.19
    }

    public class UpdateDevisDto : CreateDevisDto { }
}
