import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeProgramData } from "@/components/utils/normalizeProgram";
import { Loader2, Layout, Radio } from "lucide-react";
import StandbyScreen from "@/components/service/StandbyScreen";
import StreamSidecarTimeline from "@/components/live/StreamSidecarTimeline";
import TeamServersDisplay from "@/components/service/TeamServersDisplay";
import { normalizeStreamBlocks } from "@/components/utils/normalizeStreamBlocks";
import useActiveProgramCache from "@/components/myprogram/useActiveProgramCache";

/**
 * PublicCountdownDisplay — TV Display (Dumb Terminal)
 *
 * Zero-interaction display. Auto-detects the active event/service via
 * getPublicProgramData({ detectActive: true, includeOptions: true }).
 *
 * Two states:
 *   1. Active program found → bento grid (countdown+actions | program timeline | stream sidecar if applicable)
 *   2. No active program   → StandbyScreen
 *
 * No selectors, no mode toggles, no URL-driven overrides.
 * Stream column auto-appears when the active session has has_livestream + stream blocks.
 * Polls every 30s for data refresh. Clock ticks every second.
 */
export default function PublicCountdownDisplay() {
  const { t } = useLanguage();

  // ── Testing override: check URL params ──
  const urlParams = new URLSearchParams(window.location.search);
  const overrideServiceId = urlParams.get('override_service_id');
  const overrideEventId = urlParams.get('override_event_id');
  const mockTimeParam = urlParams.get('mock_time'); // HH:MM format

  // ── Clock tick (1 s) — use mock time if provided ──
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
    if (mockTimeParam) return; // Don't tick if using mock time
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [mockTimeParam]);

  // Brand gradient for header title
  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";

  // ── Read from ActiveProgramCache (instant, no backend call) ──
  const { programData, isLoading, _isOverride } = useActiveProgramCache({
    overrideServiceId,
    overrideEventId,
  });

  // ── Normalize ──
  const normalizedData = useMemo(
    () => normalizeProgramData(programData),
    [programData]
  );
  const service = normalizedData.program;
  const segments = normalizedData.segments;
  const preSessionDetails = normalizedData.preSessionDetails || [];

  // ── Stream blocks (for livestream sidecar column) ──
  const streamBlocks = useMemo(
    () => normalizeStreamBlocks(programData?.streamBlocks || [], segments),
    [programData?.streamBlocks, segments]
  );

  // Show livestream column when session has has_livestream AND stream blocks exist
  const hasLivestreamSession = useMemo(() => {
    const sessions = programData?.sessions || [];
    return sessions.some((s) => s.has_livestream) && streamBlocks.length > 0;
  }, [programData?.sessions, streamBlocks]);

  // Derive serviceDate from program
  const serviceDate = useMemo(() => {
    if (service?.date) return service.date;
    if (service?.start_date) return service.start_date;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [service]);

  // ── Time parser ──
  const getTimeDate = (timeStr, segmentDate = null) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(":").map(Number);
    const target = segmentDate || serviceDate;
    let date;
    if (target) {
      const [y, m, d] = target.split("-").map(Number);
      date = new Date(y, m - 1, d);
    } else {
      date = new Date(currentTime);
    }
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // ── Segment logic ──
  const { currentSegment, nextSegment, preLaunchSegment, upcomingSegments } =
    useMemo(() => {
      const empty = {
        currentSegment: null,
        nextSegment: null,
        preLaunchSegment: null,
        upcomingSegments: [],
      };
      if (!segments || segments.length === 0) return empty;

      const validSegments = segments
        .filter((s) => {
          if (s.live_status === "skipped") return false;
          return s.actual_start_time || s.start_time;
        })
        .map((s) => ({
          ...s,
          _effectiveStart: s.actual_start_time || s.start_time,
          _effectiveEnd: s.actual_end_time || s.end_time,
        }))
        .sort((a, b) => {
          // DECISION-004: Sort by date FIRST (multi-day events), then by time
          const tA = getTimeDate(a._effectiveStart, a.date);
          const tB = getTimeDate(b._effectiveStart, b.date);
          if (!tA && !tB) return 0;
          if (!tA) return 1;
          if (!tB) return -1;
          return tA - tB;
        });

      if (validSegments.length === 0) return empty;

      // Breaks don't drive countdowns, but appear in timeline as dividers
      const isBreakSeg = (s) => {
        const tp = (s.segment_type || s.type || "").toLowerCase();
        return (
          ["receso", "almuerzo", "break"].includes(tp) || s.major_break
        );
      };

      const current =
        validSegments.find((s) => {
          if (isBreakSeg(s)) return false;
          const start = getTimeDate(s._effectiveStart, s.date);
          const end = s._effectiveEnd
            ? getTimeDate(s._effectiveEnd, s.date)
            : start
              ? new Date(start.getTime() + (s.duration_min || 0) * 60000)
              : null;
          if (s.live_hold_status === "held") return true;
          return start && end && currentTime >= start && currentTime <= end;
        }) || null;

      const next =
        validSegments.find((s) => {
          if (s === current || isBreakSeg(s)) return false;
          const start = getTimeDate(s._effectiveStart, s.date);
          return start && start > currentTime;
        }) || null;

      // Timeline includes breaks (rendered as dividers by SegmentTimeline)
      // No hard limit — the timeline container is scrollable and naturally
      // shrinks as past segments drop off. A two-service setup (9:30am+11:30am)
      // can have 11+ segments; a fixed slice(0,8) was cutting off the tail.
      //
      // FIX (ATT-014): In override/debug mode, show ALL segments when none are
      // currently active — otherwise the TV layout is blank for past/future services.
      const isOverrideMode = !!(overrideServiceId || overrideEventId);
      const upcoming = validSegments
        .filter((s) => {
          if (s === current) return false;
          const start = getTimeDate(s._effectiveStart, s.date);
          if (!start) return false;
          // In override mode with no current segment, show all segments
          if (isOverrideMode && !current) return true;
          return start > currentTime;
        });

      let preLaunch = null;
      if (!current && next) {
        preLaunch = next;
      } else if (!current && !next && validSegments.length > 0) {
        const first = validSegments[0];
        const firstStart = getTimeDate(first._effectiveStart, first.date);
        // FIX (ATT-014): In override mode, always show first segment as pre-launch
        // so the TV layout isn't blank for past/future services.
        if (isOverrideMode || (firstStart && currentTime < firstStart)) preLaunch = first;
      }

      return {
        currentSegment: current,
        nextSegment: next,
        preLaunchSegment: preLaunch,
        upcomingSegments: upcoming,
      };
    }, [segments, currentTime, serviceDate]);

  // Derive the active session for team display
  const activeSession = useMemo(() => {
    const sessions = programData?.sessions || [];
    if (sessions.length === 0) return null;
    if (sessions.length === 1) return sessions[0];
    if (currentSegment?.session_id) {
      return sessions.find(s => s.id === currentSegment.session_id) || sessions[0];
    }
    return sessions[0];
  }, [programData?.sessions, currentSegment]);

  // PreSessionDetails for the active session (used by CoordinatorActionsDisplay)
  const activePreSessionData = useMemo(() => {
    if (!activeSession || preSessionDetails.length === 0) return null;
    return preSessionDetails.find(p => p.session_id === activeSession.id) || preSessionDetails[0] || null;
  }, [activeSession, preSessionDetails]);

  // Segments scoped to the active session only (not all sessions in the day).
  // CoordinatorActionsDisplay should only show actions for the current session
  // (e.g. 9:30am), not bleed actions from a later session (e.g. 11:30am).
  const activeSessionSegments = useMemo(() => {
    if (!activeSession) return segments;
    return segments.filter(s => s.session_id === activeSession.id);
  }, [segments, activeSession]);

  // ── Loading ──
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
  // FIX (ATT-014): When override is active (debug mode), never go to standby
  // so admins can inspect the TV layout for any service/event regardless of date.
  const allDone =
    !currentSegment &&
    !nextSegment &&
    !preLaunchSegment &&
    segments.length > 0;
  if (allDone && !_isOverride) {
    return <StandbyScreen currentTime={currentTime} />;
  }

  // ── Active program display ──
  return (
    <div className="w-full h-screen bg-slate-50 p-1.5 md:p-2 flex flex-col items-center overflow-hidden relative light">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Header: title + clock */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 z-20 relative mb-1">
        <div className="flex-1 text-center min-w-0">
          <h1
            className={`text-xl md:text-2xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}
          >
            {service.name}
          </h1>
          {_isOverride && (
            <div className="text-xs text-orange-600 font-semibold mt-0.5">
              🧪 TEST MODE (Override Active)
            </div>
          )}
        </div>
        <div className="flex-shrink-0 ml-3">
          <div className="text-lg md:text-xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
            {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
          </div>
        </div>
      </div>

      {/* Bento grid: 2-col or 3-col when livestream sidecar is present */}
      <div className="w-full flex-1 overflow-hidden px-1 z-10">
        <div
          className="w-full h-full grid gap-2"
          style={{ gridTemplateColumns: hasLivestreamSession ? '1fr 1fr minmax(200px, 0.5fr)' : '1fr 1fr' }}
        >
          {/* Col 1: Countdown + Coordinator Actions */}
          <div className="flex flex-col gap-2 overflow-visible min-w-0">
            <div className="pt-2">
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
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                  <p className="text-slate-400 italic text-xs">
                    No active segment
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <CoordinatorActionsDisplay
                currentSegment={currentSegment}
                nextSegment={nextSegment}
                allSegments={segments}
                preSessionData={activePreSessionData}
                currentTime={currentTime}
                serviceDate={serviceDate}
                layout="grid"
              />
            </div>
          </div>

          {/* Col 2: Program Timeline + Team Servers */}
          <div className="flex flex-col gap-2 overflow-hidden h-full">
            {/* Room Program — raised bottom via gap */}
            <div className="flex-1 flex flex-col gap-0 overflow-hidden bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm min-h-0">
              <div className="bg-slate-100/80 px-3 py-1.5 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Layout className="w-3 h-3" />
                    Room Program
                  </div>
                  {upcomingSegments.length > 0 && (
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      A Continuación
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 relative p-1.5 min-h-0">
                <div className="absolute inset-0 p-1.5 overflow-y-auto">
                  {upcomingSegments.length > 0 ? (
                    <SegmentTimeline
                      segments={upcomingSegments}
                      getTimeDate={getTimeDate}
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

            {/* Servidores Box */}
            <div className="flex-shrink-0">
              <TeamServersDisplay session={activeSession} />
            </div>
          </div>

          {/* Col 3: Livestream Sidecar — auto-appears when stream blocks exist */}
          {hasLivestreamSession && (() => {
            const sess = (programData?.sessions || []).find((s) => s.has_livestream);
            if (!sess) return null;
            return (
              <div className="flex flex-col gap-0 overflow-hidden bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm h-full">
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