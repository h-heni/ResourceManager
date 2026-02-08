namespace ResourceManager.Dtos
{
    public class CreateProductServiceDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal DefaultUnitPrice { get; set; }
        public string Type { get; set; } = "product"; // "product" or "service"
        public string? Category { get; set; }
        public bool VatApplicable { get; set; } = true;
    }

    public class UpdateProductServiceDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal DefaultUnitPrice { get; set; }
        public string Type { get; set; } = "product";
        public string? Category { get; set; }
        public bool VatApplicable { get; set; } = true;
    }
}
