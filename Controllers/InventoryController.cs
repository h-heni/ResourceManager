using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.DTOs;
using ResourceManager.Models;
using ResourceManager.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ResourceManager.Controllers
{
    public class InventoryController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _time;
        private readonly ILogger<InventoryController> _logger;

        public InventoryController(AppDbContext context, TimeProvider time, ILogger<InventoryController> logger)
        {
            _context = context;
            _time = time;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════════════
        // STOCK LEVELS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/stock-levels — Paginated stock levels for all tracked products
        /// </summary>
        [HttpGet("stock-levels")]
        public async Task<ActionResult> GetStockLevels(
            [FromQuery] int page = 1,
            [FromQuery] int size = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null,
            [FromQuery] string? category = null,
            [FromQuery] int? warehouseId = null,
            [FromQuery] string? sortBy = "name",
            [FromQuery] string? sortDir = "asc")
        {
            try
            {
                var query = _context.ProductServices
                    .AsNoTracking()
                    .Where(p => p.IsStockTracked)
                    .Include(p => p.Warehouse)
                    .Include(p => p.Supplier)
                    .AsQueryable();

                // Filters
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var lower = search.Trim().ToLower();
                    query = query.Where(p => p.Name.ToLower().Contains(lower)
                        || (p.SKU != null && p.SKU.ToLower().Contains(lower))
                        || (p.Barcode != null && p.Barcode.ToLower().Contains(lower)));
                }

                if (!string.IsNullOrWhiteSpace(category))
                    query = query.Where(p => p.Category == category);

                if (warehouseId.HasValue)
                    query = query.Where(p => p.WarehouseId == warehouseId);

                // Status filter
                if (!string.IsNullOrWhiteSpace(status))
                {
                    query = status.ToLower() switch
                    {
                        "outofstock" => query.Where(p => p.CurrentStock <= 0),
                        "lowstock" => query.Where(p => p.ReorderPoint.HasValue && p.CurrentStock > 0 && p.CurrentStock <= p.ReorderPoint),
                        "instock" => query.Where(p => p.CurrentStock > 0 && (!p.ReorderPoint.HasValue || p.CurrentStock > p.ReorderPoint)),
                        "overstock" => query.Where(p => p.MaximumStock.HasValue && p.CurrentStock > p.MaximumStock),
                        _ => query
                    };
                }

                var totalCount = await query.CountAsync();

                // Sorting
                query = (sortBy?.ToLower(), sortDir?.ToLower()) switch
                {
                    ("stock", "desc") => query.OrderByDescending(p => p.CurrentStock),
                    ("stock", _) => query.OrderBy(p => p.CurrentStock),
                    ("price", "desc") => query.OrderByDescending(p => p.DefaultUnitPrice),
                    ("price", _) => query.OrderBy(p => p.DefaultUnitPrice),
                    ("sku", "desc") => query.OrderByDescending(p => p.SKU),
                    ("sku", _) => query.OrderBy(p => p.SKU),
                    (_, "desc") => query.OrderByDescending(p => p.Name),
                    _ => query.OrderBy(p => p.Name)
                };

                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var items = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(p => new StockLevelDto
                    {
                        ProductServiceId = p.Id,
                        ProductName = p.Name,
                        SKU = p.SKU,
                        Barcode = p.Barcode,
                        Category = p.Category,
                        Type = p.Type,
                        CurrentStock = p.CurrentStock,
                        ReorderPoint = p.ReorderPoint,
                        MinimumStock = p.MinimumStock,
                        MaximumStock = p.MaximumStock,
                        UnitOfMeasure = p.UnitOfMeasure,
                        DefaultUnitPrice = p.DefaultUnitPrice,
                        CostPrice = p.CostPrice,
                        StockValue = p.CurrentStock * (p.CostPrice ?? p.DefaultUnitPrice),
                        WarehouseName = p.Warehouse != null ? p.Warehouse.Name : null,
                        WarehouseId = p.WarehouseId,
                        SupplierName = p.Supplier != null ? p.Supplier.Name : null,
                        SupplierId = p.SupplierId,
                        StockStatus = p.CurrentStock <= 0 ? "OutOfStock"
                            : (p.ReorderPoint.HasValue && p.CurrentStock <= p.ReorderPoint) ? "LowStock"
                            : (p.MaximumStock.HasValue && p.CurrentStock > p.MaximumStock) ? "Overstock"
                            : "InStock"
                    })
                    .ToListAsync();

                return Ok(new { data = items, page, size, totalCount, totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock levels");
                return StatusCode(500, new { error = "Failed to fetch stock levels" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STOCK MOVEMENTS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/movements — Paginated stock movement history
        /// </summary>
        [HttpGet("movements")]
        public async Task<ActionResult> GetMovements(
            [FromQuery] int page = 1,
            [FromQuery] int size = 20,
            [FromQuery] int? productServiceId = null,
            [FromQuery] string? movementType = null,
            [FromQuery] string? referenceType = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] int? warehouseId = null)
        {
            try
            {
                var query = _context.StockMovements
                    .AsNoTracking()
                    .Include(m => m.ProductService)
                    .Include(m => m.Warehouse)
                    .AsQueryable();

                if (productServiceId.HasValue)
                    query = query.Where(m => m.ProductServiceId == productServiceId);
                if (!string.IsNullOrWhiteSpace(movementType))
                    query = query.Where(m => m.MovementType == movementType);
                if (!string.IsNullOrWhiteSpace(referenceType))
                    query = query.Where(m => m.ReferenceType == referenceType);
                if (from.HasValue)
                    query = query.Where(m => m.Date >= from.Value);
                if (to.HasValue)
                    query = query.Where(m => m.Date <= to.Value);
                if (warehouseId.HasValue)
                    query = query.Where(m => m.WarehouseId == warehouseId);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var items = await query
                    .OrderByDescending(m => m.Date)
                    .ThenByDescending(m => m.Id)
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(m => new StockMovementDto
                    {
                        Id = m.Id,
                        ProductServiceId = m.ProductServiceId,
                        ProductName = m.ProductService != null ? m.ProductService.Name : "",
                        SKU = m.ProductService != null ? m.ProductService.SKU : null,
                        MovementType = m.MovementType,
                        Quantity = m.Quantity,
                        UnitCost = m.UnitCost,
                        StockAfter = m.StockAfter,
                        ReferenceType = m.ReferenceType,
                        ReferenceId = m.ReferenceId,
                        ReferenceNumber = m.ReferenceNumber,
                        Date = m.Date,
                        Notes = m.Notes,
                        WarehouseName = m.Warehouse != null ? m.Warehouse.Name : null,
                        CreatedBy = m.CreatedBy,
                        CreatedAt = m.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new { data = items, page, size, totalCount, totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock movements");
                return StatusCode(500, new { error = "Failed to fetch stock movements" });
            }
        }

        /// <summary>
        /// POST api/inventory/movements — Create a manual stock movement (In/Out)
        /// </summary>
        [HttpPost("movements")]
        public async Task<ActionResult> CreateManualMovement(ManualStockMovementDto dto)
        {
            try
            {
                var product = await _context.ProductServices.FindAsync(dto.ProductServiceId);
                if (product == null) return NotFound(new { error = "Product not found" });

                // Only allow stock movements for tracked products
                if (!product.IsStockTracked)
                    return BadRequest(new { error = "Product is not inventory managed" });

                decimal newStock;
                if (dto.MovementType == "In")
                    newStock = product.CurrentStock + dto.Quantity;
                else
                    newStock = product.CurrentStock - dto.Quantity;

                if (newStock < 0)
                    return BadRequest(new { error = $"Insufficient stock. Current: {product.CurrentStock}, Requested: {dto.Quantity}" });

                product.CurrentStock = newStock;

                var movement = new StockMovement
                {
                    ProductServiceId = dto.ProductServiceId,
                    MovementType = dto.MovementType,
                    Quantity = dto.Quantity,
                    UnitCost = dto.UnitCost,
                    StockAfter = newStock,
                    ReferenceType = "Manual",
                    Date = _time.GetUtcNow().DateTime,
                    Notes = dto.Notes,
                    WarehouseId = dto.WarehouseId ?? product.WarehouseId
                };

                _context.StockMovements.Add(movement);
                await _context.SaveChangesAsync();

                // Check alerts
                await CheckAndGenerateAlerts(product);

                _logger.LogInformation("Manual stock {Type} for product {Id}: {Qty} units. New stock: {Stock}",
                    dto.MovementType, dto.ProductServiceId, dto.Quantity, newStock);

                return Ok(new
                {
                    id = movement.Id,
                    productServiceId = product.Id,
                    currentStock = product.CurrentStock,
                    movementType = dto.MovementType,
                    quantity = dto.Quantity
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating manual stock movement");
                return StatusCode(500, new { error = "Failed to create stock movement" });
            }
        }

        /// <summary>
        /// POST api/inventory/adjust — Adjust stock to a specific quantity (physical count)
        /// </summary>
        [HttpPost("adjust")]
        public async Task<ActionResult> AdjustStock(StockAdjustmentDto dto)
        {
            try
            {
                var product = await _context.ProductServices.FindAsync(dto.ProductServiceId);
                if (product == null) return NotFound(new { error = "Product not found" });

                // Only allow adjustments for tracked products
                if (!product.IsStockTracked)
                    return BadRequest(new { error = "Product is not inventory managed" });

                var oldStock = product.CurrentStock;
                var difference = dto.NewQuantity - oldStock;

                product.CurrentStock = dto.NewQuantity;

                var movement = new StockMovement
                {
                    ProductServiceId = dto.ProductServiceId,
                    MovementType = "Adjustment",
                    Quantity = Math.Abs(difference),
                    StockAfter = dto.NewQuantity,
                    ReferenceType = "Manual",
                    Date = _time.GetUtcNow().DateTime,
                    Notes = $"Stock adjustment: {oldStock} → {dto.NewQuantity}. {dto.Reason}",
                    WarehouseId = dto.WarehouseId ?? product.WarehouseId
                };

                _context.StockMovements.Add(movement);
                await _context.SaveChangesAsync();

                await CheckAndGenerateAlerts(product);

                _logger.LogInformation("Stock adjusted for product {Id}: {Old} → {New}", dto.ProductServiceId, oldStock, dto.NewQuantity);

                return Ok(new { productServiceId = product.Id, oldStock, newStock = product.CurrentStock });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adjusting stock");
                return StatusCode(500, new { error = "Failed to adjust stock" });
            }
        }

        /// <summary>
        /// POST api/inventory/transfer — Transfer stock between warehouses
        /// </summary>
        [HttpPost("transfer")]
        public async Task<ActionResult> TransferStock(StockTransferDto dto)
        {
            try
            {
                if (dto.FromWarehouseId == dto.ToWarehouseId)
                    return BadRequest(new { error = "Source and destination warehouse must be different" });

                var product = await _context.ProductServices.FindAsync(dto.ProductServiceId);
                if (product == null) return NotFound(new { error = "Product not found" });

                // Only allow transfers for tracked products
                if (!product.IsStockTracked)
                    return BadRequest(new { error = "Product is not inventory managed" });

                var fromWarehouse = await _context.Warehouses.FindAsync(dto.FromWarehouseId);
                var toWarehouse = await _context.Warehouses.FindAsync(dto.ToWarehouseId);
                if (fromWarehouse == null || toWarehouse == null)
                    return NotFound(new { error = "Warehouse not found" });

                // For simplicity, we track stock at product level (not per-warehouse)
                // Transfer just creates audit trail movements
                var now = _time.GetUtcNow().DateTime;

                var moveOut = new StockMovement
                {
                    ProductServiceId = dto.ProductServiceId,
                    MovementType = "TransferOut",
                    Quantity = dto.Quantity,
                    StockAfter = product.CurrentStock, // Stock doesn't change (same product)
                    ReferenceType = "Transfer",
                    Date = now,
                    Notes = $"Transfer to {toWarehouse.Name}. {dto.Notes}",
                    WarehouseId = dto.FromWarehouseId
                };

                var moveIn = new StockMovement
                {
                    ProductServiceId = dto.ProductServiceId,
                    MovementType = "TransferIn",
                    Quantity = dto.Quantity,
                    StockAfter = product.CurrentStock,
                    ReferenceType = "Transfer",
                    Date = now,
                    Notes = $"Transfer from {fromWarehouse.Name}. {dto.Notes}",
                    WarehouseId = dto.ToWarehouseId
                };

                // Update warehouse assignment if this is the product's current warehouse
                if (product.WarehouseId == dto.FromWarehouseId)
                    product.WarehouseId = dto.ToWarehouseId;

                _context.StockMovements.AddRange(moveOut, moveIn);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Stock transferred for product {Id}: {Qty} from warehouse {From} to {To}",
                    dto.ProductServiceId, dto.Quantity, dto.FromWarehouseId, dto.ToWarehouseId);

                return Ok(new { productServiceId = product.Id, quantity = dto.Quantity, from = fromWarehouse.Name, to = toWarehouse.Name });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transferring stock");
                return StatusCode(500, new { error = "Failed to transfer stock" });
            }
        }

        /// <summary>
        /// PUT api/inventory/product/{id} — Update inventory-specific fields on a product
        /// </summary>
        [HttpPut("product/{id}")]
        public async Task<ActionResult> UpdateProductInventory(int id, UpdateProductInventoryDto dto)
        {
            try
            {
                var product = await _context.ProductServices.FindAsync(id);
                if (product == null) return NotFound();

                if (dto.SKU != null) product.SKU = dto.SKU;
                if (dto.Barcode != null) product.Barcode = dto.Barcode;
                if (dto.ReorderPoint.HasValue) product.ReorderPoint = dto.ReorderPoint;
                if (dto.MinimumStock.HasValue) product.MinimumStock = dto.MinimumStock;
                if (dto.MaximumStock.HasValue) product.MaximumStock = dto.MaximumStock;
                if (dto.UnitOfMeasure != null) product.UnitOfMeasure = dto.UnitOfMeasure;
                if (dto.IsStockTracked.HasValue) product.IsStockTracked = dto.IsStockTracked.Value;
                if (dto.CostPrice.HasValue) product.CostPrice = dto.CostPrice;
                if (dto.SupplierId.HasValue) product.SupplierId = dto.SupplierId;
                if (dto.Weight.HasValue) product.Weight = dto.Weight;
                if (dto.WarehouseId.HasValue) product.WarehouseId = dto.WarehouseId;

                product.UpdatedAt = _time.GetUtcNow().DateTime;
                await _context.SaveChangesAsync();

                // If stock tracking was just enabled for the first time and stock > 0, create initial movement
                if (dto.IsStockTracked == true && product.CurrentStock == 0)
                {
                    // No initial movement needed — stock starts at 0
                }

                _logger.LogInformation("Updated inventory settings for product {Id}: {Name}", id, product.Name);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating product inventory settings");
                return StatusCode(500, new { error = "Failed to update product inventory" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STOCK ALERTS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/alerts — Active stock alerts
        /// </summary>
        [HttpGet("alerts")]
        public async Task<ActionResult> GetAlerts(
            [FromQuery] bool unreadOnly = false,
            [FromQuery] bool unresolvedOnly = true)
        {
            try
            {
                var query = _context.StockAlerts
                    .AsNoTracking()
                    .Include(a => a.ProductService)
                    .AsQueryable();

                if (unreadOnly) query = query.Where(a => !a.IsRead);
                if (unresolvedOnly) query = query.Where(a => !a.IsResolved);

                var alerts = await query
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(100)
                    .Select(a => new StockAlertDto
                    {
                        Id = a.Id,
                        ProductServiceId = a.ProductServiceId,
                        ProductName = a.ProductService != null ? a.ProductService.Name : "",
                        SKU = a.ProductService != null ? a.ProductService.SKU : null,
                        AlertType = a.AlertType,
                        Threshold = a.Threshold,
                        CurrentQuantity = a.CurrentQuantity,
                        IsRead = a.IsRead,
                        IsResolved = a.IsResolved,
                        CreatedAt = a.CreatedAt,
                        ResolvedAt = a.ResolvedAt
                    })
                    .ToListAsync();

                return Ok(alerts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock alerts");
                return Ok(Array.Empty<object>());
            }
        }

        /// <summary>
        /// GET api/inventory/alerts/count — Count of unread active stock alerts
        /// </summary>
        [HttpGet("alerts/count")]
        public async Task<ActionResult> GetAlertCount()
        {
            try
            {
                var count = await _context.StockAlerts
                    .Where(a => !a.IsResolved && !a.IsRead)
                    .CountAsync();
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching stock alert count");
                return Ok(new { count = 0 });
            }
        }

        /// <summary>
        /// PUT api/inventory/alerts/{id}/read — Mark alert as read
        /// </summary>
        [HttpPut("alerts/{id}/read")]
        public async Task<ActionResult> MarkAlertRead(int id)
        {
            var alert = await _context.StockAlerts.FindAsync(id);
            if (alert == null) return NotFound();
            alert.IsRead = true;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// PUT api/inventory/alerts/{id}/resolve — Mark alert as resolved
        /// </summary>
        [HttpPut("alerts/{id}/resolve")]
        public async Task<ActionResult> ResolveAlert(int id)
        {
            var alert = await _context.StockAlerts.FindAsync(id);
            if (alert == null) return NotFound();
            alert.IsResolved = true;
            alert.ResolvedAt = _time.GetUtcNow().DateTime;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// POST api/inventory/alerts/check — Manually trigger alert check for all products
        /// </summary>
        [HttpPost("alerts/check")]
        public async Task<ActionResult> CheckAlerts()
        {
            try
            {
                var products = await _context.ProductServices
                    .Where(p => p.IsStockTracked)
                    .ToListAsync();

                int generated = 0;
                foreach (var product in products)
                {
                    generated += await CheckAndGenerateAlerts(product);
                }
                await _context.SaveChangesAsync();

                return Ok(new { alertsGenerated = generated });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking stock alerts");
                return StatusCode(500, new { error = "Failed to check alerts" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // WAREHOUSES
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/warehouses
        /// </summary>
        [HttpGet("warehouses")]
        public async Task<ActionResult> GetWarehouses()
        {
            try
            {
                var warehouses = await _context.Warehouses
                    .AsNoTracking()
                    .Where(w => w.IsActive)
                    .Select(w => new WarehouseDto
                    {
                        Id = w.Id,
                        Name = w.Name,
                        Address = w.Address,
                        Description = w.Description,
                        IsDefault = w.IsDefault,
                        IsActive = w.IsActive,
                        ProductCount = _context.ProductServices.Count(p => p.WarehouseId == w.Id && p.IsStockTracked),
                        CreatedAt = w.CreatedAt
                    })
                    .OrderBy(w => w.Name)
                    .ToListAsync();

                return Ok(warehouses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching warehouses");
                return Ok(Array.Empty<object>());
            }
        }

        /// <summary>
        /// POST api/inventory/warehouses
        /// </summary>
        [HttpPost("warehouses")]
        public async Task<ActionResult> CreateWarehouse(CreateWarehouseDto dto)
        {
            try
            {
                // If setting as default, unset any existing default
                if (dto.IsDefault)
                {
                    var existingDefault = await _context.Warehouses.FirstOrDefaultAsync(w => w.IsDefault);
                    if (existingDefault != null) existingDefault.IsDefault = false;
                }

                var warehouse = new Warehouse
                {
                    Name = dto.Name,
                    Address = dto.Address,
                    Description = dto.Description,
                    IsDefault = dto.IsDefault
                };

                _context.Warehouses.Add(warehouse);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created warehouse {Id}: {Name}", warehouse.Id, warehouse.Name);
                return CreatedAtAction(nameof(GetWarehouses), new { id = warehouse.Id }, new { warehouse.Id, warehouse.Name });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating warehouse");
                return StatusCode(500, new { error = "Failed to create warehouse" });
            }
        }

        /// <summary>
        /// PUT api/inventory/warehouses/{id}
        /// </summary>
        [HttpPut("warehouses/{id}")]
        public async Task<ActionResult> UpdateWarehouse(int id, UpdateWarehouseDto dto)
        {
            try
            {
                var warehouse = await _context.Warehouses.FindAsync(id);
                if (warehouse == null) return NotFound();

                if (dto.IsDefault && !warehouse.IsDefault)
                {
                    var existingDefault = await _context.Warehouses.FirstOrDefaultAsync(w => w.IsDefault && w.Id != id);
                    if (existingDefault != null) existingDefault.IsDefault = false;
                }

                warehouse.Name = dto.Name;
                warehouse.Address = dto.Address;
                warehouse.Description = dto.Description;
                warehouse.IsDefault = dto.IsDefault;
                warehouse.IsActive = dto.IsActive;
                warehouse.UpdatedAt = _time.GetUtcNow().DateTime;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating warehouse");
                return StatusCode(500, new { error = "Failed to update warehouse" });
            }
        }

        /// <summary>
        /// DELETE api/inventory/warehouses/{id} (soft delete)
        /// </summary>
        [HttpDelete("warehouses/{id}")]
        public async Task<ActionResult> DeleteWarehouse(int id)
        {
            try
            {
                var warehouse = await _context.Warehouses.FindAsync(id);
                if (warehouse == null) return NotFound();

                // Check if any products are assigned
                var hasProducts = await _context.ProductServices.AnyAsync(p => p.WarehouseId == id && p.IsStockTracked);
                if (hasProducts)
                    return BadRequest(new { error = "Cannot delete warehouse with assigned products. Reassign them first." });

                warehouse.IsDeleted = true;
                warehouse.DeletedAt = _time.GetUtcNow().DateTime;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Soft-deleted warehouse {Id}", id);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting warehouse");
                return StatusCode(500, new { error = "Failed to delete warehouse" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PURCHASE ORDERS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/purchase-orders — List purchase orders
        /// </summary>
        [HttpGet("purchase-orders")]
        public async Task<ActionResult> GetPurchaseOrders(
            [FromQuery] int page = 1,
            [FromQuery] int size = 20,
            [FromQuery] string? status = null)
        {
            try
            {
                var query = _context.PurchaseOrders
                    .AsNoTracking()
                    .Include(po => po.Supplier)
                    .Include(po => po.Items)
                    .Include(po => po.SupplierInvoice)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(status))
                    query = query.Where(po => po.Status == status);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var items = await query
                    .OrderByDescending(po => po.Date)
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(po => new PurchaseOrderListDto
                    {
                        Id = po.Id,
                        Number = po.Number,
                        Date = po.Date,
                        ExpectedDeliveryDate = po.ExpectedDeliveryDate,
                        Status = po.Status,
                        SupplierName = po.Supplier != null ? po.Supplier.Name : null,
                        SupplierId = po.SupplierId,
                        TotalAmount = po.TotalAmount,
                        Currency = po.Currency,
                        ItemCount = po.Items.Count,
                        CreatedAt = po.CreatedAt,
                        SupplierInvoiceId = po.SupplierInvoiceId,
                        SupplierInvoiceNumber = po.SupplierInvoice != null ? po.SupplierInvoice.InvoiceNumber : null
                    })
                    .ToListAsync();

                return Ok(new { data = items, page, size, totalCount, totalPages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching purchase orders");
                return StatusCode(500, new { error = "Failed to fetch purchase orders" });
            }
        }

        /// <summary>
        /// GET api/inventory/purchase-orders/{id} — Get purchase order detail
        /// </summary>
        [HttpGet("purchase-orders/{id}")]
        public async Task<ActionResult> GetPurchaseOrder(int id)
        {
            try
            {
                var po = await _context.PurchaseOrders
                    .AsNoTracking()
                    .Include(p => p.Supplier)
                    .Include(p => p.SupplierInvoice)
                    .Include(p => p.Items)
                        .ThenInclude(i => i.ProductService)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (po == null) return NotFound();

                var dto = new PurchaseOrderDetailDto
                {
                    Id = po.Id,
                    Number = po.Number,
                    Date = po.Date,
                    ExpectedDeliveryDate = po.ExpectedDeliveryDate,
                    Status = po.Status,
                    SupplierName = po.Supplier?.Name,
                    SupplierId = po.SupplierId,
                    TotalAmount = po.TotalAmount,
                    SubTotal = po.SubTotal,
                    TaxAmount = po.TaxAmount,
                    Currency = po.Currency,
                    ItemCount = po.Items.Count,
                    CreatedAt = po.CreatedAt,
                    Notes = po.Notes,
                    SupplierInvoiceId = po.SupplierInvoiceId,
                    SupplierInvoiceNumber = po.SupplierInvoice?.InvoiceNumber,
                    Items = po.Items.Select(i => new PurchaseOrderItemDto
                    {
                        Id = i.Id,
                        ProductServiceId = i.ProductServiceId,
                        ProductName = i.ProductService?.Name ?? "",
                        SKU = i.ProductService?.SKU,
                        Description = i.Description,
                        Quantity = i.Quantity,
                        ReceivedQuantity = i.ReceivedQuantity,
                        RemainingQuantity = i.RemainingQuantity,
                        UnitPrice = i.UnitPrice,
                        TaxRate = i.TaxRate,
                        TotalHT = i.TotalHT
                    }).ToList()
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching purchase order {Id}", id);
                return StatusCode(500, new { error = "Failed to fetch purchase order" });
            }
        }

        /// <summary>
        /// POST api/inventory/purchase-orders — Create a purchase order
        /// </summary>
        [HttpPost("purchase-orders")]
        public async Task<ActionResult> CreatePurchaseOrder(CreatePurchaseOrderDto dto)
        {
            try
            {
                var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
                if (supplier == null) return BadRequest(new { error = "Supplier not found" });

                // Generate PO number
                var lastPo = await _context.PurchaseOrders
                    .OrderByDescending(po => po.Id)
                    .FirstOrDefaultAsync();
                var nextNum = (lastPo?.Id ?? 0) + 1;
                var poNumber = $"PO-{DateTime.UtcNow:yyyy}-{nextNum:D4}";

                // Load product tax rates so we can default TaxRate from the product
                var productIds = dto.Items.Select(i => i.ProductServiceId).Distinct().ToList();
                var products = await _context.ProductServices
                    .Where(p => productIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => new { p.TvaRate, p.VatApplicable });

                var po = new PurchaseOrder
                {
                    Number = poNumber,
                    Date = dto.Date ?? DateTime.UtcNow,
                    ExpectedDeliveryDate = dto.ExpectedDeliveryDate,
                    SupplierId = dto.SupplierId,
                    Notes = dto.Notes,
                    Currency = dto.Currency,
                    CurrencySymbol = dto.CurrencySymbol,
                    PdfLanguage = dto.PdfLanguage,
                    Status = "Draft",
                    Items = dto.Items.Select(i =>
                    {
                        var taxRate = i.TaxRate;
                        if (!taxRate.HasValue && products.TryGetValue(i.ProductServiceId, out var prod))
                            taxRate = prod.VatApplicable ? prod.TvaRate / 100m : 0m;
                        return new PurchaseOrderItem
                        {
                            ProductServiceId = i.ProductServiceId,
                            Description = i.Description ?? "",
                            Quantity = i.Quantity,
                            UnitPrice = i.UnitPrice,
                            TaxRate = taxRate ?? 0.19m
                        };
                    }).ToList()
                };

                po.CalculateTotals();
                _context.PurchaseOrders.Add(po);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created purchase order {Number} for supplier {SupplierId}", poNumber, dto.SupplierId);

                return CreatedAtAction(nameof(GetPurchaseOrder), new { id = po.Id }, new { po.Id, po.Number });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating purchase order");
                return StatusCode(500, new { error = "Failed to create purchase order" });
            }
        }

        /// <summary>
        /// PUT api/inventory/purchase-orders/{id}/status — Update PO status
        /// </summary>
        [HttpPut("purchase-orders/{id}/status")]
        public async Task<ActionResult> UpdatePurchaseOrderStatus(int id, [FromBody] string status)
        {
            try
            {
                var po = await _context.PurchaseOrders.FindAsync(id);
                if (po == null) return NotFound();

                var validStatuses = new[] { "Draft", "Sent", "PartiallyReceived", "Received", "Cancelled" };
                if (!validStatuses.Contains(status))
                    return BadRequest(new { error = $"Invalid status. Must be one of: {string.Join(", ", validStatuses)}" });

                po.Status = status;
                po.UpdatedAt = _time.GetUtcNow().DateTime;
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating PO status");
                return StatusCode(500, new { error = "Failed to update PO status" });
            }
        }

        /// <summary>
        /// POST api/inventory/purchase-orders/{id}/receive — Receive goods from a PO (auto-adds stock)
        /// </summary>
        [HttpPost("purchase-orders/{id}/receive")]
        public async Task<ActionResult> ReceivePurchaseOrder(int id, ReceivePurchaseOrderDto dto)
        {
            try
            {
                var po = await _context.PurchaseOrders
                    .Include(p => p.Items)
                        .ThenInclude(i => i.ProductService)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (po == null) return NotFound();
                if (po.Status == "Cancelled") return BadRequest(new { error = "Cannot receive items for a cancelled PO" });

                var now = _time.GetUtcNow().DateTime;

                foreach (var itemReceipt in dto.Items)
                {
                    var poItem = po.Items.FirstOrDefault(i => i.Id == itemReceipt.PurchaseOrderItemId);
                    if (poItem == null) continue;

                    if (itemReceipt.ReceivedQuantity > poItem.RemainingQuantity)
                        return BadRequest(new { error = $"Cannot receive more than ordered for item {poItem.Description}. Remaining: {poItem.RemainingQuantity}" });

                    poItem.ReceivedQuantity += itemReceipt.ReceivedQuantity;

                    // Add stock
                    var product = poItem.ProductService;
                    if (product != null)
                    {
                        // Skip non-tracked products
                        if (!product.IsStockTracked)
                            continue;

                        product.CurrentStock += itemReceipt.ReceivedQuantity;

                        var movement = new StockMovement
                        {
                            ProductServiceId = product.Id,
                            MovementType = "In",
                            Quantity = itemReceipt.ReceivedQuantity,
                            UnitCost = poItem.UnitPrice,
                            StockAfter = product.CurrentStock,
                            ReferenceType = "PurchaseOrder",
                            ReferenceId = po.Id,
                            ReferenceNumber = po.Number,
                            Date = now,
                            Notes = dto.Notes,
                            WarehouseId = product.WarehouseId
                        };
                        _context.StockMovements.Add(movement);

                        await CheckAndGenerateAlerts(product);
                    }
                }

                // Check if all items fully received
                if (po.Items.All(i => i.RemainingQuantity <= 0))
                    po.Status = "Received";
                else if (po.Items.Any(i => i.ReceivedQuantity > 0))
                    po.Status = "PartiallyReceived";

                po.UpdatedAt = now;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Received goods for PO {Number}. Status: {Status}", po.Number, po.Status);

                return Ok(new { poId = po.Id, status = po.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving PO {Id}", id);
                return StatusCode(500, new { error = "Failed to receive purchase order" });
            }
        }

        /// <summary>
        /// DELETE api/inventory/purchase-orders/{id} (soft delete)
        /// </summary>
        [HttpDelete("purchase-orders/{id}")]
        public async Task<ActionResult> DeletePurchaseOrder(int id)
        {
            try
            {
                var po = await _context.PurchaseOrders.FindAsync(id);
                if (po == null) return NotFound();
                if (po.Status != "Draft")
                    return BadRequest(new { error = "Only draft purchase orders can be deleted" });

                po.IsDeleted = true;
                po.DeletedAt = _time.GetUtcNow().DateTime;
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting PO {Id}", id);
                return StatusCode(500, new { error = "Failed to delete purchase order" });
            }
        }

        /// <summary>
        /// GET api/inventory/purchase-orders/{id}/pdf — Download PO as PDF
        /// </summary>
        [HttpGet("purchase-orders/{id}/pdf")]
        public async Task<ActionResult> GetPurchaseOrderPdf(int id)
        {
            try
            {
                var po = await _context.PurchaseOrders
                    .AsNoTracking()
                    .Include(p => p.Supplier)
                    .Include(p => p.Items)
                        .ThenInclude(i => i.ProductService)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (po == null) return NotFound();

                var companyIdClaim = User.FindFirst("CompanyId")?.Value;
                Company? company = null;
                CompanySettings? companySettings = null;
                if (int.TryParse(companyIdClaim, out int companyId))
                {
                    company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
                    companySettings = await _context.CompanySettings.AsNoTracking().FirstOrDefaultAsync(s => s.CompanyId == companyId);
                }

                // Build settings same way as invoices
                var pdfSettings = PdfSettings.FromCompanySettings(
                    companySettings,
                    company,
                    creatorName: "",
                    currencyOverride: po.CurrencySymbol,
                    languageOverride: po.PdfLanguage);

                var lang = pdfSettings.InvoiceLanguage?.ToLowerInvariant() ?? "fr";
                var culture = lang switch
                {
                    "fr" => new System.Globalization.CultureInfo("fr-FR"),
                    "de" => new System.Globalization.CultureInfo("de-DE"),
                    "ar" => new System.Globalization.CultureInfo("ar-TN"),
                    _    => new System.Globalization.CultureInfo("en-US")
                };
                var moneyCulture = System.Globalization.CultureInfo.GetCultureInfo("fr-FR");

                // Currency helpers (same as Document<T>)
                var currencyCode = string.IsNullOrWhiteSpace(pdfSettings.CurrencySymbol) ? "EUR" : pdfSettings.CurrencySymbol.Trim();
                var decimals = FiscalComplianceHelper.GetDecimalPlaces(currencyCode);
                var displaySymbol = FiscalComplianceHelper.GetDisplayCurrencySymbol(currencyCode, lang);
                string FormatAmt(decimal v) => $"{v.ToString($"N{decimals}", moneyCulture)}\u00A0{displaySymbol}";
                string FormatQty(decimal v) => v == Math.Floor(v)
                    ? v.ToString("#,##0", moneyCulture).Replace('\u202F', ' ').Replace('\u00A0', ' ')
                    : v.ToString("#,##0.###", moneyCulture).Replace('\u202F', ' ').Replace('\u00A0', ' ');
                float ResolveFontSize(string formatted, float baseFontSize = 10f)
                {
                    if (formatted.Length >= 24) return Math.Max(7.5f, baseFontSize - 2.5f);
                    if (formatted.Length >= 20) return Math.Max(8f, baseFontSize - 2f);
                    if (formatted.Length >= 17) return Math.Max(8.5f, baseFontSize - 1.5f);
                    if (formatted.Length >= 15) return Math.Max(9f, baseFontSize - 1f);
                    return baseFontSize;
                }

                // Localized labels
                var titleLabel = lang switch { "fr" => "Bon de commande", "de" => "Bestellung", "ar" => "أمر شراء", _ => "Purchase Order" };
                var dateLabel = lang switch { "fr" => "Date", "de" => "Datum", "ar" => "التاريخ", _ => "Date" };
                var expectedLabel = lang switch { "fr" => "Livraison prévue", "de" => "Erwartete Lieferung", "ar" => "التسليم المتوقع", _ => "Expected Delivery" };
                var fromLabel = lang switch { "fr" => "De", "de" => "Von", "ar" => "من", _ => "From" };
                var supplierLabel = lang switch { "fr" => "Fournisseur", "de" => "Lieferant", "ar" => "المورد", _ => "Supplier" };
                var descLabel = lang switch { "fr" => "Déscription", "de" => "Bezeichnung", "ar" => "الوصف", _ => "Description" };
                var qtyLabel = lang switch { "fr" => "Qté", "de" => "Menge", "ar" => "الكمية", _ => "Qty" };
                var taxColLabel = lang switch { "fr" => "TVA", "de" => "MwSt", "ar" => "ضريبة", _ => "Tax" };
                var upLabel = lang switch { "fr" => "Prix Unit.", "de" => "Einzelpreis", "ar" => "سعر الوحدة", _ => "Unit Price" };
                var totalColLabel = lang switch { "fr" => "Total", "de" => "Gesamt", "ar" => "المجموع", _ => "Total" };
                var subtotalLabel = lang switch { "fr" => "Total H TVA", "de" => "Zwischensumme", "ar" => "المجموع الفرعي", _ => "Subtotal" };
                var vatPrefix = lang switch { "fr" => "TVA", "de" => "MwSt", "ar" => "ضريبة", _ => "VAT" };
                var totalTtcLabel = lang switch { "fr" => "Total TTC", "de" => "Gesamtbetrag", "ar" => "المجموع الكلي", _ => "Total" };
                var notesLabel = lang switch { "fr" => "Notes", "de" => "Anmerkungen", "ar" => "ملاحظات", _ => "Notes" };

                var brandColor = pdfSettings.PrimaryColor;
                var headerDark = "#232323";
                var textGrey = "#666666";

                // Prepare logo
                byte[] logoBytes = pdfSettings.LogoData is { Length: > 0 } ? pdfSettings.LogoData : Array.Empty<byte>();

                // Resolve effective tax rates (fix legacy POs stored with TaxRate=0/null)
                var itemsList = po.Items.ToList();
                var effectiveTaxRates = new Dictionary<int, decimal>();
                foreach (var item in itemsList)
                {
                    var rate = item.TaxRate ?? 0m;
                    if (rate == 0m && item.ProductService != null)
                    {
                        rate = item.ProductService.VatApplicable
                            ? item.ProductService.TvaRate / 100m
                            : 0m;
                    }
                    effectiveTaxRates[item.Id] = rate;
                }

                // Recalculate totals using effective rates
                var effectiveSubTotal = itemsList.Sum(i => i.UnitPrice * i.Quantity);
                var effectiveTaxAmount = itemsList.Sum(i => i.UnitPrice * i.Quantity * effectiveTaxRates[i.Id]);
                var effectiveTotal = effectiveSubTotal + effectiveTaxAmount;

                // Build owner and supplier as Client for AddressComponent
                var owner = new Client
                {
                    Name = pdfSettings.CompanyName,
                    Address = pdfSettings.CompanyAddress,
                    TaxId = pdfSettings.CompanyTaxId,
                    Phone = pdfSettings.CompanyPhone
                };
                var supplierAsClient = new Client
                {
                    Name = po.Supplier?.Name ?? "—",
                    Address = po.Supplier?.Address ?? "",
                    TaxId = po.Supplier?.TaxId ?? "",
                    Phone = po.Supplier?.Phone ?? ""
                };

                QuestPDF.Settings.License = LicenseType.Community;

                var pdfBytes = QuestPDF.Fluent.Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(50);
                        page.DefaultTextStyle(x => x.FontSize(10).FontColor(textGrey));

                        // ═══ HEADER (same as Invoice) ═══
                        page.Header().Row(row =>
                        {
                            row.RelativeItem().Column(column =>
                            {
                                column.Item().PaddingTop(20)
                                    .Text(titleLabel)
                                    .FontSize(20).Bold().FontColor(brandColor);
                                column.Item().PaddingTop(2)
                                    .Text(po.Number)
                                    .FontSize(15).Bold().FontColor(brandColor);
                                column.Item().Text(text =>
                                {
                                    text.Span($"{dateLabel}: ").SemiBold();
                                    text.Span(po.Date.ToString("D", culture));
                                });
                                if (po.ExpectedDeliveryDate.HasValue)
                                {
                                    column.Item().Text(text =>
                                    {
                                        text.Span($"{expectedLabel}: ").SemiBold();
                                        text.Span(po.ExpectedDeliveryDate.Value.ToString("D", culture));
                                    });
                                }
                            });

                            if (pdfSettings.ShowLogo && logoBytes.Length > 0)
                            {
                                row.ConstantItem(20);
                                row.ConstantItem(150).Height(80).AlignRight().AlignMiddle().Image(logoBytes).FitArea();
                            }
                        });

                        // ═══ CONTENT ═══
                        page.Content().PaddingVertical(20).Column(column =>
                        {
                            column.Spacing(5);

                            // From / Supplier addresses
                            column.Item().Row(row =>
                            {
                                row.RelativeItem().Component(new AddressComponent(fromLabel, owner));
                                row.ConstantItem(50);
                                row.RelativeItem().Component(new AddressComponent(supplierLabel, supplierAsClient));
                            });

                            // ═══ TABLE (same as Invoice: #, Desc, Qty, TVA, Unit Price, Total) ═══
                            column.Item().PaddingVertical(20).Table(table =>
                            {
                                table.ColumnsDefinition(cols =>
                                {
                                    cols.ConstantColumn(25);
                                    cols.RelativeColumn(3);
                                    cols.ConstantColumn(55);
                                    cols.ConstantColumn(65);
                                    cols.ConstantColumn(110);
                                    cols.ConstantColumn(120);
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Element(HeaderCell).AlignCenter().Text("#");
                                    header.Cell().Element(HeaderCell).Text(descLabel);
                                    header.Cell().Element(HeaderCell).AlignRight().Text(qtyLabel);
                                    header.Cell().Element(HeaderCell).AlignCenter().Text(taxColLabel);
                                    header.Cell().Element(HeaderCell).AlignCenter().Text(upLabel);
                                    header.Cell().Element(HeaderCell).AlignCenter().Text(totalColLabel);

                                    IContainer HeaderCell(IContainer c)
                                        => c.Background(headerDark).BorderBottom(5).BorderColor(brandColor).Padding(5)
                                            .DefaultTextStyle(x => x.FontColor(Colors.White).SemiBold());
                                });

                                var itemsList2 = po.Items.ToList();
                                for (int i = 0; i < itemsList2.Count; i++)
                                {
                                    var item = itemsList2[i];
                                    var isEven = i % 2 == 0;
                                    var itemTaxRate = effectiveTaxRates[item.Id];

                                    var unitPriceFormatted = FormatAmt(item.UnitPrice);
                                    var totalFormatted = FormatAmt(item.TotalHT);
                                    var unitPriceFontSize = ResolveFontSize(unitPriceFormatted, 9.5f);
                                    var totalFontSize = ResolveFontSize(totalFormatted, 9.5f);

                                    table.Cell().Element(e => DataCell(e, isEven)).AlignCenter().Text($"{i + 1}");
                                    table.Cell().Element(e => DataCell(e, isEven)).Text(item.ProductService?.Name ?? item.Description);
                                    table.Cell().Element(e => DataCell(e, isEven)).AlignRight().Text(FormatQty(item.Quantity));
                                    table.Cell().Element(e => DataCell(e, isEven)).AlignCenter().Text($"{itemTaxRate:P0}");
                                    table.Cell().Element(e => DataCell(e, isEven)).AlignRight().Text(text =>
                                    {
                                        text.DefaultTextStyle(x => x.FontSize(unitPriceFontSize));
                                        text.Span(unitPriceFormatted);
                                    });
                                    table.Cell().Element(e => DataCell(e, isEven)).AlignRight().Text(text =>
                                    {
                                        text.DefaultTextStyle(x => x.FontSize(totalFontSize).SemiBold());
                                        text.Span(totalFormatted);
                                    });

                                    static IContainer DataCell(IContainer container, bool isEven)
                                        => container.Background(isEven ? "#F0F0F0" : Colors.White).PaddingVertical(5).PaddingHorizontal(4);
                                }
                            });

                            // ═══ TOTALS (same as Invoice) ═══
                            column.Item().PaddingTop(25).Row(row =>
                            {
                                row.RelativeItem(2).Column(_ => { }); // spacer
                                row.RelativeItem(2).Column(_ => { }); // spacer

                                row.RelativeItem(3).AlignRight().Column(c =>
                                {
                                    var subtotalFormatted = FormatAmt(effectiveSubTotal);
                                    var taxFormatted = FormatAmt(effectiveTaxAmount);
                                    var totalFormatted = FormatAmt(effectiveTotal);
                                    var subtotalFontSize = ResolveFontSize(subtotalFormatted, 10f);
                                    var taxFontSize = ResolveFontSize(taxFormatted, 10f);
                                    var totalFontSize = ResolveFontSize(totalFormatted, 14f);

                                    c.Item().Table(t =>
                                    {
                                        t.ColumnsDefinition(cols => { cols.RelativeColumn(); cols.RelativeColumn(); });

                                        t.Cell().Padding(5).Text(subtotalLabel);
                                        t.Cell().AlignRight().Padding(5).Text(text =>
                                        {
                                            text.DefaultTextStyle(x => x.FontSize(subtotalFontSize).SemiBold());
                                            text.Span(subtotalFormatted);
                                        });

                                        var hasVat = effectiveTaxRates.Values.Any(r => r > 0);
                                        var vatLabelText = hasVat
                                            ? $"{vatPrefix} ({effectiveTaxRates.Values.Where(r => r > 0).First():P0})"
                                            : $"{vatPrefix} (0%)";

                                        t.Cell().Padding(5).Text(vatLabelText);
                                        t.Cell().AlignRight().Padding(5).Text(text =>
                                        {
                                            text.DefaultTextStyle(x => x.FontSize(taxFontSize).SemiBold());
                                            text.Span(taxFormatted);
                                        });

                                        t.Cell().ColumnSpan(2).PaddingTop(10).BorderTop(2).BorderColor(brandColor).PaddingTop(5).Row(r =>
                                        {
                                            r.RelativeItem().Text(totalTtcLabel).Bold().FontSize(14).FontColor(brandColor);
                                            r.RelativeItem().AlignRight().Text(text =>
                                            {
                                                text.DefaultTextStyle(x => x.Bold().FontSize(totalFontSize).FontColor(brandColor));
                                                text.Span(totalFormatted);
                                            });
                                        });
                                    });
                                });
                            });

                            // ═══ NOTES ═══
                            if (!string.IsNullOrWhiteSpace(po.Notes))
                            {
                                column.Item().PaddingTop(15).Column(c =>
                                {
                                    c.Item().Text(notesLabel).Bold().FontSize(9).FontColor(brandColor);
                                    c.Item().Text(po.Notes).FontSize(9).FontColor(textGrey);
                                });
                            }

                            // ═══ SIGNATURE BLOCK (reuse company settings) ═══
                            if (pdfSettings.ShowSignature && (!string.IsNullOrWhiteSpace(pdfSettings.PdfSignatureText)
                                || !string.IsNullOrWhiteSpace(pdfSettings.PdfSignerPosition)
                                || (pdfSettings.ShowSignatureOnPdf && pdfSettings.SignatureImageData?.Length > 0)))
                            {
                                column.Item().PaddingTop(20).AlignRight().Column(sigCol =>
                                {
                                    if (!string.IsNullOrWhiteSpace(pdfSettings.PdfSignatureText))
                                        sigCol.Item().AlignCenter().Text(pdfSettings.PdfSignatureText).FontSize(16).Italic().Bold().FontColor("#1A202C");
                                    if (!string.IsNullOrWhiteSpace(pdfSettings.PdfSignerPosition))
                                    {
                                        sigCol.Item().PaddingVertical(10).LineHorizontal(2).LineColor(Colors.BlueGrey.Medium);
                                        sigCol.Item().PaddingTop(4).AlignCenter().Text(pdfSettings.PdfSignerPosition).FontSize(10).FontColor(Colors.Grey.Medium);
                                    }
                                    if (pdfSettings.ShowSignatureOnPdf && pdfSettings.SignatureImageData?.Length > 0)
                                        sigCol.Item().PaddingTop(4).AlignCenter().MaxWidth(230).MaxHeight(130).Image(pdfSettings.SignatureImageData).FitArea();
                                });
                            }
                        });

                        // ═══ FOOTER ═══
                        page.Footer().AlignCenter().Text(text =>
                        {
                            text.CurrentPageNumber();
                            text.Span(" / ");
                            text.TotalPages();
                        });
                    });
                }).GeneratePdf();

                return File(pdfBytes, "application/pdf", $"PO_{po.Number}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for PO {Id}", id);
                return StatusCode(500, new { error = "Failed to generate purchase order PDF" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // REPORTS (Phase H)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET api/inventory/reports/valuation — Inventory valuation report
        /// </summary>
        [HttpGet("reports/valuation")]
        public async Task<ActionResult> GetValuationReport()
        {
            try
            {
                var products = await _context.ProductServices
                    .AsNoTracking()
                    .Where(p => p.IsStockTracked)
                    .Include(p => p.Warehouse)
                    .Include(p => p.Supplier)
                    .ToListAsync();

                var items = products.Select(p => new StockLevelDto
                {
                    ProductServiceId = p.Id,
                    ProductName = p.Name,
                    SKU = p.SKU,
                    Category = p.Category,
                    Type = p.Type,
                    CurrentStock = p.CurrentStock,
                    ReorderPoint = p.ReorderPoint,
                    MinimumStock = p.MinimumStock,
                    MaximumStock = p.MaximumStock,
                    UnitOfMeasure = p.UnitOfMeasure,
                    DefaultUnitPrice = p.DefaultUnitPrice,
                    CostPrice = p.CostPrice,
                    StockValue = p.CurrentStock * (p.CostPrice ?? p.DefaultUnitPrice),
                    WarehouseName = p.Warehouse?.Name,
                    WarehouseId = p.WarehouseId,
                    SupplierName = p.Supplier?.Name,
                    SupplierId = p.SupplierId,
                    StockStatus = p.CurrentStock <= 0 ? "OutOfStock"
                        : (p.ReorderPoint.HasValue && p.CurrentStock <= p.ReorderPoint) ? "LowStock"
                        : (p.MaximumStock.HasValue && p.CurrentStock > p.MaximumStock) ? "Overstock"
                        : "InStock"
                }).ToList();

                var report = new InventoryValuationDto
                {
                    TotalStockValue = items.Sum(i => i.StockValue),
                    TotalRetailValue = items.Sum(i => i.CurrentStock * i.DefaultUnitPrice),
                    TotalProducts = items.Count,
                    TrackedProducts = items.Count(i => i.CurrentStock > 0),
                    LowStockCount = items.Count(i => i.StockStatus == "LowStock"),
                    OutOfStockCount = items.Count(i => i.StockStatus == "OutOfStock"),
                    OverstockCount = items.Count(i => i.StockStatus == "Overstock"),
                    Items = items
                };

                return Ok(report);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating valuation report");
                return StatusCode(500, new { error = "Failed to generate valuation report" });
            }
        }

        /// <summary>
        /// GET api/inventory/reports/turnover — Stock turnover report
        /// </summary>
        [HttpGet("reports/turnover")]
        public async Task<ActionResult> GetTurnoverReport([FromQuery] int days = 90)
        {
            try
            {
                var since = _time.GetUtcNow().DateTime.AddDays(-days);

                var products = await _context.ProductServices
                    .AsNoTracking()
                    .Where(p => p.IsStockTracked)
                    .ToListAsync();

                var movements = await _context.StockMovements
                    .AsNoTracking()
                    .Where(m => m.Date >= since)
                    .ToListAsync();

                var lastMovements = await _context.StockMovements
                    .AsNoTracking()
                    .GroupBy(m => m.ProductServiceId)
                    .Select(g => new { ProductId = g.Key, LastDate = g.Max(m => m.Date) })
                    .ToListAsync();

                var now = _time.GetUtcNow().DateTime;

                var turnover = products.Select(p =>
                {
                    var productMovements = movements.Where(m => m.ProductServiceId == p.Id).ToList();
                    var totalSold = productMovements.Where(m => m.MovementType == "Out").Sum(m => m.Quantity);
                    var avgStock = p.CurrentStock; // Simplified: use current stock as average
                    var rate = avgStock > 0 ? totalSold / avgStock : 0;
                    var lastMove = lastMovements.FirstOrDefault(lm => lm.ProductId == p.Id);
                    var daysSinceLast = lastMove != null ? (int)(now - lastMove.LastDate).TotalDays : days;

                    return new StockTurnoverDto
                    {
                        ProductServiceId = p.Id,
                        ProductName = p.Name,
                        SKU = p.SKU,
                        TotalSold = totalSold,
                        AverageStock = avgStock,
                        TurnoverRate = rate,
                        DaysSinceLastMovement = daysSinceLast,
                        IsDeadStock = daysSinceLast >= days && p.CurrentStock > 0
                    };
                })
                .OrderByDescending(t => t.TurnoverRate)
                .ToList();

                return Ok(turnover);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating turnover report");
                return StatusCode(500, new { error = "Failed to generate turnover report" });
            }
        }

        /// <summary>
        /// GET api/inventory/reports/summary — Summary for dashboard widgets
        /// </summary>
        [HttpGet("reports/summary")]
        public async Task<ActionResult> GetInventorySummary()
        {
            try
            {
                var products = await _context.ProductServices
                    .AsNoTracking()
                    .Where(p => p.IsStockTracked)
                    .ToListAsync();

                var unresolvedAlerts = await _context.StockAlerts.CountAsync(a => !a.IsResolved);
                var unreadAlerts = await _context.StockAlerts.CountAsync(a => !a.IsRead && !a.IsResolved);

                var totalValue = products.Sum(p => p.CurrentStock * (p.CostPrice ?? p.DefaultUnitPrice));
                var totalRetailValue = products.Sum(p => p.CurrentStock * p.DefaultUnitPrice);
                var lowStock = products.Count(p => p.ReorderPoint.HasValue && p.CurrentStock > 0 && p.CurrentStock <= p.ReorderPoint);
                var outOfStock = products.Count(p => p.CurrentStock <= 0);

                // Recent movements (last 30 days)
                var since30 = _time.GetUtcNow().DateTime.AddDays(-30);
                var recentMovements = await _context.StockMovements
                    .Where(m => m.Date >= since30)
                    .GroupBy(m => m.MovementType)
                    .Select(g => new { type = g.Key, count = g.Count(), totalQty = g.Sum(m => m.Quantity) })
                    .ToListAsync();

                var pendingPOs = await _context.PurchaseOrders
                    .CountAsync(po => po.Status == "Draft" || po.Status == "Sent" || po.Status == "PartiallyReceived");

                return Ok(new
                {
                    totalProducts = products.Count,
                    totalStockValue = totalValue,
                    totalRetailValue,
                    lowStockCount = lowStock,
                    outOfStockCount = outOfStock,
                    unresolvedAlerts,
                    unreadAlerts,
                    pendingPurchaseOrders = pendingPOs,
                    recentMovements
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching inventory summary");
                return StatusCode(500, new { error = "Failed to fetch inventory summary" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PRIVATE HELPERS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Check if a product needs stock alerts and generate them if needed
        /// </summary>
        private async Task<int> CheckAndGenerateAlerts(ProductService product)
        {
            int count = 0;

            // Out of stock
            if (product.CurrentStock <= 0)
            {
                var existing = await _context.StockAlerts
                    .FirstOrDefaultAsync(a => a.ProductServiceId == product.Id && a.AlertType == "OutOfStock" && !a.IsResolved);
                if (existing == null)
                {
                    _context.StockAlerts.Add(new StockAlert
                    {
                        ProductServiceId = product.Id,
                        AlertType = "OutOfStock",
                        Threshold = 0,
                        CurrentQuantity = product.CurrentStock
                    });
                    count++;
                }
            }
            // Low stock
            else if (product.ReorderPoint.HasValue && product.CurrentStock <= product.ReorderPoint)
            {
                var existing = await _context.StockAlerts
                    .FirstOrDefaultAsync(a => a.ProductServiceId == product.Id && a.AlertType == "LowStock" && !a.IsResolved);
                if (existing == null)
                {
                    _context.StockAlerts.Add(new StockAlert
                    {
                        ProductServiceId = product.Id,
                        AlertType = "LowStock",
                        Threshold = product.ReorderPoint.Value,
                        CurrentQuantity = product.CurrentStock
                    });
                    count++;
                }
            }
            else
            {
                // Resolve old alerts if stock is now above threshold
                var oldAlerts = await _context.StockAlerts
                    .Where(a => a.ProductServiceId == product.Id && !a.IsResolved && (a.AlertType == "LowStock" || a.AlertType == "OutOfStock"))
                    .ToListAsync();
                foreach (var alert in oldAlerts)
                {
                    alert.IsResolved = true;
                    alert.ResolvedAt = _time.GetUtcNow().DateTime;
                }
            }

            // Overstock
            if (product.MaximumStock.HasValue && product.CurrentStock > product.MaximumStock)
            {
                var existing = await _context.StockAlerts
                    .FirstOrDefaultAsync(a => a.ProductServiceId == product.Id && a.AlertType == "Overstock" && !a.IsResolved);
                if (existing == null)
                {
                    _context.StockAlerts.Add(new StockAlert
                    {
                        ProductServiceId = product.Id,
                        AlertType = "Overstock",
                        Threshold = product.MaximumStock.Value,
                        CurrentQuantity = product.CurrentStock
                    });
                    count++;
                }
            }

            return count;
        }
    }
}
