/**
 * BlueprintSegmentEditor — Edits a single segment definition within a blueprint slot.
 * Used by BlueprintEditor to manage the segment list for each time slot.
 *
 * Blueprint Revamp (2026-02-18): Provides explicit control over actions/fields/sub_assignments
 * so admins see exactly what gets seeded into new services. No hidden data.
 */

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Trash2, Plus, GripVertical } from "lucide-react";
import { ACTION_LABEL_MAX } from "@/components/session/SegmentActionsEditor";

const SEGMENT_TYPES = [
  { value: "worship", label: "Alabanza" },
  { value: "welcome", label: "Bienvenida" },
  { value: "offering", label: "Ofrendas" },
  { value: "message", label: "Mensaje / Plenaria" },
  { value: "special", label: "Especial" },
  { value: "prayer", label: "Oración" },
  { value: "video", label: "Video" },
  { value: "announcement", label: "Anuncio" },
  { value: "break", label: "Receso" },
];

const AVAILABLE_FIELDS = [
  { value: "leader", label: "Líder / Director" },
  { value: "presenter", label: "Presentador" },
  { value: "preacher", label: "Predicador" },
  { value: "title", label: "Título" },
  { value: "verse", label: "Verso / Cita" },
  { value: "songs", label: "Canciones" },
  { value: "translator", label: "Traductor" },
  { value: "ministry_leader", label: "Ministración" },
];

/**
 * 2026-03-06: `allSegments` prop added so the translation source dropdown can
 * show all preceding segments dynamically instead of the hardcoded "Auto (de Alabanza)".
 * The stored value uses the pattern `auto_from:{segmentIndex}` so downstream
 * consumers can resolve the correct segment at service-creation time.
 */
