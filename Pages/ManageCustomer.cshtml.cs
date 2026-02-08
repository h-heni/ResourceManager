using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using ResourceManager.Data;
using ResourceManager.Models;
using ResourceManager.Services;
using System.ComponentModel.DataAnnotations;

public class ManageCustomerModel : PageModel
{
    private readonly AppDbContext _context;
    private readonly Crud _crud;
    private readonly ClientCache _clientCache;
    private readonly FournisseurCache _fournisseur;
    private readonly Time _time;

    public ManageCustomerModel(AppDbContext context, Crud crud, ClientCache clientCache, Time time, FournisseurCache fournisseur)
    {
        _context = context;
        _crud = crud;
        _clientCache = clientCache;
        _time = time;
        _fournisseur = fournisseur;
    }

    [TempData]
    public string SuccessMessage { get; set; } = string.Empty;
    [TempData]
    public string FailedMessage { get; set; } = string.Empty;

    [BindProperty]
    [Required(ErrorMessage = "Please select a client.")]
    public string SelectedClientName { get; set; } = string.Empty;

    [BindProperty]
    [Required(ErrorMessage = "Choose a field to update.")]
    public string FieldToUpdate { get; set; } = string.Empty;

    // Possible new values (one will be used depending on FieldToUpdate)
    [BindProperty]
    public string NewName { get; set; } = string.Empty;

    [BindProperty]
    public string NewAddress { get; set; } = string.Empty;

    [BindProperty]
    public string NewMatriculeFiscal { get; set; } = string.Empty;

    [BindProperty]
    public string NewPhone { get; set; } = string.Empty;
    [BindProperty]
    public Client Client { get; set; } = new Client();

    public SelectList ClientSelectList { get; set; } = new SelectList(Array.Empty<string>());

    // --- FOURNISSEUR PROPERTIES ---
    [BindProperty] public string SelectedFournisseurName { get; set; } = string.Empty;
    public SelectList FournisseurSelectList { get; set; } = null!;

    [BindProperty] public string FournisseurFieldToUpdate { get; set; } = string.Empty;
    [BindProperty] public string NewFournisseurName { get; set; } = string.Empty;
    [BindProperty] public string NewFournisseurAddress { get; set; } = string.Empty;

    [BindProperty] public Fournisseur NewFournisseur { get; set; } = new();

    public void OnGetAsync()
    {
        ClientSelectList = new SelectList(_clientCache.GetAll());
        FournisseurSelectList= new SelectList(_fournisseur.GetAll());
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var now = _time.GetTunisNow();
        ClientSelectList = new SelectList( _clientCache.GetAll());


        var client = await _context.Clients.FirstOrDefaultAsync(c => c.Name == SelectedClientName);
        if (client == null)
        {
            ModelState.AddModelError(string.Empty, "Selected client not found.");
            return Page();
        }

        switch (FieldToUpdate)
        {
            case "Name":
                if (string.IsNullOrWhiteSpace(NewName))
                {
                    ModelState.AddModelError(nameof(NewName), "New name is required.");
                    return Page();
                }

                // update cache: remove old key, add new key
                var oldName = client.Name;
                client.Name = NewName.Trim();
                client.UpdatedAt = now;
                await _context.SaveChangesAsync();

                _clientCache.Remove(oldName);
                _clientCache.Add(client.Name);
                break;

            case "Address":
                if (string.IsNullOrWhiteSpace(NewAddress))
                {
                    ModelState.AddModelError(nameof(NewAddress), "New address is required.");
                    return Page();
                }

                client.Address = NewAddress.Trim();
                client.UpdatedAt = now;
                await _context.SaveChangesAsync();
                break;

            case "MatriculeFiscal":
                if (string.IsNullOrWhiteSpace(NewMatriculeFiscal))
                {
                    ModelState.AddModelError(nameof(NewMatriculeFiscal), "New matricule fiscal is required.");
                    return Page();
                }

                client.MatriculeFiscal = NewMatriculeFiscal.Trim();
                client.UpdatedAt = now;
                await _context.SaveChangesAsync();
                break;

            case "Phone":
                if (string.IsNullOrWhiteSpace(NewPhone))
                {
                    ModelState.AddModelError(nameof(NewPhone), "New phone number is required.");
                    return Page();
                }

                client.Phone = NewPhone.Trim();
                client.UpdatedAt = now;
                await _context.SaveChangesAsync();
                break;

            default:
                ModelState.AddModelError(nameof(FieldToUpdate), "Unknown field to update.");
                return Page();
        }

        SuccessMessage = "Client mis � jour avec succ�s.";
        return RedirectToPage();
    }

