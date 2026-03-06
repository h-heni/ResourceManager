using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public class CreateProductServiceDto
    {
        [Required(ErrorMessage = "Name is required.")]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }

        [Range(0, 999999999.99)]
        public decimal DefaultUnitPrice { get; set; }

        [Range(0, 100)]
        public decimal TvaRate { get; set; }

        [Required]
        [RegularExpression("^(product|service)$", ErrorMessage = "Type must be 'product' or 'service'.")]
        public string Type { get; set; } = "product";

        [StringLength(100)]
        public string? Category { get; set; }

        public bool VatApplicable { get; set; } = true;
        public bool IsStockTracked { get; set; } = false;

        [Range(0, 999999999)]
        public decimal? ReorderPoint { get; set; }
    }

    public class UpdateProductServiceDto
    {
        [Required(ErrorMessage = "Name is required.")]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }

        [Range(0, 999999999.99)]
        public decimal DefaultUnitPrice { get; set; }

        [Range(0, 100)]
        public decimal TvaRate { get; set; }

        [Required]
        [RegularExpression("^(product|service)$", ErrorMessage = "Type must be 'product' or 'service'.")]
        public string Type { get; set; } = "product";

        [StringLength(100)]
        public string? Category { get; set; }

        public bool VatApplicable { get; set; } = true;
        public bool IsStockTracked { get; set; } = false;

        [Range(0, 999999999)]
        public decimal? ReorderPoint { get; set; }
    }
}
