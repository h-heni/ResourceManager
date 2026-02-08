using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class MakeDevisIdOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Devis_DevisId",
                table: "Invoices");

            migrationBuilder.AlterColumn<int>(
                name: "DevisId",
                table: "Invoices",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 22, 13, 5, 563, DateTimeKind.Utc).AddTicks(8143));

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 22, 13, 5, 563, DateTimeKind.Utc).AddTicks(8149));

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 22, 13, 5, 563, DateTimeKind.Utc).AddTicks(8151));

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Devis_DevisId",
                table: "Invoices",
                column: "DevisId",
                principalTable: "Devis",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Devis_DevisId",
                table: "Invoices");

            migrationBuilder.AlterColumn<int>(
                name: "DevisId",
                table: "Invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 14, 21, 4, 559, DateTimeKind.Utc).AddTicks(1698));

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 14, 21, 4, 559, DateTimeKind.Utc).AddTicks(1705));

            migrationBuilder.UpdateData(
                table: "Clients",
                keyColumn: "Id",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2026, 1, 18, 14, 21, 4, 559, DateTimeKind.Utc).AddTicks(1709));

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Devis_DevisId",
                table: "Invoices",
                column: "DevisId",
                principalTable: "Devis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
