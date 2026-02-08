using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class FournisseurConfiguration: IEntityTypeConfiguration<Fournisseur>
    {
        public void Configure(EntityTypeBuilder<Fournisseur> builder)
        {
            builder.HasMany(f => f.FournisseurInvoices)
                   .WithOne(fi => fi.Fournisseur)
                   .HasForeignKey(fi => fi.FournisseurId);
        }
    }
}
