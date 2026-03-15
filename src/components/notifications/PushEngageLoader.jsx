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
  // ═══ SUSPENDED (2026-03-15) ═══════════════════════════════════
  // All push notifications suspended. PushEngage was sending repeated
  // non-rich spam notifications. SDK loading disabled to prevent new
  // subscriptions. Re-enable after PushEngage integration is audited.
  return null;
}