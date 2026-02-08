namespace ResourceManager.Mobile.Views;

public partial class LoginPage : ContentPage
{
	public LoginPage()
	{
		InitializeComponent();
	}

    private async void OnLoginClicked(object sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(EmailEntry.Text) || string.IsNullOrWhiteSpace(PasswordEntry.Text))
        {
            await DisplayAlert("Error", "Please enter email and password", "OK");
            return;
        }
        
        LoadingSpinner.IsRunning = true;
        try 
        {
            var customUrl = UrlEntry.Text?.Trim();
            if(string.IsNullOrEmpty(customUrl)) customUrl = "http://localhost:5276/api/";

            var service = new Services.RestService(customUrl);
            var result = await service.LoginAsync(EmailEntry.Text, PasswordEntry.Text);
        
            if (result != null && !string.IsNullOrEmpty(result.Token))
            {
                 // Store token
                 Preferences.Set("auth_token", result.Token);
                 Application.Current.MainPage = new AppShell();
            }
            else
            {
                 await DisplayAlert("Error", "Login failed. Check credentials.", "OK");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Login Exception: {ex}");
            await DisplayAlert("Login Error", ex.Message, "OK");
        }
        finally 
        {
            LoadingSpinner.IsRunning = false;
        }
    }

    private async void OnBiometricClicked(object sender, EventArgs e)
    {
        var request = new Plugin.Fingerprint.Abstractions.AuthenticationRequestConfiguration("Login", "Prove you have fingers!");
        var result = await Plugin.Fingerprint.CrossFingerprint.Current.AuthenticateAsync(request);

        if (result.Authenticated)
        {
             Application.Current.MainPage = new AppShell();
        }
        else
        {
             await DisplayAlert("Error", "Biometric authentication failed", "OK");
        }
    }
}
