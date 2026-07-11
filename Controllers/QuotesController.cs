using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;
using Microsoft.AspNetCore.Identity;
using ResourceManager.Services;
using QuestPDF.Fluent;
using System.Text.RegularExpressions;



namespace ResourceManager.Controllers
{
    public class QuotesController : BaseApiController
    {
        private const string DevisNumberPrefix = "DV";
        private const string InvoiceNumberPrefix = "FA";
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILocalPdfStorageService _pdfStorageService;
        private readonly ILogger<QuotesController> _logger;
        private readonly IEmailService _emailService;
        private readonly IWhatsAppService _whatsAppService;
        private readonly IPdfTokenService _pdfTokenService;
        public QuotesController(AppDbContext context, UserManager<ApplicationUser> userManager, ILocalPdfStorageService pdfStorageService, ILogger<QuotesController> logger, IEmailService emailService, IWhatsAppService whatsAppService, IPdfTokenService pdfTokenService)
        {
            _context = context;
            _userManager = userManager;
            _pdfStorageService = pdfStorageService;
            _logger = logger;
            _emailService = emailService;
            _whatsAppService = whatsAppService;
            _pdfTokenService = pdfTokenService;
        }

        // GET: api/devis/last-number - Get the last quote number for suggestion
        [HttpGet("last-number")]
        public async Task<IActionResult> GetLastDevisNumber()
        {
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var year = DateTime.UtcNow.Year;
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"{DevisNumberPrefix}{yearSuffix}-";

            var yearNumbers = await _context.Quotes
                .AsNoTracking()
                .Where(d => d.CompanyId == user.CompanyId && d.Date.Year == year && d.Number.StartsWith(prefix))
                .Select(d => d.Number)
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

        // GET: api/devis
        [HttpGet]
        public async Task<IActionResult> GetDevis([FromQuery] int page = 1, [FromQuery] int size = 20, [FromQuery] bool includeItems = false)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.Quotes
                    .AsNoTracking()
                    .Include(d => d.Client)
                    .AsQueryable();

                if (includeItems)
                {
                    query = query.Include(d => d.QuoteItems);
                }

                // Employee role: hide archived (Treated) records
                if (User.IsInRole("Employee"))
                {
                    query = query.Where(d => !d.Treated);
                }

                query = query.OrderByDescending(d => d.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var paged = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .ToListAsync();

                var devisList = paged.Select(d => new {
                    d.Id,
                    d.Number,
                    d.Date,
                    ClientName = d.Client != null ? d.Client.Name : "Unknown",
                    ClientId = d.ClientId,
                    ClientAddress = d.Client?.Address,
                    ClientTaxId = d.Client?.TaxId,
                    ClientPhone = d.Client?.Phone,
                    ClientEmail = d.Client?.Email,
                    d.SubTotal,
                    d.TaxAmount,
                    d.TotalAmount,
                    d.Tfiscal,
                    d.TfiscalName,
                    d.Status,
                    d.Treated,
                    d.CreatedByUserId,
                    d.CreatedBy,
                    d.ModifiedBy,
                    d.Currency,
                    d.CurrencySymbol,
                    QuoteItems = includeItems ? d.QuoteItems.Select(i => new {
                        i.Id,
                        i.Description,
                        i.Quantity,
                        i.Price,
                        i.Tva,
                        i.VatRate,
                        i.TotalItemHT,
                        i.ItemTaxAmount,
                        i.ProductServiceId
                    }).ToList() : null
                }).ToList();

                return Ok(new {
                    Data = devisList,
                    Page = page,
                    Size = size,
                    TotalCount = totalCount,
                    TotalPages = totalPages
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching quotes");
                return Ok(new {
                    Data = Array.Empty<object>(),
                    Page = page,
                    Size = size,
                    TotalCount = 0,
                    TotalPages = 0
                });
            }
        }

        // GET: api/devis/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDevisById(int id)
        {
            var devis = await _context.Quotes
                .Include(d => d.Client)
                .Include(d => d.QuoteItems)
                .Include(d => d.CreatedByUser)
                    .ThenInclude(u => u!.Profile)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (devis == null) return NotFound();

            // Employee role cannot access archived (Treated) quotes
            if (User.IsInRole("Employee") && devis.Treated)
            {
                return NotFound(new { message = "Quote not found or access denied" });
            }

            // Return with createdByUser info for display (firstName + lastName for display name)
            return Ok(new {
                devis.Id,
                devis.Number,
                devis.Date,
                devis.ClientId,
                ClientName = devis.Client?.Name,
                ClientAddress = devis.Client?.Address,
                ClientTaxId = devis.Client?.TaxId,
                ClientPhone = devis.Client?.Phone,
                ClientEmail = devis.Client?.Email,
                devis.Status,
                devis.Treated,
                devis.SubTotal,
                devis.TaxAmount,
                devis.TotalAmount,
                devis.Tfiscal,
                devis.TfiscalName,
                devis.Currency,
                devis.CurrencySymbol,
                devis.PdfLanguage,
                devis.CreatedBy,
                devis.ModifiedBy,
                QuoteItems = devis.QuoteItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.Price,
                    i.Tva,
                    i.VatRate,
                    i.TotalItemHT,
                    i.ItemTaxAmount,
                    i.ProductServiceId
                }),
                CreatedByUser = devis.CreatedByUser != null ? new {
                    devis.CreatedByUser.Email,
                    devis.CreatedByUser.UserName,
                    FirstName = devis.CreatedByUser.Profile?.FirstName ?? "",
                    LastName = devis.CreatedByUser.Profile?.LastName ?? ""
                } : null
            });
        }

