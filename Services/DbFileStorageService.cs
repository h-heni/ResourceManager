using System.IO.Compression;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Services
{
    public interface IDbFileStorageService
    {
        /// <summary>
        /// GZip-compresses <paramref name="rawData"/> and persists it to the
        /// <see cref="SupplierInvoiceFileData"/> table, linked to the given invoice.
        /// </summary>
        Task SaveAsync(int supplierInvoiceId, byte[] rawData, string mimeType);

        /// <summary>
        /// Loads and decompresses the file for the given invoice.
        /// Returns null when no DB record exists (fallback to disk).
        /// </summary>
        Task<(byte[] Data, string MimeType)?> GetAsync(int supplierInvoiceId);

        /// <summary>Returns true when a DB blob exists for the given invoice.</summary>
        Task<bool> ExistsAsync(int supplierInvoiceId);
    }

    public class DbFileStorageService : IDbFileStorageService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<DbFileStorageService> _logger;

        public DbFileStorageService(AppDbContext context, ILogger<DbFileStorageService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task SaveAsync(int supplierInvoiceId, byte[] rawData, string mimeType)
        {
            // Compress in memory — GZip is fast and PDF/image data compresses well
            byte[] compressed;
            using (var outputStream = new MemoryStream())
            {
                using (var gzip = new GZipStream(outputStream, CompressionLevel.Optimal, leaveOpen: true))
                {
                    await gzip.WriteAsync(rawData);
                }
                compressed = outputStream.ToArray();
            }

            var record = new SupplierInvoiceFileData
            {
                SupplierInvoiceId = supplierInvoiceId,
                CompressedData = compressed,
                OriginalSize = rawData.LongLength,
                CompressedSize = compressed.LongLength,
                CompressionType = "GZip",
                MimeType = mimeType,
                CreatedAt = DateTime.UtcNow
            };

            _context.SupplierInvoiceFileData.Add(record);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "File stored for SupplierInvoice {Id}: {OriginalKb} KB → {CompressedKb} KB ({Ratio:P0} compression)",
                supplierInvoiceId,
                rawData.Length / 1024,
                compressed.Length / 1024,
                1.0 - (double)compressed.Length / rawData.Length);
        }

        public async Task<(byte[] Data, string MimeType)?> GetAsync(int supplierInvoiceId)
        {
            var record = await _context.SupplierInvoiceFileData
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.SupplierInvoiceId == supplierInvoiceId);

            if (record == null) return null;

            // Decompress on the fly — never stores raw bytes in the DB
            using var inputStream = new MemoryStream(record.CompressedData);
            using var outputStream = new MemoryStream();
            using (var gzip = new GZipStream(inputStream, CompressionMode.Decompress))
            {
                await gzip.CopyToAsync(outputStream);
            }

            return (outputStream.ToArray(), record.MimeType);
        }

        public async Task<bool> ExistsAsync(int supplierInvoiceId)
        {
            return await _context.SupplierInvoiceFileData
                .AsNoTracking()
                .AnyAsync(f => f.SupplierInvoiceId == supplierInvoiceId);
        }
    }
}
