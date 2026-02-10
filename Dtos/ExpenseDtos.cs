using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public class CreateExpenseDto
    {
        [Required(ErrorMessage = "Description is required.")]
        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [Range(0.01, 999999999.99, ErrorMessage = "Amount must be greater than 0.")]
        public decimal Amount { get; set; }

        public DateTime? Date { get; set; }

        [StringLength(50)]
        public string Category { get; set; } = "other";

        [StringLength(1000)]
        public string? Notes { get; set; }

        public bool IsRecurring { get; set; } = false;

        [StringLength(10)]
        public string? Currency { get; set; }

        [StringLength(5)]
        public string? CurrencySymbol { get; set; }
    }

    public class UpdateExpenseDto
    {
        [Required(ErrorMessage = "Description is required.")]
        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [Range(0.01, 999999999.99, ErrorMessage = "Amount must be greater than 0.")]
        public decimal Amount { get; set; }

        public DateTime? Date { get; set; }

        [StringLength(50)]
        public string Category { get; set; } = "other";

        [StringLength(1000)]
        public string? Notes { get; set; }

        public bool IsRecurring { get; set; } = false;

        [StringLength(10)]
        public string? Currency { get; set; }

        [StringLength(5)]
        public string? CurrencySymbol { get; set; }
    }
}