export default function BlueprintSegmentEditor({ segment, index, total, onChange, onRemove, onMove, allSegments = [] }) {
  const [expanded, setExpanded] = useState(false);

  const update = (field, value) => {
    onChange(index, { ...segment, [field]: value });
  };

  const toggleField = (fieldValue) => {
    const current = segment.fields || [];
    const updated = current.includes(fieldValue)
      ? current.filter(f => f !== fieldValue)
      : [...current, fieldValue];
    update("fields", updated);
  };

  // Sub-assignment helpers
  const addSubAssignment = () => {
    const subs = [...(segment.sub_assignments || [])];
    subs.push({ label: "", person_field_name: "", duration_min: 5 });
    update("sub_assignments", subs);
  };

  const updateSubAssignment = (idx, field, value) => {
    const subs = [...(segment.sub_assignments || [])];
    subs[idx] = { ...subs[idx], [field]: value };
    update("sub_assignments", subs);
  };

  const removeSubAssignment = (idx) => {
    update("sub_assignments", (segment.sub_assignments || []).filter((_, i) => i !== idx));
  };

  // Action helpers
  const addAction = () => {
    const actions = [...(segment.actions || [])];
    actions.push({ label: "", timing: "before_start", offset_min: 0, department: "" });
    update("actions", actions);
  };

  const updateAction = (idx, field, value) => {
    const actions = [...(segment.actions || [])];
    actions[idx] = { ...actions[idx], [field]: value };
    update("actions", actions);
  };

  const removeAction = (idx) => {
    update("actions", (segment.actions || []).filter((_, i) => i !== idx));
  };

  const typeLabel = SEGMENT_TYPES.find(t => t.value === segment.type)?.label || segment.type;

  return (
    <Card className="border border-gray-200 bg-white">
      <CardContent className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => onMove(index, "up")} disabled={index === 0} className="h-4 w-5 p-0">
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onMove(index, "down")} disabled={index === total - 1} className="h-4 w-5 p-0">
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>

          <Badge variant="outline" className="text-xs shrink-0">{typeLabel}</Badge>
          <Input
            value={segment.title || ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Título del segmento"
            className="text-sm h-8 flex-1"
          />
          <Input
            type="number"
            value={segment.duration ?? ''}
            onChange={(e) => update("duration", e.target.value === '' ? '' : parseInt(e.target.value))}
            className="text-sm h-8 w-16"
            title="Duración (min)"
          />
          <span className="text-xs text-gray-400">min</span>

          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-7 w-7 p-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {expanded && (
          <div className="space-y-4 pt-2 border-t">
            {/* Segment type */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo</Label>
              <Select value={segment.type || "special"} onValueChange={(v) => update("type", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fields (which UI inputs appear) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Campos del UI</Label>
              <p className="text-[10px] text-gray-500">Qué campos aparecen al editar este segmento</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {AVAILABLE_FIELDS.map(f => {
                  const active = (segment.fields || []).includes(f.value);
                  return (
                    <Badge
                      key={f.value}
                      variant={active ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${active ? "hover:opacity-90" : "text-gray-700 hover:bg-gray-100"}`}
                      style={active ? { backgroundColor: '#1F8A70', color: '#ffffff' } : {}}
                      onClick={() => toggleField(f.value)}
                    >
                      {f.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Number of songs (worship only) */}
            {segment.type === "worship" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cantidad de Canciones</Label>
                <p className="text-[10px] text-gray-500">Cuántas filas de canciones aparecen por defecto en servicios nuevos</p>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={segment.number_of_songs || 4}
                  onChange={(e) => update("number_of_songs", Math.max(1, Math.min(10, parseInt(e.target.value) || 4)))}
                  className="text-sm h-8 w-20"
                />
              </div>
            )}

            {/* Translation — 2026-03-06: Dynamic source picker from preceding segments */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!segment.requires_translation}
                  onCheckedChange={(v) => update("requires_translation", v)}
                />
                <Label className="text-xs">Requiere traducción</Label>
              </div>
              {segment.requires_translation && (
                <div className="pl-6 border-l-2 border-gray-200 space-y-1">
                  <Label className="text-[10px] text-gray-500">Fuente del traductor</Label>
                  <Select
                    value={segment.default_translator_source || "manual"}
                    onValueChange={(v) => update("default_translator_source", v)}
                  >
                    <SelectTrigger className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual (escribir nombre)</SelectItem>
                      {/* Dynamic: show all segments that come BEFORE this one */}
                      {allSegments
                        .filter((_, i) => i < index)
                        .map((seg, i) => {
                          const segLabel = seg.title || SEGMENT_TYPES.find(t => t.value === seg.type)?.label || `Segmento ${i + 1}`;
                          return (
                            <SelectItem key={i} value={`auto_from:${i}`}>
                              Auto → {segLabel}
                            </SelectItem>
                          );
                        })
                      }
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-400">
                    "Auto" copia el traductor del segmento seleccionado al crear el servicio.
                  </p>
                </div>
              )}
            </div>

            {/* Sub-Assignments */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold">Sub-Asignaciones</Label>
                <Button size="sm" variant="outline" onClick={addSubAssignment} className="h-6 text-xs px-2">
                  <Plus className="w-3 h-3 mr-1" />Agregar
                </Button>
              </div>
              {(segment.sub_assignments || []).map((sub, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-purple-50 rounded p-2">
                  <Input
                    value={sub.label || ""}
                    onChange={(e) => updateSubAssignment(idx, "label", e.target.value)}
                    placeholder="Etiqueta (ej. Ministración)"
                    className="text-xs h-7 flex-1"
                  />
                  <Input
                    value={sub.person_field_name || ""}
                    onChange={(e) => updateSubAssignment(idx, "person_field_name", e.target.value)}
                    placeholder="Campo (ej. ministry_leader)"
                    className="text-xs h-7 w-36"
                  />
                  <Input
                    type="number"
                    value={sub.duration_min ?? ''}
                    onChange={(e) => updateSubAssignment(idx, "duration_min", e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="text-xs h-7 w-14"
                  />
                  <span className="text-[10px] text-gray-400">min</span>
                  <Button variant="ghost" size="sm" onClick={() => removeSubAssignment(idx)} className="h-6 w-6 p-0 text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions (coordination notes that get seeded) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-xs font-semibold">Acciones de Coordinación</Label>
                  <p className="text-[10px] text-gray-500">Se incluyen en nuevos servicios. Aparecen en Live View y PDFs.</p>
                </div>
                <Button size="sm" variant="outline" onClick={addAction} className="h-6 text-xs px-2">
                  <Plus className="w-3 h-3 mr-1" />Agregar
                </Button>
              </div>
              {(segment.actions || []).map((action, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-amber-50 rounded p-2">
                  <div className="flex-1 relative">
                    <Input
                      value={action.label || ""}
                      onChange={(e) => updateAction(idx, "label", e.target.value)}
                      maxLength={ACTION_LABEL_MAX}
                      placeholder="Descripción de la acción"
                      className="text-xs h-7 pr-12"
                    />
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] tabular-nums ${
                      (action.label || '').length >= ACTION_LABEL_MAX ? 'text-red-500 font-bold' : 'text-slate-400'
                    }`}>
                      {(action.label || '').length}/{ACTION_LABEL_MAX}
                    </span>
                  </div>
                  <Select
                    value={action.timing || "before_start"}
                    onValueChange={(v) => updateAction(idx, "timing", v)}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before_start">Antes</SelectItem>
                      <SelectItem value="after_start">Después inicio</SelectItem>
                      <SelectItem value="before_end">Antes del fin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={action.offset_min ?? ''}
                    onChange={(e) => updateAction(idx, "offset_min", e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="text-xs h-7 w-14"
                    title="Offset (min)"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeAction(idx)} className="h-6 w-6 p-0 text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {(segment.actions || []).length === 0 && (
                <p className="text-[10px] text-gray-400 italic">Sin acciones — este segmento no incluirá instrucciones de coordinación al crear servicios nuevos.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}