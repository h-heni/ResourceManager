using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;

namespace ResourceManager.Services
{
    /// <summary>
    /// Service for automatic stock operations triggered by business events
    /// (invoice creation, delivery, supplier invoice confirmation).
    /// </summary>
    public class InventoryService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<InventoryService> _logger;

        public InventoryService(AppDbContext context, ILogger<InventoryService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Validate that all stock-tracked products in an invoice have sufficient stock.
        /// Returns a list of products with insufficient stock, or empty if all OK.
        /// </summary>
        public async Task<List<(int ProductId, string ProductName, decimal Requested, decimal Available)>> ValidateStockForInvoiceAsync(
            List<(int? ProductServiceId, int Quantity)> items)
        {
            var insufficientStock = new List<(int ProductId, string ProductName, decimal Requested, decimal Available)>();

            var productIds = items
                .Where(i => i.ProductServiceId.HasValue && i.Quantity > 0)
                .Select(i => i.ProductServiceId!.Value)
                .Distinct()
                .ToList();

            if (!productIds.Any()) return insufficientStock;

            var products = await _context.ProductServices
                .Where(p => productIds.Contains(p.Id) && p.IsStockTracked)
                .ToDictionaryAsync(p => p.Id);

            // Aggregate quantities per product (an invoice may have multiple lines for same product)
            var qtyPerProduct = items
                .Where(i => i.ProductServiceId.HasValue && i.Quantity > 0)
                .GroupBy(i => i.ProductServiceId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(x => (decimal)x.Quantity));

            foreach (var (productId, totalQty) in qtyPerProduct)
            {
                if (!products.TryGetValue(productId, out var product)) continue;
                if (product.CurrentStock < totalQty)
                {
                    insufficientStock.Add((productId, product.Name, totalQty, product.CurrentStock));
                }
            }

            return insufficientStock;
        }

        /// <summary>
        /// Deduct stock for all stock-tracked items in an invoice.
        /// Called when an invoice is created (stock-out on sale).
        /// </summary>
        public async Task DeductStockForInvoiceAsync(int invoiceId, string invoiceNumber)
        {
            var items = await _context.InvoiceItems
                .Where(i => i.InvoiceId == invoiceId && i.ProductServiceId != null)
                .Include(i => i.ProductService)
                .ToListAsync();

            _logger.LogInformation("DeductStockForInvoice: Invoice {Id} ({Number}) — found {Count} items with ProductServiceId",
                invoiceId, invoiceNumber, items.Count);

            foreach (var item in items)
            {
                if (item.ProductService == null) continue;

                // Skip products that are not inventory-tracked
                if (!item.ProductService.IsStockTracked) continue;

                var qty = item.Quantity ?? 0;
                if (qty <= 0) continue;

                item.ProductService.CurrentStock -= qty;

                _context.StockMovements.Add(new StockMovement
                {
                    ProductServiceId = item.ProductServiceId!.Value,
                    MovementType = "Out",
                    Quantity = qty,
                    UnitCost = item.Price,
                    StockAfter = item.ProductService.CurrentStock,
                    ReferenceType = "Invoice",
                    ReferenceId = invoiceId,
                    ReferenceNumber = invoiceNumber,
                    Date = DateTime.UtcNow,
                    Notes = $"Auto-deducted on invoice {invoiceNumber}",
                    WarehouseId = item.ProductService.WarehouseId
                });

                _logger.LogInformation("Stock deducted: Product {ProductId} ({Name}) -{Qty} for invoice {Number}. New stock: {Stock}",
                    item.ProductServiceId, item.ProductService.Name, qty, invoiceNumber, item.ProductService.CurrentStock);

                try
                {
                    await CheckAndGenerateAlerts(item.ProductService);
                }
                catch (Exception alertEx)
                {
                    _logger.LogWarning(alertEx, "Alert generation failed for product {ProductId} — stock deduction will still proceed.", item.ProductServiceId);
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("DeductStockForInvoice: SaveChanges completed for invoice {Number}", invoiceNumber);
        }

        /// <summary>
        /// Deduct stock for all stock-tracked items in a delivery note.
        /// Called when a delivery note is created (goods shipped).
        /// </summary>
        public async Task DeductStockForDeliveryNoteAsync(int deliveryNoteId, string deliveryNoteNumber)
        {
            var items = await _context.DeliveryNoteItems
                .Where(i => i.DeliveryNoteId == deliveryNoteId && i.ProductServiceId != null)
                .Include(i => i.ProductService)
                .ToListAsync();

            foreach (var item in items)
            {
                if (item.ProductService == null) continue;

                // Skip products that are not inventory-tracked
                if (!item.ProductService.IsStockTracked) continue;

                var qty = item.Quantity ?? 0;
                if (qty <= 0) continue;

                item.ProductService.CurrentStock -= qty;

                _context.StockMovements.Add(new StockMovement
                {
                    ProductServiceId = item.ProductServiceId!.Value,
                    MovementType = "Out",
                    Quantity = qty,
                    StockAfter = item.ProductService.CurrentStock,
                    ReferenceType = "DeliveryNote",
                    ReferenceId = deliveryNoteId,
                    ReferenceNumber = deliveryNoteNumber,
                    Date = DateTime.UtcNow,
                    Notes = $"Auto-deducted on delivery note {deliveryNoteNumber}",
                    WarehouseId = item.ProductService.WarehouseId
                });

                _logger.LogInformation("Stock deducted: Product {ProductId} ({Name}) -{Qty} for DN {Number}. New stock: {Stock}",
                    item.ProductServiceId, item.ProductService.Name, qty, deliveryNoteNumber, item.ProductService.CurrentStock);

                await CheckAndGenerateAlerts(item.ProductService);
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Add stock for all stock-tracked items in a supplier invoice.
        /// Called when a supplier invoice is confirmed (goods received).
        /// </summary>
        public async Task AddStockForSupplierInvoiceAsync(int supplierInvoiceId, string invoiceNumber)
        {
            var items = await _context.SupplierInvoiceItems
                .Where(i => i.SupplierInvoiceId == supplierInvoiceId && i.ProductServiceId != null)
                .Include(i => i.ProductService)
                .ToListAsync();

            foreach (var item in items)
            {
                if (item.ProductService == null) continue;

                // Skip products that are not inventory-tracked
                if (!item.ProductService.IsStockTracked) continue;

                var qty = item.Quantity;
                if (qty <= 0) continue;

                item.ProductService.CurrentStock += qty;

                _context.StockMovements.Add(new StockMovement
                {
                    ProductServiceId = item.ProductServiceId!.Value,
                    MovementType = "In",
                    Quantity = qty,
                    UnitCost = item.UnitPrice,
                    StockAfter = item.ProductService.CurrentStock,
                    ReferenceType = "SupplierInvoice",
                    ReferenceId = supplierInvoiceId,
                    ReferenceNumber = invoiceNumber,
                    Date = DateTime.UtcNow,
                    Notes = $"Auto-added on supplier invoice {invoiceNumber}",
                    WarehouseId = item.ProductService.WarehouseId
                });

                _logger.LogInformation("Stock added: Product {ProductId} ({Name}) +{Qty} from supplier invoice {Number}. New stock: {Stock}",
                    item.ProductServiceId, item.ProductService.Name, qty, invoiceNumber, item.ProductService.CurrentStock);

                await CheckAndGenerateAlerts(item.ProductService);
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Reverse stock for a deleted/cancelled invoice (re-add stock).
        /// </summary>
        public async Task ReverseStockForInvoiceAsync(int invoiceId, string invoiceNumber)
        {
            var items = await _context.InvoiceItems
                .Where(i => i.InvoiceId == invoiceId && i.ProductServiceId != null)
                .Include(i => i.ProductService)
                .ToListAsync();

            foreach (var item in items)
            {
                if (item.ProductService == null || !item.ProductService.IsStockTracked) continue;

                var qty = item.Quantity ?? 0;
                if (qty <= 0) continue;

                item.ProductService.CurrentStock += qty;

                _context.StockMovements.Add(new StockMovement
                {
                    ProductServiceId = item.ProductServiceId!.Value,
                    MovementType = "Return",
                    Quantity = qty,
                    StockAfter = item.ProductService.CurrentStock,
                    ReferenceType = "Invoice",
                    ReferenceId = invoiceId,
                    ReferenceNumber = invoiceNumber,
                    Date = DateTime.UtcNow,
                    Notes = $"Stock reversed — invoice {invoiceNumber} deleted/cancelled",
                    WarehouseId = item.ProductService.WarehouseId
                });

                await CheckAndGenerateAlerts(item.ProductService);
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Check if a product needs stock alerts and generate them
        /// </summary>
        private async Task CheckAndGenerateAlerts(ProductService product)
        {
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
                }
            }
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
                }
            }
            else
            {
                var oldAlerts = await _context.StockAlerts
                    .Where(a => a.ProductServiceId == product.Id && !a.IsResolved && (a.AlertType == "LowStock" || a.AlertType == "OutOfStock"))
                    .ToListAsync();
                foreach (var alert in oldAlerts)
                {
                    alert.IsResolved = true;
                    alert.ResolvedAt = DateTime.UtcNow;
                }
            }
        }
    }
}
