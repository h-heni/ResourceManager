using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHistoricalRevenueInvoiceLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Safely rename Reference -> InvoiceNumber OR add InvoiceNumber if Reference doesn't exist
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'HistoricalRevenues' AND column_name = 'Reference') THEN
                        ALTER TABLE ""HistoricalRevenues"" RENAME COLUMN ""Reference"" TO ""InvoiceNumber"";
                        ALTER TABLE ""HistoricalRevenues"" ALTER COLUMN ""InvoiceNumber"" TYPE character varying(100);
                    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                      WHERE table_name = 'HistoricalRevenues' AND column_name = 'InvoiceNumber') THEN
                        ALTER TABLE ""HistoricalRevenues"" ADD COLUMN ""InvoiceNumber"" character varying(100);
                    END IF;
                END $$;
            ");

            // Add InvoiceId column if it doesn't exist
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'HistoricalRevenues' AND column_name = 'InvoiceId') THEN
                        ALTER TABLE ""HistoricalRevenues"" ADD COLUMN ""InvoiceId"" integer;
                    END IF;
                END $$;
            ");

            // Create indexes if they don't exist
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_HistoricalRevenues_InvoiceId"" 
                ON ""HistoricalRevenues"" (""InvoiceId"");
            ");

            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_HistoricalRevenues_CompanyId_InvoiceId"" 
                ON ""HistoricalRevenues"" (""CompanyId"", ""InvoiceId"") 
                WHERE ""InvoiceId"" IS NOT NULL;
            ");

            // Add foreign key if it doesn't exist
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                                   WHERE constraint_name = 'FK_HistoricalRevenues_Invoices_InvoiceId') THEN
                        ALTER TABLE ""HistoricalRevenues"" 
                        ADD CONSTRAINT ""FK_HistoricalRevenues_Invoices_InvoiceId"" 
                        FOREIGN KEY (""InvoiceId"") REFERENCES ""Invoices""(""Id"") ON DELETE SET NULL;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HistoricalRevenues_Invoices_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_CompanyId_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalRevenues_InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "HistoricalRevenues");

            migrationBuilder.AlterColumn<string>(
                name: "InvoiceNumber",
                table: "HistoricalRevenues",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.RenameColumn(
                name: "InvoiceNumber",
                table: "HistoricalRevenues",
                newName: "Reference");
        }
    }
}
