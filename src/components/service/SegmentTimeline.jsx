import React, { useMemo } from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import { getSegmentResponsibleDisplay, getSegmentSecondaryDisplay } from "@/components/utils/segmentTypeDisplay";
import { Clock, Languages, Sparkles } from "lucide-react";
import { normalizeName } from "@/components/utils/textNormalization";

/**
 * SegmentTimeline — TV-optimized program column for PublicCountdownDisplay
 *
 * Displays a continuous day of segments with enriched metadata:
 * - Speaker/presenter with role-aware labels (Leader, Preacher, etc.)
 * - Message/plenaria title
 * - Sub-assignments inline (e.g. Ministración within Alabanza)
 * - Translator indicator
 * - Visual break dividers for major breaks (Receso, Almuerzo) without hiding them
 *
 * Consumes whatever the Service editor provides — any future segment
 * combination is accepted without TV-side filtering.
 */
export default function SegmentTimeline({
  segments = [],
  sessions = [],
  getTimeDate,
  className = ""
}) {
  const { language, t } = useLanguage();

  // Build session id → name map for divider labels
  const sessionMap = React.useMemo(() => {
    const m = {};
    sessions.forEach(s => { if (s.id) m[s.id] = s.name; });
    return m;
  }, [sessions]);

  if (!segments || segments.length === 0) return null;

  // Detect break types for visual dividers
  const isBreakType = (seg) => {
    const type = (seg.segment_type || seg.type || '').toLowerCase();
    return ['receso', 'almuerzo', 'break'].includes(type) || seg.major_break;
  };

  // Resolve sub-assignments from either entity path or JSON path.
  // Entity path: _resolved_sub_assignments (resolved by refreshActiveProgram)
  // JSON path: sub_assignments / ui_sub_assignments with person_field_name pointing into segment.data
  const getSubAssignments = (segment) => {
    // Entity-sourced: already resolved with presenter names
    if (segment._resolved_sub_assignments && segment._resolved_sub_assignments.length > 0) {
      return segment._resolved_sub_assignments.filter(sub => sub.presenter);
    }
    // JSON/normalized: resolve person from data sub-object
    const subs = segment.sub_assignments || segment.ui_sub_assignments || [];
    if (subs.length === 0) return [];
    return subs.map(sub => ({
      label: sub.label || sub.title || 'Sub-assignment',
      presenter: sub.presenter
        || (sub.person_field_name ? (segment.data?.[sub.person_field_name] || segment[sub.person_field_name] || '') : ''),
      duration_min: sub.duration_min || sub.duration || 5,
    })).filter(sub => sub.presenter);
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden light text-slate-900 ${className}`}>
      {/* List - no internal header, parent handles it */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {segments.map((segment, index) => {
          // DECISION-004: Pass segment.date so multi-day events resolve correct day
          const startTime = getTimeDate(segment.start_time || segment.actual_start_time, segment.date);
          const timeStr = startTime
            ? formatTimeToEST(startTime.toTimeString().substring(0, 5))
            : "--:--";

          const isFirst = index === 0;
          const isBreak = isBreakType(segment);

          // Session change divider: show when session_id changes between consecutive segments
          const prevSegment = index > 0 ? segments[index - 1] : null;
          const sessionChanged = prevSegment && segment.session_id && prevSegment.session_id &&
            segment.session_id !== prevSegment.session_id;
          const sessionName = sessionChanged ? (sessionMap[segment.session_id] || null) : null;

          // Rich metadata from canonical display config
          const responsible = getSegmentResponsibleDisplay(segment, language);
          const secondary = getSegmentSecondaryDisplay(segment, language);

          // Translator
          const translator = segment.translator || segment.translator_name || '';

          // Sub-assignments (e.g. Ministración within Alabanza)
          const subAssignments = getSubAssignments(segment);

          // Session change divider: bold visual break between sessions
          const sessionDivider = sessionChanged ? (
            <div key={`session-div-${index}`} className="flex items-center gap-2 py-1.5 px-1 mt-1">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#1F8A70] to-transparent" />
              <div className="text-[8px] font-black uppercase tracking-widest text-[#1F8A70] whitespace-nowrap bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                {sessionName || '── SESIÓN ──'}
              </div>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#1F8A70] to-transparent" />
            </div>
          ) : null;

          const cardContent = isBreak ? (
            <div className="flex items-center gap-2 py-1 px-1">
              <div className="h-px flex-1 bg-slate-300" />
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap flex items-center gap-1">
                <span className="font-mono text-slate-300">{timeStr}</span>
                <span>{segment.title}</span>
              </div>
              <div className="h-px flex-1 bg-slate-300" />
            </div>
          ) : (
            <div
              className={`group flex items-start gap-2 p-2 rounded-xl transition-all ${
                isFirst ? 'bg-white shadow-md border-l-3 border-pdv-teal scale-[1.01]' : 'bg-white/60 border-l-3 border-transparent'
              }`}
            >
              <div className={`font-mono font-bold text-xs pt-0.5 min-w-[50px] text-right ${isFirst ? 'text-pdv-teal' : 'text-slate-400'}`}>
                {timeStr}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold truncate leading-tight ${isFirst ? 'text-slate-900 text-sm' : 'text-slate-700 text-xs'}`}>
                  {segment.title}
                </div>
                {responsible && (
                  <div className={`text-[10px] truncate mt-0.5 ${isFirst ? 'text-slate-900 font-bold' : 'text-slate-700 font-semibold'}`}>
                    {responsible.label && <span className="font-semibold">{responsible.label}</span>}
                    {responsible.value}
                  </div>
                )}
                {secondary && (
                  <div className={`text-[9px] truncate mt-0.5 italic ${isFirst ? 'text-blue-600' : 'text-blue-400'}`}>
                    {secondary.value}
                  </div>
                )}
                {subAssignments.length > 0 && subAssignments.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-1 mt-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
                    <span className={`text-[9px] truncate ${isFirst ? 'text-purple-600' : 'text-purple-400'}`}>
                      <span className="font-semibold">{sub.label}:</span> {normalizeName(sub.presenter)}
                    </span>
                  </div>
                ))}
                {translator && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Languages className="w-2.5 h-2.5 text-blue-500" />
                    <span className="text-[8px] font-semibold text-blue-600 uppercase tracking-wide truncate">
                      @ {translator}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <React.Fragment key={segment.id || index}>
              {sessionDivider}
              {cardContent}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}