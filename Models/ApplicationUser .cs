using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResourceManager.Models
{
    /// <summary>
    /// Account status for a company/tenant.
    /// </summary>
    public enum AccountStatus
    {
        Active = 0,
        Suspended = 1,
        Expired = 2
    }

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

        [Required(ErrorMessage = "Company name is required.")]
        public string Name { get; set; } = string.Empty;
        [Required(ErrorMessage = "Address is required.")]
        public string Address { get; set; } = string.Empty;
        [Required(ErrorMessage = "Tax identification number is required.")]
        public string TaxId { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        
        // Company Logo stored as bytes
        public byte[]? LogoData { get; set; }
        public string? LogoContentType { get; set; } // e.g., "image/png", "image/jpeg"
        
        // Employee limit — 0 means unlimited
        public int EmployeeLimit { get; set; } = 0;

        // ── Subscription & Lockout ──
        /// <summary>
        /// When the subscription expires. Null = no expiry (unlimited).
        /// </summary>
        public DateTime? SubscriptionExpiryDate { get; set; }

        /// <summary>
        /// Current account status: Active, Suspended, Expired.
        /// </summary>
        public AccountStatus AccountStatus { get; set; } = AccountStatus.Active;
        
        // Audit trail
        public DateTime CreatedAt { get; set; }
        public string? CreatedBy { get; set; } // User ID who created the company
        public DateTime? UpdatedAt { get; set; } = default;
        public string? ModifiedBy { get; set; } // User ID who last modified
        
        public DateTime? DeletedAt { get; set; } = default;
        public bool IsDeleted { get; set; } = false;
        public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
        public ICollection<Client> Clients { get; set; } = new List<Client>();
        public ICollection<Supplier> Suppliers { get; set; } = new List<Supplier>();

        [NotMapped]
        public List<string> PaymentMethods { get; set; } = new();

    }

}
