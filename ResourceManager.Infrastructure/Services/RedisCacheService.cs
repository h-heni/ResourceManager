using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using ResourceManager.Application.Interfaces;
using StackExchange.Redis;

namespace ResourceManager.Infrastructure.Services;

/// <summary>
/// Redis-based distributed cache implementation with pattern-based invalidation,
/// cache stampede protection, and graceful degradation.
/// </summary>
public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly CacheSettings _settings;
    
    // Lock dictionary to prevent cache stampede (thundering herd)
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();
    
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public RedisCacheService(
        IDistributedCache cache,
        IConnectionMultiplexer? redis,
        ILogger<RedisCacheService> logger,
        CacheSettings settings)
    {
        _cache = cache;
        _redis = redis;
        _logger = logger;
        _settings = settings;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var fullKey = GetFullKey(key);
            var data = await _cache.GetStringAsync(fullKey, cancellationToken);
            
            if (string.IsNullOrEmpty(data))
                return default;

            return JsonSerializer.Deserialize<T>(data, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache read failed for key {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(
        string key, 
        T value, 
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var fullKey = GetFullKey(key);
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = absoluteExpiration ?? _settings.DefaultAbsoluteExpiration,
                SlidingExpiration = slidingExpiration ?? _settings.DefaultSlidingExpiration
            };

            var data = JsonSerializer.Serialize(value, JsonOptions);
            await _cache.SetStringAsync(fullKey, data, options, cancellationToken);
            
            _logger.LogDebug("Cache set for key {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache write failed for key {Key}", key);
        }
    }

    public async Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default)
    {
        // Try to get from cache first (fast path)
        var cached = await GetAsync<T>(key, cancellationToken);
        if (cached is not null)
            return cached;

        // Acquire lock to prevent cache stampede
        var lockKey = GetFullKey(key);
        var semaphore = _locks.GetOrAdd(lockKey, _ => new SemaphoreSlim(1, 1));

        await semaphore.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring lock (another thread might have populated the cache)
            cached = await GetAsync<T>(key, cancellationToken);
            if (cached is not null)
                return cached;

            // Create the value using the factory
            var value = await factory(cancellationToken);
            
            if (value is not null)
            {
                await SetAsync(key, value, absoluteExpiration, slidingExpiration, cancellationToken);
            }
            
            return value;
        }
        finally
        {
            semaphore.Release();
            
            // Clean up locks dictionary if no one is waiting
            if (semaphore.CurrentCount == 1)
            {
                _locks.TryRemove(lockKey, out _);
            }
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var fullKey = GetFullKey(key);
            await _cache.RemoveAsync(fullKey, cancellationToken);
            _logger.LogDebug("Cache entry removed for key {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache remove failed for key {Key}", key);
        }
    }

    /// <summary>
    /// Removes all cache entries matching a pattern.
    /// Note: This implementation uses KEYS command which works on standalone Redis instances.
    /// For Redis Sentinel or Cluster configurations, consider using SCAN or a different approach.
    /// </summary>
    public async Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        try
        {
            if (_redis is null)
            {
                _logger.LogWarning("Pattern-based cache invalidation not supported without Redis connection multiplexer");
                return;
            }

            var fullPattern = GetFullKey(pattern);
            // Note: GetServers().FirstOrDefault() works for standalone Redis.
            // For Redis Cluster/Sentinel, you would need to iterate all servers.
            var server = _redis.GetServers().FirstOrDefault();
            if (server is null)
            {
                _logger.LogWarning("No Redis server found for pattern-based invalidation");
                return;
            }

            var db = _redis.GetDatabase();
            var keys = server.Keys(pattern: fullPattern).ToArray();
            
            if (keys.Length > 0)
            {
                await db.KeyDeleteAsync(keys);
                _logger.LogInformation("Removed {Count} cache entries matching pattern {Pattern}", keys.Length, pattern);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Pattern-based cache invalidation failed for pattern {Pattern}", pattern);
        }
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var fullKey = GetFullKey(key);
            var data = await _cache.GetAsync(fullKey, cancellationToken);
            return data is not null && data.Length > 0;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache exists check failed for key {Key}", key);
            return false;
        }
    }

    public async Task RefreshAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var fullKey = GetFullKey(key);
            await _cache.RefreshAsync(fullKey, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache refresh failed for key {Key}", key);
        }
    }

    private string GetFullKey(string key) => $"{_settings.InstanceName}{key}";
}

/// <summary>
/// Configuration settings for the Redis cache service.
/// </summary>
public class CacheSettings
{
    public string ConnectionString { get; set; } = "localhost:6379";
    public string InstanceName { get; set; } = "ResourceManager_";
    public int DefaultExpirationMinutes { get; set; } = 30;
    public int SlidingExpirationMinutes { get; set; } = 10;

    public TimeSpan DefaultAbsoluteExpiration => TimeSpan.FromMinutes(DefaultExpirationMinutes);
    public TimeSpan DefaultSlidingExpiration => TimeSpan.FromMinutes(SlidingExpirationMinutes);
}
