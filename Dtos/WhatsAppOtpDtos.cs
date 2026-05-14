using System.ComponentModel.DataAnnotations;

namespace ResourceManager.Dtos
{
    public class SendWhatsAppOtpDto
    {
        [Required]
        [Phone]
        [StringLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;
    }

    public class VerifyWhatsAppOtpDto
    {
        [Required]
        [Phone]
        [StringLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be exactly 6 digits.")]
        [RegularExpression(@"^\d{6}$", ErrorMessage = "OTP must be exactly 6 digits.")]
        public string Otp { get; set; } = string.Empty;
    }
}
