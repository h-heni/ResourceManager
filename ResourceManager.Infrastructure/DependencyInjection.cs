using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ResourceManager.Application.Interfaces;
using ResourceManager.Domain.Interfaces;
using ResourceManager.Infrastructure.Repositories;
using ResourceManager.Infrastructure.Services;
using StackExchange.Redis;

namespace ResourceManager.Infrastructure;

/// <summary>
/// Dependency injection configuration for Infrastructure layer.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure<TContext>(this IServiceCollection services) 
        where TContext : DbContext
    {
        // Register DbContext as the base type so repositories can use it
        services.AddScoped<DbContext>(sp => sp.GetRequiredService<TContext>());
        
        // Repositories
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        
        // Services
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        
        return services;
    }

    /// <summary>
    /// Adds Redis distributed caching to the service collection.
    /// Falls back to in-memory cache if Redis is unavailable.
    /// </summary>
    public static IServiceCollection AddRedisCache(this IServiceCollection services, IConfiguration configuration)
    {
        var redisConfig = configuration.GetSection("Redis");
        var connectionString = redisConfig["ConnectionString"] ?? "localhost:6379";
        var instanceName = redisConfig["InstanceName"] ?? "ResourceManager_";

        var cacheSettings = new CacheSettings
        {
            ConnectionString = connectionString,
            InstanceName = instanceName,
            DefaultExpirationMinutes = redisConfig.GetValue<int>("DefaultExpirationMinutes", 30),
            SlidingExpirationMinutes = redisConfig.GetValue<int>("SlidingExpirationMinutes", 10)
        };

        services.AddSingleton(cacheSettings);

        // Try to connect to Redis, fall back to in-memory if unavailable
        IConnectionMultiplexer? redisConnection = null;
        try
        {
            var options = ConfigurationOptions.Parse(connectionString);
            options.AbortOnConnectFail = false;
            options.ConnectTimeout = 5000;
            options.SyncTimeout = 5000;
            
            redisConnection = ConnectionMultiplexer.Connect(options);
            
            if (redisConnection.IsConnected)
            {
                // Register Redis distributed cache
                services.AddStackExchangeRedisCache(opt =>
                {
                    opt.Configuration = connectionString;
                    opt.InstanceName = instanceName;
                });
                
                services.AddSingleton(redisConnection);
                
                // Log successful Redis connection
                using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
                var logger = loggerFactory.CreateLogger("RedisCache");
                logger.LogInformation("Redis cache connected successfully to {ConnectionString}", 
                    connectionString.Split(',')[0]); // Log host only, not password
            }
            else
            {
                // Fall back to in-memory cache when Redis is not connected
                services.AddDistributedMemoryCache();
                // Register null multiplexer - RedisCacheService handles this gracefully
                services.AddSingleton<IConnectionMultiplexer>(sp => null!);
                
                using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
                var logger = loggerFactory.CreateLogger("RedisCache");
                logger.LogWarning("Redis connection not established, falling back to in-memory cache");
            }
        }
        catch (Exception ex)
        {
            // Fall back to in-memory cache on connection failure
            services.AddDistributedMemoryCache();
            // Register null multiplexer - RedisCacheService handles this gracefully
            services.AddSingleton<IConnectionMultiplexer>(sp => null!);
            
            // Log the connection failure for troubleshooting
            using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
            var logger = loggerFactory.CreateLogger("RedisCache");
            logger.LogWarning(ex, "Failed to connect to Redis at {ConnectionString}, falling back to in-memory cache", 
                connectionString.Split(',')[0]); // Log host only, not password
        }

        // Register cache service
        services.AddSingleton<ICacheService, RedisCacheService>();

        return services;
    }
}