        // POST: api/devis
        [HttpPost]
        public async Task<IActionResult> CreateDevis([FromBody] CreateQuoteDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();
            
            // Get company settings for custom tax
            var companySettings = await _context.CompanySettings
                .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);

            var devisDate = dto.Date.ToUniversalTime();
            var userProvidedNumber = dto.Number?.Trim() ?? string.Empty;
            var isAutoNumber = string.IsNullOrWhiteSpace(userProvidedNumber);
            var maxAttempts = isAutoNumber ? 5 : 1;
            Quote? devis = null;
            string? createFailureReason = null;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    var finalNumber = isAutoNumber
                        ? await GenerateNextDevisNumberAsync(user.CompanyId, devisDate.Year)
                        : userProvidedNumber;

                    if (!isAutoNumber)
                    {
                        var duplicateExists = await _context.Quotes
                            .IgnoreQueryFilters()
                            .AnyAsync(d => d.CompanyId == user.CompanyId && d.Number == finalNumber);
                        if (duplicateExists)
                        {
                            return Conflict(new { message = "Quote number already exists for this company." });
                        }
                    }

                    devis = new Quote
                    {
                        Number = finalNumber,
                        Date = devisDate,
                        ClientId = dto.ClientId,
                        CreatedByUserId = userId,
                        CreatedAt = DateTime.UtcNow,
                        Status = "Draft",
                        Currency = dto.Currency ?? companySettings?.Currency,
                        CurrencySymbol = dto.CurrencySymbol ?? companySettings?.CurrencySymbol,
                        PdfLanguage = dto.PdfLanguage ?? companySettings?.InvoiceLanguage,
                        Tfiscal = companySettings?.CustomTaxEnabled == true ? companySettings.CustomTaxAmount : 0,
                        TfiscalName = companySettings?.CustomTaxName ?? "Timbre Fiscal"
                    };

                    foreach (var itemDto in dto.Items)
                    {
                        var product = await FindOrCreateProductFromItemAsync(itemDto, user.CompanyId, userId);
                        if (product == null)
                        {
                            createFailureReason = $"Failed to create product from quote item '{itemDto.Description}'.";
                            throw new InvalidOperationException(createFailureReason);
                        }

                        devis.QuoteItems.Add(new QuoteItem
                        {
                            Description = itemDto.Description,
                            Quantity = itemDto.Quantity,
                            Price = itemDto.Price,
                            Tva = itemDto.Tva,
                            VatRate = itemDto.VatRate,
                            ProductServiceId = itemDto.ProductServiceId
                        });
                    }

