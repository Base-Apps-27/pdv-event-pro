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

export default function BlueprintSegmentEditor({ segment, index, total, onChange, onRemove, onMove }) {
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
            value={segment.duration || 0}
            onChange={(e) => update("duration", parseInt(e.target.value) || 0)}
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

            {/* Translation */}
            <div className="flex items-center gap-3">
              <Switch
                checked={!!segment.requires_translation}
                onCheckedChange={(v) => update("requires_translation", v)}
              />
              <Label className="text-xs">Requiere traducción</Label>
              {segment.requires_translation && (
                <Select
                  value={segment.default_translator_source || "manual"}
                  onValueChange={(v) => update("default_translator_source", v)}
                >
                  <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="worship_segment_translator">Auto (de Alabanza)</SelectItem>
                  </SelectContent>
                </Select>
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
                    value={sub.duration_min || 5}
                    onChange={(e) => updateSubAssignment(idx, "duration_min", parseInt(e.target.value) || 0)}
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
                  <Input
                    value={action.label || ""}
                    onChange={(e) => updateAction(idx, "label", e.target.value)}
                    placeholder="Descripción de la acción"
                    className="text-xs h-7 flex-1"
                  />
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
                    value={action.offset_min || 0}
                    onChange={(e) => updateAction(idx, "offset_min", parseInt(e.target.value) || 0)}
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