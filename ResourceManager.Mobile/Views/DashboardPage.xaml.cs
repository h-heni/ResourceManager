namespace ResourceManager.Mobile.Views;

public partial class DashboardPage : ContentPage
{
	public DashboardPage()
	{
		InitializeComponent();
        LoadDummyData();
	}

    private void LoadDummyData()
    {
        Task.Run(async () => 
        {
            var token = Preferences.Get("auth_token", string.Empty);
            if(string.IsNullOrEmpty(token)) return;

            var service = new Services.RestService();
            service.SetAuthToken(token);

            var summary = await service.GetDashboardSummaryAsync();
            var invoices = await service.GetInvoicesAsync();

            MainThread.BeginInvokeOnMainThread(() =>
            {
                if(summary != null)
                {
                     // Ideally use Bindings, but direct set for quick demo
                     RevenueLabel.Text = $"TND {summary.TotalRevenue:N3}";
                }
                InvoicesList.ItemsSource = invoices;
            });
        });
    }
}
