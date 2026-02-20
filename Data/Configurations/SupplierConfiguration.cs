using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class SupplierConfiguration: IEntityTypeConfiguration<Supplier>
    {
        public void Configure(EntityTypeBuilder<Supplier> builder)
        {
            builder.HasMany(f => f.SupplierInvoices)
                   .WithOne(fi => fi.Supplier)
                   .HasForeignKey(fi => fi.SupplierId);
        }
    }
}
