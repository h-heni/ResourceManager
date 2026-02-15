using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatedByToShared : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "ProductServices",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "ProductServices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "OtherExpenses",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "OtherExpenses",
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

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "HistoricalRevenues",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "HistoricalRevenues",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "HistoricalExpenses",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "HistoricalExpenses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "Fournisseurs",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "Fournisseurs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "Devis",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "Devis",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "DeliveryNotes",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "Clients",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "Clients",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "OtherExpenses");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "OtherExpenses");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Fournisseurs");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Fournisseurs");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Devis");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Devis");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Clients");
        }
    }
}
