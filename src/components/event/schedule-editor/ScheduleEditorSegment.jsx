/**
 * ScheduleEditorSegment — Inline-editable segment row within a session card.
 * Shows: order, title, type, time, duration, presenter. All inline-editable.
 */
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { VALID_SEGMENT_TYPES } from "@/components/utils/segmentValidation";

const COLOR_MAP = {
  Alabanza: "bg-purple-50 border-purple-200",
  Plenaria: "bg-blue-50 border-blue-200",
  Break: "bg-gray-100 border-gray-300",
  Receso: "bg-gray-100 border-gray-300",
  Almuerzo: "bg-amber-50 border-amber-200",
  Oración: "bg-indigo-50 border-indigo-200",
  Ministración: "bg-purple-50 border-purple-200",
  Artes: "bg-pink-50 border-pink-200",
  Video: "bg-cyan-50 border-cyan-200",
  default: "bg-white border-gray-200"
};

export default function ScheduleEditorSegment({ segment, index, onChange, onRemove }) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const colorClass = COLOR_MAP[segment.segment_type] || COLOR_MAP.default;

  const update = (field, value) => {
    onChange({ ...segment, [field]: value });
  };

  return (
    <div className={`border rounded-lg ${colorClass} transition-colors`}>
      {/* Compact row — always visible */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0 cursor-grab" />
        
        <span className="text-[10px] text-gray-400 w-5 shrink-0 text-center font-mono">
          {index + 1}
        </span>

        <Input
          value={segment.title || ""}
          onChange={(e) => update("title", e.target.value)}
          placeholder={language === "es" ? "Título del segmento" : "Segment title"}
          className="h-7 text-xs flex-1 min-w-0 bg-transparent border-0 shadow-none focus-visible:ring-1 px-1.5"
        />

        <Select value={segment.segment_type || ""} onValueChange={(v) => update("segment_type", v)}>
          <SelectTrigger className="h-7 w-[100px] text-[11px] bg-transparent border-0 shadow-none shrink-0">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {VALID_SEGMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={segment.start_time || ""}
          onChange={(e) => update("start_time", e.target.value)}
          placeholder="HH:MM"
          className="h-7 w-[60px] text-xs text-center bg-transparent border-0 shadow-none focus-visible:ring-1 px-1 shrink-0"
        />

        <Input
          value={segment.duration_min ?? ""}
          onChange={(e) => update("duration_min", e.target.value ? Number(e.target.value) : "")}
          placeholder="min"
          type="number"
          className="h-7 w-[48px] text-xs text-center bg-transparent border-0 shadow-none focus-visible:ring-1 px-1 shrink-0"
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-400 hover:text-red-600 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-dashed grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">{language === "es" ? "Presentador" : "Presenter"}</label>
            <Input
              value={segment.presenter || ""}
              onChange={(e) => update("presenter", e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">{language === "es" ? "Título del Mensaje" : "Message Title"}</label>
            <Input
              value={segment.message_title || ""}
              onChange={(e) => update("message_title", e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-gray-500 uppercase">{language === "es" ? "Notas" : "Notes"}</label>
            <Input
              value={segment.description_details || ""}
              onChange={(e) => update("description_details", e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}