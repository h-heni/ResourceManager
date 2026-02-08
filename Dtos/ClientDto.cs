using System.ComponentModel.DataAnnotations;
namespace ResourceManager.Dtos
{
    public class ClientDto
    {
        [Required(ErrorMessage = "Le nom est obligatoire.")]
        public string CompanyName { get; set; } = string.Empty;
        [Required(ErrorMessage = "L'adresse est obligatoire.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Le numéro d'identification fiscale est obligatoire.")]
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }
}
