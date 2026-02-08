using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResourceManager.Models
{
    public class ApplicationUser : IdentityUser
    {
        public int CompanyId { get; set; }
        [ForeignKey("CompanyId")]
        public  Company? Company { get; set; }

        public  UserProfile? Profile { get; set; }
        public string? CreatedByUserId { get; set; }

    }

    // The Separate Table (Application data focus)
    public class UserProfile
    {
        [Key]
        public int Id { get; set; } 
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? EmailContent { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty; // Foreign key to AspNetUsers
        [ForeignKey("UserId")]
        public  ApplicationUser? User { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; } = default;
        public DateTime? DeletedAt { get; set; } = default;
        public bool IsDeleted { get; set; } = false;
    }

    public class Company : IClient
    {
        [Key]
        public int Id { get; set; }

        [Required(ErrorMessage = "Le nom est obligatoire.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "L'adresse est obligatoire.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Le numéro d'identification fiscale est obligatoire.")]
        public string MatriculeFiscal { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        
        // Company Logo stored as bytes
        public byte[]? LogoData { get; set; }
        public string? LogoContentType { get; set; } // e.g., "image/png", "image/jpeg"
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; } = default;
        public DateTime? DeletedAt { get; set; } = default;
        public bool IsDeleted { get; set; } = false;
        public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
        public ICollection<Client> Clients { get; set; } = new List<Client>();
        public ICollection<Fournisseur> Fournisseurs { get; set; } = new List<Fournisseur>();

    }

}
