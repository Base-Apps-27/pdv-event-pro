/**
 * SegmentCard.jsx — V2 renders one segment card.
 * DECISION-003 Principle 2: ui_fields drives ALL rendering.
 * DECISION-003 Principle 4: Entity fields read directly.
 *
 * HARDENING (Phase 8):
 *   - Memoized with React.memo to prevent re-render cascade
 *   - Color coding from entity (color_code field)
 *   - Better unconfigured segment UX (shows type badge, allows notes)
 *   - Print-friendly: hides action buttons, shows content
 *
 * Receives a raw Segment entity object. No JSON blob. No getSegmentData().
 * If segment.ui_fields is empty, shows an "unconfigured" warning.
 */

import React, { useState, useCallback, memo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Clock, ChevronUp, ChevronDown, Sparkles, Trash2,
  Save, Check, Loader2, AlertTriangle, ArrowRight
} from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import SongRows from "./SongRows";
import SubAssignmentRow from "./SubAssignmentRow";
import SegmentNotesPanel from "./SegmentNotesPanel";

const COLOR_MAP = {
  worship: { border: 'border-l-purple-500', bg: 'bg-purple-50/30' },
  preach:  { border: 'border-l-blue-600',   bg: 'bg-blue-50/30' },
  break:   { border: 'border-l-gray-400',   bg: 'bg-gray-50' },
  tech:    { border: 'border-l-slate-500',   bg: 'bg-slate-50' },
  special: { border: 'border-l-orange-500',  bg: 'bg-orange-50' },
  default: { border: '', bg: 'bg-white' },
};

