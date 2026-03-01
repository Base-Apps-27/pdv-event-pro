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
  getTimeDate,
  size = 'full' // 'full' | 'compact'
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
    const effectiveStart = segment?.actual_start_time || segment?.start_time;
    if (!segment || !effectiveStart) {
      return { countdownText: '--:--:--', isLiveAdjusted: false, progressPercent: 0 };
    }

    const effectiveEnd = segment.actual_end_time || segment.end_time;
    const startAt = parseTime(effectiveStart);
    const endAt = effectiveEnd
      ? parseTime(effectiveEnd)
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
      isLiveAdjusted: segment.is_live_adjusted || segment._time_adjusted || false,
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

  // CLIPPING FIX (2026-03-01): Removed overflow-hidden from the outer container.
  // It was clipping the ring-4 glow (in-progress mode) and the absolute-positioned
  // label badge (-top-2.5). Instead, the parent column now uses p-1 padding to give
  // the shadow/ring room to paint within the column's clip boundary.
  return (
    <div className={`relative bg-white rounded-2xl border-3 ${config.borderColor} p-3 md:p-4 shadow-xl ${config.containerClass || ''} transition-all duration-500 light text-slate-900 min-w-0`}>
      
      {/* Label — floats above the card border; parent padding prevents clip */}
      <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest ${config.labelBg} shadow-lg whitespace-nowrap z-10`}>
        {config.label}
      </div>

      {/* Main Content */}
      <div className="space-y-1.5 md:space-y-2 mt-1">
        
        {/* Countdown Timer — HERO ELEMENT */}
        <div className="text-center w-full overflow-hidden min-w-0">
          {/* Responsive sizing accounts for 2-column split at md breakpoint */}
          <div className={`${size === 'compact' ? 'text-3xl md:text-4xl lg:text-5xl' : 'text-4xl sm:text-5xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl'} font-black font-mono tracking-tighter leading-none mb-1 ${config.countdownColor} tabular-nums break-all`}>
            {countdownText}
          </div>
          {isLiveAdjusted && (
            <div className="text-xs md:text-sm font-bold text-amber-500 uppercase tracking-widest">
              {t('live.adjusted')}
            </div>
          )}
        </div>

        {/* Segment Title */}
        <div className="text-center">
          <h2 className={`${size === 'compact' ? 'text-lg md:text-xl' : 'text-2xl md:text-3xl'} font-bold text-slate-900 uppercase tracking-tight`}>
            {segment.title}
          </h2>
        </div>

        {/* Segment Type & Presenter */}
        {(segment.segment_type || segment.type || segment.presenter) && (
          <div className="flex flex-col items-center gap-1 text-center">
            {(segment.segment_type || segment.type) && (
              <div className="text-base md:text-lg font-semibold text-pdv-teal uppercase tracking-wider">
                {segment.segment_type || segment.type}
              </div>
            )}
            {segment.presenter && (
              <div className="text-sm md:text-base text-slate-600 font-medium">
                {segment.presenter}
              </div>
            )}
          </div>
        )}

        {/* Progress Bar (Only for In-Progress) */}
        {displayMode === 'in-progress' && (
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div 
              className="h-full bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] transition-all duration-1000 ease-linear"
              style={{ width: `${isLiveAdjusted ? 100 : (progressPercent || 0)}%` }}
            />
          </div>
        )}

        {/* Start Time Display */}
        <div className="text-center pt-2 border-t border-slate-200 overflow-hidden">
          <div className="text-xs md:text-sm text-slate-500 uppercase tracking-widest truncate">
            {displayMode === 'in-progress' ? (language === 'es' ? 'TERMINA' : 'ENDS') : t('live.start')}
          </div>
          <div className="text-2xl md:text-3xl font-black text-pdv-teal font-mono mt-1">
            {displayMode === 'in-progress' && (segment.actual_end_time || segment.end_time)
              ? formatTimeToEST(segment.actual_end_time || segment.end_time)
              : formatTimeToEST(segment.actual_start_time || segment.start_time)}
          </div>
        </div>

      </div>
    </div>
  );
}