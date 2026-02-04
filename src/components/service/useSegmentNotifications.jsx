import { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { BellRing, Clock, AlertTriangle, PlayCircle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";

/**
 * Hook to handle real-time notifications for segments
 * 
 * Features:
 * 1. Upcoming segment notifications (2 mins before, starting now)
 * 2. Live adjustments notifications (delays, early endings)
 * 3. Status changes (cancellations/additions)
 */
export function useSegmentNotifications(segments = [], session = null) {
  const [notifiedSegments, setNotifiedSegments] = useState(new Set());
  const previousSegmentsRef = useRef({});
  const previousSessionRef = useRef(null);
  
  // Track previous state for diffing
  useEffect(() => {
    // Initial load - don't notify, just store
    if (Object.keys(previousSegmentsRef.current).length === 0 && segments.length > 0) {
      const initialMap = {};
      segments.forEach(s => {
        initialMap[s.id] = { ...s };
      });
      previousSegmentsRef.current = initialMap;
      
      if (session) {
        previousSessionRef.current = { ...session };
      }
      return;
    }

    // Check for Live Mode toggle
    if (session && previousSessionRef.current) {
      if (session.live_adjustment_enabled !== previousSessionRef.current.live_adjustment_enabled) {
        if (session.live_adjustment_enabled) {
          toast.info("Modo en vivo activado por el administrador", {
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
            duration: 5000
          });
        } else {
          toast.info("Modo en vivo desactivado - volviendo a horarios planificados", {
            icon: <Clock className="w-5 h-5" />,
            duration: 5000
          });
        }
      }
    }
    previousSessionRef.current = session ? { ...session } : null;

    // Diff segments
    const currentMap = {};
    segments.forEach(s => {
      currentMap[s.id] = { ...s };
    });

    const previousMap = previousSegmentsRef.current;

    // Check for changes
    segments.forEach(current => {
      const prev = previousMap[current.id];
      
      if (!prev) {
        // New segment added (could notify, but maybe too chatty on initial loads if pagination involved)
        // Ignoring for now unless strictly needed
        return;
      }

      // Check for Live Adjustments (Timing)
      // Only if live mode is enabled or was enabled
      if (session?.live_adjustment_enabled) {
        
        // 1. Ended Early/Manually
        if (!prev.actual_end_time && current.actual_end_time && current.is_live_adjusted) {
          toast.success(`Segmento finalizado: ${current.title}`, {
            icon: <PlayCircle className="w-5 h-5" />,
            description: `Finalizado a las ${formatTimeToEST(current.actual_end_time)}`
          });
        }

        // 2. Start Time Delayed/Adjusted
        // We check if actual_start_time changed and is different from planned start_time
        if (current.actual_start_time && prev.actual_start_time !== current.actual_start_time) {
          // It changed. Is it a delay?
          const getMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
          };
          
          const prevMins = getMinutes(prev.actual_start_time || prev.start_time);
          const currMins = getMinutes(current.actual_start_time);
          const diff = currMins - prevMins;

          if (Math.abs(diff) >= 1) { // Only notify if >= 1 min change
             const isDelay = diff > 0;
             toast(isDelay ? `Retraso en el programa` : `Ajuste de horario`, {
               icon: <Clock className={`w-5 h-5 ${isDelay ? 'text-red-500' : 'text-blue-500'}`} />,
               description: `${current.title} ${isDelay ? 'retrasado' : 'ajustado'} por ${Math.abs(diff)} min. Nuevo inicio: ${formatTimeToEST(current.actual_start_time)}`
             });
          }
        }
      }
      
      // 3. Status/Visibility Changes (Cancellation)
      // If show_in_general flipped from true to false
      if (prev.show_in_general === true && current.show_in_general === false) {
         toast.error(`Segmento cancelado/oculto`, {
           description: `${current.title} ha sido removido del programa principal.`
         });
      }
    });

    // Check for removed segments (Cancellations via deletion)
    Object.keys(previousMap).forEach(prevId => {
      if (!currentMap[prevId]) {
        // Segment removed
        const removed = previousMap[prevId];
        // Only notify if it was previously visible
        if (removed.show_in_general) {
           // Verify it wasn't just filtered out by parent component logic (e.g. view mode)
           // But here we receive "allSegments" passed to the hook, so it should be valid
           // Use a generic update message to be safe
           // toast.info("Actualización del programa: Se ha removido un segmento.");
        }
      }
    });

    // Update ref
    previousSegmentsRef.current = currentMap;

  }, [segments, session]); // Re-run when data changes

  // Time-based notifications (Local time comparison)
  useEffect(() => {
    // Only check segments that have a valid start time
    // If live mode is on, use actual_start_time if set
    // Otherwise use start_time
    
    const checkNotifications = () => {
      const now = new Date();
      
      segments.forEach(segment => {
        // Determine effective start time
        let timeStr = segment.start_time;
        if (session?.live_adjustment_enabled && segment.is_live_adjusted && segment.actual_start_time) {
          timeStr = segment.actual_start_time;
        }

        if (!timeStr || !segment.title) return;
        
        // Skip if hidden
        if (segment.show_in_general === false) return;

        const segmentId = segment.id || `${segment.title}-${timeStr}`;
        
        // Parse start time (assume today for HH:MM)
        const [segHours, segMins] = timeStr.split(':').map(Number);
        const segmentStart = new Date();
        segmentStart.setHours(segHours, segMins, 0, 0);
        
        const diffMs = segmentStart - now;
        const diffMins = Math.floor(diffMs / 60000);
        
        // Notify 2 minutes before
        const key2Min = `${segmentId}-2min-${timeStr}`; // Include time in key so rescheduled segments re-notify
        if (diffMins === 2 && !notifiedSegments.has(key2Min)) {
          toast.info(`⏰ ${segment.title} comienza en 2 minutos`, {
            duration: 10000,
            icon: <BellRing className="w-5 h-5" />,
          });
          setNotifiedSegments(prev => new Set(prev).add(key2Min));
        }
        
        // Notify when segment starts
        const keyStart = `${segmentId}-start-${timeStr}`;
        if (diffMins === 0 && !notifiedSegments.has(keyStart)) {
          toast.success(`▶️ ${segment.title} está comenzando ahora`, {
            duration: 8000,
            icon: <PlayCircle className="w-5 h-5" />,
          });
          setNotifiedSegments(prev => new Set(prev).add(keyStart));
        }

        // --- NEW: Notify for Critical Ops Actions (Urgent Tasks) ---
        const actions = segment.segment_actions || segment.actions || [];
        actions.forEach(action => {
          if (!action.label) return;

          let actionTime = new Date(segmentStart);
          const offset = action.offset_min || 0;

          // Calculate Action Time
          if (action.timing === 'before_start') {
            actionTime.setMinutes(segmentStart.getMinutes() - offset);
          } else if (action.timing === 'after_start') {
            actionTime.setMinutes(segmentStart.getMinutes() + offset);
          } else if (action.timing === 'absolute' && action.absolute_time) {
             const [ah, am] = action.absolute_time.split(':').map(Number);
             actionTime.setHours(ah, am, 0, 0);
          } else {
            return; // Skip complex cases like 'before_end' for now to avoid calc errors without duration
          }

          const actionDiffMs = actionTime - now;
          const actionDiffMins = Math.floor(actionDiffMs / 60000);

          // Notify if "Urgent" (5 min warning)
          const actionKey = `${segmentId}-action-${action.label}-${timeStr}`;
          
          if (actionDiffMins === 5 && !notifiedSegments.has(actionKey)) {
             toast.warning(`⚠️ Acción Requerida en 5 min: ${action.label}`, {
               description: `${segment.title} • ${action.department || 'General'}`,
               duration: 8000,
               icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
             });
             setNotifiedSegments(prev => new Set(prev).add(actionKey));
          }
        });
      });
    };

    // Check immediately and interval
    checkNotifications();
    const interval = setInterval(checkNotifications, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [segments, session, notifiedSegments]);

  return null; // This is a logic-only hook
}