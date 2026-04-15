/**
 * CustomSegmentColumn.jsx — Custom V2 single-column segment list.
 *
 * DECISION (2026-03-02): Custom services have exactly 1 Session.
 * This is a simplified version of SlotColumn without:
 *   - Multi-slot tabs
 *   - Copy between slots
 *   - Receso injection
 *   - Blueprint reset
 *
 * Phase 2 (2026-03-02): Adopted same accent color scheme from Weekly V2 SlotColumn.
 * Uses 'teal' as the default accent for consistency with single-session custom services.
 * SegmentCard already inherits COLOR_MAP from color_code — no change needed there.
 *
 * Reuses 100% of V2 rendering components (SegmentCard, PreServiceSection, TeamSection).
 */

import React, { useCallback, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plus, AlertTriangle } from "lucide-react";
import { addMinutes, format as formatDate } from "date-fns";
import SegmentCard from "@/components/service/v2/segments/SegmentCard";
import PreServiceSection from "@/components/service/v2/columns/PreServiceSection";
import { formatTimeToEST } from "@/components/utils/timeFormat";

// Same accent color used by Weekly V2 SlotColumn (first slot = teal)
const ACCENT_COLOR = 'teal';
const DEFAULT_TARGET_MIN = 90;

function safeParseTime(timeStr) {
  if (!timeStr) return new Date(2000, 0, 1, 10, 0);
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(2000, 0, 1, h || 10, m || 0);
}

export default memo(function CustomSegmentColumn({
  session,
  segments,
  childSegments,
  psd,
  serviceId,
  serviceTime,
  canEdit,
  // Write handlers
  onWrite,
  onWriteSongs,
  onWriteChild,
  onWritePSD,
  onWriteDuration,
  // Action handlers
  onOpenSpecialDialog,
  onMove,
  onRemove,
  structuralBusy = false, // 2026-04-15: Disables move/delete during structural saves
  onOpenVerseParser,
  // Dirty tracking
  dirtyIds,
  onFlushEntity,
  // Language
  language,
}) {
  // Calculate timing — matches SlotColumn logic with overage detection
  const { totalDuration, endTime, isOverage, targetMin } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const start = safeParseTime(serviceTime);
    const target = DEFAULT_TARGET_MIN;
    return {
      totalDuration: total,
      endTime: addMinutes(start, total),
      isOverage: total > target,
      targetMin: target,
    };
  }, [segments, serviceTime]);

  const en = language === 'en';

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
    <div className="space-y-4">
      {/* Program header — matches Weekly V2 SlotColumn header styling */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={`text-3xl text-${ACCENT_COLOR}-600`}>
            {en ? 'Service Program' : 'Programa del Servicio'}
          </h2>
          {canEdit && (
            <div className="flex gap-2 print:hidden">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenSpecialDialog?.(session)}
                className="border-2 border-gray-400 bg-white text-gray-900 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                {en ? 'Add Segment' : 'Añadir Segmento'}
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={isOverage ? "bg-amber-100 border-amber-400 text-amber-900 font-bold" : `bg-${ACCENT_COLOR}-50`}>
            {totalDuration} min total{isOverage && ` (+${totalDuration - targetMin} min)`}
          </Badge>
          <Badge variant="outline" className="text-xs text-gray-500">
            {segments.length} {en ? 'segments' : 'segmentos'}
          </Badge>
          <span>
            <Clock className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
            {en ? 'Starts' : 'Inicia'}: {formatTimeToEST(serviceTime)} | {en ? 'Ends' : 'Termina'}: {formatDate(endTime, "h:mm a")}
          </span>
          <span className="text-xs text-gray-500">({en ? 'Target' : 'Meta'}: {targetMin} min)</span>
          {isOverage && <Badge className="bg-amber-600 text-white text-xs">⚠ {en ? 'Over target' : 'Sobrepasa'}</Badge>}
        </div>
      </div>

      {/* Pre-Service */}
      <PreServiceSection session={session} psd={psd} onWritePSD={onWritePSD} />

      {/* Segments */}
      <div className="space-y-4">
        {segments.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <AlertTriangle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {en ? 'No segments added. Click "Add Segment" to begin.' : 'No hay segmentos. Haz clic en "Añadir Segmento" para comenzar.'}
            </p>
          </div>
        )}
        {segments.map((segment, idx) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            children={childSegments[segment.id] || []}
            index={idx}
            totalSegments={segments.length}
            accentColor="teal"
            canEdit={canEdit}
            structuralBusy={structuralBusy}
            onWrite={onWrite}
            onWriteSongs={onWriteSongs}
            onWriteChild={handleWriteChild}
            onWriteDuration={onWriteDuration}
            onMove={handleMove}
            onRemove={handleRemove}
            onCopyToNext={null}
            onOpenVerseParser={onOpenVerseParser}
            dirtyIds={dirtyIds}
            onFlushEntity={onFlushEntity}
            nextSlotName={null}
          />
        ))}
      </div>

      {/* Team section moved to page level (before Announcements) */}
    </div>
  );
});