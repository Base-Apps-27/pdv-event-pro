import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock, AlertCircle, CheckCircle2, ArrowRight, RotateCcw, MessageCircle } from "lucide-react";
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
  onScrollToSegment,
  // Chat integration props
  onToggleChat,
  chatUnreadCount = 0,
  chatOpen = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Flatten and sort all actions
  const { upcomingActions, pastActions, isServiceDay } = useMemo(() => {
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
    
    // DATE AWARENESS: Determine if today is the service day.
    // The deck still renders on non-service days (preview mode) but countdowns are frozen.
    const todayStr = new Date().toISOString().split('T')[0];
    const isServiceDayLocal = !sessionDate || sessionDate === todayStr;

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

    return { upcomingActions: upcoming, pastActions: past, isServiceDay: isServiceDayLocal };
  }, [segments, preSessionData, sessionDate, currentTime]);

  // On non-service days: show the FIRST action as a static preview (no countdown)
  // On service day: live countdown with service-over guard
  const allActionsSorted = useMemo(() => {
    return [...upcomingActions, ...pastActions.slice().reverse()].sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [upcomingActions, pastActions]);

  const activeAction = isServiceDay
    ? (upcomingActions[0] || pastActions[0])
    : allActionsSorted[0]; // Preview: show first chronological action
  
  // SERVICE OVER GUARD: Only applies on service day
  if (isServiceDay && upcomingActions.length === 0 && pastActions.length > 0) {
    const lastActionTime = pastActions[0].time.getTime();
    const minutesSinceLast = (currentTime.getTime() - lastActionTime) / 60000;
    if (minutesSinceLast > 30) return null;
  }

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

  // On non-service days, force "preview" mode — no live countdown, no urgent styling
  const isPast = isServiceDay ? activeAction.time.getTime() <= currentTime.getTime() : false;
  const diffMs = isServiceDay ? Math.abs(activeAction.time.getTime() - currentTime.getTime()) : 0;
  const diffMin = isServiceDay ? Math.floor(diffMs / 60000) : 0;
  const isUrgent = isServiceDay && !isPast && diffMin < 5;

  const moreCount = Math.max(0, concurrentCount - 1);
  
  // Glass Control Deck: Neutral/Light theme per user request
  // Floating with shadow and rim
  const bgClass = 'bg-white/90 backdrop-blur-xl';
  const textClass = 'text-gray-900';

  return (
    // Floating container (bottom-6 instead of bottom-0)
    // Pointer-events-none on outer to allow clicks through margins
    <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-40 print:hidden flex flex-col justify-end items-center pointer-events-none transition-all duration-300">
      
      {/* Wrapper for the deck (Auto height based on content) */}
      <div className="w-full relative pointer-events-auto">
        
        {/* Label Shelf - Attached to top */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`absolute -top-6 left-4 px-3 py-1 rounded-t-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center gap-1.5 z-0 ${
            isUrgent 
              ? 'bg-amber-500 text-black shadow-lg' 
              : 'bg-white/90 backdrop-blur-md text-gray-500 border-t border-x border-gray-200 shadow-sm'
          }`}
          style={{ height: '24px' }}
        >
          <span>Acciones de Coord</span>
        </div>

        {/* Main Content Box - Floating, Rounded, Shadowed */}
        <div 
          className={`w-full shadow-2xl rounded-2xl border border-white/40 ring-1 ring-black/5 overflow-hidden transition-all duration-300 relative z-10 flex flex-col ${bgClass} ${textClass}`}
        >
          
          {/* Expanded List - Rendered FIRST so it pushes the bar up if we were using flex-col-reverse,
              BUT since we are top-down flow inside a bottom-anchored container, 
              we want the LIST on TOP of the BAR visually.
          */}
          
          {isExpanded && (
            <div className={`border-b border-gray-100 px-4 py-3 space-y-2 max-h-[40vh] overflow-y-auto bg-white/50`}>
              <p className="text-[9px] uppercase font-bold tracking-widest mb-2 text-gray-400">
                {isPast ? 'Historial Reciente' : 'Siguientes Acciones'}
              </p>
            
              {(isPast ? pastActions.slice(0, 3) : upcomingActions.slice(1, 4)).map((action, idx) => (
                <div key={idx} className={`flex items-center gap-3 text-sm py-2 border-b border-gray-100/50 last:border-0 ${isPast ? 'opacity-50' : ''}`}>
                  <span className="font-mono font-medium text-xs text-gray-400">
                    {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-xs text-gray-700">{action.label}</div>
                    {action.notes && (
                      <div className={`text-[11px] leading-tight mt-0.5 whitespace-pre-wrap ${isUrgent ? 'text-amber-600' : 'text-gray-500'}`}>
                        {action.notes}
                      </div>
                    )}
                    <div className="text-[10px] truncate text-gray-400 mt-0.5">
                      {action.segmentTitle} • {action.type}
                    </div>
                  </div>
                </div>
              ))}
              
              {((isPast && pastActions.length === 0) || (!isPast && upcomingActions.length <= 1)) && (
                <p className="text-[10px] opacity-30 italic py-1 text-gray-400">No hay más acciones.</p>
              )}
            </div>
          )}

          {/* Main Bar - Always at the bottom of the stack */}
          <div 
            className="flex items-center justify-between py-2 px-3 sm:px-4 relative"
          >
            {/* Left Side: Countdown + Info */}
            <div 
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {/* Compact Countdown Badge */}
              <div className={`flex flex-col items-center justify-center w-11 h-10 rounded-lg shrink-0 ${
                isUrgent ? 'bg-amber-500 text-black shadow-lg animate-pulse' : 
                isPast ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-pdv-teal'
              }`}>
                {!isServiceDay ? (
                  <Clock className="w-5 h-5 opacity-60" />
                ) : isPast ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-base font-bold leading-none">{diffMin}</span>
                )}
                <span className="text-[9px] uppercase font-bold opacity-70 leading-none mt-0.5">
                  {!isServiceDay ? '' : isPast ? '' : 'min'}
                </span>
              </div>

              {/* Action Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className={`h-4 text-[9px] px-1.5 rounded-sm border-0 ${
                    isUrgent ? 'bg-amber-100 text-amber-700' : 
                    isPast ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {activeAction.isPrep ? 'PREP' : 'CUE'}
                  </Badge>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isUrgent ? 'text-amber-600' : 
                    isPast ? 'text-gray-400' : 'text-pdv-teal'
                  }`}>
                    {activeAction.type}
                  </span>
                  <span className={`text-[10px] tabular-nums ${
                    isUrgent ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {formatTimeToEST(activeAction.time.toTimeString().substring(0, 5))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h4 className={`font-semibold text-sm truncate ${isPast ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {activeAction.label}
                  </h4>
                  {moreCount > 0 && (
                    <Badge className="h-5 px-1.5 min-w-[1.25rem] text-[10px] bg-gray-200 text-gray-600 border-none shrink-0 flex items-center justify-center">
                      +{moreCount}
                    </Badge>
                  )}
                  {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50 shrink-0 text-gray-600" /> : <ChevronUp className="w-4 h-4 opacity-50 shrink-0 text-gray-600" />}
                </div>
              </div>
            </div>

            {/* Right Side: Actions (Scroll + Chat) */}
            <div className="flex items-center gap-1 pl-2">
              {/* Jump to Segment */}
              {activeAction.segmentId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-9 w-9 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrollToSegment && onScrollToSegment({ id: activeAction.segmentId });
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}

              {/* Chat Trigger (Integrated) */}
              {onToggleChat && (
                <div className="relative ml-1 border-l border-gray-200 pl-2">
                  <Button
                    size="icon"
                    className={`h-9 w-9 rounded-full transition-all ${
                      chatOpen 
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' 
                        : 'bg-white text-pdv-teal border-2 border-pdv-teal hover:bg-pdv-teal hover:text-white shadow-sm'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleChat();
                    }}
                  >
                    {chatOpen ? <ChevronDown className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                  </Button>
                  {/* Unread Badge */}
                  {!chatOpen && chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}