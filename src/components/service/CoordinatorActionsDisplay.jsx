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
  const { t } = useLanguage();

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
    <div className="w-full bg-white rounded-2xl border-2 border-pdv-teal/30 p-6 md:p-8 shadow-lg">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <Clock className="w-6 h-6 md:w-8 md:h-8 text-pdv-teal flex-shrink-0" />
        <h3 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-wide">
          {t('live.coordination')}
        </h3>
      </div>

      {/* Actions Grid (Horizontal) */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
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
              className={`flex flex-col p-4 rounded-xl transition-colors h-full ${
                isUrgent
                  ? 'bg-amber-50 border-2 border-amber-300'
                  : 'bg-slate-50 border border-slate-200'
              }`}
            >
              {/* Header: Time & Type */}
              <div className="flex justify-between items-start mb-3">
                <div className={`text-2xl font-black font-mono leading-none ${
                  isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                }`}>
                  {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                </div>
                {isUrgent && <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />}
              </div>

              {/* Main Label */}
              <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight leading-tight mb-3 flex-1">
                {action.label}
              </h4>

              {/* Tags/Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  action.isPrep
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {action.isPrep ? 'PREP' : 'LIVE'}
                </span>
                <span className="text-xs font-medium text-slate-600 bg-white border border-slate-100 px-2 py-0.5 rounded-full">
                  {action.type}
                </span>
              </div>

              {/* Instructions/Notes (Always Visible) */}
              {action.notes && (
                <div className="mb-3 p-2 bg-black/5 rounded-lg text-[11px] md:text-xs text-slate-800 font-medium leading-snug whitespace-pre-wrap break-words border border-black/5">
                  {action.notes}
                </div>
              )}

              {/* Footer: Segment Context */}
              <div className="mt-auto pt-3 border-t border-black/5 text-xs text-slate-400 font-medium truncate">
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