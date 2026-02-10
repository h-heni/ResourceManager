using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmployeeLimit",
                table: "Companies",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmployeeLimit",
                table: "Companies");
        }
    }
}
