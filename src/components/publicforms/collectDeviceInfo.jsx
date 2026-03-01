/**
 * collectDeviceInfo.js
 * 
 * Collects non-PII browser/device metadata for submission audit trail.
 * Called once at form submit time. All fields are best-effort.
 * 
 * 2026-03-01: Initial implementation. Stored on SpeakerSubmissionVersion.device_info.
 * No cookies, no fingerprinting libraries, no PII. Just standard navigator/screen APIs.
 */

export function collectDeviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  const win = typeof window !== 'undefined' ? window : {};

  return {
    // Browser identification
    user_agent: nav.userAgent || '',
    language: nav.language || '',
    languages: nav.languages ? [...nav.languages] : [],
    platform: nav.platform || '',

    // Screen & viewport
    screen_width: scr.width || null,
    screen_height: scr.height || null,
    viewport_width: win.innerWidth || null,
    viewport_height: win.innerHeight || null,
    device_pixel_ratio: win.devicePixelRatio || null,
    color_depth: scr.colorDepth || null,

    // Connection (if available)
    connection_type: nav.connection?.effectiveType || null,
    connection_downlink: nav.connection?.downlink || null,

    // Hardware hints
    hardware_concurrency: nav.hardwareConcurrency || null,
    device_memory: nav.deviceMemory || null,
    max_touch_points: nav.maxTouchPoints ?? null,

    // Timezone
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || null,
    timezone_offset: new Date().getTimezoneOffset(),

    // Referrer & URL context
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    page_url: win.location?.href || '',

    // Timestamp (client-side, for clock-skew detection)
    client_timestamp: new Date().toISOString(),
  };
}