using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;

namespace ResourceManager.Data.Configurations
{
    public class CompanyConfiguration : IEntityTypeConfiguration<Company>
    {
        public void Configure(EntityTypeBuilder<Company> builder)
        {
            builder.HasMany(up => up.Users)
                .WithOne(up => up.Company)
                .HasForeignKey(up=>up.CompanyId);
            builder.HasMany(up => up.Clients)
                .WithOne(up => up.Company)
                .HasForeignKey(up=>up.CompanyId);
            builder.HasMany(up => up.Suppliers)
                .WithOne(up => up.Company)
                .HasForeignKey(up=>up.CompanyId);

        }
    }
}
