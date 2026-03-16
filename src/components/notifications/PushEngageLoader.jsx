/**
 * PushEngageLoader — Permission-Gated PushEngage SDK Initializer
 *
 * 2026-03-13: Extracted from Layout.js to prevent MyProgram-only users
 * from subscribing to PushEngage and receiving operational push broadcasts.
 *
 * Mount this component ONLY on pages where push notifications are needed:
 *   ✅ PublicProgramView (Live View — coordinators, admins)
 *   ✅ DirectorConsole (Live Director — admins, live managers)
 *   ❌ MyProgram — NEVER (volunteers, view-only)
 *   ❌ PublicCountdownDisplay — NEVER (TV display)
 *
 * The component is idempotent: multiple mounts won't re-inject the SDK.
 * PushEngage SDK handles its own subscription prompt after initialization.
 *
 * DECISION: "PushEngage SDK gated by permission" (2026-03-13)
 * ROOT CAUSE: Layout.js loaded PushEngage for ALL authenticated users,
 * enrolling MyProgram-only volunteers as push subscribers. Broadcasts from
 * checkUpcomingNotifications then reached all subscribers indiscriminately.
 */
import { useEffect } from 'react';

export default function PushEngageLoader() {
  // 2026-03-16: RE-ENABLED after merging PushEngage SW into custom SW.
  // importScripts fix deployed — PE now owns push event handling.
  // SDK loads once per page mount to register/maintain subscriptions.
  // PE dashboard: "Enable the service worker registration" = OFF
  // (our merged SW at /service-worker.js handles registration).

  useEffect(() => {
    // Idempotent: skip if already loaded
    if (window._peSDKLoaded) return;
    window._peSDKLoaded = true;

    window.PushEngage = window.PushEngage || [];
    window._peq = window._peq || [];
    window.PushEngage.push(['init', {
      appId: '968eaa2b-cba4-4999-b736-393668e20d9b'
    }]);

    const script = document.createElement('script');
    script.src = 'https://clientcdn.pushengage.com/sdks/pushengage-web-sdk.js';
    script.async = true;
    script.type = 'text/javascript';
    document.head.appendChild(script);
  }, []);

  return null;
}