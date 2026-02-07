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
  serviceDate
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

        switch (action.timing) {
          case 'before_start':
            actionTime.setMinutes(segStart.getMinutes() - offset);
            break;
          case 'after_start':
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
            return;
        }

        const isPrep = action.timing === 'before_start';
        
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
    <div className="w-full bg-white rounded-xl border-2 border-pdv-teal/30 p-2 md:p-3 shadow-md">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200">
        <Clock className="w-4 h-4 md:w-5 md:h-5 text-pdv-teal flex-shrink-0" />
        <h3 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-wide">
          {language === 'es' ? 'ACCIONES' : 'ACTIONS'}
        </h3>
      </div>

      {/* Actions Grid (Horizontal) */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${
        upcomingActions.length === 1 ? 'lg:grid-cols-1' :
        upcomingActions.length === 2 ? 'lg:grid-cols-2' :
        upcomingActions.length === 3 ? 'lg:grid-cols-3' :
        'lg:grid-cols-4'
      }`}>
        {/* If > 4 items, show 3 items + overflow card (total 4 slots). Else show all (max 4). */}
        {upcomingActions.slice(0, upcomingActions.length > 4 ? 3 : 4).map((action) => {
          const now = currentTime.getTime();
          const timeUntil = action.time.getTime() - now;
          const minutesUntil = Math.ceil(timeUntil / 60000);
          const isUrgent = timeUntil > 0 && timeUntil < 5 * 60000; // < 5 min

          return (
          <div
            key={action.id}
            className={`flex flex-col p-2 rounded-lg transition-colors h-full ${
              isUrgent
                ? 'bg-amber-50 border-2 border-amber-300'
                : 'bg-slate-50 border border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2 mb-1.5">
              {/* Time Block (Left) */}
              <div className="flex flex-col items-center min-w-[45px] flex-shrink-0">
                <div className={`text-xl font-black font-mono leading-none tracking-tight ${
                  isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                }`}>
                  {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                </div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                  {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                </div>
              </div>

              {/* Main Content (Right) */}
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start gap-1">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight leading-none mb-1">
                      {action.label}
                    </h4>
                      {isUrgent && <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse flex-shrink-0" />}
                   </div>

                   {/* Meta Row: Badge + Dept + UpNext */}
                   <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2">
                      <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-[10px] ${
                        action.isPrep
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {action.isPrep ? t('live.preparation') : t('live.during')}
                      </span>
                      
                      <span className="text-slate-600 font-medium">
                        {action.type}
                      </span>

                      {action.isNext && (
                         <span className="font-bold text-slate-900">
                           {t('live.upNext')}
                         </span>
                      )}
                   </div>
                </div>
              </div>

              {/* Instructions/Notes */}
              {action.notes && (
                <div className="mb-2">
                   <div className="p-2 bg-white rounded-lg text-xs text-slate-800 font-medium leading-snug whitespace-pre-wrap break-words border border-slate-200 shadow-sm">
                      {action.notes}
                   </div>
                </div>
              )}

              {/* Footer: Segment Context */}
              <div className="mt-auto pt-2 border-t border-black/5 text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
                 {action.segmentTitle}
              </div>
            </div>
          );
        })}

        {/* Overflow Card - Takes the 4th slot if we have > 4 items */}
        {upcomingActions.length > 4 && (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 text-white border border-slate-700 h-full text-center">
            <div className="text-4xl font-black mb-1">+{upcomingActions.length - 3}</div>
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">More Actions</div>
            <div className="text-xs bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300">
              Check App
            </div>
          </div>
        )}
      </div>
    </div>
  );
}