const SegmentCard = memo(function SegmentCard({
  segment,
  children: childSegments,
  index,
  totalSegments,
  accentColor = 'teal',
  canEdit = true,
  // Write handlers
  onWrite,
  onWriteSongs,
  onWriteChild,
  onWriteDuration,
  // Action handlers
  onMove,
  onRemove,
  onCopyToNext,
  onOpenVerseParser,
  // Dirty tracking
  dirtyIds,
  onFlushEntity,
  nextSlotName,
}) {
  const [expanded, setExpanded] = useState(false);
  const isSpecial = segment.segment_type === 'Especial';
  const fields = segment.ui_fields || [];
  const subAssignments = segment.ui_sub_assignments || [];
  const hasSongs = fields.includes('songs');
  const hasTranslation = !!segment.requires_translation;
  const isDirty = dirtyIds?.has(String(segment.id));

  // Color from entity or computed
  const colorKey = isSpecial ? 'special' : (segment.color_code || 'default');
  const colors = COLOR_MAP[colorKey] || COLOR_MAP.default;

  // ── No ui_fields warning (still allows notes expansion) ──
  if (fields.length === 0 && !isSpecial) {
    return (
      <Card className="border-2 border-amber-300 border-l-4 border-l-amber-500 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            <div className="print:hidden flex flex-col gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => onMove?.(index, 'up')} disabled={index === 0} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onMove?.(index, 'down')} disabled={index === totalSegments - 1} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            {segment.title || 'Sin título'}
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400">{segment.segment_type}</Badge>
            <Badge variant="outline" className="ml-auto text-xs">{segment.duration_min || 0} min</Badge>
            <SaveButton isDirty={isDirty} entityId={segment.id} onFlush={onFlushEntity} />
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => onRemove?.(index)} className="print:hidden" title="Eliminar segmento">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-amber-700 mb-2">
            Segmento sin configuración de campos (ui_fields vacío).
            Restablezca el servicio desde el blueprint para corregir, o elimine este segmento.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full text-xs print:hidden">
            {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            {expanded ? "Menos" : "Notas y detalles"}
          </Button>
          {expanded && (
            <SegmentNotesPanel segment={segment} onWrite={onWrite} onWriteDuration={onWriteDuration} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 border-gray-300 border-l-4 ${colors.border || `border-l-${accentColor}-500`} ${colors.bg}`}>
      <CardHeader className={`pb-2 ${isSpecial ? '' : 'bg-gray-50/50'}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            {/* Move buttons */}
            <div className="print:hidden flex flex-col gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => onMove?.(index, 'up')} disabled={index === 0} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onMove?.(index, 'down')} disabled={index === totalSegments - 1} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            {isSpecial ? <Sparkles className="w-4 h-4 text-orange-600" /> : <Clock className={`w-4 h-4 text-${accentColor}-600`} />}
            {segment.title}
            {isSpecial && <Badge className="ml-1 bg-orange-200 text-orange-800 text-[10px]">Especial</Badge>}
            {segment.color_code && segment.color_code !== 'default' && !isSpecial && (
              <Badge variant="outline" className="text-[9px] text-gray-500 border-gray-300">{segment.color_code}</Badge>
            )}
            <Badge variant="outline" className="ml-auto text-xs">{segment.duration_min || 0} min</Badge>
            {/* Save indicator */}
            <SaveButton isDirty={isDirty} entityId={segment.id} onFlush={onFlushEntity} />
            {/* Copy to next slot */}
            {onCopyToNext && (
              <Button variant="ghost" size="sm" onClick={() => onCopyToNext?.(index)} className="print:hidden h-7 px-2 hover:bg-blue-50" title={`Copiar a ${nextSlotName || 'siguiente'}`}>
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </Button>
            )}
          </CardTitle>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => onRemove?.(index)} className="print:hidden"
              title="Eliminar segmento"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {/* Render fields from ui_fields */}
        {fields.filter(f => f !== 'songs' && f !== 'ministry_leader').map(field => (
          <FieldRenderer
            key={field}
            segment={segment}
            field={field}
            onWrite={onWrite}
            onWriteSongs={onWriteSongs}
            onOpenVerseParser={() => onOpenVerseParser?.(segment.id)}
          />
        ))}

        {/* Songs (worship segments) */}
        {hasSongs && (
          <SongRows segment={segment} onWriteSongs={onWriteSongs} canEdit={canEdit} />
        )}

        {/* Translation — FieldRenderer now applies its own blue box styling (Phase 2, 2026-03-03).
          * Outer wrapper removed to prevent double-boxing. The 🌐 icon is preserved inside FieldRenderer's label. */}
        {hasTranslation && (
          <FieldRenderer
            segment={segment}
            field="translator"
            onWrite={onWrite}
            onWriteSongs={onWriteSongs}
          />
        )}

        {/* Sub-Assignments from ui_sub_assignments */}
        {/* Sub-Assignments from ui_sub_assignments
          * BUGFIX (2026-02-26): Match child entities by label/title, not positional
          * index, to handle out-of-order or missing children correctly.
          */}
        {subAssignments.length > 0 && (
          <div className="space-y-2 border-t pt-2 mt-2">
            <Label className="text-xs font-semibold text-purple-800">Sub-Asignaciones</Label>
            {subAssignments.map((subConfig, idx) => {
              // Match child entity by label → title (durable), fallback to index
              const matchedChild = (childSegments || []).find(
                c => c.title === subConfig.label
              ) || childSegments?.[idx] || null;
              return (
                <SubAssignmentRow
                  key={subConfig.label || idx}
                  subConfig={subConfig}
                  childEntity={matchedChild}
                  onWriteChild={onWriteChild}
                  parentSegmentId={segment.id}
                />
              );
            })}
          </div>
        )}

        {/* Expand/collapse for notes */}
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full text-xs mt-2 print:hidden">
          {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {expanded ? "Menos detalles" : "Más detalles"}
        </Button>

        {expanded && (
          <SegmentNotesPanel
            segment={segment}
            onWrite={onWrite}
            onWriteDuration={onWriteDuration}
          />
        )}
      </CardContent>
    </Card>
  );
});

export default SegmentCard;

function SaveButton({ isDirty, entityId, onFlush }) {
  const [saving, setSaving] = useState(false);
  if (!entityId) return null;

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try { await onFlush?.(entityId); } finally { setSaving(false); }
  };

  return (
    <Button
      variant="ghost" size="sm" onClick={handleSave} disabled={saving}
      className={`h-6 px-1.5 print:hidden transition-all ${
        saving ? 'text-amber-500'
        : isDirty ? 'text-red-600 animate-pulse bg-red-50 hover:bg-red-100'
        : 'text-green-600 opacity-50 hover:opacity-100'
      }`}
      title={saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardado"}
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
       : isDirty ? <Save className="w-3.5 h-3.5" />
       : <Check className="w-3.5 h-3.5" />}
    </Button>
  );
}