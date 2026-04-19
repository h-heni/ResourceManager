using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ResourceManager.Models;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace ResourceManager.Services
{
    /// <summary>
    /// Service for scanning and extracting data from supplier PDF invoices and images
    /// Supports: PDF files (text-based and image-based), photos (JPG, PNG, BMP, TIFF, WebP)
    /// </summary>
    public interface ISupplierPdfScannerService
    {
        /// <summary>
        /// Scan a PDF and extract supplier invoice data
        /// </summary>
        Task<SupplierScanResult> ScanPdfAsync(Stream pdfStream, string fileName);
        
        /// <summary>
        /// Scan an image (photo / uploaded image) and extract invoice data via OCR
        /// </summary>
        Task<SupplierScanResult> ScanImageAsync(Stream imageStream, string fileName);

        /// <summary>
        /// Parse pre-extracted text (e.g. from on-device ML Kit OCR on the mobile client)
        /// and run the standard field-extraction pipeline. Skips Tesseract entirely.
        /// </summary>
        Task<SupplierScanResult> ScanRawTextAsync(string extractedText, string fileName);

        /// <summary>
        /// Save the scanned/corrected data to database
        /// </summary>
        Task<Supplier?> SaveScannedDataAsync(int companyId, SupplierScanResult scanResult, SupplierScanCorrections? corrections = null);
    }

    public class SupplierPdfScannerService : ISupplierPdfScannerService
    {
        private readonly ILogger<SupplierPdfScannerService> _logger;
        private readonly string _tessDataPath;

        public SupplierPdfScannerService(ILogger<SupplierPdfScannerService> logger)
        {
            _logger = logger;
            _tessDataPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "tessdata");
        }

        public async Task<SupplierScanResult> ScanImageAsync(Stream imageStream, string fileName)
        {
            var result = new SupplierScanResult
            {
                FileName = fileName,
                ScannedAt = DateTime.UtcNow
            };

            try
            {
                using var memoryStream = new MemoryStream();
                await imageStream.CopyToAsync(memoryStream);
                var imageBytes = memoryStream.ToArray();
                result.PdfBytes = imageBytes; // store original file bytes

                string extractedText = ExtractTextFromImageOCR(imageBytes);
                result.RawExtractedText = extractedText;

                if (string.IsNullOrWhiteSpace(extractedText))
                {
                    result.Success = false;
                    result.Warnings.Add("Could not extract text from image. The image may be too blurry or low resolution.");
                    return result;
                }

                _logger.LogInformation("OCR extracted {Length} characters from image: {FileName}", extractedText.Length, fileName);

                ParseExtractedText(extractedText, result);

                result.Success = true;
                result.RequiresReview = result.Warnings.Any() || result.ConfidenceScore < 0.7;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning image: {FileName}", fileName);
                result.Success = false;
                result.Errors.Add($"Failed to scan image: {ex.Message}");
            }

            return result;
        }

        public Task<SupplierScanResult> ScanRawTextAsync(string extractedText, string fileName)
        {
            var result = new SupplierScanResult
            {
                FileName = fileName,
                ScannedAt = DateTime.UtcNow,
                RawExtractedText = extractedText ?? string.Empty
            };

            try
            {
                if (string.IsNullOrWhiteSpace(extractedText))
                {
                    result.Success = false;
                    result.Warnings.Add("No text was provided by the on-device OCR. Please retake the photo with better lighting.");
                    return Task.FromResult(result);
                }

                _logger.LogInformation("ML Kit pre-extracted {Length} characters for: {FileName}", extractedText.Length, fileName);

                ParseExtractedText(extractedText, result);

                result.Success = true;
                result.RequiresReview = result.Warnings.Any() || result.ConfidenceScore < 0.7;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing pre-extracted text: {FileName}", fileName);
                result.Success = false;
                result.Errors.Add($"Failed to parse extracted text: {ex.Message}");
            }

            return Task.FromResult(result);
        }

        /// <summary>
        /// Extract text from an image using Tesseract OCR
        /// </summary>
        private string ExtractTextFromImageOCR(byte[] imageBytes)
        {
            try
            {
                if (!Directory.Exists(_tessDataPath) || 
                    !File.Exists(Path.Combine(_tessDataPath, "eng.traineddata")))
                {
                    _logger.LogWarning("Tesseract training data not found at {Path}. OCR will not work.", _tessDataPath);
                    return string.Empty;
                }

                using var engine = new Tesseract.TesseractEngine(_tessDataPath, "eng+fra", Tesseract.EngineMode.Default);
                using var img = Tesseract.Pix.LoadFromMemory(imageBytes);
                using var page = engine.Process(img);

                var text = page.GetText();
                var confidence = page.GetMeanConfidence();

                _logger.LogInformation("Tesseract OCR: {Length} chars extracted, mean confidence: {Confidence:P0}", 
                    text?.Length ?? 0, confidence);

                return text ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tesseract OCR extraction failed");
                return string.Empty;
            }
        }

        public async Task<SupplierScanResult> ScanPdfAsync(Stream pdfStream, string fileName)
        {
            var result = new SupplierScanResult
            {
                FileName = fileName,
                ScannedAt = DateTime.UtcNow
            };

            try
            {
                // Read PDF bytes
                using var memoryStream = new MemoryStream();
                await pdfStream.CopyToAsync(memoryStream);
                var pdfBytes = memoryStream.ToArray();
                result.PdfBytes = pdfBytes;

                // Extract text from PDF
                string extractedText = ExtractTextFromPdf(pdfBytes);
                result.RawExtractedText = extractedText;

                if (string.IsNullOrWhiteSpace(extractedText))
                {
                    // Try OCR as fallback for image-based PDFs
                    _logger.LogInformation("No text extracted from PDF, attempting OCR fallback for image-based PDF: {FileName}", fileName);
                    extractedText = ExtractTextFromPdfViaOCR(pdfBytes);
                    
                    if (string.IsNullOrWhiteSpace(extractedText))
                    {
                        result.Success = false;
                        result.Warnings.Add("Could not extract text from PDF. The file may be image-based or encrypted. Try uploading as an image instead.");
                        return result;
                    }
                    result.Warnings.Add("Text was extracted via OCR (image-based PDF). Please verify accuracy.");
                }

                _logger.LogInformation("Extracted {Length} characters from PDF: {FileName}", extractedText.Length, fileName);

                // Parse the text to extract data
                ParseExtractedText(extractedText, result);

                result.Success = true;
                result.RequiresReview = result.Warnings.Any() || result.ConfidenceScore < 0.7;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning PDF: {FileName}", fileName);
                result.Success = false;
                result.Errors.Add($"Failed to scan PDF: {ex.Message}");
            }

            return result;
        }

        /// <summary>
        /// Extract text from PDF using PdfPig - reliable text extraction
        /// </summary>
        private string ExtractTextFromPdf(byte[] pdfBytes)
        {
            var text = new StringBuilder();
            
            try
            {
                using var document = PdfDocument.Open(pdfBytes);
                foreach (var page in document.GetPages())
                {
                    text.AppendLine(page.Text);
                }
                
                _logger.LogInformation("PdfPig extracted {Length} characters from {PageCount} pages",
                    text.Length, document.NumberOfPages);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PdfPig extraction failed, falling back to basic extraction");
                return ExtractTextFromPdfFallback(pdfBytes);
            }

            var result = text.ToString().Trim();
            
            // If PdfPig yielded too little, try fallback
            if (result.Length < 50)
            {
                _logger.LogInformation("PdfPig extracted very little text ({Len} chars), trying fallback", result.Length);
                var fallback = ExtractTextFromPdfFallback(pdfBytes);
                if (fallback.Length > result.Length)
                    return fallback;
            }
            
            return result;
        }

        /// <summary>
        /// Fallback text extraction for PDFs that PdfPig can't handle
        /// </summary>
        private string ExtractTextFromPdfFallback(byte[] pdfBytes)
        {
            var text = new StringBuilder();
            
            try
            {
                // Basic PDF text extraction using stream parsing
                // This handles simple text-based PDFs
                string pdfContent = Encoding.UTF8.GetString(pdfBytes);
                
                // Look for text streams in PDF
                var streamRegex = new Regex(@"stream\s*(.*?)\s*endstream", RegexOptions.Singleline);
                var matches = streamRegex.Matches(pdfContent);
                
                foreach (Match match in matches)
                {
                    var streamContent = match.Groups[1].Value;
                    
                    // Extract text from BT...ET blocks (text objects)
                    var textBlockRegex = new Regex(@"BT\s*(.*?)\s*ET", RegexOptions.Singleline);
                    var textMatches = textBlockRegex.Matches(streamContent);
                    
                    foreach (Match textMatch in textMatches)
                    {
                        var textContent = textMatch.Groups[1].Value;
                        
                        // Extract strings from Tj, TJ, ' operators
                        var stringRegex = new Regex(@"\(([^)]*)\)\s*(?:Tj|TJ|')", RegexOptions.Singleline);
                        var stringMatches = stringRegex.Matches(textContent);
                        
                        foreach (Match stringMatch in stringMatches)
                        {
                            var str = stringMatch.Groups[1].Value;
                            str = DecodePdfString(str);
                            if (!string.IsNullOrWhiteSpace(str))
                            {
                                text.Append(str);
                                text.Append(" ");
                            }
                        }
                    }
                }

                // Also try extracting from hex strings
                var hexStringRegex = new Regex(@"<([0-9A-Fa-f\s]+)>", RegexOptions.Singleline);
                var hexMatches = hexStringRegex.Matches(pdfContent);
                
                foreach (Match hexMatch in hexMatches)
                {
                    try
                    {
                        var hexString = hexMatch.Groups[1].Value.Replace(" ", "").Replace("\n", "").Replace("\r", "");
                        if (hexString.Length % 2 == 0 && hexString.Length > 4)
                        {
                            var bytes = new byte[hexString.Length / 2];
                            for (int i = 0; i < bytes.Length; i++)
                            {
                                bytes[i] = Convert.ToByte(hexString.Substring(i * 2, 2), 16);
                            }
                            var decoded = Encoding.UTF8.GetString(bytes);
                            if (decoded.All(c => char.IsLetterOrDigit(c) || char.IsPunctuation(c) || char.IsWhiteSpace(c)))
                            {
                                text.Append(decoded);
                                text.Append(" ");
                            }
                        }
                    }
                    catch { /* Ignore invalid hex strings */ }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Basic PDF text extraction failed, trying alternative method");
            }

            // If basic extraction failed, try looking for plain text patterns
            if (text.Length < 50)
            {
                text.Clear();
                string rawContent = Encoding.Latin1.GetString(pdfBytes);
                
                // Look for common invoice patterns in raw content
                var datePattern = new Regex(@"\d{2}[/.-]\d{2}[/.-]\d{4}");
                var amountPattern = new Regex(@"\d+[,.\s]\d{2}\s*(?:€|EUR|MAD|DH|TTC|HT)", RegexOptions.IgnoreCase);
                var emailPattern = new Regex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}");
                var phonePattern = new Regex(@"(?:\+\d{1,3}[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}");
                
                foreach (Match m in datePattern.Matches(rawContent)) text.AppendLine("Date: " + m.Value);
                foreach (Match m in amountPattern.Matches(rawContent)) text.AppendLine("Amount: " + m.Value);
                foreach (Match m in emailPattern.Matches(rawContent)) text.AppendLine("Email: " + m.Value);
                foreach (Match m in phonePattern.Matches(rawContent)) text.AppendLine("Phone: " + m.Value);
                
                // Extract readable ASCII text
                var readableText = new StringBuilder();
                bool inWord = false;
                int wordStart = 0;
                
                for (int i = 0; i < rawContent.Length; i++)
                {
                    char c = rawContent[i];
                    bool isReadable = (c >= 32 && c <= 126) || c == '\n' || c == '\r' || c == '\t';
                    
                    if (isReadable && !inWord)
                    {
                        inWord = true;
                        wordStart = i;
                    }
                    else if (!isReadable && inWord)
                    {
                        inWord = false;
                        var word = rawContent.Substring(wordStart, i - wordStart).Trim();
                        if (word.Length >= 3)
                        {
                            readableText.Append(word);
                            readableText.Append(" ");
                        }
                    }
                }
                
                text.AppendLine(readableText.ToString());
            }

            return text.ToString().Trim();
        }

        private string DecodePdfString(string str)
        {
            // Handle PDF escape sequences
            str = str.Replace("\\n", "\n")
                     .Replace("\\r", "\r")
                     .Replace("\\t", "\t")
                     .Replace("\\(", "(")
                     .Replace("\\)", ")")
                     .Replace("\\\\", "\\");
            
            // Handle octal escapes
            var octalRegex = new Regex(@"\\(\d{3})");
            str = octalRegex.Replace(str, m => 
            {
                int octal = Convert.ToInt32(m.Groups[1].Value, 8);
                return ((char)octal).ToString();
            });
            
            return str;
        }

        /// <summary>
        /// Extract text from an image-based PDF by rendering pages and running OCR
        /// </summary>
        private string ExtractTextFromPdfViaOCR(byte[] pdfBytes)
        {
            try
            {
                if (!Directory.Exists(_tessDataPath) || 
                    !File.Exists(Path.Combine(_tessDataPath, "eng.traineddata")))
                {
                    _logger.LogWarning("Tesseract training data not found, cannot OCR image-based PDF");
                    return string.Empty;
                }

                // Extract images embedded in the PDF and run OCR on them
                var allText = new StringBuilder();
                using var document = PdfDocument.Open(pdfBytes);
                
                foreach (var page in document.GetPages())
                {
                    // Try to get images from the page
                    var images = page.GetImages();
                    foreach (var image in images)
                    {
                        try
                        {
                            var imageBytes = image.RawBytes.ToArray();
                            if (imageBytes.Length > 1000) // Skip tiny images (icons, etc.)
                            {
                                var ocrText = ExtractTextFromImageOCR(imageBytes);
                                if (!string.IsNullOrWhiteSpace(ocrText))
                                {
                                    allText.AppendLine(ocrText);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug(ex, "Failed to OCR an embedded PDF image");
                        }
                    }
                }

                return allText.ToString().Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to extract text from PDF via OCR");
                return string.Empty;
            }
        }

        private void ParseExtractedText(string text, SupplierScanResult result)
        {
            int matchedFields = 0;
            int totalFields = 8;

            // Normalize text
            text = text.Replace("\r\n", "\n").Replace("\r", "\n");
            var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                           .Select(l => l.Trim())
                           .Where(l => l.Length > 0)
                           .ToArray();

            // ═══════════════════════════════════════════════════════════════
            // INVOICE NUMBER
            // ═══════════════════════════════════════════════════════════════
            var invoiceNumPatterns = new[]
            {
                // Explicit labels (multilingual)
                new Regex(@"(?:Facture|Invoice|Rechnung|فاتورة)\s*(?:N°|No\.?|Nr\.?|Num[eé]ro|#)[:\s]*([A-Z0-9][\w/-]{2,})", RegexOptions.IgnoreCase),
                new Regex(@"(?:N°|No\.?)\s*(?:de\s*)?(?:Facture|Invoice|Rechnung)[:\s]*([A-Z0-9][\w/-]{2,})", RegexOptions.IgnoreCase),
                // Prefixed codes
                new Regex(@"(?:FAC|FACT|INV|FA|BL|BC|FC)[:\s-]*(\d{2,}[A-Z0-9/-]*)", RegexOptions.IgnoreCase),
                // Reference / Ref
                new Regex(@"(?:R[eé]f[eé]?rence|Ref)[:\s#]*([A-Z0-9][\w/-]{3,})", RegexOptions.IgnoreCase),
                // Standalone code on a line
                new Regex(@"^([A-Z]{2,4}[-/]\d{2,}[-/\d]*)$", RegexOptions.Multiline)
            };

            foreach (var pattern in invoiceNumPatterns)
            {
                var match = pattern.Match(text);
                if (match.Success && match.Groups[1].Value.Length >= 3)
                {
                    result.ExtractedData.InvoiceNumber = match.Groups[1].Value.Trim();
                    matchedFields++;
                    break;
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // DATE
            // ═══════════════════════════════════════════════════════════════
            var datePatterns = new[]
            {
                new Regex(@"(?:Date\s*(?:de\s*)?(?:facturation|facture|emission|émission)?|Invoice\s*Date|Rechnungsdatum|Datum)[:\s]*(\d{2}[/.-]\d{2}[/.-]\d{4})", RegexOptions.IgnoreCase),
                new Regex(@"(?:Date\s*(?:de\s*)?(?:facturation|facture|emission|émission)?|Invoice\s*Date|Date\s*facture)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})", RegexOptions.IgnoreCase),
                new Regex(@"(\d{2}[/.-]\d{2}[/.-]\d{4})"),
                new Regex(@"(\d{4}[/.-]\d{2}[/.-]\d{2})"),
                new Regex(@"(\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4})", RegexOptions.IgnoreCase),
                new Regex(@"(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})", RegexOptions.IgnoreCase),
                new Regex(@"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})", RegexOptions.IgnoreCase),
                new Regex(@"(\d{1,2}[/.-]\d{1,2}[/.-]\d{2})") // Short year: 01/01/25
            };

            foreach (var pattern in datePatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    var dateStr = match.Groups[1].Value;
                    if (TryParseDate(dateStr, out var parsedDate))
                    {
                        result.ExtractedData.InvoiceDate = parsedDate;
                        matchedFields++;
                        break;
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // DUE DATE / PAYMENT DATE
            // ═══════════════════════════════════════════════════════════════
            var dueDatePatterns = new[]
            {
                new Regex(@"(?:Date\s*(?:d[''])?[eé]ch[eé]ance|Date\s*de\s*paiement|Due\s*Date|Payment\s*Date|Fälligkeitsdatum|Zahlungsziel|Payable\s*(?:avant|before)|Net\s*\d+)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})", RegexOptions.IgnoreCase),
                new Regex(@"(?:[EÉeé]ch[eé]ance)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})", RegexOptions.IgnoreCase),
                new Regex(@"(?:[EÉeé]ch[eé]ance|Due\s*Date)[:\s]*(\d{1,2}\s+\w+\s+\d{4})", RegexOptions.IgnoreCase)
            };

            foreach (var pattern in dueDatePatterns)
            {
                var match = pattern.Match(text);
                if (match.Success && TryParseDate(match.Groups[1].Value, out var dueDate))
                {
                    result.ExtractedData.DueDate = dueDate;
                    break;
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // SUPPLIER NAME (Usually at top of invoice)
            // ═══════════════════════════════════════════════════════════════
            var namePatterns = new[]
            {
                new Regex(@"(?:Fournisseur|Supplier|De|From|Emetteur|Émetteur)[:\s]*([A-ZÀ-ÿ][A-ZÀ-ÿa-zà-ÿ\s&.,-]+(?:SARL|SA|SAS|SASU|EURL|SNC|LLC|Ltd|Inc|GmbH|AG|S\.?L\.?)?)", RegexOptions.IgnoreCase),
                // Company suffix at end of line
                new Regex(@"^([A-ZÀ-ÿ][A-ZÀ-ÿa-zà-ÿ\s&.,-]{2,50}\s+(?:SARL|SA|SAS|SASU|EURL|SNC|LLC|Ltd|Inc|GmbH|AG|S\.?L\.?))$", RegexOptions.Multiline),
                // All caps company name (common in invoices)
                new Regex(@"^([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s&.,-]{3,40})$", RegexOptions.Multiline)
            };

            foreach (var pattern in namePatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    var name = match.Groups[1].Value.Trim();
                    if (name.Length >= 2 && !IsCommonWord(name))
                    {
                        result.ExtractedData.SupplierName = name;
                        matchedFields++;
                        break;
                    }
                }
            }

            // If no name found, try first significant line (likely company header)
            if (string.IsNullOrEmpty(result.ExtractedData.SupplierName) && lines.Length > 0)
            {
                for (int i = 0; i < Math.Min(5, lines.Length); i++)
                {
                    var line = lines[i].Trim();
                    if (line.Length >= 3 && line.Length <= 60 && !line.Contains("@") && 
                        !Regex.IsMatch(line, @"(?:Facture|Invoice|Rechnung|Date|Total|N°)", RegexOptions.IgnoreCase) &&
                        char.IsLetter(line[0]))
                    {
                        result.ExtractedData.SupplierName = line;
                        result.Warnings.Add("Supplier name may need verification (auto-detected from first line)");
                        matchedFields++;
                        break;
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // TAX ID (ICE, IF, NIF, RC, MF, SIRET, etc.)
            // ═══════════════════════════════════════════════════════════════
            var taxIdPatterns = new[]
            {
                // Morocco: ICE
                new Regex(@"(?:ICE)[:\s]*(\d{15})", RegexOptions.IgnoreCase),
                // Morocco: IF (Identifiant Fiscal)
                new Regex(@"(?:I\.?F\.?|Identifiant\s*Fiscal)[:\s]*(\d{7,8})", RegexOptions.IgnoreCase),
                // Tunisia: MF (Matricule Fiscal)
                new Regex(@"(?:M\.?F\.?|Matricule\s*Fiscal)[:\s]*([\d]{7}[/]?[A-Z]{1,3}[/]?[A-Z]{1}[/]?\d{3})", RegexOptions.IgnoreCase),
                // France: SIRET
                new Regex(@"(?:SIRET)[:\s]*(\d{14})", RegexOptions.IgnoreCase),
                // France: SIREN
                new Regex(@"(?:SIREN)[:\s]*(\d{9})", RegexOptions.IgnoreCase),
                // EU VAT ID
                new Regex(@"(?:TVA\s*(?:Intra(?:communautaire)?)?|VAT\s*(?:ID|Number)?|USt-IdNr)[:\s.]*([A-Z]{2}\s*\d[\d\s]{6,})", RegexOptions.IgnoreCase),
                // Generic NIF
                new Regex(@"(?:NIF|N\.?I\.?F\.?|Tax\s*ID|Steuer-?Nr)[:\s]*([A-Z0-9][\d\s/-]{5,})", RegexOptions.IgnoreCase),
                // RC (Registre de Commerce)
                new Regex(@"(?:R\.?C\.?|Registre\s*(?:de\s*)?Commerce)[:\s]*([A-Z0-9][\w\s/-]{3,})", RegexOptions.IgnoreCase)
            };

            foreach (var pattern in taxIdPatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    result.ExtractedData.TaxId = match.Groups[1].Value.Trim();
                    break;
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // CURRENCY
            // ═══════════════════════════════════════════════════════════════
            var currencyPatterns = new[]
            {
                new Regex(@"(?:Devise|Currency|Währung)[:\s]*([A-Z]{3})", RegexOptions.IgnoreCase),
                new Regex(@"\b(EUR|USD|GBP|MAD|TND|DZD|CHF|CAD)\b"),
                new Regex(@"(€|£|\$|DH|DT)(?:\s|$)")
            };

            foreach (var pattern in currencyPatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    var cur = match.Groups[1].Value.Trim();
                    result.ExtractedData.Currency = cur switch
                    {
                        "€" => "EUR",
                        "£" => "GBP",
                        "$" => "USD",
                        "DH" => "MAD",
                        "DT" => "TND",
                        _ => cur
                    };
                    break;
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // EMAIL
            // ═══════════════════════════════════════════════════════════════
            var emailPattern = new Regex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}");
            var emailMatch = emailPattern.Match(text);
            if (emailMatch.Success)
            {
                result.ExtractedData.Email = emailMatch.Value;
                matchedFields++;
            }

            // ═══════════════════════════════════════════════════════════════
            // PHONE
            // ═══════════════════════════════════════════════════════════════
            var phonePatterns = new[]
            {
                new Regex(@"(?:Tél|Tel|Phone|Téléphone|Telefon|Fax)[:\s.]*([\d\s.+-]+)", RegexOptions.IgnoreCase),
                new Regex(@"(\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4})"),
                new Regex(@"(?:^|\s)(0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})")
            };

            foreach (var pattern in phonePatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    var phone = match.Groups[1].Value.Trim();
                    phone = Regex.Replace(phone, @"[\s.-]", "");
                    if (phone.Length >= 8 && phone.Length <= 15)
                    {
                        result.ExtractedData.Phone = phone;
                        matchedFields++;
                        break;
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // ADDRESS
            // ═══════════════════════════════════════════════════════════════
            var addressPatterns = new[]
            {
                new Regex(@"(?:Adresse|Address|Anschrift)[:\s]*(.+?)(?:\n|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline),
                new Regex(@"(\d+[\s,]*(?:rue|avenue|boulevard|place|chemin|route|bd|av|str|straße|strasse)\s+[A-Za-zÀ-ÿ\s]+)", RegexOptions.IgnoreCase),
                new Regex(@"(\d{4,5}\s+[A-Za-zÀ-ÿ\s-]+)") // Postal code + city
            };

            var addressParts = new List<string>();
            foreach (var pattern in addressPatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    addressParts.Add(match.Groups[1].Value.Trim());
                }
            }

            if (addressParts.Any())
            {
                result.ExtractedData.Address = string.Join(", ", addressParts.Distinct());
                matchedFields++;
            }

            // ═══════════════════════════════════════════════════════════════
            // AMOUNTS (TTC, HT, TVA)
            // ═══════════════════════════════════════════════════════════════
            var amountPatterns = new Dictionary<string, Regex[]>
            {
                ["TotalTTC"] = new[]
                {
                    new Regex(@"(?:Total\s*TTC|Montant\s*TTC|Net\s*[àa]\s*payer|Total\s*à\s*payer|Total\s*Amount|Gesamtbetrag)[:\s]*([\d\s,.'']+)\s*(?:€|EUR|MAD|DH|DT|TND)?", RegexOptions.IgnoreCase),
                    new Regex(@"([\d\s,.'']+)\s*(?:€|EUR|MAD|DH|DT|TND)\s*(?:TTC)", RegexOptions.IgnoreCase),
                    new Regex(@"(?:Net\s*[àa]\s*payer|Total\s*TTC)\s*[:=]?\s*([\d\s,.'']+)", RegexOptions.IgnoreCase)
                },
                ["TotalHT"] = new[]
                {
                    new Regex(@"(?:Total\s*HT|Montant\s*HT|Sous[- ]?total|Subtotal|Nettobetrag)[:\s]*([\d\s,.'']+)\s*(?:€|EUR|MAD|DH|DT|TND)?", RegexOptions.IgnoreCase),
                    new Regex(@"([\d\s,.'']+)\s*(?:€|EUR|MAD|DH|DT|TND)\s*(?:HT)", RegexOptions.IgnoreCase)
                },
                ["TVA"] = new[]
                {
                    new Regex(@"(?:TVA|VAT|T\.V\.A\.|MwSt)[:\s]*([\d\s,.'']+)\s*(?:€|EUR|MAD|DH|DT|TND)?", RegexOptions.IgnoreCase),
                    new Regex(@"(?:TVA|VAT|MwSt)\s*(?:\d+\s*%)?[:\s]*([\d\s,.'']+)", RegexOptions.IgnoreCase),
                    new Regex(@"(?:Montant\s*TVA|Tax\s*Amount)[:\s]*([\d\s,.'']+)", RegexOptions.IgnoreCase)
                }
            };

            foreach (var (fieldName, patterns) in amountPatterns)
            {
                foreach (var pattern in patterns)
                {
                    var match = pattern.Match(text);
                    if (match.Success)
                    {
                        var amountStr = match.Groups[1].Value.Trim();
                        if (TryParseAmount(amountStr, out var amount))
                        {
                            switch (fieldName)
                            {
                                case "TotalTTC": result.ExtractedData.TotalTTC = amount; matchedFields++; break;
                                case "TotalHT": result.ExtractedData.TotalHT = amount; break;
                                case "TVA": result.ExtractedData.TVA = amount; break;
                            }
                            break;
                        }
                    }
                }
            }

            // Calculate confidence score
            result.ConfidenceScore = (double)matchedFields / totalFields;

            // ═══════════════════════════════════════════════════════════════
            // CROSS-VALIDATION: Verify TotalTTC = TotalHT + TVA
            // ═══════════════════════════════════════════════════════════════
            if (result.ExtractedData.TotalTTC.HasValue && result.ExtractedData.TotalHT.HasValue && result.ExtractedData.TVA.HasValue)
            {
                var computedTTC = result.ExtractedData.TotalHT.Value + result.ExtractedData.TVA.Value;
                var diff = Math.Abs(computedTTC - result.ExtractedData.TotalTTC.Value);
                if (diff > 0.01m && diff > result.ExtractedData.TotalTTC.Value * 0.02m)
                {
                    result.Warnings.Add($"Amount mismatch: HT ({result.ExtractedData.TotalHT:F2}) + TVA ({result.ExtractedData.TVA:F2}) = {computedTTC:F2}, but TTC = {result.ExtractedData.TotalTTC:F2}");
                    result.ConfidenceScore *= 0.8; // Lower confidence
                }
                else
                {
                    result.ConfidenceScore = Math.Min(1.0, result.ConfidenceScore * 1.1); // Boost confidence
                }
            }
            // If only TotalTTC and TotalHT, compute TVA
            else if (result.ExtractedData.TotalTTC.HasValue && result.ExtractedData.TotalHT.HasValue && !result.ExtractedData.TVA.HasValue)
            {
                result.ExtractedData.TVA = result.ExtractedData.TotalTTC.Value - result.ExtractedData.TotalHT.Value;
            }
            // If only TotalTTC and TVA, compute TotalHT
            else if (result.ExtractedData.TotalTTC.HasValue && !result.ExtractedData.TotalHT.HasValue && result.ExtractedData.TVA.HasValue)
            {
                result.ExtractedData.TotalHT = result.ExtractedData.TotalTTC.Value - result.ExtractedData.TVA.Value;
            }

            // ═══════════════════════════════════════════════════════════════
            // LINE ITEMS (table rows with description, qty, price, total)
            // ═══════════════════════════════════════════════════════════════
            ExtractLineItems(text, lines, result);

            // Add warnings for missing critical fields
            if (string.IsNullOrEmpty(result.ExtractedData.SupplierName))
                result.Warnings.Add("Could not extract supplier name");
            if (string.IsNullOrEmpty(result.ExtractedData.InvoiceNumber))
                result.Warnings.Add("Could not extract invoice number");
            if (!result.ExtractedData.InvoiceDate.HasValue)
                result.Warnings.Add("Could not extract invoice date");
            if (!result.ExtractedData.TotalTTC.HasValue)
                result.Warnings.Add("Could not extract total amount (TTC)");
        }

        private bool TryParseDate(string dateStr, out DateTime result)
        {
            result = default;
            dateStr = dateStr.Trim();
            
            // French month names
            var frenchMonths = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                {"janvier", "01"}, {"février", "02"}, {"fevrier", "02"}, {"mars", "03"}, {"avril", "04"},
                {"mai", "05"}, {"juin", "06"}, {"juillet", "07"}, {"août", "08"}, {"aout", "08"},
                {"septembre", "09"}, {"octobre", "10"}, {"novembre", "11"}, {"décembre", "12"}, {"decembre", "12"}
            };

            // English month names
            var englishMonths = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                {"january", "01"}, {"february", "02"}, {"march", "03"}, {"april", "04"},
                {"may", "05"}, {"june", "06"}, {"july", "07"}, {"august", "08"},
                {"september", "09"}, {"october", "10"}, {"november", "11"}, {"december", "12"},
                {"jan", "01"}, {"feb", "02"}, {"mar", "03"}, {"apr", "04"},
                {"jun", "06"}, {"jul", "07"}, {"aug", "08"}, {"sep", "09"},
                {"oct", "10"}, {"nov", "11"}, {"dec", "12"}
            };

            // German month names
            var germanMonths = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                {"januar", "01"}, {"februar", "02"}, {"märz", "03"}, {"maerz", "03"},
                {"juni", "06"}, {"juli", "07"}, {"oktober", "10"}, {"dezember", "12"}
            };

            var allMonths = frenchMonths
                .Concat(englishMonths)
                .Concat(germanMonths)
                .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase);

            foreach (var (name, num) in allMonths)
            {
                if (dateStr.Contains(name, StringComparison.OrdinalIgnoreCase))
                {
                    dateStr = Regex.Replace(dateStr, Regex.Escape(name), num, RegexOptions.IgnoreCase);
                    break;
                }
            }

            // Try various date formats
            var formats = new[]
            {
                "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy",
                "d/MM/yyyy", "d-MM-yyyy", "d.MM.yyyy",
                "yyyy/MM/dd", "yyyy-MM-dd", "yyyy.MM.dd",
                "d MM yyyy", "dd MM yyyy",
                "d/M/yyyy", "d-M-yyyy", "d.M.yyyy",
                "dd/MM/yy", "dd-MM-yy", "dd.MM.yy",
                "MM/dd/yyyy", "M/d/yyyy",
            };

            foreach (var format in formats)
            {
                if (DateTime.TryParseExact(dateStr.Trim(), format, CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
                    return true;
            }

            return DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out result);
        }

        private bool TryParseAmount(string amountStr, out decimal result)
        {
            result = 0;
            
            // Clean up the amount string
            amountStr = amountStr.Trim();
            amountStr = Regex.Replace(amountStr, @"[€$£DT\s]", "");
            amountStr = amountStr.Replace("'", "").Replace("\u00a0", ""); // non-breaking space
            
            if (string.IsNullOrWhiteSpace(amountStr)) return false;

            // Detect format: "1.234,56" (EU) vs "1,234.56" (US) vs "1 234,567" (Tunisia)
            var lastComma = amountStr.LastIndexOf(',');
            var lastDot = amountStr.LastIndexOf('.');

            if (lastComma > lastDot)
            {
                // Comma is the decimal separator (EU/Tunisia: 1.234,56 or 1234,567)
                amountStr = amountStr.Replace(".", "").Replace(",", ".");
            }
            else if (lastDot > lastComma)
            {
                // Dot is the decimal separator (US: 1,234.56)
                amountStr = amountStr.Replace(",", "");
            }
            else if (lastComma >= 0 && lastDot < 0)
            {
                // Only comma present - it's the decimal separator
                amountStr = amountStr.Replace(",", ".");
            }
            // If only dot present, leave as-is

            amountStr = amountStr.Replace(" ", "");

            return decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out result) && result > 0;
        }

        private bool IsCommonWord(string text)
        {
            var commonWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "facture", "invoice", "rechnung", "devis", "bon", "livraison", "date", "total", "montant",
                "client", "fournisseur", "adresse", "telephone", "email", "page", "objet", "sujet",
                "description", "référence", "reference", "numéro", "numero", "prix", "quantité", "quantite",
                "sous-total", "subtotal", "remise", "discount", "note", "notes", "conditions", "paiement",
                "payment", "net", "brut", "tva", "vat", "taxe", "tax", "devise", "currency"
            };
            return commonWords.Contains(text.Trim());
        }

        /// <summary>
        /// Extract line items from invoice text 
        /// Uses multiple strategies to handle different invoice layouts
        /// </summary>
        private void ExtractLineItems(string text, string[] lines, SupplierScanResult result)
        {
            try
            {
                // ── Strategy 1: Full format ─ Desc │ Qty │ Unit Price │ TVA% │ Total ──
                var fullPattern = new Regex(
                    @"^(.{3,80}?)\s{2,}(\d+(?:[.,]\d+)?)\s{2,}([\d\s,.'']+)\s{2,}(\d+(?:[.,]\d+)?)\s*%\s{2,}([\d\s,.'']+)\s*$",
                    RegexOptions.Multiline);
                foreach (Match match in fullPattern.Matches(text))
                {
                    var desc = match.Groups[1].Value.Trim();
                    if (IsTableHeader(desc)) continue;
                    if (TryParseDecimalQuantity(match.Groups[2].Value, out var qty) &&
                        TryParseAmount(match.Groups[3].Value, out var unitPrice) &&
                        TryParseAmount(match.Groups[5].Value, out var totalHT))
                    {
                        decimal taxRate = 0.19m;
                        var taxStr = match.Groups[4].Value.Replace(",", ".");
                        if (decimal.TryParse(taxStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var tr))
                            taxRate = tr > 1 ? tr / 100m : tr;

                        result.ExtractedData.LineItems.Add(new ExtractedLineItem
                        {
                            Description = CleanDescription(desc),
                            Quantity = (int)Math.Max(1, Math.Round(qty)),
                            UnitPrice = unitPrice,
                            TaxRate = taxRate,
                            TotalHT = totalHT
                        });
                    }
                }

                // ── Strategy 2: Standard ─ Desc │ Qty │ Unit Price │ Total ──
                if (result.ExtractedData.LineItems.Count == 0)
                {
                    var standardPattern = new Regex(
                        @"^(.{3,80}?)\s{2,}(\d+(?:[.,]\d+)?)\s{2,}([\d\s,.'']+)\s{2,}([\d\s,.'']+)\s*$",
                        RegexOptions.Multiline);
                    foreach (Match match in standardPattern.Matches(text))
                    {
                        var desc = match.Groups[1].Value.Trim();
                        if (IsTableHeader(desc)) continue;
                        if (TryParseDecimalQuantity(match.Groups[2].Value, out var qty) &&
                            TryParseAmount(match.Groups[3].Value, out var unitPrice) &&
                            TryParseAmount(match.Groups[4].Value, out var totalHT))
                        {
                            result.ExtractedData.LineItems.Add(new ExtractedLineItem
                            {
                                Description = CleanDescription(desc),
                                Quantity = (int)Math.Max(1, Math.Round(qty)),
                                UnitPrice = unitPrice,
                                TotalHT = totalHT
                            });
                        }
                    }
                }

                // ── Strategy 3: Loose ─ Desc │ Qty │ Amount (no separate UP) ──
                if (result.ExtractedData.LineItems.Count == 0)
                {
                    var simplePattern = new Regex(
                        @"^(.{5,80}?)\s{2,}(\d+(?:[.,]\d+)?)\s{2,}([\d\s,.'']+)\s*$",
                        RegexOptions.Multiline);
                    foreach (Match match in simplePattern.Matches(text))
                    {
                        var desc = match.Groups[1].Value.Trim();
                        if (IsTableHeader(desc)) continue;
                        if (TryParseDecimalQuantity(match.Groups[2].Value, out var qty) &&
                            TryParseAmount(match.Groups[3].Value, out var amount))
                        {
                            result.ExtractedData.LineItems.Add(new ExtractedLineItem
                            {
                                Description = CleanDescription(desc),
                                Quantity = (int)Math.Max(1, Math.Round(qty)),
                                UnitPrice = qty > 0 ? amount / (decimal)qty : amount,
                                TotalHT = amount
                            });
                        }
                    }
                }

                // ── Strategy 4: Separator-delimited (pipe |, semicolon ;, tab) ──
                if (result.ExtractedData.LineItems.Count == 0)
                {
                    var separatorLines = lines
                        .Where(l => l.Contains('|') || l.Contains('\t') || (l.Split(';').Length >= 3));
                    foreach (var line in separatorLines)
                    {
                        char sep = line.Contains('|') ? '|' : line.Contains('\t') ? '\t' : ';';
                        var parts = line.Split(sep).Select(p => p.Trim()).ToArray();
                        if (parts.Length < 3) continue;
                        if (IsTableHeader(parts[0])) continue;

                        // Try: desc | qty | price | total  OR  desc | qty | total
                        string desc = parts[0];
                        if (desc.Length < 2) continue;

                        if (parts.Length >= 4 &&
                            TryParseDecimalQuantity(parts[1], out var qty4) &&
                            TryParseAmount(parts[2], out var up4) &&
                            TryParseAmount(parts[parts.Length - 1], out var tot4))
                        {
                            decimal? taxRate4 = null;
                            if (parts.Length >= 5 && TryParseTaxPercentage(parts[3], out var tr4))
                                taxRate4 = tr4;

                            result.ExtractedData.LineItems.Add(new ExtractedLineItem
                            {
                                Description = CleanDescription(desc),
                                Quantity = (int)Math.Max(1, Math.Round(qty4)),
                                UnitPrice = up4,
                                TaxRate = taxRate4,
                                TotalHT = tot4
                            });
                        }
                        else if (parts.Length >= 3 &&
                            TryParseDecimalQuantity(parts[1], out var qty3) &&
                            TryParseAmount(parts[2], out var tot3))
                        {
                            result.ExtractedData.LineItems.Add(new ExtractedLineItem
                            {
                                Description = CleanDescription(desc),
                                Quantity = (int)Math.Max(1, Math.Round(qty3)),
                                UnitPrice = qty3 > 0 ? tot3 / (decimal)qty3 : tot3,
                                TotalHT = tot3
                            });
                        }
                    }
                }

                // ── Strategy 5: Find table-header row, then parse subsequent rows ──
                if (result.ExtractedData.LineItems.Count == 0)
                {
                    int headerIdx = -1;
                    for (int i = 0; i < lines.Length; i++)
                    {
                        if (IsTableHeader(lines[i]) && CountAmountLikeTokens(lines[i]) == 0)
                        {
                            headerIdx = i;
                            break;
                        }
                    }

                    if (headerIdx >= 0)
                    {
                        for (int i = headerIdx + 1; i < lines.Length; i++)
                        {
                            var ln = lines[i];
                            if (ln.Length < 5) continue;
                            // Stop at totals/subtotal line
                            if (Regex.IsMatch(ln, @"(?:Total|Sous-total|Subtotal|Net\s)", RegexOptions.IgnoreCase))
                                break;

                            // Extract trailing numbers
                            var numMatches = Regex.Matches(ln, @"([\d\s,.'']+(?:\.\d{2,3}|,\d{2,3}))");
                            if (numMatches.Count == 0) continue;

                            var descEnd = numMatches[0].Index;
                            var desc = ln[..descEnd].Trim();
                            if (desc.Length < 2) continue;

                            var amounts = new List<decimal>();
                            foreach (Match nm in numMatches)
                            {
                                if (TryParseAmount(nm.Groups[1].Value, out var val))
                                    amounts.Add(val);
                            }

                            if (amounts.Count >= 3)
                            {
                                result.ExtractedData.LineItems.Add(new ExtractedLineItem
                                {
                                    Description = CleanDescription(desc),
                                    Quantity = (int)Math.Max(1, amounts[0]),
                                    UnitPrice = amounts[1],
                                    TotalHT = amounts[^1]
                                });
                            }
                            else if (amounts.Count == 2)
                            {
                                result.ExtractedData.LineItems.Add(new ExtractedLineItem
                                {
                                    Description = CleanDescription(desc),
                                    Quantity = (int)Math.Max(1, amounts[0]),
                                    UnitPrice = amounts[0] > 0 ? amounts[1] / amounts[0] : amounts[1],
                                    TotalHT = amounts[1]
                                });
                            }
                        }
                    }
                }

                // ── Try to infer tax rate from context if not set on items ──
                var globalTaxRate = DetectGlobalTaxRate(text);
                foreach (var item in result.ExtractedData.LineItems)
                {
                    if (!item.TaxRate.HasValue)
                        item.TaxRate = globalTaxRate;
                }

                // ── Cross-validate line items against totals ──
                if (result.ExtractedData.LineItems.Count > 0 && result.ExtractedData.TotalHT.HasValue)
                {
                    var itemsTotal = result.ExtractedData.LineItems.Sum(i => i.TotalHT);
                    var diff = Math.Abs(itemsTotal - result.ExtractedData.TotalHT.Value);
                    if (diff > 1m && diff > result.ExtractedData.TotalHT.Value * 0.05m)
                    {
                        result.Warnings.Add($"Line items total ({itemsTotal:F2}) differs from invoice HT ({result.ExtractedData.TotalHT:F2}). Please verify items.");
                    }
                }

                if (result.ExtractedData.LineItems.Count > 0)
                {
                    _logger.LogInformation("Extracted {Count} line items from PDF", result.ExtractedData.LineItems.Count);
                }
                else
                {
                    result.Warnings.Add("Could not extract line items. You can add them manually.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error extracting line items");
                result.Warnings.Add("Line item extraction encountered an error. Please enter items manually.");
            }
        }

        private static string CleanDescription(string desc)
        {
            // Remove leading line numbers (1., 01-, etc.)
            desc = Regex.Replace(desc, @"^\d{1,3}[\.\)\-]\s*", "");
            return desc.Trim();
        }

        private static bool TryParseDecimalQuantity(string input, out double qty)
        {
            qty = 0;
            input = input.Trim().Replace(",", ".").Replace(" ", "");
            return double.TryParse(input, NumberStyles.Any, CultureInfo.InvariantCulture, out qty) && qty > 0;
        }

        private static bool TryParseTaxPercentage(string input, out decimal rate)
        {
            rate = 0;
            input = input.Trim().Replace("%", "").Replace(",", ".").Replace(" ", "");
            if (decimal.TryParse(input, NumberStyles.Any, CultureInfo.InvariantCulture, out var val))
            {
                rate = val > 1 ? val / 100m : val;
                return rate >= 0 && rate <= 1;
            }
            return false;
        }

        private static decimal DetectGlobalTaxRate(string text)
        {
            // Look for TVA percentage in text (e.g., "TVA 19%", "TVA (19%)", "19,00 %")
            var taxPatterns = new[]
            {
                new Regex(@"TVA\s*[\(:]*\s*(\d+(?:[.,]\d+)?)\s*%", RegexOptions.IgnoreCase),
                new Regex(@"VAT\s*[\(:]*\s*(\d+(?:[.,]\d+)?)\s*%", RegexOptions.IgnoreCase),
                new Regex(@"Taux\s*(?:de\s*)?TVA\s*[:]*\s*(\d+(?:[.,]\d+)?)\s*%", RegexOptions.IgnoreCase),
            };

            foreach (var pattern in taxPatterns)
            {
                var match = pattern.Match(text);
                if (match.Success)
                {
                    var valStr = match.Groups[1].Value.Replace(",", ".");
                    if (decimal.TryParse(valStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var pct))
                        return pct > 1 ? pct / 100m : pct;
                }
            }

            return 0.19m; // Default Tunisian TVA
        }

        private static int CountAmountLikeTokens(string line)
        {
            return Regex.Matches(line, @"\d+[.,]\d{2,3}").Count;
        }

        private bool IsTableHeader(string text)
        {
            var headers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "description", "désignation", "designation", "libellé", "libelle",
                "article", "produit", "product", "item", "service",
                "quantité", "quantite", "quantity", "qty", "qté",
                "prix", "price", "montant", "amount", "total",
                "unitaire", "unit", "p.u.", "pu"
            };
            
            var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return words.Any(w => headers.Contains(w.Trim()));
        }

        public async Task<Supplier?> SaveScannedDataAsync(int companyId, SupplierScanResult scanResult, SupplierScanCorrections? corrections = null)
        {
            // Create supplier with extracted/corrected data
            var data = scanResult.ExtractedData;
            
            // Apply corrections if provided
            if (corrections != null)
            {
                if (!string.IsNullOrWhiteSpace(corrections.SupplierName))
                    data.SupplierName = corrections.SupplierName;
                if (!string.IsNullOrWhiteSpace(corrections.Email))
                    data.Email = corrections.Email;
                if (!string.IsNullOrWhiteSpace(corrections.Phone))
                    data.Phone = corrections.Phone;
                if (!string.IsNullOrWhiteSpace(corrections.Address))
                    data.Address = corrections.Address;
                if (!string.IsNullOrWhiteSpace(corrections.InvoiceNumber))
                    data.InvoiceNumber = corrections.InvoiceNumber;
                if (corrections.InvoiceDate.HasValue)
                    data.InvoiceDate = corrections.InvoiceDate;
                if (corrections.TotalTTC.HasValue)
                    data.TotalTTC = corrections.TotalTTC;
                if (corrections.TotalHT.HasValue)
                    data.TotalHT = corrections.TotalHT;
                if (corrections.TVA.HasValue)
                    data.TVA = corrections.TVA;
            }

            var supplier = new Supplier
            {
                CompanyId = companyId,
                Name = data.SupplierName ?? "Unknown",
                Phone = data.Phone ?? string.Empty,
                Address = data.Address ?? string.Empty,
                CreatedAt = DateTime.UtcNow
            };

            return await Task.FromResult(supplier);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESULT MODELS
    // ═══════════════════════════════════════════════════════════════

    public class SupplierScanResult
    {
        public bool Success { get; set; }
        public string FileName { get; set; } = string.Empty;
        public DateTime ScannedAt { get; set; }
        public double ConfidenceScore { get; set; }
        public bool RequiresReview { get; set; }
        public string RawExtractedText { get; set; } = string.Empty;
        public byte[]? PdfBytes { get; set; }
        
        public SupplierExtractedData ExtractedData { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class SupplierExtractedData
    {
        public string? SupplierName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public string? TaxId { get; set; }
        public string? Currency { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TVA { get; set; }
        public List<ExtractedLineItem> LineItems { get; set; } = new();
    }

    public class ExtractedLineItem
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal? TaxRate { get; set; }
        public decimal TotalHT { get; set; }
    }

    public class SupplierScanCorrections
    {
        public string? SupplierName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public decimal? TotalTTC { get; set; }
        public decimal? TotalHT { get; set; }
        public decimal? TVA { get; set; }
    }
}
