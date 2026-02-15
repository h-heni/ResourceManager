using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditTrailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "Invoices");

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "SupplierPayments",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConfirmedByUserId",
                table: "SupplierPayments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TreatedAt",
                table: "PendingInvoices",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatedByUserId",
                table: "PendingInvoices",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "SupplierPayments");

            migrationBuilder.DropColumn(
                name: "ConfirmedByUserId",
                table: "SupplierPayments");

            migrationBuilder.DropColumn(
                name: "TreatedAt",
                table: "PendingInvoices");

            migrationBuilder.DropColumn(
                name: "TreatedByUserId",
                table: "PendingInvoices");

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
    }
}
