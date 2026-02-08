using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResourceManager.Application.Interfaces;
using ResourceManager.Domain.Interfaces;
using ResourceManager.Infrastructure.Repositories;
using ResourceManager.Infrastructure.Services;

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
}
