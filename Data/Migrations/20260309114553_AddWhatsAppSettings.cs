using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WhatsAppAccessToken",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppBusinessAccountId",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WhatsAppEnabled",
                table: "CompanySettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppPhoneNumberId",
                table: "CompanySettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WhatsAppAccessToken",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "WhatsAppBusinessAccountId",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "WhatsAppEnabled",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "WhatsAppPhoneNumberId",
                table: "CompanySettings");
        }
    }
}
