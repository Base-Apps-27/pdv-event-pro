/**
 * useNotificationPermissionPrompt
 *
 * Triggers the browser's native notification permission request on mount.
 * Call this hook on pages where push subscriptions are relevant:
 *   ✅ PublicProgramView (Live View)
 *   ✅ DirectorConsole
 *   ❌ MyProgram — do NOT add (volunteers, no push needed)
 *   ❌ PublicCountdownDisplay — do NOT add (TV display, never prompts)
 *
 * PushEngage SDK (initialized in Layout.js) handles the actual subscription
 * after the browser grants permission. This hook only ensures the browser
 * dialog appears on the right pages rather than relying solely on chat mount.
 *
 * Idempotent: if permission is already 'granted' or 'denied', does nothing.
 */
import { useEffect } from 'react';

export function useNotificationPermissionPrompt() {
  // ═══ SUSPENDED (2026-03-15) ═══════════════════════════════════
  // All push notifications suspended. No longer prompting users for
  // notification permission. Re-enable after PushEngage audit.
}