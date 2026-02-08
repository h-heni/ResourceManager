using System.ComponentModel.DataAnnotations.Schema;

namespace ResourceManager.Models
{
    public interface IItem
    {
        public int Id { get; set; }
        string Description { get; set; }
        decimal? Price { get; set; }
        int? Quantity { get; set; }
        decimal? TaxRate { get; }
        public decimal TotalItemHT { get;}
        public decimal ItemTaxAmount { get;}

    }

}