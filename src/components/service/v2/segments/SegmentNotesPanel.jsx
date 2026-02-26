/**
 * SegmentNotesPanel.jsx — V2 expandable notes panel.
 * Renders all department note textareas for a segment.
 * Reads/writes directly from entity columns.
 */

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NOTES_FIELDS } from "../constants/fieldMap";

export default function SegmentNotesPanel({ segment, onWrite, onWriteDuration }) {
  return (
    <div className="space-y-2 pt-2 border-t">
      {/* Duration */}
      <DurationInput segment={segment} onWriteDuration={onWriteDuration} />
      {/* Coordinator actions (read-only from entity) */}
      {segment.segment_actions?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <Label className="text-xs font-semibold text-amber-900 mb-2 block">⏰ Acciones para Coordinador</Label>
          <div className="space-y-1">
            {segment.segment_actions.map((action, idx) => (
              <div key={idx} className="text-xs text-amber-800 flex items-start gap-1">
                <span className="font-semibold">•</span>
                <span>{action?.label || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Notes fields */}
      {NOTES_FIELDS.map(f => (
        <NoteTextarea
          key={f.column}
          segment={segment}
          column={f.column}
          placeholder={f.label}
          onWrite={onWrite}
        />
      ))}
    </div>
  );
}

function DurationInput({ segment, onWriteDuration }) {
  const [local, setLocal] = useState(segment.duration_min || 0);
  useEffect(() => { setLocal(segment.duration_min || 0); }, [segment.duration_min]);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
      <Input
        type="number"
        value={local}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 0;
          setLocal(val);
          onWriteDuration(segment.id, val);
        }}
        className="text-xs w-24"
      />
    </div>
  );
}

function NoteTextarea({ segment, column, placeholder, onWrite }) {
  const value = segment[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Textarea
      placeholder={placeholder}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onWrite(segment.id, column, e.target.value);
      }}
      className="text-xs"
      rows={2}
    />
  );
}