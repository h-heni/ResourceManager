using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class DeleveryNoteConfiguration:IEntityTypeConfiguration<DeliveryNote>
    {
        public void Configure(EntityTypeBuilder<DeliveryNote> builder)
        {
            // DeliveryNote -> Invoice
            builder.HasOne(dn => dn.Devis)
                .WithMany(i => i.DeliveryNotes)
                .HasForeignKey(dn => dn.DevisId);
            builder.HasMany(d=>d.DeliveryNoteItems)
                .WithOne(dni => dni.DeliveryNote)
                .HasForeignKey(dni => dni.DeliveryNoteId);
        }
    }
}
