/**
 * FieldRenderer.jsx — V2 renders a single UI field for a segment.
 * DECISION-003 Principle 2: ui_fields drives ALL rendering.
 *
 * Maps a field key (from segment.ui_fields) to the correct input.
 * Reads values directly from entity columns. No alias chains.
 * No fallbacks. Unknown fields are silently skipped.
 */

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { FIELD_REGISTRY, SPEAKER_MATERIAL_FIELDS } from "../constants/fieldMap";
import SongRows from "./SongRows";
import SpeakerMaterialSection from "./SpeakerMaterialSection";

/**
 * @param {object} segment - Raw Segment entity object
 * @param {string} field - Key from segment.ui_fields (e.g. "leader", "verse")
 * @param {function} onWrite - (segmentId, column, value) => void
 * @param {function} onWriteSongs - (segmentId, songs[]) => void
 * @param {function} onOpenVerseParser - (segmentId) => void
 */
export default function FieldRenderer({ segment, field, onWrite, onWriteSongs, onOpenVerseParser }) {
  const config = FIELD_REGISTRY[field];
  if (!config) return null;

  // songs and sub_assignment_legacy are handled by parent (SegmentCard)
  if (config.type === 'songs' || config.type === 'sub_assignment_legacy') return null;

  const segmentId = segment.id;
  const value = segment[config.column] || '';

  return (
    <div className="space-y-1">
      {config.type === 'autocomplete' && (
        <DebouncedAutocomplete
          segmentId={segmentId}
          column={config.column}
          value={value}
          type={config.autocompleteType}
          placeholder={config.label}
          hint={config.hint}
          onWrite={onWrite}
        />
      )}
      {config.type === 'text' && !config.hasVerseParser && (
        <DebouncedInput
          segmentId={segmentId}
          column={config.column}
          value={value}
          placeholder={config.label}
          onWrite={onWrite}
        />
      )}
      {config.type === 'text' && config.hasVerseParser && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <DebouncedInput
              segmentId={segmentId}
              column={config.column}
              value={value}
              placeholder={config.label}
              onWrite={onWrite}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenVerseParser?.(segmentId)}
              className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
              title="Analizar versos y bosquejo"
            >
              <BookOpen className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-gray-500 italic">
            💡 Usa el ícono 📖 para extraer y estructurar referencias bíblicas
          </p>
          {segment.parsed_verse_data && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
              ✓ Analizado ({segment.parsed_verse_data.sections?.length || 0} elementos)
            </Badge>
          )}
          <SpeakerMaterialSection segment={segment} onWrite={onWrite} />
        </div>
      )}
      {config.type === 'textarea' && (
        <DebouncedTextarea
          segmentId={segmentId}
          column={config.column}
          value={value}
          placeholder={config.label}
          onWrite={onWrite}
        />
      )}
    </div>
  );
}

// ── Internal controlled input components ──────────────────────

function DebouncedInput({ segmentId, column, value, placeholder, onWrite, className = "text-sm" }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      placeholder={placeholder}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onWrite(segmentId, column, e.target.value);
      }}
      className={className}
    />
  );
}

function DebouncedTextarea({ segmentId, column, value, placeholder, onWrite }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Textarea
      placeholder={placeholder}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onWrite(segmentId, column, e.target.value);
      }}
      className="text-sm"
      rows={2}
    />
  );
}

function DebouncedAutocomplete({ segmentId, column, value, type, placeholder, hint, onWrite }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div className="space-y-1">
      <AutocompleteInput
        type={type}
        placeholder={placeholder}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onWrite(segmentId, column, e.target.value);
        }}
        className="text-sm"
      />
      {hint && (
        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
          💡 {hint}
        </p>
      )}
    </div>
  );
}