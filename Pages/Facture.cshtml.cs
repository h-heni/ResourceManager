using Microsoft.AspNetCore.Components.Web;
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


public class CreateInvoiceModel : PageModel
{
    private readonly AppDbContext _context;
    private readonly Time _time;
    private readonly GoogleIntegrationService _googleService;
    private readonly SupabaseStorageService _storageService;

    //private readonly GoogleService _googleService; // (Assume same code as previous answer)

    public CreateInvoiceModel(AppDbContext context, SupabaseStorageService storageService, GoogleIntegrationService googleService, Time time )
    {
        _context = context;
        _time = time;
        _googleService = googleService;
        _storageService = storageService;
    }
    [BindProperty]
    public string? SelectedDevisNumber { get; set; }
    [BindProperty]
    public string? LastInvoiceNumber { get; set; }
    [BindProperty]
    public string? InvoiceExample { get; set; }
    [BindProperty]
    public string? InvoiceNumber { get; set; }
    [BindProperty] public required ClientInputModel ClientData { get; set; }
    [BindProperty] public List<ItemInputModel> Items { get; set; } = new();
    // New: pending delivery notes that are not treated
    [TempData]
    public string SuccessMessage { get; set; } = string.Empty;
    [TempData]
    public string FailedMessage { get; set; } = string.Empty;
    public List<DeliveryNote> PendingDeliveryNotes { get; set; } = new();
    public SelectList DevisNumber { get; set; } = new SelectList(Array.Empty<string>());

    public async Task OnGetAsync()
    {
        // Initialize one empty row for the view
        if (Items.Count == 0)
            Items.Add(new ItemInputModel());

        // Load delivery notes that are not treated, include items for display
        PendingDeliveryNotes = await _context.DeliveryNotes.Include(d => d.Devis).ThenInclude(i => i!.Client)
            .Include(d => d.DeliveryNoteItems)
            .Where(d => !d.Treated && !d.IsDeleted)
            .OrderBy(d => d.Date)
            .ToListAsync();
        // Populate dropdown from in-memory cache
        DevisNumber = new SelectList(_context.Devis.Where(i=>!i.Treated && !i.IsDeleted).Select(i=>i.Number));
        var stamp = $"{DateTime.Now:yy}";
        LastInvoiceNumber = await _context.Invoices.OrderByDescending(i => i.Id) // or i.CreatedAt
    .Select(i => i.Number)
    .FirstOrDefaultAsync();
        if (string.IsNullOrEmpty(LastInvoiceNumber))
        {
            InvoiceExample = $"FA{stamp}-{01}"; 
        }
        else if(LastInvoiceNumber.Length <= 3)
        {
            InvoiceExample = LastInvoiceNumber.Remove(LastInvoiceNumber.Length- 1) + "X";
        }
        else
        {
            InvoiceExample = LastInvoiceNumber.Remove(LastInvoiceNumber.Length- 2) + "XX";
        }
    }


