namespace ResourceManager.Application.Common;

/// <summary>
/// Standard paginated response wrapper.
/// </summary>
public class PagedResult<T>
{
    public IReadOnlyList<T> Data { get; init; } = Array.Empty<T>();
    public int Page { get; init; }
    public int Size { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)Size);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
