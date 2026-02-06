import React, { useMemo } from "react";
import { useLanguage } from "@/components/utils/i18n";
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
    <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl border-2 border-pdv-teal/50 p-6 md:p-8">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/20">
        <Clock className="w-6 h-6 md:w-8 md:h-8 text-pdv-yellow flex-shrink-0" />
        <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wide">
          {t('live.coordination')}
        </h3>
      </div>

      {/* Actions List */}
      <div className="space-y-3 md:space-y-4">
        {upcomingActions.map((action, idx) => {
          const now = currentTime.getTime();
          const timeUntil = action.time.getTime() - now;
          const minutesUntil = Math.ceil(timeUntil / 60000);
          const isUrgent = timeUntil > 0 && timeUntil < 5 * 60000; // < 5 min

          return (
            <div
              key={action.id}
              className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                isUrgent
                  ? 'bg-amber-500/20 border border-amber-500/50'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              {/* Time Indicator */}
              <div className="flex-shrink-0 text-center">
                <div className={`text-xl md:text-2xl font-black font-mono ${
                  isUrgent ? 'text-amber-400' : 'text-pdv-yellow'
                }`}>
                  {minutesUntil > 0 ? `${minutesUntil}min` : 'NOW'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {action.time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Action Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-2">
                  {isUrgent && <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg md:text-xl font-bold text-white uppercase tracking-wide">
                      {action.label}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs md:text-sm font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        action.isPrep
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                          : 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                      }`}>
                        {action.isPrep ? t('live.preparation') : t('live.during')}
                      </span>
                      <span className="text-xs md:text-sm text-gray-300">
                        {action.type}
                      </span>
                      {action.isNext && (
                        <span className="text-xs md:text-sm text-pdv-lime font-semibold">
                          {t('live.upNext')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {action.notes && (
                  <p className="text-sm md:text-base text-gray-300 ml-7 mt-2 whitespace-pre-wrap">
                    {action.notes}
                  </p>
                )}
                
                <div className="text-xs text-gray-500 ml-7 mt-2">
                  {action.segmentTitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}