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
import { Tv, Settings, Loader2, Radio, Layout } from "lucide-react";
import StandbyScreen from "@/components/service/StandbyScreen";
import StreamSidecarTimeline from "@/components/live/StreamSidecarTimeline";

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

  // Mode fixed to dashboard
  const mode = 'dashboard';
  
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

    // Include ALL segment types (including breaks) so the timeline is continuous.
    // Breaks render as visual dividers, not full cards — but they must be in the list
    // to avoid a "program reset" gap after recess.
    const validSegments = segments
      .filter(s => {
        if (s.live_status === 'skipped') return false;
        const hasTime = s.actual_start_time || s.start_time;
        if (!hasTime) return false;
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

    // For countdown purposes, skip break types — they don't drive the timer
    const isBreakSeg = (s) => {
      const t = (s.segment_type || s.type || '').toLowerCase();
      return ['receso', 'almuerzo', 'break'].includes(t) || s.major_break;
    };

    const current = validSegments.find(s => {
      if (isBreakSeg(s)) return false;
      const start = getTimeDate(s._effectiveStart, s.date);
      const end = s._effectiveEnd ? getTimeDate(s._effectiveEnd, s.date) : (start ? new Date(start.getTime() + (s.duration_min || 0) * 60000) : null);
      if (s.live_hold_status === 'held') return true;
      return start && end && currentTime >= start && currentTime <= end;
    }) || null;

    const next = validSegments.find(s => {
      if (s === current) return false;
      if (isBreakSeg(s)) return false;
      const start = getTimeDate(s._effectiveStart, s.date);
      return start && start > currentTime;
    }) || null;

    // Upcoming includes ALL types (breaks render as dividers in SegmentTimeline)
    const upcoming = validSegments.filter(s => {
      if (s === current) return false;
      const start = getTimeDate(s._effectiveStart, s.date);
      return start && start > currentTime;
    }).slice(0, 8) || [];

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

  // Determine if livestream column should show
  const hasLivestreamSession = useMemo(() => {
    const sessions = programData?.sessions || [];
    return sessions.some(s => s.has_livestream) && streamBlocks.length > 0;
  }, [programData?.sessions, streamBlocks]);

  const allDone = !currentSegment && !nextSegment && !preLaunchSegment && segments.length > 0;
  
  // If all segments are done, show standby full-screen (no page header)
  if (allDone) {
    return <StandbyScreen currentTime={currentTime} />;
  }

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
    <div className="w-full h-screen bg-slate-50 p-3 md:p-4 flex flex-col items-center overflow-hidden relative group/ui light">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Header */}
      <div className="w-full flex items-center justify-between px-4 py-3 z-20 relative mb-2">
        <div className="flex-1 text-center min-w-0">
          <h1 className={`text-2xl md:text-4xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}>
            {service.name}
          </h1>
        </div>
        <div className="flex-shrink-0 ml-4">
          <div className="text-xl md:text-3xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col gap-3 items-center z-10 flex-1 px-2">
        {/* Dynamic bento grid: 3-col when livestream exists, 2-col (wider) when it doesn't */}
        {(
          <div
            className="w-full h-full flex-1 overflow-hidden min-h-[600px] grid gap-3"
            style={{ gridTemplateColumns: hasLivestreamSession ? '1fr 1fr minmax(200px, 0.5fr)' : '1fr 1fr' }}
          >
            {/* Col 1: Status Sidecar (Countdown + Actions) */}
            <div className="flex flex-col gap-3 overflow-visible min-w-0">
              {/* pt-5 ensures the floating label (-top-4) is not clipped */}
              <div className="pt-5">
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
              </div>

              {/* Coordinator Actions — horizontal cards when multiple, per bento spec */}
              <div className="flex-1 overflow-y-auto">
                <CoordinatorActionsDisplay
                  currentSegment={currentSegment}
                  nextSegment={nextSegment}
                  currentTime={currentTime}
                  serviceDate={serviceDate}
                  layout="grid"
                />
              </div>
            </div>

            {/* Col 2: Main Program Timeline (Full Height) */}
            <div className="flex flex-col gap-0 overflow-hidden bg-white/80 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-sm h-full">
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

            {/* Col 3: Livestream Sidecar — only rendered when stream blocks exist */}
            {hasLivestreamSession && (
              <div className="flex flex-col gap-0 overflow-hidden bg-white/80 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-sm h-full">
                {(() => {
                  const sess = (programData?.sessions || []).find(s => s.has_livestream);
                  if (sess) {
                    return (
                      <StreamSidecarTimeline
                        session={sess}
                        segments={segments.filter(s => s.session_id === sess.id)}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}