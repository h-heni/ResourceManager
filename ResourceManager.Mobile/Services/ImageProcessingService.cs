using SkiaSharp;

namespace ResourceManager.Mobile.Services;

/// <summary>
/// Provides on-device image preprocessing to improve OCR accuracy
/// before uploading invoice photos to the backend API.
/// Uses SkiaSharp for all image operations.
/// </summary>
public class ImageProcessingService
{
    /// <summary>
    /// Auto-enhance an invoice photo for optimal OCR:
    /// grayscale → contrast boost → adaptive threshold → clean edges.
    /// </summary>
    public byte[] AutoEnhance(byte[] imageData)
    {
        using var original = SKBitmap.Decode(imageData);
        if (original == null) return imageData;

        // Step 1: Convert to grayscale
        using var grayscale = ApplyGrayscale(original);

        // Step 2: Enhance contrast
        using var contrasted = ApplyContrast(grayscale, 1.6f);

        // Step 3: Reduce shadows (normalize brightness)
        using var normalized = NormalizeBrightness(contrasted);

        // Step 4: Sharpen for text clarity
        using var sharpened = ApplySharpen(normalized);

        return EncodeToPng(sharpened);
    }

    /// <summary>
    /// Apply only grayscale conversion.
    /// </summary>
    public byte[] ToGrayscale(byte[] imageData)
    {
        using var original = SKBitmap.Decode(imageData);
        if (original == null) return imageData;
        using var result = ApplyGrayscale(original);
        return EncodeToPng(result);
    }

