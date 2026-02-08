using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Dtos;

namespace ResourceManager.Controllers
{
    public class ProductServicesController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly ILogger<ProductServicesController> _logger;

        public ProductServicesController(AppDbContext context, TimeProvider time, ILogger<ProductServicesController> logger)
        {
            _context = context;
            _time = time;
            _logger = logger;
        }

        // GET: api/productservices
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            var items = await _context.ProductServices
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.DefaultUnitPrice,
                    p.Type,
                    p.Category,
                    p.VatApplicable,
                    p.CreatedAt
                })
                .ToListAsync();

            return Ok(items);
        }

        // GET: api/productservices/5
        [HttpGet("{id}")]
        public async Task<ActionResult> GetById(int id)
        {
            var item = await _context.ProductServices.FindAsync(id);
            if (item == null) return NotFound();

            return Ok(new
            {
                item.Id,
                item.Name,
                item.Description,
                item.DefaultUnitPrice,
                item.Type,
                item.Category,
                item.VatApplicable,
                item.CreatedAt
            });
        }

        // GET: api/productservices/search?q=term
        [HttpGet("search")]
        public async Task<ActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(Array.Empty<object>());

            var results = await _context.ProductServices
                .Where(p => p.Name.Contains(q) || (p.Description != null && p.Description.Contains(q)))
                .OrderBy(p => p.Name)
                .Take(20)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.DefaultUnitPrice,
                    p.Type,
                    p.Category,
                    p.VatApplicable
                })
                .ToListAsync();

            return Ok(results);
        }

        // POST: api/productservices
        [HttpPost]
        public async Task<ActionResult> Create(CreateProductServiceDto dto)
        {
            var item = new ProductService
            {
                Name = dto.Name,
                Description = dto.Description,
                DefaultUnitPrice = dto.DefaultUnitPrice,
                Type = dto.Type,
                Category = dto.Category,
                VatApplicable = dto.VatApplicable
            };

            _context.ProductServices.Add(item);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created product/service {Id}: {Name}", item.Id, item.Name);

            return CreatedAtAction(nameof(GetById), new { id = item.Id }, new
            {
                item.Id,
                item.Name,
                item.Description,
                item.DefaultUnitPrice,
                item.Type,
                item.Category,
                item.VatApplicable,
                item.CreatedAt
            });
        }

        // PUT: api/productservices/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateProductServiceDto dto)
        {
            var item = await _context.ProductServices.FindAsync(id);
            if (item == null) return NotFound();

            item.Name = dto.Name;
            item.Description = dto.Description;
            item.DefaultUnitPrice = dto.DefaultUnitPrice;
            item.Type = dto.Type;
            item.Category = dto.Category;
            item.VatApplicable = dto.VatApplicable;
            item.UpdatedAt = _time.GetUtcNow().DateTime;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated product/service {Id}: {Name}", item.Id, item.Name);

            return NoContent();
        }

        // DELETE: api/productservices/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.ProductServices.FindAsync(id);
            if (item == null) return NotFound();

            // Soft delete
            item.IsDeleted = true;
            item.DeletedAt = _time.GetUtcNow().DateTime;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft-deleted product/service {Id}", id);

            return NoContent();
        }
    }
}
