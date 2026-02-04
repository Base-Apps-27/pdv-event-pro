import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
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
 * @param {Date} currentTime - Current system time
 * @param {Object} serviceData - Optional service data for context
 */
export default function StickyOpsDeck({ 
  segments = [], 
  preSessionData = null, 
  currentTime,
  onScrollToSegment
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Flatten and sort all actions
  const upcomingActions = useMemo(() => {
    const actions = [];
    const now = currentTime.getTime();

    // 1. Process PreSession Actions (if any)
    if (preSessionData) {
      const dateStr = preSessionData._date || new Date().toISOString().split('T')[0]; // Fallback if date missing
      
      const addPreAction = (timeStr, label, type = 'facility') => {
        if (!timeStr) return;
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(dateStr); // Assumption: PreSession is for "today" relative to the view
        date.setHours(h, m, 0, 0);
        
        // Handle date rollover if needed (not likely for pre-session but good practice)
        if (isNaN(date.getTime())) return;

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
      // Add other pre-session triggers if they have times
    }

    // 2. Process Segment Actions
    segments.forEach(seg => {
      // Calculate Segment Start Time
      if (!seg.start_time) return;
      const [startH, startM] = seg.start_time.split(':').map(Number);
      // We need a reference date. For live view, we assume segments are for "current active day"
      // If we are in Event view, we might have segments from different days. 
      // Ideally, we filter segments to only those relevant to NOW (today).
      // For simplicity in this v1, we assume the passed `segments` are for the active view context.
      
      const segDate = new Date(currentTime); // Base on current view time to keep relative logic simple
      segDate.setHours(startH, startM, 0, 0);
      
      // Safety: If segment is clearly "tomorrow" or "yesterday" based on huge diff, we might want to skip?
      // For "Live" view, we usually filter to today. Let's assume passed segments are relevant.

      const duration = seg.duration_min || 0;
      const segEndDate = new Date(segDate);
      segEndDate.setMinutes(segDate.getMinutes() + duration);

      const segActions = seg.segment_actions || seg.actions || [];
      
      segActions.forEach(action => {
        let actionTime = new Date(segDate);
        const offset = action.offset_min || 0;

        // Calculate absolute time of action
        switch (action.timing) {
          case 'before_start':
            actionTime.setMinutes(segDate.getMinutes() - offset);
            break;
          case 'after_start':
            actionTime.setMinutes(segDate.getMinutes() + offset);
            break;
          case 'before_end':
            actionTime.setMinutes(segEndDate.getMinutes() - offset);
            break;
          case 'absolute':
            if (action.absolute_time) {
              const [h, m] = action.absolute_time.split(':').map(Number);
              actionTime.setHours(h, m, 0, 0);
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

    // 3. Sort by time
    return actions
      .filter(a => a.time.getTime() > now) // Only future actions
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [segments, preSessionData, currentTime]);

  const nextAction = upcomingActions[0];

  if (!nextAction) return null;

  // Calculate countdown
  const diffMs = nextAction.time.getTime() - currentTime.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor((diffMs % 60000) / 1000);
  
  // Urgency styling
  const isUrgent = diffMin < 5; // Less than 5 mins
  const isPrep = nextAction.isPrep;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 print:hidden">
      <div className={`max-w-6xl mx-auto shadow-2xl rounded-xl border-t border-x overflow-hidden transition-all duration-300 ${
        isUrgent 
          ? 'bg-amber-900 border-amber-700 text-white' 
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
              isUrgent ? 'bg-amber-500 text-black' : 'bg-gray-100 text-gray-900'
            }`}>
              <span className="text-lg font-bold leading-none">{diffMin}</span>
              <span className="text-[10px] uppercase font-bold opacity-80">Min</span>
            </div>

            {/* Action Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className={`h-5 text-[10px] px-1.5 ${
                  isUrgent ? 'border-amber-400 text-amber-200' : 'border-gray-300 text-gray-500'
                }`}>
                  {nextAction.isPrep ? 'PREP' : 'CUE'}
                </Badge>
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  isUrgent ? 'text-amber-300' : 'text-gray-500'
                }`}>
                  {nextAction.type}
                </span>
                <span className={`text-xs ${isUrgent ? 'text-amber-400' : 'text-gray-400'}`}>
                  @ {formatTimeToEST(nextAction.time.toTimeString().substring(0, 5))}
                </span>
              </div>
              <h4 className="font-bold text-base truncate pr-2">
                {nextAction.label}
              </h4>
              <p className={`text-xs truncate ${isUrgent ? 'text-amber-200' : 'text-gray-500'}`}>
                en: {nextAction.segmentTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            {nextAction.segmentId && (
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${isUrgent ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onScrollToSegment && onScrollToSegment({ id: nextAction.segmentId });
                }}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>

        {/* Expanded List (Next 3 items) */}
        {isExpanded && (
          <div className={`border-t px-4 py-3 space-y-3 ${
            isUrgent ? 'border-white/10 bg-black/20' : 'border-gray-100 bg-gray-50'
          }`}>
            <p className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${
              isUrgent ? 'text-amber-400' : 'text-gray-400'
            }`}>
              Próximas Acciones
            </p>
            {upcomingActions.slice(1, 4).map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <span className={`font-mono font-medium ${isUrgent ? 'text-amber-300' : 'text-gray-500'}`}>
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
            {upcomingActions.length <= 1 && (
              <p className="text-xs opacity-50 italic">No hay más acciones pendientes.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}