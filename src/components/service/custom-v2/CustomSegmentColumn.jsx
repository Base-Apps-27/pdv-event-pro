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
 * Reuses 100% of V2 rendering components (SegmentCard, PreServiceSection, TeamSection).
 */

import React, { useCallback, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";
import { addMinutes, format as formatDate } from "date-fns";
import SegmentCard from "@/components/service/v2/segments/SegmentCard";
import PreServiceSection from "@/components/service/v2/columns/PreServiceSection";
import TeamSection from "@/components/service/v2/columns/TeamSection";
import { formatTimeToEST } from "@/components/utils/timeFormat";

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
  onWriteSession,
  onWritePSD,
  onWriteDuration,
  // Action handlers
  onOpenSpecialDialog,
  onMove,
  onRemove,
  onOpenVerseParser,
  // Dirty tracking
  dirtyIds,
  onFlushEntity,
  // Language
  language,
}) {
  // Calculate timing
  const { totalDuration, endTime } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const start = safeParseTime(serviceTime);
    return {
      totalDuration: total,
      endTime: addMinutes(start, total),
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
      {/* Program header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900 uppercase">
            {en ? 'Service Program' : 'Programa del Servicio'}
          </h2>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="outline" className="bg-blue-50">
              {totalDuration} min total
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-500">
              {segments.length} {en ? 'segments' : 'segmentos'}
            </Badge>
            <span className="text-sm text-gray-600">
              {en ? 'Starts' : 'Inicia'}: {formatTimeToEST(serviceTime)} | {en ? 'Ends' : 'Termina'}: {formatDate(endTime, "h:mm a")}
            </span>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenSpecialDialog?.(session)}
            className="border-2 border-gray-400 bg-white text-gray-900 font-semibold print:hidden"
          >
            <Plus className="w-4 h-4 mr-2" />
            {en ? 'Add Segment' : 'Añadir Segmento'}
          </Button>
        )}
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