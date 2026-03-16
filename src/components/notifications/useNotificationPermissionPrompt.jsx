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
  // 2026-03-16: RE-ENABLED after PushEngage merged SW deployment.
  // Triggers the browser's native notification permission dialog.
  // PushEngage SDK picks up the subscription after permission is granted.
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Small delay to let PushEngage SDK initialize and register SW first
      const timer = setTimeout(() => {
        Notification.requestPermission().then((result) => {
          console.log('[NotificationPrompt] Permission result:', result);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);
}