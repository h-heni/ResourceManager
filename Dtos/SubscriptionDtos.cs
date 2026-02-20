namespace ResourceManager.Dtos
{
    /// <summary>
    /// DTO for updating a company's subscription settings.
    /// All fields are optional — only provided fields will be updated.
    /// </summary>
    public record UpdateSubscriptionDto
    {
        public DateTime? SubscriptionExpiryDate { get; set; }
        public string? AccountStatus { get; set; }
        public int? EmployeeLimit { get; set; }
    }
}
