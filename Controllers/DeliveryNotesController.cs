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
        private readonly InventoryService _inventoryService;
        private readonly IEmailService _emailService;
        private readonly IWhatsAppService _whatsAppService;

        public DeliveryNotesController(AppDbContext context, UserManager<ApplicationUser> userManager, ILocalPdfStorageService pdfStorageService, ILogger<DeliveryNotesController> logger, InventoryService inventoryService, IEmailService emailService, IWhatsAppService whatsAppService)
        {
            _context = context;
            _userManager = userManager;
            _pdfStorageService = pdfStorageService;
            _logger = logger;
            _inventoryService = inventoryService;
            _emailService = emailService;
            _whatsAppService = whatsAppService;
        }

        // GET: api/deliverynotes
        [HttpGet]
        public async Task<IActionResult> GetDeliveryNotes([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            try
            {
                if (page < 1) page = 1;
                if (size < 1) size = 20;
                if (size > 100) size = 100;

                var query = _context.DeliveryNotes
                    .AsNoTracking()
                    .Include(dn => dn.Client)
                    .Include(dn => dn.Quote)
                    .Include(dn => dn.Invoice)
                    .Include(dn => dn.DeliveryNoteItems)
                    .AsQueryable();

                // Employee role: hide archived (Treated) records
                if (User.IsInRole("Employee"))
                {
                    query = query.Where(dn => !dn.Treated);
                }

                query = query.OrderByDescending(dn => dn.Date);

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(totalCount / (double)size);

                var notes = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Include(dn => dn.CreatedByUser!)
                        .ThenInclude(u => u.Profile)
                    .Select(dn => new {
                        dn.Id,
                        dn.Number,
                        dn.Date,
                        ClientName = dn.Client != null ? dn.Client.Name : "Unknown",
                        dn.TotalAmount,
                        dn.Treated,
                        dn.QuoteId,
                        dn.InvoiceId,
                        QuoteNumber = dn.Quote != null ? dn.Quote.Number : null,
                        InvoiceNumber = dn.Invoice != null ? dn.Invoice.Number : null,
                        ItemsCount = dn.DeliveryNoteItems != null ? dn.DeliveryNoteItems.Count : 0,
                        DeliveryNoteItems = dn.DeliveryNoteItems != null ? dn.DeliveryNoteItems.Select(i => new { i.Description, i.Quantity, i.ProductServiceId }).ToList() : null,
                        CreatedBy = dn.CreatedByUser != null && dn.CreatedByUser.Profile != null
                            ? (dn.CreatedByUser.Profile.FirstName + " " + dn.CreatedByUser.Profile.LastName).Trim()
                            : (dn.CreatedByUser != null ? dn.CreatedByUser.Email : null)
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
                .Include(dn => dn.Quote)
                .Include(dn => dn.CreatedByUser)
                    .ThenInclude(u => u!.Profile)
                .FirstOrDefaultAsync(dn => dn.Id == id);

            if (note == null) return NotFound();

            // Employee role cannot access archived (Treated) delivery notes
            if (User.IsInRole("Employee") && note.Treated)
            {
                return NotFound(new { message = "Delivery note not found or access denied" });
            }

            // Return with createdByUser info for display (firstName + lastName for display name)
            return Ok(new {
                note.Id,
                note.Number,
                note.Date,
                note.ClientId,
                ClientName = note.Client?.Name,
                ClientAddress = note.Client?.Address,
                ClientTaxId = note.Client?.TaxId,
                ClientPhone = note.Client?.Phone,
                note.QuoteId,
                QuoteNumber = note.Quote?.Number,
                note.InvoiceId,
                note.Treated,
                note.CreatedBy,
                note.ModifiedBy,
                DeliveryNoteItems = note.DeliveryNoteItems.Select(i => new {
                    i.Id,
                    i.Description,
                    i.Quantity,
                    i.ProductServiceId
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

            // ═══ INVENTORY: Validate stock before creating delivery note ═══
            var stockItems = dto.DeliveryNoteItems?
                .Where(i => i.ProductServiceId.HasValue && i.Quantity > 0)
                .Select(i => (i.ProductServiceId, i.Quantity))
                .ToList() ?? new List<(int? ProductServiceId, int Quantity)>();

            if (stockItems.Any())
            {
                var insufficientStock = await _inventoryService.ValidateStockForInvoiceAsync(stockItems);
                if (insufficientStock.Any())
                {
                    return BadRequest(new
                    {
                        message = "Insufficient stock. Please update your inventory before creating this delivery note.",
                        insufficientProducts = insufficientStock.Select(s => new
                        {
                            productId = s.ProductId,
                            productName = s.ProductName,
                            requested = s.Requested,
                            available = s.Available
                        })
                    });
                }
            }

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
                            TotalEstimated = item.Quantity * 0,
                            ProductServiceId = item.ProductServiceId
                        });
                    }
                }

                // Link to Quote if provided (REQUIRED for proper flow)
                if (dto.QuoteId.HasValue)
                {
                    var quote = await _context.Quotes.FindAsync(dto.QuoteId.Value);
                    if (quote != null)
                    {
                        note.QuoteId = quote.Id;
                        note.ClientId = quote.ClientId;
                        quote.Status = "Accepted";
                        quote.Treated = false;
                        quote.UpdatedAt = DateTime.UtcNow;
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
                    return Conflict(new { message = "Delivery note number already exists. Please retry." });
                }
                catch (DbUpdateException ex)
                {
                    _context.ChangeTracker.Clear();
                    _logger.LogError(ex, "DbUpdateException creating delivery note. Number={Number}", note.Number);
                    return StatusCode(500, new { message = "Failed to save delivery note. Check server logs for details." });
                }
            }

            if (note == null || note.Id == 0)
            {
                return Conflict(new { message = "Failed to generate a unique delivery note number. Please retry." });
            }

            // ═══ INVENTORY: Auto-deduct stock for tracked products ═══
            try
            {
                await _inventoryService.DeductStockForDeliveryNoteAsync(note.Id, note.Number);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stock deduction failed for delivery note {Number} — note was still created.", note.Number);
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

            // Block editing only if the document is archived
            if (note.Treated)
            {
                return BadRequest(new { message = "Archived documents cannot be modified." });
            }

            note.Number = dto.Number ?? note.Number;
            note.Date = dto.Date.ToUniversalTime();
            note.ClientId = dto.ClientId;
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
                .Include(dn => dn.Quote)
                .FirstOrDefaultAsync(dn => dn.Id == id);

            if (note == null) return NotFound();

            // Employee role cannot access archived (Treated) delivery notes
            if (User.IsInRole("Employee") && note.Treated)
            {
                return NotFound(new { message = "Delivery note not found or access denied" });
            }

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
                currencyOverride: note.Quote?.CurrencySymbol,
                languageOverride: note.Quote?.PdfLanguage);

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

        // POST: api/deliverynotes/{id}/send-email
        [HttpPost("{id}/send-email")]
        public async Task<IActionResult> SendDeliveryNoteEmail(int id, [FromBody] SendDocumentEmailDto dto)
        {
            var note = await _context.DeliveryNotes
                .Include(dn => dn.Client)
                .Include(dn => dn.DeliveryNoteItems)
                .Include(dn => dn.Quote)
                .FirstOrDefaultAsync(dn => dn.Id == id);

            if (note == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var recipientEmail = dto.RecipientEmail ?? note.Client?.Email;
            if (string.IsNullOrEmpty(recipientEmail))
                return BadRequest(new { message = "No recipient email provided and client has no email on file." });

            var company = await _context.Companies.FindAsync(user.CompanyId);
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
            var senderName = userProfile != null ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() : user.UserName ?? "";

            var subject = dto.Subject ?? $"Delivery Note #{note.Number} from {company?.Name ?? "Company"}";
            var body = dto.Body ?? $"<p>Dear {note.Client?.Name ?? "Customer"},</p><p>Please find attached delivery note <strong>#{note.Number}</strong>.</p><p>Best regards,<br/>{company?.Name ?? "Company"}</p>";

            // Generate PDF
            var companySettings = await _context.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == user.CompanyId);
            var pdfSettings = PdfSettings.FromCompanySettings(companySettings, company, senderName,
                currencyOverride: note.Quote?.CurrencySymbol, languageOverride: note.Quote?.PdfLanguage);

            byte[] pdfData;
            try
            {
                var document = new Document<DeliveryNote>(note, pdfSettings);
                pdfData = document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate PDF for delivery note {NoteId}", id);
                return StatusCode(500, new { message = "Failed to generate PDF" });
            }

            var audit = new DocumentSendAudit
            {
                DocumentType = "DeliveryNote",
                DocumentId = id,
                DocumentNumber = note.Number,
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
                attachPdf ? pdfData : null, attachPdf ? $"DeliveryNote-{note.Number}.pdf" : null);

            audit.Status = result.Success ? "Sent" : "Failed";
            audit.ErrorMessage = result.Success ? null : (result.ErrorDetails ?? result.Message);
            audit.MessageId = result.MessageId;
            await _context.SaveChangesAsync();

            if (result.Success)
            {
                _logger.LogInformation("Delivery note {NoteId} email sent to {Email}", id, recipientEmail);
                return Ok(new { message = result.Message, auditId = audit.Id, status = audit.Status });
            }
            return StatusCode(500, new { message = result.Message, auditId = audit.Id, status = audit.Status, errorDetails = result.ErrorDetails });
        }

        // POST: api/deliverynotes/{id}/send-whatsapp
        [HttpPost("{id}/send-whatsapp")]
        public async Task<IActionResult> SendDeliveryNoteWhatsApp(int id, [FromBody] SendDocumentWhatsAppDto? dto = null)
        {
            try
            {
                var note = await _context.DeliveryNotes
                    .Include(dn => dn.Client)
                    .FirstOrDefaultAsync(dn => dn.Id == id);

                if (note == null) return NotFound(new { message = "Delivery note not found" });
                if (note.Client == null) return BadRequest(new { message = "Client not found for this delivery note" });
                if (string.IsNullOrEmpty(note.Client.Phone))
                    return BadRequest(new { message = "Client phone number is required for WhatsApp sharing." });

                var userId = _userManager.GetUserId(User);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                var user = await _userManager.FindByIdAsync(userId);
                if (user == null) return Unauthorized();

                var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
                var senderName = userProfile != null ? $"{userProfile.FirstName} {userProfile.LastName}".Trim() : user.UserName ?? "";

                var request = HttpContext.Request;
                var baseUrl = $"{request.Scheme}://{request.Host}";
                var pdfUrl = $"{baseUrl}/api/DeliveryNotes/{id}/pdf";

                var result = await _whatsAppService.SendDocumentMessageAsync(
                    note.Client.Phone, pdfUrl, $"DeliveryNote-{note.Number}.pdf", dto?.CustomMessage);

                var audit = new DocumentSendAudit
                {
                    DocumentType = "DeliveryNote",
                    DocumentId = id,
                    DocumentNumber = note.Number,
                    Channel = "WhatsApp",
                    RecipientPhone = note.Client.Phone,
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
                _logger.LogError(ex, "Failed to send WhatsApp message for delivery note {NoteId}", id);
                return StatusCode(500, new { message = "Failed to send WhatsApp message" });
            }
        }

        // GET: api/deliverynotes/{id}/send-history
        [HttpGet("{id}/send-history")]
        public async Task<IActionResult> GetDeliveryNoteSendHistory(int id)
        {
            var note = await _context.DeliveryNotes.AsNoTracking().FirstOrDefaultAsync(dn => dn.Id == id);
            if (note == null) return NotFound();

            var history = await _context.DocumentSendAudits
                .Where(a => a.DocumentType == "DeliveryNote" && a.DocumentId == id)
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
