/**
 * MyProgramStatusBar — compact now/next card for MyProgram
 * 
 * Sits sticky below the controls. Shows current segment (with countdown)
 * and next segment. Clicking either scrolls to that segment card.
 * 
 * Design: dark themed to match MyProgram's dark cards.
 * Minimal — no resource links, no stream blocks. Just awareness + scroll.
 * 
 * 2026-02-16: Created for MyProgram issue #2.
 */
import React, { useMemo } from 'react';
import { PlayCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatTimeToEST } from '@/components/utils/timeFormat';
import { useLanguage } from '@/components/utils/i18n';

function parseHHMM(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export default function MyProgramStatusBar({ segments, currentTime, isToday, onScrollTo }) {
  const { t } = useLanguage();

  const nowMin = useMemo(() => {
    if (!currentTime) return 0;
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  const { current, next } = useMemo(() => {
    if (!isToday || !segments || segments.length === 0) return { current: null, next: null };

    let foundCurrent = null;
    let foundNext = null;

    for (const seg of segments) {
      const start = parseHHMM(seg.start_time);
      const end = parseHHMM(seg.end_time);
      if (start === null) continue;

      if (!foundCurrent && end !== null && nowMin >= start && nowMin < end) {
        foundCurrent = seg;
        continue;
      }

      if (foundCurrent && !foundNext && start > nowMin) {
        foundNext = seg;
        break;
      }

      // If no current found yet and this is future, treat as next
      if (!foundCurrent && !foundNext && start > nowMin) {
        foundNext = seg;
        break;
      }
    }

    // If current found but no next, scan remaining
    if (foundCurrent && !foundNext) {
      const idx = segments.indexOf(foundCurrent);
      for (let i = idx + 1; i < segments.length; i++) {
        const s = parseHHMM(segments[i].start_time);
        if (s !== null && s > nowMin) {
          foundNext = segments[i];
          break;
        }
      }
    }

    return { current: foundCurrent, next: foundNext };
  }, [segments, nowMin, isToday]);

  // Pre-launch countdown: no current, next exists
  const preCountdown = useMemo(() => {
    if (current || !next || !isToday) return null;
    const start = parseHHMM(next.start_time);
    if (start === null || start <= nowMin) return null;
    const diff = start - nowMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [current, next, nowMin, isToday]);

  // Current segment countdown (remaining)
  const currentRemaining = useMemo(() => {
    if (!current) return null;
    const end = parseHHMM(current.end_time);
    if (end === null) return null;
    const diff = end - nowMin;
    if (diff <= 0) return null;
    return `${diff} min`;
  }, [current, nowMin]);

  // Nothing to show
  if (!current && !next) return null;

  return (
    <div className="flex gap-2 w-full">
      {/* Current / Pre-countdown */}
      {current ? (
        <button
          onClick={() => onScrollTo?.(current)}
          className="flex-1 flex items-center gap-2.5 bg-yellow-500/15 border border-yellow-500/30 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-yellow-500/25 min-w-0"
        >
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider leading-none mb-1">
              {t('myprogram.now')}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {current.title}
            </p>
          </div>
          {currentRemaining && (
            <span className="text-xs font-mono font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg shrink-0">
              {currentRemaining}
            </span>
          )}
        </button>
      ) : preCountdown ? (
        <div className="flex-1 flex items-center gap-2.5 bg-[#1F8A70]/10 border border-[#1F8A70]/20 rounded-xl px-3 py-2.5 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[#1F8A70] uppercase tracking-wider leading-none mb-1">
              {t('myprogram.countdown.startsIn')}
            </p>
            <p className="text-lg font-mono font-black text-[#1F8A70] leading-tight">
              {preCountdown}
            </p>
          </div>
        </div>
      ) : null}

      {/* Next */}
      {next && (
        <button
          onClick={() => onScrollTo?.(next)}
          className="flex-1 flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50 min-w-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">
              {t('myprogram.next')}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {next.title}
            </p>
          </div>
          <span className="text-xs font-mono text-gray-500 shrink-0">
            {next.start_time ? formatTimeToEST(next.start_time) : ''}
          </span>
        </button>
      )}
    </div>
  );
}