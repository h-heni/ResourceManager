using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;
using ResourceManager.Services;
using Microsoft.AspNetCore.Identity;
using QuestPDF.Fluent;
using System.Text.RegularExpressions;

namespace ResourceManager.Controllers
{
    public class DeliveryNotesController : BaseApiController
    {
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILocalPdfStorageService _pdfStorageService;
        private readonly ILogger<DeliveryNotesController> _logger;

        public DeliveryNotesController(AppDbContext context, UserManager<ApplicationUser> userManager, ILocalPdfStorageService pdfStorageService, ILogger<DeliveryNotesController> logger)
        {
            _context = context;
            _userManager = userManager;
            _pdfStorageService = pdfStorageService;
            _logger = logger;
        }

        // GET: api/deliverynotes
        [HttpGet]
        public async Task<IActionResult> GetDeliveryNotes([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;

                var query = _context.DeliveryNotes
                    .AsNoTracking()
                    .Include(dn => dn.Client)
                    .Include(dn => dn.Devis)
                    .Include(dn => dn.Invoice)
                    .Include(dn => dn.DeliveryNoteItems)
                    .OrderByDescending(dn => dn.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var notes = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(dn => new {
                        dn.Id,
                        dn.Number,
                        dn.Date,
                        ClientName = dn.Client != null ? dn.Client.Name : "Unknown",
                        dn.TotalAmount,
                        dn.Treated,
                        dn.DevisId,
                        dn.InvoiceId,
                        DevisNumber = dn.Devis != null ? dn.Devis.Number : null,
                        InvoiceNumber = dn.Invoice != null ? dn.Invoice.Number : null,
                        ItemsCount = dn.DeliveryNoteItems != null ? dn.DeliveryNoteItems.Count : 0
                    })
                    .ToListAsync();

                return Ok(new {
                    Data = notes,
                    Page = page,
                    Size = size,
                    TotalCount = totalCount,
                    TotalPages = totalPages
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching delivery notes");
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

        // GET: api/deliverynotes/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDeliveryNote(int id)
        {
            var note = await _context.DeliveryNotes
                .Include(dn => dn.Client)
                .Include(dn => dn.DeliveryNoteItems)
                .Include(dn => dn.Devis)
                .Include(dn => dn.CreatedByUser)
                    .ThenInclude(u => u!.Profile)
                .FirstOrDefaultAsync(dn => dn.Id == id);

            if (note == null) return NotFound();

            // Return with createdByUser info for display (firstName + lastName for display name)
            return Ok(new {
                note.Id,
                note.Number,
                note.Date,
                note.ClientId,
                ClientName = note.Client?.Name,
                note.DevisId,
                note.InvoiceId,
                note.Treated,
                DeliveryNoteItems = note.DeliveryNoteItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity
                }),
                CreatedByUser = note.CreatedByUser != null ? new {
                    note.CreatedByUser.Email,
                    note.CreatedByUser.UserName,
                    FirstName = note.CreatedByUser.Profile?.FirstName ?? "",
                    LastName = note.CreatedByUser.Profile?.LastName ?? ""
                } : null
            });
        }

        // POST: api/deliverynotes
        [HttpPost]
        public async Task<IActionResult> CreateDeliveryNote([FromBody] DeliveryNoteDto dto) 
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var userProvidedNumber = dto.Number?.Trim() ?? string.Empty;
            var isAutoNumber = string.IsNullOrWhiteSpace(userProvidedNumber);
            var maxAttempts = isAutoNumber ? 5 : 1;
            DeliveryNote? note = null;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var noteNumber = isAutoNumber
                    ? await GenerateNextDeliveryNoteNumberAsync(user.CompanyId, dto.Date.ToUniversalTime().Year)
                    : userProvidedNumber;

                note = new DeliveryNote
                {
                    Number = noteNumber,
                    Date = dto.Date.ToUniversalTime(),
                    ClientId = dto.ClientId,
                    InvoiceId = dto.InvoiceId,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
            
                // Items
                if (dto.DeliveryNoteItems != null)
                {
                    foreach(var item in dto.DeliveryNoteItems)
                    {
                        note.DeliveryNoteItems.Add(new DeliveryNoteItem
                        {
                            Description = item.Description,
                            Quantity = item.Quantity,
                            TotalEstimated = item.Quantity * 0
                        });
                    }
                }

                // Link to Devis if provided (REQUIRED for proper flow)
                if (dto.DevisId.HasValue)
                {
                    var devis = await _context.Devis.FindAsync(dto.DevisId.Value);
                    if (devis != null)
                    {
                        note.DevisId = devis.Id;
                        note.ClientId = devis.ClientId;
                        devis.Status = "Accepted";
                        devis.Treated = false;
                        devis.UpdatedAt = DateTime.UtcNow;
                    }
                }

                _context.DeliveryNotes.Add(note);
                try
                {
                    await _context.SaveChangesAsync();
                    break; // Success — exit retry loop
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex) && isAutoNumber && attempt < maxAttempts)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogWarning(ex, "Delivery note number collision for company {CompanyId}, retry {Attempt}", user.CompanyId, attempt);
                    note = null;
                    continue;
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
                {
                    _context.ChangeTracker.Clear();
                    return Conflict(new { message = "Delivery note number already exists. Please retry.", detail = ex.InnerException?.Message ?? ex.Message });
                }
                catch (DbUpdateException ex)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogError(ex, "DbUpdateException creating delivery note. Number={Number}", note.Number);
                    return StatusCode(500, new { message = "Failed to save delivery note.", detail = ex.InnerException?.Message ?? ex.Message });
                }
            }

            if (note == null || note.Id == 0)
            {
                return Conflict(new { message = "Failed to generate a unique delivery note number. Please retry." });
            }

            return CreatedAtAction(nameof(GetDeliveryNote), new { id = note.Id }, note);
        }

