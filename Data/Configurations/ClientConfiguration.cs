using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class ClientConfiguration : IEntityTypeConfiguration<Client>
    {
        public void Configure(EntityTypeBuilder<Client> builder)
        {
            builder.HasMany(c => c.Invoices)
                .WithOne(i => i.Client)
                .HasForeignKey(i => i.ClientId);
            builder.HasMany(c => c.Quotes)
                .WithOne(d => d.Client)
                .HasForeignKey(d => d.ClientId);
            builder.HasMany(c => c.DeliveryNotes)
                .WithOne(d => d.Client)
                .HasForeignKey(d => d.ClientId);
            builder.HasKey(c=>c.Id);
            //builder.HasData(
            //   [
            //    new Client
            //    {
            //        Id = 1,
            //        Name = "Ste Xen Plus",
            //        Address = "18, Mohamed Triki, Ennasr 2 2001",
            //        TaxId = "1452393/C/MA/000",
            //        NumTel = "(+216) 28 227 508",
            //        CreatedAt = DateTime.UtcNow
            //    },
            //    new Client
            //    {
            //        Id = 2,
            //        Name = "Ste Om El Khir",
            //        Address = "Khaiereddine Bacha RET Bizerte Km5 2094",
            //        TaxId = "1422362/D/M/A/000",
            //        NumTel = "(+216) 20 953 633",
            //        CreatedAt = DateTime.UtcNow
            //    },
            //    new Client
            //    {
            //        Id = 3,
            //        Name = "Ste Le delice de Maman",
            //        Address = "Sidi Thabet, Km1",
            //        TaxId = "1203978/M/A/000",
            //        NumTel = "(+216) 70 553 682",
            //        CreatedAt = DateTime.UtcNow
            //    }
            //    ]
            //);
                        
        }
    }
}
