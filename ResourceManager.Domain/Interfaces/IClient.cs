namespace ResourceManager.Domain.Interfaces;

/// <summary>
/// Contract for client-like entities (Client, Company).
/// Used for polymorphic PDF generation.
/// </summary>
public interface IClient
{
    string Name { get; set; }
    string Address { get; set; }
    string TaxId { get; set; }
    string Phone { get; set; }
}
