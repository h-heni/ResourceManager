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
using System.IO;


public class CreateDevisModel : PageModel
{
    private readonly AppDbContext _context;
    private readonly Time _time;
    private readonly ClientCache _clientCache;
    private readonly SupabaseStorageService _storageService; 


    public CreateDevisModel(AppDbContext context,SupabaseStorageService storageService, Crud crud, Time time, ClientCache clientCache)
    {
        _context = context;
        _time = time;
        _clientCache = clientCache;
        _storageService = storageService;
    }
    // TempData-backed success message shown after redirect
    [BindProperty]
    public  string ClientName { get; set; }= string.Empty;
    [TempData]
    public string SuccessMessage { get; set; } = string.Empty;
    [TempData]
    public string FailedMessage { get; set; } = string.Empty;
    [BindProperty] public List<ItemInputModel> Items { get; set; } = new();
    public SelectList ClientSelectList { get; set; } = new SelectList(Array.Empty<string>());


    public void OnGet()
    {
        // Initialize one empty row for the view
        ClientSelectList = new SelectList(_clientCache.GetAll());
        
        Items ??= new List<ItemInputModel>();

        if (!Items.Any())
        {
            Items.Add(new ItemInputModel());
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {

        if (!ModelState.IsValid)
        {
            OnGet();
            return RedirectToPage();
        }
        ;
        //var nextId = _context.Database
        //                            .SqlQuery<int>($@"SELECT NEXT VALUE FOR InvoiceSeq AS Value")
        //                            .ToList() // Execute the query
        //                            .Single(); // Get the single result

        var now = _time.GetTunisNow();
        string month = now.ToString("MMMM", new CultureInfo("fr-FR"));

        // 3. Capitalize the first letter (Result: "Janvier")
        string capitalizedMonth = char.ToUpper(month[0]) + month.Substring(1);
        var client = _context.Clients.FirstOrDefault(c => c.Name == ClientName);
        if (client is null)
        {
            FailedMessage = "Client non trouv�.";
            return RedirectToPage();
        }
        
        var devisItems = Items.Select(i => new DevisItem
        {
            Description = char.ToUpper(i.Description[0]) + i.Description.Substring(1),
            Tva = i.Tva,
            Quantity = i.Quantity,
            Price = i.Price
        }).ToList();
        // 1. Devis Invoice
        var devis = new Devis(devisItems)
        {
            Number = "Dev-"+client.Id + now.Ticks.ToString().Substring(12), // Simple ID generation
            Date = now,
            CreatedAt = now,
            ClientId = client.Id,
        };
        try
        {
            _context.Devis.Add(devis);
            await _context.SaveChangesAsync();
        }
        catch
        {
            // If PDF generation fails, still show success and redirect
            FailedMessage = "Devis n'a pas �t� enregistr�";
            OnGet();
            return RedirectToPage();
        }
        // Generate PDF and return file for download
        byte[] pdfBytes;
        try
        {
            var document = new Document<Devis>(devis);
            // Use PdfService's delivery note generator which expects a DeliveryNote and a Client
            pdfBytes = document.GeneratePdf(); ;
        }
        catch
        {
            // If PDF generation fails, still show success and redirect
            FailedMessage = "Devis a �t� enregistr�, mais la g�n�ration du PDF a �chou�.";
            OnGet();
            return RedirectToPage();
        }
        // 1. Define the base path (e.g., inside wwwrootf/Clients)
        string exeFolder = AppDomain.CurrentDomain.BaseDirectory;

        string baseFolder = Path.Combine(exeFolder, "Document PDF");

        // 2. Define the client-specific folder name
        // Use Path.GetInvalidFileNameChars to clean the name if it comes from user input
        string commonPath = Path.Combine("Clients", client.Name, "Devis", capitalizedMonth);
        string targetPath = Path.Combine(baseFolder, commonPath);

        // 3. Create the folder if it doesn't exist
        // This line handles the "if it exists, enter it" logic automatically
        Directory.CreateDirectory(targetPath);

        // 4. Save your file into that specific folder
        string fileName = $"{devis.Number}.pdf";
        string fullPath = Path.Combine(targetPath, fileName);

        await System.IO.File.WriteAllBytesAsync(fullPath, pdfBytes);



        // 5. Upload to Google Drive

        //using var stream = new MemoryStream(pdfBytes);
        //string invoiceRootFolderId = "1jJWKPdul3dQs08-BYtcuT5f9K1DxaiAW";
        //string finalFolderId = await _googleService.CreateFolderPathAsync(
        //    invoiceRootFolderId,
        //        new[] { "Clients", invoice.Client?.Name ?? "Unkown", "Devis", capitalizedMonth });
        //await _googleService.UploadFileToDriveAsync(stream, fileName, "application/pdf", finalFolderId);

        //StatusMessage = "Cr�ation et g�n�ration r�ussies du devis au format PDF.";
        //try
        //{

        //}
        string pdfUrl = await _storageService.UploadPdfAsync(pdfBytes, commonPath, fileName);
        //catch
        //{
        //    FailedMessage = "Devis a �t� enregistr�, mais l UPLOAD du PDF a �chou�";
        //    OnGet();
        //    return RedirectToPage();
        //}


        HttpContext.Session.Set("DownloadBytes", pdfBytes);
        HttpContext.Session.SetString("DownloadName", fileName);

        // 4. Set Success Message and Flag
        SuccessMessage = "Devis t�l�charg� avec succ�s�!";
        TempData["TriggerDownload"] = true; // This tells the HTML to start downloading

        // 5. Reload the page (Post-Redirect-Get pattern)
        return RedirectToPage();
    }
    public IActionResult OnGetDownloadFile()
    {
        // Retrieve bytes from Session
        byte[] bytes = HttpContext.Session.Get("DownloadBytes")?? Array.Empty<byte>();
        string fileName = HttpContext.Session.GetString("DownloadName") ?? string.Empty;

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

    // View Models

    public class ItemInputModel
    {
        [Required (ErrorMessage ="la description est obligatoire")]
        public  string Description { get; set; }= string.Empty;
        [Required (ErrorMessage ="TVA est obligatoire")]
        public bool Tva { get; set; }
        [Required(ErrorMessage = "la quantit� est obligatoire")]
        public int? Quantity { get; set; }
        [Required (ErrorMessage = "le prix est obligatoire")]
        public decimal? Price { get; set; }
    }
}