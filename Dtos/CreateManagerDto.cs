using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public record CreateManagerDto
    {
        [Required(ErrorMessage = "Company name is required.")]
        public string CompanyName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }

        // 2. Admin/Manager Info
        [Required(ErrorMessage = "User email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(256)]
        public string UserEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(128, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 128 characters.")]
        public string UserPassword { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string UserFirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string UserLastName { get; set; } = string.Empty;

        // 3. Defaults for CompanySettings
        public string DefaultCurrency { get; set; } = "TND";
        public string DefaultLanguage { get; set; } = "fr";

        // 4. Employee limit (0 = unlimited)
        public int EmployeeLimit { get; set; } = 0;
    }
}
