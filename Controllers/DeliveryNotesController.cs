using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.DTOs;
using ResourceManager.Services;
using Microsoft.AspNetCore.Identity;
using QuestPDF.Fluent;

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
            if (page < 1) page = 1;
            if (size < 1) size = 20;

            var query = _context.DeliveryNotes
                .AsNoTracking()
                .Include(dn => dn.Client)
                .Include(dn => dn.Devis)
                .Include(dn => dn.Invoice)
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
                    ItemsCount = dn.DeliveryNoteItems.Count
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

        // GET: api/deliverynotes/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDeliveryNote(int id)
        {
            var note = await _context.DeliveryNotes
                .Include(dn => dn.Client)
                .Include(dn => dn.DeliveryNoteItems)
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
            // Note: The user provided DeliveryNoteDto in Dtos namespace likely, but I haven't seen it in DTOs folder.
            // I'll check DTOs folder again or create a new DTO if needed.
            // Wait, models.cs showed DeliveryNoteDto? No, list_dir showed DeliveryNoteDto.cs in DTOs.
            
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = _userManager.GetUserId(User);

            var note = new DeliveryNote
            {
                Number = dto.Number ?? $"BL-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                Date = dto.Date.ToUniversalTime(), // Ensure UTC
                ClientId = dto.ClientId, // If linked to Client directly
                InvoiceId = dto.InvoiceId, // Linked Invoice
                // Per-document currency & language
                Currency = dto.Currency,
                CurrencySymbol = dto.CurrencySymbol,
                PdfLanguage = dto.PdfLanguage,
                
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
                        TotalEstimated = item.Quantity * 0 // Price is 0/Unknown usually for DN? 
                        // Model has Price nullable.
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
                    note.ClientId = devis.ClientId; // Get client from Devis
                    devis.Status = "Accepted"; // Change to Accepted when delivery note is created
                    devis.Treated = false; // Not fully treated until Invoice is paid
                    devis.UpdatedAt = DateTime.UtcNow;
                }
            }

            _context.DeliveryNotes.Add(note);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDeliveryNote), new { id = note.Id }, note);
        }

        // GET: api/deliverynotes/{id}/pdf
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> GetPdf(int id)
        {
            var note = await _context.DeliveryNotes
                .Include(dn => dn.Client)
                .Include(dn => dn.DeliveryNoteItems)
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
                currencyOverride: note.CurrencySymbol,
                languageOverride: note.PdfLanguage);

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
    }
}
