/**
 * ServiceStatusBar — MyProgram-inspired now/next pill bar for Services Live View.
 * 
 * Replaces LiveStatusCard with a compact, horizontal pill layout while
 * PRESERVING all existing features:
 *   - Precise H:MM:SS pre-launch countdown
 *   - MM:SS remaining countdown for current segment
 *   - Message title display
 *   - Person name display
 *   - Resource links (slides, notes) on current segment
 *   - Livestream block indicator
 *   - Click-to-scroll for current and next
 *   - isToday gating (no status shown for non-today services)
 *   - Live adjustment support
 * 
 * Design: Two side-by-side rounded pills — current (yellow) + next (white).
 * Pre-launch state: teal countdown pill.
 * 
 * 2026-02-20: Created for Services Live View aesthetic refresh.
 */
import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, BookOpen, AlertTriangle, Radio } from 'lucide-react';
import { formatTimeToEST } from '@/components/utils/timeFormat';
import { getSegmentData } from '@/components/utils/segmentDataUtils';
import { useLanguage } from '@/components/utils/i18n';

function parseHHMM(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export default function ServiceStatusBar({
  segments,
  currentTime,
  onScrollTo,
  serviceDate,
  liveAdjustmentEnabled,
  currentStreamBlock,
  onStreamBlockClick
}) {
  const { t } = useLanguage();

  // ── Is today? ──
  const isToday = useMemo(() => {
    if (!serviceDate) return true;
    const [y, m, d] = serviceDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    return target.getTime() === today.getTime();
  }, [serviceDate, currentTime]);

  // ── Time parsing helper ──
  const getTimeDate = (timeStr) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(currentTime);
    if (serviceDate) {
      const [y, m, d] = serviceDate.split('-').map(Number);
      date.setFullYear(y);
      date.setMonth(m - 1);
      date.setDate(d);
    }
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // ── Effective times (respects live adjustments) ──
  const getEffective = (s) => {
    if (liveAdjustmentEnabled && s.is_live_adjusted) {
      return {
        ...s,
        start_time: s.actual_start_time || s.start_time,
        end_time: s.actual_end_time || s.end_time
      };
    }
    return s;
  };

  // ── Valid segments (no breaks) ──
  const valid = useMemo(() =>
    segments
      .map(getEffective)
      .filter(s => s.start_time && !['break', 'Break'].includes(s.type || s.segment_type || ''))
      .sort((a, b) => {
        const ta = getTimeDate(a.start_time);
        const tb = getTimeDate(b.start_time);
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta - tb;
      }),
    [segments, currentTime, liveAdjustmentEnabled]
  );

  // ── Current and next segments ──
  const { current, next } = useMemo(() => {
    if (!isToday) return { current: null, next: null };
    let foundCurrent = null;
    let foundNext = null;
    for (const s of valid) {
      const start = getTimeDate(s.start_time);
      const end = getTimeDate(s.end_time);
      if (!foundCurrent && start && end && currentTime >= start && currentTime <= end) {
        foundCurrent = s;
        continue;
      }
      if (foundCurrent && !foundNext && start && start > currentTime) {
        foundNext = s;
        break;
      }
      if (!foundCurrent && !foundNext && start && start > currentTime) {
        foundNext = s;
        break;
      }
    }
    if (foundCurrent && !foundNext) {
      const idx = valid.indexOf(foundCurrent);
      for (let i = idx + 1; i < valid.length; i++) {
        const st = getTimeDate(valid[i].start_time);
        if (st && st > currentTime) { foundNext = valid[i]; break; }
      }
    }
    return { current: foundCurrent, next: foundNext };
  }, [valid, currentTime, isToday]);

  // ── Countdown helpers ──
  const formatCountdown = (targetDate) => {
    if (!targetDate) return null;
    const diff = targetDate - currentTime;
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  const currentEnd = current ? getTimeDate(current.end_time) : null;
  const currentRemaining = currentEnd ? formatCountdown(currentEnd) : null;

  // Pre-launch countdown (before first segment starts)
  const preLaunch = useMemo(() => {
    if (current || !isToday || valid.length === 0) return null;
    const first = valid[0];
    const startAt = getTimeDate(first.start_time);
    if (!startAt || currentTime >= startAt) return null;
    const hms = formatCountdown(startAt);
    if (!hms) return null;
    return { hms, segment: first };
  }, [current, valid, currentTime, isToday]);

  // ── Person helper ──
  const getPersonName = (seg) => {
    if (!seg) return null;
    const d = seg.data || {};
    return d.leader || seg.leader || d.preacher || seg.preacher || d.presenter || seg.presenter;
  };

  // Nothing to show
  if (!current && !next && !preLaunch) return null;

  return (
    <div className="flex gap-2.5 w-full mb-4 sm:mb-6">
      {/* ── Current / Pre-launch ── */}
      {current ? (
        <button
          onClick={() => onScrollTo?.(current)}
          className="flex-1 flex flex-col gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-yellow-500/25 min-w-0 relative overflow-hidden"
        >
          {/* Progress bar */}
          {currentRemaining && currentEnd && (() => {
            const start = getTimeDate(current.start_time);
            if (!start) return null;
            const total = currentEnd - start;
            const elapsed = currentTime - start;
            const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
            return (
              <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-200/50">
                <div className="h-full bg-yellow-500 transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
              </div>
            );
          })()}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">{t('live.inProgress')}</span>
            </div>
            {currentRemaining && (
              <span className="text-xs font-mono font-bold text-yellow-800 bg-yellow-200/80 px-2 py-0.5 rounded-lg shrink-0">
                {currentRemaining}
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-gray-900 truncate leading-tight">
            {current.title || current.data?.title}
          </p>

          {/* Message title if applicable */}
          {(['Plenaria', 'message', 'Message'].includes(current.segment_type || current.type)) &&
           (getSegmentData(current, 'message_title') || current.data?.title) &&
           (getSegmentData(current, 'message_title') || current.data?.title) !== (current.title || current.data?.title) && (
            <p className="text-xs font-bold text-blue-800 truncate">{getSegmentData(current, 'message_title') || current.data?.title}</p>
          )}

          {getPersonName(current) && (
            <p className="text-xs text-gray-500 truncate">{getPersonName(current)}</p>
          )}

          {/* Livestream block indicator */}
          {currentStreamBlock && (
            <div
              className="flex items-center gap-1 text-[10px] text-red-600 font-semibold mt-0.5"
              onClick={(e) => { e.stopPropagation(); onStreamBlockClick?.(); }}
            >
              <Radio className="w-3 h-3 shrink-0" />
              <span className="truncate">LS: {currentStreamBlock.title}</span>
            </div>
          )}

          {/* Resource links — 2026-03-29 FIX: getSegmentData returns [] for empty
               arrays, which is truthy. Must check array length explicitly to avoid
               showing Slides/Notas badges on segments with no actual materials. */}
          {(() => {
            const presUrl = getSegmentData(current, 'presentation_url');
            const notesUrl = getSegmentData(current, 'notes_url');
            // Normalize: empty arrays and empty strings are "no content"
            const hasPresentation = Array.isArray(presUrl) ? presUrl.length > 0 : !!presUrl;
            const hasNotes = Array.isArray(notesUrl) ? notesUrl.length > 0 : !!notesUrl;
            const presHref = Array.isArray(presUrl) ? presUrl[0] : presUrl;
            const notesHref = Array.isArray(notesUrl) ? notesUrl[0] : notesUrl;
            if (!hasPresentation && !hasNotes) return null;
            return (
              <div className="flex gap-1.5 mt-1">
                {hasPresentation && (
                  <Button variant="outline" size="sm" asChild
                    className={`h-6 px-1.5 text-[10px] gap-1 ${getSegmentData(current, 'content_is_slides_only') ? 'border-amber-200 text-amber-700' : 'border-blue-200 text-blue-700'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={presHref} target="_blank" rel="noopener noreferrer">
                      {getSegmentData(current, 'content_is_slides_only') ? <AlertTriangle className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                      Slides
                    </a>
                  </Button>
                )}
                {hasNotes && (
                  <Button variant="outline" size="sm" asChild
                    className="h-6 px-1.5 text-[10px] gap-1 border-purple-200 text-purple-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={notesHref} target="_blank" rel="noopener noreferrer">
                      <BookOpen className="w-3 h-3" /> Notas
                    </a>
                  </Button>
                )}
              </div>
            );
          })()}
        </button>
      ) : preLaunch ? (
        <div className="flex-1 flex flex-col gap-1 bg-[#1F8A70]/10 border border-[#1F8A70]/20 rounded-2xl px-4 py-3 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#1F8A70] uppercase tracking-wider">
              {t('live.startsIn') || 'Iniciando en'}
            </span>
            <Badge variant="outline" className="bg-white text-gray-700 border-gray-300 font-mono font-bold text-[10px]">
              {preLaunch.segment.start_time ? formatTimeToEST(preLaunch.segment.start_time) : ''}
            </Badge>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-black text-[#1F8A70] leading-tight tabular-nums">
            -{preLaunch.hms}
          </p>
          {(preLaunch.segment.title || preLaunch.segment.data?.title) && (
            <p className="text-xs font-semibold text-gray-700 truncate border-t border-teal-100 pt-1">
              {preLaunch.segment.title || preLaunch.segment.data?.title}
            </p>
          )}
          {/* LS line on pre-launch */}
          {currentStreamBlock && (
            <div
              className="flex items-center gap-1 text-[10px] text-red-600 font-semibold mt-0.5 cursor-pointer"
              onClick={() => onStreamBlockClick?.()}
            >
              <Radio className="w-3 h-3 shrink-0" />
              <span className="truncate">LS: {currentStreamBlock.title}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Next ── */}
      {next && (
        <button
          onClick={() => onScrollTo?.(next)}
          className="flex-1 flex flex-col gap-1.5 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-gray-50 min-w-0"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('live.upNext')}</span>
            <span className="text-xs font-mono text-gray-500 shrink-0">
              {next.start_time ? formatTimeToEST(next.start_time) : ''}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate leading-tight">
            {next.title || next.data?.title}
          </p>
          {next.is_live_adjusted && liveAdjustmentEnabled && (
            <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] w-fit">ADJUSTED</Badge>
          )}
          {getPersonName(next) && (
            <p className="text-xs text-gray-500 truncate">{getPersonName(next)}</p>
          )}
        </button>
      )}
    </div>
  );
}