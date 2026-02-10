namespace ResourceManager.Services
{
   

    public class SupabaseStorageService
    {
        private readonly Supabase.Client _client;

        public SupabaseStorageService(IConfiguration configuration)
        {
            var url = configuration["Supabase:Url"];
            var key = configuration["Supabase:Key"];

            var options = new Supabase.SupabaseOptions
            {
                AutoRefreshToken = true,
                AutoConnectRealtime = false
            };

            _client = new Supabase.Client(url ?? "", key, options);
        }

        public async Task<string> UploadPdfAsync(byte[] fileBytes, string folderPath, string fileName)
        {
            await _client.InitializeAsync();

            // 1. Construct the full path (e.g., "2025/January/Invoice_Xen.pdf")
            // Supabase handles folder creation automatically!
            string fullPath = $"{folderPath}/{fileName}";

            // 2. Upload
            // Note: 'invoices' is the name of the bucket we created in Step 1
            await _client.Storage
                .From("Moovma Crea")
                .Upload(fileBytes, fullPath, new Supabase.Storage.FileOptions { Upsert = true });

            // 3. Get the Public URL so you can save it in the database
            string publicUrl = _client.Storage
                .From("Moovma Crea")
                .GetPublicUrl(fullPath);

            return publicUrl;
        }

        public async Task DeleteFileAsync(string path)
        {
            await _client.InitializeAsync();
            await _client.Storage.From("Moovma Crea").Remove(new List<string> { path });
        }
        public async Task DeleteFileByUrlAsync(string publicUrl)
        {
            if (string.IsNullOrEmpty(publicUrl)) return;

            await _client.InitializeAsync();

            // 1. Extract the "Relative Path" from the long URL
            // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[folder]/[file.pdf]
            // We need just: "[folder]/[file.pdf]"

            var uri = new Uri(publicUrl);
            string path = uri.AbsolutePath;

            // The path usually comes in as "/storage/v1/object/public/invoices/2026/Jan/file.pdf"
            // We need to remove the Supabase prefix to get the real path inside the bucket.

            // Adjust "invoices" if your bucket name is different
            string bucketName = "invoices";
            string splitMarker = $"/public/{bucketName}/";

            int index = path.IndexOf(splitMarker);
            if (index != -1)
            {
                // This gets "2026/Jan/file.pdf"
                string relativePath = path.Substring(index + splitMarker.Length);

                // 2. Perform the Delete
                // The API expects a List of strings
                await _client.Storage.From(bucketName).Remove(new List<string> { relativePath });
            }
        }
    }
}

