using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHistoricalRelationships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ClientId",
                table: "HistoricalRevenues",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FournisseurId",
                table: "HistoricalExpenses",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalRevenues_ClientId",
                table: "HistoricalRevenues",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalExpenses_FournisseurId",
                table: "HistoricalExpenses",
                column: "FournisseurId");

            migrationBuilder.AddForeignKey(
                name: "FK_HistoricalExpenses_Fournisseurs_FournisseurId",
                table: "HistoricalExpenses",
                column: "FournisseurId",
                principalTable: "Fournisseurs",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_HistoricalRevenues_Clients_ClientId",
                table: "HistoricalRevenues",
                column: "ClientId",
                principalTable: "Clients",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HistoricalExpenses_Fournisseurs_FournisseurId",
                table: "HistoricalExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_HistoricalRevenues_Clients_ClientId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_ClientId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalExpenses_FournisseurId",
                table: "HistoricalExpenses");

            migrationBuilder.DropColumn(
                name: "ClientId",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "FournisseurId",
                table: "HistoricalExpenses");
        }
    }
}
