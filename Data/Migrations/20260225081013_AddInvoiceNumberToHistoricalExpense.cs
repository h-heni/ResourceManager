using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceNumberToHistoricalExpense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Suppliers");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "SupplierInvoices");

            migrationBuilder.DropColumn(
                name: "SupplierName",
                table: "SupplierInvoices");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "PendingInvoices");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "OtherExpenses");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Clients");

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "HistoricalExpenses",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "HistoricalExpenses");

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Suppliers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "SupplierInvoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SupplierName",
                table: "SupplierInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Quotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "ProductServices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "PendingInvoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "OtherExpenses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "HistoricalRevenues",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "HistoricalExpenses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "DeliveryNotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Clients",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
