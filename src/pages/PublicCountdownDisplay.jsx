import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeProgramData } from "@/components/utils/normalizeProgram";
import { normalizeStreamBlocks } from "@/components/utils/normalizeStreamBlocks";
import { Loader2, Layout, WifiOff } from "lucide-react";

import useActiveProgramCache from "@/components/myprogram/useActiveProgramCache";
import useSegmentDetection, { getTimeDate } from "@/components/tv/useSegmentDetection";

import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import StandbyScreen from "@/components/service/StandbyScreen";
import StreamSidecarTimeline from "@/components/live/StreamSidecarTimeline";
import TeamServersDisplay from "@/components/service/TeamServersDisplay";

/**
 * PublicCountdownDisplay — TV Display (Dumb Terminal)
 *
 * REFACTORED 2026-03-01:
 *   - Segment detection extracted to useSegmentDetection hook (reusable by MyProgram)
 *   - getTimeDate is now a pure exported function, not a closure over component state
 *   - Clipping fix: replaced overflow-hidden on grid columns with overflow-visible + padding
 *     to prevent shadow/glow/ring cutoff on CountdownBlock and action cards
 *   - Unused import `Radio` removed
 *
 * Zero-interaction display. Auto-detects active event/service via ActiveProgramCache.
 * Two states:
 *   1. Active program → bento grid (countdown+actions | timeline+servers | stream sidecar)
 *   2. No active program → StandbyScreen
 */
