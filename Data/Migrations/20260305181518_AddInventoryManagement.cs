using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ResourceManager.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductServiceId",
                table: "SupplierInvoiceItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductServiceId",
                table: "QuoteItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "ProductServices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "ProductServices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentStock",
                table: "ProductServices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsStockTracked",
                table: "ProductServices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumStock",
                table: "ProductServices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumStock",
                table: "ProductServices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReorderPoint",
                table: "ProductServices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SKU",
                table: "ProductServices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SupplierId",
                table: "ProductServices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnitOfMeasure",
                table: "ProductServices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "WarehouseId",
                table: "ProductServices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Weight",
                table: "ProductServices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductServiceId",
                table: "InvoiceItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductServiceId",
                table: "DeliveryNoteItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PurchaseOrders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpectedDeliveryDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SupplierId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CurrencySymbol = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SubTotal = table.Column<decimal>(type: "numeric", nullable: true),
                    TaxAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    SupplierInvoiceId = table.Column<int>(type: "integer", nullable: true),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_SupplierInvoices_SupplierInvoiceId",
                        column: x => x.SupplierInvoiceId,
                        principalTable: "SupplierInvoices",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockAlerts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductServiceId = table.Column<int>(type: "integer", nullable: false),
                    AlertType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Threshold = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentQuantity = table.Column<decimal>(type: "numeric", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    IsResolved = table.Column<bool>(type: "boolean", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockAlerts_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StockAlerts_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockAlerts_ProductServices_ProductServiceId",
                        column: x => x.ProductServiceId,
                        principalTable: "ProductServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Warehouses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Warehouses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Warehouses_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Warehouses_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseOrderItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductServiceId = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric", nullable: false),
                    ReceivedQuantity = table.Column<decimal>(type: "numeric", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxRate = table.Column<decimal>(type: "numeric", nullable: true),
                    PurchaseOrderId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderItems_ProductServices_ProductServiceId",
                        column: x => x.ProductServiceId,
                        principalTable: "ProductServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductServiceId = table.Column<int>(type: "integer", nullable: false),
                    MovementType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric", nullable: true),
                    StockAfter = table.Column<decimal>(type: "numeric", nullable: false),
                    ReferenceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ReferenceId = table.Column<int>(type: "integer", nullable: true),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    WarehouseId = table.Column<int>(type: "integer", nullable: true),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ModifiedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Treated = table.Column<bool>(type: "boolean", nullable: false),
                    TreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    TreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockMovements_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StockMovements_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockMovements_ProductServices_ProductServiceId",
                        column: x => x.ProductServiceId,
                        principalTable: "ProductServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StockMovements_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Warehouses",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SupplierInvoiceItems_ProductServiceId",
                table: "SupplierInvoiceItems",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteItems_ProductServiceId",
                table: "QuoteItems",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductServices_SupplierId",
                table: "ProductServices",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductServices_WarehouseId",
                table: "ProductServices",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_ProductServiceId",
                table: "InvoiceItems",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryNoteItems_ProductServiceId",
                table: "DeliveryNoteItems",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderItems_ProductServiceId",
                table: "PurchaseOrderItems",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderItems_PurchaseOrderId",
                table: "PurchaseOrderItems",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_CompanyId",
                table: "PurchaseOrders",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_CreatedByUserId",
                table: "PurchaseOrders",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_SupplierId",
                table: "PurchaseOrders",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_SupplierInvoiceId",
                table: "PurchaseOrders",
                column: "SupplierInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_StockAlerts_CompanyId",
                table: "StockAlerts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_StockAlerts_CreatedByUserId",
                table: "StockAlerts",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockAlerts_ProductServiceId",
                table: "StockAlerts",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CompanyId",
                table: "StockMovements",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CreatedByUserId",
                table: "StockMovements",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_ProductServiceId",
                table: "StockMovements",
                column: "ProductServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_WarehouseId",
                table: "StockMovements",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_Warehouses_CompanyId",
                table: "Warehouses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Warehouses_CreatedByUserId",
                table: "Warehouses",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryNoteItems_ProductServices_ProductServiceId",
                table: "DeliveryNoteItems",
                column: "ProductServiceId",
                principalTable: "ProductServices",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_ProductServices_ProductServiceId",
                table: "InvoiceItems",
                column: "ProductServiceId",
                principalTable: "ProductServices",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductServices_Suppliers_SupplierId",
                table: "ProductServices",
                column: "SupplierId",
                principalTable: "Suppliers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductServices_Warehouses_WarehouseId",
                table: "ProductServices",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_QuoteItems_ProductServices_ProductServiceId",
                table: "QuoteItems",
                column: "ProductServiceId",
                principalTable: "ProductServices",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SupplierInvoiceItems_ProductServices_ProductServiceId",
                table: "SupplierInvoiceItems",
                column: "ProductServiceId",
                principalTable: "ProductServices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryNoteItems_ProductServices_ProductServiceId",
                table: "DeliveryNoteItems");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceItems_ProductServices_ProductServiceId",
                table: "InvoiceItems");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductServices_Suppliers_SupplierId",
                table: "ProductServices");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductServices_Warehouses_WarehouseId",
                table: "ProductServices");

            migrationBuilder.DropForeignKey(
                name: "FK_QuoteItems_ProductServices_ProductServiceId",
                table: "QuoteItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SupplierInvoiceItems_ProductServices_ProductServiceId",
                table: "SupplierInvoiceItems");

            migrationBuilder.DropTable(
                name: "PurchaseOrderItems");

            migrationBuilder.DropTable(
                name: "StockAlerts");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.DropTable(
                name: "PurchaseOrders");

            migrationBuilder.DropTable(
                name: "Warehouses");

            migrationBuilder.DropIndex(
                name: "IX_SupplierInvoiceItems_ProductServiceId",
                table: "SupplierInvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_QuoteItems_ProductServiceId",
                table: "QuoteItems");

            migrationBuilder.DropIndex(
                name: "IX_ProductServices_SupplierId",
                table: "ProductServices");

            migrationBuilder.DropIndex(
                name: "IX_ProductServices_WarehouseId",
                table: "ProductServices");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceItems_ProductServiceId",
                table: "InvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryNoteItems_ProductServiceId",
                table: "DeliveryNoteItems");

            migrationBuilder.DropColumn(
                name: "ProductServiceId",
                table: "SupplierInvoiceItems");

            migrationBuilder.DropColumn(
                name: "ProductServiceId",
                table: "QuoteItems");

            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "CurrentStock",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "IsStockTracked",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "MaximumStock",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "MinimumStock",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "ReorderPoint",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "SKU",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "UnitOfMeasure",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "Weight",
                table: "ProductServices");

            migrationBuilder.DropColumn(
                name: "ProductServiceId",
                table: "InvoiceItems");

            migrationBuilder.DropColumn(
                name: "ProductServiceId",
                table: "DeliveryNoteItems");
        }
    }
}
