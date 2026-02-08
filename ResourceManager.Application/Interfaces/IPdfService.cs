using ResourceManager.Domain.Interfaces;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// PDF generation service interface.
/// </summary>
public interface IPdfService
{
    byte[] GeneratePdf<T>(T document) where T : class, IPdfDocumentData;
    Task<byte[]> GeneratePdfAsync<T>(T document, CancellationToken cancellationToken = default) where T : class, IPdfDocumentData;
}
