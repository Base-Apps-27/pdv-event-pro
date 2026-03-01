/**
 * useSegmentDetection — Extracted from PublicCountdownDisplay (2026-03-01)
 *
 * PURPOSE: Reusable hook that computes current, next, pre-launch, and upcoming
 * segments from a flat segments array + current time. Used by TV Display and
 * potentially MyProgram for consistent segment detection across surfaces.
 *
 * EXTRACTED because:
 *   - PublicCountdownDisplay was 400+ lines with 80 lines of inline segment logic
 *   - Same logic pattern exists in MyProgram (drift risk)
 *   - getTimeDate was defined as a closure over component state — now a pure function
 *
 * Decision: "Extract useSegmentDetection to prevent drift between display surfaces"
 */
import { useMemo } from "react";

/**
 * Pure time parser — converts "HH:MM" string to a Date object.
 * Uses segmentDate or serviceDate for the calendar date, currentTime as fallback.
 *
 * @param {string} timeStr - Time string in "HH:MM" format
 * @param {string|null} segmentDate - Optional YYYY-MM-DD from the segment (multi-day events)
 * @param {string} serviceDate - Service-level YYYY-MM-DD fallback
 * @param {Date} currentTime - Live clock fallback
 * @returns {Date|null}
 */
export function getTimeDate(timeStr, segmentDate, serviceDate, currentTime) {
  if (!timeStr) return null;
  const [hours, mins] = timeStr.split(":").map(Number);
  const target = segmentDate || serviceDate;
  let date;
  if (target) {
    const [y, m, d] = target.split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(currentTime);
  }
  date.setHours(hours, mins, 0, 0);
  return date;
}

/**
 * Detect whether a segment is a break (not countdown-worthy).
 * Breaks appear in timeline as dividers but don't drive the countdown hero.
 */
function isBreakSegment(s) {
  const tp = (s.segment_type || s.type || "").toLowerCase();
  return ["receso", "almuerzo", "break"].includes(tp) || s.major_break;
}

/**
 * @param {object} params
 * @param {object[]} params.segments - Normalized flat segments array
 * @param {Date} params.currentTime - Live clock
 * @param {string} params.serviceDate - YYYY-MM-DD
 * @param {boolean} [params.isOverrideMode] - Debug/override mode shows all segments
 * @returns {{ currentSegment, nextSegment, preLaunchSegment, upcomingSegments, getTimeDateFn }}
 */
export default function useSegmentDetection({
  segments,
  currentTime,
  serviceDate,
  isOverrideMode = false,
}) {
  // Memoized wrapper that binds serviceDate + currentTime for convenience.
  // Consumers pass this to child components (CountdownBlock, SegmentTimeline).
  const getTimeDateFn = useMemo(() => {
    return (timeStr, segmentDate = null) =>
      getTimeDate(timeStr, segmentDate, serviceDate, currentTime);
  }, [serviceDate, currentTime]);

  const result = useMemo(() => {
    const empty = {
      currentSegment: null,
      nextSegment: null,
      preLaunchSegment: null,
      upcomingSegments: [],
    };
    if (!segments || segments.length === 0) return empty;

    const validSegments = segments
      .filter((s) => {
        if (s.live_status === "skipped") return false;
        return s.actual_start_time || s.start_time;
      })
      .map((s) => ({
        ...s,
        _effectiveStart: s.actual_start_time || s.start_time,
        _effectiveEnd: s.actual_end_time || s.end_time,
      }))
      .sort((a, b) => {
        // DECISION-004: Sort by date FIRST (multi-day events), then by time
        const tA = getTimeDate(a._effectiveStart, a.date, serviceDate, currentTime);
        const tB = getTimeDate(b._effectiveStart, b.date, serviceDate, currentTime);
        if (!tA && !tB) return 0;
        if (!tA) return 1;
        if (!tB) return -1;
        return tA - tB;
      });

    if (validSegments.length === 0) return empty;

    const current =
      validSegments.find((s) => {
        if (isBreakSegment(s)) return false;
        const start = getTimeDate(s._effectiveStart, s.date, serviceDate, currentTime);
        const end = s._effectiveEnd
          ? getTimeDate(s._effectiveEnd, s.date, serviceDate, currentTime)
          : start
            ? new Date(start.getTime() + (s.duration_min || 0) * 60000)
            : null;
        if (s.live_hold_status === "held") return true;
        return start && end && currentTime >= start && currentTime <= end;
      }) || null;

    const next =
      validSegments.find((s) => {
        if (s === current || isBreakSegment(s)) return false;
        const start = getTimeDate(s._effectiveStart, s.date, serviceDate, currentTime);
        return start && start > currentTime;
      }) || null;

    // Timeline: no hard limit. Override mode shows all when none are active.
    const upcoming = validSegments.filter((s) => {
      if (s === current) return false;
      const start = getTimeDate(s._effectiveStart, s.date, serviceDate, currentTime);
      if (!start) return false;
      if (isOverrideMode && !current) return true;
      return start > currentTime;
    });

    let preLaunch = null;
    if (!current && next) {
      preLaunch = next;
    } else if (!current && !next && validSegments.length > 0) {
      const first = validSegments[0];
      const firstStart = getTimeDate(first._effectiveStart, first.date, serviceDate, currentTime);
      if (isOverrideMode || (firstStart && currentTime < firstStart)) preLaunch = first;
    }

    return {
      currentSegment: current,
      nextSegment: next,
      preLaunchSegment: preLaunch,
      upcomingSegments: upcoming,
    };
  }, [segments, currentTime, serviceDate, isOverrideMode]);

  return {
    ...result,
    getTimeDateFn,
  };
}