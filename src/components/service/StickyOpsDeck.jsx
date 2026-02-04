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
 * REFINED VERSION: Compact, Translucent/Blur, Chat-Aware
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
    
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      const date = new Date(y, m - 1, d, h, min, 0, 0);
      return date;
    };

    const activeDateStr = sessionDate || new Date().toISOString().split('T')[0];

    // 1. Process PreSession Actions
    if (preSessionData) {
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

      // Facility Notes (prep item)
      if (preSessionData.facility_notes) {
        // Determine time: Earliest pre-session time OR 60 min before first segment
        let timeStr = [preSessionData.registration_desk_open_time, preSessionData.library_open_time]
          .filter(Boolean)
          .sort()[0];

        // Try to extract time from notes if explicit fields are missing
        if (!timeStr) {
          // Regex for H:MM or HH:MM optionally followed by am/pm/a.m./p.m.
          const timeMatch = preSessionData.facility_notes.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i);
          
          if (timeMatch) {
            let [_, h, m, meridiem] = timeMatch;
            h = parseInt(h);
            m = parseInt(m);
            
            // Convert to 24h if meridiem exists
            if (meridiem) {
              const isPM = meridiem.toLowerCase().includes('p');
              if (isPM && h < 12) h += 12;
              if (!isPM && h === 12) h = 0;
            } else {
              // Heuristic: if no meridiem, and hour is small (1-6) but segments start late (e.g. 19:00), assume PM?
              // For safety/simplicity, we'll assume the text matches the system format (usually 24h or clear context).
              // If vague (e.g. "5:00"), we treat as 5:00 AM unless logic suggests otherwise.
              // Given the constraints, literal interpretation is safest.
            }
            timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }

        if (!timeStr && segments.length > 0 && segments[0].start_time) {
          // Fallback: 60 mins before first segment
          const [h, m] = segments[0].start_time.split(':').map(Number);
          const d = new Date();
          d.setHours(h, m - 60, 0, 0);
          timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        if (timeStr) {
          const noteAction = {
            id: `pre-facility-${timeStr}`,
            time: parseDateTime(activeDateStr, timeStr),
            label: "Facility Prep", // Generic label
            segmentTitle: "Pre-Session",
            type: "facility",
            isPrep: true,
            segmentId: null,
            notes: preSessionData.facility_notes // Full notes content
          };
          if (noteAction.time) actions.push(noteAction);
        }
      }
    }

    // 2. Process Segment Actions
    segments.forEach(seg => {
      if (!seg.start_time) return;
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

    const sorted = actions.sort((a, b) => a.time.getTime() - b.time.getTime());
    const upcoming = sorted.filter(a => a.time.getTime() > now);
    const past = sorted.filter(a => a.time.getTime() <= now).reverse();

    return { upcomingActions: upcoming, pastActions: past };
  }, [segments, preSessionData, sessionDate, currentTime]);

  const activeAction = upcomingActions[0] || pastActions[0];

  // Calculate concurrent actions (same time window) to indicate stacks
  // We check the source list (upcoming or past) for items within the same minute
  // Hook MUST be called unconditionally
  const isPastRef = activeAction ? activeAction.time.getTime() <= currentTime.getTime() : false;
  
  const concurrentCount = useMemo(() => {
    if (!activeAction) return 0;
    const list = isPastRef ? pastActions : upcomingActions;
    return list.filter(a => 
      Math.abs(a.time.getTime() - activeAction.time.getTime()) < 300000 // Within 5 minutes
    ).length;
  }, [activeAction, isPastRef, pastActions, upcomingActions]);

  if (!activeAction) return null;

  const isPast = activeAction.time.getTime() <= currentTime.getTime();
  const diffMs = Math.abs(activeAction.time.getTime() - currentTime.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const isUrgent = !isPast && diffMin < 5;

  const moreCount = Math.max(0, concurrentCount - 1);
  
  return (
    // Fixed container - lifted slightly off bottom for "float" effect
    <div className="fixed bottom-2 left-2 right-2 z-40 print:hidden">
      <div 
        className={`max-w-5xl mx-auto rounded-2xl border shadow-lg overflow-hidden transition-all duration-300 backdrop-blur-md ${
          isUrgent 
            ? 'bg-amber-950/85 border-amber-700/50 text-amber-50' 
            : isPast
              ? 'bg-slate-100/85 border-slate-200/50 text-slate-500'
              : 'bg-white/85 border-gray-200/50 text-gray-900'
        }`}
      >
        
        {/* Main Bar */}
        <div 
          className="flex items-center justify-between cursor-pointer py-2 px-3 pr-16 relative"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Chat overlap protection: padding-right-16 ensures text doesn't go under chat button */}
          
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Compact Countdown Badge */}
            <div className={`flex flex-col items-center justify-center w-11 h-10 rounded-lg shrink-0 ${
              isUrgent ? 'bg-amber-500 text-black shadow-amber-500/20 shadow-lg' : 
              isPast ? 'bg-slate-200/80 text-slate-500' : 'bg-gray-100/80 text-gray-900'
            }`}>
              {isPast ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <span className="text-base font-bold leading-none">{diffMin}</span>
              )}
              <span className="text-[9px] uppercase font-bold opacity-70 leading-none mt-0.5">
                {isPast ? '' : 'min'}
              </span>
            </div>

            {/* Action Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className={`h-4 text-[9px] px-1 rounded-sm border ${
                  isUrgent ? 'border-amber-400/50 text-amber-200' : 
                  isPast ? 'border-slate-300/50 text-slate-400' : 'border-gray-300/50 text-gray-500'
                }`}>
                  {activeAction.isPrep ? 'PREP' : 'CUE'}
                </Badge>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isUrgent ? 'text-amber-300' : 
                  isPast ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  {activeAction.type}
                </span>
                <span className={`text-[10px] tabular-nums ${
                  isUrgent ? 'text-amber-400' : 
                  isPast ? 'text-slate-400' : 'text-gray-400'
                }`}>
                  {formatTimeToEST(activeAction.time.toTimeString().substring(0, 5))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold text-sm truncate ${isPast ? 'line-through decoration-slate-400/50' : ''}`}>
                  {activeAction.label}
                </h4>
                {moreCount > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px] bg-pdv-teal text-white hover:bg-pdv-teal/90 animate-pulse border-none shrink-0">
                    +{moreCount}
                  </Badge>
                )}
                {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50 shrink-0" /> : <ChevronUp className="w-4 h-4 opacity-50 shrink-0" />}
              </div>
            </div>
          </div>

          {/* Action Button - Jump to Segment */}
          {activeAction.segmentId && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
               {/* This is positioned absolutely to the right, but "left" of where the chat bubble usually is */}
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 rounded-full ${
                  isUrgent ? 'hover:bg-white/10 text-white' : 
                  isPast ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-gray-100 text-gray-600'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onScrollToSegment && onScrollToSegment({ id: activeAction.segmentId });
                }}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Expanded List */}
        {isExpanded && (
          <div className={`border-t px-4 py-3 space-y-2 max-h-[40vh] overflow-y-auto ${
            isUrgent ? 'border-white/10 bg-black/20' : 
            isPast ? 'border-slate-200/50 bg-slate-50/50' : 'border-gray-100/50 bg-gray-50/50'
          }`}>
            <p className={`text-[9px] uppercase font-bold tracking-widest mb-1 ${
              isUrgent ? 'text-amber-400' : 'text-gray-400'
            }`}>
              {isPast ? 'Historial Reciente' : 'Siguientes Acciones'}
            </p>
           
            {(isPast ? pastActions.slice(0, 3) : upcomingActions.slice(1, 4)).map((action, idx) => (
              <div key={idx} className={`flex items-center gap-3 text-sm py-1 border-b border-black/5 last:border-0 ${isPast ? 'opacity-60' : ''}`}>
                <span className={`font-mono font-medium text-xs ${
                  isUrgent ? 'text-amber-300' : 'text-gray-500'
                }`}>
                  {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-xs">{action.label}</div>
                  {action.notes && (
                    <div className={`text-[11px] leading-tight mb-0.5 whitespace-pre-wrap ${isUrgent ? 'text-amber-100' : 'text-gray-700 font-medium'}`}>
                      {action.notes}
                    </div>
                  )}
                  <div className={`text-[10px] truncate ${isUrgent ? 'text-amber-200/70' : 'text-gray-500/80'}`}>
                    {action.segmentTitle} • {action.type}
                  </div>
                </div>
              </div>
            ))}
            
            {((isPast && pastActions.length === 0) || (!isPast && upcomingActions.length <= 1)) && (
              <p className="text-[10px] opacity-50 italic py-1">No hay más acciones.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}