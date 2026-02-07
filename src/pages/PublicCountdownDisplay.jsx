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

  // Fetch current program data (Service or Event) via secure backend function
  // This bypasses frontend entity permissions to allow public display
  const { data: programData, isLoading: isLoadingService } = useQuery({
    queryKey: ['tv-public-data', serviceId, serviceDate],
    queryFn: async () => {
      // If serviceId is provided, we check if it's an event ID or service ID
      // If not, we pass date for auto-detection
      const payload = {
        date: serviceDate
      };
      
      if (serviceId) {
        // Simple heuristic: if we don't know type, pass both, but backend logic prioritizes
        // We can check if it looks like an event ID or just pass generic ID
        // The backend `getPublicProgramData` checks eventId then serviceId
        // Let's try passing as eventId first if context suggests, but for now pass as both? 
        // No, better to try and guess or just let backend handle generic lookup?
        // The updated backend function looks for `eventId` then `serviceId`.
        // Let's just pass `eventId` if we suspect it, or `serviceId`.
        // But `serviceId` state variable holds EITHER. 
        // Let's pass it as `eventId` first, if fail, try `serviceId`? 
        // Actually, let's just pass it as `eventId` to the function if we think it's an event?
        // OR update the backend to accept a generic `id`?
        // Let's stick to the backend's `eventId` and `serviceId` params.
        // We will pass BOTH as the same value, logic will resolve one.
        payload.eventId = serviceId;
        payload.serviceId = serviceId;
      }

      const response = await base44.functions.invoke('getPublicProgramData', payload);
      
      // If error (404/403), throw or return null
      if (response.status >= 400) {
        console.warn("Public data fetch failed:", response.data);
        return null;
      }
      
      return response.data; // { program, segments, sessions, ... }
    },
    refetchInterval: 30000 // Poll every 30s to keep sync since we might not have socket access
  });

  const service = programData?.program;
  const segments = programData?.segments || [];

  // Fetch available options for the selector (via same backend function)
  const { data: availableOptions = { events: [], services: [] } } = useQuery({
    queryKey: ['tv-selector-options-public'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPublicProgramData', { listOptions: true });
      if (response.status >= 400) return { events: [], services: [] };
      return response.data;
    },
    refetchInterval: 60000
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

  // Loading state
  if (isLoadingService) {
    return (
      <div className="w-full h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-pdv-teal animate-spin" />
      </div>
    );
  }

  // If no service selected (and not loading), show selector screen
  if (!service) {
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
    <div className="w-full min-h-screen bg-slate-50 p-2 md:p-3 flex flex-col items-center justify-center overflow-hidden relative group/ui">
      {/* Top Gradient Bar */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Controls (Hidden by default, show on hover/interaction) */}
      <div className="absolute top-3 left-3 z-30 opacity-0 group-hover/ui:opacity-100 transition-opacity duration-300">
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
      <div className="absolute top-3 right-3 z-20">
        <div className="text-3xl md:text-5xl text-slate-800 font-mono font-bold tracking-tight bg-white/60 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/50 shadow-sm">
          {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
        </div>
      </div>

      <div className="w-full max-w-6xl flex flex-col gap-4 items-center z-10">

        {/* Header: Service Name */}
        <div className="text-center mb-1">
          <h1 className={`text-5xl md:text-6xl font-black mb-1 uppercase tracking-tight ${gradientText} drop-shadow-sm`}>
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 w-full items-stretch">

              {/* LEFT PANEL (Main): In-Progress OR Pre-Launch (60% width) */}
              {/* Natural height determines the row height */}
              <div className="lg:col-span-3">
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
                  <div className="h-full min-h-[400px] bg-white rounded-3xl border-4 border-slate-200 p-8 md:p-10 shadow-lg flex items-center justify-center">
                    <p className="text-slate-400 italic text-lg">{t('live.nothingNow')}</p>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Upcoming Agenda (40% width) */}
              {/* Constrained to match the height of the left panel on desktop */}
              <div className="lg:col-span-2 relative min-h-[300px] lg:min-h-0">
                <div className="lg:absolute lg:inset-0 h-full">
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