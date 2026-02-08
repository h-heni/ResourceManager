namespace ResourceManager.Services
{
    public class Time
    {
        public DateTime GetTunisNow()
        {
            // Preferred: install TimeZoneConverter (NuGet package TimeZoneConverter)
            try
            {
                var tz = TimeZoneConverter.TZConvert.GetTimeZoneInfo("Africa/Tunis");
                return TimeZoneInfo.ConvertTime(DateTime.UtcNow, TimeZoneInfo.Utc, tz);
            }
            catch
            {
                // Fallback: try common IDs directly (works on matching platforms)
                string[] candidates = new[] { "Africa/Tunis", "W. Central Africa Standard Time" };
                foreach (var id in candidates)
                {
                    try
                    {
                        var tz = TimeZoneInfo.FindSystemTimeZoneById(id);
                        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                    }
                    catch { }
                }

                // Last resort: assume UTC+1 (Tunisia currently UTC+1, no DST)
                return DateTime.UtcNow.AddHours(1);
            }
        }
    }
}
