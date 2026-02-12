/**
 * sanitizeHtml — P0-1 XSS Remediation (2026-02-12)
 * 
 * Replaces the bypassable regex pattern:
 *   html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
 * 
 * Uses DOMPurify to properly sanitize HTML while preserving
 * allowed formatting tags (b, i, strong, em, br).
 * 
 * USAGE:
 *   import { sanitizeHtml } from '@/components/utils/sanitizeHtml';
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['b', 'i', 'strong', 'em', 'br'];

/**
 * Sanitize HTML content, allowing only safe formatting tags.
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [], // No attributes allowed on any tag
  });
}

/**
 * Sanitize HTML and also replace &nbsp; with regular spaces.
 * Used in print previews where &nbsp; can cause layout issues.
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML with &nbsp; replaced
 */
export function sanitizeHtmlForPrint(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  }).replace(/&nbsp;/g, ' ');
}