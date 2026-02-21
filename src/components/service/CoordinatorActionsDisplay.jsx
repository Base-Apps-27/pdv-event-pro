import React, { useMemo } from "react";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { AlertCircle, Clock } from "lucide-react";

/**
 * CoordinatorActionsDisplay
 * 
 * TV-optimized display of upcoming coordinator actions.
 * Shows DURANTE actions from current segment + PREP actions from next segment.
 * Reuses timing logic from StickyOpsDeck.
 * Sorted by time, highlighted by urgency.
 */
export default function CoordinatorActionsDisplay({
  currentSegment,
  nextSegment,
  currentTime,
  serviceDate,
  layout = 'grid' // 'grid' | 'vertical'
}) {
  const { t, language } = useLanguage();

  const upcomingActions = useMemo(() => {
    const actions = [];
    const now = currentTime.getTime();

    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      return new Date(y, m - 1, d, h, min, 0, 0);
    };

    // Helper to process segment actions
    const processSegment = (segment, isNext = false) => {
      if (!segment || !segment.start_time) return;

      const segStart = parseDateTime(serviceDate, segment.start_time);
      if (!segStart) return;

      const duration = segment.duration_min || 0;
      const segEnd = new Date(segStart);
      segEnd.setMinutes(segStart.getMinutes() + duration);

      const segActions = segment.segment_actions || segment.actions || [];

      segActions.forEach(action => {
        let actionTime = new Date(segStart);
        const offset = action.offset_min || 0;
        // Permissive: default to 'after_start' if timing is missing (weekly service compat)
        const timing = action.timing || 'after_start';

        switch (timing) {
          case 'before_start':
            actionTime.setMinutes(segStart.getMinutes() - offset);
            break;
          case 'after_start':
          case 'during':
            actionTime.setMinutes(segStart.getMinutes() + offset);
            break;
          case 'before_end':
            actionTime.setMinutes(segEnd.getMinutes() - offset);
            break;
          case 'absolute':
            if (action.absolute_time) {
              const absDate = parseDateTime(serviceDate, action.absolute_time);
              if (absDate) actionTime = absDate;
            }
            break;
          default:
            // Fallback: treat as start + offset instead of dropping
            actionTime.setMinutes(segStart.getMinutes() + offset);
            break;
        }

        const isPrep = timing === 'before_start';
        
        // FILTERING LOGIC:
        // - For CURRENT segment: only show DURANTE actions (not prep)
        // - For NEXT segment: only show PREP actions
        if (isNext) {
          // Next segment: only PREP
          if (!isPrep) return;
        } else {
          // Current segment: only DURANTE (in-segment or ongoing)
          if (isPrep) return;
        }

        // Only include actions that haven't happened yet (or are happening now)
        if (actionTime.getTime() >= now - 60000) { // Include if within last 1 min (ongoing)
          actions.push({
            id: `${segment.id}-${action.label}-${action.timing}`,
            time: actionTime,
            label: action.label,
            segmentTitle: segment.title,
            segmentId: segment.id,
            type: action.department || 'General',
            isPrep: isPrep,
            isNext: isNext,
            notes: action.notes
          });
        }
      });
    };

    // Process current and next segments
    processSegment(currentSegment, false);
    processSegment(nextSegment, true);

    // Sort by time
    return actions.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [currentSegment, nextSegment, currentTime, serviceDate]);

  if (upcomingActions.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl border-2 border-pdv-teal/30 p-2 md:p-3 shadow-lg">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200 flex-shrink-0">
        <Clock className="w-4 h-4 md:w-5 md:h-5 text-pdv-teal flex-shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-wide">
          {language === 'es' ? 'ACCIONES' : 'ACTIONS'}
        </h3>
      </div>

      {/* Hero + Grid Layout: First action prominent, rest compact below */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {upcomingActions.length > 0 && (() => {
          const heroAction = upcomingActions[0];
          const secondaryActions = upcomingActions.slice(1, 4); // Show up to 3 more
          
          return (
            <>
              {/* HERO ACTION — Full-width, prominent */}
              {(() => {
                const action = heroAction;
                const now = currentTime.getTime();
                const timeUntil = action.time.getTime() - now;
                const minutesUntil = Math.ceil(timeUntil / 60000);
                const isUrgent = timeUntil > 0 && timeUntil < 5 * 60000;

                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 ${
                      isUrgent
                        ? 'bg-amber-50 border-amber-400 shadow-amber-200/50 shadow-lg'
                        : 'bg-gradient-to-br from-white to-slate-50 border-pdv-teal/40 shadow-lg'
                    }`}
                  >
                    {/* Time Block */}
                    <div className="flex flex-col items-center min-w-[60px] flex-shrink-0">
                      <div className={`text-3xl font-black font-mono leading-none tracking-tight ${
                        isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                      }`}>
                        {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                        {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight leading-tight">
                          {action.label}
                        </h4>
                        {isUrgent && <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse flex-shrink-0" />}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] mb-1">
                        <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[9px] ${
                          action.isPrep
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {action.isPrep ? t('live.preparation') : t('live.during')}
                        </span>
                        <span className="text-slate-600 font-medium">{action.type}</span>
                      </div>

                      {action.notes && (
                        <div className="p-2 bg-white/80 rounded text-[10px] text-slate-700 leading-tight border border-slate-200 mt-1">
                          {action.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* SECONDARY ACTIONS — Compact grid (2-3 columns) */}
              {secondaryActions.length > 0 && (
                <div className={`grid gap-2 ${
                  secondaryActions.length === 1 ? 'grid-cols-1' :
                  secondaryActions.length === 2 ? 'grid-cols-2' :
                  'grid-cols-3'
                }`}>
                  {secondaryActions.map((action) => {
                    const now = currentTime.getTime();
                    const timeUntil = action.time.getTime() - now;
                    const minutesUntil = Math.ceil(timeUntil / 60000);
                    const isUrgent = timeUntil > 0 && timeUntil < 5 * 60000;

                    return (
                      <div
                        key={action.id}
                        className={`flex flex-col p-2 rounded-lg border ${
                          isUrgent
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Time + Alert */}
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-lg font-black font-mono leading-none ${
                            isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                          }`}>
                            {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                          </div>
                          {isUrgent && <AlertCircle className="w-3 h-3 text-amber-600 animate-pulse" />}
                        </div>

                        {/* Label */}
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase leading-tight mb-1 line-clamp-2">
                          {action.label}
                        </h4>

                        {/* Meta */}
                        <div className="flex items-center gap-1 text-[8px]">
                          <span className={`font-bold uppercase px-1 py-0.5 rounded ${
                            action.isPrep ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {action.isPrep ? 'PREP' : 'LIVE'}
                          </span>
                          <span className="text-slate-500 truncate">{action.type}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Overflow indicator */}
              {upcomingActions.length > 4 && (
                <div className="text-center py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  +{upcomingActions.length - 4} more in app
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}