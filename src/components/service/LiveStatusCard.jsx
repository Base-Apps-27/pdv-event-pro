import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronRight, PlayCircle } from "lucide-react";

export default function LiveStatusCard({ segments, currentTime, onScrollTo }) {
  // Helper to parse "HH:MM" to Date object for today
  const getTimeDate = (timeStr) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(currentTime);
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // Filter out breaks and ensure valid times
  const validSegments = segments.filter(s => 
    s.start_time && 
    (s.type !== 'break' && s.segment_type !== 'break' && s.segment_type !== 'Break')
  ).sort((a, b) => {
    const timeA = getTimeDate(a.start_time);
    const timeB = getTimeDate(b.start_time);
    return timeA - timeB;
  });

  const currentSegment = validSegments.find(s => {
    const start = getTimeDate(s.start_time);
    const end = getTimeDate(s.end_time);
    return start && end && currentTime >= start && currentTime <= end;
  });

  // Next is the first segment starting after now
  const nextSegment = validSegments.find(s => {
    const start = getTimeDate(s.start_time);
    return start && start > currentTime;
  });

  // Calculate times
  const getTimeRemaining = (targetDate) => {
    if (!targetDate) return null;
    const diff = targetDate - currentTime;
    if (diff < 0) return "00:00";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentRemaining = currentSegment ? getTimeRemaining(getTimeDate(currentSegment.end_time)) : null;
  const nextCountdown = nextSegment ? getTimeRemaining(getTimeDate(nextSegment.start_time)) : null;

  if (!currentSegment && !nextSegment) return null;

  return (
    <Card className="mb-6 bg-white border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        
        {/* Current Segment Section */}
        {currentSegment ? (
          <div 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
            onClick={() => onScrollTo && onScrollTo(currentSegment)}
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="bg-red-500 hover:bg-red-600 animate-pulse flex items-center gap-1">
                <PlayCircle className="w-3 h-3" /> EN CURSO
              </Badge>
              <span className="text-xs font-mono text-red-600 font-bold">{currentRemaining} restantes</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-pdv-teal transition-colors line-clamp-1">
              {currentSegment.title || currentSegment.data?.title}
            </h3>
            {currentSegment.presenter && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{currentSegment.presenter}</p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 flex items-center justify-center text-gray-400">
            <span className="italic text-sm">Nada en curso en este momento</span>
          </div>
        )}

        {/* Next Segment Section */}
        {nextSegment ? (
          <div 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group relative"
            onClick={() => onScrollTo && onScrollTo(nextSegment)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Continuación</span>
              <div className="flex items-center gap-1 text-pdv-teal font-mono font-bold bg-teal-50 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                {nextCountdown}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-pdv-teal transition-colors line-clamp-1">
                  {nextSegment.title || nextSegment.data?.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {nextSegment.start_time ? 
                    new Date(`2000-01-01T${nextSegment.start_time}`).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) : 
                    ''}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-pdv-teal group-hover:translate-x-1 transition-all" />
            </div>
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