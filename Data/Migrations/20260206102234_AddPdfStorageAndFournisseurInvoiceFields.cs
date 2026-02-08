using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPdfStorageAndFournisseurInvoiceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "InvoiceDate",
                table: "FournisseurInvoices",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TVA",
                table: "FournisseurInvoices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalHT",
                table: "FournisseurInvoices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalTTC",
                table: "FournisseurInvoices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfBaseFolderPath",
                table: "CompanySettings",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PdfFileRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    RelativePath = table.Column<string>(type: "text", nullable: false),
                    FullPath = table.Column<string>(type: "text", nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    DocumentNumber = table.Column<string>(type: "text", nullable: false),
                    DocumentDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    RelatedEntityType = table.Column<string>(type: "text", nullable: false),
                    RelatedEntityId = table.Column<int>(type: "integer", nullable: false),
                    ClientName = table.Column<string>(type: "text", nullable: true),
                    FournisseurName = table.Column<string>(type: "text", nullable: true),
                    CloudUrl = table.Column<string>(type: "text", nullable: true),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PdfFileRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PdfFileRecords_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PdfFileRecords_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PdfFileRecords_CompanyId",
                table: "PdfFileRecords",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PdfFileRecords_CreatedByUserId",
                table: "PdfFileRecords",
                column: "CreatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PdfFileRecords");

            migrationBuilder.DropColumn(
                name: "InvoiceDate",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "TVA",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "TotalHT",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "TotalTTC",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "PdfBaseFolderPath",
                table: "CompanySettings");
        }
    }
}
