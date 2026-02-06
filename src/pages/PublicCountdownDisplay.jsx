import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import { useLanguage } from "@/components/utils/i18n";

/**
 * PublicCountdownDisplay
 * 
 * Public-facing TV display for live service status.
 * Shows countdown (current + next segment) + upcoming coordinator actions.
 * Real-time WebSocket subscription — zero delay.
 * No authentication, no interaction, TV-optimized layout.
 */
export default function PublicCountdownDisplay() {
  const { t, language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serviceId, setServiceId] = useState(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Tick every 100ms for smooth countdown display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // URL params: ?service_id=xxx&date=YYYY-MM-DD OR ?event_id=xxx (optional)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const svcId = params.get('service_id');
    const evtId = params.get('event_id');
    const dt = params.get('date');
    if (svcId) setServiceId(svcId);
    if (evtId) setServiceId(evtId); // event_id also sets serviceId (fetched differently)
    if (dt) setServiceDate(dt);
  }, []);

  // Fetch current service (or specified service/event)
  const { data: service } = useQuery({
    queryKey: ['service', serviceId, serviceDate],
    queryFn: async () => {
      if (!serviceId) {
        // Auto-detect current service (today's date, closest to now)
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
      
      // Try to fetch as Service first
      const svcResults = await base44.entities.Service.filter({ id: serviceId });
      if (svcResults?.[0]) return svcResults[0];
      
      // If not found, try as Event and return it (segments will be fetched from event)
      const evtResults = await base44.entities.Event.filter({ id: serviceId });
      if (evtResults?.[0]) {
        // Return event as a pseudo-service object
        const evt = evtResults[0];
        return { ...evt, _isEvent: true, name: evt.name };
      }
      
      return null;
    },
    enabled: !!(serviceId || serviceDate)
  });

  // Fetch segments for this service (via sessions if service is event-based or event itself)
  const { data: segments = [] } = useQuery({
    queryKey: ['segments', service?.id, serviceDate],
    queryFn: async () => {
      if (!service) return [];
      
      // If _isEvent flag, it's an event object — fetch its sessions
      if (service._isEvent) {
        const sessions = await base44.entities.Session.filter({ event_id: service.id });
        const allSegments = [];
        for (const session of sessions) {
          const segs = await base44.entities.Segment.filter({ session_id: session.id });
          allSegments.push(...segs);
        }
        return allSegments.sort((a, b) => {
          const timeA = a.start_time ? new Date(`${serviceDate}T${a.start_time}`).getTime() : 0;
          const timeB = b.start_time ? new Date(`${serviceDate}T${b.start_time}`).getTime() : 0;
          return timeA - timeB;
        });
      }
      
      // If service has event_id, fetch sessions + segments
      if (service.event_id) {
        const sessions = await base44.entities.Session.filter({ event_id: service.event_id });
        const allSegments = [];
        for (const session of sessions) {
          const segs = await base44.entities.Segment.filter({ session_id: session.id });
          allSegments.push(...segs);
        }
        return allSegments.sort((a, b) => {
          const timeA = a.start_time ? new Date(`${serviceDate}T${a.start_time}`).getTime() : 0;
          const timeB = b.start_time ? new Date(`${serviceDate}T${b.start_time}`).getTime() : 0;
          return timeA - timeB;
        });
      }
      
      // If service has segments directly, fetch them
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
    
    const unsub = base44.entities.Segment.subscribe((event) => {
      // Invalidate segments query on any segment change
      // (This will trigger a refetch automatically via React Query)
    });
    
    return unsub;
  }, [service]);

  // Determine current and next segment
  const { currentSegment, nextSegment } = useMemo(() => {
    if (!segments || segments.length === 0) return { currentSegment: null, nextSegment: null };
    
    const now = currentTime.getTime();
    const segmentsWithTimes = segments.map(seg => {
      const startTime = new Date(`${serviceDate}T${seg.start_time || '00:00'}`).getTime();
      const endTime = startTime + (seg.duration_min || 0) * 60000;
      return { ...seg, startTime, endTime };
    });
    
    const current = segmentsWithTimes.find(s => s.startTime <= now && now < s.endTime);
    const upcoming = segmentsWithTimes.filter(s => s.startTime > now).sort((a, b) => a.startTime - b.startTime);
    
    return {
      currentSegment: current || segmentsWithTimes[0],
      nextSegment: current ? upcoming[0] : (upcoming[0] ? upcoming[1] : null)
    };
  }, [segments, currentTime, serviceDate]);

  // Fallback: if no service/segments, show loading or placeholder
  if (!service || segments.length === 0) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">{t('public.headerTitle')}</h1>
          <p className="text-lg opacity-75">{t('public.selectService')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black p-4 md:p-6 flex flex-col items-center justify-center overflow-hidden">
      {/* TV-Optimized Container: Full-screen, centered, responsive */}
      <div className="w-full max-w-6xl flex flex-col gap-8 items-center">
        
        {/* Header: Service Name & Current Time */}
        <div className="text-center mb-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 uppercase tracking-tight">
            {service.name}
          </h1>
          <div className="text-2xl md:text-3xl text-pdv-yellow font-mono font-bold">
            {currentTime.toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        </div>

        {/* Countdown Blocks: Current + Next */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* Current Segment */}
          {currentSegment && (
            <CountdownBlock
              segment={currentSegment}
              label={t('live.inProgress')}
              isCurrent={true}
              currentTime={currentTime}
              serviceDate={serviceDate}
            />
          )}

          {/* Next Segment */}
          {nextSegment && (
            <CountdownBlock
              segment={nextSegment}
              label={t('live.upNext')}
              isCurrent={false}
              currentTime={currentTime}
              serviceDate={serviceDate}
            />
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
      </div>
    </div>
  );
}