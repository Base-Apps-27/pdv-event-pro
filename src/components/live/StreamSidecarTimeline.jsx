import React, { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio } from "lucide-react";
import { useClockTick } from "@/components/utils/useClockTick";
import { resolveBlockTime } from "@/components/utils/streamTiming";

/**
 * StreamSidecarTimeline
 * 
 * A slim, auto-scrolling timeline of stream blocks designed for the
 * TV Production Dashboard's third column. Mirrors the SegmentTimeline
 * style but shows StreamBlock data. No hero, no header — just a
 * scrolling list that tracks the current block.
 */
export default function StreamSidecarTimeline({ session, segments }) {
  const currentTime = useClockTick();
  const scrollRef = useRef(null);
  const currentRef = useRef(null);

  // Fetch StreamBlocks
  const { data: blocks = [] } = useQuery({
    queryKey: ['streamBlocks', session.id],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
    enabled: !!session.id,
    refetchInterval: 5000
  });

  // Resolve times and find current/next
  const blocksWithState = useMemo(() => {
    return blocks.map(block => {
      const { startTime, endTime, isOrphaned } = resolveBlockTime(block, segments, session.date);
      const isCurrent = startTime && endTime && currentTime >= startTime && currentTime <= endTime;
      const isPast = endTime && currentTime > endTime;
      return { ...block, startTime, endTime, isOrphaned, isCurrent, isPast };
    });
  }, [blocks, segments, session.date, currentTime]);

  const currentBlock = blocksWithState.find(b => b.isCurrent);

  // Auto-scroll to current block
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentBlock?.id]);

  const formatTime = (date) => {
    if (!date) return "--:--";
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  const typeColors = {
    link: "bg-blue-500/15 text-blue-700 border-blue-300",
    insert: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    replace: "bg-orange-500/15 text-orange-700 border-orange-300",
    offline: "bg-slate-500/15 text-slate-600 border-slate-300",
  };

  if (blocks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs italic p-4">
        No stream blocks
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tiny header bar */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-200/60 bg-slate-50/80 flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-red-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stream</span>
      </div>

      {/* Scrolling block list */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1.5">
          {blocksWithState.map((block) => {
            const isCurrent = block.isCurrent;
            const isPast = block.isPast;

            return (
              <div
                key={block.id}
                ref={isCurrent ? currentRef : undefined}
                className={`
                  rounded-lg border px-2.5 py-2 transition-all
                  ${isCurrent
                    ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400'
                    : isPast
                      ? 'bg-slate-50/50 border-slate-100 opacity-50'
                      : 'bg-white border-slate-200'
                  }
                `}
              >
                {/* Time + Type badge row */}
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className={`font-mono text-[11px] font-bold leading-none ${isCurrent ? 'text-blue-700' : isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                    {formatTime(block.startTime)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`h-4 px-1 text-[8px] font-bold uppercase border ${typeColors[block.block_type] || typeColors.link}`}
                  >
                    {block.block_type}
                  </Badge>
                </div>

                {/* Title */}
                <div className={`text-xs font-semibold leading-tight line-clamp-1 ${isCurrent ? 'text-blue-900' : isPast ? 'text-slate-400' : 'text-slate-800'}`}>
                  {block.title}
                </div>

                {/* ON AIR indicator */}
                {isCurrent && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase text-red-600 tracking-wider">On Air</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Bottom fade */}
      <div className="h-4 bg-gradient-to-t from-white/80 to-transparent pointer-events-none -mt-4 relative z-10" />
    </div>
  );
}