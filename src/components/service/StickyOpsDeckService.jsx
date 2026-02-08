import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock, CheckCircle2, ArrowRight, Minimize2, MessageCircle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * StickyOpsDeckService
 * 
 * Dedicated Sticky Ops Deck for Weekly Services.
 * Differences from Event version:
 * 1. Permissive action parsing (defaults to 'after_start' if timing missing)
 * 2. Simplified date logic (assumes service date)
 * 3. Handles 'Receso' segments explicitly
 */
export default function StickyOpsDeckService({ 
  segments = [], 
  sessionDate = null,
  currentTime,
  onScrollToSegment,
  onToggleChat,
  chatUnreadCount = 0,
  chatOpen = false
}) {
  const [viewState, setViewState] = useState('icon'); // 'icon' | 'bar' | 'expanded'
  const isExpanded = viewState === 'expanded';

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
    const todayStr = new Date().toISOString().split('T')[0];
    const isServiceDayLocal = !sessionDate || sessionDate === todayStr;

    // Process Segment Actions
    segments.forEach(seg => {
      if (!seg.start_time) return;
      const segDateStr = seg.date || activeDateStr;
      const segStart = parseDateTime(segDateStr, seg.start_time);
      if (!segStart) return;

      const duration = seg.duration_min || seg.duration || 0;
      const segEnd = new Date(segStart);
      segEnd.setMinutes(segStart.getMinutes() + duration);

      // Permissive: Accept segment_actions OR actions
      const segActions = seg.segment_actions || seg.actions || [];
      
      segActions.forEach(action => {
        let actionTime = new Date(segStart);
        const offset = action.offset_min || 0;
        
        // Permissive: Default to 'after_start' if timing is missing
        const timing = action.timing || 'after_start';

        switch (timing) {
          case 'before_start':
            actionTime.setMinutes(segStart.getMinutes() - offset);
            break;
          case 'after_start':
          case 'during': // Handle explicit 'during' map to start+offset
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
            // Fallback for unknown timing: treat as start time + offset
            actionTime.setMinutes(segStart.getMinutes() + offset);
            break;
        }

        actions.push({
          id: `${seg.id}-${action.label}-${timing}-${Math.random()}`, // Ensure uniqueness
          time: actionTime,
          label: action.label,
          segmentTitle: seg.title,
          segmentId: seg.id,
          type: action.department || 'General',
          isPrep: timing === 'before_start',
          notes: action.notes
        });
      });
    });

    const sorted = actions.sort((a, b) => a.time.getTime() - b.time.getTime());
    const upcoming = sorted.filter(a => a.time.getTime() > now);
    const past = sorted.filter(a => a.time.getTime() <= now).reverse();

    return { upcomingActions: upcoming, pastActions: past, isServiceDay: isServiceDayLocal };
  }, [segments, sessionDate, currentTime]);

  const activeAction = isServiceDay
    ? (upcomingActions[0] || pastActions[0])
    : upcomingActions[0] || pastActions[0]; // Preview: show first available if not service day (or just fallback)

  // SERVICE OVER GUARD: Only applies on service day
  if (isServiceDay && upcomingActions.length === 0 && pastActions.length > 0) {
    const lastActionTime = pastActions[0].time.getTime();
    const minutesSinceLast = (currentTime.getTime() - lastActionTime) / 60000;
    if (minutesSinceLast > 30) return null;
  }

  const concurrentCount = useMemo(() => {
    if (!activeAction) return 0;
    const isPastRef = activeAction.time.getTime() <= currentTime.getTime();
    const list = isPastRef ? pastActions : upcomingActions;
    return list.filter(a => 
      Math.abs(a.time.getTime() - activeAction.time.getTime()) < 300000 // Within 5 minutes
    ).length;
  }, [activeAction, pastActions, upcomingActions, currentTime]);

  if (!activeAction) return null;

  const isPast = isServiceDay ? activeAction.time.getTime() <= currentTime.getTime() : false;
  const diffMs = isServiceDay ? Math.abs(activeAction.time.getTime() - currentTime.getTime()) : 0;
  const diffMin = isServiceDay ? Math.floor(diffMs / 60000) : 0;
  const isUrgent = isServiceDay && !isPast && diffMin < 5;

  // Auto-expand on urgency (only if in icon mode)
  useEffect(() => {
    if (isUrgent && viewState === 'icon') {
      setViewState('bar');
    }
  }, [isUrgent]);

  const moreCount = Math.max(0, concurrentCount - 1);
  const bgClass = 'bg-slate-100/95 backdrop-blur-xl';
  const textClass = 'text-slate-900';

  // ICON VIEW
  if (viewState === 'icon') {
    return (
      <div className="fixed bottom-4 left-4 z-40 print:hidden flex flex-col justify-end items-start">
        <div className="relative group">
          <div
            onClick={() => setViewState('bar')}
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shrink-0 shadow-[0_12px_35px_rgba(0,0,0,0.25)] border-2 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 ${
              isUrgent ? 'bg-amber-500 text-black border-amber-600 shadow-lg animate-pulse' : 
              isPast ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-white text-pdv-teal border-slate-200'
            }`}
          >
            {!isServiceDay ? (
              <Clock className="w-8 h-8 opacity-60" />
            ) : isPast ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : (
              <span className="text-3xl sm:text-4xl font-black leading-none tracking-tight">{diffMin}</span>
            )}
            <span className="text-[10px] sm:text-xs uppercase font-bold opacity-70 leading-none mt-0.5">
              {!isServiceDay ? '' : isPast ? '' : 'min'}
            </span>
          </div>

          {!chatOpen && chatUnreadCount > 0 && (
            <span className="absolute -top-1 -left-1 h-6 min-w-[1.5rem] px-1.5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm z-10">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </div>
      </div>
    );
  }

  // BAR / EXPANDED VIEW
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[650px] z-40 print:hidden flex flex-col justify-end items-center pointer-events-none transition-all duration-300">
      <div className="w-full relative pointer-events-auto">
        
        {/* Label Shelf */}
        <div className="absolute -top-7 left-0 right-0 flex justify-between items-end px-4 z-0 pointer-events-none">
          <div 
            onClick={() => setViewState(viewState === 'expanded' ? 'bar' : 'expanded')}
            className={`pointer-events-auto px-4 py-1.5 rounded-t-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${
              isUrgent 
                ? 'bg-amber-500 text-black shadow-lg' 
                : 'bg-slate-200/90 backdrop-blur-md text-slate-700 border-t border-x border-slate-300 shadow-sm'
            }`}
            style={{ height: '28px' }}
          >
            <span>Acciones de Servicio</span>
          </div>

          <button
            onClick={() => setViewState('icon')}
            className="pointer-events-auto mb-1 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 shadow-sm border border-slate-200 backdrop-blur-sm transition-all"
            title="Minimizar a icono"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Box */}
        <div className={`w-full shadow-[0_20px_80px_-8px_rgba(0,0,0,0.45),0_8px_30px_-4px_rgba(0,0,0,0.25)] rounded-2xl border border-white/60 ring-1 ring-black/15 overflow-hidden transition-all duration-300 relative z-10 flex flex-col ${bgClass} ${textClass}`}>
          
          {/* Main Bar */}
          <div className="flex items-center justify-between py-3 px-3 sm:px-5 relative z-20">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              {/* Countdown Badge */}
              <div 
                onClick={(e) => { e.stopPropagation(); setViewState('icon'); }}
                className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform ${
                  isUrgent ? 'bg-amber-500 text-black shadow-md animate-pulse' : 
                  isPast ? 'bg-slate-200 text-slate-400' : 'bg-white text-pdv-teal border-2 border-slate-200'
                }`}
                title="Minimizar a icono"
              >
                {!isServiceDay ? (
                  <Clock className="w-6 h-6 sm:w-7 sm:h-7 opacity-60" />
                ) : isPast ? (
                  <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
                ) : (
                  <span className="text-xl sm:text-2xl font-black leading-none tracking-tight">{diffMin}</span>
                )}
                <span className="text-[9px] uppercase font-bold opacity-70 leading-none mt-0.5">
                  {!isServiceDay ? '' : isPast ? '' : 'min'}
                </span>
              </div>

              {/* Action Info */}
              <div 
                className="flex-1 min-w-0 flex flex-col justify-center gap-1 cursor-pointer"
                onClick={() => setViewState(viewState === 'expanded' ? 'bar' : 'expanded')}
              >
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                  <Badge variant="outline" className={`h-5 text-[10px] px-1.5 rounded-md border font-bold shrink-0 ${
                    isUrgent ? 'bg-amber-100 text-amber-900 border-amber-300' : 
                    isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 
                    activeAction.isPrep ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}>
                    {activeAction.isPrep ? 'PREP' : 'DURANTE'}
                  </Badge>
                  
                  <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    isUrgent ? 'text-amber-700' : 
                    isPast ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {activeAction.type}
                  </span>

                  <span className={`text-xs font-black tabular-nums sm:ml-auto px-2 py-0.5 rounded-lg border-2 shrink-0 ${
                    isUrgent ? 'bg-amber-100 text-amber-900 border-amber-400' : 
                    isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  }`}>
                    {formatTimeToEST(activeAction.time.toTimeString().substring(0, 5))}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <h4 className={`font-bold text-base leading-snug line-clamp-2 ${isPast ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {activeAction.label}
                  </h4>
                  
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {moreCount > 0 && (
                      <Badge className="h-5 min-w-[1.5rem] px-1.5 text-[10px] font-bold bg-indigo-500 text-white border-none flex items-center justify-center shadow-sm">
                        +{moreCount}
                      </Badge>
                    )}
                    {viewState === 'expanded' ? <ChevronUp className="w-4 h-4 opacity-60 text-slate-600" /> : <ChevronDown className="w-4 h-4 opacity-60 text-slate-600" />}
                  </div>
                </div>

                {viewState === 'bar' && activeAction.notes && (
                  <p className={`text-[11px] leading-snug line-clamp-1 ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                    {activeAction.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Right Side: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 ml-1 sm:ml-2">
              {activeAction.segmentId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScrollToSegment && onScrollToSegment({ id: activeAction.segmentId });
                  }}
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
              )}

              {onToggleChat && (
                <div className="relative">
                  <Button
                    size="icon"
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-all ${
                      chatOpen 
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                        : 'bg-white text-pdv-teal border-2 border-pdv-teal hover:bg-pdv-teal hover:text-white shadow-sm'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleChat();
                    }}
                  >
                    {chatOpen ? <ChevronDown className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                  </Button>
                  {!chatOpen && chatUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm z-10">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Expanded List */}
          {viewState === 'expanded' && (
            <div className={`border-t border-slate-200 px-5 py-4 space-y-4 max-h-[45vh] overflow-y-auto bg-slate-50/90`}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-500">
                {isPast ? 'Historial Reciente' : 'Siguientes Acciones'}
              </p>
            
              {(isPast ? pastActions.slice(0, 3) : upcomingActions.slice(1, 4)).map((action, idx) => {
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
                    <div className="font-bold text-sm text-slate-800 leading-snug">{action.label}</div>
                    {action.notes && (
                      <div className={`text-xs leading-relaxed mt-1 whitespace-pre-wrap line-clamp-4 ${isUrgent ? 'text-amber-700' : 'text-slate-600'}`}>
                        {action.notes}
                      </div>
                    )}
                    <div className="text-[10px] font-medium truncate text-slate-400 mt-1">
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