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
    public class DevisController : BaseApiController
    {
        private const string DevisNumberPrefix = "DV";
        private const string InvoiceNumberPrefix = "FA";
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILocalPdfStorageService _pdfStorageService;
        private readonly ILogger<DevisController> _logger;
        public DevisController(AppDbContext context, UserManager<ApplicationUser> userManager, ILocalPdfStorageService pdfStorageService, ILogger<DevisController> logger)
        {
            _context = context;
            _userManager = userManager;
            _pdfStorageService = pdfStorageService;
            _logger = logger;
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

            var yearNumbers = await _context.Devis
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
        public async Task<IActionResult> GetDevis([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.Devis
                    .AsNoTracking()
                    .Include(d => d.Client)
                    .OrderByDescending(d => d.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var devisList = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(d => new {
                        d.Id,
                        d.Number,
                        d.Date,
                        ClientName = d.Client != null ? d.Client.Name : "Unknown",
                        d.TotalAmount,
                        d.Status,
                        d.Treated,
                        d.CreatedByUserId,
                        d.ClientId,
                        d.Currency,
                        d.CurrencySymbol
                    })
                    .ToListAsync();

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
                _logger.LogError(ex, "Error fetching quotes (devis)");
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
            var devis = await _context.Devis
                .Include(d => d.Client)
                .Include(d => d.DevisItems)
                .Include(d => d.CreatedByUser)
                    .ThenInclude(u => u!.Profile)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (devis == null) return NotFound();

            // Return with createdByUser info for display (firstName + lastName for display name)
            return Ok(new {
                devis.Id,
                devis.Number,
                devis.Date,
                devis.ClientId,
                ClientName = devis.Client?.Name,
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
                DevisItems = devis.DevisItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.Price,
                    i.Tva,
                    i.VatRate,
                    i.TotalItemHT,
                    i.ItemTaxAmount
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
        public async Task<IActionResult> CreateDevis([FromBody] CreateDevisDto dto)
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
            Devis? devis = null;
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
                        var duplicateExists = await _context.Devis
                            .IgnoreQueryFilters()
                            .AnyAsync(d => d.CompanyId == user.CompanyId && d.Number == finalNumber);
                        if (duplicateExists)
                        {
                            return Conflict(new { message = "Quote number already exists for this company." });
                        }
                    }

                    devis = new Devis
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

                        devis.DevisItems.Add(new DevisItem
                        {
                            Description = itemDto.Description,
                            Quantity = itemDto.Quantity,
                            Price = itemDto.Price,
                            Tva = itemDto.Tva,
                            VatRate = itemDto.VatRate
                        });
                    }

                    devis.CalculTotalAmount();
                    _context.Devis.Add(devis);

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
                    return BadRequest(new { message = createFailureReason ?? "Failed to create quote and related products.", detail = ex.InnerException?.Message ?? ex.Message });
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
                DevisItems = devis.DevisItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.Price,
                    i.Tva,
                    i.VatRate,
                    i.TotalItemHT,
                    i.ItemTaxAmount
                })
            });
        }

        // PUT: api/devis/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDevis(int id, [FromBody] UpdateDevisDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.Number))
            {
                return BadRequest(new { message = "Quote number is required." });
            }

            var devis = await _context.Devis.Include(d => d.DevisItems).FirstOrDefaultAsync(d => d.Id == id);
            if (devis == null) return NotFound();

            if (devis.Status == "Accepted") return BadRequest("Cannot modify an accepted quote.");

            var duplicateNumberExists = await _context.Devis
                .AnyAsync(d => d.Id != id && d.CompanyId == devis.CompanyId && d.Number == dto.Number);
            if (duplicateNumberExists)
            {
                return Conflict(new { message = "Quote number already exists for this company." });
            }

            devis.Number = dto.Number;
            devis.Date = dto.Date.ToUniversalTime();
            devis.ClientId = dto.ClientId;

            _context.DevisItems.RemoveRange(devis.DevisItems);
            devis.DevisItems = dto.Items.Select(i => new DevisItem
            {
                Description = i.Description,
                Quantity = i.Quantity,
                Price = i.Price,
                Tva = i.Tva,
                VatRate = i.VatRate,
                DevisId = devis.Id
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
            var devis = await _context.Devis.FindAsync(id);
            if (devis == null) return NotFound();

            devis.IsDeleted = true;
            devis.DeletedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/devis/{id}/convert-to-invoice
        [HttpPost("{id}/convert-to-invoice")]
        public async Task<IActionResult> ConvertToInvoice(int id)
        {
            var devis = await _context.Devis
                .Include(d => d.DevisItems)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (devis == null) return NotFound();

            var alreadyConverted = await _context.Invoices
                .AsNoTracking()
                .AnyAsync(i => i.DevisId == devis.Id);
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
                DevisId = devis.Id, // Link original Devis
                SourceDevisNumber = devis.Number,
                Tfiscal = devis.Tfiscal,
                TfiscalName = devis.TfiscalName,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                Status = "Unpaid"
            };

            // Check for linked delivery notes – they represent what was actually delivered
            var deliveryNotes = await _context.DeliveryNotes
                .Include(dn => dn.DeliveryNoteItems)
                .Where(dn => dn.DevisId == devis.Id)
                .ToListAsync();

            if (deliveryNotes.Count > 0)
            {
                // Build a lookup from devis items by description (case-insensitive) for price/tax info
                var devisItemLookup = devis.DevisItems
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
                // No delivery notes – fall back to original devis items
                foreach (var item in devis.DevisItems)
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

            return Ok(new { InvoiceId = invoice.Id, InvoiceNumber = invoice.Number, SourceQuoteNumber = invoice.SourceDevisNumber, Message = "Converted successfully" });
        }
        // GET: api/devis/{id}/pdf
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> GetPdf(int id)
        {
            var devis = await _context.Devis
                .Include(d => d.Client)
                .Include(d => d.DevisItems)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (devis == null) return NotFound();

            // Get current user and company settings for PDF
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
                currencyOverride: devis.CurrencySymbol,
                languageOverride: devis.PdfLanguage);
            
            // Apply custom tax settings to devis if not already set
            if (devis.Tfiscal == null || devis.TfiscalName == null)
            {
                devis.Tfiscal = pdfSettings.CustomTaxEnabled ? pdfSettings.CustomTaxAmount : 0;
                devis.TfiscalName = pdfSettings.CustomTaxName;
            }

            var document = new Document<Devis>(devis, pdfSettings);
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

            // Auto-register PDF in local storage
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

        private async Task<ProductService?> FindOrCreateProductFromItemAsync(CreateDevisItemDto itemDto, int companyId, string? userId)
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

            var existingYearNumbers = await _context.Devis
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
    }
}
