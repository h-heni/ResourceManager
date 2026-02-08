using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;

public class GoogleIntegrationService
{
    private readonly string ApplicationName = "My Invoice App";
    private string? _clientId;
    private string? _clientSecret;
    private string? _refreshToken;

    // Inject Configuration to read from appsettings.json
    public GoogleIntegrationService(IConfiguration configuration)
    {
        _clientId = configuration["Google:ClientId"];
        _clientSecret = configuration["Google:ClientSecret"];
        _refreshToken = configuration["Google:RefreshToken"];
    }

    private UserCredential GetCredentials()
    {
        // This creates the "Silent Login" using your Refresh Token
        var tokenResponse = new TokenResponse { RefreshToken = _refreshToken };

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _clientId,
                ClientSecret = _clientSecret
            }
        });

        return new UserCredential(flow, "user", tokenResponse);
    }

    // --- 1. UPLOAD FILE ---
    public async Task<string> UploadFileToDriveAsync(Stream fileStream, string fileName, string contentType, string parentFolderId)
    {
        var service = new DriveService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        var fileMetadata = new Google.Apis.Drive.v3.Data.File()
        {
            Name = fileName,
            Parents = new List<string> { parentFolderId }
        };

        var request = service.Files.Create(fileMetadata, fileStream, contentType);
        request.Fields = "id";

        var response = await request.UploadAsync();
        if (response.Status != Google.Apis.Upload.UploadStatus.Completed)
            throw new Exception("Upload failed: " + response.Exception?.Message);

        return request.ResponseBody.Id;
    }

    // --- 2. UPDATE EXCEL/SHEET LOG ---
    // NEW METHOD: Writes to a sheet using the ID (gid) instead of the Name
    public async Task WriteToFirstEmptyRowAsync(string spreadsheetId, int sheetPageId, IList<object> rowData)
    {
        var service = new SheetsService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        // 1. GET SHEET NAME FROM ID
        var spreadsheet = await service.Spreadsheets.Get(spreadsheetId).ExecuteAsync();
        var sheet = spreadsheet.Sheets.FirstOrDefault(s => s.Properties.SheetId == sheetPageId);
        if (sheet == null) throw new Exception("Sheet not found");
        string sheetName = sheet.Properties.Title;

        // 2. READ COLUMN A (Date) TO FIND WHERE DATA ENDS
        // We fetch Column A to see how many rows are filled.
        var readRequest = service.Spreadsheets.Values.Get(spreadsheetId, $"'{sheetName}'!A:A");
        var readResponse = await readRequest.ExecuteAsync();

        int nextRowNumber = 1;

        if (readResponse.Values != null)
        {
            // If there are 14 rows with dates, the next empty one is 15.
            nextRowNumber = readResponse.Values.Count + 1;
        }

        // 3. DEFINE THE RANGE TO WRITE TO (e.g., "Revenu!A15")
        var range = $"'{sheetName}'!A{nextRowNumber}";

        // 4. WRITE THE DATA (Using UPDATE, not APPEND)
        var valueRange = new ValueRange { Values = new List<IList<object>> { rowData } };
        var updateRequest = service.Spreadsheets.Values.Update(valueRange, spreadsheetId, range);
        updateRequest.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.USERENTERED;

        await updateRequest.ExecuteAsync();
    }

    // --- 3. FOLDER PATH LOGIC (Year/Month) ---
    public async Task<string> CreateFolderPathAsync(string rootFolderId, string[] folderPath)
    {
        string currentParentId = rootFolderId;
        foreach (var folderName in folderPath)
        {
            currentParentId = await GetOrCreateFolderAsync(currentParentId, folderName);
        }
        return currentParentId;
    }
    private async Task<string> GetOrCreateFolderAsync(string parentFolderId, string folderName)
    {
        var service = new DriveService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        // 1. CLEAN THE NAME (Crucial!)
        // This prevents "Xen" and "Xen " from being treated as different folders
        string cleanName = folderName.Trim();

        // 2. SEARCH QUERY
        // We look for:
        // - Name matches exactly
        // - Is a Folder (mimeType)
        // - Is inside the specific Parent
        // - Is NOT in the trash (trashed = false)
        var listRequest = service.Files.List();
        listRequest.Q = $"mimeType = 'application/vnd.google-apps.folder' and name = '{cleanName}' and '{parentFolderId}' in parents and trashed = false";
        listRequest.Fields = "files(id, name)";
        listRequest.PageSize = 10; // We only need 1, but fetching a few helps debug

        var result = await listRequest.ExecuteAsync();

        // 3. CHECK RESULTS
        if (result.Files != null && result.Files.Count > 0)
        {
            // FOUND IT!
            // If there are duplicates, we just pick the first one to avoid creating a third one.
            return result.Files.First().Id;
        }

        // 4. NOT FOUND -> CREATE IT
        var newFolder = new Google.Apis.Drive.v3.Data.File()
        {
            Name = cleanName,
            MimeType = "application/vnd.google-apps.folder",
            Parents = new List<string> { parentFolderId }
        };

        var createRequest = service.Files.Create(newFolder);
        createRequest.Fields = "id";
        var folder = await createRequest.ExecuteAsync();

        return folder.Id;
    }
    // 1. HELPER: Find a file or folder ID inside a specific parent
    private async Task<string> FindChildIdAsync(string parentId, string name, bool isFolder)
    {
        var service = new DriveService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        var request = service.Files.List();
        // Query: Name matches, Parent matches, Not in trash
        string query = $"name = '{name}' and '{parentId}' in parents and trashed = false";

        if (isFolder)
        {
            query += " and mimeType = 'application/vnd.google-apps.folder'";
        }
        else
        {
            // If we are looking for a file, ensure it is NOT a folder
            query += " and mimeType != 'application/vnd.google-apps.folder'";
        }

        request.Q = query;
        request.Fields = "files(id)";

        var result = await request.ExecuteAsync();
        return result.Files.FirstOrDefault()?.Id; // Returns ID or null if not found
    }

    // 2. MAIN METHOD: Delete by Path and Name
    public async Task DeleteFileByPathAsync(string rootFolderId, string[] folderPath, string fileName)
    {
        string currentParentId = rootFolderId;

        // A. Walk through the folders (e.g., "2025" -> "October")
        foreach (var folderName in folderPath)
        {
            currentParentId = await FindChildIdAsync(currentParentId, folderName, isFolder: true);

            if (currentParentId == null)
            {
                throw new Exception($"Folder '{folderName}' not found in the path.");
            }
        }

        // B. Find the file inside the final folder
        string fileId = await FindChildIdAsync(currentParentId, fileName, isFolder: false);

        if (fileId == null)
        {
            throw new Exception($"File '{fileName}' not found in folder.");
        }

        // C. Delete it (using the Trash method we made earlier)
        await MoveFileToTrashAsync(fileId);
    }
    // OPTION A: Permanent Delete (Caution: Cannot be undone!)
    public async Task DeleteFilePermanentlyAsync(string fileId)
    {
        var service = new DriveService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        try
        {
            await service.Files.Delete(fileId).ExecuteAsync();
        }
        catch (Google.GoogleApiException e)
        {
            if (e.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // File is already gone, ignore the error
                return;
            }
            throw;
        }
    }

    // OPTION B: Move to Trash (Recommended - Safer)
    public async Task MoveFileToTrashAsync(string fileId)
    {
        var service = new DriveService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = GetCredentials(),
            ApplicationName = ApplicationName,
        });

        var fileMetadata = new Google.Apis.Drive.v3.Data.File()
        {
            Trashed = true
        };

        // We use "Update" to change the "Trashed" status to true
        var request = service.Files.Update(fileMetadata, fileId);
        await request.ExecuteAsync();
    }
}