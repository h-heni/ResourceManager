using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameNumTelToPhone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Copy data from NumTel to Phone in Companies before dropping
            migrationBuilder.Sql("UPDATE \"Companies\" SET \"Phone\" = COALESCE(\"NumTel\", '') WHERE \"Phone\" IS NULL OR \"Phone\" = ''");
            
            migrationBuilder.DropColumn(
                name: "NumTel",
                table: "Companies");

            migrationBuilder.RenameColumn(
                name: "NumTel",
                table: "Fournisseurs",
                newName: "Phone");

            migrationBuilder.RenameColumn(
                name: "NumTel",
                table: "Clients",
                newName: "Phone");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Phone",
                table: "Fournisseurs",
                newName: "NumTel");

            migrationBuilder.RenameColumn(
                name: "Phone",
                table: "Clients",
                newName: "NumTel");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Companies",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "NumTel",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");
                
            // Copy data back from Phone to NumTel
            migrationBuilder.Sql("UPDATE \"Companies\" SET \"NumTel\" = COALESCE(\"Phone\", '')");
        }
    }
}
