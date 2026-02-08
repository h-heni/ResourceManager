using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGmailOAuthFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GmailAccessToken",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GmailConnectedAt",
                table: "CompanySettings",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GmailConnectedEmail",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GmailRefreshToken",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GmailTokenExpiry",
                table: "CompanySettings",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GmailAccessToken",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "GmailConnectedAt",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "GmailConnectedEmail",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "GmailRefreshToken",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "GmailTokenExpiry",
                table: "CompanySettings");
        }
    }
}
