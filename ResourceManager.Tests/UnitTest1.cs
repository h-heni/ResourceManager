using ResourceManager.Services;

namespace ResourceManager.Tests;

public class PdfGenerationGuardTests
{
    [Fact]
    public void TryEnter_AllowsOnlySingleConcurrentEntryPerKey()
    {
        var key = $"remaining:test-{Guid.NewGuid()}";
        var successCount = 0;

        Parallel.For(0, 20, _ =>
        {
            if (PdfGenerationGuard.TryEnter(key))
                Interlocked.Increment(ref successCount);
        });

        Assert.Equal(1, successCount);

        PdfGenerationGuard.Exit(key);
    }

    [Fact]
    public void Exit_ReleasesKey_ForNextGeneration()
    {
        var key = $"remaining:test-{Guid.NewGuid()}";

        var firstEnter = PdfGenerationGuard.TryEnter(key);
        PdfGenerationGuard.Exit(key);
        var secondEnter = PdfGenerationGuard.TryEnter(key);

        Assert.True(firstEnter);
        Assert.True(secondEnter);

        PdfGenerationGuard.Exit(key);
    }
}
