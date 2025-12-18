/**
 * Text sanitization for PDF rendering
 * Strips HTML, fixes encoding corruption, normalizes special characters
 */

/**
 * Sanitize text for PDF output
 * - Strips HTML tags (converts <br> to newlines)
 * - Normalizes Unicode to NFC
 * - Replaces smart quotes/dashes with safe equivalents
 * - Fixes corrupted bullet characters
 * - Removes control characters
 * - Preserves Spanish accents (á é í ó ú ñ ü)
 */
export function sanitizeText(text) {
  if (!text) return '';
  
  let cleaned = String(text);
  
  // Step 1: Handle HTML tags (convert <br> to newlines, strip everything else)
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, ''); // Strip all remaining tags
  
  // Step 2: Normalize Unicode to NFC (canonical composition)
  cleaned = cleaned.normalize('NFC');
  
  // Step 3: Replace smart quotes and dashes with safe equivalents
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → '
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → "
    .replace(/[\u2013\u2014]/g, '-') // En/em dashes → -
    .replace(/\u2026/g, '...'); // Ellipsis → ...
  
  // Step 4: Fix bullet characters (normalize to •)
  cleaned = cleaned
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '•') // Various bullets → •
    .replace(/[\uFFFD]/g, '') // Remove replacement character (�)
    .replace(/=Å/g, '') // Remove weird encoding artifact
    .replace(/[\uFFFE]/g, ''); // Remove BOM-like chars
  
  // Step 5: Remove control characters (except newlines and tabs)
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Step 6: Trim whitespace and collapse multiple newlines
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
  
  return cleaned;
}

/**
 * Parse rich text to plain text with line breaks preserved
 * Handles markdown-lite format: **bold**, *italic*, • bullets
 */
export function parseRichText(html) {
  if (!html) return '';
  
  let text = String(html);
  
  // Convert HTML formatting to text markers
  text = text
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*');
  
  // Then sanitize (strips remaining HTML, preserves markers)
  return sanitizeText(text);
}

/**
 * Strip CUE prefix if present in stored data
 * (Renderer will add it back once)
 */
export function stripCuePrefix(text) {
  if (!text) return '';
  return text.replace(/^CUE:\s*/i, '').trim();
}