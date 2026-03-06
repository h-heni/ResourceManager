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
        public async Task<ActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.ProductServices
                    .AsNoTracking()
                    .OrderBy(p => p.Name);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var items = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.Description,
                        p.DefaultUnitPrice,
                        p.Type,
                        p.Category,
                        p.VatApplicable,
                        p.CreatedAt,
                        p.TvaRate,
                        p.IsStockTracked,
                        p.CurrentStock,
                        p.ReorderPoint
                    })
                    .ToListAsync();

                return Ok(new { Data = items, Page = page, Size = size, TotalCount = totalCount, TotalPages = totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching product services");
                return Ok(new { Data = Array.Empty<object>(), Page = page, Size = size, TotalCount = 0, TotalPages = 0 });
            }
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
                item.TvaRate,
                item.IsStockTracked,
                item.ReorderPoint
            });
        }

        // GET: api/productservices/search?q=term
        [HttpGet("search")]
        public async Task<ActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(Array.Empty<object>());

            var lower = q.Trim().ToLower();

            var results = await _context.ProductServices
                .AsNoTracking()
                .Where(p => p.Name.ToLower().Contains(lower) || (p.Description != null && p.Description.ToLower().Contains(lower)))
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
                    p.VatApplicable,
                    p.TvaRate,
                    p.IsStockTracked,
                    p.CurrentStock,
                    p.ReorderPoint
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
                TvaRate = dto.TvaRate,
                Type = dto.Type,
                Category = dto.Category,
                VatApplicable = dto.VatApplicable,
                IsStockTracked = dto.IsStockTracked,
                ReorderPoint = dto.ReorderPoint
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
            item.TvaRate = dto.TvaRate;
            item.Type = dto.Type;
            item.Category = dto.Category;
            item.VatApplicable = dto.VatApplicable;
            item.IsStockTracked = dto.IsStockTracked;
            item.ReorderPoint = dto.ReorderPoint;
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
