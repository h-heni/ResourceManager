using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class ConsolidateImportsIntoCoreTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HistoricalExpenses");

            migrationBuilder.DropTable(
                name: "HistoricalRevenues");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "SupplierInvoices",
                type: "text",
                nullable: false,
                defaultValue: "manual");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Invoices",
                type: "text",
                nullable: false,
                defaultValue: "manual");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "SupplierInvoices");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Invoices");

            migrationBuilder.CreateTable(
                name: "HistoricalExpenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    SupplierId = table.Column<int>(type: "integer", nullable: true),
                    AmountPaid = table.Column<decimal>(type: "numeric", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    InvoiceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    IsHistorical = table.Column<bool>(type: "boolean", nullable: false),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    Reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SupplierName = table.Column<string>(type: "text", nullable: false),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoricalExpenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HistoricalExpenses_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HistoricalExpenses_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HistoricalExpenses_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "HistoricalRevenues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClientId = table.Column<int>(type: "integer", nullable: true),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    InvoiceId = table.Column<int>(type: "integer", nullable: true),
                    AmountPaid = table.Column<decimal>(type: "numeric", nullable: false),
                    ClientName = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    InvoiceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    IsHistorical = table.Column<bool>(type: "boolean", nullable: false),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoricalRevenues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HistoricalRevenues_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HistoricalRevenues_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HistoricalRevenues_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HistoricalRevenues_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_CompanyId_IsDeleted",
                table: "HistoricalExpenses",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_CreatedByUserId",
                table: "HistoricalExpenses",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_Date",
                table: "HistoricalExpenses",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_SupplierId",
                table: "HistoricalExpenses",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_ClientId",
                table: "HistoricalRevenues",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CompanyId_InvoiceId",
                table: "HistoricalRevenues",
                columns: new[] { "CompanyId", "InvoiceId" },
                unique: true,
                filter: "\"InvoiceId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CompanyId_IsDeleted",
                table: "HistoricalRevenues",
                columns: new[] { "CompanyId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_CreatedByUserId",
                table: "HistoricalRevenues",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_Date",
                table: "HistoricalRevenues",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_InvoiceId",
                table: "HistoricalRevenues",
                column: "InvoiceId");
        }
    }
}
