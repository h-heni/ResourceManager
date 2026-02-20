using System.ComponentModel.DataAnnotations;
namespace ResourceManager.Dtos
{
    public class ClientDto
    {
        [Required(ErrorMessage = "Name is required.")]
        public string CompanyName { get; set; } = string.Empty;
        [Required(ErrorMessage = "Address is required.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Tax identification number is required.")]
        public string TaxId { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
    }
}
