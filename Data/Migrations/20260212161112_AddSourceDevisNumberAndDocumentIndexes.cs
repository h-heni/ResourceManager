using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceDevisNumberAndDocumentIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupplierPayments_FournisseurInvoiceId",
                table: "SupplierPayments");

            migrationBuilder.DropIndex(
                name: "IX_ProductServices_CompanyId",
                table: "ProductServices");

            migrationBuilder.DropIndex(
                name: "IX_PendingInvoices_CompanyId",
                table: "PendingInvoices");

            migrationBuilder.DropIndex(
                name: "IX_PdfFileRecords_CompanyId",
                table: "PdfFileRecords");

            migrationBuilder.DropIndex(
                name: "IX_Payments_InvoiceId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_OtherExpenses_CompanyId",
                table: "OtherExpenses");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_CompanyId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_CompanyId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalExpenses_CompanyId",
                table: "HistoricalExpenses");

            migrationBuilder.DropIndex(
                name: "IX_Fournisseurs_CompanyId",
                table: "Fournisseurs");

            migrationBuilder.DropIndex(
                name: "IX_FournisseurInvoices_CompanyId",
                table: "FournisseurInvoices");

            migrationBuilder.DropIndex(
                name: "IX_Devis_CompanyId",
                table: "Devis");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryNotes_CompanyId",
                table: "DeliveryNotes");

            migrationBuilder.DropIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings");

            migrationBuilder.DropIndex(
                name: "IX_Clients_CompanyId",
                table: "Clients");

            migrationBuilder.AddColumn<string>(
                name: "SourceDevisNumber",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplierPayments_FournisseurInvoiceId_Status",
                table: "SupplierPayments",
                columns: new[] { "FournisseurInvoiceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductServices_CompanyId_IsDeleted",
                table: "ProductServices",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_PendingInvoices_CompanyId_IsDeleted",
                table: "PendingInvoices",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_PdfFileRecords_CompanyId_IsDeleted",
                table: "PdfFileRecords",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_InvoiceId_Status",
                table: "Payments",
                columns: new[] { "InvoiceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_OtherExpenses_CompanyId_IsDeleted",
                table: "OtherExpenses",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_OtherExpenses_Date",
                table: "OtherExpenses",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CompanyId_IsDeleted",
                table: "Invoices",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CompanyId_Number",
                table: "Invoices",
                columns: new[] { "CompanyId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_Date",
                table: "Invoices",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_Status",
                table: "Invoices",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CompanyId_IsDeleted",
                table: "HistoricalRevenues",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_Date",
                table: "HistoricalRevenues",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_CompanyId_IsDeleted",
                table: "HistoricalExpenses",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_Date",
                table: "HistoricalExpenses",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Fournisseurs_CompanyId_IsDeleted",
                table: "Fournisseurs",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_FournisseurInvoices_CompanyId_IsDeleted",
                table: "FournisseurInvoices",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Devis_CompanyId_IsDeleted",
                table: "Devis",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Devis_CompanyId_Number",
                table: "Devis",
                columns: new[] { "CompanyId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Devis_Date",
                table: "Devis",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryNotes_CompanyId_IsDeleted",
                table: "DeliveryNotes",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryNotes_Date",
                table: "DeliveryNotes",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CompanyId_IsDeleted",
                table: "Clients",
                columns: new[] { "CompanyId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupplierPayments_FournisseurInvoiceId_Status",
                table: "SupplierPayments");

            migrationBuilder.DropIndex(
                name: "IX_ProductServices_CompanyId_IsDeleted",
                table: "ProductServices");

            migrationBuilder.DropIndex(
                name: "IX_PendingInvoices_CompanyId_IsDeleted",
                table: "PendingInvoices");

            migrationBuilder.DropIndex(
                name: "IX_PdfFileRecords_CompanyId_IsDeleted",
                table: "PdfFileRecords");

            migrationBuilder.DropIndex(
                name: "IX_Payments_InvoiceId_Status",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_OtherExpenses_CompanyId_IsDeleted",
                table: "OtherExpenses");

            migrationBuilder.DropIndex(
                name: "IX_OtherExpenses_Date",
                table: "OtherExpenses");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_CompanyId_IsDeleted",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_CompanyId_Number",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_Date",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_Status",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_CompanyId_IsDeleted",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_Date",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalExpenses_CompanyId_IsDeleted",
                table: "HistoricalExpenses");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalExpenses_Date",
                table: "HistoricalExpenses");

            migrationBuilder.DropIndex(
                name: "IX_Fournisseurs_CompanyId_IsDeleted",
                table: "Fournisseurs");

            migrationBuilder.DropIndex(
                name: "IX_FournisseurInvoices_CompanyId_IsDeleted",
                table: "FournisseurInvoices");

            migrationBuilder.DropIndex(
                name: "IX_Devis_CompanyId_IsDeleted",
                table: "Devis");

            migrationBuilder.DropIndex(
                name: "IX_Devis_CompanyId_Number",
                table: "Devis");

            migrationBuilder.DropIndex(
                name: "IX_Devis_Date",
                table: "Devis");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryNotes_CompanyId_IsDeleted",
                table: "DeliveryNotes");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryNotes_Date",
                table: "DeliveryNotes");

            migrationBuilder.DropIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings");

            migrationBuilder.DropIndex(
                name: "IX_Clients_CompanyId_IsDeleted",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "SourceDevisNumber",
                table: "Invoices");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierPayments_FournisseurInvoiceId",
                table: "SupplierPayments",
                column: "FournisseurInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductServices_CompanyId",
                table: "ProductServices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingInvoices_CompanyId",
                table: "PendingInvoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PdfFileRecords_CompanyId",
                table: "PdfFileRecords",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_InvoiceId",
                table: "Payments",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_OtherExpenses_CompanyId",
                table: "OtherExpenses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CompanyId",
                table: "Invoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CompanyId",
                table: "HistoricalRevenues",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_CompanyId",
                table: "HistoricalExpenses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Fournisseurs_CompanyId",
                table: "Fournisseurs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_FournisseurInvoices_CompanyId",
                table: "FournisseurInvoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Devis_CompanyId",
                table: "Devis",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryNotes_CompanyId",
                table: "DeliveryNotes",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CompanyId",
                table: "Clients",
                column: "CompanyId");
        }
    }
}
