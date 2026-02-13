import React, { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Radio } from "lucide-react";
import { useClockTick } from "@/components/utils/useClockTick";
import { resolveBlockTime } from "@/components/utils/streamTiming";

/**
 * StreamSidecarTimeline — TV Dashboard Column 3
 *
 * Department-style sidecar for the livestream team.
 * Same concept as SegmentTimeline (Column 2) for the room program,
 * but showing stream blocks mapped to the main schedule.
 *
 * 2026-02-13: Stripped broadcast-control language (ON AIR, etc.).
 * This is just the livestream team's timeline — a department view.
 */
export default function StreamSidecarTimeline({ session, segments }) {
  const currentTime = useClockTick();
  const currentRef = useRef(null);
  const listRef = useRef(null);

  const { data: blocks = [] } = useQuery({
    queryKey: ["streamBlocks", session.id],
    queryFn: () =>
      base44.entities.StreamBlock.filter(
        { session_id: session.id },
        "order"
      ),
    enabled: !!session.id,
    refetchInterval: 5000,
  });

  // Resolve times & compute live state per block
  const blocksWithState = useMemo(() => {
    return blocks.map((block) => {
      const { startTime, endTime } = resolveBlockTime(block, segments, session.date);
      const isCurrent = startTime && endTime && currentTime >= startTime && currentTime <= endTime;
      const isPast = endTime && currentTime > endTime;
      return { ...block, startTime, endTime, isCurrent, isPast };
    });
  }, [blocks, segments, session.date, currentTime]);

  const currentBlock = blocksWithState.find((b) => b.isCurrent);

  // Auto-scroll
  useEffect(() => {
    if (currentRef.current && listRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentBlock?.id]);

  // Helpers
  const fmtTime = (date) => {
    if (!date) return "--:--";
    return date
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      })
      .replace(/\u202F|\u00A0/g, " ");
  };

  const typeConfig = (t) => {
    const map = {
      link:    { label: "Link",    color: "#3b82f6" },
      insert:  { label: "Insert",  color: "#10b981" },
      replace: { label: "Replace", color: "#f59e0b" },
      offline: { label: "Offline", color: "#94a3b8" },
    };
    return map[t] || { label: t || "—", color: "#94a3b8" };
  };

  // Empty state
  if (blocks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-slate-400 italic text-center">
          Sin bloques de stream
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — matches Room Program header style */}
      <div className="shrink-0 bg-slate-800/5 px-3 py-3 border-b border-slate-200/50 flex items-center gap-2">
        <Radio className="w-4 h-4 text-red-500 shrink-0" />
        <h3 className="font-bold text-slate-600 uppercase tracking-wider text-xs truncate">
          Livestream
        </h3>
      </div>

      {/* Block list — scrollable */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1.5"
      >
        {blocksWithState.map((block) => {
          const { isCurrent, isPast } = block;
          const cfg = typeConfig(block.block_type);

          return (
            <div
              key={block.id}
              ref={isCurrent ? currentRef : undefined}
              className={`
                flex items-start gap-2 p-2.5 rounded-xl transition-all
                ${isCurrent
                  ? "bg-white shadow-md border-l-4 border-blue-500"
                  : isPast
                    ? "opacity-35 border-l-4 border-transparent"
                    : "bg-white/60 border-l-4 border-transparent hover:bg-white"
                }
              `}
            >
              {/* Left: time column */}
              <div className="shrink-0 pt-0.5">
                <span
                  className="font-mono font-bold block leading-none"
                  style={{
                    fontSize: "13px",
                    color: isCurrent ? "#2563eb" : isPast ? "#94a3b8" : "#64748b",
                  }}
                >
                  {fmtTime(block.startTime)}
                </span>
              </div>

              {/* Right: content */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div
                  className="font-semibold leading-tight truncate"
                  style={{
                    fontSize: "13px",
                    color: isCurrent ? "#0f172a" : isPast ? "#94a3b8" : "#334155",
                  }}
                >
                  {block.title}
                </div>

                {/* Meta row: type + current indicator */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {/* Type dot + label */}
                  <span
                    className="inline-flex items-center gap-1 leading-none"
                    style={{ fontSize: "10px", color: cfg.color, fontWeight: 700 }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    {cfg.label}
                  </span>

                  {/* Current indicator — just "AHORA" label, no broadcast language */}
                  {isCurrent && (
                    <span
                      className="inline-flex items-center gap-1 leading-none"
                      style={{ fontSize: "9px", fontWeight: 800, color: "#2563eb", letterSpacing: "0.05em" }}
                    >
                      AHORA
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}