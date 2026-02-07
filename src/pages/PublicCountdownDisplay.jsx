import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST, formatDateET } from "@/components/utils/timeFormat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tv, Settings, LogOut, Loader2 } from "lucide-react";

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
  const { data: service, isLoading: isLoadingService } = useQuery({
    queryKey: ['tv-service', serviceId, serviceDate],
    queryFn: async () => {
      if (!serviceId) {
        // Try to auto-detect if no specific ID
        const todayStr = serviceDate;
        // Check for events first
        const events = await base44.entities.Event.filter({ status: 'confirmed' }); // Simplified status check
        const activeEvent = events.find(e => e.start_date <= todayStr && e.end_date >= todayStr);
        if (activeEvent) return { ...activeEvent, _isEvent: true };

        // Then check services
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
    enabled: true // Always try to fetch something or determine emptiness
  });

  // Fetch available options for the selector
  const { data: availableOptions = { events: [], services: [] } } = useQuery({
    queryKey: ['tv-selector-options'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayStr = serviceDate; // Use current state date
      
      // Fetch Events (Active/Confirmed)
      const events = await base44.entities.Event.filter({ status: 'confirmed' }, '-start_date');
      const relevantEvents = events.filter(e => {
        if (!e.start_date) return false;
        // Show recent past (7 days) and future (90 days)
        const start = new Date(e.start_date);
        const diffDays = (start - today) / (1000 * 60 * 60 * 24);
        return diffDays > -7 && diffDays < 90;
      });

      // Fetch Services (Active, date-specific)
      const services = await base44.entities.Service.filter({ status: 'active' }, '-date');
      const relevantServices = services.filter(s => {
         if (!s.date || s.origin === 'blueprint') return false;
         // Show recent past (2 days) and future (7 days)
         const sDate = new Date(s.date);
         const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
         return diffDays > -2 && diffDays < 14;
      });

      return { events: relevantEvents, services: relevantServices };
    },
    refetchInterval: 60000
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

  // ─── SEGMENT DETERMINATION ───
  const { currentSegment, nextSegment, preLaunchSegment, upcomingSegments } = useMemo(() => {
    if (!segments || segments.length === 0) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
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
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
    }

    // Check isToday
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
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
    }

    // Find current: segment where start <= now <= end
    const current = validSegments.find(s => {
      const start = getTimeDate(s.start_time);
      const end = s.end_time ? getTimeDate(s.end_time) : (start ? new Date(start.getTime() + (s.duration_min || 0) * 60000) : null);
      return start && end && currentTime >= start && currentTime <= end;
    }) || null;

    // Find next (single immediate next)
    const next = validSegments.find(s => {
      const start = getTimeDate(s.start_time);
      return start && start > currentTime;
    }) || null;

    // Find all upcoming (for list) - limit to next 5
    const upcoming = validSegments.filter(s => {
      const start = getTimeDate(s.start_time);
      return start && start > currentTime;
    }).slice(0, 5) || [];

    // Pre-launch: if nothing is current, countdown to FIRST segment
    let preLaunch = null;
    if (!current) {
      const first = validSegments[0];
      const firstStart = getTimeDate(first.start_time);
      if (firstStart && currentTime < firstStart) {
        preLaunch = first;
      }
    }

    return { 
      currentSegment: current, 
      nextSegment: next, 
      preLaunchSegment: preLaunch,
      upcomingSegments: upcoming
    };
  }, [segments, currentTime, serviceDate]);

  // Helper to switch context
  const handleSelectionChange = (val) => {
    if (!val) return;
    const [type, id] = val.split(':');
    setServiceId(id);
    // Optionally update URL without reload
    const newUrl = new URL(window.location);
    if (type === 'event') {
      newUrl.searchParams.set('event_id', id);
      newUrl.searchParams.delete('service_id');
    } else {
      newUrl.searchParams.set('service_id', id);
      newUrl.searchParams.delete('event_id');
    }
    window.history.pushState({}, '', newUrl);
  };

  // If no service selected or loading, show selector screen
  if (!service && !isLoadingService) {
    return (
      <div className="w-full h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-4 border-slate-200 rounded-3xl shadow-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1F8A70] to-[#8DC63F] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
              <Tv className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">TV Display Mode</h1>
            <p className="text-slate-500">Select an active event or service to display</p>
          </div>

          <div className="space-y-4">
            <Select onValueChange={handleSelectionChange}>
              <SelectTrigger className="h-14 text-lg bg-white border-2 border-slate-300">
                <SelectValue placeholder="Select program..." />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.events.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Events</div>
                    {availableOptions.events.map(e => (
                      <SelectItem key={e.id} value={`event:${e.id}`} className="py-3">
                        <span className="font-bold">{e.name}</span>
                        <span className="ml-2 text-slate-400 text-xs">({formatDateET(e.start_date)})</span>
                      </SelectItem>
                    ))}
                  </>
                )}
                {availableOptions.services.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Services</div>
                    {availableOptions.services.map(s => (
                      <SelectItem key={s.id} value={`service:${s.id}`} className="py-3">
                        <span className="font-bold">{s.name}</span>
                        <span className="ml-2 text-slate-400 text-xs">({formatDateET(s.date)})</span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            
            <div className="text-center text-xs text-slate-400 mt-8">
              Waiting for selection...
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // All done for today
  const allDone = !currentSegment && !nextSegment && !preLaunchSegment;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col items-center justify-center overflow-hidden relative group/ui">
      {/* Top Gradient Bar */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Controls (Hidden by default, show on hover/interaction) */}
      <div className="absolute top-6 left-6 z-30 opacity-0 group-hover/ui:opacity-100 transition-opacity duration-300">
        <Select onValueChange={handleSelectionChange}>
          <SelectTrigger className="w-auto h-10 bg-white/80 backdrop-blur border-none shadow-sm text-slate-600 font-medium px-4 gap-2 hover:bg-white transition-all rounded-full">
            <Settings className="w-4 h-4" />
            <span>Switch Program</span>
          </SelectTrigger>
          <SelectContent align="start">
            {availableOptions.events.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Events</div>
                {availableOptions.events.map(e => (
                  <SelectItem key={e.id} value={`event:${e.id}`}>
                    {e.name} <span className="text-slate-400 text-xs">({formatDateET(e.start_date)})</span>
                  </SelectItem>
                ))}
              </>
            )}
            {availableOptions.services.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Services</div>
                {availableOptions.services.map(s => (
                  <SelectItem key={s.id} value={`service:${s.id}`}>
                    {s.name} <span className="text-slate-400 text-xs">({formatDateET(s.date)})</span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

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
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full h-[55vh] lg:h-[60vh]">

              {/* LEFT PANEL (Main): In-Progress OR Pre-Launch (60% width) */}
              <div className="lg:col-span-3 h-full">
                {currentSegment ? (
                  <CountdownBlock
                    segment={currentSegment}
                    displayMode="in-progress"
                    currentTime={currentTime}
                    serviceDate={serviceDate}
                    getTimeDate={getTimeDate}
                    className="h-full"
                  />
                ) : preLaunchSegment ? (
                  <CountdownBlock
                    segment={preLaunchSegment}
                    displayMode="pre-launch"
                    currentTime={currentTime}
                    serviceDate={serviceDate}
                    getTimeDate={getTimeDate}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full bg-white rounded-3xl border-4 border-slate-200 p-8 md:p-10 shadow-lg flex items-center justify-center">
                    <p className="text-slate-400 italic text-lg">{t('live.nothingNow')}</p>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Upcoming Agenda (40% width) */}
              <div className="lg:col-span-2 h-full">
                {upcomingSegments.length > 0 ? (
                  <SegmentTimeline
                    segments={upcomingSegments}
                    getTimeDate={getTimeDate}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 p-8 flex items-center justify-center">
                    <p className="text-slate-400 italic font-medium">{t('live.endOfProgram')}</p>
                  </div>
                )}
              </div>
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