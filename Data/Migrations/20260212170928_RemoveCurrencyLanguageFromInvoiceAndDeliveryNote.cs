using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCurrencyLanguageFromInvoiceAndDeliveryNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BACKWARD COMPAT: Copy invoice/delivery note currency/language to their linked Devis
            // if the Devis doesn't already have those values set.
            migrationBuilder.Sql(@"
                UPDATE ""Devis"" d
                SET ""Currency"" = COALESCE(d.""Currency"", i.""Currency""),
                    ""CurrencySymbol"" = COALESCE(d.""CurrencySymbol"", i.""CurrencySymbol""),
                    ""PdfLanguage"" = COALESCE(d.""PdfLanguage"", i.""PdfLanguage"")
                FROM ""Invoices"" i
                WHERE i.""DevisId"" = d.""Id""
                  AND (d.""Currency"" IS NULL OR d.""CurrencySymbol"" IS NULL OR d.""PdfLanguage"" IS NULL)
                  AND (i.""Currency"" IS NOT NULL OR i.""CurrencySymbol"" IS NOT NULL OR i.""PdfLanguage"" IS NOT NULL);
            ");

            migrationBuilder.Sql(@"
                UPDATE ""Devis"" d
                SET ""Currency"" = COALESCE(d.""Currency"", dn.""Currency""),
                    ""CurrencySymbol"" = COALESCE(d.""CurrencySymbol"", dn.""CurrencySymbol""),
                    ""PdfLanguage"" = COALESCE(d.""PdfLanguage"", dn.""PdfLanguage"")
                FROM ""DeliveryNotes"" dn
                WHERE dn.""DevisId"" = d.""Id""
                  AND (d.""Currency"" IS NULL OR d.""CurrencySymbol"" IS NULL OR d.""PdfLanguage"" IS NULL)
                  AND (dn.""Currency"" IS NOT NULL OR dn.""CurrencySymbol"" IS NOT NULL OR dn.""PdfLanguage"" IS NOT NULL);
            ");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CurrencySymbol",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PdfLanguage",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Reference",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "CurrencySymbol",
                table: "DeliveryNotes");

            migrationBuilder.DropColumn(
                name: "PdfLanguage",
                table: "DeliveryNotes");

            migrationBuilder.AddColumn<int>(
                name: "InvoiceId",
                table: "HistoricalRevenues",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "HistoricalRevenues",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CompanyId_InvoiceId",
                table: "HistoricalRevenues",
                columns: new[] { "CompanyId", "InvoiceId" },
                unique: true,
                filter: "\"InvoiceId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_InvoiceId",
                table: "HistoricalRevenues",
                column: "InvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_HistoricalRevenues_Invoices_InvoiceId",
                table: "HistoricalRevenues",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HistoricalRevenues_Invoices_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_CompanyId_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "HistoricalRevenues");

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrencySymbol",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfLanguage",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reference",
                table: "HistoricalRevenues",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrencySymbol",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfLanguage",
                table: "DeliveryNotes",
                type: "text",
                nullable: true);
        }
    }
}
