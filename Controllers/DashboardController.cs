using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using Microsoft.AspNetCore.Authorization;

namespace ResourceManager.Controllers
{
    public class DashboardController : BaseApiController
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/dashboard/stats
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var now = DateTime.UtcNow;
            var startOfYear = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);

            // Load all invoices for client-side aggregation (SQLite doesn't support Sum on decimal)
            var allInvoices = await _context.Invoices
                .Include(i => i.Payments)
                .ToListAsync();

            // Total Revenue (Paid Invoices)
            var paidInvoices = allInvoices.Where(i => i.Status == "Paid" || i.Treated == true).ToList();
            var totalRevenue = paidInvoices.Sum(i => i.TotalAmount ?? 0);

            // Unpaid Invoices Count and Amount
            var unpaidInvoicesList = allInvoices.Where(i => (i.Status == "Unpaid" || i.Status == "Draft") && !i.Treated).ToList();
            var unpaidInvoices = unpaidInvoicesList.Count;
            var unpaidAmount = unpaidInvoicesList.Sum(i => i.TotalAmount ?? 0);

            // Partially Paid
            var partiallyPaidList = allInvoices.Where(i => i.Status == "PartiallyPaid").ToList();
            var partiallyPaidCount = partiallyPaidList.Count;
            var partiallyPaidAmount = partiallyPaidList.Sum(i => i.RemainingAmount);

            // Pending Payments (Scheduled future payments)
            var pendingPayments = allInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Pending")
                .ToList();
            var pendingPaymentsCount = pendingPayments.Count;
            var pendingPaymentsAmount = pendingPayments.Sum(p => p.Amount);

            // Due Payments (waiting for confirmation)
            var duePayments = allInvoices
                .SelectMany(i => i.Payments ?? new List<Payment>())
                .Where(p => p.Status == "Due")
                .ToList();
            var duePaymentsCount = duePayments.Count;
            var duePaymentsAmount = duePayments.Sum(p => p.Amount);

            // Revenue Chart (Group by Month for current year)
            var yearInvoices = paidInvoices.Where(i => i.Date >= startOfYear).ToList();
            var revenueData = yearInvoices
                .GroupBy(i => i.Date.Month)
                .Select(g => new {
                    Month = g.Key,
                    Amount = g.Sum(i => i.TotalAmount ?? 0)
                })
                .ToList();

            var chart = Enumerable.Range(1, 12).Select(month => new {
                month,
                amount = revenueData.FirstOrDefault(r => r.Month == month)?.Amount ?? 0
            }).ToList();

            // Monthly comparison (this month vs last month)
            var thisMonth = allInvoices.Where(i => i.Date.Year == now.Year && i.Date.Month == now.Month).ToList();
            var lastMonth = allInvoices.Where(i => 
                (now.Month > 1 && i.Date.Year == now.Year && i.Date.Month == now.Month - 1) ||
                (now.Month == 1 && i.Date.Year == now.Year - 1 && i.Date.Month == 12)
            ).ToList();
            
            var thisMonthRevenue = thisMonth.Where(i => i.Status == "Paid" || i.Treated).Sum(i => i.TotalAmount ?? 0);
            var lastMonthRevenue = lastMonth.Where(i => i.Status == "Paid" || i.Treated).Sum(i => i.TotalAmount ?? 0);

            // Client stats
            var activeClients = await _context.Clients.CountAsync();

            // Supplier stats
            var totalSuppliers = await _context.Fournisseurs.CountAsync();
            var supplierInvoices = await _context.FournisseurInvoices.CountAsync();

            // Invoice status breakdown
            var statusBreakdown = allInvoices
                .GroupBy(i => i.Status)
                .Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(i => i.TotalAmount ?? 0) })
                .ToList();

            // Top clients by revenue
            var topClients = allInvoices
                .Where(i => i.ClientId.HasValue)
                .GroupBy(i => i.ClientId)
                .Select(g => new {
                    clientId = g.Key,
                    clientName = g.First().Client?.Name ?? "Unknown",
                    totalInvoices = g.Count(),
                    totalAmount = g.Sum(i => i.TotalAmount ?? 0),
                    paidAmount = g.Where(i => i.Status == "Paid" || i.Treated).Sum(i => i.TotalAmount ?? 0)
                })
                .OrderByDescending(c => c.totalAmount)
                .Take(5)
                .ToList();

            return Ok(new {
                totalRevenue,
                unpaidInvoices,
                unpaidAmount,
                partiallyPaidCount,
                partiallyPaidAmount,
                pendingPaymentsCount,
                pendingPaymentsAmount,
                duePaymentsCount,
                duePaymentsAmount,
                revenueChart = chart,
                thisMonthRevenue,
                lastMonthRevenue,
                activeClients,
                totalSuppliers,
                supplierInvoices,
                statusBreakdown,
                topClients,
                totalInvoiceCount = allInvoices.Count,
                paidInvoiceCount = paidInvoices.Count
            });
        }
    }
}