    public async Task<IActionResult> OnPostAsync()
    {
        if (SelectedDevisNumber == null)
        {
            FailedMessage = "Veuillez s�lectionner un num�ro de devis.";
            return RedirectToPage();
        }
        if (!ModelState.IsValid)
        {
            FailedMessage= "Donn�es invalides. Veuillez v�rifier les informations saisies.";
            await OnGetAsync();
            return RedirectToPage();
        }
        // 1. Bring the Devis
        var devis = await _context.Devis.Where(d => d.Number == SelectedDevisNumber)
            .Include(d => d.Client)
            .Include(d => d.DeliveryNotes)
            .FirstOrDefaultAsync();
        if (devis == null)
        {
            FailedMessage = "Devis non trouv�.";
            await OnGetAsync();
            return RedirectToPage();
        }
        
        var now = _time.GetTunisNow();

        List<InvoiceItem> invoiceItems = Items.Select(i => new InvoiceItem
        {
            Description = i.Description,
            Tva = i.Tva,
            Quantity = i.Quantity,
            Price = i.Price
        }).ToList();
        // 2. Save Invoice
        string month = now.ToString("MMMM", new CultureInfo("fr-FR"));
        string capitalizedMonth = char.ToUpper(month[0]) + month.Substring(1);
        if (string.IsNullOrEmpty(InvoiceNumber))
        {
            FailedMessage = "Saisissez le num�ro de facture!";
            await OnGetAsync();
            return RedirectToPage();
        }
        var invoice= new Invoice(invoiceItems)
        {
            Number = InvoiceNumber ,
            Date = now,
            Client=devis.Client,
            DevisId=devis.Id,
            InvoiceItems = invoiceItems,
            CreatedAt = now,
        

            Treated = true,

        };
        
        // 4. Update the related Devis 
        devis.Treated = true ;
        devis.UpdatedAt = now;
        // 4. Update the related Delivery Notes 

        foreach (var dn in devis.DeliveryNotes)
        {
            dn.Treated = true;
            dn.UpdatedAt = now;
        }


        // Generate PDF and return file for download
        byte[] pdfBytes;
        try
        {
            var document = new Document<Invoice>(invoice);
            // Use PdfService's delivery note generator which expects a DeliveryNote and a Client
            pdfBytes = document.GeneratePdf(); ;
        }
        catch
        {
            // If PDF generation fails, still show success and redirect
            FailedMessage = "Facture a �t� enregistr�, mais la g�n�ration du PDF a �chou�.";
            return RedirectToPage();
        }
        // 1. Define the base path (e.g., inside wwwroot/Clients)
        string exeFolder = AppDomain.CurrentDomain.BaseDirectory;

        string baseFolder = Path.Combine(exeFolder, "Document PDF");

        // 2. Define the client-specific folder name
        // Use Path.GetInvalidFileNameChars to clean the name if it comes from user input
        string clientFolderName = Path.Combine("Clients",invoice.Client?.Name??"Unkown","Facture",capitalizedMonth);
        string targetPath = Path.Combine(baseFolder, clientFolderName);

        // 3. Create the folder if it doesn't exist
        // This line handles the "if it exists, enter it" logic automatically
        Directory.CreateDirectory(targetPath);

        // 4. Save your file into that specific folder
        string fileName = $"{invoice.Number}.pdf";
        string fullPath = Path.Combine(targetPath, fileName);

        await System.IO.File.WriteAllBytesAsync(fullPath, pdfBytes);

        using var stream = new MemoryStream(pdfBytes);

        // 5. Upload to Google Drive
        // Optional: Replace "folder_id_here" with a specific folder ID from Drive URL
        // Open your folder in browser, copy ID from URL: drive.google.com/drive/folders/YOUR_ID_HERE
        //string invoiceRootFolderId = "1jJWKPdul3dQs08-BYtcuT5f9K1DxaiAW";

        // Open your Log Sheet in browser, copy ID from URL: docs.google.com/spreadsheets/d/YOUR_ID_HERE
        string logSpreadsheetId = "1Jd5HuuP0GomMfjbrI2VN9o3ZfVxgsgwYyKMT1Sswzxk";
        int sheetPageName = 1970343371; // The tab name at the bottom

        string supabasePath = clientFolderName.Replace("\\", "/");
        //string finalFolderId = await _googleService.CreateFolderPathAsync(
        //    invoiceRootFolderId,
        //        new[] {"Clients", invoice.Client?.Name??"Unkown", "Facture", capitalizedMonth }); // The path structure you want

        //string fileId = await _googleService.UploadFileToDriveAsync(stream, fileName, "application/pdf", finalFolderId);
        string pdfUrl = await _storageService.UploadPdfAsync(pdfBytes, supabasePath, fileName);

        //string longUrl = $"https://drive.google.com/file/d/{fileId}/view";

        // 2. Create the Formula String
        // We want Excel to see: =HYPERLINK("https://...", "PDF")
        // In C#, we must write \" to put a real quote inside the text.
        string linkFormula = $"=HYPERLINK(\"{pdfUrl}\"; \"{ invoice?.Number}\")";
        try
        {
            

            if (!string.IsNullOrEmpty(logSpreadsheetId))
            {
                // Data to write: Date, Client, Amount, InvoiceLink
                var rowData = new List<object>
                {
                    invoice!.Date.ToString("d",new CultureInfo("fr-FR")),
                    invoice?.Client?.Name??"Unkown",
                    invoice?.InvoiceItems.First().Description??"Pas description",
                    linkFormula ,  // Link to the file we just uploaded
                    invoice?.TotalAmount??0m,
                    

                };

                // "Sheet1" is the specific page name in the Excel file
                await _googleService.WriteToFirstEmptyRowAsync(logSpreadsheetId, sheetPageName, rowData);
            }
        }
        catch (Exception ex)
        {
            // Log error, but maybe don't stop the user if the invoice was created successfully
            Console.WriteLine("Failed to update sheet: " + ex.Message);
        }

        // Set success message and redirect to the same page (clears the form and shows message)
        _context.Add(invoice);
        await _context.SaveChangesAsync();
        SuccessMessage = "Cr�ation et g�n�ration r�ussies du devis au format PDF.";

        HttpContext.Session.Set("DownloadBytes", pdfBytes);
        HttpContext.Session.SetString("DownloadName", fileName);

        // 4. Set Success Message and Flag
        TempData["SuccessMessage"] = "Facture t�l�charg�e sur Drive avec succ�s�!";
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

    // View Models
    public class ClientInputModel
    {
        public string Name { get; set; }= string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
    }
    public class ItemInputModel
    {
        [Required]
        public string Description { get; set; }= string.Empty;
        public bool Tva { get; set; }
        [Required]
        public int Quantity { get; set; }
        [Required]
        public decimal Price { get; set; }
    }
}