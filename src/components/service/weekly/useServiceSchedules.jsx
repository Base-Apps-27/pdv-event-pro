/**
 * useServiceSchedules — Shared hook to load ServiceSchedule entities.
 *
 * Phase 1 Entity Lift: Provides a unified way for WeeklyServiceManager,
 * weeklySessionSync, and ensureNextSundayService to read the configured
 * recurring service schedules instead of relying on hardcoded TIME_SLOTS.
 *
 * Falls back to the legacy hardcoded 2-slot Sunday configuration when
 * no ServiceSchedule records exist in the database.
 *
 * Decision: "ServiceSchedule entity replaces hardcoded TIME_SLOTS" (2026-02-18)
 */

import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Legacy fallback: matches the previous hardcoded TIME_SLOTS constant
const LEGACY_SUNDAY_SESSIONS = [
  { name: "9:30am", planned_start_time: "09:30", order: 1, color: "green" },
  { name: "11:30am", planned_start_time: "11:30", order: 2, color: "blue" },
];

const LEGACY_SCHEDULE = {
  name: "Servicio Dominical",
  day_of_week: "Sunday",
  is_active: true,
  sessions: LEGACY_SUNDAY_SESSIONS,
  _isLegacyFallback: true,
};

/**
 * React hook: loads all active ServiceSchedule records.
 * Returns schedules grouped by day_of_week, plus helper getters.
 */
export function useServiceSchedules() {
  const { data: rawSchedules = [], isLoading } = useQuery({
    queryKey: ['serviceSchedules'],
    queryFn: () => base44.entities.ServiceSchedule.list('day_of_week'),
    staleTime: 0, // Always refetch — blueprint assignments must be fresh for service creation
  });

  // Only active schedules
  const activeSchedules = rawSchedules.filter(s => s.is_active !== false);

  // If no schedules configured at all, provide legacy Sunday fallback
  const schedules = activeSchedules.length > 0 ? activeSchedules : [LEGACY_SCHEDULE];

  /**
   * Get sessions for a specific day_of_week (e.g., "Sunday").
   * Returns the merged sessions array from all schedules on that day.
   */
  const getSessionsForDay = (dayOfWeek) => {
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);
    if (daySchedules.length === 0) return [];
    // Merge sessions from all schedules on this day, sorted by order
    return daySchedules
      .flatMap(s => (s.sessions || []))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  /**
   * Get TIME_SLOTS-compatible array for weeklySessionSync.
   * Format: [{ name: "9:30am", time: "09:30", order: 1, color: "green", blueprint_id: "..." }]
   * blueprint_id is preserved so DayServiceEditor can resolve the correct blueprint per slot.
   */
  const getTimeSlotsForDay = (dayOfWeek) => {
    return getSessionsForDay(dayOfWeek).map(s => ({
      name: s.name,
      time: s.planned_start_time,
      order: s.order,
      color: s.color || "green",
      blueprint_id: s.blueprint_id || null,
    }));
  };

  /**
   * Get all unique days that have active schedules.
   */
  const getActiveDays = () => {
    const days = new Set(schedules.map(s => s.day_of_week));
    return [...days];
  };

  /**
   * Get the full ServiceSchedule record for a specific day.
   * Returns the first active schedule for that day, or null.
   * Recurring Services Refactor (2026-02-23): Added for DayServiceEditor.
   */
  const getScheduleForDay = (dayOfWeek) => {
    return schedules.find(s => s.day_of_week === dayOfWeek) || null;
  };

  return {
    schedules,
    isLoading,
    getSessionsForDay,
    getTimeSlotsForDay,
    getActiveDays,
    getScheduleForDay,
  };
}

// Non-hook version for use in sync functions (outside React)
export { LEGACY_SUNDAY_SESSIONS };