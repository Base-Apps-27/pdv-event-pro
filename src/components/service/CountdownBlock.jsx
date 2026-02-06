import React, { useMemo } from "react";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * CountdownBlock
 * 
 * TV-optimized countdown display for a segment.
 * Shows:
 * - Countdown timer (HH:MM:SS or negative if not started)
 * - Segment title
 * - Presenter/info
 * - Live-adjusted indicator if applicable
 * 
 * No interaction, large typography.
 */
export default function CountdownBlock({
  segment,
  label,
  isCurrent = true,
  currentTime,
  serviceDate
}) {
  const { t } = useLanguage();

  const { countdownText, timeRemaining, hasStarted, isLiveAdjusted } = useMemo(() => {
    if (!segment || !segment.start_time) {
      return { countdownText: '--:--:--', timeRemaining: 0, hasStarted: false, isLiveAdjusted: false };
    }

    const startTime = new Date(`${serviceDate}T${segment.start_time}`).getTime();
    const endTime = startTime + (segment.duration_min || 0) * 60000;
    const now = currentTime.getTime();

    let targetTime = startTime;
    let hasStartedLocal = false;

    if (now >= startTime && now < endTime) {
      // Currently in progress: count down to end
      targetTime = endTime;
      hasStartedLocal = true;
    } else if (now >= endTime) {
      // Already completed
      return { countdownText: '✓ DONE', timeRemaining: 0, hasStarted: true, isLiveAdjusted: segment.is_live_adjusted || false };
    }

    const diffMs = targetTime - now;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const sign = diffMs < 0 ? '-' : '';
    const absHours = Math.abs(hours);
    const absMinutes = Math.abs(minutes);
    const absSeconds = Math.abs(seconds);

    const countdownStr = `${sign}${String(absHours).padStart(2, '0')}:${String(absMinutes).padStart(2, '0')}:${String(absSeconds).padStart(2, '0')}`;

    return {
      countdownText: countdownStr,
      timeRemaining: Math.max(0, totalSeconds),
      hasStarted: hasStartedLocal,
      isLiveAdjusted: segment.is_live_adjusted || false
    };
  }, [segment, currentTime, serviceDate]);

  // Color scheme based on state
  const borderColor = isCurrent && hasStarted ? 'border-pdv-green' : 'border-pdv-yellow';
  const labelBg = isCurrent && hasStarted ? 'bg-pdv-green text-white' : 'bg-pdv-yellow text-black';

  return (
    <div className={`relative bg-white rounded-3xl border-4 ${borderColor} p-8 md:p-10 shadow-lg`}>
      
      {/* Label */}
      <div className={`absolute -top-4 left-8 px-4 py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider ${labelBg} shadow-lg`}>
        {label}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        
        {/* Countdown Timer — HERO ELEMENT */}
        <div className="text-center">
          <div className="text-7xl md:text-8xl font-black text-pdv-teal font-mono tracking-tighter leading-none mb-2">
            {countdownText}
          </div>
          {isLiveAdjusted && (
            <div className="text-sm md:text-base font-bold text-pdv-yellow uppercase tracking-widest">
              {t('live.adjusted')}
            </div>
          )}
        </div>

        {/* Segment Title */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 uppercase tracking-tight">
            {segment.title}
          </h2>
        </div>

        {/* Segment Type & Presenter */}
        {(segment.segment_type || segment.presenter) && (
          <div className="flex flex-col items-center gap-2 text-center">
            {segment.segment_type && (
              <div className="text-lg md:text-xl font-semibold text-pdv-teal uppercase tracking-wider">
                {segment.segment_type}
              </div>
            )}
            {segment.presenter && (
              <div className="text-lg md:text-xl text-slate-600 font-medium">
                {segment.presenter}
              </div>
            )}
          </div>
        )}

        {/* Start Time Display */}
        <div className="text-center pt-4 border-t border-slate-200">
          <div className="text-sm md:text-base text-slate-500 uppercase tracking-widest">
            {t('live.start')}
          </div>
          <div className="text-2xl md:text-3xl font-black text-pdv-teal font-mono mt-1">
            {formatTimeToEST(segment.start_time)}
          </div>
        </div>

      </div>
    </div>
  );
}