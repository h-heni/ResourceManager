using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class addCreatedByUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Clients_AspNetUsers_UserId",
                table: "Clients");

            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryNotes_AspNetUsers_UserId",
                table: "DeliveryNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_Devis_AspNetUsers_UserId",
                table: "Devis");

            migrationBuilder.DropForeignKey(
                name: "FK_Fournisseurs_AspNetUsers_UserId",
                table: "Fournisseurs");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_AspNetUsers_UserId",
                table: "Invoices");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Invoices",
                newName: "CreatedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Invoices_UserId",
                table: "Invoices",
                newName: "IX_Invoices_CreatedByUserId");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Fournisseurs",
                newName: "CreatedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Fournisseurs_UserId",
                table: "Fournisseurs",
                newName: "IX_Fournisseurs_CreatedByUserId");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Devis",
                newName: "CreatedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Devis_UserId",
                table: "Devis",
                newName: "IX_Devis_CreatedByUserId");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "DeliveryNotes",
                newName: "CreatedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_DeliveryNotes_UserId",
                table: "DeliveryNotes",
                newName: "IX_DeliveryNotes_CreatedByUserId");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Clients",
                newName: "CreatedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Clients_UserId",
                table: "Clients",
                newName: "IX_Clients_CreatedByUserId");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "FournisseurInvoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "FournisseurInvoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "FournisseurInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FournisseurInvoices_CompanyId",
                table: "FournisseurInvoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_FournisseurInvoices_UserId",
                table: "FournisseurInvoices",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Clients_AspNetUsers_CreatedByUserId",
                table: "Clients",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryNotes_AspNetUsers_CreatedByUserId",
                table: "DeliveryNotes",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Devis_AspNetUsers_CreatedByUserId",
                table: "Devis",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FournisseurInvoices_AspNetUsers_UserId",
                table: "FournisseurInvoices",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FournisseurInvoices_Companies_CompanyId",
                table: "FournisseurInvoices",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Fournisseurs_AspNetUsers_CreatedByUserId",
                table: "Fournisseurs",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_AspNetUsers_CreatedByUserId",
                table: "Invoices",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Clients_AspNetUsers_CreatedByUserId",
                table: "Clients");

            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryNotes_AspNetUsers_CreatedByUserId",
                table: "DeliveryNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_Devis_AspNetUsers_CreatedByUserId",
                table: "Devis");

            migrationBuilder.DropForeignKey(
                name: "FK_FournisseurInvoices_AspNetUsers_UserId",
                table: "FournisseurInvoices");

            migrationBuilder.DropForeignKey(
                name: "FK_FournisseurInvoices_Companies_CompanyId",
                table: "FournisseurInvoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Fournisseurs_AspNetUsers_CreatedByUserId",
                table: "Fournisseurs");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_AspNetUsers_CreatedByUserId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_FournisseurInvoices_CompanyId",
                table: "FournisseurInvoices");

            migrationBuilder.DropIndex(
                name: "IX_FournisseurInvoices_UserId",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "FournisseurInvoices");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "AspNetUsers");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserId",
                table: "Invoices",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Invoices_CreatedByUserId",
                table: "Invoices",
                newName: "IX_Invoices_UserId");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserId",
                table: "Fournisseurs",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Fournisseurs_CreatedByUserId",
                table: "Fournisseurs",
                newName: "IX_Fournisseurs_UserId");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserId",
                table: "Devis",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Devis_CreatedByUserId",
                table: "Devis",
                newName: "IX_Devis_UserId");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserId",
                table: "DeliveryNotes",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_DeliveryNotes_CreatedByUserId",
                table: "DeliveryNotes",
                newName: "IX_DeliveryNotes_UserId");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserId",
                table: "Clients",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Clients_CreatedByUserId",
                table: "Clients",
                newName: "IX_Clients_UserId");

            migrationBuilder.AlterColumn<string>(
                name: "Id",
                table: "UserProfiles",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddForeignKey(
                name: "FK_Clients_AspNetUsers_UserId",
                table: "Clients",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryNotes_AspNetUsers_UserId",
                table: "DeliveryNotes",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Devis_AspNetUsers_UserId",
                table: "Devis",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Fournisseurs_AspNetUsers_UserId",
                table: "Fournisseurs",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_AspNetUsers_UserId",
                table: "Invoices",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }
    }
}
