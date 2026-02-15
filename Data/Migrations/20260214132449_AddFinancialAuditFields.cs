using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "Payments",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConfirmedByUserId",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "Invoices",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "Invoices",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ConfirmedByUserId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Invoices");
        }
    }
}
