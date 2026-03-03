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
import SegmentActionsEditor from "@/components/session/SegmentActionsEditor";
import { useLanguage } from "@/components/utils/i18n.jsx";

const VISIBILITY_TOGGLES = [
  { column: 'show_in_general',    labelKey: 'notes.general' },
  { column: 'show_in_projection', labelKey: 'notes.projection' },
  { column: 'show_in_sound',      labelKey: 'notes.sound' },
  { column: 'show_in_ushers',     labelKey: 'notes.ushers' },
  { column: 'show_in_livestream', labelKey: 'notes.livestream' },
];

export default function SegmentNotesPanel({ segment, onWrite, onWriteDuration }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 pt-2 border-t">
      {/* Duration + Stage Call in one row */}
      <div className="grid grid-cols-2 gap-3">
        <DurationInput segment={segment} onWriteDuration={onWriteDuration} />
        <StageCallInput segment={segment} onWrite={onWrite} />
      </div>

      {/* Visibility toggles */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">{t('notes.reportVisibility')}</Label>
        <div className="flex flex-wrap gap-3">
          {VISIBILITY_TOGGLES.map(v => (
            <VisibilityToggle
              key={v.column}
              segment={segment}
              column={v.column}
              label={t(v.labelKey)}
              onWrite={onWrite}
            />
          ))}
        </div>
      </div>

      {/* Coordinator actions — editable (2026-03-01: replaced read-only display) */}
      <SegmentActionsEditor
        actions={segment.segment_actions || []}
        onChange={(newActions) => onWrite(segment.id, 'segment_actions', newActions)}
        formData={{ start_time: segment.start_time, duration_min: segment.duration_min }}
        language="es"
      />

      {/* Notes fields */}
      {NOTES_FIELDS.map(f => (
        <NoteTextarea
          key={f.column}
          segment={segment}
          column={f.column}
          placeholder={t(f.labelKey)}
          onWrite={onWrite}
        />
      ))}
    </div>
  );
}

function DurationInput({ segment, onWriteDuration }) {
  const { t } = useLanguage();
  const [local, setLocal] = useState(segment.duration_min || 0);
  useEffect(() => { setLocal(segment.duration_min || 0); }, [segment.duration_min]);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-700">{t('notes.durationMin')}</Label>
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
  const { t } = useLanguage();
  const [local, setLocal] = useState(segment.stage_call_offset_min ?? '');
  useEffect(() => { setLocal(segment.stage_call_offset_min ?? ''); }, [segment.stage_call_offset_min]);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-700">{t('notes.stageCallMin')}</Label>
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