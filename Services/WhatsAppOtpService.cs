using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using System.Security.Cryptography;
using System.Text;

namespace ResourceManager.Services
{
    public interface IWhatsAppOtpService
    {
        Task<bool> SendOtpAsync(string phoneNumber);
        Task<string?> VerifyOtpAsync(string phoneNumber, string otp);
    }

    public class WhatsAppOtpService : IWhatsAppOtpService
    {
        private const int OtpExpiryMinutes = 10;
        private const int MaxAttempts = 3;

        private readonly AppDbContext _context;
        private readonly IWhatsAppService _whatsApp;
        private readonly ILogger<WhatsAppOtpService> _logger;

        public WhatsAppOtpService(AppDbContext context, IWhatsAppService whatsApp, ILogger<WhatsAppOtpService> logger)
        {
            _context = context;
            _whatsApp = whatsApp;
            _logger = logger;
        }

        public async Task<bool> SendOtpAsync(string phoneNumber)
        {
            string normalized;
            try { normalized = _whatsApp.NormalizePhone(phoneNumber); }
            catch { return false; }

            var user = await _context.Users
                .IgnoreQueryFilters()
                .Where(u => u.PhoneNumber == normalized && !u.LockoutEnabled)
                .Select(u => new { u.Id, u.CompanyId })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                _logger.LogInformation("WhatsApp OTP requested for unregistered phone {Phone}", normalized);
                return false;
            }

            // Invalidate existing pending OTPs for this phone
            var pending = await _context.WhatsAppOtps
                .Where(o => o.PhoneNumber == normalized && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();
            foreach (var p in pending) p.IsUsed = true;

            // Generate 6-digit OTP
            var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var now = DateTime.UtcNow;
            _context.WhatsAppOtps.Add(new WhatsAppOtp
            {
                PhoneNumber = normalized,
                OtpHash = HashOtp(otp),
                UserId = user.Id,
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(OtpExpiryMinutes),
                IsUsed = false,
                AttemptCount = 0
            });
            await _context.SaveChangesAsync();

            // Get company settings for this company (bypassing tenant filter — no auth context yet)
            var cs = await _context.CompanySettings
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(s => s.CompanyId == user.CompanyId)
                .FirstOrDefaultAsync();

            try
            {
                var result = await _whatsApp.SendOtpTemplateAsync(normalized, otp, cs);
                if (!result.Success)
                    _logger.LogWarning("WhatsApp OTP send failed for phone {Phone}: {Error}", normalized, result.Error);
                return result.Success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WhatsApp OTP send threw for phone {Phone}", normalized);
                return false;
            }
        }

        public async Task<string?> VerifyOtpAsync(string phoneNumber, string otp)
        {
            string normalized;
            try { normalized = _whatsApp.NormalizePhone(phoneNumber); }
            catch { return null; }

            var record = await _context.WhatsAppOtps
                .Where(o => o.PhoneNumber == normalized
                         && !o.IsUsed
                         && o.ExpiresAt > DateTime.UtcNow
                         && o.AttemptCount < MaxAttempts)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

            if (record == null) return null;

            if (record.OtpHash != HashOtp(otp))
            {
                record.AttemptCount++;
                await _context.SaveChangesAsync();
                return null;
            }

            record.IsUsed = true;
            await _context.SaveChangesAsync();
            return record.UserId;
        }

        private static string HashOtp(string otp)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(otp));
            return Convert.ToBase64String(bytes);
        }
    }
}
