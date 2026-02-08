import React, { useMemo } from "react";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * CountdownBlock
 * 
 * TV-optimized countdown display for a segment.
 * 
 * displayMode:
 *  - 'in-progress': segment is live, counts DOWN to end_time. Green border + "EN CURSO".
 *  - 'pre-launch':  nothing live yet, counts DOWN to first segment start. Teal border + "INICIANDO EN".
 *  - 'upcoming':    next segment after current, counts DOWN to its start. Yellow border + "A CONTINUACIÓN".
 * 
 * Props:
 *  - segment: the segment object
 *  - displayMode: 'in-progress' | 'pre-launch' | 'upcoming'
 *  - currentTime: Date — the live clock
 *  - serviceDate: 'YYYY-MM-DD'
 *  - getTimeDate: (timeStr) => Date — canonical time parser from parent
 */
export default function CountdownBlock({
  segment,
  displayMode = 'upcoming',
  currentTime,
  serviceDate,
  getTimeDate
}) {
  const { t, language } = useLanguage();

  // Canonical time parser — either from parent or inline fallback
  const parseTime = (timeStr) => {
    if (getTimeDate) return getTimeDate(timeStr);
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(currentTime);
    if (serviceDate) {
      const [y, mo, da] = serviceDate.split('-').map(Number);
      d.setFullYear(y); d.setMonth(mo - 1); d.setDate(da);
    }
    d.setHours(h, m, 0, 0);
    return d;
  };

  const { countdownText, isLiveAdjusted, progressPercent } = useMemo(() => {
    if (!segment || !segment.start_time) {
      return { countdownText: '--:--:--', isLiveAdjusted: false, progressPercent: 0 };
    }

    const startAt = parseTime(segment.start_time);
    const endAt = segment.end_time
      ? parseTime(segment.end_time)
      : (startAt ? new Date(startAt.getTime() + (segment.duration_min || 0) * 60000) : null);

    const now = currentTime.getTime();
    let targetMs;

    if (displayMode === 'in-progress') {
      // Count down to segment END
      targetMs = endAt ? endAt.getTime() : now;
    } else {
      // pre-launch or upcoming: count down to segment START
      targetMs = startAt ? startAt.getTime() : now;
    }

    const diffMs = targetMs - now;

    // If countdown has passed (shouldn't happen with correct mode), show done
    if (displayMode === 'in-progress' && diffMs <= 0) {
      return { countdownText: '✓ DONE', isLiveAdjusted: segment.is_live_adjusted || false };
    }

    const absDiffMs = Math.abs(diffMs);
    const totalSeconds = Math.floor(absDiffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Pre-launch shows negative sign (counting down to future start)
    const prefix = (displayMode === 'pre-launch') ? '-' : '';

    const text = `${prefix}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Calculate progress percentage for in-progress items
    let progressPercent = 0;
    if (displayMode === 'in-progress' && startAt && endAt) {
      const totalDuration = endAt.getTime() - startAt.getTime();
      const elapsed = now - startAt.getTime();
      progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    }

    return {
      countdownText: text,
      isLiveAdjusted: segment.is_live_adjusted || false,
      progressPercent
    };
  }, [segment, currentTime, serviceDate, displayMode]);

  // Visual config per mode
  const modeConfig = {
    'in-progress': {
      borderColor: 'border-[#8DC63F]',
      labelBg: 'bg-[#8DC63F] text-slate-900', 
      label: t('live.inProgress'),
      countdownColor: 'text-[#8DC63F]',
      containerClass: 'shadow-green-900/10 ring-4 ring-[#8DC63F]/20'
    },
    'pre-launch': {
      borderColor: 'border-[#1F8A70]',
      labelBg: 'bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] text-white',
      label: language === 'es' ? 'INICIANDO EN' : 'STARTING IN',
      countdownColor: 'bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]',
      containerClass: 'shadow-teal-900/10'
    },
    'upcoming': {
      borderColor: 'border-slate-200',
      labelBg: 'bg-slate-700 text-white',
      label: t('live.upNext'),
      countdownColor: 'text-slate-400',
      containerClass: 'opacity-75 grayscale-[0.5]' // De-emphasize next
    }
  };

  const config = modeConfig[displayMode] || modeConfig['upcoming'];

  return (
    <div className={`relative bg-white rounded-[2rem] border-4 ${config.borderColor} p-6 md:p-8 shadow-2xl ${config.containerClass || ''} transition-all duration-500 light text-slate-900`}>
      
      {/* Label */}
      <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-xs md:text-sm font-black uppercase tracking-widest ${config.labelBg} shadow-xl whitespace-nowrap z-10`}>
        {config.label}
      </div>

      {/* Main Content */}
      <div className="space-y-3 md:space-y-4 mt-2">
        
        {/* Countdown Timer — HERO ELEMENT */}
        <div className="text-center w-full overflow-hidden">
          {/* Responsive sizing accounts for 2-column split at md breakpoint */}
          <div className={`text-5xl sm:text-6xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black font-mono tracking-tighter leading-none mb-2 ${config.countdownColor} tabular-nums break-words`}>
            {countdownText}
          </div>
          {isLiveAdjusted && (
            <div className="text-sm md:text-base font-bold text-amber-500 uppercase tracking-widest">
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

        {/* Progress Bar (Only for In-Progress) */}
        {displayMode === 'in-progress' && (
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] transition-all duration-1000 ease-linear"
              style={{ width: `${isLiveAdjusted ? 100 : (progressPercent || 0)}%` }} // If live adjusted, we don't really know true progress easily without recalculating, but usually we just show regular progress or full if indeterminate
            />
          </div>
        )}

        {/* Start Time Display */}
        <div className="text-center pt-5 border-t border-slate-200">
          <div className="text-base md:text-lg text-slate-500 uppercase tracking-widest">
            {displayMode === 'in-progress' ? (language === 'es' ? 'TERMINA' : 'ENDS') : t('live.start')}
          </div>
          <div className="text-3xl md:text-4xl font-black text-pdv-teal font-mono mt-2">
            {displayMode === 'in-progress' && segment.end_time
              ? formatTimeToEST(segment.end_time)
              : formatTimeToEST(segment.start_time)}
          </div>
        </div>

      </div>
    </div>
  );
}