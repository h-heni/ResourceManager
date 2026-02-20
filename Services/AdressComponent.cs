using ResourceManager.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Net;

namespace ResourceManager.Services
{
    public class AddressComponent : IComponent
    {
        private string Title { get; }
        private Client Client { get; }

        public AddressComponent(string title, Client client)
        {
            Title = title;
            Client = client;
        }


        public void Compose(IContainer container)
        {
            container.Column(column =>
            {
                column.Spacing(2);

                column.Item().BorderBottom(1).PaddingBottom(5).Text(Title).SemiBold();

                column.Item().Text(Client.Name);
                column.Item().Text(Client.Address);
                column.Item().Text(Client.TaxId);
                column.Item().Text(Client.Phone);
            });
        }

        
    }
}
