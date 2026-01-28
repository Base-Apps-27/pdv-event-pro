import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";

export default function LiveStatusCard({ segments, currentTime, onScrollTo, liveAdjustmentEnabled, serviceDate }) {
  const { t } = useLanguage();
  // Helper to parse "HH:MM" to Date object
  const getTimeDate = (timeStr, segmentDate) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    
    const date = new Date(currentTime);
    
    // Priority: 1. segmentDate (specific to segment)
    //           2. serviceDate (global override for component)
    //           3. currentTime (today - fallback)
    const targetDateStr = segmentDate || serviceDate;
    
    if (targetDateStr) {
      // Parse YYYY-MM-DD
      // Note: We use local parts to ensure we match the user's local timezone assumption
      const [y, m, d] = targetDateStr.split('-').map(Number);
      date.setFullYear(y);
      date.setMonth(m - 1);
      date.setDate(d);
    }
    
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // Determine effective times based on liveAdjustmentEnabled flag
  const getEffectiveSegment = (s) => {
    if (liveAdjustmentEnabled && s.is_live_adjusted) {
      return {
        ...s,
        start_time: s.actual_start_time || s.start_time,
        end_time: s.actual_end_time || s.end_time
      };
    }
    return s;
  };

  // Filter out breaks and ensure valid times
  const validSegments = segments.map(getEffectiveSegment).filter(s => 
    s.start_time && 
    (s.type !== 'break' && s.segment_type !== 'break' && s.segment_type !== 'Break')
  ).sort((a, b) => {
    const timeA = getTimeDate(a.start_time, a.date);
    const timeB = getTimeDate(b.start_time, b.date);
    return timeA - timeB;
  });

  // Check if the service/event is happening today
  const isToday = (() => {
    if (!serviceDate) return true; // If no date provided, assume it's live
    const [y, m, d] = serviceDate.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    return targetDate.getTime() === today.getTime();
  })();

  // Only show current/next if it's happening today
  const currentSegment = isToday ? validSegments.find(s => {
    const start = getTimeDate(s.start_time, s.date);
    const end = getTimeDate(s.end_time, s.date);
    return start && end && currentTime >= start && currentTime <= end;
  }) : null;

  // Next is the first segment starting after now
  const nextSegment = isToday ? validSegments.find(s => {
    const start = getTimeDate(s.start_time, s.date);
    return start && start > currentTime;
  }) : null;

  // New: compute countdown ONLY to the FIRST segment start (pre-launch countdown)
  const upNextCountdown = (() => {
    if (!isToday || validSegments.length === 0) return null;
    // validSegments sorted by start time; take the first of the day (effective times)
    const first = validSegments[0];
    const startAt = getTimeDate(first.start_time, first.date);
    if (!startAt || currentTime >= startAt) return null; // Do not persist after start
    const hms = getTimeRemainingHMS(startAt);
    if (!hms) return null;
    return { hms, startAt, segment: first };
  })();

  // Calculate times
  const getTimeRemaining = (targetDate) => {
    if (!targetDate) return null;
    const diff = targetDate - currentTime;
    if (diff < 0) return "00:00";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    
    // If more than 24 hours, don't show countdown
    if (mins > 1440) return null;
    
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Added: detailed countdown in H:MM:SS for upcoming start times (same-day only)
  // Hoisted function declaration to avoid TDZ when referenced above
  function getTimeRemainingHMS(targetDate) {
    if (!targetDate) return null;
    const diff = targetDate - currentTime;
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2,'0')}`;
  }

  // Helper: check same calendar day in local time
  const isSameDay = (a, b) => {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const currentEnd = currentSegment ? getTimeDate(currentSegment.end_time, currentSegment.date) : null;
  const currentRemaining = currentEnd ? getTimeRemaining(currentEnd) : null;

  // Helper to get the primary person for display
  const getPersonName = (segment) => {
    if (!segment) return null;
    const data = segment.data || {};
    // Check canonical data fields first, then root fields
    return data.leader || segment.leader || 
           data.preacher || segment.preacher || 
           data.presenter || segment.presenter;
  };

  if (!currentSegment && !nextSegment) return null;

  return (
    <Card className="mb-6 bg-white border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        
        {/* Current Segment Section */}
        {currentSegment ? (
          <div 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group flex flex-col justify-between h-full"
            onClick={() => onScrollTo && onScrollTo(currentSegment)}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="bg-red-500 hover:bg-red-600 animate-pulse flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" /> {t('live.inProgress')}
                </Badge>
                {currentRemaining && (
                  <span className="text-xs font-mono text-red-600 font-bold">{currentRemaining} restantes</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-pdv-teal transition-colors line-clamp-2">
                {currentSegment.title || currentSegment.data?.title}
              </h3>
            </div>
            {getPersonName(currentSegment) && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-1">{getPersonName(currentSegment)}</p>
            )}
          </div>
        ) : (
          upNextCountdown ? (
            <div className="p-4 bg-gradient-to-r from-pdv-teal/10 to-pdv-green/10 border-2 border-pdv-teal/30 rounded-lg w-full">
              <div className="flex items-center justify-between">
                <div className="font-mono font-extrabold text-pdv-teal text-2xl md:text-3xl leading-none">
                  T–{upNextCountdown.hms}
                </div>
                <Badge variant="outline" className="bg-white text-gray-700 border-gray-300 font-mono font-bold">
                  {upNextCountdown.segment?.start_time ? formatTimeToEST(upNextCountdown.segment.start_time) : ''}
                </Badge>
              </div>
              {(upNextCountdown.segment?.title || upNextCountdown.segment?.data?.title) && (
                <div className="text-sm text-gray-600 mt-1 line-clamp-1">
                  {upNextCountdown.segment.title || upNextCountdown.segment.data?.title}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 flex items-center justify-center text-gray-400">
              <span className="italic text-sm">Nada en curso en este momento</span>
            </div>
          )
        )}

        {/* Next Segment Section */}
        {nextSegment ? (
          <div 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group flex flex-col justify-between h-full relative"
            onClick={() => onScrollTo && onScrollTo(nextSegment)}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Continuación</span>
                <div className="flex items-center gap-2">
                  {upNextCountdown && (
                    <Badge variant="default" className="bg-pdv-teal text-white font-mono font-bold">
                      T–{upNextCountdown.hms}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 font-mono font-bold">
                    {nextSegment.start_time ? formatTimeToEST(nextSegment.start_time) : ''}
                  </Badge>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-pdv-teal transition-colors line-clamp-2">
                  {nextSegment.title || nextSegment.data?.title}
                </h3>
                {nextSegment.is_live_adjusted && liveAdjustmentEnabled && (
                  <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600 text-[10px]">
                    ADJUSTED
                  </Badge>
                )}
              </div>
            </div>
            {getPersonName(nextSegment) && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-1">{getPersonName(nextSegment)}</p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 flex items-center justify-center text-gray-400">
            <span className="italic text-sm">Fin del programa</span>
          </div>
        )}
      </div>
    </Card>
  );
}