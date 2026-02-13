using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResourceManager.Models
{
    public class ManagerInvitation
    {
        [Key]
        public Guid Id { get; set; }

        [Required(ErrorMessage = "L'email est obligatoire.")]
        [StringLength(256)]
        [EmailAddress(ErrorMessage = "Le format de l'email est invalide.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Le token est obligatoire.")]
        public string Token { get; set; } = string.Empty;

        public DateTime ExpirationDate { get; set; }

        public bool IsUsed { get; set; } = false;

        public DateTime CreatedAt { get; set; }

        [ForeignKey("CreatedByUser")]
        public string? CreatedByUserId { get; set; }

        public ApplicationUser? CreatedByUser { get; set; }
    }
}
