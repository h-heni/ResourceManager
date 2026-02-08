using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    public class CreateFournisseurDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        
        [Required]
        public string Address { get; set; } = string.Empty;
        
        [Required]
        public string MatriculeFiscal { get; set; } = string.Empty;
        
        public string Phone { get; set; } = string.Empty;
    }
    
    public class UpdateFournisseurDto : CreateFournisseurDto { }
}
