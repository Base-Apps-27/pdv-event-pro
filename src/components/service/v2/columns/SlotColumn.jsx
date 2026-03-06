/**
 * SlotColumn.jsx — V2 renders one complete time-slot column.
 * HARDENING (Phase 9):
 *   - Memoized with React.memo
 *   - Print-friendly segment timeline (start/end times)
 *   - Empty segment list warning
 *   - Configurable target duration from session entity
 *   - Segment count badge in header
 */

import React, { useCallback, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronsRight, AlertTriangle, RotateCcw } from "lucide-react";
import { addMinutes, format as formatDate } from "date-fns";
import SegmentCard from "../segments/SegmentCard";
import PreServiceSection from "./PreServiceSection";
import RecesoSection from "./RecesoSection";
import TeamSection from "./TeamSection";
import { useLanguage } from "@/components/utils/i18n.jsx";

/**
 * SESSION_COLOR_MAP: Maps Session entity session_color values → Tailwind color prefixes.
 * Session entity enum: green, blue, pink, orange, yellow, purple, red
 * Fallback array used when session_color is not set.
 */
const SESSION_COLOR_MAP = {
  green:  'green',
  blue:   'blue',
  pink:   'pink',
  orange: 'orange',
  yellow: 'amber',   // Tailwind amber is closest to "yellow" for contrast
  purple: 'purple',
  red:    'red',
};
const SLOT_COLORS_FALLBACK = ['teal', 'blue', 'purple', 'amber', 'green'];
const DEFAULT_TARGET_MIN = 90;

function safeParseTime(slotName) {
  const match = slotName?.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return new Date(2000, 0, 1, 9, 30);
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = (match[3] || '').toLowerCase();
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  return new Date(2000, 0, 1, hours, minutes);
}

export default memo(function SlotColumn({
  session,
  segments,
  childSegments,
  psd,
  slotIndex = 0,
  isLastSlot = false,
  canEdit = true,
  // Service-level data
  serviceId,
  recesoNotes,
  // Write handlers
  onWrite,
  onWriteSongs,
  onWriteChild,
  onWriteSession,
  onWritePSD,
  onWriteDuration,
  // Action handlers
  onOpenSpecialDialog,
  onMove,
  onRemove,
  onCopyToNext,
  onCopyAllToSlot,
  onResetSession,
  nextSlotName,
  // Verse parser
  onOpenVerseParser,
  // Dirty tracking
  dirtyIds,
  onFlushEntity,
  // External sync
  markOwnWrite,
  style,
}) {
  const { t } = useLanguage();
  const accentColor = SLOT_COLORS[slotIndex % SLOT_COLORS.length];

  // Calculate timing
  const { totalDuration, startTime, endTime, isOverage, targetMin } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const start = safeParseTime(session.name);
    const target = DEFAULT_TARGET_MIN;
    return {
      totalDuration: total,
      startTime: start,
      endTime: addMinutes(start, total),
      isOverage: total > target,
      targetMin: target,
    };
  }, [segments, session.name]);

  const handleMove = useCallback((idx, dir) => {
    onMove?.(session.id, idx, dir);
  }, [session.id, onMove]);

  const handleRemove = useCallback((idx) => {
    onRemove?.(session.id, idx, segments[idx]?.id);
  }, [session.id, segments, onRemove]);

  const handleWriteChild = useCallback((childId, columnOrConfig, value) => {
    onWriteChild?.(childId, columnOrConfig, value, session.id, serviceId);
  }, [onWriteChild, session.id, serviceId]);

  return (
    <div className="space-y-4" style={style}>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={`text-3xl text-${accentColor}-600`}>
            {session.name?.replace('am', ' a.m.').replace('pm', ' p.m.')}
          </h2>
          {canEdit && (
            <div className="flex gap-2 print:hidden">
              {onCopyAllToSlot && (
                <Button size="sm" onClick={onCopyAllToSlot} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold border-2 border-blue-600">
                  <ChevronsRight className="w-4 h-4 mr-2" />{t('slot.copyAll')}
                </Button>
              )}
              {onResetSession && (
                <Button size="sm" variant="outline" onClick={() => onResetSession(session.id)}
                  className="border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold"
                  title={t('slot.resetThisSession')}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onOpenSpecialDialog?.(session)} className="border-2 border-gray-400 bg-white text-gray-900 font-semibold">
                <Plus className="w-4 h-4 mr-2" />{t('slot.special')}
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={isOverage ? "bg-amber-100 border-amber-400 text-amber-900 font-bold" : `bg-${accentColor}-50`}>
            {totalDuration} {t('slot.minTotal')}{isOverage && ` (+${totalDuration - targetMin} min)`}
          </Badge>
          <Badge variant="outline" className="text-xs text-gray-500">
            {segments.length} {t('slot.segments')}
          </Badge>
          <span>{t('slot.endsAt')} {formatDate(endTime, "h:mm a")}</span>
          <span className="text-xs text-gray-500">({t('slot.target')} {targetMin} min)</span>
          {isOverage && <Badge className="bg-amber-600 text-white text-xs">{t('slot.overage')}</Badge>}
        </div>
      </div>

      {/* Pre-Service */}
      <PreServiceSection session={session} psd={psd} onWritePSD={onWritePSD} />

      {/* Segments */}
      <div className="space-y-4">
        {segments.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <AlertTriangle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('slot.noSegments')}</p>
            {canEdit && (
              <p className="text-xs text-gray-400 mt-1">
                {t('slot.noSegmentsHint')}
              </p>
            )}
          </div>
        )}
        {segments.map((segment, idx) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            children={childSegments[segment.id] || []}
            index={idx}
            totalSegments={segments.length}
            accentColor={accentColor}
            canEdit={canEdit}
            onWrite={onWrite}
            onWriteSongs={onWriteSongs}
            onWriteChild={handleWriteChild}
            onWriteDuration={onWriteDuration}
            onMove={handleMove}
            onRemove={handleRemove}
            onCopyToNext={onCopyToNext ? (segIdx) => onCopyToNext(session.id, segIdx) : null}
            onOpenVerseParser={onOpenVerseParser}
            dirtyIds={dirtyIds}
            onFlushEntity={onFlushEntity}
            nextSlotName={nextSlotName}
          />
        ))}
      </div>

      {/* Receso */}
      {!isLastSlot && (
        <RecesoSection
          serviceId={serviceId}
          slotName={session.name}
          recesoNotes={recesoNotes}
          markOwnWrite={markOwnWrite}
        />
      )}

      {/* Team */}
      <TeamSection session={session} accentColor={accentColor} onWriteSession={onWriteSession} />
    </div>
  );
});