export default function PublicCountdownDisplay() {
  const { t } = useLanguage();

  // ── Testing override: URL params ──
  const urlParams = new URLSearchParams(window.location.search);
  const overrideServiceId = urlParams.get('override_service_id');
  const overrideEventId = urlParams.get('override_event_id');
  const mockTimeParam = urlParams.get('mock_time');
  const isOverrideMode = !!(overrideServiceId || overrideEventId);

  // ── Clock tick (1 s) — freeze if mock time provided ──
  const [currentTime, setCurrentTime] = useState(() => {
    if (mockTimeParam) {
      const [h, m] = mockTimeParam.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return new Date();
  });

  useEffect(() => {
    if (mockTimeParam) return;
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [mockTimeParam]);

  // ── Data: cache-first from ActiveProgramCache ──
  const { programData, isLoading, isError, cacheRecord, _isOverride } = useActiveProgramCache({
    overrideServiceId,
    overrideEventId,
  });

  // ── Normalize program data ──
  const normalizedData = useMemo(() => normalizeProgramData(programData), [programData]);
  const service = normalizedData.program;
  const segments = normalizedData.segments;
  const preSessionDetails = normalizedData.preSessionDetails || [];

  // ── Service date ──
  const serviceDate = useMemo(() => {
    if (service?.date) return service.date;
    if (service?.start_date) return service.start_date;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [service]);

  // ── Segment detection (extracted hook) ──
  const {
    currentSegment,
    nextSegment,
    preLaunchSegment,
    upcomingSegments,
    getTimeDateFn,
  } = useSegmentDetection({
    segments,
    currentTime,
    serviceDate,
    isOverrideMode,
  });

  // ── Stream blocks (livestream sidecar column) ──
  const streamBlocks = useMemo(
    () => normalizeStreamBlocks(programData?.streamBlocks || [], segments),
    [programData?.streamBlocks, segments]
  );
  const hasLivestreamSession = useMemo(() => {
    const sessions = programData?.sessions || [];
    return sessions.some((s) => s.has_livestream) && streamBlocks.length > 0;
  }, [programData?.sessions, streamBlocks]);

  // ── Active session for team display + scoped actions ──
  const activeSession = useMemo(() => {
    const sessions = programData?.sessions || [];
    if (sessions.length === 0) return null;
    if (sessions.length === 1) return sessions[0];
    if (currentSegment?.session_id) {
      return sessions.find(s => s.id === currentSegment.session_id) || sessions[0];
    }
    return sessions[0];
  }, [programData?.sessions, currentSegment]);

  const activePreSessionData = useMemo(() => {
    if (!activeSession || preSessionDetails.length === 0) return null;
    return preSessionDetails.find(p => p.session_id === activeSession.id) || preSessionDetails[0] || null;
  }, [activeSession, preSessionDetails]);

  // ── HARDENING (2026-03-08): Stale-data watchdog ──
  // Tracks how long since the cache was last refreshed. If the TV has been
  // running for 10+ minutes without a successful cache update, the subscription
  // or polling may have silently died. Force a full page reload to re-establish
  // all connections. This is the last-resort safety net for unattended TVs.
  const lastReloadCheckRef = useRef(Date.now());
  useEffect(() => {
    if (mockTimeParam || !cacheRecord?.last_refresh_at) return;
    const STALE_RELOAD_MS = 10 * 60 * 1000; // 10 min without cache update → reload
    const checkInterval = setInterval(() => {
      const cacheAge = Date.now() - new Date(cacheRecord.last_refresh_at).getTime();
      const timeSinceLastCheck = Date.now() - lastReloadCheckRef.current;
      // Only reload if: cache is stale AND we haven't just loaded the page
      // (prevents reload loops if the backend is truly down)
      if (cacheAge > STALE_RELOAD_MS && timeSinceLastCheck > STALE_RELOAD_MS) {
        console.warn('[TV Watchdog] Cache stale for 10+ min. Reloading page.');
        window.location.reload();
      }
    }, 60 * 1000); // Check every minute
    return () => clearInterval(checkInterval);
  }, [cacheRecord?.last_refresh_at, mockTimeParam]);

  // ── Offline / error state detection ──
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stale = cache older than 5 minutes (should refresh every ~2 min via poll)
  const isStaleData = useMemo(() => {
    if (!cacheRecord?.last_refresh_at) return false;
    return (Date.now() - new Date(cacheRecord.last_refresh_at).getTime()) > 5 * 60 * 1000;
  }, [cacheRecord?.last_refresh_at, currentTime]); // currentTime drives re-eval every second

  // ── Loading ──
  // Initial load only — isLoading in React Query v5 = isPending && isFetching,
  // which is only true when there is NO cached data at all.
  // Background refetches never set isLoading=true (handled by keepPreviousData in useActiveProgramCache).
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-pdv-teal animate-spin" />
      </div>
    );
  }

  // ── No active program → Standby ──
  if (!service) {
    return <StandbyScreen currentTime={currentTime} />;
  }

  // ── All done → Standby ──
  // SAFETY (2026-03-01): Verify ALL segment times are genuinely in the past
  // before declaring "all done". Prevents premature standby.
  const hasAnyFutureSegment = segments.some(s => {
    const st = s.actual_start_time || s.start_time;
    if (!st) return false;
    const segTime = getTimeDate(st, s.date, serviceDate, currentTime);
    return segTime && segTime > currentTime;
  });
  const allDone =
    !currentSegment &&
    !nextSegment &&
    !preLaunchSegment &&
    segments.length > 0 &&
    !hasAnyFutureSegment;
  if (allDone && !_isOverride) {
    return <StandbyScreen currentTime={currentTime} />;
  }

  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";

  // ── Active program display ──
  // CLIPPING FIX (2026-03-01): The outer container uses overflow-hidden to prevent
  // scrollbars on the TV, but this clips box-shadow/ring on nested cards.
  // Solution: add p-1 padding on columns so shadow/glow paints inside the clip boundary.
  // The grid gap and column padding together give cards room to breathe.
  return (
    <div className="w-full h-screen max-w-[100vw] bg-slate-50 p-1.5 md:p-2 flex flex-col items-center overflow-hidden relative light box-border">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Status indicators — offline only. isStaleData badge removed 2026-03-12:
          same reasoning as PublicProgramView — the timestamp created uncertainty without
          being actionable. The watchdog reload (below) handles stale cache silently.
          isError is also silent since the watchdog will reload if truly stuck. */}
      {isOffline && (
        <div className="absolute top-1.5 right-2 z-30">
          <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-red-200">
            <WifiOff className="w-3 h-3" />
            <span>Sin conexión</span>
          </div>
        </div>
      )}

      {/* Header: title + clock */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 z-20 relative mb-1">
        <div className="flex-1 text-center min-w-0">
          <h1 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}>
            {service.name}
          </h1>
          {_isOverride && (
            <div className="text-xs text-orange-600 font-semibold mt-0.5">
              TEST MODE (Override Active)
            </div>
          )}
        </div>
        <div className="flex-shrink-0 ml-3">
          <div className="text-lg md:text-xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
            {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
          </div>
        </div>
      </div>

      {/* Bento grid */}
      <div className="w-full flex-1 overflow-hidden px-1 z-10 min-h-0">
        <div
          className="w-full h-full grid gap-1"
          style={{ gridTemplateColumns: hasLivestreamSession ? '1fr 1fr minmax(180px, 0.5fr)' : '1fr 1fr' }}
        >
          {/* Col 1: Countdown + Actions — p-1 prevents shadow clipping */}
          <div className="flex flex-col gap-1 min-w-0 overflow-hidden p-1">
            <div className="pt-3">
              {currentSegment ? (
                <CountdownBlock
                  segment={currentSegment}
                  displayMode="in-progress"
                  currentTime={currentTime}
                  serviceDate={currentSegment?.date || serviceDate}
                  getTimeDate={getTimeDateFn}
                  size="compact"
                />
              ) : preLaunchSegment ? (
                <CountdownBlock
                  segment={preLaunchSegment}
                  displayMode="pre-launch"
                  currentTime={currentTime}
                  serviceDate={preLaunchSegment?.date || serviceDate}
                  getTimeDate={getTimeDateFn}
                  size="compact"
                />
              ) : (
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                  <p className="text-slate-400 italic text-xs">{t('tv.noActiveSegment')}</p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <CoordinatorActionsDisplay
                currentSegment={currentSegment}
                nextSegment={nextSegment}
                allSegments={segments}
                sessions={programData?.sessions || []}
                preSessionData={activePreSessionData}
                currentTime={currentTime}
                serviceDate={serviceDate}
                layout="grid"
              />
            </div>
          </div>

          {/* Col 2: Timeline + Servers — p-1 prevents shadow clipping */}
          <div className="flex flex-col gap-1 h-full min-w-0 overflow-hidden p-1">
            <div className="flex-1 flex flex-col gap-0 overflow-hidden bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm min-h-0">
              <div className="bg-slate-100/80 px-3 py-1.5 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Layout className="w-3 h-3" />
                  {t('tv.roomProgram')}
                </div>
                {upcomingSegments.length > 0 && (
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {t('tv.upNext')}
                  </div>
                )}
              </div>
              </div>
              <div className="flex-1 relative p-1.5 min-h-0">
                <div className="absolute inset-0 p-1.5 overflow-y-auto">
                  {upcomingSegments.length > 0 ? (
                    <SegmentTimeline
                      segments={upcomingSegments}
                      sessions={programData?.sessions || []}
                      getTimeDate={getTimeDateFn}
                      serviceDate={serviceDate}
                      className="h-full"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                      {t("live.endOfProgram")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <TeamServersDisplay session={activeSession} />
            </div>
          </div>

          {/* Col 3: Livestream Sidecar — only when stream blocks exist */}
          {hasLivestreamSession && (() => {
            const sess = (programData?.sessions || []).find((s) => s.has_livestream);
            if (!sess) return null;
            return (
              <div className="flex flex-col gap-0 overflow-hidden bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm h-full p-1">
                <StreamSidecarTimeline
                  session={sess}
                  segments={segments.filter((s) => s.session_id === sess.id)}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}