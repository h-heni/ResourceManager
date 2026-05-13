using System.Security.Cryptography;
using System.Text;

namespace ResourceManager.Services
{
    public interface IPdfTokenService
    {
        /// <summary>Returns a short-lived HMAC-signed token for anonymous PDF access (e.g., WhatsApp delivery).</summary>
        string GenerateToken(int docId);
        /// <summary>Returns true if the token is valid for the given document ID and has not expired.</summary>
        bool ValidateToken(int docId, string token);
    }

    public class PdfTokenService : IPdfTokenService
    {
        private readonly byte[] _key;
        private const int LifetimeMinutes = 30;

        public PdfTokenService(IConfiguration config)
        {
            var raw = config["Jwt:Key"] ?? "fallback-key-change-me-in-production";
            var bytes = Encoding.UTF8.GetBytes(raw);
            // HMACSHA256 accepts any key length; pad/trim to 32 bytes for consistency
            _key = bytes.Length >= 32 ? bytes[..32] : bytes.Concat(new byte[32 - bytes.Length]).ToArray();
        }

        public string GenerateToken(int docId)
        {
            var expiry = DateTimeOffset.UtcNow.AddMinutes(LifetimeMinutes).ToUnixTimeSeconds();
            var sig = Sign(docId, expiry);
            return $"{expiry}-{sig}";
        }

        public bool ValidateToken(int docId, string token)
        {
            try
            {
                var dash = token.IndexOf('-');
                if (dash < 0) return false;

                if (!long.TryParse(token[..dash], out var expiry)) return false;
                if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiry) return false;

                var expected = Sign(docId, expiry);
                return CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(expected),
                    Encoding.UTF8.GetBytes(token[(dash + 1)..]));
            }
            catch { return false; }
        }

        private string Sign(int docId, long expiry)
        {
            var payload = Encoding.UTF8.GetBytes($"{docId}:{expiry}");
            using var hmac = new HMACSHA256(_key);
            return Convert.ToBase64String(hmac.ComputeHash(payload))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }
    }
}
