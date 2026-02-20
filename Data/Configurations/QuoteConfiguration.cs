using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResourceManager.Models;
namespace ResourceManager.Data.Configurations
{
    public class QuoteConfiguration : IEntityTypeConfiguration<Quote>
    {
        public void Configure(EntityTypeBuilder<Quote> builder)
        {
            // Quote -> Invoice (optional)

            builder.HasMany(d => d.QuoteItems)
                .WithOne(di => di.Quote)
                .HasForeignKey(di => di.QuoteId);
        }
    }
}
