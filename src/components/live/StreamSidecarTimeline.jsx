import React, { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Radio } from "lucide-react";
import { useClockTick } from "@/components/utils/useClockTick";
import { resolveBlockTime } from "@/components/utils/streamTiming";

/**
 * StreamSidecarTimeline
 * 
 * Purpose-built slim timeline for the TV Production Dashboard's
 * rightmost column (~20% width). Every element is designed to fit
 * within the constrained width — no badges that overflow, no
 * imported sub-components. Pure inline rendering.
 */
export default function StreamSidecarTimeline({ session, segments }) {
  const currentTime = useClockTick();
  const currentRef = useRef(null);
  const listRef = useRef(null);

  const { data: blocks = [] } = useQuery({
    queryKey: ['streamBlocks', session.id],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
    enabled: !!session.id,
    refetchInterval: 5000
  });

  const blocksWithState = useMemo(() => {
    return blocks.map(block => {
      const { startTime, endTime } = resolveBlockTime(block, segments, session.date);
      const isCurrent = startTime && endTime && currentTime >= startTime && currentTime <= endTime;
      const isPast = endTime && currentTime > endTime;
      return { ...block, startTime, endTime, isCurrent, isPast };
    });
  }, [blocks, segments, session.date, currentTime]);

  const currentBlock = blocksWithState.find(b => b.isCurrent);

  // Auto-scroll current block into view
  useEffect(() => {
    if (currentRef.current && listRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentBlock?.id]);

  const fmtTime = (date) => {
    if (!date) return "--:--";
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York'
    }).replace(/\s/g, ' ');
  };

  // Type abbreviation — must fit in ~3-4 chars
  const typeLabel = (t) => {
    const map = { link: 'LNK', insert: 'INS', replace: 'RPL', offline: 'OFF' };
    return map[t] || t?.substring(0, 3).toUpperCase() || '—';
  };

  // Dot color per type
  const dotColor = (t) => {
    const map = { link: '#3b82f6', insert: '#10b981', replace: '#f59e0b', offline: '#94a3b8' };
    return map[t] || '#94a3b8';
  };

  if (blocks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[10px] text-slate-400 italic">No stream blocks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Minimal header */}
      <div className="shrink-0 px-2 py-1.5 border-b border-slate-200/80 bg-slate-50/60 flex items-center gap-1">
        <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 truncate">Stream</span>
      </div>

      {/* Block list — own scrolling context */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={listRef}>
        <div className="py-1">
          {blocksWithState.map((block) => {
            const isCurrent = block.isCurrent;
            const isPast = block.isPast;

            return (
              <div
                key={block.id}
                ref={isCurrent ? currentRef : undefined}
                className={`
                  mx-1 mb-0.5 px-2 py-1.5 rounded transition-colors
                  ${isCurrent
                    ? 'bg-blue-50 border-l-2 border-blue-500'
                    : isPast
                      ? 'opacity-40 border-l-2 border-transparent'
                      : 'border-l-2 border-transparent hover:bg-slate-50'
                  }
                `}
              >
                {/* Row 1: time + type */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="font-mono leading-none truncate"
                    style={{ fontSize: '10px', fontWeight: 700, color: isCurrent ? '#2563eb' : isPast ? '#94a3b8' : '#475569' }}
                  >
                    {fmtTime(block.startTime)}
                  </span>

                  {/* Type pill — inline styled to guarantee fit */}
                  <span
                    className="shrink-0 rounded px-1 leading-none"
                    style={{
                      fontSize: '8px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: dotColor(block.block_type),
                      backgroundColor: dotColor(block.block_type) + '18',
                      border: `1px solid ${dotColor(block.block_type)}40`,
                      paddingTop: '2px',
                      paddingBottom: '2px',
                    }}
                  >
                    {typeLabel(block.block_type)}
                  </span>
                </div>

                {/* Row 2: title */}
                <div
                  className="leading-tight truncate mt-0.5"
                  style={{
                    fontSize: '11px',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#1e3a5f' : isPast ? '#94a3b8' : '#334155',
                  }}
                >
                  {block.title}
                </div>

                {/* ON AIR dot for current */}
                {isCurrent && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#dc2626', letterSpacing: '0.06em' }}>
                      ON AIR
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}