namespace ResourceManager.Models
{
    public interface IClient
    {
        string Address { get; set; }
        string MatriculeFiscal { get; set; }
        string Name { get; set; }
        string Phone { get; set; }
    }
}