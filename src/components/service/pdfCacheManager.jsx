/**
 * PDF Cache Manager
 * 
 * Manages localStorage-based caching of generated PDFs.
 * Cache key: SHA-256 hash of service data
 * TTL: 48 hours
 * Storage: localStorage (survives page refresh, limited by browser quota ~5-10MB)
 * 
 * Cache structure:
 * {
 *   pdfBlob: <blob>,
 *   timestamp: <ISO timestamp>,
 *   ttlMs: 48 * 60 * 60 * 1000,
 *   metadata: { serviceId, segmentCount, ... }
 * }
 */

import { safeGetItem, safeSetItem, safeRemoveItem, safeKeys } from '@/components/utils/safeLocalStorage';

const CACHE_PREFIX = 'pdv_pdf_cache_';
const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Generate deterministic hash from service data
 * Returns hex string suitable for cache key
 */
export async function hashServiceData(serviceData) {
  const jsonStr = JSON.stringify(serviceData);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('[CACHE] Hash failed:', error);
    return null;
  }
}

/**
 * Check if cache entry exists and is not expired
 */
export async function getCachedPDF(serviceData) {
  try {
    const hash = await hashServiceData(serviceData);
    if (!hash) return null;
    
    const cacheKey = `${CACHE_PREFIX}${hash}`;
    const cacheEntry = safeGetItem(cacheKey);
    
    if (!cacheEntry) return null;
    
    const { pdfBase64, timestamp, metadata } = JSON.parse(cacheEntry);
    const age = Date.now() - new Date(timestamp).getTime();
    
    // Check TTL
    if (age > TTL_MS) {
      console.log(`[CACHE] Expired after ${Math.round(age / 1000)}s`);
      safeRemoveItem(cacheKey);
      return null;
    }
    
    // Decode base64 back to blob
    const binaryStr = atob(pdfBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    
    console.log(`[CACHE] HIT: ${cacheKey} (age: ${Math.round(age / 1000)}s, segment count: ${metadata?.segmentCount})`);
    return { blob, isCached: true, metadata };
  } catch (error) {
    console.error('[CACHE] Retrieval failed:', error);
    return null;
  }
}

/**
 * Store generated PDF in cache
 */
export async function cachePDF(serviceData, pdfBlob, metadata = {}) {
  try {
    const hash = await hashServiceData(serviceData);
    if (!hash) return false;
    
    const cacheKey = `${CACHE_PREFIX}${hash}`;
    
    // Convert blob to base64 for storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const pdfBase64 = reader.result.split(',')[1]; // Strip data:application/pdf; base64,
          const cacheEntry = {
            pdfBase64,
            timestamp: new Date().toISOString(),
            metadata: {
              serviceId: serviceData.id,
              serviceName: serviceData.name,
              date: serviceData.date,
              segmentCount: serviceData.segments?.length || 0,
              ...metadata
            }
          };
          
          safeSetItem(cacheKey, JSON.stringify(cacheEntry));
          console.log(`[CACHE] STORED: ${cacheKey} (segments: ${metadata.segmentCount}, size: ${(pdfBase64.length / 1024).toFixed(2)}KB)`);
          resolve(true);
        } catch (error) {
          console.error('[CACHE] Storage failed:', error);
          resolve(false);
        }
      };
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    console.error('[CACHE] Cache operation failed:', error);
    return false;
  }
}

/**
 * Clear all PDV PDF caches (admin utility)
 */
export function clearAllPDFCaches() {
  const keys = safeKeys();
  const pdvKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  pdvKeys.forEach(k => safeRemoveItem(k));
  console.log(`[CACHE] Cleared ${pdvKeys.length} PDF caches`);
  return pdvKeys.length;
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats() {
  const keys = safeKeys();
  const pdvKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  const stats = pdvKeys.map(k => {
    try {
      const entry = JSON.parse(safeGetItem(k, '{}'));
      const age = Date.now() - new Date(entry.timestamp).getTime();
      return {
        key: k.replace(CACHE_PREFIX, ''),
        age: Math.round(age / 1000),
        service: entry.metadata?.serviceName,
        size: Math.round((entry.pdfBase64?.length || 0) / 1024)
      };
    } catch {
      return { key: k.replace(CACHE_PREFIX, ''), age: 0, service: 'corrupt', size: 0 };
    }
  });
  return stats;
}