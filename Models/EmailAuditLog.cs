using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Models
{
    /// <summary>
    /// Generic email audit log for tracking all system emails (password resets, notifications, etc.)
    /// For invoice-specific emails, see InvoiceEmail entity.
    /// </summary>
    public class EmailAuditLog
    {
        public int Id { get; set; }
        
        /// <summary>
        /// Type of email: PasswordReset, Notification, Invitation, etc.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string EmailType { get; set; } = string.Empty;
        
        /// <summary>
        /// Recipient email address
        /// </summary>
        [Required]
        [MaxLength(256)]
        public string RecipientEmail { get; set; } = string.Empty;
        
        /// <summary>
        /// Email subject line
        /// </summary>
        [MaxLength(500)]
        public string Subject { get; set; } = string.Empty;
        
        /// <summary>
        /// When the email was sent
        /// </summary>
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Status: Pending, Sent, Failed, Bounced
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";
        
        /// <summary>
        /// Error message if sending failed
        /// </summary>
        public string? ErrorMessage { get; set; }
        
        /// <summary>
        /// User ID who triggered the email (null for system-generated)
        /// </summary>
        public string? TriggeredByUserId { get; set; }
        
        /// <summary>
        /// Name of the user who triggered the email (for display)
        /// </summary>
        [MaxLength(200)]
        public string? TriggeredByName { get; set; }
        
        /// <summary>
        /// IP address of the requester (for password reset auditing)
        /// </summary>
        [MaxLength(45)]
        public string? IpAddress { get; set; }
        
        /// <summary>
        /// Company ID if applicable (for multi-tenant tracking)
        /// </summary>
        public int? CompanyId { get; set; }
        
        /// <summary>
        /// Additional metadata as JSON (e.g., token ID, invoice ID reference)
        /// </summary>
        public string? Metadata { get; set; }
        
        /// <summary>
        /// Number of retry attempts
        /// </summary>
        public int RetryCount { get; set; } = 0;
    }

    /// <summary>
    /// Password reset token for forgot password functionality
    /// </summary>
    public class PasswordResetToken
    {
        public int Id { get; set; }
        
        /// <summary>
        /// User ID this token belongs to
        /// </summary>
        [Required]
        public string UserId { get; set; } = string.Empty;
        
        /// <summary>
        /// The secure token (hashed, not stored in plain text)
        /// </summary>
        [Required]
        [MaxLength(256)]
        public string TokenHash { get; set; } = string.Empty;
        
        /// <summary>
        /// When the token was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// When the token expires (typically 1 hour)
        /// </summary>
        public DateTime ExpiresAt { get; set; }
        
        /// <summary>
        /// Whether the token has been used
        /// </summary>
        public bool IsUsed { get; set; } = false;
        
        /// <summary>
        /// When the token was used (null if not used)
        /// </summary>
        public DateTime? UsedAt { get; set; }
        
        /// <summary>
        /// IP address of the requester
        /// </summary>
        [MaxLength(45)]
        public string? RequestIpAddress { get; set; }
        
        /// <summary>
        /// IP address when token was used
        /// </summary>
        [MaxLength(45)]
        public string? UsedIpAddress { get; set; }
        
        /// <summary>
        /// Navigation property to user
        /// </summary>
        public ApplicationUser? User { get; set; }
    }
}
