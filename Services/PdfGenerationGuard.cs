using System.Collections.Concurrent;

namespace ResourceManager.Services;

public static class PdfGenerationGuard
{
    private static readonly ConcurrentDictionary<string, byte> InProgress = new();

    public static bool TryEnter(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;
        return InProgress.TryAdd(key, 0);
    }

    public static void Exit(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        InProgress.TryRemove(key, out _);
    }
}
