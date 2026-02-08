using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPdfSignatureAndLanguage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InvoiceLanguage",
                table: "CompanySettings",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PdfSignatureText",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceLanguage",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "PdfSignatureText",
                table: "CompanySettings");
        }
    }
}
