import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST, formatDateET } from "@/components/utils/timeFormat";
import { normalizeProgramData } from "@/components/utils/normalizeProgram";
import { normalizeStreamBlocks } from "@/components/utils/normalizeStreamBlocks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tv, Settings, Loader2, Radio, Layout, Columns } from "lucide-react";
import StandbyScreen from "@/components/service/StandbyScreen";
import StreamCoordinatorView from "@/components/live/StreamCoordinatorView";

/**
 * PublicCountdownDisplay
 * 
 * Public-facing TV display for live service status.
 * 
 * Modes:
 * - Standard: Main program only (Room View)
 * - Livestream: Stream program only (Stream View)
 * - Combined: Split screen (Room + Stream)
 */
export default function PublicCountdownDisplay() {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Brand gradient style
  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";
  const [serviceId, setServiceId] = useState(null);
  const [serviceDate, setServiceDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const urlParams = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState(urlParams.get('mode') || 'standard'); // standard, livestream, combined
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m && m !== mode) setMode(m);
  }, [window.location.search]);

  const updateMode = (newMode) => {
    setMode(newMode);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('mode', newMode);
    window.history.pushState({}, '', newUrl);
  };
  
  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (!serviceId) {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('service_id') && !params.get('event_id') && !params.get('date')) {
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          
          setServiceDate(prev => prev !== todayStr ? todayStr : prev);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [serviceId]);

  // URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const svcId = params.get('service_id');
    const evtId = params.get('event_id');
    const dt = params.get('date');
    if (svcId) setServiceId(svcId);
    if (evtId) setServiceId(evtId);
    if (dt) setServiceDate(dt);
  }, []);

  // Fetch program data
  const { data: programData, isLoading: isLoadingService } = useQuery({
    queryKey: ['tv-public-data', serviceId, serviceDate],
    queryFn: async () => {
      const payload = {
        date: serviceDate
      };
      
      if (serviceId) {
        payload.eventId = serviceId;
        payload.serviceId = serviceId;
      }

      const response = await base44.functions.invoke('getPublicProgramData', payload);
      if (response.status >= 400) return null;
      return response.data;
    },
    refetchInterval: 30000 
  });

  // Normalize data
  const normalizedData = useMemo(() => normalizeProgramData(programData), [programData]);
  const service = normalizedData.program;
  const segments = normalizedData.segments;
  
  const streamBlocks = useMemo(() => 
    normalizeStreamBlocks(programData?.streamBlocks || [], segments), 
    [programData?.streamBlocks, segments]
  );

  // Sync date
  useEffect(() => {
    if (service) {
      const rawDate = service.date || service.start_date;
      if (rawDate && rawDate !== serviceDate) {
        setServiceDate(rawDate);
      }
    }
  }, [service, serviceDate]);

  // Fetch options
  const { data: availableOptions = { events: [], services: [] } } = useQuery({
    queryKey: ['tv-selector-options-public'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPublicProgramData', { listOptions: true });
      if (response.status >= 400) return { events: [], services: [] };
      return response.data;
    },
    refetchInterval: 60000
  });

  // Time Parser
  const getTimeDate = (timeStr, segmentDate = null) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    
    let date = new Date(currentTime);
    const targetDateStr = segmentDate || serviceDate;

    if (targetDateStr) {
      const [y, m, d] = targetDateStr.split('-').map(Number);
      date = new Date(y, m - 1, d); 
    }
    
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // Segment Logic
  const { currentSegment, nextSegment, preLaunchSegment, upcomingSegments } = useMemo(() => {
    if (!segments || segments.length === 0) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
    }

    const validSegments = segments
      .filter(s => {
        if (s.live_status === 'skipped') return false;
        const hasTime = s.actual_start_time || s.start_time;
        if (!hasTime) return false;
        if (s.segment_type === 'Break' || s.segment_type === 'break') return false;
        return true;
      })
      .map(s => ({
        ...s,
        _effectiveStart: s.actual_start_time || s.start_time,
        _effectiveEnd: s.actual_end_time || s.end_time
      }))
      .sort((a, b) => {
        const tA = getTimeDate(a._effectiveStart);
        const tB = getTimeDate(b._effectiveStart);
        if (!tA && !tB) return 0;
        if (!tA) return 1;
        if (!tB) return -1;
        return tA - tB;
      });

    if (validSegments.length === 0) {
      return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
    }

    const current = validSegments.find(s => {
      const start = getTimeDate(s._effectiveStart, s.date);
      const end = s._effectiveEnd ? getTimeDate(s._effectiveEnd, s.date) : (start ? new Date(start.getTime() + (s.duration_min || 0) * 60000) : null);
      if (s.live_hold_status === 'held') return true;
      return start && end && currentTime >= start && currentTime <= end;
    }) || null;

    const next = validSegments.find(s => {
      if (s === current) return false;
      const start = getTimeDate(s._effectiveStart, s.date);
      return start && start > currentTime;
    }) || null;

    const upcoming = validSegments.filter(s => {
      if (s === current) return false;
      const start = getTimeDate(s._effectiveStart, s.date);
      return start && start > currentTime;
    }).slice(0, 5) || [];

    let preLaunch = null;
    if (!current && next) {
      preLaunch = next;
    } else if (!current && !next && validSegments.length > 0) {
       const first = validSegments[0];
       const firstStart = getTimeDate(first._effectiveStart, first.date);
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

  // Selection Switcher
  const handleSelectionChange = (val) => {
    if (!val) return;
    const [type, id] = val.split(':');
    setServiceId(id);
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

  // Render Logic
  if (isLoadingService) {
    return (
      <div className="w-full h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-pdv-teal animate-spin" />
      </div>
    );
  }

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
                {availableOptions.events.map(e => (
                  <SelectItem key={e.id} value={`event:${e.id}`}>{e.name} ({formatDateET(e.start_date)})</SelectItem>
                ))}
                {availableOptions.services.map(s => (
                  <SelectItem key={s.id} value={`service:${s.id}`}>{s.name} ({formatDateET(s.date)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>
    );
  }

  const allDone = !currentSegment && !nextSegment && !preLaunchSegment;
  
  // If Livestream Mode (Exclusive)
  if (mode === 'livestream') {
    // Find session with stream blocks
    const sessions = programData?.sessions || [];
    const sessionWithStream = sessions.find(s => s.has_livestream) || sessions[0];
    
    if (sessionWithStream) {
      return (
        <div className="w-full h-screen bg-slate-900 p-4">
          <StreamCoordinatorView 
            session={sessionWithStream}
            segments={segments.filter(s => s.session_id === sessionWithStream.id)}
            currentUser={null} // Read-only mode
          />
        </div>
      );
    }
    return <div className="text-white text-center p-20">No livestream session found.</div>;
  }

  // Combined Mode (Left: Room, Right: Stream)
  // Or Standard Mode
  const isCombined = mode === 'combined';

  return (
    <div className="w-full min-h-screen bg-slate-50 p-3 md:p-4 flex flex-col items-center overflow-hidden relative group/ui light">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-4 z-20 relative mb-4">
        {/* View Controls */}
        <div className="flex-shrink-0 w-[300px] flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur-md p-1 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1">
            <button 
              onClick={() => updateMode('standard')}
              className={`p-2 rounded-md transition-colors ${mode === 'standard' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              title="Standard View"
            >
              <Tv className="w-5 h-5" />
            </button>
            <button 
              onClick={() => updateMode('combined')}
              className={`p-2 rounded-md transition-colors ${mode === 'combined' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              title="Combined View (Split)"
            >
              <Columns className="w-5 h-5" />
            </button>
            <button 
              onClick={() => updateMode('livestream')}
              className={`p-2 rounded-md transition-colors ${mode === 'livestream' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              title="Livestream View Only"
            >
              <Radio className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 text-center px-4 min-w-0">
          <h1 className={`text-3xl md:text-5xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}>
            {service.name}
          </h1>
        </div>
        <div className="flex-shrink-0 w-[300px] flex justify-end">
          <div className="text-2xl md:text-4xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-5 py-2 rounded-xl border border-slate-200 shadow-sm">
            {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1800px] flex flex-col gap-5 items-center z-10 flex-1">
        {allDone ? (
          <StandbyScreen currentTime={currentTime} />
        ) : (
          <div className="grid grid-cols-12 gap-4 w-full h-full flex-1 overflow-hidden min-h-[600px]">
            {/* Col 1: Status Sidecar (Countdown + Actions) */}
            <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
              {/* Primary Countdown (Compact) */}
              {currentSegment ? (
                <CountdownBlock
                  segment={currentSegment}
                  displayMode="in-progress"
                  currentTime={currentTime}
                  serviceDate={currentSegment?.date || serviceDate}
                  getTimeDate={getTimeDate}
                  size="compact"
                  className="w-full"
                />
              ) : preLaunchSegment ? (
                <CountdownBlock
                  segment={preLaunchSegment}
                  displayMode="pre-launch"
                  currentTime={currentTime}
                  serviceDate={preLaunchSegment?.date || serviceDate}
                  getTimeDate={getTimeDate}
                  size="compact"
                  className="w-full"
                />
              ) : (
                <div className="bg-white rounded-3xl border-4 border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
                  <p className="text-slate-400 italic text-sm">No active segment</p>
                </div>
              )}

              {/* Coordinator Actions (Vertical Stack) */}
              <div className="flex-1 overflow-y-auto">
                <CoordinatorActionsDisplay
                  currentSegment={currentSegment}
                  nextSegment={nextSegment}
                  currentTime={currentTime}
                  serviceDate={serviceDate}
                  layout="vertical"
                />
              </div>
            </div>

            {/* Col 2: Main Program Timeline (Full Height) */}
            <div className="col-span-5 flex flex-col gap-0 overflow-hidden bg-white/80 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-sm h-full">
              <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Layout className="w-4 h-4" />
                  Room Program
                </div>
              </div>
              <div className="flex-1 relative p-2">
                <div className="absolute inset-0 p-2">
                  {upcomingSegments.length > 0 ? (
                    <SegmentTimeline
                      segments={upcomingSegments}
                      getTimeDate={getTimeDate}
                      serviceDate={serviceDate}
                      className="h-full"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 italic">
                      {t('live.endOfProgram')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Col 3: Livestream Sidecar (Full Height) */}
            <div className="col-span-4 flex flex-col gap-0 overflow-hidden bg-slate-900/5 rounded-2xl border border-slate-200/60 shadow-inner h-full">
              <div className="bg-slate-800 px-4 py-3 text-white border-b border-slate-700">
                <div className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                  Livestream
                </div>
              </div>
              <div className="flex-1 relative">
                {(() => {
                  const sess = (programData?.sessions || []).find(s => s.has_livestream) || (programData?.sessions || [])[0];
                  if (sess) {
                    return (
                      <StreamCoordinatorView 
                        session={sess}
                        segments={segments.filter(s => s.session_id === sess.id)}
                        currentUser={null}
                        embedded={true}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex items-center justify-center p-8 text-center text-slate-400">
                      <p>No livestream session configured</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}