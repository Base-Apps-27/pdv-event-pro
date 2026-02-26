/**
 * SegmentNotesPanel.jsx — V2 expandable notes panel.
 * HARDENING (Phase 8):
 *   - Visibility toggles (show_in_general, show_in_projection, etc.)
 *   - Stage call offset input
 *   - Microphone assignments field
 *   - All NOTES_FIELDS from registry
 */

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { NOTES_FIELDS } from "../constants/fieldMap";

const VISIBILITY_TOGGLES = [
  { column: 'show_in_general',    label: 'General' },
  { column: 'show_in_projection', label: 'Proyección' },
  { column: 'show_in_sound',      label: 'Sonido' },
  { column: 'show_in_ushers',     label: 'Ujieres' },
  { column: 'show_in_livestream', label: 'Livestream' },
];

export default function SegmentNotesPanel({ segment, onWrite, onWriteDuration }) {
  return (
    <div className="space-y-3 pt-2 border-t">
      {/* Duration + Stage Call in one row */}
      <div className="grid grid-cols-2 gap-3">
        <DurationInput segment={segment} onWriteDuration={onWriteDuration} />
        <StageCallInput segment={segment} onWrite={onWrite} />
      </div>

      {/* Visibility toggles */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Visibilidad en Reportes</Label>
        <div className="flex flex-wrap gap-3">
          {VISIBILITY_TOGGLES.map(v => (
            <VisibilityToggle
              key={v.column}
              segment={segment}
              column={v.column}
              label={v.label}
              onWrite={onWrite}
            />
          ))}
        </div>
      </div>

      {/* Coordinator actions (read-only from entity) */}
      {segment.segment_actions?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <Label className="text-xs font-semibold text-amber-900 mb-2 block">⏰ Acciones para Coordinador</Label>
          <div className="space-y-1">
            {segment.segment_actions.map((action, idx) => (
              <div key={idx} className="text-xs text-amber-800 flex items-start gap-1">
                <span className="font-semibold">•</span>
                <span>
                  {action?.label || ''}
                  {action?.department && <Badge variant="outline" className="ml-1 text-[9px] py-0">{action.department}</Badge>}
                </span>
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
      <Label className="text-xs font-semibold text-gray-700">Duración (min)</Label>
      <Input
        type="number"
        value={local}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 0;
          setLocal(val);
          onWriteDuration(segment.id, val);
        }}
        className="text-xs w-full"
        min={0}
        max={180}
      />
    </div>
  );
}

function StageCallInput({ segment, onWrite }) {
  const [local, setLocal] = useState(segment.stage_call_offset_min ?? '');
  useEffect(() => { setLocal(segment.stage_call_offset_min ?? ''); }, [segment.stage_call_offset_min]);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-700">Stage Call (min antes)</Label>
      <Input
        type="number"
        value={local}
        placeholder="15"
        onChange={(e) => {
          const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
          setLocal(val);
          onWrite(segment.id, 'stage_call_offset_min', val === '' ? null : val);
        }}
        className="text-xs w-full"
        min={0}
        max={60}
      />
    </div>
  );
}

function VisibilityToggle({ segment, column, label, onWrite }) {
  const checked = segment[column] !== false; // default true
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onWrite(segment.id, column, !!val)}
        id={`${column}-${segment.id}`}
        className="h-3.5 w-3.5"
      />
      <label htmlFor={`${column}-${segment.id}`} className="text-[10px] text-gray-600 cursor-pointer">
        {label}
      </label>
    </div>
  );
}

function NoteTextarea({ segment, column, placeholder, onWrite }) {
  const value = segment[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  // Only show if it has content or user is editing
  const [touched, setTouched] = useState(false);
  if (!value && !touched) {
    return (
      <button
        onClick={() => setTouched(true)}
        className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded px-2 py-1 w-full text-left transition-colors"
      >
        + {placeholder}
      </button>
    );
  }

  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-gray-500">{placeholder}</Label>
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
    </div>
  );
}