    // Handler for the delete button (form posts with ?handler=Delete)
    public async Task<IActionResult> OnPostDeleteAsync()
    {
        ClientSelectList = new SelectList(_clientCache.GetAll());

        if (string.IsNullOrEmpty(SelectedClientName))
        {
            ModelState.AddModelError("SelectedClientName", "Please select a client to delete.");
            return Page();
        }

        var success = await _crud.DeleteClientByNameAsync(SelectedClientName);
        if (!success)
        {
            ModelState.AddModelError(string.Empty, "Client not found or could not be deleted.");
            return Page();
        }

        SuccessMessage = "Client supprim� avec succ�s.";
        return RedirectToPage();
    }
    public async Task<IActionResult> OnPostCreateAsync()
    {
        // 1. Clear global errors (prevents invisible 'Update' fields from blocking this post)
        ModelState.Clear();

        // 2. Manually validate ONLY the 'Client' property from the modal
        if (!TryValidateModel(Client, nameof(Client)))
        {
            return Page(); // If name/address in modal are missing, show errors in modal
        }

        // 3. Set the creation time using your Tunis time service
        var now = _time.GetTunisNow();
        Client.CreatedAt = now;

        // 4. Save to Database
        _context.Clients.Add(Client);
        await _context.SaveChangesAsync();

        // 5. Update your local cache (if needed)
        _clientCache.Add(Client.Name);

        SuccessMessage = "Client ajout� avec succ�s !";

        // 6. PRG Pattern (Post-Redirect-Get) to refresh the dropdown list
        return RedirectToPage();
    }
    // --- HANDLERS ---
    public async Task<IActionResult> OnPostCreateFournisseurAsync()
    {
        if (string.IsNullOrEmpty(NewFournisseur.Name)) return Page();
        var now = _time.GetTunisNow();
        NewFournisseur.CreatedAt = now;
        _context.Fournisseurs.Add(NewFournisseur);
        await _context.SaveChangesAsync();
        _fournisseur.Add(NewFournisseur.Name);
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteFournisseurAsync()
    {
        var fournisseur = await _context.Fournisseurs.FirstOrDefaultAsync(f => f.Name == SelectedFournisseurName);
        if (fournisseur != null)
        {
            fournisseur.IsDeleted = true;
            fournisseur.DeletedAt = _time.GetTunisNow();
            await _context.SaveChangesAsync();
            _fournisseur.Remove(fournisseur.Name);
            return RedirectToPage();

        }
        return RedirectToPage();
    }
    public async Task<IActionResult> OnPostUpdateFournisseurAsync()
    {
        if (string.IsNullOrEmpty(SelectedFournisseurName))
        {
            ModelState.AddModelError("SelectedFournisseurName", "Veuillez s�lectionner un fournisseur.");
            return Page();
        }

        if (string.IsNullOrEmpty(NewFournisseurName))
        {
            ModelState.AddModelError("NewFournisseurName", "Le nouveau nom est requis.");
            return Page();
        }

        // 3. PROCEED WITH UPDATE
        var fournisseur = await _context.Fournisseurs
            .FirstOrDefaultAsync(f => f.Name == SelectedFournisseurName);

        if (fournisseur != null)
        {
            _fournisseur.Remove(fournisseur.Name);
            _fournisseur.Add(NewFournisseurName);

            fournisseur.Name = NewFournisseurName;
            // fournisseur.Address = NewFournisseurAddress; // (If you kept address)

            await _context.SaveChangesAsync();
            SuccessMessage = "Fournisseur mis � jour avec succ�s.";
        }
        else
        {
            FailedMessage = "Erreur : Fournisseur introuvable.";
        }

        return RedirectToPage();
    }
}

