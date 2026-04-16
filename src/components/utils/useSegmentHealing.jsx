/**
 * useSegmentHealing — One-time auto-heal for duplicate segment orders and null times.
 * 2026-04-16: Created to fix ~50+ segments across multiple sessions with duplicate
 * order values (two segments at order=1) and NULL start_time/end_time.
 *
 * Runs automatically on first admin login. Idempotent via localStorage flag.
 * After healing, triggers a cache rebuild so display surfaces get fresh data.
 *
 * CLEANUP: Remove this hook + Layout integration once all sessions are confirmed fixed.
 */

import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

const HEALING_FLAG = 'segment_healing_v1_complete';

export default function useSegmentHealing(user) {
  const ran = useRef(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (ran.current) return;
    if (localStorage.getItem(HEALING_FLAG)) return;
    ran.current = true;

    (async () => {
      try {
        console.log('[SegmentHealing] Starting one-time segment healing...');
        const result = await base44.functions.invoke('healSegmentData', { dry_run: false });
        const data = result?.data;
        const fixed = data?.summary?.sessions_fixed ?? 0;
        const segFixed = data?.summary?.segment_orders_fixed ?? 0;
        const timesFixed = data?.summary?.segment_times_fixed ?? 0;

        console.log(`[SegmentHealing] Complete: fixed ${fixed} sessions, ${segFixed} orders, ${timesFixed} times`);

        // Set flag so this never runs again
        localStorage.setItem(HEALING_FLAG, new Date().toISOString());

        // If anything was fixed, trigger cache rebuild for fresh display data
        if (fixed > 0) {
          console.log('[SegmentHealing] Triggering cache rebuild after healing...');
          await base44.functions.invoke('refreshActiveProgram', { trigger: 'healing' });
          console.log('[SegmentHealing] Cache rebuild triggered.');
        }
      } catch (err) {
        console.error('[SegmentHealing] Failed:', err.message);
        // Don't set flag on failure — allow retry on next load
      }
    })();
  }, [user]);
}