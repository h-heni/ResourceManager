using ResourceManager.Application.Common;

namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Client service interface for business operations.
/// </summary>
public interface IClientService
{
    Task<Result<ClientDto>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResult<ClientDto>> GetPagedAsync(int page, int size, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<ClientDto>>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Result<ClientDto>> CreateAsync(CreateClientRequest request, CancellationToken cancellationToken = default);
    Task<Result<ClientDto>> UpdateAsync(int id, UpdateClientRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(string name, CancellationToken cancellationToken = default);
}

public record ClientDto(
    int Id,
    string Name,
    string Address,
    string MatriculeFiscal,
    string Phone,
    DateTime CreatedAt
);

public record CreateClientRequest(
    string Name,
    string Address,
    string MatriculeFiscal,
    string Phone
);

public record UpdateClientRequest(
    string? Name,
    string? Address,
    string? MatriculeFiscal,
    string? Phone
);
