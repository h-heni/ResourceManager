using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;
using QuestPDF.Fluent;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Threading.Tasks;

public class DeliveryNoteModel : PageModel
{
    private readonly AppDbContext _context;
    private readonly Time _time;
    private readonly SupabaseStorageService _storageService;


    public DeliveryNoteModel(AppDbContext context, SupabaseStorageService storageService, Time time)
    {
        _context = context;
        _time = time;
        _storageService = storageService;
    }

    [TempData]
    public string SuccessMessage { get; set; } = string.Empty;
    [TempData]
    public string FailedMessage { get; set; } = string.Empty;
    [TempData]
    public string DownloadFileId { get; set; } = string.Empty;

    // Select the Invoice to attach this delivery note to
    [BindProperty]
    public Devis Devis { get; set; } = new Devis();
    [BindProperty]
    [Required(ErrorMessage = "Please select an invoice.")]
    public int SelectedDevisId { get; set; }

    // Input rows for delivery items
    [BindProperty]
    public List<DeliveryItemInputModel> DeliveryItems { get; set; } = new ();

    public SelectList DevisSelectList { get; set; } = new SelectList(Array.Empty<object>());
    public List<Devis> PendingDevis { get; set; } = new ();
    public async Task OnGetAsync()
    {

        PendingDevis = await _context.Devis
            .Where(d => d.Treated == false && d.IsDeleted==false)
            .Include(d => d.Client)
            .Include(d => d.Invoice)
            .Include(d=> d.DevisItems)
            .ToListAsync();
        var devis = PendingDevis.Select(d => new { 
                            d.Id,
            DevisNumber = d.Number?? " Pas de ^Devis"
        }).ToList()?? new();
        DevisSelectList = new SelectList(devis, "Id", "DevisNumber");

        // Ensure at least one row is rendered so tag-helpers can emit validation attributes
        DeliveryItems ??= new List<DeliveryItemInputModel>(); 
        if (!DeliveryItems.Any()) DeliveryItems.Add(new DeliveryItemInputModel());
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            FailedMessage = "La cr�ation du bon de livraison a �chou�. Veuillez v�rifier les erreurs ci-dessous.";
            await OnGetAsync();
            return RedirectToPage();
        }

        var devis = await _context.Devis.Include(i => i.Client)
            .FirstOrDefaultAsync(i => i.Id == SelectedDevisId);

        if (devis == null)
        {
            FailedMessage = "Le devis s�lectionn� est introuvable.";
            return RedirectToPage();
        }
        var now = _time.GetTunisNow();
        string month = now.ToString("MMMM", new CultureInfo("fr-FR"));

        // 3. Capitalize the first letter (Result: "Janvier")
        string capitalizedMonth = char.ToUpper(month[0]) + month.Substring(1);
        // Create DeliveryNote
        var stamp = $"{now:MMddHHmmss}-{now:yy}";
        var noteNumber = $"BL-{stamp}";

        var deliveryNote = new DeliveryNote
        {
            Number = noteNumber,
            Date = now,
            DevisId = devis.Id,
            ClientId=devis.ClientId,
            DeliveryNoteItems = DeliveryItems.Select(i => new DeliveryNoteItem
            {
                Description = char.ToUpper(i.Description[0]) + i.Description.Substring(1),
                Quantity = i.Quantity ?? 0
            }).ToList(),
            CreatedAt = now
        };

        _context.DeliveryNotes.Add(deliveryNote);
        await _context.SaveChangesAsync();

        // Generate PDF and return file for download
        byte[] pdfBytes;
        try
        {
            var document = new Document<DeliveryNote>(deliveryNote);
            // Use PdfService's delivery note generator which expects a DeliveryNote and a Client
            pdfBytes = document.GeneratePdf(); ;
        }
        catch (Exception)
        {
            // If PDF generation fails, still show success and redirect
            FailedMessage = "Bon de livraison enregistr�, mais la g�n�ration du PDF a �chou�.";
            return RedirectToPage();
        }
        // 1. Define the base path (e.g., inside wwwroot/Clients)
        string exeFolder = AppDomain.CurrentDomain.BaseDirectory;

        string baseFolder = Path.Combine(exeFolder, "Document PDF");

        // 2. Define the client-specific folder name
        // Use Path.GetInvalidFileNameChars to clean the name if it comes from user input
        string commonPath = Path.Combine( "Clients",devis.Client?.Name??"Unknown", "Bon de Livraison", capitalizedMonth);
        string targetPath = Path.Combine(baseFolder, commonPath);

