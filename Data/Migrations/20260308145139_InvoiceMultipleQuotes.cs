using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceMultipleQuotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add InvoiceId column to Quotes first (before dropping QuoteId from Invoices)
            migrationBuilder.AddColumn<int>(
                name: "InvoiceId",
                table: "Quotes",
                type: "integer",
                nullable: true);

            // 2. Migrate existing data: copy Invoice→QuoteId relationship to Quote→InvoiceId
            migrationBuilder.Sql(
                "UPDATE \"Quotes\" SET \"InvoiceId\" = i.\"Id\" FROM \"Invoices\" i WHERE i.\"QuoteId\" = \"Quotes\".\"Id\"");

            // 3. Now safe to drop the old FK, index, and column
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Quotes_QuoteId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_QuoteId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "QuoteId",
                table: "Invoices");

            migrationBuilder.RenameColumn(
                name: "SourceQuoteNumber",
                table: "Invoices",
                newName: "SourceQuoteNumbers");

            migrationBuilder.CreateIndex(
                name: "IX_Quotes_InvoiceId",
                table: "Quotes",
                column: "InvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_Quotes_Invoices_InvoiceId",
                table: "Quotes",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Quotes_Invoices_InvoiceId",
                table: "Quotes");

            migrationBuilder.DropIndex(
                name: "IX_Quotes_InvoiceId",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "Quotes");

            migrationBuilder.RenameColumn(
                name: "SourceQuoteNumbers",
                table: "Invoices",
                newName: "SourceQuoteNumber");

            migrationBuilder.AddColumn<int>(
                name: "QuoteId",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_QuoteId",
                table: "Invoices",
                column: "QuoteId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Quotes_QuoteId",
                table: "Invoices",
                column: "QuoteId",
                principalTable: "Quotes",
                principalColumn: "Id");
        }
    }
}
