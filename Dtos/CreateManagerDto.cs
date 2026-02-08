using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public record CreateManagerDto
    {
        [Required(ErrorMessage = "Le nom du Soc. est obligatoire.")]
        public string CompanyName { get; set; } = string.Empty;
        [Required(ErrorMessage = "L'adresse est obligatoire.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Le num�ro d'identification fiscale est obligatoire.")]
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;

        // 2. Admin/Manager Info
        public string UserEmail { get; set; } = string.Empty;
        public string UserPassword { get; set; } = string.Empty;
        public string UserFirstName { get; set; } = string.Empty;
        public string UserLastName { get; set; } = string.Empty;
    }
}
