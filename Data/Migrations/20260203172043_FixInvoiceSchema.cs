using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixInvoiceSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLocked",
                table: "Invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Invoices",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Devis",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "InvoiceId",
                table: "DeliveryNotes",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryNotes_InvoiceId",
                table: "DeliveryNotes",
                column: "InvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryNotes_Invoices_InvoiceId",
                table: "DeliveryNotes",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryNotes_Invoices_InvoiceId",
                table: "DeliveryNotes");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryNotes_InvoiceId",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "IsLocked",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Devis");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "DeliveryNotes");
        }
    }
}
