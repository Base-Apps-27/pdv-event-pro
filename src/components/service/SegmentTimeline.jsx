import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import { getSegmentResponsibleDisplay, getSegmentSecondaryDisplay } from "@/components/utils/segmentTypeDisplay";
import { Clock, Languages } from "lucide-react";

/**
 * SegmentTimeline — TV-optimized program column for PublicCountdownDisplay
 *
 * Displays a continuous day of segments with enriched metadata:
 * - Speaker/presenter with role-aware labels (Leader, Preacher, etc.)
 * - Message/plenaria title
 * - Translator indicator
 * - Visual break dividers for major breaks (Receso, Almuerzo) without hiding them
 */
export default function SegmentTimeline({ 
  segments = [], 
  getTimeDate, 
  className = "" 
}) {
  const { language, t } = useLanguage();

  if (!segments || segments.length === 0) return null;

  // Detect break types for visual dividers
  const isBreakType = (seg) => {
    const type = (seg.segment_type || seg.type || '').toLowerCase();
    return ['receso', 'almuerzo', 'break'].includes(type) || seg.major_break;
  };

  return (
    <div className={`flex flex-col h-full bg-white/50 backdrop-blur-sm rounded-xl border border-white/40 shadow-sm overflow-hidden light text-slate-900 ${className}`}>
      {/* Header */}
      <div className="bg-slate-800/5 p-2 border-b border-slate-200/50 flex items-center gap-2">
        <Clock className="w-3 h-3 text-slate-500" />
        <h3 className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
          {t('live.upNext') || 'COMING UP'}
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {segments.map((segment, index) => {
          const startTime = getTimeDate(segment.start_time || segment.actual_start_time);
          const timeStr = startTime 
            ? formatTimeToEST(startTime.toTimeString().substring(0, 5)) 
            : "--:--";

          const isFirst = index === 0;
          const isBreak = isBreakType(segment);

          // Rich metadata from canonical display config
          const responsible = getSegmentResponsibleDisplay(segment, language);
          const secondary = getSegmentSecondaryDisplay(segment, language);

          // Translator
          const translator = segment.translator || segment.translator_name || '';

          // Break divider: visual separator, not a full card
          if (isBreak) {
            return (
              <div key={segment.id || index} className="flex items-center gap-2 py-1 px-1">
                <div className="h-px flex-1 bg-slate-300" />
                <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap flex items-center gap-1">
                  <span className="font-mono text-slate-300">{timeStr}</span>
                  <span>{segment.title}</span>
                </div>
                <div className="h-px flex-1 bg-slate-300" />
              </div>
            );
          }
            
          return (
            <div 
              key={segment.id || index}
              className={`
                group flex items-start gap-2 p-2 rounded-xl transition-all
                ${isFirst ? 'bg-white shadow-md border-l-3 border-pdv-teal scale-[1.01]' : 'bg-white/60 border-l-3 border-transparent'}
              `}
            >
              {/* Time */}
              <div className={`
                font-mono font-bold text-xs pt-0.5 min-w-[50px] text-right
                ${isFirst ? 'text-pdv-teal' : 'text-slate-400'}
              `}>
                {timeStr}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`
                  font-bold truncate leading-tight
                  ${isFirst ? 'text-slate-900 text-sm' : 'text-slate-700 text-xs'}
                `}>
                  {segment.title}
                </div>

                {/* Speaker/presenter with role label */}
                {responsible && (
                  <div className={`text-[10px] truncate mt-0.5 ${isFirst ? 'text-slate-600' : 'text-slate-400'}`}>
                    {responsible.label && <span className="font-semibold">{responsible.label}</span>}
                    {responsible.value}
                  </div>
                )}

                {/* Message title (Plenaria) */}
                {secondary && (
                  <div className={`text-[9px] truncate mt-0.5 italic ${isFirst ? 'text-blue-600' : 'text-blue-400'}`}>
                    {secondary.value}
                  </div>
                )}

                {/* Translator badge — purple to match all other surfaces */}
                {translator && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Languages className="w-2.5 h-2.5 text-purple-500" />
                    <span className="text-[8px] font-semibold text-purple-600 uppercase tracking-wide truncate">
                      @ {translator}
                    </span>
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