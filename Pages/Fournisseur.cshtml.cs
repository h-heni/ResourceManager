using Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;
using QuestPDF.Fluent;
using System.Globalization;
using System.IO;

public class AttachFournisseurPdfModel : PageModel
{
    private readonly AppDbContext _context;
    private readonly ClientCache _clientCache; 
    private readonly FournisseurCache _FournisseurCache; 
    private readonly Time _time ;
    private readonly SupabaseStorageService _storageService;


    public AttachFournisseurPdfModel(AppDbContext context, SupabaseStorageService storageService, ClientCache clientCache,FournisseurCache fournisseurCache, Time time)
    {
        _context = context;
        _clientCache = clientCache;
        _time = time;
        _FournisseurCache = fournisseurCache;
        _storageService = storageService;

    }

    [BindProperty] public string? SelectedFournisseurName { get; set; }
    [BindProperty] public int? SelectedInvoiceId { get; set; }
    [BindProperty] public string SelectedClientName { get; set; } = string.Empty;

    public List<string> ClientNameList { get; set; } = new();
    public SelectList Fournisseurs { get; set; } = new SelectList(Array.Empty<string>());
    [TempData]
    public string SuccessMessage { get; set; } = string.Empty;
    [TempData]
    public string FailedMessage { get; set; } = string.Empty;

    public void OnGetAsync()
    {
        Fournisseurs = new SelectList(_FournisseurCache.GetAll());
        ClientNameList = _clientCache.GetAll().ToList(); 
    }

    // AJAX Handler: Filters invoices without refreshing the whole page
    public async Task<IActionResult> OnGetFilterInvoicesAsync(string clientName, DateTime start, DateTime end)
    {
        var invoices = await _context.Invoices
            .Include(i => i.Client)
            .Where(i => i.Client.Name == clientName && i.Date >= start && i.Date <= end.AddDays(1))
            .OrderByDescending(i => i.Date)
            .ToListAsync();

        return Partial("_InvoiceListPartial", invoices);
    }

    public async Task<IActionResult> OnPostUploadAsync(IFormFile PdfUpload)
    {
        if (PdfUpload == null || string.IsNullOrEmpty(SelectedFournisseurName))
        {
            OnGetAsync();
        }
        string invoiceNumber =await _context.Invoices.Where(i=>i.Id==SelectedInvoiceId).Select(i=>i.Number).FirstOrDefaultAsync()??"" ;
        int fournisseurId =await _context.Fournisseurs.Where(i=>i.Name== SelectedFournisseurName).Select(i=>i.Id).FirstOrDefaultAsync() ;
        var now = _time.GetTunisNow();
        string month = now.ToString("MMMM", new CultureInfo("fr-FR"));
        string capitalizedMonth = char.ToUpper(month[0]) + month.Substring(1);
        string exeFolder = AppDomain.CurrentDomain.BaseDirectory;
        string baseFolder = Path.Combine(exeFolder, "Document PDF", "Fournisseurs", SelectedFournisseurName, capitalizedMonth);
        string commonPath = Path.Combine("Fournisseurs", SelectedFournisseurName, capitalizedMonth);
        // Generate PDF and return file for download

        // 3. Create the folder if it doesn't exist
        // This line handles the "if it exists, enter it" logic automatically
        Directory.CreateDirectory(baseFolder);

        // 4. Save your file into that specific folder
        string fileName = PdfUpload.FileName;
        string fullPath = Path.Combine(baseFolder, fileName);

        //using (var fileStream = new FileStream(fullPath, FileMode.Create))
        //{
        //    await PdfUpload.CopyToAsync(fileStream);
        //    5.Upload to Google Drive

        //    string invoiceRootFolderId = "1jJWKPdul3dQs08-BYtcuT5f9K1DxaiAW";
        //    string finalFolderId = await _googleService.CreateFolderPathAsync(
        //        invoiceRootFolderId,
        //            new[] { "Fournisseurs", SelectedFournisseurName, capitalizedMonth }); // The path structure you want

        //    string fileId = await _googleService.UploadFileToDriveAsync(fileStream, fileName, "application/pdf", finalFolderId);

        //}
        try
        {
            byte[] fileBytes;
            using (var ms = new MemoryStream())
            {
                await PdfUpload.CopyToAsync(ms);
                fileBytes = ms.ToArray();
            }
            await System.IO.File.WriteAllBytesAsync(fullPath, fileBytes);
            string pdfUrl = await _storageService.UploadPdfAsync(fileBytes, commonPath, fileName);
            var fournisseurInvoice = new FournisseurInvoice
            {
                FileName = PdfUpload.FileName,
                FilePath = fullPath,
                FournisseurId = fournisseurId,
                InvoiceId = SelectedInvoiceId, // Linked from the AJAX-generated dropdown
                CreatedAt = now,
                InvoiceNumber = invoiceNumber
            };

            _context.FournisseurInvoices.Add(fournisseurInvoice);
            await _context.SaveChangesAsync();
            SuccessMessage = "Facture fournisseur t�l�charg�e avec succ�s�!";

            return RedirectToPage();
        }
        catch
        {
            FailedMessage = "Facture client n'a pas �t� enregistr�";
            return RedirectToPage();

        }
    }
}
