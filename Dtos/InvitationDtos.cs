using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public record InviteManagerDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(256)]
        public string Email { get; set; } = string.Empty;
    }

    public record CompleteInvitationDto
    {
        [Required(ErrorMessage = "Token is required.")]
        public string Token { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(128, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 128 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "First name is required.")]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Last name is required.")]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Phone]
        public string Phone { get; set; } = string.Empty;

        // Company data
        [Required(ErrorMessage = "Company name is required.")]
        public string CompanyName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Company address is required.")]
        public string CompanyAddress { get; set; } = string.Empty;

        public string CompanyCity { get; set; } = string.Empty;

        public string TaxNumber { get; set; } = string.Empty;

        // Defaults
        public string DefaultCurrency { get; set; } = "TND";
        public string DefaultLanguage { get; set; } = "fr";
    }
}
