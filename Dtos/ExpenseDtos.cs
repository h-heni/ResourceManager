namespace ResourceManager.Dtos
{
    public class CreateExpenseDto
    {
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime? Date { get; set; }
        public string Category { get; set; } = "other";
        public string? Notes { get; set; }
        public bool IsRecurring { get; set; } = false;
    }

    public class UpdateExpenseDto
    {
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime? Date { get; set; }
        public string Category { get; set; } = "other";
        public string? Notes { get; set; }
        public bool IsRecurring { get; set; } = false;
    }
}
