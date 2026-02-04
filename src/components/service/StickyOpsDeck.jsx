import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock, AlertCircle, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";

/**
 * StickyOpsDeck
 * 
 * A persistent footer bar that displays the NEXT critical operational action.
 * Aggregates actions from:
 * 1. Segment Actions (Prep/Durante)
 * 2. PreSession Details (Doors Open, etc.)
 * 
 * @param {Array} segments - All program segments
 * @param {Object} preSessionData - Optional PreSessionDetails object
 * @param {string} sessionDate - Date string (YYYY-MM-DD) of the current session
 * @param {Date} currentTime - Current system time
 * @param {Object} serviceData - Optional service data for context
 */
export default function StickyOpsDeck({ 
  segments = [], 
  preSessionData = null, 
  sessionDate = null,
  currentTime,
  onScrollToSegment
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Flatten and sort all actions
  const { upcomingActions, pastActions } = useMemo(() => {
    const actions = [];
    const now = currentTime.getTime();
    
    // Helper: Parse "YYYY-MM-DD" + "HH:MM" into a Date object
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      // Construct date using local browser time components to match `currentTime` (new Date())
      // Note: Month is 0-indexed in JS Date
      const date = new Date(y, m - 1, d, h, min, 0, 0);
      return date;
    };

    // Default to current date string if sessionDate missing (fallback)
    const activeDateStr = sessionDate || new Date().toISOString().split('T')[0];

    // 1. Process PreSession Actions (if any)
    if (preSessionData) {
      // PreSession usually belongs to the session's date
      const addPreAction = (timeStr, label, type = 'facility') => {
        if (!timeStr) return;
        const date = parseDateTime(activeDateStr, timeStr);
        if (!date) return;

        actions.push({
          id: `pre-${label}-${timeStr}`,
          time: date,
          label: label,
          segmentTitle: "Pre-Session",
          type: type,
          isPrep: true,
          segmentId: null
        });
      };

      addPreAction(preSessionData.registration_desk_open_time, "Mesa de Registro Abre", "admin");
      addPreAction(preSessionData.library_open_time, "Librería Abre", "admin");
    }

    // 2. Process Segment Actions
    segments.forEach(seg => {
      if (!seg.start_time) return;
      
      // Use segment's specific date if available (augmented in parent), else session date
      const segDateStr = seg.date || activeDateStr;
      const segStart = parseDateTime(segDateStr, seg.start_time);
      
      if (!segStart) return;

      const duration = seg.duration_min || 0;
      const segEnd = new Date(segStart);
      segEnd.setMinutes(segStart.getMinutes() + duration);

      const segActions = seg.segment_actions || seg.actions || [];
      
      segActions.forEach(action => {
        let actionTime = new Date(segStart);
        const offset = action.offset_min || 0;

        // Calculate absolute time of action
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
              const absDate = parseDateTime(segDateStr, action.absolute_time);
              if (absDate) actionTime = absDate;
            }
            break;
          default:
            return;
        }

        actions.push({
          id: `${seg.id}-${action.label}-${action.timing}`,
          time: actionTime,
          label: action.label,
          segmentTitle: seg.title,
          segmentId: seg.id,
          type: action.department || 'General',
          isPrep: action.timing === 'before_start',
          notes: action.notes
        });
      });
    });

    // 3. Sort and Split
    const sorted = actions.sort((a, b) => a.time.getTime() - b.time.getTime());
    const upcoming = sorted.filter(a => a.time.getTime() > now);
    const past = sorted.filter(a => a.time.getTime() <= now).reverse(); // Most recent past first

    return { upcomingActions: upcoming, pastActions: past };
  }, [segments, preSessionData, sessionDate, currentTime]);

  // Display Logic: 
  // Priority 1: Next upcoming action
  // Priority 2: If none upcoming, show the most recent past action (translucent/completed state)
  const activeAction = upcomingActions[0] || pastActions[0];

  if (!activeAction) return null;

  const isPast = activeAction.time.getTime() <= currentTime.getTime();

  // Calculate countdown / time since
  const diffMs = Math.abs(activeAction.time.getTime() - currentTime.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  
  // Urgency styling
  // Urgent if upcoming and < 5 mins
  const isUrgent = !isPast && diffMin < 5;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 print:hidden">
      <div className={`max-w-6xl mx-auto shadow-2xl rounded-xl border-t border-x overflow-hidden transition-all duration-300 ${
        isUrgent 
          ? 'bg-amber-900 border-amber-700 text-white' 
          : isPast
            ? 'bg-slate-100 border-slate-300 text-slate-500 opacity-90'
            : 'bg-white border-gray-200 text-gray-900'
      }`}>
        
        {/* Main Bar */}
        <div 
          className="p-3 flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Countdown Badge */}
            <div className={`flex flex-col items-center justify-center min-w-[60px] px-2 py-1 rounded-lg ${
              isUrgent ? 'bg-amber-500 text-black' : 
              isPast ? 'bg-slate-200 text-slate-500' : 'bg-gray-100 text-gray-900'
            }`}>
              {isPast ? (
                <CheckCircle2 className="w-5 h-5 mb-0.5" />
              ) : (
                <span className="text-lg font-bold leading-none">{diffMin}</span>
              )}
              <span className="text-[10px] uppercase font-bold opacity-80">
                {isPast ? 'DONE' : 'MIN'}
              </span>
            </div>

            {/* Action Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className={`h-5 text-[10px] px-1.5 ${
                  isUrgent ? 'border-amber-400 text-amber-200' : 
                  isPast ? 'border-slate-300 text-slate-400' : 'border-gray-300 text-gray-500'
                }`}>
                  {activeAction.isPrep ? 'PREP' : 'CUE'}
                </Badge>
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  isUrgent ? 'text-amber-300' : 
                  isPast ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  {activeAction.type}
                </span>
                <span className={`text-xs ${
                  isUrgent ? 'text-amber-400' : 
                  isPast ? 'text-slate-400' : 'text-gray-400'
                }`}>
                  @ {formatTimeToEST(activeAction.time.toTimeString().substring(0, 5))}
                </span>
              </div>
              <h4 className={`font-bold text-base truncate pr-2 ${isPast ? 'line-through decoration-slate-400' : ''}`}>
                {activeAction.label}
              </h4>
              <p className={`text-xs truncate ${
                isUrgent ? 'text-amber-200' : 
                isPast ? 'text-slate-400' : 'text-gray-500'
              }`}>
                {isPast ? 'Completed in: ' : 'in: '} {activeAction.segmentTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            {activeAction.segmentId && (
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${
                  isUrgent ? 'hover:bg-white/10 text-white' : 
                  isPast ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-gray-100 text-gray-600'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onScrollToSegment && onScrollToSegment({ id: activeAction.segmentId });
                }}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>

        {/* Expanded List */}
        {isExpanded && (
          <div className={`border-t px-4 py-3 space-y-3 ${
            isUrgent ? 'border-white/10 bg-black/20' : 
            isPast ? 'border-slate-200 bg-slate-50' : 'border-gray-100 bg-gray-50'
          }`}>
            <div className="flex justify-between items-center mb-2">
               <p className={`text-[10px] uppercase font-bold tracking-widest ${
                isUrgent ? 'text-amber-400' : 'text-gray-400'
              }`}>
                {isPast ? 'Historial Reciente' : 'Próximas Acciones'}
              </p>
            </div>
           
            {/* If looking at past, show previous history. If upcoming, show next. */}
            {(isPast ? pastActions.slice(0, 3) : upcomingActions.slice(1, 4)).map((action, idx) => (
              <div key={idx} className={`flex items-start gap-3 text-sm ${isPast ? 'opacity-60' : ''}`}>
                <span className={`font-mono font-medium ${
                  isUrgent ? 'text-amber-300' : 'text-gray-500'
                }`}>
                  {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{action.label}</div>
                  <div className={`text-xs ${isUrgent ? 'text-amber-200/70' : 'text-gray-500'}`}>
                    {action.segmentTitle} • {action.type}
                  </div>
                </div>
              </div>
            ))}
            
            {((isPast && pastActions.length === 0) || (!isPast && upcomingActions.length <= 1)) && (
              <p className="text-xs opacity-50 italic">No hay más acciones.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}