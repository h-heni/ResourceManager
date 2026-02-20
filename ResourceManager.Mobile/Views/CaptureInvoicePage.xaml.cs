using ResourceManager.Mobile.Services;
using System.Text.Json;

namespace ResourceManager.Mobile.Views;

public partial class CaptureInvoicePage : ContentPage
{
    private readonly ImageProcessingService _imageService = new();
    private byte[]? _originalImageData;
    private byte[]? _currentImageData;
    private string? _capturedFilePath;
    private bool _isProcessing;

    public CaptureInvoicePage()
    {
        InitializeComponent();
    }

    #region Capture & Pick

    private async void OnCaptureClicked(object? sender, EventArgs e)
    {
        try
        {
            if (!MediaPicker.Default.IsCaptureSupported)
            {
                await DisplayAlert("Not Supported", "Camera capture is not available on this device.", "OK");
                return;
            }

            var photo = await MediaPicker.Default.CapturePhotoAsync(new MediaPickerOptions
            {
                Title = "Capture Invoice"
            });

            if (photo != null)
                await LoadCapturedImage(photo);
        }
        catch (PermissionException)
        {
            await DisplayAlert("Permission Needed",
                "Camera permission is required to capture invoice photos. Please enable it in Settings.", "OK");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"Failed to capture photo: {ex.Message}", "OK");
        }
    }

    private async void OnPickFromGalleryClicked(object? sender, EventArgs e)
    {
        try
        {
            var photo = await MediaPicker.Default.PickPhotoAsync(new MediaPickerOptions
            {
                Title = "Select Invoice Image"
            });

            if (photo != null)
                await LoadCapturedImage(photo);
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"Failed to pick photo: {ex.Message}", "OK");
        }
    }

    private async Task LoadCapturedImage(FileResult photo)
    {
        ShowLoading("Loading image...");
        try
        {
            using var stream = await photo.OpenReadAsync();
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms);
            _originalImageData = ms.ToArray();

            // Resize if too large (> 4096px)
            _originalImageData = _imageService.ResizeToMax(_originalImageData, 4096);
            _currentImageData = _originalImageData;
            _capturedFilePath = photo.FullPath;

            await UpdatePreview();
            ShowPreviewState();
            StatusLabel.Text = "Ready to process";
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"Failed to load image: {ex.Message}", "OK");
        }
        finally
        {
            HideLoading();
        }
    }

    #endregion

    #region Image Processing Actions

    private async void OnAutoEnhanceClicked(object? sender, EventArgs e)
    {
        if (_originalImageData == null) return;
        ShowLoading("Auto-enhancing...");
        try
        {
            await Task.Run(() =>
            {
                _currentImageData = _imageService.AutoEnhance(_originalImageData);
            });
            await UpdatePreview();
            StatusLabel.Text = "✨ Enhanced";
            ResetSliders();
        }
        finally { HideLoading(); }
    }

    private async void OnGrayscaleClicked(object? sender, EventArgs e)
    {
        if (_currentImageData == null) return;
        ShowLoading("Converting...");
        try
        {
            await Task.Run(() =>
            {
                _currentImageData = _imageService.ToGrayscale(_currentImageData);
            });
            await UpdatePreview();
            StatusLabel.Text = "Grayscale applied";
        }
        finally { HideLoading(); }
    }

    private async void OnThresholdClicked(object? sender, EventArgs e)
    {
        if (_currentImageData == null) return;
        ShowLoading("Applying threshold...");
        try
        {
            await Task.Run(() =>
            {
                _currentImageData = _imageService.ApplyThreshold(_currentImageData, 128);
            });
            await UpdatePreview();
            StatusLabel.Text = "B&W threshold applied";
        }
        finally { HideLoading(); }
    }

    private async void OnAutoCropClicked(object? sender, EventArgs e)
    {
        if (_currentImageData == null) return;
        ShowLoading("Auto-cropping...");
        try
        {
            await Task.Run(() =>
            {
                _currentImageData = _imageService.AutoCrop(_currentImageData);
            });
            await UpdatePreview();
            StatusLabel.Text = "Auto-cropped";
        }
        finally { HideLoading(); }
    }

    private async void OnResetClicked(object? sender, EventArgs e)
    {
        if (_originalImageData == null) return;
        _currentImageData = _originalImageData;
        ResetSliders();
        await UpdatePreview();
        StatusLabel.Text = "Reset to original";
    }

    private void OnBrightnessChanged(object? sender, ValueChangedEventArgs e)
    {
        BrightnessLabel.Text = $"{(int)e.NewValue}";
    }

    private void OnContrastChanged(object? sender, ValueChangedEventArgs e)
    {
        ContrastLabel.Text = $"{e.NewValue:F1}";
    }

    private void OnRotationChanged(object? sender, ValueChangedEventArgs e)
    {
        RotationLabel.Text = $"{e.NewValue:F1}°";
    }

    private async void OnApplyAdjustmentsClicked(object? sender, EventArgs e)
    {
        if (_originalImageData == null) return;
        ShowLoading("Applying adjustments...");
        try
        {
            float brightness = (float)BrightnessSlider.Value;
            float contrast = (float)ContrastSlider.Value;
            float rotation = (float)RotationSlider.Value;

            await Task.Run(() =>
            {
                // Start from original, apply all
                var data = _originalImageData;

                if (Math.Abs(brightness) > 1)
                    data = _imageService.AdjustBrightness(data, brightness);

                if (Math.Abs(contrast - 1.0f) > 0.05f)
                    data = _imageService.AdjustContrast(data, contrast);

                if (Math.Abs(rotation) > 0.5f)
                    data = _imageService.Rotate(data, rotation);

                _currentImageData = data;
            });

            await UpdatePreview();
            StatusLabel.Text = "Adjustments applied";
        }
        finally { HideLoading(); }
    }

    #endregion

    #region Upload

    private async void OnUploadClicked(object? sender, EventArgs e)
    {
        if (_currentImageData == null) return;

        ShowLoading("Uploading & extracting...");
        try
        {
            var token = Preferences.Get("auth_token", string.Empty);
            var apiUrl = Preferences.Get("api_url", "http://localhost:5276/api/");

            if (string.IsNullOrEmpty(token))
            {
                await DisplayAlert("Auth Required", "Please log in first.", "OK");
                return;
            }

            var rest = new RestService(apiUrl);
            rest.SetAuthToken(token);

            var result = await rest.UploadSupplierInvoiceAsync(_currentImageData, "invoice_scan.png");

            if (result != null)
            {
                ShowExtractionResults(result);
                StatusLabel.Text = "✅ Extraction complete";
            }
            else
            {
                await DisplayAlert("Upload Failed",
                    "The server could not process this image. Try enhancing the image quality first.", "OK");
                StatusLabel.Text = "❌ Upload failed";
            }
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"Upload failed: {ex.Message}", "OK");
            StatusLabel.Text = "❌ Error";
        }
        finally { HideLoading(); }
    }

    private void ShowExtractionResults(SupplierExtractionResult result)
    {
        ExtSupplierLabel.Text = result.SupplierName ?? "Unknown";
        ExtInvoiceNumLabel.Text = result.InvoiceNumber ?? "—";
        ExtTotalLabel.Text = result.TotalTTC > 0 ? $"{result.TotalTTC:N2}" : "—";
        ExtTotalHTLabel.Text = result.TotalHT > 0 ? $"{result.TotalHT:N2}" : "—";
        ExtTVALabel.Text = result.TVA > 0 ? $"{result.TVA:N2}" : "—";
        ExtDateLabel.Text = result.InvoiceDate ?? "—";

        var confidence = result.ConfidenceScore / 100.0;
        ConfidenceBar.Progress = confidence;
        ConfidenceLabel.Text = $"{result.ConfidenceScore:F0}%";

        if (result.ItemCount > 0)
        {
            ItemsCountFrame.IsVisible = true;
            ExtItemsLabel.Text = $"📦 {result.ItemCount} line items extracted";
        }

        ResultsFrame.IsVisible = true;
    }

    private async void OnConfirmOnWebClicked(object? sender, EventArgs e)
    {
        await DisplayAlert("Confirm on Web",
            "Open the Supplier Invoices page in your web browser to review and confirm the extracted data.",
            "OK");
    }

    #endregion

    #region UI Helpers

    private void ShowPreviewState()
    {
        EmptyStateFrame.IsVisible = false;
        PreviewFrame.IsVisible = true;
        ToolsFrame.IsVisible = true;
        UploadButton.IsEnabled = true;
    }

    private async Task UpdatePreview()
    {
        if (_currentImageData == null) return;

        PreviewImage.Source = ImageSource.FromStream(() => new MemoryStream(_currentImageData));

        var dims = _imageService.GetDimensions(_currentImageData);
        ImageInfoLabel.Text = $"{dims.Width} × {dims.Height} px";
        double sizeKB = _currentImageData.Length / 1024.0;
        FileSizeLabel.Text = sizeKB > 1024
            ? $"{sizeKB / 1024:F1} MB"
            : $"{sizeKB:F0} KB";

        await Task.CompletedTask;
    }

    private void ResetSliders()
    {
        BrightnessSlider.Value = 0;
        ContrastSlider.Value = 1.0;
        RotationSlider.Value = 0;
    }

    private void ShowLoading(string message)
    {
        _isProcessing = true;
        LoadingLabel.Text = message;
        LoadingOverlay.IsVisible = true;
    }

    private void HideLoading()
    {
        _isProcessing = false;
        LoadingOverlay.IsVisible = false;
    }

    #endregion
}
