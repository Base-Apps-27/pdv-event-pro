/**
 * ScheduleEditorSession — Editable session card containing its segment list.
 * Header shows session name, date, time. Body lists segments with inline editing.
 */
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import ScheduleEditorSegment from "./ScheduleEditorSegment";

const SESSION_COLORS = ["green", "blue", "pink", "orange", "yellow", "purple", "red"];
const COLOR_DOTS = {
  green: "bg-green-500", blue: "bg-blue-500", pink: "bg-pink-500",
  orange: "bg-orange-500", yellow: "bg-yellow-500", purple: "bg-purple-500", red: "bg-red-500"
};

export default function ScheduleEditorSession({
  session,
  sessionIndex,
  onSessionChange,
  onRemoveSession,
  totalSessions
}) {
  const { language } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const updateField = (field, value) => {
    onSessionChange({ ...session, [field]: value });
  };

  const updateSegment = (segIndex, updatedSeg) => {
    const newSegments = [...(session.segments || [])];
    newSegments[segIndex] = updatedSeg;
    onSessionChange({ ...session, segments: newSegments });
  };

  const removeSegment = (segIndex) => {
    const newSegments = (session.segments || []).filter((_, i) => i !== segIndex);
    // Re-order
    newSegments.forEach((s, i) => { s.order = i + 1; });
    onSessionChange({ ...session, segments: newSegments });
  };

  const addSegment = () => {
    const segs = session.segments || [];
    const lastSeg = segs[segs.length - 1];
    // Try to calculate a reasonable start_time
    let newStart = "";
    if (lastSeg?.start_time && lastSeg?.duration_min) {
      const [h, m] = lastSeg.start_time.split(":").map(Number);
      const totalMin = h * 60 + m + (lastSeg.duration_min || 0);
      newStart = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    }
    onSessionChange({
      ...session,
      segments: [
        ...segs,
        {
          title: "",
          segment_type: "Especial",
          start_time: newStart,
          duration_min: 10,
          order: segs.length + 1,
          color_code: "default"
        }
      ]
    });
  };

  const segmentCount = (session.segments || []).length;
  const dotColor = COLOR_DOTS[session.session_color] || COLOR_DOTS.blue;

  return (
    <Card className="overflow-hidden border-gray-300">
      {/* Session Header */}
      <div className="p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
          <Input
            value={session.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder={language === "es" ? "Nombre de sesión" : "Session name"}
            className="h-8 text-sm font-semibold flex-1 bg-white"
          />
          <Badge variant="outline" className="text-[10px] shrink-0">
            {segmentCount} {language === "es" ? "seg" : "seg"}
          </Badge>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {/* Session metadata row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-gray-500">{language === "es" ? "Fecha" : "Date"}:</label>
            <Input
              type="date"
              value={session.date || ""}
              onChange={(e) => updateField("date", e.target.value)}
              className="h-7 text-xs w-[130px] bg-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-gray-500">{language === "es" ? "Inicio" : "Start"}:</label>
            <Input
              value={session.planned_start_time || ""}
              onChange={(e) => updateField("planned_start_time", e.target.value)}
              placeholder="HH:MM"
              className="h-7 text-xs w-[70px] bg-white text-center"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-gray-500">{language === "es" ? "Fin" : "End"}:</label>
            <Input
              value={session.planned_end_time || ""}
              onChange={(e) => updateField("planned_end_time", e.target.value)}
              placeholder="HH:MM"
              className="h-7 text-xs w-[70px] bg-white text-center"
            />
          </div>
          <Select value={session.session_color || "blue"} onValueChange={(v) => updateField("session_color", v)}>
            <SelectTrigger className="h-7 w-[90px] text-[11px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_COLORS.map((c) => (
                <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {totalSessions > 1 && (
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-700 ml-auto"
              onClick={onRemoveSession}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {language === "es" ? "Eliminar sesión" : "Remove session"}
            </Button>
          )}
        </div>
      </div>

      {/* Segments list */}
      {!collapsed && (
        <div className="p-2 space-y-1">
          {/* Column headers */}
          <div className="flex items-center gap-1.5 px-2 text-[9px] text-gray-400 uppercase tracking-wider">
            <span className="w-3.5" />
            <span className="w-5 text-center">#</span>
            <span className="flex-1">{language === "es" ? "Título" : "Title"}</span>
            <span className="w-[100px]">{language === "es" ? "Tipo" : "Type"}</span>
            <span className="w-[60px] text-center">{language === "es" ? "Hora" : "Time"}</span>
            <span className="w-[48px] text-center">Min</span>
            <span className="w-6" />
            <span className="w-6" />
          </div>

          {(session.segments || []).map((seg, sIdx) => (
            <ScheduleEditorSegment
              key={sIdx}
              segment={seg}
              index={sIdx}
              onChange={(updated) => updateSegment(sIdx, updated)}
              onRemove={() => removeSegment(sIdx)}
            />
          ))}

          <Button
            variant="ghost" size="sm"
            className="w-full text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 mt-1"
            onClick={addSegment}
          >
            <Plus className="w-3 h-3 mr-1" />
            {language === "es" ? "Agregar segmento" : "Add segment"}
          </Button>
        </div>
      )}
    </Card>
  );
}