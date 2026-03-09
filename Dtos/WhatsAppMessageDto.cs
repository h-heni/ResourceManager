using System.ComponentModel.DataAnnotations;

namespace ResourceManager.DTOs
{
    /// <summary>
    /// DTO for sending an invoice via WhatsApp Cloud API
    /// </summary>
    public class SendInvoiceWhatsAppDto
    {
        public string? CustomMessage { get; set; }
        public bool SendPaymentReminder { get; set; } = false;
    }

    /// <summary>
    /// DTO for sending a generic document via WhatsApp
    /// </summary>
    public class SendDocumentWhatsAppDto
    {
        public string? CustomMessage { get; set; }
    }

    /// <summary>
    /// DTO for sending a document (quote, delivery note, PO) via email
    /// </summary>
    public class SendDocumentEmailDto
    {
        public string? RecipientEmail { get; set; }
        public string? Subject { get; set; }
        public string? Body { get; set; }
        public bool? AttachPdf { get; set; } = true;
    }

    /// <summary>
    /// Response from the WhatsApp Cloud API send operation
    /// </summary>
    public class WhatsAppSendResponse
    {
        public bool Success { get; set; }
        public string MessageId { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? Error { get; set; }
    }
}
