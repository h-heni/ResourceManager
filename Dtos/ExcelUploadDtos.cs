
namespace ResourceManager.Dtos
{
    public class StrictRevenueRowDto
    {
        public DateTime Date { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public decimal AmountPaid { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string InvoiceNumber { get; set; } = string.Empty;
    }

    public class StrictExcelValidationResult
    {
        public bool IsValid { get; private set; }
        public string? ErrorMessage { get; private set; }
        public int? ErrorRow { get; private set; }
        public string? ErrorColumn { get; private set; }
        
        public List<StrictRevenueRowDto> Rows { get; private set; } = new();
        public int TotalRows => Rows.Count;

        public static StrictExcelValidationResult Success(List<StrictRevenueRowDto> rows)
        {
            return new StrictExcelValidationResult
            {
                IsValid = true,
                Rows = rows
            };
        }

        public static StrictExcelValidationResult Failure(int row, string col, string msg)
        {
            return new StrictExcelValidationResult
            {
                IsValid = false,
                ErrorRow = row,
                ErrorColumn = col,
                ErrorMessage = msg
            };
        }
    }
}
