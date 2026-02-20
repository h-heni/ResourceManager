using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResourceManager.Models
{
    public class ManagerInvitation
    {
        [Key]
        public Guid Id { get; set; }

        [Required(ErrorMessage = "Email is required.")]
        [StringLength(256)]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Token is required.")]
        public string Token { get; set; } = string.Empty;

        public DateTime ExpirationDate { get; set; }

        public bool IsUsed { get; set; } = false;

        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Max employees this tenant is allowed (0 = unlimited).
        /// SuperAdmin sets this when sending the invitation.
        /// </summary>
        public int EmployeeCapacity { get; set; } = 0;

        /// <summary>
        /// Preferred UI language for the invited manager (en, fr, ar, de).
        /// Applied when the invitation link is opened.
        /// </summary>
        [StringLength(5)]
        public string PreferredLanguage { get; set; } = "fr";

        [ForeignKey("CreatedByUser")]
        public string? CreatedByUserId { get; set; }

        public ApplicationUser? CreatedByUser { get; set; }
    }
}
