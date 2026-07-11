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
        private readonly ILogger<ClientsController> _logger;
        
        public ClientsController(AppDbContext context, TimeProvider time, ILogger<ClientsController> logger)
        {
            _context = context;
            _time = time;
            _logger = logger;
        }

        // GET: api/clients
        [HttpGet]
        public async Task<ActionResult> GetClients([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;
                if (size > 100) size = 100;

                var query = _context.Clients.AsNoTracking().OrderByDescending(c => c.CreatedAt);
                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var clients = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .ToListAsync();

                return Ok(new { Data = clients, Page = page, Size = size, TotalCount = totalCount, TotalPages = totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching clients");
                return Ok(new { Data = Array.Empty<Client>(), Page = page, Size = size, TotalCount = 0, TotalPages = 0 });
            }
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
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var client = new Client
        {
            Name = clientDto.CompanyName,
            TaxId = clientDto.TaxId,
            Address = clientDto.Address,
            Phone = clientDto.Phone,
            Email = clientDto.Email
        };
        _context.Clients.Add(client);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating client");
            return StatusCode(500, new { message = "Failed to create client. Please try again." });
        }

        return CreatedAtAction(nameof(GetClientById), new { id = client.Id }, client);
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
        clientDb.TaxId=client.TaxId;
        clientDb.Phone=client.Phone;
        clientDb.Email=client.Email;

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
