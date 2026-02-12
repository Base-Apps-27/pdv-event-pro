/**
 * SegmentActionsEditor.jsx
 * Phase 3B Extraction: Segment actions/tasks editor from SegmentFormTwoColumn
 * ~200 lines extracted — handles adding, editing, and deleting timed operational tasks.
 * 
 * Props:
 *   actions - array of action objects (formData.segment_actions)
 *   onChange - callback(newActions) when actions change
 *   formData - { start_time, duration_min } for time calculation
 *   language - 'es' | 'en'
 */
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Zap } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

const DEPARTMENTS = [
  "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Kids", "Coordinador", "Stage & Decor", "Alabanza", "Translation", "Other"
];

const ACTION_TIMINGS = [
  { value: "before_start", label: "Antes de iniciar" },
  { value: "after_start", label: "Después de iniciar" },
  { value: "before_end", label: "Antes de terminar" },
  { value: "absolute", label: "Hora exacta" }
];

function calculateActionTime(action, startTime, durationMin) {
  if (!startTime) return null;
  const [startH, startM] = startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = startMinutes + (durationMin || 0);
  const offset = action.offset_min || 0;

  let targetMinutes;
  switch (action.timing) {
    case 'before_start':
      targetMinutes = startMinutes - offset;
      break;
    case 'after_start':
      targetMinutes = startMinutes + offset;
      break;
    case 'before_end':
      targetMinutes = endMinutes - offset;
      break;
    case 'absolute':
      return action.absolute_time ? formatTimeToEST(action.absolute_time) : null;
    default:
      return null;
  }

  if (targetMinutes < 0) targetMinutes += 24 * 60;
  const h = Math.floor(targetMinutes / 60) % 24;
  const m = targetMinutes % 60;
  return formatTimeToEST(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export default function SegmentActionsEditor({ actions, onChange, formData, language }) {
  const handleAdd = () => {
    onChange([...actions, {
      label: "",
      department: "Other",
      timing: "before_start",
      offset_min: 5,
      notes: ""
    }]);
  };

  const handleUpdate = (index, field, value) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleDelete = (index) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div id="acciones" className="bg-white rounded-lg border border-l-4 border-l-orange-500 border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <h3 className="font-bold text-lg text-slate-900">Acciones / Tareas de Preparación</h3>
        </div>
        <Badge variant="outline" className="text-xs">{actions.length}</Badge>
      </div>
      <div className="p-4 space-y-3">
        {actions.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center py-2">No hay acciones definidas para este segmento.</p>
        ) : (
          actions.map((action, idx) => {
            const actionTime = calculateActionTime(action, formData.start_time, formData.duration_min);

            return (
              <Card key={idx} className="p-3 bg-orange-50/30 border-orange-200">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      placeholder="Etiqueta (ej: A&A sube)"
                      className="flex-1 h-8 text-sm bg-white"
                      value={action.label || ""}
                      onChange={(e) => handleUpdate(idx, 'label', e.target.value)}
                    />
                    {actionTime && (
                      <span className="text-xs font-mono font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded whitespace-nowrap">
                        @ {actionTime}
                      </span>
                    )}
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Select value={action.department || "Other"} onValueChange={(val) => handleUpdate(idx, 'department', val)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={action.timing || "before_end"} onValueChange={(val) => handleUpdate(idx, 'timing', val)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Timing" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TIMINGS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 text-xs w-16 bg-white"
                      value={action.offset_min || 0}
                      onChange={(e) => handleUpdate(idx, 'offset_min', parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${action.timing === 'before_start' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {action.timing === 'before_start' ? '⚡ PREP' : '▶ DURANTE'}
                  </span>
                </div>
                <Input
                  placeholder="Notas adicionales..."
                  className="h-8 text-xs bg-white"
                  value={action.notes || ""}
                  onChange={(e) => handleUpdate(idx, 'notes', e.target.value)}
                />
              </Card>
            );
          })
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Acción
        </Button>
      </div>
    </div>
  );
}