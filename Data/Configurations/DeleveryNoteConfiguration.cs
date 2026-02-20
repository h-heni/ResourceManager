using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class DeleveryNoteConfiguration:IEntityTypeConfiguration<DeliveryNote>
    {
        public void Configure(EntityTypeBuilder<DeliveryNote> builder)
        {
            // DeliveryNote -> Quote
            builder.HasOne(dn => dn.Quote)
                .WithMany(i => i.DeliveryNotes)
                .HasForeignKey(dn => dn.QuoteId);
            builder.HasMany(d=>d.DeliveryNoteItems)
                .WithOne(dni => dni.DeliveryNote)
                .HasForeignKey(dni => dni.DeliveryNoteId);
        }
    }
}
