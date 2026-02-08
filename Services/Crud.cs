using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Services
{
    public class Crud
    {
        private readonly AppDbContext _context;
        private readonly ClientCache _clientCache;

        public Crud(AppDbContext context, ClientCache clientCache)
        {
            _context = context;
            _clientCache = clientCache;
        }

        // Client-specific methods (recommended for most Razor Page scenarios)
        public async Task<bool> ClientExistsAsync(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            return await _context.Clients.AnyAsync(c => c.Name == name);
        }

        public async Task<bool> DeleteClientByNameAsync(string name)
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Name == name);
            if (client == null) return false;
            client.IsDeleted = true;
            client.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _clientCache.Remove(name);

            return true;
        }

        // Generic finder example: accepts a DbSet<T> and an expression selecting the name-like property.
        // Use when you need a generic method across different entity types that expose a string property.
        public async Task<T?> DynamicFindAsync<T>(DbSet<T> dbSet, Expression<Func<T, string>> nameSelector, string name)
    where T : class
        {
            if (dbSet == null || nameSelector == null || string.IsNullOrWhiteSpace(name)) return null;

            // Build: e => (nameSelector(e) == name) as an Expression<Func<T,bool>> so EF can translate to SQL.
            var parameter = nameSelector.Parameters[0];
            var equals = Expression.Equal(nameSelector.Body, Expression.Constant(name, typeof(string)));
            var lambda = Expression.Lambda<Func<T, bool>>(equals, parameter);

            return await dbSet.FirstOrDefaultAsync(lambda);
        }
        public async Task<Client> UpdateClientNameAsync (string name)
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Name == name);
            if (client == null) throw new InvalidOperationException("Client not found");
            client.Name = name;
            client.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return client;
        }
        public async Task<Client> UpdateClientAdressAsync (string adress)
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Address == adress);
            if (client == null) throw new InvalidOperationException("Client not found");
            client.Address = adress;
            client.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return client;
        }
        public async Task<Client> UpdateClientMatriculeAsync (string matricule)
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.MatriculeFiscal == matricule);
            if (client == null) throw new InvalidOperationException("Client not found");
            client.MatriculeFiscal = matricule;
            client.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return client;
        }
        public async Task<Client> UpdateClientPhoneAsync (string phone)
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Phone == phone);
            if (client == null) throw new InvalidOperationException("Client not found");
            client.Phone = phone;
            client.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return client;
        }
    }
}