using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;
using ResourceManager.Services;
using Microsoft.AspNetCore.Identity;
using QuestPDF.Fluent;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace ResourceManager.Controllers
{
    public class InvoicesController : BaseApiController
    {
        private const string InvoiceNumberPrefix = "FA";
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<InvoicesController> _logger;
        private readonly IEmailService _emailService;
        private readonly ILocalPdfStorageService _pdfStorageService;
        
        public InvoicesController(
            AppDbContext context, 
            UserManager<ApplicationUser> userManager, 
            ILogger<InvoicesController> logger,
            IEmailService emailService,
            ILocalPdfStorageService pdfStorageService)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _emailService = emailService;
            _pdfStorageService = pdfStorageService;
        }

        // GET: api/invoices
        [HttpGet]
        public async Task<IActionResult> GetInvoices([FromQuery] int page = 1, [FromQuery] int size = 20, [FromQuery] bool includePaid = true)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.Invoices
                    .AsNoTracking()
                    .Include(i => i.Client)
                    .Include(i => i.Payments)
                    .Include(i => i.Devis)
                    .AsQueryable();

                if (!includePaid)
                {
                    query = query.Where(i => i.Status != "Paid");
                }

                query = query.OrderByDescending(i => i.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                // Load data first, then aggregate client-side (SQLite doesn't support Sum on decimal)
                var rawInvoices = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .ToListAsync();

                var invoices = rawInvoices.Select(i => {
                    var payments = i.Payments ?? new List<Payment>();
                    var amountPaid = payments.Where(p => p.Status == "Completed").Sum(p => p.Amount);
                    var pendingAmount = payments.Where(p => p.Status == "Pending").Sum(p => p.Amount);
                    
                    return new {
                        i.Id,
                        i.Number,
                        InvoiceNumber = i.Number,
                        i.Date,
                        i.DueDate,
                        ClientName = i.Client?.Name ?? "Unknown",
                        ClientEmail = i.Client?.Email,
                        i.TotalAmount,
                        Status = i.Treated ? "Archived" : i.Status,
                        i.IsLocked,
                        i.Treated,
                        i.DevisId,
                        i.SourceDevisNumber,
                        Currency = i.Devis?.Currency,
                        CurrencySymbol = i.Devis?.CurrencySymbol,
                        PdfLanguage = i.Devis?.PdfLanguage,
                        AmountPaid = amountPaid,
                        PendingAmount = pendingAmount,
                        RemainingAmount = Math.Max(0, (i.TotalAmount ?? 0) - (amountPaid + pendingAmount)),
                        // Progress: cast to double BEFORE division to avoid integer division truncation
                        Progress = (i.TotalAmount ?? 0) > 0
                            ? Math.Min(100.0, (double)amountPaid / (double)(i.TotalAmount ?? 0) * 100.0)
                            : 0.0,
                        IsOverdue = i.DueDate.HasValue && i.DueDate.Value < DateTime.UtcNow && i.Status != "Paid",
                        DaysUntilDue = i.DueDate.HasValue ? (int)(i.DueDate.Value - DateTime.UtcNow).TotalDays : (int?)null,
                        Payments = payments.Select(p => new {
                            p.Id,
                            p.Amount,
                            p.PaymentDate,
                            p.Notes,
                            p.Status
                        }).OrderByDescending(p => p.PaymentDate).ToList()
                    };
                }).ToList();

                return Ok(new {
                    Data = invoices,
                    Items = invoices,
                    Page = page,
                    Size = size,
                    PageSize = size,
                    TotalCount = totalCount,
                    TotalPages = totalPages
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching invoices");
                // Return empty result instead of 500 error
                return Ok(new {
                    Data = Array.Empty<object>(),
                    Page = page,
                    Size = size,
                    TotalCount = 0,
                    TotalPages = 0
                });
            }
        }

        // GET: api/invoices/archived/count?year=2026
        [HttpGet("archived/count")]
        public async Task<IActionResult> GetArchivedInvoicesCount([FromQuery] int? year = null)
        {
            try
            {
                var userId = _userManager.GetUserId(User);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                    return Unauthorized();

                var selectedYear = year ?? DateTime.UtcNow.Year;

                // Count archived invoices (Treated == true)
                var archivedInvoiceCount = await _context.Invoices
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(i => i.Treated == true && i.CompanyId == user.CompanyId)
                    .Where(i => i.Date.Year == selectedYear)
                    .CountAsync();

                // Count historical (imported) revenues for the same year
                var historicalRevenueCount = await _context.HistoricalRevenues
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(h => h.CompanyId == user.CompanyId && h.Date.Year == selectedYear)
                    .CountAsync();

                return Ok(new
                {
                    count = archivedInvoiceCount + historicalRevenueCount,
                    year = selectedYear
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching archived invoices count for year {Year}", year);
                return StatusCode(500, new { message = "Failed to retrieve archived invoices count" });
            }
        }

        // GET: api/invoices/last-number - Get the last invoice number for suggestion
        [HttpGet("last-number")]
        public async Task<IActionResult> GetLastInvoiceNumber()
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var year = DateTime.UtcNow.Year;
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"{InvoiceNumberPrefix}{yearSuffix}-";

            var yearNumbers = await _context.Invoices
                .AsNoTracking()
                .Where(i => i.CompanyId == user.CompanyId && i.Date.Year == year && i.Number.StartsWith(prefix))
                .Select(i => i.Number)
                .ToListAsync();

            var nextSequence = 1;
            foreach (var number in yearNumbers)
            {
                var match = Regex.Match(number, $"^{Regex.Escape(prefix)}(\\d+)$", RegexOptions.IgnoreCase);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var sequence))
                {
                    nextSequence = Math.Max(nextSequence, sequence + 1);
                }
            }

            var lastNumber = nextSequence > 1 ? $"{prefix}{(nextSequence - 1):D3}" : string.Empty;
            var suggestedNumber = $"{prefix}{nextSequence:D3}";

            return Ok(new { lastNumber, suggestedNumber });
        }

        /// <summary>
        /// Get overdue invoices for notifications
        /// </summary>
        [HttpGet("overdue")]
        public async Task<IActionResult> GetOverdueInvoices()
        {
            // Load data first, then aggregate client-side (SQLite doesn't support Sum on decimal)
            var rawInvoices = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Client)
                .Include(i => i.Payments)
                .Where(i => i.DueDate.HasValue && i.DueDate.Value < DateTime.UtcNow && i.Status != "Paid")
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            var overdueInvoices = rawInvoices.Select(i => new {
                i.Id,
                i.Number,
                i.Date,
                i.DueDate,
                DaysOverdue = (int)(DateTime.UtcNow - i.DueDate!.Value).TotalDays,
                ClientName = i.Client?.Name ?? "Unknown",
                ClientEmail = i.Client?.Email,
                i.TotalAmount,
                i.Status,
                AmountPaid = i.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0,
                PendingAmount = i.Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0,
                RemainingAmount = Math.Max(0, (i.TotalAmount ?? 0) - ((i.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0) + (i.Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0)))
            }).ToList();

            return Ok(overdueInvoices);
        }

        /// <summary>
        /// Get invoices due within the next N days for notifications
        /// </summary>
        [HttpGet("due-soon")]
        public async Task<IActionResult> GetInvoicesDueSoon([FromQuery] int days = 7)
        {
            var now = DateTime.UtcNow;
            var futureDate = now.AddDays(days);

            // Load data first, then aggregate client-side (SQLite doesn't support Sum on decimal)
            var rawInvoices = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Client)
                .Include(i => i.Payments)
                .Where(i => i.DueDate.HasValue && i.DueDate.Value >= now && i.DueDate.Value <= futureDate && i.Status != "Paid")
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            var dueSoonInvoices = rawInvoices.Select(i => new {
                i.Id,
                i.Number,
                i.Date,
                i.DueDate,
                DaysUntilDue = (int)(i.DueDate!.Value - DateTime.UtcNow).TotalDays,
                ClientName = i.Client?.Name ?? "Unknown",
                ClientEmail = i.Client?.Email,
                i.TotalAmount,
                i.Status,
                AmountPaid = i.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0,
                PendingAmount = i.Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0,
                RemainingAmount = Math.Max(0, (i.TotalAmount ?? 0) - ((i.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0) + (i.Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0)))
            }).ToList();

            return Ok(dueSoonInvoices);
        }

        // GET: api/invoices/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetInvoice(int id)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Client)
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            return Ok(invoice);
        }

        // GET: api/invoices/{id}/details - Detailed invoice with related documents
        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetInvoiceDetails(int id)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Client)
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .Include(i => i.CreatedByUser)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            // Get related devis if exists
            object? relatedDevis = null;
            if (invoice.DevisId.HasValue)
            {
                var devis = await _context.Devis
                    .Include(d => d.Client)
                    .FirstOrDefaultAsync(d => d.Id == invoice.DevisId.Value);
                if (devis != null)
                {
                    relatedDevis = new
                    {
                        devis.Id,
                        devis.Number,
                        devis.Date,
                        totalAmount = devis.TotalAmount,
                        status = devis.Status ?? "Draft"
                    };
                }
            }

            // Get related delivery notes
            var relatedDeliveryNotes = await _context.DeliveryNotes
                .Where(d => d.InvoiceId == id || d.ClientId == invoice.ClientId)
                .Select(d => new
                {
                    d.Id,
                    d.Number,
                    d.Date,
                    status = "Delivered"
                })
                .ToListAsync();

            // Calculate totals from items
            decimal totalHT = invoice.InvoiceItems.Sum(i => (i.Quantity ?? 0) * (i.Price ?? 0));
            decimal totalTVA = invoice.InvoiceItems.Sum(i => i.ItemTaxAmount);
            // Fallback: if computed TVA is 0 but stored TaxAmount is not, use stored value
            // (for existing invoice items created before Tva column was persisted)
            if (totalTVA == 0 && (invoice.TaxAmount ?? 0) > 0)
            {
                totalTVA = invoice.TaxAmount ?? 0;
            }
            decimal amountPaid = invoice.Payments?.Where(p => p.Status == "Completed").Sum(p => p.Amount) ?? 0;
            decimal pendingAmount = invoice.Payments?.Where(p => p.Status == "Pending").Sum(p => p.Amount) ?? 0;

            // Audit Trail: Resolve User Names
            var userIds = new HashSet<string>();
            if (invoice.Payments != null)
            {
                foreach (var p in invoice.Payments)
                {
                    if (!string.IsNullOrEmpty(p.CreatedByUserId)) userIds.Add(p.CreatedByUserId);
                    if (!string.IsNullOrEmpty(p.ConfirmedByUserId)) userIds.Add(p.ConfirmedByUserId);
                }
            }
            if (!string.IsNullOrEmpty(invoice.TreatedByUserId)) userIds.Add(invoice.TreatedByUserId);

            var userMap = new Dictionary<string, string>();
            if (userIds.Any())
            {
                var users = await _context.Users.AsNoTracking()
                    .Include(u => u.Profile)
                    .Where(u => userIds.Contains(u.Id))
                    .Select(u => new { u.Id, Name = (u.Profile != null ? (u.Profile.FirstName + " " + u.Profile.LastName).Trim() : null) ?? u.UserName ?? u.Email })
                    .ToListAsync();
                foreach(var u in users) userMap[u.Id] = u.Name ?? "Unknown";
            }

            return Ok(new
            {
                invoice.Id,
                invoice.Number,
                InvoiceNumber = invoice.Number,
                invoice.Date,
                invoice.DueDate,
                totalAmount = invoice.TotalAmount,
                totalHT,
                totalTVA,
                timbreFiscal = invoice.Tfiscal,
                clientId = invoice.ClientId,
                clientName = invoice.Client?.Name,
                clientAddress = invoice.Client?.Address,
                clientEmail = invoice.Client?.Email,
                clientPhone = invoice.Client?.Phone,
                Status = invoice.Treated ? "Archived" : invoice.Status,
                invoice.IsLocked,
                invoice.Treated,
                TreatedBy = (!string.IsNullOrEmpty(invoice.TreatedByUserId) && userMap.ContainsKey(invoice.TreatedByUserId)) ? userMap[invoice.TreatedByUserId] : null,
                TreatedAt = invoice.TreatedAt,
                Currency = invoice.Devis?.Currency,
                CurrencySymbol = invoice.Devis?.CurrencySymbol,
                PdfLanguage = invoice.Devis?.PdfLanguage,
                amountPaid,
                pendingAmount,
                remainingAmount = Math.Max(0, (invoice.TotalAmount ?? 0) - (amountPaid + pendingAmount)),
                // Progress: cast to double BEFORE division to avoid integer division truncation
                Progress = (invoice.TotalAmount ?? 0) > 0
                    ? Math.Min(100.0, (double)amountPaid / (double)(invoice.TotalAmount ?? 0) * 100.0)
                    : 0.0,
                payments = invoice.Payments?.Select(p => new
                {
                    p.Id,
                    p.Amount,
                    p.PaymentDate,
                    p.Notes,
                    p.Status,
                    p.IsScheduled,
                    ConfirmedBy = (p.ConfirmedByUserId != null && userMap.ContainsKey(p.ConfirmedByUserId)) ? userMap[p.ConfirmedByUserId] : null,
                    handledByName = (p.ConfirmedByUserId != null && userMap.ContainsKey(p.ConfirmedByUserId)) ? userMap[p.ConfirmedByUserId] : ((p.CreatedByUserId != null && userMap.ContainsKey(p.CreatedByUserId)) ? userMap[p.CreatedByUserId] : null),
                    ConfirmedAt = p.ConfirmedAt,
                    CreatedBy = (p.CreatedByUserId != null && userMap.ContainsKey(p.CreatedByUserId)) ? userMap[p.CreatedByUserId] : null
                }).OrderByDescending(p => p.PaymentDate).ToList(),
                items = invoice.InvoiceItems.Select(i => new
                {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    unitPrice = i.Price,
                    totalPrice = i.TotalItemHT,
                    vat = i.TaxRate
                }).ToList(),
                devisId = invoice.DevisId,
                sourceDevisNumber = invoice.SourceDevisNumber,
                relatedDevis,
                relatedDeliveryNotes,
                invoice.CreatedAt,
                invoice.UpdatedAt,
                createdByUserName = invoice.CreatedByUser?.Email
            });
        }

        // POST: api/invoices
        [HttpPost]
        public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceDto dto)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                _logger.LogWarning("CreateInvoice ModelState invalid: {Errors}", string.Join("; ", errors));
                return BadRequest(ModelState);
            }

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();
            
            // Get company settings for custom tax
            var companySettings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            var userProvidedNumber = dto.Number?.Trim() ?? string.Empty;
            var isAutoNumber = string.IsNullOrWhiteSpace(userProvidedNumber);

            string? sourceDevisNumber = null;
            if (dto.DevisId.HasValue && dto.DevisId.Value > 0)
            {
                var linkedDevis = await _context.Devis
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.Id == dto.DevisId.Value);

                if (linkedDevis == null)
                {
                    return BadRequest(new { message = "Linked quote was not found." });
                }

                sourceDevisNumber = linkedDevis.Number;
            }

            // Retry loop for auto-numbered invoices (handles concurrent number collisions)
            var maxAttempts = isAutoNumber ? 5 : 1;
            Invoice? invoice = null;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var normalizedNumber = isAutoNumber
                    ? await GenerateNextInvoiceNumberAsync(user.CompanyId, dto.Date.ToUniversalTime().Year)
                    : userProvidedNumber;

                if (!isAutoNumber)
                {
                    var duplicateNumberExists = await _context.Invoices
                        .IgnoreQueryFilters()
                        .AnyAsync(i => i.CompanyId == user.CompanyId && i.Number == normalizedNumber);
                    if (duplicateNumberExists)
                    {
                        return Conflict(new { message = "Invoice number already exists for this company." });
                    }
                }

                invoice = new Invoice
                {
                    Number = normalizedNumber,
                    Date = dto.Date.ToUniversalTime(),
                    DueDate = dto.DueDate?.ToUniversalTime(),
                    ClientId = dto.ClientId,
                    DevisId = dto.DevisId,
                    SourceDevisNumber = sourceDevisNumber,
                    Tfiscal = companySettings?.CustomTaxEnabled == true ? companySettings.CustomTaxAmount : 0,
                    TfiscalName = companySettings?.CustomTaxName ?? "Timbre Fiscal",
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow,
                    Status = "Pending"
                };

                // Map Items
                foreach (var itemDto in dto.Items)
                {
                    invoice.InvoiceItems.Add(new InvoiceItem
                    {
                        Description = itemDto.Description,
                        Quantity = itemDto.Quantity,
                        Price = itemDto.Price,
                        Tva = itemDto.Tva,
                        VatRate = itemDto.Tva && itemDto.VatRate.HasValue ? itemDto.VatRate.Value / 100m : null
                    });
                }

                invoice.CalculTotalAmount();

                _context.Invoices.Add(invoice);
                try
                {
                    var strategy = _context.Database.CreateExecutionStrategy();
                    await strategy.ExecuteAsync(async () =>
                    {
                        await using var transaction = await _context.Database.BeginTransactionAsync();

                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Invoice {Number} created (ID={Id}, CompanyId={CompanyId})",
                            invoice.Number, invoice.Id, invoice.CompanyId);

                        // Link Delivery Notes if provided
                        if (dto.DeliveryNoteIds != null && dto.DeliveryNoteIds.Any())
                        {
                            var deliveryNotes = await _context.DeliveryNotes
                                .Where(dn => dto.DeliveryNoteIds.Contains(dn.Id))
                                .ToListAsync();

                            foreach (var dn in deliveryNotes)
                            {
                                dn.InvoiceId = invoice.Id;
                            }
                            await _context.SaveChangesAsync();
                        }

                        // Update Devis status to Completed when invoice is created
                        if (dto.DevisId.HasValue && dto.DevisId.Value > 0)
                        {
                            var devis = await _context.Devis.FindAsync(dto.DevisId.Value);
                            if (devis != null)
                            {
                                devis.Status = "Completed";
                                devis.Treated = true;
                                await _context.SaveChangesAsync();
                                _logger.LogInformation("Devis {DevisId} status updated to Completed after invoice creation.", dto.DevisId.Value);
                            }
                        }

                        await transaction.CommitAsync();
                    });
                    break; // Success — exit retry loop
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex) && isAutoNumber && attempt < maxAttempts)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogWarning(ex, "Invoice number collision for company {CompanyId}, retry {Attempt}", user.CompanyId, attempt);
                    invoice = null;
                    continue;
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
                {
                    _context.ChangeTracker.Clear();
                    return Conflict(new { message = "Invoice number already exists for this company." });
                }
                catch (DbUpdateException ex)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogError(ex, "DbUpdateException creating invoice. CompanyId={CompanyId}, ClientId={ClientId}, Number={Number}",
                        invoice.CompanyId, invoice.ClientId, invoice.Number);
                    return StatusCode(500, new { message = "Failed to save invoice. Check server logs for details.", detail = ex.InnerException?.Message ?? ex.Message });
                }
                catch (Exception ex)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogError(ex, "Unexpected error creating invoice. Number={Number}", invoice.Number);
                    return StatusCode(500, new { message = "Failed to create invoice.", detail = ex.InnerException?.Message ?? ex.Message });
                }
            } // end retry loop

            if (invoice == null || invoice.Id == 0)
            {
                return Conflict(new { message = "Failed to generate a unique invoice number. Please retry." });
            }

            // Return safe projection without sensitive user data
            return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, new {
                invoice.Id,
                invoice.Number,
                InvoiceNumber = invoice.Number,
                invoice.Date,
                invoice.DueDate,
                invoice.ClientId,
                invoice.DevisId,
                invoice.SourceDevisNumber,
                invoice.Status,
                invoice.SubTotal,
                invoice.TaxAmount,
                invoice.TotalAmount,
                invoice.Tfiscal,
                invoice.TfiscalName,
                invoice.AmountPaid,
                invoice.RemainingAmount,
                invoice.IsOverdue,
                invoice.DaysUntilDue,
                Currency = invoice.Devis?.Currency,
                CurrencySymbol = invoice.Devis?.CurrencySymbol,
                PdfLanguage = invoice.Devis?.PdfLanguage,
                InvoiceItems = invoice.InvoiceItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.Price,
                    i.Tva,
                    i.TotalItemHT,
                    i.ItemTaxAmount
                })
            });
        }

        // PUT: api/invoices/{id} - Manager/FreeUser only
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
        public async Task<IActionResult> UpdateInvoice(int id, [FromBody] UpdateInvoiceDto dto)
        {
             if (!ModelState.IsValid) return BadRequest(ModelState);

             var invoice = await _context.Invoices
                 .Include(i => i.InvoiceItems)
                 .FirstOrDefaultAsync(i => i.Id == id);

             if (invoice == null) return NotFound();

             // Logic: Block update if any payment has been made (IsLocked, Paid, or PartiallyPaid)
             if (invoice.IsLocked || invoice.Status == "Paid" || invoice.Status == "PartiallyPaid")
             {
                 return BadRequest("Invoice cannot be modified after payments have been registered.");
             }

             var normalizedNumber = dto.Number?.Trim() ?? string.Empty;
             if (string.IsNullOrWhiteSpace(normalizedNumber))
             {
                 return BadRequest(new { message = "Invoice number is required." });
             }

             var duplicateNumberExists = await _context.Invoices
                 .AnyAsync(i => i.Id != id && i.CompanyId == invoice.CompanyId && i.Number == normalizedNumber);
             if (duplicateNumberExists)
             {
                 return Conflict(new { message = "Invoice number already exists for this company." });
             }

             invoice.Number = normalizedNumber;
             invoice.Date = dto.Date.ToUniversalTime();
             invoice.DueDate = dto.DueDate?.ToUniversalTime();
             invoice.ClientId = dto.ClientId;
             
             // Update Items: Simple strategy - remove all and re-add. 
             // Production apps might want diffing, but for this task, replacement is standard for documents.
             _context.InvoiceItems.RemoveRange(invoice.InvoiceItems); // Removing old items
             
             invoice.InvoiceItems = dto.Items.Select(i => new InvoiceItem
             {
                 Description = i.Description,
                 Quantity = i.Quantity,
                 Price = i.Price,
                 Tva = i.Tva,
                 VatRate = i.Tva && i.VatRate.HasValue ? i.VatRate.Value / 100m : null,
                 InvoiceId = invoice.Id
             }).ToList();

             invoice.CalculTotalAmount();
             invoice.UpdatedAt = DateTime.UtcNow;

             await _context.SaveChangesAsync();

             return Ok(invoice);
        }
        
        // POST: api/invoices/{id}/payment - Add a payment to an invoice
        [HttpPost("{id}/payment")]
        public async Task<IActionResult> AddPayment(int id, [FromBody] AddPaymentDto dto)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Payments)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            // Immediate payments (PaymentDate <= now or null, Status = "Completed") are auto-confirmed.
            // Scheduled future payments default to "Pending" — must be manually approved.
            var paymentDate = dto.PaymentDate?.ToUniversalTime() ?? DateTime.UtcNow;
            var isImmediate = paymentDate <= DateTime.UtcNow.AddMinutes(1) && dto.Status == "Completed";
            var paymentStatus = isImmediate ? "Completed" : "Pending";

            // Calculate totals BEFORE adding the new payment to avoid double-counting
            // (EF Core adds the payment to navigation collection when we Add to context)
            var existingPaidCompleted = invoice.Payments.Where(p => p.Status == "Completed").Sum(p => p.Amount);
            var existingPending = invoice.Payments.Where(p => p.Status == "Pending").Sum(p => p.Amount);
            var totalAmount = invoice.TotalAmount ?? 0;

            // Now calculate totals including the new payment
            var totalPaidCompleted = existingPaidCompleted + (paymentStatus == "Completed" ? dto.Amount : 0);
            var totalPending = existingPending + (paymentStatus == "Pending" ? dto.Amount : 0);

            // Over-allocation guard: confirmed + pending must not exceed totalAmount
            if (totalPaidCompleted + totalPending > totalAmount && totalAmount > 0)
            {
                var maxAllowed = Math.Max(0, totalAmount - existingPaidCompleted - existingPending);
                return BadRequest(new { message = $"Payment would exceed invoice total. Maximum allowed: {maxAllowed:N3}" });
            }

            var payment = new Payment
            {
                Amount = dto.Amount,
                PaymentDate = paymentDate,
                Notes = dto.Notes,
                InvoiceId = id,
                CreatedByUserId = _userManager.GetUserId(User),
                CreatedAt = DateTime.UtcNow,
                Status = paymentStatus,
                // Auto-confirm immediate payments
                ConfirmedByUserId = isImmediate ? _userManager.GetUserId(User) : null,
                ConfirmedAt = isImmediate ? DateTime.UtcNow : null
            };

            _context.Payments.Add(payment);

            if (totalPaidCompleted >= totalAmount)
            {
                // Fully paid - update statuses
                invoice.Status = "Paid";
                invoice.Treated = true;
                invoice.TreatedByUserId = _userManager.GetUserId(User);
                invoice.TreatedAt = DateTime.UtcNow;
                
                // Update linked Devis to Completed
                if (invoice.Devis != null)
                {
                    invoice.Devis.Status = "Completed";
                    invoice.Devis.Treated = true;
                }

                // Update linked Delivery Notes to Completed
                var deliveryNotes = await _context.DeliveryNotes
                    .Where(dn => dn.InvoiceId == id)
                    .ToListAsync();
                foreach (var dn in deliveryNotes)
                {
                    dn.Treated = true;
                }

                _logger.LogInformation("Invoice {InvoiceId} fully paid. Status updated to Paid.", id);
            }
            else if (totalPaidCompleted > 0)
            {
                invoice.Status = "PartiallyPaid";
            }
            // If only pending payments, keep invoice status as Pending

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = paymentStatus == "Pending" 
                    ? "Scheduled payment added successfully." 
                    : "Payment recorded successfully.",
                amountPaid = totalPaidCompleted,
                pendingAmount = totalPending,
                remainingAmount = Math.Max(0, totalAmount - (totalPaidCompleted + totalPending)),
                status = invoice.Status,
                paymentStatus = paymentStatus
            });
        }

        // DELETE: api/invoices/{id}/payments/{paymentId} - Remove a payment and recalculate status
        [HttpDelete("{id}/payments/{paymentId}")]
        [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
        public async Task<IActionResult> DeletePayment(int id, int paymentId)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Payments)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            var payment = invoice.Payments?.FirstOrDefault(p => p.Id == paymentId);
            if (payment == null) return NotFound(new { message = "Payment not found." });

            _context.Payments.Remove(payment);

            // Recalculate invoice status after removal
            var remainingPayments = invoice.Payments!.Where(p => p.Id != paymentId).ToList();
            var totalPaidCompleted = remainingPayments.Where(p => p.Status == "Completed").Sum(p => p.Amount);
            var totalPendingAmount = remainingPayments.Where(p => p.Status == "Pending").Sum(p => p.Amount);
            var totalAmount = invoice.TotalAmount ?? 0;

            if (totalPaidCompleted >= totalAmount && totalAmount > 0)
            {
                invoice.Status = "Paid";
            }
            else if (totalPaidCompleted > 0)
            {
                invoice.Status = "PartiallyPaid";
            }
            else
            {
                invoice.Status = "Pending";
                invoice.IsLocked = false;
            }

            // If invoice was Paid and now isn't, revert Treated flag + linked Devis/DeliveryNotes
            if (invoice.Status != "Paid")
            {
                invoice.Treated = false;
                invoice.TreatedByUserId = null;
                invoice.TreatedAt = null;

                if (invoice.Devis != null)
                {
                    invoice.Devis.Status = "Accepted";
                    invoice.Devis.Treated = false;
                }

                var deliveryNotes = await _context.DeliveryNotes
                    .Where(dn => dn.InvoiceId == id)
                    .ToListAsync();
                foreach (var dn in deliveryNotes)
                {
                    dn.Treated = false;
                }
            }

            invoice.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted payment {PaymentId} from invoice {InvoiceId}. New status: {Status}", paymentId, id, invoice.Status);

            return Ok(new
            {
                message = "Payment deleted successfully.",
                amountPaid = totalPaidCompleted,
                pendingAmount = totalPendingAmount,
                remainingAmount = Math.Max(0, totalAmount - (totalPaidCompleted + totalPendingAmount)),
                status = invoice.Status
            });
        }

        // DELETE: api/invoices/{id} - Manager/FreeUser only
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin,Manager,FreeUser")]
        public async Task<IActionResult> DeleteInvoice(int id)
        {
            var invoice = await _context.Invoices.FindAsync(id);
            if (invoice == null) return NotFound();

            if (invoice.IsLocked || invoice.Status == "Paid")
            {
                return BadRequest("Cannot delete a locked or paid invoice.");
            }

            invoice.IsDeleted = true;
            invoice.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Invoice deleted successfully." });
        }
        
        // GET: api/invoices/{id}/pdf (Keeping legacy PDF generation if needed, or remove if strictly following new spec only. Keeping as it's useful.)
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> GetPdf(int id)
        {
            var invoice = await _context.Invoices
                                .Include(i => i.Client)
                                .Include(i => i.InvoiceItems)
                                .Include(i => i.Devis)
                                .FirstOrDefaultAsync(i => i.Id == id);
            if (invoice == null) return NotFound();

            // Get company settings for PDF customization
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();
            
            // Get user profile for creator name
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
            var creatorName = userProfile != null 
                ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() 
                : user.UserName ?? "";
            
            var companySettings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            var company = await _context.Companies.FindAsync(user.CompanyId);

            // Build PDF settings from company config
            var pdfSettings = PdfSettings.FromCompanySettings(
                companySettings, company, creatorName,
                currencyOverride: invoice.Devis?.CurrencySymbol,
                languageOverride: invoice.Devis?.PdfLanguage);
            
            // Apply custom tax settings to invoice if not already set
            if (invoice.Tfiscal == null || invoice.TfiscalName == null)
            {
                invoice.Tfiscal = pdfSettings.CustomTaxEnabled ? pdfSettings.CustomTaxAmount : 0;
                invoice.TfiscalName = pdfSettings.CustomTaxName;
            }

            // Token-based verification signature (Pro Invoice)
            if (companySettings?.ProInvoiceUseTokenSignature == true)
            {
                if (string.IsNullOrEmpty(invoice.VerificationToken))
                {
                    // Generate a unique verification token
                    var rawToken = $"{invoice.Id}-{Guid.NewGuid():N}";
                    using var sha = SHA256.Create();
                    var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawToken));
                    invoice.VerificationToken = Convert.ToHexString(hash)[..24].ToLowerInvariant();
                    invoice.VerificationTokenCreatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                pdfSettings.VerificationToken = invoice.VerificationToken;
                pdfSettings.VerificationUrl = $"{Request.Scheme}://{Request.Host}/api/invoices/verify";
            }

            var document = new Document<Invoice>(invoice, pdfSettings);
            byte[] pdfData;
            try
            {
                pdfData = document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PDF generation failed for invoice {InvoiceId}", invoice.Id);
                return StatusCode(500, new { message = "Failed to generate PDF" });
            }

            // Auto-register PDF in local storage
            try
            {
                await _pdfStorageService.SaveClientPdfAsync(
                    pdfData,
                    invoice.Number ?? $"INV-{invoice.Id}",
                    PdfDocumentType.Invoice,
                    invoice.Client?.Name ?? "Unknown",
                    company?.Name ?? "Default",
                    invoice.Date,
                    invoice.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-register PDF for invoice {InvoiceId}", invoice.Id);
            }

            return File(pdfData, "application/pdf", $"Facture_{invoice.Number}.pdf");
        }

        // GET: api/invoices/{id}/remaining-payment-pdf
        [HttpGet("{id}/remaining-payment-pdf")]
        public async Task<IActionResult> GetRemainingPaymentPdf(int id)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Client)
                .Include(i => i.InvoiceItems)
                .Include(i => i.Payments)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
            var creatorName = userProfile != null
                ? $"{userProfile.FirstName} {userProfile.LastName}".Trim()
                : user.UserName ?? "";

            var companySettings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            var company = await _context.Companies.FindAsync(user.CompanyId);

            // Use Quote currency (EffectiveCurrencySymbol) as requested
            var pdfSettings = PdfSettings.FromCompanySettings(
                companySettings, company, creatorName,
                currencyOverride: invoice.EffectiveCurrencySymbol,
                languageOverride: invoice.EffectivePdfLanguage);

            var guardKey = $"remaining:{invoice.Id}";
            if (!PdfGenerationGuard.TryEnter(guardKey))
            {
                return StatusCode(429, new { message = "PDF generation already in progress" });
            }

            try
            {
                var document = new RemainingPaymentDocument(invoice, pdfSettings);
                var pdfData = document.GeneratePdf();
                return File(pdfData, "application/pdf", $"Reste_a_payer_{invoice.Number}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Remaining payment PDF generation failed for invoice {InvoiceId}", invoice.Id);
                return StatusCode(500, new { message = "Failed to generate remaining payment PDF" });
            }
            finally
            {
                PdfGenerationGuard.Exit(guardKey);
            }
        }

        // GET: api/invoices/verify/{token} - Public verification endpoint
        [AllowAnonymous]
        [HttpGet("verify/{token}")]
        public async Task<IActionResult> VerifyInvoice(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest(new { valid = false, message = "Token is required." });

            var invoice = await _context.Invoices
                .IgnoreQueryFilters()
                .Include(i => i.Client)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.VerificationToken == token && !i.IsDeleted);

            if (invoice == null)
                return NotFound(new { valid = false, message = "Invalid or expired verification token." });

            var company = await _context.Companies
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == invoice.CompanyId);

            return Ok(new
            {
                valid = true,
                invoiceNumber = invoice.Number,
                date = invoice.Date,
                dueDate = invoice.DueDate,
                totalAmount = invoice.TotalAmount,
                currency = invoice.Devis?.CurrencySymbol ?? "DT",
                clientName = invoice.Client?.Name,
                companyName = company?.Name,
                status = invoice.Status,
                verifiedAt = DateTime.UtcNow
            });
        }

        // POST: api/invoices/{id}/send-email - Send invoice via email
        [HttpPost("{id}/send-email")]
        public async Task<IActionResult> SendInvoiceEmail(int id, [FromBody] SendEmailDto dto)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Client)
                .Include(i => i.InvoiceItems)
                .Include(i => i.Devis)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            var recipientEmail = dto.RecipientEmail ?? invoice.Client?.Email;

            if (string.IsNullOrEmpty(recipientEmail))
            {
                return BadRequest(new { message = "No recipient email provided and client has no email on file." });
            }

            // Get company and settings
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();
            
            var company = await _context.Companies.FindAsync(user.CompanyId);
            var settings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            // Build email subject with @ placeholders
            var subject = dto.Subject ?? settings?.EmailSubjectTemplate ?? $"Invoice #@invoiceNumber from @companyName";
            subject = ApplyEmailPlaceholders(subject, invoice, company);

            // Build email body
            string body;
            if (!string.IsNullOrEmpty(dto.Body))
            {
                // Use custom body from user
                body = dto.Body;
            }
            else if (!string.IsNullOrEmpty(settings?.EmailTemplate))
            {
                // Use saved template
                body = settings.EmailTemplate;
            }
            else
            {
                // Use default template
                body = settings?.DefaultEmailBody ?? GetDefaultEmailTemplate(invoice, company);
            }

            // Apply @ placeholders to body
            body = ApplyEmailPlaceholders(body, invoice, company);
            
            // Apply formatting syntax: @strong(text) → <strong>text</strong>, @underline(text) → <u>text</u>
            body = ApplyFormattingSyntax(body);
            
            // Append signature if available
            if (!string.IsNullOrEmpty(settings?.EmailSignature))
            {
                var signature = ApplyEmailPlaceholders(settings.EmailSignature, invoice, company);
                signature = ApplyFormattingSyntax(signature);
                
                // Build logo HTML for signature if company has logo
                var logoHtml = "";
                if (company?.LogoData != null && company.LogoData.Length > 0)
                {
                    var contentType = company.LogoContentType ?? "image/png";
                    var base64 = Convert.ToBase64String(company.LogoData);
                    logoHtml = $"<br/><img src=\"data:{contentType};base64,{base64}\" alt=\"{company.Name}\" style=\"max-height:60px; max-width:200px;\" />";
                }
                
                body = $"{body}<br/><br/>{signature}{logoHtml}";
            }
            else if (company?.LogoData != null && company.LogoData.Length > 0)
            {
                // No signature text but still add logo
                var contentType = company.LogoContentType ?? "image/png";
                var base64 = Convert.ToBase64String(company.LogoData);
                body = $"{body}<br/><br/><img src=\"data:{contentType};base64,{base64}\" alt=\"{company.Name}\" style=\"max-height:60px; max-width:200px;\" />";
            }

            // Wrap in basic HTML structure if not already HTML
            if (!body.TrimStart().StartsWith("<"))
            {
                body = $"<html><body style='font-family: Arial, sans-serif; line-height: 1.6;'>{body.Replace("\n", "<br/>")}</body></html>";
            }

            // Create email record
            var emailRecord = new InvoiceEmail
            {
                InvoiceId = id,
                RecipientEmail = recipientEmail,
                Subject = subject,
                Body = body,
                SentAt = DateTime.UtcNow,
                CreatedByUserId = userId,
                Status = "Sending"
            };

            _context.InvoiceEmails.Add(emailRecord);
            await _context.SaveChangesAsync();

            // Actually send the email using EmailService
            var attachPdf = dto.AttachPdf ?? true;
            var result = await _emailService.SendInvoiceEmailAsync(invoice, company, recipientEmail, subject, body, attachPdf);

            if (result.Success)
            {
                emailRecord.Status = "Sent";
                await _context.SaveChangesAsync();
                _logger.LogInformation("Invoice {InvoiceId} email sent to {Email}", id, recipientEmail);

                return Ok(new { 
                    message = result.Message,
                    emailId = emailRecord.Id,
                    status = emailRecord.Status
                });
            }
            else
            {
                emailRecord.Status = "Failed";
                emailRecord.ErrorMessage = result.ErrorDetails ?? result.Message;
                await _context.SaveChangesAsync();

                return StatusCode(500, new { 
                    message = result.Message,
                    emailId = emailRecord.Id,
                    status = "Failed",
                    errorDetails = result.ErrorDetails
                });
            }
        }

        // GET: api/invoices/{id}/emails - Get email history for an invoice
        [HttpGet("{id}/emails")]
        public async Task<IActionResult> GetInvoiceEmails(int id)
        {
            var emails = await _context.InvoiceEmails
                .Where(e => e.InvoiceId == id)
                .OrderByDescending(e => e.SentAt)
                .Select(e => new {
                    e.Id,
                    e.RecipientEmail,
                    e.Subject,
                    e.SentAt,
                    e.Status
                })
                .ToListAsync();

            return Ok(emails);
        }

        private string GetDefaultEmailTemplate(Invoice invoice, Company? company)
        {
            return $@"
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                    <h2>Invoice #@invoiceNumber</h2>
                    <p>Dear @clientName,</p>
                    <p>Please find attached your invoice #@invoiceNumber dated @invoiceDate.</p>
                    <p><strong>Total Amount:</strong> @amount TND</p>
                    @dueDateSection
                    <p>Thank you for your business!</p>
                    <br/>
                    <p>Best regards,<br/>@companyName</p>
                </body>
                </html>";
        }
        
        /// <summary>
        /// Replace @placeholder tokens in email content
        /// Supported: @clientName, @clientEmail, @invoiceNumber, @invoiceDate, @dueDate, @amount, @amountPaid, @remainingAmount, @companyName, @companyPhone, @companyAddress
        /// </summary>
        private string ApplyEmailPlaceholders(string template, Invoice invoice, Company? company)
        {
            var result = template
                // Client placeholders
                .Replace("@clientName", invoice.Client?.Name ?? "Valued Customer")
                .Replace("@clientEmail", invoice.Client?.Email ?? "")
                .Replace("@clientAddress", invoice.Client?.Address ?? "")
                .Replace("@clientPhone", invoice.Client?.Phone ?? "")
                
                // Invoice placeholders
                .Replace("@invoiceNumber", invoice.Number)
                .Replace("@invoiceDate", invoice.Date.ToString("MMM dd, yyyy"))
                .Replace("@dueDate", invoice.DueDate?.ToString("MMM dd, yyyy") ?? "N/A")
                .Replace("@amount", (invoice.TotalAmount ?? 0).ToString("N3"))
                .Replace("@amountPaid", invoice.AmountPaid.ToString("N3"))
                .Replace("@remainingAmount", invoice.RemainingAmount.ToString("N3"))
                .Replace("@status", invoice.Status)
                
                // Company placeholders
                .Replace("@companyName", company?.Name ?? "Company")
                .Replace("@companyPhone", company?.Phone ?? "")
                .Replace("@companyAddress", company?.Address ?? "")
                .Replace("@companyEmail", company?.Email ?? "");
            
            // Handle conditional due date section
            if (invoice.DueDate.HasValue)
            {
                result = result.Replace("@dueDateSection", $"<p><strong>Due Date:</strong> {invoice.DueDate.Value:MMM dd, yyyy}</p>");
            }
            else
            {
                result = result.Replace("@dueDateSection", "");
            }
            
            return result;
        }

        private async Task<string> GenerateNextInvoiceNumberAsync(int companyId, int year)
        {
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"{InvoiceNumberPrefix}{yearSuffix}-";

            var existingYearNumbers = await _context.Invoices
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(i => i.CompanyId == companyId && i.Date.Year == year && i.Number.StartsWith(prefix))
                .Select(i => i.Number)
                .ToListAsync();

            var maxSequence = 0;
            foreach (var number in existingYearNumbers)
            {
                var match = Regex.Match(number, $"^{Regex.Escape(prefix)}(\\d+)$", RegexOptions.IgnoreCase);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var sequence))
                {
                    maxSequence = Math.Max(maxSequence, sequence);
                }
            }

            return $"{prefix}{(maxSequence + 1):D3}";
        }

        private static bool IsUniqueConstraintViolation(DbUpdateException exception)
        {
            var message = exception.InnerException?.Message ?? exception.Message;
            return message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("2601", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("2627", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Convert custom formatting syntax to HTML:
        /// @strong(text) → <strong>text</strong>
        /// @underline(text) → <u>text</u>
        /// @italic(text) → <em>text</em>
        /// </summary>
        private string ApplyFormattingSyntax(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            
            text = System.Text.RegularExpressions.Regex.Replace(
                text, @"@strong\(([^)]+)\)", "<strong>$1</strong>");
            text = System.Text.RegularExpressions.Regex.Replace(
                text, @"@underline\(([^)]+)\)", "<u>$1</u>");
            text = System.Text.RegularExpressions.Regex.Replace(
                text, @"@italic\(([^)]+)\)", "<em>$1</em>");
            
            return text;
        }
    }

    public class SendEmailDto
    {
        public string? RecipientEmail { get; set; }
        public string? Subject { get; set; }
        public string? Body { get; set; }
        public bool? AttachPdf { get; set; } = true;
    }
}
