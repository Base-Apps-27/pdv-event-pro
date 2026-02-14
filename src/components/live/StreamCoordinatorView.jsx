import React, { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Radio, Clock } from "lucide-react";
import { useClockTick } from "@/components/utils/useClockTick";
import { resolveBlockTime } from "@/components/utils/streamTiming";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * StreamCoordinatorView — Livestream Department Timeline
 *
 * This is NOT a broadcast control center. It is a department-specific
 * view of the program — the same concept as Projection Notes or Sound Notes,
 * but for the Livestream team whose content is richer (timed blocks that
 * map to the main program segments).
 *
 * No "ON AIR" triggers, no divergence detection, no broadcast management.
 * Just the livestream team's annotated view of what's happening.
 *
 * 2026-02-13: Simplified from broadcast-control style to department-sidecar style.
 */
export default function StreamCoordinatorView({ session, segments, currentUser, embedded = false }) {
  const currentTime = useClockTick();
  const scrollRef = useRef(null);
  const currentBlockRef = useRef(null);

  // Fetch StreamBlocks for this session
  const { data: blocks = [] } = useQuery({
    queryKey: ['streamBlocks', session.id],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
    enabled: !!session.id,
    refetchInterval: 5000
  });

  // Resolve times & compute state per block
  const blocksWithTime = React.useMemo(() => {
    return blocks.map(block => {
      const { startTime, endTime, isOrphaned } = resolveBlockTime(block, segments, session.date);
      const isCurrent = startTime && endTime && currentTime >= startTime && currentTime <= endTime;
      const isPast = endTime && currentTime > endTime;
      return { ...block, startTime, endTime, isOrphaned, isCurrent, isPast };
    });
  }, [blocks, segments, session.date, currentTime]);

  const currentBlock = blocksWithTime.find(b => b.isCurrent);

  // Auto-scroll to current block
  useEffect(() => {
    if (currentBlockRef.current) {
      currentBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentBlock?.id]);

  const fmtTime = (date) => {
    if (!date) return "--:--";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York"
    }).replace(/\u202F|\u00A0/g, " ");
  };

  // Block type config — simple labels, no broadcast connotations
  const typeLabel = (t) => {
    const map = { link: "Link", insert: "Insert", replace: "Replace", offline: "Offline" };
    return map[t] || t || "—";
  };
  const typeColor = (t) => {
    const map = { link: "#3b82f6", insert: "#10b981", replace: "#f59e0b", offline: "#94a3b8" };
    return map[t] || "#94a3b8";
  };

  if (blocks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Radio className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No hay bloques de stream configurados para esta sesión.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${embedded ? '' : 'shadow-sm'}`}>
      {/* Session header — compact, informational */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500 shrink-0" />
          <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">
            Notas de Livestream
          </h3>
          <span className="text-xs text-gray-500">— {session.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{blocksWithTime.length} bloques</span>
        </div>
      </div>

      {/* Block list — department timeline */}
      <div className="divide-y divide-gray-100">
        {blocksWithTime.map((block) => {
          const color = typeColor(block.block_type);
          const anchorSegment = segments.find(s => s.id === block.anchor_segment_id);

          return (
            <div
              key={block.id}
              id={`stream-block-${block.id}`}
              ref={block.isCurrent ? currentBlockRef : undefined}
              className={`flex gap-3 px-4 py-3 transition-colors ${
                block.isCurrent
                  ? "bg-blue-50 border-l-4 border-l-blue-500"
                  : block.isPast
                    ? "opacity-40 border-l-4 border-l-transparent"
                    : "border-l-4 border-l-transparent hover:bg-gray-50"
              }`}
            >
              {/* Time column */}
              <div className="shrink-0 w-20 pt-0.5">
                <div className={`font-mono text-sm font-semibold ${block.isCurrent ? 'text-blue-700' : block.isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                  {fmtTime(block.startTime)}
                </div>
                <div className="font-mono text-xs text-gray-400">
                  {fmtTime(block.endTime)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title + type badge row */}
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className={`font-semibold text-sm truncate ${block.isCurrent ? 'text-gray-900' : block.isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                    {block.title}
                  </h4>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0"
                    style={{ color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {typeLabel(block.block_type)}
                  </span>
                  {block.isCurrent && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] h-4 px-1.5">
                      AHORA
                    </Badge>
                  )}
                </div>

                {/* Presenter */}
                {block.presenter && (
                  <p className="text-xs text-gray-600">{block.presenter}</p>
                )}

                {/* Anchor reference — shows which main-program segment this relates to */}
                {anchorSegment && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    ↳ {anchorSegment.title}
                    {block.offset_min ? ` (${block.offset_min > 0 ? '+' : ''}${block.offset_min}m)` : ''}
                  </p>
                )}

                {/* Stream notes — the actual department content */}
                {block.description && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 border border-gray-100">
                    {block.description}
                  </p>
                )}
                {block.stream_notes && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 border border-gray-100">
                    📝 {block.stream_notes}
                  </p>
                )}

                {/* Stream actions/cues — resolved times + labels for operational clarity */}
                {block.stream_actions?.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {block.stream_actions.map((action, i) => {
                      // Resolve action time from block boundaries
                      let actionTimeStr = null;
                      if (block.startTime && block.endTime) {
                        const offsetMs = (action.offset_min || 0) * 60000;
                        let t;
                        switch (action.timing) {
                          case 'before_start':
                            t = new Date(block.startTime.getTime() - offsetMs);
                            break;
                          case 'after_start':
                            t = new Date(block.startTime.getTime() + offsetMs);
                            break;
                          case 'before_end':
                            t = new Date(block.endTime.getTime() - offsetMs);
                            break;
                          default:
                            t = new Date(block.startTime.getTime() + offsetMs);
                        }
                        if (t && !isNaN(t.getTime())) {
                          actionTimeStr = fmtTime(t);
                        }
                      }
                      const isPrepCue = action.timing === 'before_start';
                      return (
                        <div key={i} className={`flex items-start gap-2 text-xs rounded px-1.5 py-0.5 ${
                          isPrepCue ? 'bg-amber-50 text-amber-900' : 'text-gray-700'
                        }`}>
                          {actionTimeStr ? (
                            <span className="font-mono text-[10px] font-bold text-gray-500 shrink-0 min-w-[52px]">{actionTimeStr}</span>
                          ) : (
                            <span className="text-gray-400 shrink-0">•</span>
                          )}
                          <span className="flex-1 min-w-0">
                            {isPrepCue && <span className="text-amber-700 font-bold text-[10px] mr-1">PREP</span>}
                            {action.is_required && <span className="text-red-600 font-bold text-[10px] mr-1">REQ</span>}
                            <strong>{action.label}</strong>
                            {action.notes && <span className="text-gray-500"> — {action.notes}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}