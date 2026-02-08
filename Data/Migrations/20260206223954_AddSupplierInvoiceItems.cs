using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierInvoiceItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "ConfidenceScore",
                table: "FournisseurInvoices",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExtractionStatus",
                table: "FournisseurInvoices",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RawExtractedText",
                table: "FournisseurInvoices",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FournisseurInvoiceItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "TEXT", nullable: false),
                    TaxRate = table.Column<decimal>(type: "TEXT", nullable: true),
                    FournisseurInvoiceId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FournisseurInvoiceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FournisseurInvoiceItems_FournisseurInvoices_FournisseurInvoiceId",
                        column: x => x.FournisseurInvoiceId,
                        principalTable: "FournisseurInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FournisseurInvoiceItems_FournisseurInvoiceId",
                table: "FournisseurInvoiceItems",
                column: "FournisseurInvoiceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FournisseurInvoiceItems");

            migrationBuilder.DropColumn(
                name: "ConfidenceScore",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "ExtractionStatus",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "RawExtractedText",
                table: "FournisseurInvoices");
        }
    }
}
