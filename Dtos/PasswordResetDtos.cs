using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    /// <summary>
    /// Request to initiate password reset (forgot password)
    /// </summary>
    public class ForgotPasswordRequestDto
    {
        /// <summary>
        /// Email address of the account to reset
        /// </summary>
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string Email { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request to complete password reset with token
    /// </summary>
    public class ResetPasswordRequestDto
    {
        /// <summary>
        /// Email address of the account
        /// </summary>
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string Email { get; set; } = string.Empty;

        /// <summary>
        /// Reset token received via email
        /// </summary>
        [Required(ErrorMessage = "Reset token is required")]
        public string Token { get; set; } = string.Empty;

        /// <summary>
        /// New password
        /// </summary>
        [Required(ErrorMessage = "New password is required")]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
        public string NewPassword { get; set; } = string.Empty;

        /// <summary>
        /// Confirm new password
        /// </summary>
        [Required(ErrorMessage = "Password confirmation is required")]
        [Compare("NewPassword", ErrorMessage = "Passwords do not match")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response after initiating password reset
    /// </summary>
    public class ForgotPasswordResponseDto
    {
        /// <summary>
        /// Success message (always generic for security)
        /// </summary>
        public string Message { get; set; } = "If an account with that email exists, you will receive a password reset link shortly.";
        
        /// <summary>
        /// Email sent status (for internal logging only, not exposed to user)
        /// </summary>
        public bool EmailSent { get; set; }
    }

    /// <summary>
    /// Response after completing password reset
    /// </summary>
    public class ResetPasswordResponseDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
