/**
 * ArtsProgressStrip.jsx
 * 
 * Horizontal scrollable pill bar showing all arts segments with status indicators.
 * Tapping a pill scrolls to that segment's accordion. Mobile-first: touch-scrollable,
 * compact, sticky below the header.
 * 
 * 2026-02-28: Created as part of Hybrid UX refactor (Option 5).
 */
import React, { useRef, useEffect } from 'react';

const STATUS_COLORS = {
  incomplete: 'bg-red-100 text-red-700 border-red-200',
  minimum: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  complete: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_DOTS = {
  incomplete: 'bg-red-500',
  minimum: 'bg-yellow-500',
  complete: 'bg-green-500',
};

export default function ArtsProgressStrip({ segments, activeSegmentId, onSegmentTap }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll to keep active pill visible
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeSegmentId]);

  if (!segments || segments.length <= 1) return null;

  return (
    <div className="sticky top-0 z-20 bg-[#F0F1F3] pb-2 pt-1 -mx-4 px-4 md:-mx-8 md:px-8">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {segments.map((seg) => {
          const isActive = seg.id === activeSegmentId;
          const statusClass = STATUS_COLORS[seg.statusLevel] || STATUS_COLORS.incomplete;
          const dotClass = STATUS_DOTS[seg.statusLevel] || STATUS_DOTS.incomplete;

          return (
            <button
              key={seg.id}
              ref={isActive ? activeRef : null}
              onClick={() => onSegmentTap(seg.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold 
                whitespace-nowrap shrink-0 transition-all
                ${isActive
                  ? 'bg-white border-[#1F8A70] shadow-sm ring-2 ring-[#1F8A70]/20'
                  : statusClass + ' hover:shadow-sm'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[#1F8A70]' : dotClass}`} />
              <span className={`truncate max-w-[120px] ${isActive ? 'text-[#1F8A70]' : ''}`}>
                {seg.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}