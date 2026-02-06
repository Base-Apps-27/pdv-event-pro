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
          isPrep: false,
          isPreSession: true,
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
            isPrep: false,
            isPreSession: true,
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
  
  // Glass Control Deck: Light/Tranquil theme - High Contrast & Large Text
  // Floating with deeper shadow and rim
  const bgClass = 'bg-slate-100/95 backdrop-blur-xl';
  const textClass = 'text-slate-900';

  return (
    // Floating container
    <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[650px] z-40 print:hidden flex flex-col justify-end items-center pointer-events-none transition-all duration-300">
      
      {/* Wrapper for the deck */}
      <div className="w-full relative pointer-events-auto">
        
        {/* Label Shelf - Attached to top */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`absolute -top-7 left-4 px-4 py-1.5 rounded-t-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center gap-1.5 z-0 ${
            isUrgent 
              ? 'bg-amber-500 text-black shadow-lg' 
              : 'bg-slate-200/90 backdrop-blur-md text-slate-700 border-t border-x border-slate-300 shadow-sm'
          }`}
          style={{ height: '28px' }}
        >
          <span>Acciones de Coord</span>
        </div>

        {/* Main Content Box - Floating, Rounded, Shadowed */}
        <div 
          className={`w-full shadow-[0_20px_80px_-8px_rgba(0,0,0,0.45),0_8px_30px_-4px_rgba(0,0,0,0.25)] rounded-2xl border border-white/60 ring-1 ring-black/15 overflow-hidden transition-all duration-300 relative z-10 flex flex-col ${bgClass} ${textClass}`}
        >
          
          {/* Main Bar - Rendered FIRST so children (List) appear BELOW it */}
          <div 
            className="flex items-center justify-between py-4 px-4 sm:px-6 relative z-20"
          >
            {/* Left Side: Countdown + Info */}
            <div 
              className="flex items-center gap-5 flex-1 min-w-0 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {/* Large Countdown Badge */}
              <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl shrink-0 shadow-sm ${
                isUrgent ? 'bg-amber-500 text-black shadow-md animate-pulse' : 
                isPast ? 'bg-slate-200 text-slate-400' : 'bg-white text-pdv-teal border-2 border-slate-200'
              }`}>
                {!isServiceDay ? (
                  <Clock className="w-8 h-8 opacity-60" />
                ) : isPast ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <span className="text-2xl font-black leading-none tracking-tight">{diffMin}</span>
                )}
                <span className="text-[10px] uppercase font-bold opacity-70 leading-none mt-1">
                  {!isServiceDay ? '' : isPast ? '' : 'min'}
                </span>
              </div>

              {/* Action Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                
                {/* Header Metadata Row */}
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Badge variant="outline" className={`h-6 text-xs px-2 rounded-md border font-bold ${
                    isUrgent ? 'bg-amber-100 text-amber-900 border-amber-300' : 
                    isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 
                    activeAction.isPreSession ? 'bg-slate-200 text-slate-700 border-slate-300' :
                    activeAction.isPrep ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}>
                    {activeAction.isPreSession ? 'PRE' : activeAction.isPrep ? 'PREP' : 'DURANTE'}
                  </Badge>
                  
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isUrgent ? 'text-amber-700' : 
                    isPast ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {activeAction.type}
                  </span>

                  {/* TIME HERO — Primary visual anchor */}
                  <span className={`text-sm font-black tabular-nums ml-auto px-2.5 py-0.5 rounded-lg border-2 ${
                    isUrgent ? 'bg-amber-100 text-amber-900 border-amber-400' : 
                    isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  }`}>
                    {formatTimeToEST(activeAction.time.toTimeString().substring(0, 5))}
                  </span>
                </div>

                {/* Primary Action Label & Indicators */}
                <div className="flex items-center gap-3">
                  <h4 className={`font-bold text-lg leading-tight truncate ${isPast ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {activeAction.label}
                  </h4>
                  
                  {/* Enhanced Concurrent Badge */}
                  {moreCount > 0 && (
                    <Badge className="h-6 min-w-[1.75rem] px-2 text-xs font-bold bg-indigo-500 text-white border-none shrink-0 flex items-center justify-center shadow-sm">
                      +{moreCount}
                    </Badge>
                  )}
                  
                  {isExpanded ? <ChevronUp className="w-5 h-5 opacity-60 shrink-0 text-slate-600 ml-auto sm:ml-0" /> : <ChevronDown className="w-5 h-5 opacity-60 shrink-0 text-slate-600 ml-auto sm:ml-0" />}
                </div>
              </div>
            </div>

            {/* Right Side: Actions (Scroll + Chat) */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 ml-2">
              {/* Jump to Segment */}
              {activeAction.segmentId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-11 w-11 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrollToSegment && onScrollToSegment({ id: activeAction.segmentId });
                  }}
                >
                  <ArrowRight className="w-6 h-6" />
                </Button>
              )}

              {/* Chat Trigger */}
              {onToggleChat && (
                <div className="relative">
                  <Button
                    size="icon"
                    className={`h-11 w-11 rounded-full transition-all ${
                      chatOpen 
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                        : 'bg-white text-pdv-teal border-2 border-pdv-teal hover:bg-pdv-teal hover:text-white shadow-sm'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleChat();
                    }}
                  >
                    {chatOpen ? <ChevronDown className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                  </Button>
                  {/* Unread Badge */}
                  {!chatOpen && chatUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm z-10">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Expanded List - Rendered SECOND so it appears BELOW the bar */}
          {isExpanded && (
            <div className={`border-t border-slate-200 px-5 py-4 space-y-4 max-h-[45vh] overflow-y-auto bg-slate-50/90`}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-500">
                {isPast ? 'Historial Reciente' : 'Siguientes Acciones'}
              </p>
            
              {(isPast ? pastActions.slice(0, 3) : upcomingActions.slice(1, 4)).map((action, idx) => {
                // Concurrent = within 5 min of the header action's time → highlight time the same way
                const isConcurrent = activeAction && Math.abs(action.time.getTime() - activeAction.time.getTime()) < 300000;
                return (
                <div key={idx} className={`flex items-start gap-4 py-2 border-b border-slate-200 last:border-0 ${isPast ? 'opacity-60' : ''}`}>
                  <span className={`font-mono font-bold text-sm mt-0.5 min-w-[3.5rem] text-center px-2 py-0.5 rounded-lg ${
                    isConcurrent 
                      ? (isUrgent ? 'bg-amber-100 text-amber-900 border-2 border-amber-400' : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-300')
                      : 'text-slate-500'
                  }`}>
                    {formatTimeToEST(action.time.toTimeString().substring(0, 5))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base text-slate-800 leading-tight">{action.label}</div>
                    {action.notes && (
                      <div className={`text-sm leading-relaxed mt-1 whitespace-pre-wrap ${isUrgent ? 'text-amber-700' : 'text-slate-600'}`}>
                        {action.notes}
                      </div>
                    )}
                    <div className="text-xs font-medium truncate text-slate-400 mt-1">
                      {action.segmentTitle} • <span className="uppercase tracking-wide">{action.type}</span>
                    </div>
                  </div>
                </div>
                );
              })}
              
              {((isPast && pastActions.length === 0) || (!isPast && upcomingActions.length <= 1)) && (
                <p className="text-sm opacity-50 italic py-2 text-slate-500">No hay más acciones.</p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}