import React, { useMemo } from "react";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { AlertCircle, Clock } from "lucide-react";

/**
 * CoordinatorActionsDisplay
 * 
 * TV-optimized display of upcoming coordinator actions.
 * Shows DURANTE actions from current segment + PREP actions from next segment.
 * Also shows pre-session actions (registration, library, facility, general notes)
 * matching the same data contract as StickyOpsDeck.
 * Sorted by time, highlighted by urgency.
 */
export default function CoordinatorActionsDisplay({
  currentSegment,
  nextSegment,
  allSegments = [],       // All session segments — used for look-ahead window + pre-session fallbacks
  preSessionData = null,  // PreSessionDetails for the active session
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

    const activeDateStr = serviceDate || new Date().toISOString().split('T')[0];

    // ── 1. Process PreSession Actions (mirrors StickyOpsDeck logic) ──
    if (preSessionData) {
      const addPreAction = (timeStr, label, type = 'facility') => {
        if (!timeStr) return;
        const date = parseDateTime(activeDateStr, timeStr);
        if (!date) return;
        actions.push({
          id: `pre-${label}-${timeStr}`,
          time: date,
          label,
          segmentTitle: "Pre-Session",
          type,
          isPrep: false,
          isPreSession: true,
          isNext: false,
          notes: null
        });
      };

      addPreAction(preSessionData.registration_desk_open_time, "Mesa de Registro Abre", "admin");
      addPreAction(preSessionData.library_open_time, "Librería Abre", "admin");

      // Facility Notes
      if (preSessionData.facility_notes) {
        let timeStr = [preSessionData.registration_desk_open_time, preSessionData.library_open_time]
          .filter(Boolean).sort()[0];

        if (!timeStr) {
          const timeMatch = preSessionData.facility_notes.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i);
          if (timeMatch) {
            let [_, h, m, meridiem] = timeMatch;
            h = parseInt(h); m = parseInt(m);
            if (meridiem) {
              const isPM = meridiem.toLowerCase().includes('p');
              if (isPM && h < 12) h += 12;
              if (!isPM && h === 12) h = 0;
            }
            timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }

        const firstSeg = allSegments.find(s => s.start_time) || currentSegment || nextSegment;
        if (!timeStr && firstSeg?.start_time) {
          const [h, m] = firstSeg.start_time.split(':').map(Number);
          const d = new Date(); d.setHours(h, m - 60, 0, 0);
          timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        if (timeStr) {
          const noteTime = parseDateTime(activeDateStr, timeStr);
          if (noteTime) actions.push({
            id: `pre-facility-${timeStr}`,
            time: noteTime,
            label: "Facility Prep",
            segmentTitle: "Pre-Session",
            type: "facility",
            isPrep: false,
            isPreSession: true,
            isNext: false,
            notes: preSessionData.facility_notes
          });
        }
      }

      // General Notes — show actual note text as label (mirrors StickyOpsDeck 2026-03-01)
      if (preSessionData.general_notes) {
        let timeStr = [preSessionData.registration_desk_open_time, preSessionData.library_open_time]
          .filter(Boolean).sort()[0];

        const firstSeg = allSegments.find(s => s.start_time) || currentSegment || nextSegment;
        if (!timeStr && firstSeg?.start_time) {
          const [h, m] = firstSeg.start_time.split(':').map(Number);
          const d = new Date(); d.setHours(h, m - 30, 0, 0);
          timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        if (timeStr) {
          const noteTime = parseDateTime(activeDateStr, timeStr);
          if (noteTime) actions.push({
            id: `pre-general-notes-${timeStr}`,
            time: noteTime,
            label: preSessionData.general_notes.length > 80
              ? preSessionData.general_notes.substring(0, 80) + '…'
              : preSessionData.general_notes,
            segmentTitle: "Pre-Session",
            type: "Coordinador",
            isPrep: true,
            isPreSession: true,
            isNext: false,
            notes: preSessionData.general_notes.length > 80 ? preSessionData.general_notes : null
          });
        }
      }
    }

    // ── 2. Process Segment Actions ──
    // LOOK-AHEAD WINDOW (2026-03-01): Instead of only current+next segment,
    // process ALL remaining session segments so upcoming actions continuously
    // scroll into the display slots as earlier actions expire. The display
    // cap (4 slots) remains — this just widens the data pipeline.
    const processSegment = (segment) => {
      const effectiveStart = segment?.actual_start_time || segment?.start_time;
      if (!segment || !effectiveStart) return;

      const segStart = parseDateTime(activeDateStr, effectiveStart);
      if (!segStart) return;

      const effectiveEnd = segment.actual_end_time || segment.end_time;
      let segEnd;
      if (effectiveEnd) {
        segEnd = parseDateTime(activeDateStr, effectiveEnd);
      }
      if (!segEnd) {
        segEnd = new Date(segStart);
        segEnd.setMinutes(segEnd.getMinutes() + (segment.duration_min || 0));
      }

      const segActions = segment.segment_actions || segment.actions || [];

      segActions.forEach(action => {
        let actionTime = new Date(segStart);
        const offset = action.offset_min || 0;
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
              const absDate = parseDateTime(activeDateStr, action.absolute_time);
              if (absDate) actionTime = absDate;
            }
            break;
          default:
            actionTime.setMinutes(segStart.getMinutes() + offset);
            break;
        }

        const isPrep = timing === 'before_start';

        // Only include actions that haven't expired (allow 1min grace for "NOW" display)
        if (actionTime.getTime() >= now - 60000) {
          actions.push({
            id: `${segment.id}-${action.label}-${action.timing}-${actionTime.getTime()}`,
            time: actionTime,
            label: action.label,
            segmentTitle: segment.title,
            segmentId: segment.id,
            type: action.department || 'General',
            isPrep,
            isPreSession: false,
            isNext: false, // No longer needed — actions self-sort by time
            notes: action.notes
          });
        }
      });
    };

    // Process every segment in the session (allSegments), not just current+next.
    // Skipped segments are excluded. Past-time filter above handles expiration.
    const segsToProcess = allSegments.length > 0 ? allSegments : [currentSegment, nextSegment].filter(Boolean);
    segsToProcess.forEach(seg => {
      if (seg?.live_status === 'skipped') return;
      processSegment(seg);
    });

    // Sort by time, filter out expired pre-session actions
    return actions
      .filter(a => a.isPreSession ? a.time.getTime() >= now - 60000 : true)
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [currentSegment, nextSegment, allSegments, preSessionData, currentTime, serviceDate]);

  if (upcomingActions.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm overflow-hidden">
      
      {/* Compact Header - matches Room Program style */}
      <div className="bg-slate-100/80 px-2 py-1 border-b border-slate-200 flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {language === 'es' ? 'Acciones' : 'Actions'}
        </div>
      </div>

      {/* Hero + Grid Layout: First action prominent, rest compact below */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-1.5">
        {upcomingActions.length > 0 && (() => {
          const heroAction = upcomingActions[0];
          const secondaryActions = upcomingActions.slice(1, 5); // Show up to 4 more (5 total)
          
          // Clustering logic: detect which secondary actions are within ±2 min of hero
          const heroTime = heroAction.time.getTime();
          const clusterWindow = 2 * 60 * 1000; // 2 minutes in ms
          const clusteredSecondaryIds = secondaryActions
            .filter(a => Math.abs(a.time.getTime() - heroTime) <= clusterWindow)
            .map(a => a.id);
          
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
                    className={`flex items-start gap-2 p-1.5 rounded-lg border ${
                      isUrgent
                        ? 'bg-amber-50 border-amber-400 shadow-sm'
                        : 'bg-gradient-to-br from-white to-slate-50 border-pdv-teal/40 shadow-sm'
                    }`}
                  >
                    {/* Time Block */}
                    <div className="flex flex-col items-center min-w-[45px] flex-shrink-0">
                      <div className={`text-xl font-black font-mono leading-none tracking-tight ${
                        isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                      }`}>
                        {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                        {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1 mb-0.5">
                        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight leading-tight">
                          {action.label}
                        </h4>
                        {isUrgent && <AlertCircle className="w-3 h-3 text-amber-600 animate-pulse flex-shrink-0" />}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[8px] mb-0.5">
                        <span className={`font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[7px] ${
                          action.isPreSession
                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                            : action.isPrep
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {action.isPreSession ? 'PRE' : action.isPrep ? t('live.preparation') : t('live.during')}
                        </span>
                        <span className="text-slate-600 font-medium">{action.type}</span>
                      </div>

                      {action.notes && (
                        <div className="p-1 bg-white/80 rounded text-[8px] text-slate-700 leading-tight border border-slate-200 mt-0.5">
                          {action.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* SECONDARY ACTIONS — Compact grid (2 columns max for TV display) */}
              {secondaryActions.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {secondaryActions.map((action) => {
                    const now = currentTime.getTime();
                    const timeUntil = action.time.getTime() - now;
                    const minutesUntil = Math.ceil(timeUntil / 60000);
                    const isUrgent = timeUntil > 0 && timeUntil < 5 * 60000;
                    const isClusteredWithHero = clusteredSecondaryIds.includes(action.id);

                    return (
                      <div
                        key={action.id}
                        className={`relative flex flex-col p-1.5 rounded ${
                          isUrgent
                            ? 'bg-amber-50 border-2 border-amber-400 shadow-amber-200/50'
                            : isClusteredWithHero
                            ? 'bg-slate-50 border-2 border-pdv-teal/60'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        {/* Cluster badge - shows when grouped with hero */}
                        {isClusteredWithHero && !isUrgent && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pdv-teal border border-white animate-pulse" />
                        )}
                        
                        {/* Time + Alert */}
                        <div className="flex items-center justify-between mb-0.5">
                          <div className={`text-base font-black font-mono leading-none ${
                            isUrgent ? 'text-amber-600' : 'text-pdv-teal'
                          }`}>
                            {minutesUntil > 0 ? `${minutesUntil}m` : 'NOW'}
                          </div>
                          {isUrgent && <AlertCircle className="w-2.5 h-2.5 text-amber-600 animate-pulse" />}
                        </div>

                        {/* Label */}
                        <h4 className="text-[9px] font-bold text-slate-900 uppercase leading-tight mb-0.5 line-clamp-2">
                          {action.label}
                        </h4>

                        {/* Meta */}
                        <div className="flex items-center gap-1 text-[7px]">
                          <span className={`font-bold uppercase px-1 py-0.5 rounded ${
                            action.isPreSession ? 'bg-slate-200 text-slate-700'
                            : action.isPrep ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {action.isPreSession ? 'PRE' : action.isPrep ? 'PREP' : 'LIVE'}
                          </span>
                          <span className="text-slate-500 truncate">{action.type}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Overflow indicator */}
              {upcomingActions.length > 5 && (
                <div className="text-center py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  +{upcomingActions.length - 5} more in app
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}