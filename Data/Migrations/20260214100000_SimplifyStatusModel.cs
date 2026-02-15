using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <summary>
    /// Data-only migration: Simplify invoice/payment status values.
    /// - Invoice.Status: "Unpaid" and "Draft" → "Pending"
    /// - Payment.Status: "Due" → "Completed"
    /// - SupplierPayment.Status: "Due" → "Completed"
    /// No schema changes — naming simplification only.
    /// </summary>
    public partial class SimplifyStatusModel : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rename Invoice statuses
            migrationBuilder.Sql(
                @"UPDATE ""Invoices"" SET ""Status"" = 'Pending' WHERE ""Status"" IN ('Unpaid', 'Draft');");

            // Rename client payment statuses
            migrationBuilder.Sql(
                @"UPDATE ""Payments"" SET ""Status"" = 'Completed' WHERE ""Status"" = 'Due';");

            // Rename supplier payment statuses
            migrationBuilder.Sql(
                @"UPDATE ""SupplierPayments"" SET ""Status"" = 'Completed' WHERE ""Status"" = 'Due';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert Invoice statuses
            migrationBuilder.Sql(
                @"UPDATE ""Invoices"" SET ""Status"" = 'Unpaid' WHERE ""Status"" = 'Pending';");

            // Note: Cannot distinguish which "Completed" were formerly "Due",
            // so Down is best-effort. No payments are reverted.
        }
    }
}
