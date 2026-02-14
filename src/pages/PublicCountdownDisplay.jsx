import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CountdownBlock from "@/components/service/CountdownBlock";
import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
import SegmentTimeline from "@/components/service/SegmentTimeline";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeProgramData } from "@/components/utils/normalizeProgram";
import { Loader2, Layout, Radio } from "lucide-react";
import StandbyScreen from "@/components/service/StandbyScreen";
import StreamSidecarTimeline from "@/components/live/StreamSidecarTimeline";
import { normalizeStreamBlocks } from "@/components/utils/normalizeStreamBlocks";

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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Brand gradient for header title
  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";

  // ── Clock tick (1 s) ──
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-detect active program ──
  const { data: programData, isLoading } = useQuery({
    queryKey: ["tv-auto-detect"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getPublicProgramData", {
        detectActive: true,
        includeOptions: true,
      });
      if (res.status >= 400) return null;
      return res.data;
    },
    refetchInterval: 30000, // 30 s poll
  });

  // ── Normalize ──
  const normalizedData = useMemo(
    () => normalizeProgramData(programData),
    [programData]
  );
  const service = normalizedData.program;
  const segments = normalizedData.segments;

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
          const tA = getTimeDate(a._effectiveStart);
          const tB = getTimeDate(b._effectiveStart);
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
      const upcoming = validSegments
        .filter((s) => {
          if (s === current) return false;
          const start = getTimeDate(s._effectiveStart, s.date);
          return start && start > currentTime;
        })
        .slice(0, 8);

      let preLaunch = null;
      if (!current && next) {
        preLaunch = next;
      } else if (!current && !next && validSegments.length > 0) {
        const first = validSegments[0];
        const firstStart = getTimeDate(first._effectiveStart, first.date);
        if (firstStart && currentTime < firstStart) preLaunch = first;
      }

      return {
        currentSegment: current,
        nextSegment: next,
        preLaunchSegment: preLaunch,
        upcomingSegments: upcoming,
      };
    }, [segments, currentTime, serviceDate]);

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
  const allDone =
    !currentSegment &&
    !nextSegment &&
    !preLaunchSegment &&
    segments.length > 0;
  if (allDone) {
    return <StandbyScreen currentTime={currentTime} />;
  }

  // ── Active program display ──
  return (
    <div className="w-full h-screen bg-slate-50 p-3 md:p-4 flex flex-col items-center overflow-hidden relative light">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />

      {/* Header: title + clock */}
      <div className="w-full flex items-center justify-between px-4 py-3 z-20 relative mb-2">
        <div className="flex-1 text-center min-w-0">
          <h1
            className={`text-2xl md:text-4xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}
          >
            {service.name}
          </h1>
        </div>
        <div className="flex-shrink-0 ml-4">
          <div className="text-xl md:text-3xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
          </div>
        </div>
      </div>

      {/* Bento grid: 2-col or 3-col when livestream sidecar is present */}
      <div className="w-full flex-1 overflow-hidden px-2 z-10">
        <div
          className="w-full h-full grid gap-3"
          style={{ gridTemplateColumns: hasLivestreamSession ? '1fr 1fr minmax(200px, 0.5fr)' : '1fr 1fr' }}
        >
          {/* Col 1: Countdown + Coordinator Actions */}
          <div className="flex flex-col gap-3 overflow-visible min-w-0">
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
                  <p className="text-slate-400 italic text-sm">
                    No active segment
                  </p>
                </div>
              )}
            </div>

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

          {/* Col 2: Program Timeline */}
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
                    {t("live.endOfProgram")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}