    /// <summary>
    /// Adjust brightness. Factor: -100 to +100.
    /// </summary>
    public byte[] AdjustBrightness(byte[] imageData, float factor)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;
        using var result = ApplyBrightness(bitmap, factor);
        return EncodeToPng(result);
    }

    /// <summary>
    /// Adjust contrast. Factor: 0.5 (low) to 3.0 (high), 1.0 = unchanged.
    /// </summary>
    public byte[] AdjustContrast(byte[] imageData, float factor)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;
        using var result = ApplyContrast(bitmap, factor);
        return EncodeToPng(result);
    }

    /// <summary>
    /// Rotate image by the specified degrees (clockwise).
    /// </summary>
    public byte[] Rotate(byte[] imageData, float degrees)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;
        using var result = ApplyRotation(bitmap, degrees);
        return EncodeToPng(result);
    }

    /// <summary>
    /// Apply black-and-white threshold for document scanning look.
    /// Threshold: 0-255, default 128.
    /// </summary>
    public byte[] ApplyThreshold(byte[] imageData, byte threshold = 128)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;
        using var result = Binarize(bitmap, threshold);
        return EncodeToPng(result);
    }

    /// <summary>
    /// Crop the image to the specified rectangle (in pixel coordinates).
    /// </summary>
    public byte[] Crop(byte[] imageData, int x, int y, int width, int height)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;

        // Clamp values
        x = Math.Max(0, Math.Min(x, bitmap.Width - 1));
        y = Math.Max(0, Math.Min(y, bitmap.Height - 1));
        width = Math.Min(width, bitmap.Width - x);
        height = Math.Min(height, bitmap.Height - y);

        var rect = new SKRectI(x, y, x + width, y + height);
        using var cropped = new SKBitmap(width, height);
        using var canvas = new SKCanvas(cropped);
        canvas.DrawBitmap(bitmap, rect, new SKRect(0, 0, width, height));
        return EncodeToPng(cropped);
    }

    /// <summary>
    /// Auto-crop: detect and trim uniform-color borders (e.g., black scanner borders).
    /// </summary>
    public byte[] AutoCrop(byte[] imageData, byte tolerance = 30)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;

        int w = bitmap.Width, h = bitmap.Height;
        var pixels = bitmap.Pixels;

        // Detect edges by scanning for non-background pixels
        var bgColor = pixels[0]; // top-left as reference
        int top = 0, bottom = h - 1, left = 0, right = w - 1;

        // Scan top
        for (int row = 0; row < h; row++)
        {
            bool hasContent = false;
            for (int col = 0; col < w; col++)
            {
                if (!IsColorSimilar(pixels[row * w + col], bgColor, tolerance))
                { hasContent = true; break; }
            }
            if (hasContent) { top = row; break; }
        }

        // Scan bottom
        for (int row = h - 1; row >= top; row--)
        {
            bool hasContent = false;
            for (int col = 0; col < w; col++)
            {
                if (!IsColorSimilar(pixels[row * w + col], bgColor, tolerance))
                { hasContent = true; break; }
            }
            if (hasContent) { bottom = row; break; }
        }

        // Scan left
        for (int col = 0; col < w; col++)
        {
            bool hasContent = false;
            for (int row = top; row <= bottom; row++)
            {
                if (!IsColorSimilar(pixels[row * w + col], bgColor, tolerance))
                { hasContent = true; break; }
            }
            if (hasContent) { left = col; break; }
        }

        // Scan right
        for (int col = w - 1; col >= left; col--)
        {
            bool hasContent = false;
            for (int row = top; row <= bottom; row++)
            {
                if (!IsColorSimilar(pixels[row * w + col], bgColor, tolerance))
                { hasContent = true; break; }
            }
            if (hasContent) { right = col; break; }
        }

        // Add margin
        int margin = 10;
        top = Math.Max(0, top - margin);
        left = Math.Max(0, left - margin);
        bottom = Math.Min(h - 1, bottom + margin);
        right = Math.Min(w - 1, right + margin);

        int cropW = right - left + 1;
        int cropH = bottom - top + 1;

        if (cropW < 50 || cropH < 50) return imageData; // Nothing to crop

        return Crop(imageData, left, top, cropW, cropH);
    }

    /// <summary>
    /// Get image dimensions from raw bytes.
    /// </summary>
    public (int Width, int Height) GetDimensions(byte[] imageData)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        return bitmap == null ? (0, 0) : (bitmap.Width, bitmap.Height);
    }

    /// <summary>
    /// Resize image to a maximum dimension while maintaining aspect ratio.
    /// Useful for reducing upload size.
    /// </summary>
    public byte[] ResizeToMax(byte[] imageData, int maxDimension = 2048)
    {
        using var bitmap = SKBitmap.Decode(imageData);
        if (bitmap == null) return imageData;

        int w = bitmap.Width, h = bitmap.Height;
        if (w <= maxDimension && h <= maxDimension) return imageData;

        float scale = Math.Min((float)maxDimension / w, (float)maxDimension / h);
        int newW = (int)(w * scale);
        int newH = (int)(h * scale);

        using var resized = bitmap.Resize(new SKImageInfo(newW, newH), SKSamplingOptions.Default);
        return resized == null ? imageData : EncodeToPng(resized);
    }

    #region Private Helpers

    private static SKBitmap ApplyGrayscale(SKBitmap source)
    {
        var result = new SKBitmap(source.Width, source.Height);
        using var canvas = new SKCanvas(result);
        using var paint = new SKPaint();

        // Standard luminance grayscale matrix
        var colorMatrix = new float[]
        {
            0.2126f, 0.7152f, 0.0722f, 0, 0,
            0.2126f, 0.7152f, 0.0722f, 0, 0,
            0.2126f, 0.7152f, 0.0722f, 0, 0,
            0,       0,       0,       1, 0
        };
        paint.ColorFilter = SKColorFilter.CreateColorMatrix(colorMatrix);
        canvas.DrawBitmap(source, 0, 0, paint);
        return result;
    }

    private static SKBitmap ApplyContrast(SKBitmap source, float factor)
    {
        var result = new SKBitmap(source.Width, source.Height);
        using var canvas = new SKCanvas(result);
        using var paint = new SKPaint();

        float t = (1.0f - factor) / 2.0f * 255f;
        var colorMatrix = new float[]
        {
            factor, 0,      0,      0, t,
            0,      factor, 0,      0, t,
            0,      0,      factor, 0, t,
            0,      0,      0,      1, 0
        };
        paint.ColorFilter = SKColorFilter.CreateColorMatrix(colorMatrix);
        canvas.DrawBitmap(source, 0, 0, paint);
        return result;
    }

    private static SKBitmap ApplyBrightness(SKBitmap source, float amount)
    {
        var result = new SKBitmap(source.Width, source.Height);
        using var canvas = new SKCanvas(result);
        using var paint = new SKPaint();

        var colorMatrix = new float[]
        {
            1, 0, 0, 0, amount,
            0, 1, 0, 0, amount,
            0, 0, 1, 0, amount,
            0, 0, 0, 1, 0
        };
        paint.ColorFilter = SKColorFilter.CreateColorMatrix(colorMatrix);
        canvas.DrawBitmap(source, 0, 0, paint);
        return result;
    }

    private static SKBitmap NormalizeBrightness(SKBitmap source)
    {
        // Find min/max brightness to stretch histogram
        var pixels = source.Pixels;
        byte minB = 255, maxB = 0;

        for (int i = 0; i < pixels.Length; i++)
        {
            byte gray = pixels[i].Red; // Assuming grayscale
            if (gray < minB) minB = gray;
            if (gray > maxB) maxB = gray;
        }

        if (maxB - minB < 30) return source.Copy(); // Already normalized

        float scale = 255f / (maxB - minB);
        float offset = -minB * scale;

        var result = new SKBitmap(source.Width, source.Height);
        using var canvas = new SKCanvas(result);
        using var paint = new SKPaint();

        var colorMatrix = new float[]
        {
            scale, 0,     0,     0, offset,
            0,     scale, 0,     0, offset,
            0,     0,     scale, 0, offset,
            0,     0,     0,     1, 0
        };
        paint.ColorFilter = SKColorFilter.CreateColorMatrix(colorMatrix);
        canvas.DrawBitmap(source, 0, 0, paint);
        return result;
    }

    private static SKBitmap ApplySharpen(SKBitmap source)
    {
        // Apply unsharp-mask-style sharpening using a 3x3 kernel
        var result = new SKBitmap(source.Width, source.Height);
        int w = source.Width, h = source.Height;
        var srcPixels = source.Pixels;
        var dstPixels = new SKColor[w * h];

        // Sharpen kernel: center=5, neighbors=-1
        for (int y = 1; y < h - 1; y++)
        {
            for (int x = 1; x < w - 1; x++)
            {
                int idx = y * w + x;
                int r = 5 * srcPixels[idx].Red
                    - srcPixels[(y - 1) * w + x].Red
                    - srcPixels[(y + 1) * w + x].Red
                    - srcPixels[y * w + (x - 1)].Red
                    - srcPixels[y * w + (x + 1)].Red;

                byte val = (byte)Math.Clamp(r, 0, 255);
                dstPixels[idx] = new SKColor(val, val, val);
            }
        }

        // Copy edges
        for (int x = 0; x < w; x++)
        {
            dstPixels[x] = srcPixels[x];
            dstPixels[(h - 1) * w + x] = srcPixels[(h - 1) * w + x];
        }
        for (int y = 0; y < h; y++)
        {
            dstPixels[y * w] = srcPixels[y * w];
            dstPixels[y * w + (w - 1)] = srcPixels[y * w + (w - 1)];
        }

        result.Pixels = dstPixels;
        return result;
    }

    private static SKBitmap ApplyRotation(SKBitmap source, float degrees)
    {
        float radians = (float)(degrees * Math.PI / 180.0);
        float cos = Math.Abs((float)Math.Cos(radians));
        float sin = Math.Abs((float)Math.Sin(radians));

        int newW = (int)(source.Width * cos + source.Height * sin);
        int newH = (int)(source.Width * sin + source.Height * cos);

        var result = new SKBitmap(newW, newH);
        using var canvas = new SKCanvas(result);
        canvas.Clear(SKColors.White);
        canvas.Translate(newW / 2f, newH / 2f);
        canvas.RotateDegrees(degrees);
        canvas.Translate(-source.Width / 2f, -source.Height / 2f);
        canvas.DrawBitmap(source, 0, 0);
        return result;
    }

    private static SKBitmap Binarize(SKBitmap source, byte threshold)
    {
        var result = new SKBitmap(source.Width, source.Height);
        var pixels = source.Pixels;
        var output = new SKColor[pixels.Length];

        for (int i = 0; i < pixels.Length; i++)
        {
            byte gray = (byte)(0.2126 * pixels[i].Red + 0.7152 * pixels[i].Green + 0.0722 * pixels[i].Blue);
            byte val = gray >= threshold ? (byte)255 : (byte)0;
            output[i] = new SKColor(val, val, val);
        }

        result.Pixels = output;
        return result;
    }

    private static bool IsColorSimilar(SKColor a, SKColor b, byte tolerance)
    {
        return Math.Abs(a.Red - b.Red) <= tolerance
            && Math.Abs(a.Green - b.Green) <= tolerance
            && Math.Abs(a.Blue - b.Blue) <= tolerance;
    }

    private static byte[] EncodeToPng(SKBitmap bitmap)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 95);
        return data.ToArray();
    }

    #endregion
}