                    devis.CalculTotalAmount();
                    _context.Quotes.Add(devis);

                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex) && isAutoNumber && attempt < maxAttempts)
                {
                    _logger.LogWarning(ex, "Quote number collision for company {CompanyId}, retry {Attempt}", user.CompanyId, attempt);
                    _context.ChangeTracker.Clear();
                    devis = null;
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogWarning(ex, "Quote number collision for company {CompanyId} after max retries", user.CompanyId);
                    return Conflict(new { message = "Failed to generate a unique quote number. Please retry." });
                }
                catch (Exception ex) when (ex is InvalidOperationException || ex is DbUpdateException)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogError(ex, "Quote creation failed for company {CompanyId}", user.CompanyId);
                    return BadRequest(new { message = createFailureReason ?? "Failed to create quote and related products." });
                }
            }

            if (devis == null || devis.Id == 0)
            {
                return Conflict(new { message = "Failed to generate a unique quote number. Please retry." });
            }

            // Return safe projection without sensitive user data
            return CreatedAtAction(nameof(GetDevisById), new { id = devis.Id }, new {
                devis.Id,
                devis.Number,
                devis.Date,
                devis.ClientId,
                devis.Status,
                devis.SubTotal,
                devis.TaxAmount,
                devis.TotalAmount,
                devis.Tfiscal,
                devis.TfiscalName,
                QuoteItems = devis.QuoteItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.Price,
                    i.Tva,
                    i.VatRate,
                    i.TotalItemHT,
                    i.ItemTaxAmount,
                    i.ProductServiceId
                })
            });
        }

        // PUT: api/quotes/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDevis(int id, [FromBody] UpdateQuoteDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.Number))
            {
                return BadRequest(new { message = "Quote number is required." });
            }

            var devis = await _context.Quotes.Include(d => d.QuoteItems).FirstOrDefaultAsync(d => d.Id == id);
            if (devis == null) return NotFound();

            // Only Draft quotes can be edited
            if (devis.Treated || devis.Status != "Draft")
            {
                return BadRequest(new { message = "Only Draft quotes can be modified." });
            }

            var duplicateNumberExists = await _context.Quotes
                .AnyAsync(d => d.Id != id && d.CompanyId == devis.CompanyId && d.Number == dto.Number);
            if (duplicateNumberExists)
            {
                return Conflict(new { message = "Quote number already exists for this company." });
            }

            devis.Number = dto.Number;
            devis.Date = dto.Date.ToUniversalTime();
            devis.ClientId = dto.ClientId;

            _context.QuoteItems.RemoveRange(devis.QuoteItems);
            devis.QuoteItems = dto.Items.Select(i => new QuoteItem
            {
                Description = i.Description,
                Quantity = i.Quantity,
                Price = i.Price,
                Tva = i.Tva,
                VatRate = i.VatRate,
                ProductServiceId = i.ProductServiceId,
                QuoteId = devis.Id
            }).ToList();

            devis.CalculTotalAmount();
            devis.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(devis);
        }

        // DELETE: api/devis/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevis(int id)
        {
            var devis = await _context.Quotes.FindAsync(id);
            if (devis == null) return NotFound();

            devis.IsDeleted = true;
            devis.DeletedAt = DateTime.UtcNow;
            // Clear the number so its slot in the unique (CompanyId, Number) index is freed for reuse
            devis.Number = $"DELETED-{id}";

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting quote {QuoteId}", id);
                return StatusCode(500, new { message = "Failed to delete quote. Please try again." });
            }

            return NoContent();
        }

        // POST: api/devis/{id}/convert-to-invoice
        [HttpPost("{id}/convert-to-invoice")]
        public async Task<IActionResult> ConvertToInvoice(int id)
        {
            var devis = await _context.Quotes
                .Include(d => d.QuoteItems)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (devis == null) return NotFound();

            var alreadyConverted = devis.InvoiceId != null;
            if (alreadyConverted)
            {
                return Conflict(new { message = "An invoice already exists for this quote." });
            }

            // Create new invoice
            var userId = _userManager.GetUserId(User);
            var user = string.IsNullOrEmpty(userId) ? null : await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var invoiceNumber = await GenerateNextInvoiceNumberAsync(user.CompanyId, DateTime.UtcNow.Year);
            var invoice = new Invoice
            {
                Number = invoiceNumber,
                Date = DateTime.UtcNow,
                ClientId = devis.ClientId,
                SourceQuoteNumbers = devis.Number,
                Tfiscal = devis.Tfiscal,
                TfiscalName = devis.TfiscalName,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                Status = "Unpaid"
            };

            // Check for linked delivery notes – they represent what was actually delivered
            var deliveryNotes = await _context.DeliveryNotes
                .Include(dn => dn.DeliveryNoteItems)
                .Where(dn => dn.QuoteId == devis.Id)
                .ToListAsync();

            if (deliveryNotes.Count > 0)
            {
                // Build a lookup from devis items by description (case-insensitive) for price/tax info
                var devisItemLookup = devis.QuoteItems
                    .GroupBy(di => di.Description.Trim().ToLowerInvariant())
                    .ToDictionary(g => g.Key, g => g.First());

                // Aggregate all delivery note items by description
                var aggregated = new Dictionary<string, (string Description, int Quantity, decimal Price, bool Tva, decimal VatRate)>(StringComparer.OrdinalIgnoreCase);

                foreach (var dn in deliveryNotes)
                {
                    foreach (var dnItem in dn.DeliveryNoteItems)
                    {
                        var key = dnItem.Description.Trim().ToLowerInvariant();
                        if (aggregated.TryGetValue(key, out var existing))
                        {
                            aggregated[key] = (existing.Description, existing.Quantity + (dnItem.Quantity ?? 0), existing.Price, existing.Tva, existing.VatRate);
                        }
                        else
                        {
                            // Lookup price from original quote item
                            decimal price = 0;
                            bool tva = false;
                            decimal vatRate = 0;

                            if (devisItemLookup.TryGetValue(key, out var devisItem))
                            {
                                price = devisItem.Price ?? 0;
                                tva = devisItem.Tva;
                                vatRate = devisItem.VatRate ?? 0;
                            }
                            else if (dnItem.Price.HasValue)
                            {
                                // New item added via delivery note – use its own pricing
                                price = dnItem.Price.Value;
                                tva = (dnItem.TaxRate ?? 0) > 0;
                                vatRate = dnItem.TaxRate ?? 0;
                            }

                            aggregated[key] = (dnItem.Description, dnItem.Quantity ?? 0, price, tva, vatRate);
                        }
                    }
                }

                foreach (var kvp in aggregated)
                {
                    var (description, quantity, price, tva, vatRate) = kvp.Value;
                    invoice.InvoiceItems.Add(new InvoiceItem
                    {
                        Description = description,
                        Quantity = quantity,
                        Price = price,
                        Tva = tva,
                        VatRate = vatRate
                    });
                }
            }
            else
            {
                // No delivery notes – fall back to original quote items
                foreach (var item in devis.QuoteItems)
                {
                    invoice.InvoiceItems.Add(new InvoiceItem
                    {
                        Description = item.Description,
                        Quantity = item.Quantity,
                        Price = item.Price,
                        Tva = item.Tva,
                        VatRate = item.VatRate
                    });
                }
            }

            invoice.CalculTotalAmount();

            // Update Devis status
            devis.Status = "Accepted";
            devis.UpdatedAt = DateTime.UtcNow;

            _context.Invoices.Add(invoice);
            try
            {
                await _context.SaveChangesAsync();

                // Link the quote to the invoice now that it has an Id
                devis.InvoiceId = invoice.Id;
                devis.Status = "Completed";
                devis.Treated = true;

                // Re-link delivery notes now that invoice has an Id
                if (deliveryNotes.Count > 0)
                {
                    foreach (var dn in deliveryNotes)
                    {
                        dn.InvoiceId = invoice.Id;
                    }
                    await _context.SaveChangesAsync();
                }
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                return Conflict(new { message = "Failed to create invoice due to duplicate number. Please retry." });
            }

            return Ok(new { InvoiceId = invoice.Id, InvoiceNumber = invoice.Number, SourceQuoteNumbers = invoice.SourceQuoteNumbers, Message = "Converted successfully" });
        }
        // GET: api/devis/{id}/pdf
        // Anonymous access allowed when a short-lived signed token (?t=) is present (WhatsApp delivery).
        [AllowAnonymous]
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> GetPdf(int id, [FromQuery] string? t = null)
        {
            bool isAnonymous = !(User.Identity?.IsAuthenticated ?? false);

            if (isAnonymous)
            {
                if (string.IsNullOrEmpty(t) || !_pdfTokenService.ValidateToken(id, t))
                    return Unauthorized(new { message = "Valid token required to access this PDF" });
            }

            Quote? devis;
            if (isAnonymous)
            {
                devis = await _context.Quotes
                    .IgnoreQueryFilters()
                    .Include(d => d.Client)
                    .Include(d => d.QuoteItems)
                    .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);
            }
            else
            {
                devis = await _context.Quotes
                    .Include(d => d.Client)
                    .Include(d => d.QuoteItems)
                    .FirstOrDefaultAsync(d => d.Id == id);
            }

            if (devis == null) return NotFound();

            if (!isAnonymous && User.IsInRole("Employee") && devis.Treated)
                return NotFound(new { message = "Quote not found or access denied" });

            CompanySettings? companySettings;
            Company? company;
            string creatorName;

            if (isAnonymous)
            {
                companySettings = await _context.CompanySettings
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(s => s.CompanyId == devis.CompanyId);
                company = await _context.Companies.FindAsync(devis.CompanyId);
                creatorName = "";
            }
            else
            {
                var userId = _userManager.GetUserId(User);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null) return Unauthorized();

                var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
                creatorName = userProfile != null
                    ? $"{userProfile.FirstName} {userProfile.LastName}".Trim()
                    : user.UserName ?? "";

                companySettings = await _context.CompanySettings
                    .FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
                company = await _context.Companies.FindAsync(user.CompanyId);
            }

            var pdfSettings = PdfSettings.FromCompanySettings(
                companySettings, company, creatorName,
                currencyOverride: devis.CurrencySymbol,
                languageOverride: devis.PdfLanguage);

            if (devis.Tfiscal == null || devis.TfiscalName == null)
            {
                devis.Tfiscal = pdfSettings.CustomTaxEnabled ? pdfSettings.CustomTaxAmount : 0;
                devis.TfiscalName = pdfSettings.CustomTaxName;
            }

            var document = new Document<Quote>(devis, pdfSettings);
            byte[] pdfData;
            try
            {
                pdfData = document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PDF generation failed for quote {DevisId}", devis.Id);
                return StatusCode(500, new { message = "Failed to generate PDF" });
            }

            try
            {
                await _pdfStorageService.SaveClientPdfAsync(
                    pdfData,
                    devis.Number ?? $"DEV-{devis.Id}",
                    PdfDocumentType.Quote,
                    devis.Client?.Name ?? "Unknown",
                    company?.Name ?? "Default",
                    devis.Date,
                    devis.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-register PDF for devis {DevisId}", devis.Id);
            }

            return File(pdfData, "application/pdf", $"Devis_{devis.Number}.pdf");
        }

        private async Task<ProductService?> FindOrCreateProductFromItemAsync(CreateQuoteItemDto itemDto, int companyId, string? userId)
        {
            var rawDescription = itemDto.Description?.Trim();
            if (string.IsNullOrWhiteSpace(rawDescription))
                return null;

            var productName = ExtractProductName(rawDescription);
            if (string.IsNullOrWhiteSpace(productName))
                return null;

            // 1. Check the local change tracker first (handles multiple items with same product in one request)
            var localMatch = _context.ChangeTracker.Entries<ProductService>()
                .Where(e => e.State == EntityState.Added)
                .Select(e => e.Entity)
                .FirstOrDefault(p => p.CompanyId == companyId
                    && string.Equals(p.Name, productName, StringComparison.OrdinalIgnoreCase));

            if (localMatch != null)
                return localMatch;

            // 2. Query the database (case-insensitive)
            var existing = await _context.ProductServices
                .FirstOrDefaultAsync(p => p.CompanyId == companyId && p.Name.ToLower() == productName.ToLower());

            if (existing != null)
                return existing;

            var product = new ProductService
            {
                Name = productName,
                Description = ExtractProductDescription(rawDescription),
                DefaultUnitPrice = itemDto.Price,
                TvaRate = itemDto.VatRate ?? 0m,
                Type = "product",
                Category = null,
                VatApplicable = itemDto.Tva,
                CompanyId = companyId,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ProductServices.Add(product);
            return product;
        }

        private static string ExtractProductName(string fullDescription)
        {
            var separatorIndex = fullDescription.IndexOf(" - ", StringComparison.Ordinal);
            if (separatorIndex <= 0)
                return fullDescription.Trim();

            return fullDescription[..separatorIndex].Trim();
        }

        private static string? ExtractProductDescription(string fullDescription)
        {
            var separatorIndex = fullDescription.IndexOf(" - ", StringComparison.Ordinal);
            if (separatorIndex < 0 || separatorIndex + 3 >= fullDescription.Length)
                return null;

            var details = fullDescription[(separatorIndex + 3)..].Trim();
            return string.IsNullOrWhiteSpace(details) ? null : details;
        }

        private async Task<string> GenerateNextDevisNumberAsync(int companyId, int year)
        {
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"{DevisNumberPrefix}{yearSuffix}-";

            var existingYearNumbers = await _context.Quotes
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(d => d.CompanyId == companyId && d.Date.Year == year && d.Number.StartsWith(prefix))
                .Select(d => d.Number)
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

        // POST: api/quotes/{id}/send-email
        [HttpPost("{id}/send-email")]
        public async Task<IActionResult> SendQuoteEmail(int id, [FromBody] SendDocumentEmailDto dto)
        {
            var quote = await _context.Quotes
                .Include(q => q.Client)
                .Include(q => q.QuoteItems)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quote == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var recipientEmail = dto.RecipientEmail ?? quote.Client?.Email;
            if (string.IsNullOrEmpty(recipientEmail))
                return BadRequest(new { message = "No recipient email provided and client has no email on file." });

            var company = await _context.Companies.FindAsync(user.CompanyId);
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
            var senderName = userProfile != null ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() : user.UserName ?? "";

            var subject = dto.Subject ?? $"Quote #{quote.Number} from {company?.Name ?? "Company"}";
            var body = dto.Body ?? $"<p>Dear {quote.Client?.Name ?? "Customer"},</p><p>Please find attached quote <strong>#{quote.Number}</strong>.</p><p>Best regards,<br/>{company?.Name ?? "Company"}</p>";

            // Generate PDF
            var companySettings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            var pdfSettings = PdfSettings.FromCompanySettings(companySettings, company, senderName,
                currencyOverride: quote.CurrencySymbol, languageOverride: quote.PdfLanguage);

            if (quote.Tfiscal == null || quote.TfiscalName == null)
            {
                quote.Tfiscal = pdfSettings.CustomTaxEnabled ? pdfSettings.CustomTaxAmount : 0;
                quote.TfiscalName = pdfSettings.CustomTaxName;
            }

            byte[] pdfData;
            try
            {
                var document = new Document<Quote>(quote, pdfSettings);
                pdfData = document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate PDF for quote {QuoteId}", id);
                return StatusCode(500, new { message = "Failed to generate PDF" });
            }

            // Create audit record
            var audit = new DocumentSendAudit
            {
                DocumentType = "Quote",
                DocumentId = id,
                DocumentNumber = quote.Number,
                Channel = "Email",
                RecipientEmail = recipientEmail,
                Subject = subject,
                Body = body,
                SentAt = DateTime.UtcNow,
                SentByUserId = userId,
                SentByName = senderName,
                Status = "Sending",
                CompanyId = user.CompanyId
            };
            _context.DocumentSendAudits.Add(audit);
            await _context.SaveChangesAsync();

            var attachPdf = dto.AttachPdf ?? true;
            var result = await _emailService.SendEmailAsync(recipientEmail, subject, body,
                attachPdf ? pdfData : null, attachPdf ? $"Quote-{quote.Number}.pdf" : null);

            audit.Status = result.Success ? "Sent" : "Failed";
            audit.ErrorMessage = result.Success ? null : (result.ErrorDetails ?? result.Message);
            audit.MessageId = result.MessageId;
            await _context.SaveChangesAsync();

            if (result.Success)
            {
                _logger.LogInformation("Quote {QuoteId} email sent to {Email}", id, recipientEmail);
                return Ok(new { message = result.Message, auditId = audit.Id, status = audit.Status });
            }
            return StatusCode(500, new { message = result.Message, auditId = audit.Id, status = audit.Status, errorDetails = result.ErrorDetails });
        }

        // POST: api/quotes/{id}/send-whatsapp
        [HttpPost("{id}/send-whatsapp")]
        public async Task<IActionResult> SendQuoteWhatsApp(int id, [FromBody] SendDocumentWhatsAppDto? dto = null)
        {
            try
            {
                var quote = await _context.Quotes
                    .Include(q => q.Client)
                    .Include(q => q.QuoteItems)
                    .FirstOrDefaultAsync(q => q.Id == id);

                if (quote == null) return NotFound(new { message = "Quote not found" });
                if (quote.Client == null) return BadRequest(new { message = "Client not found for this quote" });
                if (string.IsNullOrEmpty(quote.Client.Phone))
                    return BadRequest(new { message = "Client phone number is required for WhatsApp sharing." });

                var userId = _userManager.GetUserId(User);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                var user = await _userManager.FindByIdAsync(userId);
                if (user == null) return Unauthorized();

                var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
                var senderName = userProfile != null ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() : user.UserName ?? "";

                var pdfToken = _pdfTokenService.GenerateToken(id);
                var request = HttpContext.Request;
                var baseUrl = $"{request.Scheme}://{request.Host}";
                var pdfUrl = $"{baseUrl}/api/Quotes/{id}/pdf?t={Uri.EscapeDataString(pdfToken)}";

                var result = await _whatsAppService.SendDocumentMessageAsync(
                    quote.Client.Phone, pdfUrl, $"Quote-{quote.Number}.pdf", dto?.CustomMessage);

                var audit = new DocumentSendAudit
                {
                    DocumentType = "Quote",
                    DocumentId = id,
                    DocumentNumber = quote.Number,
                    Channel = "WhatsApp",
                    RecipientPhone = quote.Client.Phone,
                    SentAt = DateTime.UtcNow,
                    SentByUserId = userId,
                    SentByName = senderName,
                    Status = result.Success ? "Sent" : "Failed",
                    ErrorMessage = result.Success ? null : result.Error,
                    MessageId = result.Success ? result.MessageId : null,
                    CompanyId = user.CompanyId
                };
                _context.DocumentSendAudits.Add(audit);
                await _context.SaveChangesAsync();

                if (!result.Success)
                    return BadRequest(new { message = result.Error ?? "Failed to send WhatsApp message" });

                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send WhatsApp message for quote {QuoteId}", id);
                return StatusCode(500, new { message = "Failed to send WhatsApp message" });
            }
        }

        // GET: api/quotes/{id}/send-history
        [HttpGet("{id}/send-history")]
        public async Task<IActionResult> GetQuoteSendHistory(int id)
        {
            var quote = await _context.Quotes.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id);
            if (quote == null) return NotFound();

            var history = await _context.DocumentSendAudits
                .Where(a => a.DocumentType == "Quote" && a.DocumentId == id)
                .OrderByDescending(a => a.SentAt)
                .Select(a => new {
                    a.Id, a.Channel, a.RecipientEmail, a.RecipientPhone,
                    a.Subject, a.SentAt, a.SentByName, a.Status, a.ErrorMessage
                })
                .ToListAsync();

            return Ok(history);
        }
    }
}
