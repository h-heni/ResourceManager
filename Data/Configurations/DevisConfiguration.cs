using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;
namespace ResourceManager.Data.Configurations
{
    public class DevisConfiguration : IEntityTypeConfiguration<Devis>
    {
        public void Configure(EntityTypeBuilder<Devis> builder)
        {
            // Devis -> Invoice (optional)

            builder.HasMany(d => d.DevisItems)
                .WithOne(di => di.Devis)
                .HasForeignKey(di => di.DevisId);
        }
    }
}
