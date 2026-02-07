import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import { Clock } from "lucide-react";

export default function SegmentTimeline({ 
  segments = [], 
  getTimeDate, 
  className = "" 
}) {
  const { t } = useLanguage();

  if (!segments || segments.length === 0) return null;

  return (
    <div className={`flex flex-col h-full bg-white/50 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-800/5 p-3 border-b border-slate-200/50 flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <h3 className="font-bold text-slate-600 uppercase tracking-wider text-xs">
          {t('live.upNext') || 'COMING UP'}
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {segments.map((segment, index) => {
          const startTime = getTimeDate(segment.start_time);
          const timeStr = startTime 
            ? formatTimeToEST(startTime.toTimeString().substring(0, 5)) 
            : "--:--";
            
          return (
            <div 
              key={segment.id || index}
              className={`
                group flex items-center gap-3 p-3 rounded-xl transition-all
                ${index === 0 ? 'bg-white shadow-md border-l-4 border-pdv-teal scale-[1.01]' : 'bg-white/60 hover:bg-white border-l-4 border-transparent hover:border-slate-300'}
              `}
            >
              {/* Time */}
              <div className={`
                font-mono font-bold text-base
                ${index === 0 ? 'text-pdv-teal' : 'text-slate-400'}
              `}>
                {timeStr}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`
                  font-bold truncate leading-tight
                  ${index === 0 ? 'text-slate-900 text-lg' : 'text-slate-600 text-base'}
                `}>
                  {segment.title}
                </div>
                {segment.presenter && (
                  <div className="text-sm text-slate-400 truncate mt-0.5">
                    {segment.presenter}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}