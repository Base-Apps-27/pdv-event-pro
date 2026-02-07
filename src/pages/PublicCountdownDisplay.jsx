import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * PublicCountdownDisplay
 * 
 * Public-facing TV display for live service status.
 * Segment determination logic mirrors LiveStatusCard exactly:
 *   1. Pre-launch: nothing in progress → negative countdown to first segment start
 *   2. In-progress: segment is live → countdown to segment end
 *   3. Up-next: next segment after now → countdown to its start
 * 
 * Real-time WebSocket subscription — zero delay.
 * No authentication, no interaction, TV-optimized layout.
 */
export default function PublicCountdownDisplay() {
  const { t, language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Brand gradient style (Hardcoded for reliability)
  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";
  const [serviceId, setServiceId] = useState(null);
  const [serviceDate, setServiceDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Tick every second for countdown display (100ms is wasteful for seconds-precision text)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // URL params: ?service_id=xxx&date=YYYY-MM-DD OR ?event_id=xxx (optional)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const svcId = params.get('service_id');
    const evtId = params.get('event_id');
    const dt = params.get('date');
    if (svcId) setServiceId(svcId);
    if (evtId) setServiceId(evtId);
    if (dt) setServiceDate(dt);
  }, []);

  // Fetch current service (or specified service/event)
  const { data: service } = useQuery({
    queryKey: ['tv-service', serviceId, serviceDate],
    queryFn: async () => {
      if (!serviceId) {
        const todayStr = serviceDate;
        const results = await base44.entities.Service.filter({ date: todayStr, status: 'active' });
        if (results?.length > 0) {
          return results.sort((a, b) => {
            const timeA = a.time ? new Date(`${todayStr}T${a.time}`).getTime() : 0;
            const timeB = b.time ? new Date(`${todayStr}T${b.time}`).getTime() : 0;
            return Math.abs(timeA - currentTime.getTime()) - Math.abs(timeB - currentTime.getTime());
          })[0];
        }
        return null;
      }
      
      const svcResults = await base44.entities.Service.filter({ id: serviceId });
      if (svcResults?.[0]) return svcResults[0];
      
      const evtResults = await base44.entities.Event.filter({ id: serviceId });
      if (evtResults?.[0]) {
        return { ...evtResults[0], _isEvent: true };
      }
      return null;
    },
    enabled: !!(serviceId || serviceDate)
  });

  // Fetch segments
  const { data: segments = [] } = useQuery({
    queryKey: ['tv-segments', service?.id, serviceDate],
    queryFn: async () => {
      if (!service) return [];
      
      if (service._isEvent) {
        const sessions = await base44.entities.Session.filter({ event_id: service.id, date: serviceDate });
        const allSegments = [];
        for (const session of sessions) {
          const segs = await base44.entities.Segment.filter({ session_id: session.id });
          allSegments.push(...segs);
        }
        return allSegments;
      }
      
      if (service.event_id) {
        const sessions = await base44.entities.Session.filter({ event_id: service.event_id });
        const allSegments = [];
        for (const session of sessions) {
          const segs = await base44.entities.Segment.filter({ session_id: session.id });
          allSegments.push(...segs);
        }
        return allSegments;
      }
      
      if (service.segments && Array.isArray(service.segments)) {
        return service.segments;
      }
      return [];
    },
    enabled: !!service
  });

  // Subscribe to segment updates (real-time)
  useEffect(() => {
    if (!service) return;
    const unsub = base44.entities.Segment.subscribe(() => {
      // React Query will refetch on invalidation
    });
    return unsub;
  }, [service]);

  // ─── CANONICAL TIME PARSER (mirrors LiveStatusCard.getTimeDate) ───
  const getTimeDate = (timeStr) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(currentTime);
    if (serviceDate) {
      const [y, m, d] = serviceDate.split('-').map(Number);
      date.setFullYear(y);
      date.setMonth(m - 1);
      date.setDate(d);
    }
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // ─── SEGMENT DETERMINATION (mirrors LiveStatusCard exactly) ───
  const { currentSegment, nextSegment, preLaunchSegment } = useMemo(() => {
    if (!segments || segments.length === 0) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null };
    }

    // Filter out breaks, require start_time
    const validSegments = segments
      .filter(s => s.start_time && s.segment_type !== 'Break' && s.segment_type !== 'break')
      .sort((a, b) => {
        const tA = getTimeDate(a.start_time);
        const tB = getTimeDate(b.start_time);
        if (!tA && !tB) return 0;
        if (!tA) return 1;
        if (!tB) return -1;
        return tA - tB;
      });

    if (validSegments.length === 0) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null };
    }

    // Check isToday (same logic as LiveStatusCard)
    const isToday = (() => {
      if (!serviceDate) return true;
      const [y, m, d] = serviceDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
      const today = new Date(currentTime);
      today.setHours(0, 0, 0, 0);
      return targetDate.getTime() === today.getTime();
    })();

    if (!isToday) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null };
    }

    // Find current: segment where start <= now <= end (using end_time field like LiveStatusCard)
    const current = validSegments.find(s => {
      const start = getTimeDate(s.start_time);
      const end = s.end_time ? getTimeDate(s.end_time) : (start ? new Date(start.getTime() + (s.duration_min || 0) * 60000) : null);
      return start && end && currentTime >= start && currentTime <= end;
    }) || null;

    // Find next: first segment starting after now
    const next = validSegments.find(s => {
      const start = getTimeDate(s.start_time);
      return start && start > currentTime;
    }) || null;

    // Pre-launch: if nothing is current, countdown to FIRST segment (like LiveStatusCard.upNextCountdown)
    let preLaunch = null;
    if (!current) {
      const first = validSegments[0];
      const firstStart = getTimeDate(first.start_time);
      if (firstStart && currentTime < firstStart) {
        preLaunch = first;
      }
    }

    return { currentSegment: current, nextSegment: next, preLaunchSegment: preLaunch };
  }, [segments, currentTime, serviceDate]);

  // Fallback: if no service/segments, show loading or placeholder
  if (!service || segments.length === 0) {
    return (
      <div className="w-full h-screen bg-white flex items-center justify-center">
        <div className="text-center text-pdv-teal">
          <h1 className="text-4xl font-bold mb-4">{t('public.headerTitle')}</h1>
          <p className="text-lg opacity-75">{t('public.selectService')}</p>
        </div>
      </div>
    );
  }

  // All done for today
  const allDone = !currentSegment && !nextSegment && !preLaunchSegment;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col items-center justify-center overflow-hidden relative">
      {/* Top Gradient Bar */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Top Right Clock */}
      <div className="absolute top-6 right-6 z-20">
        <div className="text-4xl md:text-6xl text-slate-800 font-mono font-bold tracking-tight bg-white/60 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/50 shadow-sm">
          {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
        </div>
      </div>
      
      <div className="w-full max-w-6xl flex flex-col gap-8 items-center z-10">
        
        {/* Header: Service Name */}
        <div className="text-center mb-4">
          <h1 className={`text-6xl md:text-7xl font-black mb-2 uppercase tracking-tight ${gradientText} drop-shadow-sm`}>
            {service.name}
          </h1>
        </div>

        {allDone ? (
          <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl border-4 border-slate-100 p-12 shadow-xl text-center opacity-0 animate-in fade-in duration-1000 slide-in-from-bottom-8 fill-mode-forwards" style={{ animationDelay: '0.2s' }}>
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <span className="text-4xl">👋</span>
             </div>
             <h2 className="text-4xl font-black text-slate-800 uppercase mb-3 tracking-tight">{t('live.endOfProgram')}</h2>
             <p className="text-slate-400 text-xl font-medium">Have a blessed week!</p>
          </div>
        ) : (
          <>
            {/* Countdown Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">

              {/* LEFT PANEL: In-Progress OR Pre-Launch */}
              {currentSegment ? (
                <CountdownBlock
                  segment={currentSegment}
                  displayMode="in-progress"
                  currentTime={currentTime}
                  serviceDate={serviceDate}
                  getTimeDate={getTimeDate}
                />
              ) : preLaunchSegment ? (
                <CountdownBlock
                  segment={preLaunchSegment}
                  displayMode="pre-launch"
                  currentTime={currentTime}
                  serviceDate={serviceDate}
                  getTimeDate={getTimeDate}
                />
              ) : (
                <div className="bg-white rounded-3xl border-4 border-slate-200 p-8 md:p-10 shadow-lg flex items-center justify-center">
                  <p className="text-slate-400 italic text-lg">{t('live.nothingNow')}</p>
                </div>
              )}

              {/* RIGHT PANEL: Next Segment */}
              {nextSegment ? (
                <CountdownBlock
                  segment={nextSegment}
                  displayMode="upcoming"
                  currentTime={currentTime}
                  serviceDate={serviceDate}
                  getTimeDate={getTimeDate}
                />
              ) : (
                <div className="bg-white rounded-3xl border-4 border-slate-200 p-8 md:p-10 shadow-lg flex items-center justify-center">
                  <p className="text-slate-400 italic text-lg">{t('live.endOfProgram')}</p>
                </div>
              )}
            </div>

            {/* Coordinator Actions */}
            {(currentSegment || nextSegment) && (
              <CoordinatorActionsDisplay
                currentSegment={currentSegment}
                nextSegment={nextSegment}
                currentTime={currentTime}
                serviceDate={serviceDate}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}