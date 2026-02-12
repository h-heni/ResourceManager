namespace ResourceManager.Application.Interfaces;

/// <summary>
/// Abstraction for distributed caching operations.
/// Supports both in-memory and Redis cache implementations.
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Gets a cached value by key.
    /// </summary>
    /// <typeparam name="T">Type of the cached value</typeparam>
    /// <param name="key">Cache key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Cached value or default if not found</returns>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets a value in the cache with optional expiration settings.
    /// </summary>
    /// <typeparam name="T">Type of the value to cache</typeparam>
    /// <param name="key">Cache key</param>
    /// <param name="value">Value to cache</param>
    /// <param name="absoluteExpiration">Optional absolute expiration time</param>
    /// <param name="slidingExpiration">Optional sliding expiration time</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task SetAsync<T>(
        string key, 
        T value, 
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a value from cache or creates it using the factory function.
    /// Thread-safe implementation prevents cache stampede.
    /// </summary>
    /// <typeparam name="T">Type of the cached value</typeparam>
    /// <param name="key">Cache key</param>
    /// <param name="factory">Factory function to create the value if not in cache</param>
    /// <param name="absoluteExpiration">Optional absolute expiration time</param>
    /// <param name="slidingExpiration">Optional sliding expiration time</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Cached or newly created value</returns>
    Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a specific key from the cache.
    /// </summary>
    /// <param name="key">Cache key to remove</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes all cache entries matching a pattern.
    /// Pattern supports * wildcard (e.g., "user:*" removes all user-related cache entries).
    /// </summary>
    /// <param name="pattern">Pattern with optional wildcards</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a key exists in the cache.
    /// </summary>
    /// <param name="key">Cache key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if key exists</returns>
    Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Refreshes the sliding expiration of a cache entry.
    /// </summary>
    /// <param name="key">Cache key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task RefreshAsync(string key, CancellationToken cancellationToken = default);
}

/// <summary>
/// Common cache key prefixes for consistent key naming across the application.
/// </summary>
public static class CacheKeys
{
    public const string UserPrefix = "user:";
    public const string CompanyPrefix = "company:";
    public const string InvoicePrefix = "invoice:";
    public const string ClientPrefix = "client:";
    public const string DashboardPrefix = "dashboard:";
    public const string GeoLocationPrefix = "geo:";
    public const string SessionPrefix = "session:";

    /// <summary>
    /// Generates a user-specific cache key.
    /// </summary>
    public static string User(string userId) => $"{UserPrefix}{userId}";

    /// <summary>
    /// Generates a company-specific cache key.
    /// </summary>
    public static string Company(string companyId) => $"{CompanyPrefix}{companyId}";

    /// <summary>
    /// Generates an invoice cache key.
    /// </summary>
    public static string Invoice(int invoiceId) => $"{InvoicePrefix}{invoiceId}";

    /// <summary>
    /// Generates a client cache key.
    /// </summary>
    public static string Client(int clientId) => $"{ClientPrefix}{clientId}";

    /// <summary>
    /// Generates a dashboard data cache key for a specific company.
    /// </summary>
    public static string Dashboard(string companyId, string section = "overview") 
        => $"{DashboardPrefix}{companyId}:{section}";

    /// <summary>
    /// Generates a geolocation cache key for an IP address.
    /// </summary>
    public static string GeoLocation(string ipAddress) => $"{GeoLocationPrefix}{ipAddress}";

    /// <summary>
    /// Generates a user session cache key.
    /// </summary>
    public static string Session(string userId) => $"{SessionPrefix}{userId}";
}
