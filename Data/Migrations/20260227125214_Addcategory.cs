using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class Addcategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupplierInvoices_Invoices_InvoiceId",
                table: "SupplierInvoices");

            migrationBuilder.DropIndex(
                name: "IX_SupplierInvoices_InvoiceId",
                table: "SupplierInvoices");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "SupplierInvoices");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "SupplierInvoices",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "Invoices",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "SupplierInvoices",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InvoiceId",
                table: "SupplierInvoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "Invoices",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplierInvoices_InvoiceId",
                table: "SupplierInvoices",
                column: "InvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_SupplierInvoices_Invoices_InvoiceId",
                table: "SupplierInvoices",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id");
        }
    }
}
