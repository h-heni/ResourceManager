# Redis Distributed Caching Guide

This guide covers the Redis distributed caching implementation for ResourceManager SaaS, including configuration, patterns, best practices, and production tips.

## Table of Contents

1. [Docker Redis Configuration](#docker-redis-configuration)
2. [.NET Configuration](#net-configuration)
3. [Caching Patterns](#caching-patterns)
4. [Distributed Cache Best Practices](#distributed-cache-best-practices)
5. [Memory Limits](#memory-limits)
6. [Cache Invalidation Strategy](#cache-invalidation-strategy)
7. [Production Monitoring](#production-monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Docker Redis Configuration

### Production Configuration (docker-compose.yml)

```yaml
redis:
  image: redis:7-alpine
  container_name: resourcemanager-redis
  command: >
    redis-server
    --maxmemory ${REDIS_MAXMEMORY:-256mb}
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --requirepass ${REDIS_PASSWORD}
  volumes:
    - redis_data:/data
  networks:
    - rm-internal
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 5s
```

### Development Configuration (docker-compose.dev.yml)

```yaml
redis_dev:
  image: redis:7-alpine
  container_name: resourcemanager-redis-dev
  command: >
    redis-server
    --maxmemory 128mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis_data_dev:/data
  networks:
    - rm-dev
```

### Key Configuration Options

| Option | Description | Recommended Value |
|--------|-------------|-------------------|
| `maxmemory` | Maximum memory allocation | 256mb - 1gb based on workload |
| `maxmemory-policy` | Eviction policy when memory is full | `allkeys-lru` (evict least recently used) |
| `appendonly` | Enable AOF persistence | `yes` for durability |
| `requirepass` | Authentication password | Strong password in production |

### Environment Variables (.env)

```bash
# Redis Configuration
REDIS_PASSWORD=your_strong_password_here
REDIS_MAXMEMORY=256mb
```

---

## .NET Configuration

### appsettings.json

```json
{
  "Redis": {
    "ConnectionString": "localhost:6379,abortConnect=false",
    "InstanceName": "ResourceManager_",
    "DefaultExpirationMinutes": 30,
    "SlidingExpirationMinutes": 10
  }
}
```

### appsettings.Production.json

```json
{
  "Redis": {
    "ConnectionString": "OVERRIDE_VIA_ENVIRONMENT_VARIABLE",
    "InstanceName": "ResourceManager_",
    "DefaultExpirationMinutes": 60,
    "SlidingExpirationMinutes": 15
  }
}
```

### Environment Variable Override

```bash
Redis__ConnectionString=redis:6379,password=your_password,abortConnect=false
```

> **Security Note**: In production, never store passwords in plain text environment files.
> Consider using secure secret management solutions:
> - Docker Secrets for Docker Swarm
> - Azure Key Vault for Azure deployments
> - AWS Secrets Manager for AWS deployments
> - HashiCorp Vault for multi-cloud environments

### Service Registration (Program.cs)

```csharp
// Distributed Cache (Redis with in-memory fallback)
builder.Services.AddRedisCache(builder.Configuration);
```

---

## Caching Patterns

### 1. Cache-Aside Pattern (Read-Through)

The most common pattern for caching database queries:

```csharp
public async Task<DashboardData> GetDashboardAsync(string companyId)
{
    var cacheKey = CacheKeys.Dashboard(companyId);
    
    return await _cache.GetOrCreateAsync(
        cacheKey,
        async ct => await LoadDashboardFromDb(companyId, ct),
        absoluteExpiration: TimeSpan.FromMinutes(5)
    );
}
```

### 2. Cache Keys Convention

Use the `CacheKeys` helper class for consistent key naming:

```csharp
public static class CacheKeys
{
    public const string UserPrefix = "user:";
    public const string CompanyPrefix = "company:";
    public const string InvoicePrefix = "invoice:";
    public const string ClientPrefix = "client:";
    public const string DashboardPrefix = "dashboard:";
    public const string GeoLocationPrefix = "geo:";
    public const string SessionPrefix = "session:";

    public static string User(string userId) => $"{UserPrefix}{userId}";
    public static string Company(string companyId) => $"{CompanyPrefix}{companyId}";
    public static string Invoice(int invoiceId) => $"{InvoicePrefix}{invoiceId}";
    public static string Dashboard(string companyId, string section = "overview") 
        => $"{DashboardPrefix}{companyId}:{section}";
}
```

### 3. Conditional Caching

Only cache successful results:

```csharp
public async Task<User?> GetUserAsync(string userId)
{
    var cached = await _cache.GetAsync<User>(CacheKeys.User(userId));
    if (cached != null) return cached;
    
    var user = await _db.Users.FindAsync(userId);
    
    // Only cache if user exists
    if (user != null)
    {
        await _cache.SetAsync(CacheKeys.User(userId), user, 
            absoluteExpiration: TimeSpan.FromHours(1));
    }
    
    return user;
}
```

### 4. Geolocation Caching

Cache external API results with longer TTL:

```csharp
public async Task<GeoLocationResult> ResolveCountryAsync(string ipAddress)
{
    var cacheKey = CacheKeys.GeoLocation(ipAddress);
    
    return await _cache.GetOrCreateAsync(
        cacheKey,
        async _ => await _geoApi.LookupAsync(ipAddress),
        absoluteExpiration: TimeSpan.FromHours(24)  // Long TTL for IP geolocation
    );
}
```

---

## Distributed Cache Best Practices

### 1. Use Appropriate TTLs

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Static reference data | 24 hours | Rarely changes |
| Dashboard summaries | 5-15 minutes | Needs freshness |
| User sessions | Sliding 30 min | Activity-based |
| API rate limits | 1 minute | Short-lived |
| Geolocation data | 24 hours | IP locations don't change |

### 2. Prevent Cache Stampede

Use locks to prevent multiple concurrent requests from hitting the database:

```csharp
public async Task<T?> GetOrCreateAsync<T>(
    string key,
    Func<CancellationToken, Task<T>> factory)
{
    // Fast path: check cache
    var cached = await GetAsync<T>(key);
    if (cached != null) return cached;

    // Acquire lock to prevent stampede
    var semaphore = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
    await semaphore.WaitAsync();
    try
    {
        // Double-check after acquiring lock
        cached = await GetAsync<T>(key);
        if (cached != null) return cached;

        // Create value
        var value = await factory(CancellationToken.None);
        await SetAsync(key, value);
        return value;
    }
    finally
    {
        semaphore.Release();
    }
}
```

### 3. Graceful Degradation

Always handle Redis connection failures:

```csharp
public async Task<T?> GetAsync<T>(string key)
{
    try
    {
        var data = await _cache.GetStringAsync(key);
        return data != null ? JsonSerializer.Deserialize<T>(data) : default;
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Cache read failed for key {Key}", key);
        return default;  // Return null, let caller fall back to database
    }
}
```

### 4. Use Sliding Expiration Wisely

Sliding expiration extends TTL on access—good for sessions, bad for frequently-accessed data:

```csharp
// Good: Session data (extend while user is active)
await _cache.SetAsync(
    CacheKeys.Session(userId), 
    sessionData,
    slidingExpiration: TimeSpan.FromMinutes(30)
);

// Bad: Dashboard data (could stay cached forever with sliding)
// Use absolute expiration instead
await _cache.SetAsync(
    CacheKeys.Dashboard(companyId), 
    dashboardData,
    absoluteExpiration: TimeSpan.FromMinutes(5)
);
```

### 5. Namespace Your Keys

Always prefix keys with instance name to avoid collisions in shared Redis:

```csharp
// Instance prefix is automatically added by the service
// Key: "ResourceManager_user:123"
```

---

## Memory Limits

### Eviction Policies

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `allkeys-lru` | Evict least recently used keys | General caching |
| `volatile-lru` | Evict LRU keys with TTL set | Mix of persistent and cached data |
| `allkeys-lfu` | Evict least frequently used | Hot-spot optimization |
| `noeviction` | Return error when full | Critical data that must not be evicted |

### Recommended Memory Settings

| Environment | Memory | Notes |
|-------------|--------|-------|
| Development | 128 MB | Sufficient for local testing |
| Staging | 256 MB | Match production patterns |
| Production | 256 MB - 1 GB | Scale based on data volume |

### Monitoring Memory Usage

```bash
# Connect to Redis CLI
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD

# Check memory usage
INFO memory

# List all keys and sizes
DEBUG OBJECT <key>

# Get key count
DBSIZE
```

---

## Cache Invalidation Strategy

### 1. Time-Based Invalidation (TTL)

The simplest and most reliable approach:

```csharp
// Data automatically expires after TTL
await _cache.SetAsync(
    key, 
    value, 
    absoluteExpiration: TimeSpan.FromMinutes(30)
);
```

### 2. Event-Based Invalidation

Invalidate on data changes:

```csharp
public async Task UpdateInvoiceAsync(Invoice invoice)
{
    await _db.SaveChangesAsync();
    
    // Invalidate specific cache entry
    await _cache.RemoveAsync(CacheKeys.Invoice(invoice.Id));
    
    // Invalidate related dashboard cache
    await _cache.RemoveAsync(CacheKeys.Dashboard(invoice.CompanyId));
}
```

### 3. Pattern-Based Invalidation

Remove multiple related keys at once:

```csharp
// When a company's data changes significantly
await _cache.RemoveByPatternAsync($"dashboard:{companyId}:*");

// When user is deleted
await _cache.RemoveByPatternAsync($"user:{userId}*");
```

### 4. Cache Versioning

For complex invalidation scenarios:

```csharp
public string GetCacheKey(string entity, string id)
{
    var version = await GetCacheVersionAsync(entity);
    return $"{entity}:{id}:v{version}";
}

public async Task InvalidateEntityCacheAsync(string entity)
{
    await IncrementCacheVersionAsync(entity);
    // Old versioned keys will naturally expire
}
```

---

## Production Monitoring

### Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Memory usage | > 80% maxmemory | Increase memory or review TTLs |
| Hit rate | < 80% | Review caching strategy |
| Connected clients | > 80% max | Scale or check for leaks |
| Evicted keys | High rate | Increase memory |
| Latency | > 10ms average | Check network/load |

### Redis CLI Commands

```bash
# Real-time monitoring
redis-cli -a $REDIS_PASSWORD MONITOR

# Get statistics
redis-cli -a $REDIS_PASSWORD INFO stats

# Memory analysis
redis-cli -a $REDIS_PASSWORD MEMORY STATS

# Find large keys
redis-cli -a $REDIS_PASSWORD --bigkeys

# Latency monitoring
redis-cli -a $REDIS_PASSWORD --latency
```

### Health Check Endpoint

The application includes Redis health check in `/health`:

```csharp
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                duration = e.Value.Duration.TotalMilliseconds
            })
        });
    }
});
```

### Logging Cache Operations

Enable debug logging for cache operations:

```json
{
  "Logging": {
    "LogLevel": {
      "ResourceManager.Infrastructure.Services.RedisCacheService": "Debug"
    }
  }
}
```

### Prometheus Metrics (Optional)

For advanced monitoring, consider adding StackExchange.Redis metrics:

```csharp
// Add to Program.cs
services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var conn = ConnectionMultiplexer.Connect(connectionString);
    
    // Export metrics
    conn.GetCounters(); // Returns ConnectionCounters
    
    return conn;
});
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```
Error: RedisConnectionException: It was not possible to connect to the redis server(s)
```

**Solutions:**
- Check if Redis container is running: `docker ps | grep redis`
- Verify connection string in appsettings
- Check firewall/network settings
- Ensure password is correct

#### 2. Authentication Failed

```
Error: NOAUTH Authentication required
```

**Solutions:**
- Verify REDIS_PASSWORD environment variable
- Check connection string includes password: `redis:6379,password=xxx`

#### 3. Out of Memory

```
Error: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
- Increase `maxmemory` setting
- Review TTLs (set shorter expirations)
- Check eviction policy is set (should be `allkeys-lru`)
- Remove unnecessary cached data

#### 4. Serialization Errors

```
Error: JsonException: The JSON value could not be converted
```

**Solutions:**
- Ensure cached types are serializable
- Use DTOs instead of anonymous types
- Check for circular references

### Debug Commands

```bash
# Check Redis is responding
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD PING

# List all keys with prefix
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD KEYS "ResourceManager_*"

# Get specific key value
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD GET "ResourceManager_user:123"

# Check key TTL
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD TTL "ResourceManager_user:123"

# Clear all keys (DANGER - development only)
docker exec -it resourcemanager-redis redis-cli -a $REDIS_PASSWORD FLUSHALL
```

---

## Quick Reference

### Starting Development Environment

```bash
# Start Redis and PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Run API locally
dotnet run

# Run frontend
cd ClientApp && npm run dev
```

### Cache Service Interface

```csharp
public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan? absoluteExp = null, TimeSpan? slidingExp = null, CancellationToken ct = default);
    Task<T?> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan? absoluteExp = null, TimeSpan? slidingExp = null, CancellationToken ct = default);
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task RemoveByPatternAsync(string pattern, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
    Task RefreshAsync(string key, CancellationToken ct = default);
}
```

### Example Usage

```csharp
// Inject the cache service
private readonly ICacheService _cache;

// Simple get/set
var user = await _cache.GetAsync<User>(CacheKeys.User(userId));
await _cache.SetAsync(CacheKeys.User(userId), user, TimeSpan.FromHours(1));

// Get or create (recommended)
var dashboard = await _cache.GetOrCreateAsync(
    CacheKeys.Dashboard(companyId),
    async ct => await LoadDashboardFromDb(companyId, ct),
    absoluteExpiration: TimeSpan.FromMinutes(5)
);

// Invalidation
await _cache.RemoveAsync(CacheKeys.Invoice(invoiceId));
await _cache.RemoveByPatternAsync($"{CacheKeys.DashboardPrefix}{companyId}:*");
```
