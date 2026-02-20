using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameFreenchToEnglish : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Drop FK constraints that reference or originate from tables being renamed ──
            migrationBuilder.DropForeignKey(name: "FK_DeliveryNotes_Devis_DevisId", table: "DeliveryNotes");
            migrationBuilder.DropForeignKey(name: "FK_Invoices_Devis_DevisId", table: "Invoices");
            migrationBuilder.DropForeignKey(name: "FK_HistoricalExpenses_Fournisseurs_FournisseurId", table: "HistoricalExpenses");
            migrationBuilder.DropForeignKey(name: "FK_PendingInvoices_Fournisseurs_FournisseurId", table: "PendingInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierPayments_FournisseurInvoices_FournisseurInvoiceId", table: "SupplierPayments");
            // Internal FKs within the renamed tables
            migrationBuilder.DropForeignKey(name: "FK_DevisItems_Devis_DevisId", table: "DevisItems");
            migrationBuilder.DropForeignKey(name: "FK_Devis_AspNetUsers_CreatedByUserId", table: "Devis");
            migrationBuilder.DropForeignKey(name: "FK_Devis_Clients_ClientId", table: "Devis");
            migrationBuilder.DropForeignKey(name: "FK_Devis_Companies_CompanyId", table: "Devis");
            migrationBuilder.DropForeignKey(name: "FK_Fournisseurs_AspNetUsers_CreatedByUserId", table: "Fournisseurs");
            migrationBuilder.DropForeignKey(name: "FK_Fournisseurs_Companies_CompanyId", table: "Fournisseurs");
            migrationBuilder.DropForeignKey(name: "FK_FournisseurInvoices_AspNetUsers_UserId", table: "FournisseurInvoices");
            migrationBuilder.DropForeignKey(name: "FK_FournisseurInvoices_Companies_CompanyId", table: "FournisseurInvoices");
            migrationBuilder.DropForeignKey(name: "FK_FournisseurInvoices_Fournisseurs_FournisseurId", table: "FournisseurInvoices");
            migrationBuilder.DropForeignKey(name: "FK_FournisseurInvoices_Invoices_InvoiceId", table: "FournisseurInvoices");
            // Truncated FK name in PostgreSQL
            migrationBuilder.Sql(@"ALTER TABLE ""FournisseurInvoiceItems"" DROP CONSTRAINT IF EXISTS ""FK_FournisseurInvoiceItems_FournisseurInvoices_FournisseurInvo~"";");

            // ── 2. Rename tables ──
            migrationBuilder.RenameTable(name: "Devis", newName: "Quotes");
            migrationBuilder.RenameTable(name: "DevisItems", newName: "QuoteItems");
            migrationBuilder.RenameTable(name: "Fournisseurs", newName: "Suppliers");
            migrationBuilder.RenameTable(name: "FournisseurInvoices", newName: "SupplierInvoices");
            migrationBuilder.RenameTable(name: "FournisseurInvoiceItems", newName: "SupplierInvoiceItems");

            // ── 3. Rename columns in renamed tables ──
            migrationBuilder.RenameColumn(name: "MatriculeFiscal", table: "Suppliers", newName: "TaxId");
            migrationBuilder.RenameColumn(name: "FournisseurId", table: "SupplierInvoices", newName: "SupplierId");
            migrationBuilder.RenameColumn(name: "FournisseurInvoiceId", table: "SupplierInvoiceItems", newName: "SupplierInvoiceId");
            migrationBuilder.RenameColumn(name: "DevisId", table: "QuoteItems", newName: "QuoteId");

            // ── 4. Rename columns in non-renamed tables ──
            migrationBuilder.RenameColumn(name: "FournisseurInvoiceId", table: "SupplierPayments", newName: "SupplierInvoiceId");
            migrationBuilder.RenameColumn(name: "FournisseurId", table: "PendingInvoices", newName: "SupplierId");
            migrationBuilder.RenameColumn(name: "FournisseurName", table: "PdfFileRecords", newName: "SupplierName");
            migrationBuilder.RenameColumn(name: "SourceDevisNumber", table: "Invoices", newName: "SourceQuoteNumber");
            migrationBuilder.RenameColumn(name: "DevisId", table: "Invoices", newName: "QuoteId");
            migrationBuilder.RenameColumn(name: "FournisseurId", table: "HistoricalExpenses", newName: "SupplierId");
            migrationBuilder.RenameColumn(name: "DevisId", table: "DeliveryNotes", newName: "QuoteId");
            migrationBuilder.RenameColumn(name: "MatriculeFiscal", table: "Companies", newName: "TaxId");
            migrationBuilder.RenameColumn(name: "MatriculeFiscal", table: "Clients", newName: "TaxId");

            // ── 5. Rename indexes on renamed tables (PostgreSQL ALTER INDEX) ──
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Devis_ClientId"" RENAME TO ""IX_Quotes_ClientId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Devis_CompanyId_IsDeleted"" RENAME TO ""IX_Quotes_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Devis_CompanyId_Number"" RENAME TO ""IX_Quotes_CompanyId_Number"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Devis_CreatedByUserId"" RENAME TO ""IX_Quotes_CreatedByUserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Devis_Date"" RENAME TO ""IX_Quotes_Date"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_DevisItems_DevisId"" RENAME TO ""IX_QuoteItems_QuoteId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Fournisseurs_CompanyId_IsDeleted"" RENAME TO ""IX_Suppliers_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Fournisseurs_CreatedByUserId"" RENAME TO ""IX_Suppliers_CreatedByUserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_FournisseurInvoices_CompanyId_IsDeleted"" RENAME TO ""IX_SupplierInvoices_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_FournisseurInvoices_FournisseurId"" RENAME TO ""IX_SupplierInvoices_SupplierId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_FournisseurInvoices_InvoiceId"" RENAME TO ""IX_SupplierInvoices_InvoiceId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_FournisseurInvoices_UserId"" RENAME TO ""IX_SupplierInvoices_UserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_FournisseurInvoiceItems_FournisseurInvoiceId"" RENAME TO ""IX_SupplierInvoiceItems_SupplierInvoiceId"";");

            // Indexes on non-renamed tables
            migrationBuilder.RenameIndex(name: "IX_SupplierPayments_FournisseurInvoiceId_Status", table: "SupplierPayments", newName: "IX_SupplierPayments_SupplierInvoiceId_Status");
            migrationBuilder.RenameIndex(name: "IX_PendingInvoices_FournisseurId", table: "PendingInvoices", newName: "IX_PendingInvoices_SupplierId");
            migrationBuilder.RenameIndex(name: "IX_Invoices_DevisId", table: "Invoices", newName: "IX_Invoices_QuoteId");
            migrationBuilder.RenameIndex(name: "IX_HistoricalExpenses_FournisseurId", table: "HistoricalExpenses", newName: "IX_HistoricalExpenses_SupplierId");
            migrationBuilder.RenameIndex(name: "IX_DeliveryNotes_DevisId", table: "DeliveryNotes", newName: "IX_DeliveryNotes_QuoteId");

            // ── 6. Rename PK constraints (PostgreSQL) ──
            migrationBuilder.Sql(@"ALTER TABLE ""Quotes"" RENAME CONSTRAINT ""PK_Devis"" TO ""PK_Quotes"";");
            migrationBuilder.Sql(@"ALTER TABLE ""QuoteItems"" RENAME CONSTRAINT ""PK_DevisItems"" TO ""PK_QuoteItems"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Suppliers"" RENAME CONSTRAINT ""PK_Fournisseurs"" TO ""PK_Suppliers"";");
            migrationBuilder.Sql(@"ALTER TABLE ""SupplierInvoices"" RENAME CONSTRAINT ""PK_FournisseurInvoices"" TO ""PK_SupplierInvoices"";");
            migrationBuilder.Sql(@"ALTER TABLE ""SupplierInvoiceItems"" RENAME CONSTRAINT ""PK_FournisseurInvoiceItems"" TO ""PK_SupplierInvoiceItems"";");

            // ── 7. Recreate FK constraints with new names ──
            // External FKs (from non-renamed tables to renamed tables)
            migrationBuilder.AddForeignKey(name: "FK_DeliveryNotes_Quotes_QuoteId", table: "DeliveryNotes", column: "QuoteId", principalTable: "Quotes", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Invoices_Quotes_QuoteId", table: "Invoices", column: "QuoteId", principalTable: "Quotes", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_HistoricalExpenses_Suppliers_SupplierId", table: "HistoricalExpenses", column: "SupplierId", principalTable: "Suppliers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_PendingInvoices_Suppliers_SupplierId", table: "PendingInvoices", column: "SupplierId", principalTable: "Suppliers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_SupplierPayments_SupplierInvoices_SupplierInvoiceId", table: "SupplierPayments", column: "SupplierInvoiceId", principalTable: "SupplierInvoices", principalColumn: "Id", onDelete: ReferentialAction.Cascade);

            // Internal FKs (within renamed tables)
            migrationBuilder.AddForeignKey(name: "FK_QuoteItems_Quotes_QuoteId", table: "QuoteItems", column: "QuoteId", principalTable: "Quotes", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Quotes_AspNetUsers_CreatedByUserId", table: "Quotes", column: "CreatedByUserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Quotes_Clients_ClientId", table: "Quotes", column: "ClientId", principalTable: "Clients", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Quotes_Companies_CompanyId", table: "Quotes", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_Suppliers_AspNetUsers_CreatedByUserId", table: "Suppliers", column: "CreatedByUserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Suppliers_Companies_CompanyId", table: "Suppliers", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_SupplierInvoices_AspNetUsers_UserId", table: "SupplierInvoices", column: "UserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_SupplierInvoices_Companies_CompanyId", table: "SupplierInvoices", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_SupplierInvoices_Suppliers_SupplierId", table: "SupplierInvoices", column: "SupplierId", principalTable: "Suppliers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_SupplierInvoices_Invoices_InvoiceId", table: "SupplierInvoices", column: "InvoiceId", principalTable: "Invoices", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_SupplierInvoiceItems_SupplierInvoices_SupplierInvoiceId", table: "SupplierInvoiceItems", column: "SupplierInvoiceId", principalTable: "SupplierInvoices", principalColumn: "Id", onDelete: ReferentialAction.Cascade);

            // ── 8. Add new columns for Task 1 & 2 features ──
            migrationBuilder.AddColumn<int>(name: "EmployeeCapacity", table: "ManagerInvitations", type: "integer", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string>(name: "PreferredLanguage", table: "ManagerInvitations", type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<int>(name: "AccountStatus", table: "Companies", type: "integer", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<DateTime>(name: "SubscriptionExpiryDate", table: "Companies", type: "timestamp without time zone", nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ── Remove new columns ──
            migrationBuilder.DropColumn(name: "EmployeeCapacity", table: "ManagerInvitations");
            migrationBuilder.DropColumn(name: "PreferredLanguage", table: "ManagerInvitations");
            migrationBuilder.DropColumn(name: "AccountStatus", table: "Companies");
            migrationBuilder.DropColumn(name: "SubscriptionExpiryDate", table: "Companies");

            // ── Drop FK constraints ──
            migrationBuilder.DropForeignKey(name: "FK_DeliveryNotes_Quotes_QuoteId", table: "DeliveryNotes");
            migrationBuilder.DropForeignKey(name: "FK_Invoices_Quotes_QuoteId", table: "Invoices");
            migrationBuilder.DropForeignKey(name: "FK_HistoricalExpenses_Suppliers_SupplierId", table: "HistoricalExpenses");
            migrationBuilder.DropForeignKey(name: "FK_PendingInvoices_Suppliers_SupplierId", table: "PendingInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierPayments_SupplierInvoices_SupplierInvoiceId", table: "SupplierPayments");
            migrationBuilder.DropForeignKey(name: "FK_QuoteItems_Quotes_QuoteId", table: "QuoteItems");
            migrationBuilder.DropForeignKey(name: "FK_Quotes_AspNetUsers_CreatedByUserId", table: "Quotes");
            migrationBuilder.DropForeignKey(name: "FK_Quotes_Clients_ClientId", table: "Quotes");
            migrationBuilder.DropForeignKey(name: "FK_Quotes_Companies_CompanyId", table: "Quotes");
            migrationBuilder.DropForeignKey(name: "FK_Suppliers_AspNetUsers_CreatedByUserId", table: "Suppliers");
            migrationBuilder.DropForeignKey(name: "FK_Suppliers_Companies_CompanyId", table: "Suppliers");
            migrationBuilder.DropForeignKey(name: "FK_SupplierInvoices_AspNetUsers_UserId", table: "SupplierInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierInvoices_Companies_CompanyId", table: "SupplierInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierInvoices_Suppliers_SupplierId", table: "SupplierInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierInvoices_Invoices_InvoiceId", table: "SupplierInvoices");
            migrationBuilder.DropForeignKey(name: "FK_SupplierInvoiceItems_SupplierInvoices_SupplierInvoiceId", table: "SupplierInvoiceItems");

            // ── Rename columns back (non-renamed tables) ──
            migrationBuilder.RenameColumn(name: "TaxId", table: "Clients", newName: "MatriculeFiscal");
            migrationBuilder.RenameColumn(name: "TaxId", table: "Companies", newName: "MatriculeFiscal");
            migrationBuilder.RenameColumn(name: "QuoteId", table: "DeliveryNotes", newName: "DevisId");
            migrationBuilder.RenameColumn(name: "SupplierId", table: "HistoricalExpenses", newName: "FournisseurId");
            migrationBuilder.RenameColumn(name: "QuoteId", table: "Invoices", newName: "DevisId");
            migrationBuilder.RenameColumn(name: "SourceQuoteNumber", table: "Invoices", newName: "SourceDevisNumber");
            migrationBuilder.RenameColumn(name: "SupplierName", table: "PdfFileRecords", newName: "FournisseurName");
            migrationBuilder.RenameColumn(name: "SupplierId", table: "PendingInvoices", newName: "FournisseurId");
            migrationBuilder.RenameColumn(name: "SupplierInvoiceId", table: "SupplierPayments", newName: "FournisseurInvoiceId");

            // ── Rename indexes back (non-renamed tables) ──
            migrationBuilder.RenameIndex(name: "IX_DeliveryNotes_QuoteId", table: "DeliveryNotes", newName: "IX_DeliveryNotes_DevisId");
            migrationBuilder.RenameIndex(name: "IX_HistoricalExpenses_SupplierId", table: "HistoricalExpenses", newName: "IX_HistoricalExpenses_FournisseurId");
            migrationBuilder.RenameIndex(name: "IX_Invoices_QuoteId", table: "Invoices", newName: "IX_Invoices_DevisId");
            migrationBuilder.RenameIndex(name: "IX_PendingInvoices_SupplierId", table: "PendingInvoices", newName: "IX_PendingInvoices_FournisseurId");
            migrationBuilder.RenameIndex(name: "IX_SupplierPayments_SupplierInvoiceId_Status", table: "SupplierPayments", newName: "IX_SupplierPayments_FournisseurInvoiceId_Status");

            // ── Rename columns back (renamed tables) ──
            migrationBuilder.RenameColumn(name: "QuoteId", table: "QuoteItems", newName: "DevisId");
            migrationBuilder.RenameColumn(name: "TaxId", table: "Suppliers", newName: "MatriculeFiscal");
            migrationBuilder.RenameColumn(name: "SupplierId", table: "SupplierInvoices", newName: "FournisseurId");
            migrationBuilder.RenameColumn(name: "SupplierInvoiceId", table: "SupplierInvoiceItems", newName: "FournisseurInvoiceId");

            // ── Rename indexes back (renamed tables via SQL) ──
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Quotes_ClientId"" RENAME TO ""IX_Devis_ClientId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Quotes_CompanyId_IsDeleted"" RENAME TO ""IX_Devis_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Quotes_CompanyId_Number"" RENAME TO ""IX_Devis_CompanyId_Number"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Quotes_CreatedByUserId"" RENAME TO ""IX_Devis_CreatedByUserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Quotes_Date"" RENAME TO ""IX_Devis_Date"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_QuoteItems_QuoteId"" RENAME TO ""IX_DevisItems_DevisId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Suppliers_CompanyId_IsDeleted"" RENAME TO ""IX_Fournisseurs_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_Suppliers_CreatedByUserId"" RENAME TO ""IX_Fournisseurs_CreatedByUserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_SupplierInvoices_CompanyId_IsDeleted"" RENAME TO ""IX_FournisseurInvoices_CompanyId_IsDeleted"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_SupplierInvoices_SupplierId"" RENAME TO ""IX_FournisseurInvoices_FournisseurId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_SupplierInvoices_InvoiceId"" RENAME TO ""IX_FournisseurInvoices_InvoiceId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_SupplierInvoices_UserId"" RENAME TO ""IX_FournisseurInvoices_UserId"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_SupplierInvoiceItems_SupplierInvoiceId"" RENAME TO ""IX_FournisseurInvoiceItems_FournisseurInvoiceId"";");

            // ── Rename PK constraints back ──
            migrationBuilder.Sql(@"ALTER TABLE ""Quotes"" RENAME CONSTRAINT ""PK_Quotes"" TO ""PK_Devis"";");
            migrationBuilder.Sql(@"ALTER TABLE ""QuoteItems"" RENAME CONSTRAINT ""PK_QuoteItems"" TO ""PK_DevisItems"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Suppliers"" RENAME CONSTRAINT ""PK_Suppliers"" TO ""PK_Fournisseurs"";");
            migrationBuilder.Sql(@"ALTER TABLE ""SupplierInvoices"" RENAME CONSTRAINT ""PK_SupplierInvoices"" TO ""PK_FournisseurInvoices"";");
            migrationBuilder.Sql(@"ALTER TABLE ""SupplierInvoiceItems"" RENAME CONSTRAINT ""PK_SupplierInvoiceItems"" TO ""PK_FournisseurInvoiceItems"";");

            // ── Rename tables back ──
            migrationBuilder.RenameTable(name: "Quotes", newName: "Devis");
            migrationBuilder.RenameTable(name: "QuoteItems", newName: "DevisItems");
            migrationBuilder.RenameTable(name: "Suppliers", newName: "Fournisseurs");
            migrationBuilder.RenameTable(name: "SupplierInvoices", newName: "FournisseurInvoices");
            migrationBuilder.RenameTable(name: "SupplierInvoiceItems", newName: "FournisseurInvoiceItems");

            // ── Recreate FK constraints with original names ──
            migrationBuilder.AddForeignKey(name: "FK_DeliveryNotes_Devis_DevisId", table: "DeliveryNotes", column: "DevisId", principalTable: "Devis", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Invoices_Devis_DevisId", table: "Invoices", column: "DevisId", principalTable: "Devis", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_HistoricalExpenses_Fournisseurs_FournisseurId", table: "HistoricalExpenses", column: "FournisseurId", principalTable: "Fournisseurs", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_PendingInvoices_Fournisseurs_FournisseurId", table: "PendingInvoices", column: "FournisseurId", principalTable: "Fournisseurs", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_SupplierPayments_FournisseurInvoices_FournisseurInvoiceId", table: "SupplierPayments", column: "FournisseurInvoiceId", principalTable: "FournisseurInvoices", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_DevisItems_Devis_DevisId", table: "DevisItems", column: "DevisId", principalTable: "Devis", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Devis_AspNetUsers_CreatedByUserId", table: "Devis", column: "CreatedByUserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Devis_Clients_ClientId", table: "Devis", column: "ClientId", principalTable: "Clients", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Devis_Companies_CompanyId", table: "Devis", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_Fournisseurs_AspNetUsers_CreatedByUserId", table: "Fournisseurs", column: "CreatedByUserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Fournisseurs_Companies_CompanyId", table: "Fournisseurs", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_FournisseurInvoices_AspNetUsers_UserId", table: "FournisseurInvoices", column: "UserId", principalTable: "AspNetUsers", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_FournisseurInvoices_Companies_CompanyId", table: "FournisseurInvoices", column: "CompanyId", principalTable: "Companies", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_FournisseurInvoices_Fournisseurs_FournisseurId", table: "FournisseurInvoices", column: "FournisseurId", principalTable: "Fournisseurs", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_FournisseurInvoices_Invoices_InvoiceId", table: "FournisseurInvoices", column: "InvoiceId", principalTable: "Invoices", principalColumn: "Id");
            migrationBuilder.Sql(@"ALTER TABLE ""FournisseurInvoiceItems"" ADD CONSTRAINT ""FK_FournisseurInvoiceItems_FournisseurInvoices_FournisseurInvo~"" FOREIGN KEY (""FournisseurInvoiceId"") REFERENCES ""FournisseurInvoices"" (""Id"") ON DELETE CASCADE;");
        }
    }
}
