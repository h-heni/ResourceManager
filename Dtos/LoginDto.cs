using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public record LoginDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(128, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 128 characters.")]
        public string Password { get; set; } = string.Empty;
    }
}
