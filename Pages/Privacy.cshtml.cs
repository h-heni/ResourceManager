using Microsoft.AspNetCore.Mvc.RazorPages;
using ResourceManager.Models;
using ResourceManager.Services;
using QuestPDF.Companion;
using QuestPDF.Fluent;

namespace ResourceManager.Pages
{
    public class PrivacyModel : PageModel
    {
        private readonly ILogger<PrivacyModel> _logger;

        public PrivacyModel(ILogger<PrivacyModel> logger)
        {
            _logger = logger;
        }

        public void OnGet()
        {
            var invoicePdf = new Invoice
            {
                Number = "INV-1001",
                Date = DateTime.Now,
                Client = new Client
                {
                    Name = "Ste Xen Plus",
                    Address = "18, Mohamed Triki, Ennasr 2 2001",
                    MatriculeFiscal = "1452393/C/MA/000",
                    Phone = "(+216) 28 227 508",
                },
                Items = new List<IItem>
                {
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=1000000,  Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=234444, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=5.51m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "eageagetgrtg", Quantity=3, Price=0.01m ,Tva=true },
                    new InvoiceItem { Description = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.", Quantity=3, Price=0.01m ,Tva=true }
                },


            };
            //var document = new Document<Invoice>(invoicePdf);
            //document.GeneratePdfAndShow();
            //document.ShowInCompanion();

        } 
    }
}
