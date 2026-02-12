/**
 * safeLocalStorage — Phase 5: Error Handling & Monitoring
 *
 * Wraps all localStorage operations in try/catch to prevent crashes from:
 * - Quota exceeded (especially PDF cache blobs)
 * - Private/incognito mode restrictions
 * - SecurityError in sandboxed iframes
 * - Corrupt JSON
 *
 * Every call returns a safe default on failure and logs a warning.
 * This is intentionally simple — no fallback to sessionStorage or memory.
 *
 * Decision: "Wrap localStorage in try/catch across 7+ files via shared utility" (2026-02-12)
 */

export function safeGetItem(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (err) {
    console.warn(`[safeLocalStorage] getItem("${key}") failed:`, err.message);
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[safeLocalStorage] setItem("${key}") failed:`, err.message);
    return false;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[safeLocalStorage] removeItem("${key}") failed:`, err.message);
    return false;
  }
}

/**
 * Parse JSON from localStorage with fallback.
 * Returns fallback on missing key, corrupt JSON, or storage error.
 */
export function safeGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeLocalStorage] getJSON("${key}") failed:`, err.message);
    return fallback;
  }
}

/**
 * Stringify and store JSON. Returns false on failure.
 */
export function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[safeLocalStorage] setJSON("${key}") failed:`, err.message);
    return false;
  }
}

/**
 * Get all localStorage keys (safe).
 */
export function safeKeys() {
  try {
    return Object.keys(localStorage);
  } catch (err) {
    console.warn('[safeLocalStorage] keys() failed:', err.message);
    return [];
  }
}