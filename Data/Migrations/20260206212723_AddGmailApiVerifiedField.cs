using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGmailApiVerifiedField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GmailApiVerified",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GmailApiVerified",
                table: "CompanySettings");
        }
    }
}
