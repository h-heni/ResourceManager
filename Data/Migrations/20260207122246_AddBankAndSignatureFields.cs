using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBankAndSignatureFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankBIC",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankIBAN",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankRIB",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowBankBIC",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowBankIBAN",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowBankName",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowBankRIB",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowSignatureOnPdf",
                table: "CompanySettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SignatureImageContentType",
                table: "CompanySettings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "SignatureImageData",
                table: "CompanySettings",
                type: "BLOB",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankBIC",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "BankIBAN",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "BankRIB",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "ShowBankBIC",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "ShowBankIBAN",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "ShowBankName",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "ShowBankRIB",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "ShowSignatureOnPdf",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "SignatureImageContentType",
                table: "CompanySettings");

            migrationBuilder.DropColumn(
                name: "SignatureImageData",
                table: "CompanySettings");
        }
    }
}
