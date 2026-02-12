using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    public partial class RemovePdfBaseFolderPathFromCompanySettings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PdfBaseFolderPath",
                table: "CompanySettings");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PdfBaseFolderPath",
                table: "CompanySettings",
                type: "text",
                nullable: true);
        }
    }
}
