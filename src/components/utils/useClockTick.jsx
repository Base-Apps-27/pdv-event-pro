/**
 * useClockTick — P1-1 Timer Isolation (2026-02-12)
 * 
 * Replaces the pattern of `setCurrentTime(new Date())` every 1 second
 * inside large page components (PublicProgramView 1078 lines, 
 * DirectorConsole 402 lines), which caused full-tree re-renders.
 * 
 * This hook returns a ref-based current time that updates every second
 * WITHOUT triggering re-renders. Components that need to display the
 * time should use the <ClockDisplay /> component instead.
 * 
 * For components that genuinely need re-renders on tick (e.g., countdown
 * timers, "time ago" displays), use useClockTick() which does trigger
 * re-renders but should only be used in small, isolated components.
 * 
 * USAGE:
 *   // In a small display component (re-renders every second — OK because it's small):
 *   import { useClockTick } from '@/components/utils/useClockTick';
 *   function MyClock() {
 *     const currentTime = useClockTick();
 *     return <span>{currentTime.toLocaleTimeString()}</span>;
 *   }
 * 
 *   // In a large page component (no re-renders — pass to children):
 *   import { useClockRef } from '@/components/utils/useClockTick';
 *   function BigPage() {
 *     const clockRef = useClockRef();
 *     // Pass clockRef.current to children that need it
 *   }
 */
import { useState, useEffect, useRef } from 'react';

/**
 * Returns a Date that updates every second, triggering re-renders.
 * Use ONLY in small, isolated components (< 50 lines).
 */
export function useClockTick(intervalMs = 1000) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return time;
}

/**
 * Returns a ref whose `.current` updates every second WITHOUT re-renders.
 * Use in large page components to avoid full-tree re-renders.
 */
export function useClockRef(intervalMs = 1000) {
  const ref = useRef(new Date());

  useEffect(() => {
    const id = setInterval(() => { ref.current = new Date(); }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return ref;
}