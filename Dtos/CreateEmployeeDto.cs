using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public record CreateEmployeeDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(256)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(128, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 128 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "First name is required.")]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Last name is required.")]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        /// <summary>
        /// Optional: SuperAdmin must specify which company the employee belongs to.
        /// Managers/FreeUsers leave this null — the employee joins their own company.
        /// </summary>
        public int? CompanyId { get; set; }
    }
}
