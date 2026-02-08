namespace ResourceManager.Application.Interfaces;

/// <summary>
/// File storage service interface (Supabase, Google Drive, etc.)
/// </summary>
public interface IStorageService
{
    Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, string? folder = null, CancellationToken cancellationToken = default);
    Task<Stream?> DownloadAsync(string filePath, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string filePath, CancellationToken cancellationToken = default);
    Task<string> GetPublicUrlAsync(string filePath, CancellationToken cancellationToken = default);
}
