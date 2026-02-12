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
                devis.Currency,
                devis.CurrencySymbol,
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
            var maxAttempts = 5;
            Devis? devis = null;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var generatedNumber = await GenerateNextDevisNumberAsync(user.CompanyId, devisDate.Year);
                devis = new Devis
                {
                    Number = generatedNumber,
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

                try
                {
                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex) && attempt < maxAttempts)
                {
                    _logger.LogWarning(ex, "Quote number collision for company {CompanyId}, retry {Attempt}", user.CompanyId, attempt);
                    _context.ChangeTracker.Clear();
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
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                Status = "Unpaid"
            };

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

            invoice.CalculTotalAmount();

            // Update Devis status
            devis.Status = "Accepted";
            devis.UpdatedAt = DateTime.UtcNow;

            _context.Invoices.Add(invoice);
            try
            {
                await _context.SaveChangesAsync();
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

        private async Task<string> GenerateNextDevisNumberAsync(int companyId, int year)
        {
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"{DevisNumberPrefix}{yearSuffix}-";

            var existingYearNumbers = await _context.Devis
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
