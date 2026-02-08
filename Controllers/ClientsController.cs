using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using ResourceManager.Dtos;

namespace ResourceManager.Controllers
{
    public class ClientsController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        public ClientsController(AppDbContext context, TimeProvider time)
        {
            _context = context;
            _time = time;
        }

        // GET: api/clients
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Client>>> GetClients()
        {
            return await _context.Clients.OrderByDescending(c => c.CreatedAt).ToListAsync();
        }

    // GET: api/clients/5
    [HttpGet("CompanyName")]
    public async Task<ActionResult<Client>> GetClientByName(string CompanyName)
    {
        var client = await _context.Clients.FirstOrDefaultAsync(c=>c.Name==CompanyName);

        if (client == null)
        {
            return NotFound();
        }

        return Ok(client);
    }
    // GET: api/clients/5
    [HttpGet("{id}")]
    public async Task<ActionResult<Client>> GetClientById(int Id)
    {
        var client = await _context.Clients.FindAsync(Id);

        if (client == null)
        {
            return NotFound();
        }
            
        return Ok(client);
    }

    // POST: api/clients
    [HttpPost]
    public async Task<ActionResult<Client>> CreateClient(ClientDto clientDto)
    {
        var client = new Client
        {
            Name = clientDto.CompanyName,
            MatriculeFiscal = clientDto.MatriculeFiscal,
            Address = clientDto.Address,
            Phone = clientDto.Phone
        };
        _context.Clients.Add(client);
        await _context.SaveChangesAsync();

        return Accepted(client);
    }

    // PUT: api/clients/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateClient(int id,ClientDto client)
    {
        var clientDb = await _context.Clients.FindAsync(id);
        if (clientDb is null)
        {
            return NotFound("No client was found");
        }
        clientDb.Name=client.CompanyName;
        clientDb.Address=client.Address;
        clientDb.MatriculeFiscal=client.MatriculeFiscal;
        clientDb.Phone=client.Phone;

        clientDb.UpdatedAt = _time.GetUtcNow().DateTime;
            
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!ClientExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }
        // DELETE: api/clients/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteClient(int id)
        {
            var client = await _context.Clients.FindAsync(id);
            if (client == null)
            {
                return NotFound();
            }
            // Soft Delete preferred
            client.IsDeleted = true;
            client.DeletedAt = _time.GetUtcNow().DateTime;
            
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ClientExists(int id)
        {
            return _context.Clients.Any(e => e.Id == id);
        }
    }
}
