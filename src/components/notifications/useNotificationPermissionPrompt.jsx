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
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    // Small delay so the page has painted before the browser dialog appears
    const timer = setTimeout(() => {
      Notification.requestPermission().catch(() => {
        // Permission request can be blocked in sandboxed iframes — ignore silently
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);
}