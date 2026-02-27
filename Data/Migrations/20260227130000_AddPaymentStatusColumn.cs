using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentStatusColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentStatus",
                table: "SupplierInvoices",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                table: "SupplierInvoices");
        }
    }
}
