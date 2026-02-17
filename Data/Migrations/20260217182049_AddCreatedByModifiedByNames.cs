using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatedByModifiedByNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "ProductServices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "ProductServices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "PendingInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "PendingInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "OtherExpenses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "OtherExpenses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "HistoricalRevenues",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "HistoricalRevenues",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "HistoricalExpenses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "HistoricalExpenses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Fournisseurs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "Fournisseurs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Devis",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "Devis",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModifiedBy",
                table: "Clients",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "PendingInvoices");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "PendingInvoices");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "OtherExpenses");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "OtherExpenses");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Fournisseurs");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "Fournisseurs");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Devis");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "Devis");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ModifiedBy",
                table: "Clients");
        }
    }
}