        // 3. Create the folder if it doesn't exist
        // This line handles the "if it exists, enter it" logic automatically
        Directory.CreateDirectory(targetPath);

        // 4. Save your file into that specific folder
        string fileName = $"{deliveryNote.Number}.pdf";
        string fullPath = Path.Combine(targetPath, fileName);

        await System.IO.File.WriteAllBytesAsync(fullPath, pdfBytes);

        SuccessMessage = "Cr�ation et g�n�ration r�ussie du Bon de livraison au format PDF.";


        // 5. Upload to Google Drive

        //using var stream = new MemoryStream(pdfBytes);
        //string invoiceRootFolderId = "1jJWKPdul3dQs08-BYtcuT5f9K1DxaiAW";
        //string finalFolderId = await _googleService.CreateFolderPathAsync(
        //    invoiceRootFolderId,
        //        new[] { "Clients", invoice.Client?.Name??"Unnokwn", "BL", capitalizedMonth });
        //await _googleService.UploadFileToDriveAsync(stream, fileName, "application/pdf", finalFolderId);
        string pdfUrl = await _storageService.UploadPdfAsync(pdfBytes, commonPath, fileName);

        HttpContext.Session.Set("DownloadBytes", pdfBytes);
        HttpContext.Session.SetString("DownloadName", fileName);

        // 4. Set Success Message and Flag
        TempData["SuccessMessage"] = "Bon de livraison t�l�charg� sur Drive avec succ�s�!";
        TempData["TriggerDownload"] = true; // This tells the HTML to start downloading

        // 5. Reload the page (Post-Redirect-Get pattern)
        return RedirectToPage();
    }
    public IActionResult OnGetDownloadFile()
    {
        // Retrieve bytes from Session
        byte[] bytes = HttpContext.Session.Get("DownloadBytes")?? Array.Empty<byte>();
        string fileName = HttpContext.Session.GetString("DownloadName")?? string.Empty;

        if (bytes == null || fileName == null)
        {
            return NotFound(); // Session expired or file missing
        }

        // Clean up session so it doesn't download again on refresh
        HttpContext.Session.Remove("DownloadBytes");
        HttpContext.Session.Remove("DownloadName");

        // Return the file
        return File(bytes, "application/pdf", fileName);
    }
    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var devis =await _context.Devis.Include(d => d.Invoice).Include(d=>d.Client).Where(d => d.Id == id).FirstOrDefaultAsync();
        if (devis is null)
        {
            FailedMessage = "la suppression du devis a �chou�.";
            return RedirectToPage();
        }
        var now = _time.GetTunisNow();

        devis.DeletedAt= now;
        devis.IsDeleted= true;
        devis.Invoice!.DeletedAt= now;
        devis.Invoice!.IsDeleted = true;
        //tring rootFolderId = "1jJWKPdul3dQs08-BYtcuT5f9K1DxaiAW"; // The ID of your main "Invoices" folder
        string month = devis.CreatedAt.ToString("MMMM", new CultureInfo("fr-FR"));

        // 3. Capitalize the first letter (Result: "Janvier")
        string capitalizedMonth = char.ToUpper(month[0]) + month.Substring(1);
        // The path where the file is supposed to be
        //string[] path = new[] { "Clients", devis.Client?.Name ?? "Unknown", "Devis", capitalizedMonth };
        string fileName = $"{devis.Number}.pdf";
        string windowsPath = Path.Combine("Clients", devis.Client?.Name ?? "Unknown", "Devis", capitalizedMonth, fileName);
        string supabasePath = windowsPath.Replace("\\", "/");

        await _storageService.DeleteFileAsync(supabasePath);
        //try
        //{
        //    await _googleService.DeleteFileByPathAsync(rootFolderId, path, fileName);
        //}
        //catch (Exception ex)
        //{
        //    // Handle error (e.g., file didn't exist)
        //    Console.WriteLine(ex.Message);
        //}
        _context.Devis.Update(devis);
        _context.SaveChanges();
        SuccessMessage = "Devis supprim� avec succ�s.";
        return RedirectToPage();
    
    }


    public class DeliveryItemInputModel
    {
        [Required(ErrorMessage = "Description is required")]
        public string Description { get; set; }= string.Empty;

        [Required(ErrorMessage = "Quantit� est obligatoire")]
        public int? Quantity { get; set; }
    }
}