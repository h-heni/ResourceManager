using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateSupplierDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        
        [Required]
        public string Address { get; set; } = string.Empty;
        
        [Required]
        public string TaxId { get; set; } = string.Empty;
        
        public string Phone { get; set; } = string.Empty;
    }
    
    public class UpdateSupplierDto : CreateSupplierDto { }
}