        // PUT: api/deliverynotes/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDeliveryNote(int id, [FromBody] DeliveryNoteDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var note = await _context.DeliveryNotes
                .Include(dn => dn.DeliveryNoteItems)
                .FirstOrDefaultAsync(dn => dn.Id == id);

            if (note == null) return NotFound();

            // Managers and employees cannot edit once an invoice has been linked
            if ((User.IsInRole("Manager") || User.IsInRole("Employee")) && note.InvoiceId.HasValue)
            {
                return BadRequest(new { message = "Document is locked: Invoice already generated." });
            }

            note.Number = dto.Number ?? note.Number;
            note.Date = dto.Date.ToUniversalTime();
            note.ClientId = dto.ClientId ?? note.ClientId;
            note.UpdatedAt = DateTime.UtcNow;

            // Replace items
            _context.DeliveryNoteItems.RemoveRange(note.DeliveryNoteItems);
            if (dto.DeliveryNoteItems != null)
            {
                foreach (var item in dto.DeliveryNoteItems)
                {
                    note.DeliveryNoteItems.Add(new DeliveryNoteItem
                    {
                        Description = item.Description,
                        Quantity = item.Quantity,
                        TotalEstimated = item.Quantity * 0
                    });
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Updated delivery note {Id}: {Number}", note.Id, note.Number);

            return NoContent();
        }

        // DELETE: api/deliverynotes/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDeliveryNote(int id)
        {
            var note = await _context.DeliveryNotes.FindAsync(id);
            if (note == null) return NotFound();

            // Block deletion if linked to a paid invoice
            if (note.InvoiceId.HasValue)
            {
                var linkedInvoice = await _context.Invoices
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.Id == note.InvoiceId.Value);
                if (linkedInvoice?.Status == "Paid")
                {
                    return BadRequest(new { message = "Cannot delete a delivery note linked to a paid invoice." });
                }
            }

            // Soft delete
            note.IsDeleted = true;
            note.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft-deleted delivery note {Id}", id);

            return NoContent();
        }

        // GET: api/deliverynotes/{id}/pdf
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> GetPdf(int id)
        {
            var note = await _context.DeliveryNotes
                .Include(dn => dn.Client)
                .Include(dn => dn.DeliveryNoteItems)
                .Include(dn => dn.Devis)
                .FirstOrDefaultAsync(dn => dn.Id == id);

             if (note == null) return NotFound();

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
                currencyOverride: note.Devis?.CurrencySymbol,
                languageOverride: note.Devis?.PdfLanguage);

            var document = new Document<DeliveryNote>(note, pdfSettings);
            byte[] pdfData;
            try
            {
                pdfData = document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PDF generation failed for delivery note {DeliveryNoteId}", note.Id);
                return StatusCode(500, new { message = "Failed to generate PDF" });
            }

            // Auto-register PDF in local storage
            try
            {
                await _pdfStorageService.SaveClientPdfAsync(
                    pdfData,
                    note.Number ?? $"BL-{note.Id}",
                    PdfDocumentType.DeliveryNote,
                    note.Client?.Name ?? "Unknown",
                    company?.Name ?? "Default",
                    note.Date,
                    note.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-register PDF for delivery note {NoteId}", note.Id);
            }

            return File(pdfData, "application/pdf", $"BL_{note.Number}.pdf");
        }

        private async Task<string> GenerateNextDeliveryNoteNumberAsync(int companyId, int year)
        {
            var yearSuffix = (year % 100).ToString("D2");
            var prefix = $"BL{yearSuffix}-";

            var existingNumbers = await _context.DeliveryNotes
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(dn => dn.CompanyId == companyId && dn.Date.Year == year && dn.Number.StartsWith(prefix))
                .Select(dn => dn.Number)
                .ToListAsync();

            var maxSequence = 0;
            foreach (var number in existingNumbers)
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
