/**
 * FieldRenderer.jsx — V2 renders a single UI field for a segment.
 * DECISION-003 Principle 2: ui_fields drives ALL rendering.
 * HARDENING (Phase 9):
 *   - Memoized sub-components
 *   - Label shown above each field for clarity
 *   - Print: read-only text display
 *   - Handles missing config gracefully with console warning
 */

import React, { useState, useEffect, memo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { FIELD_REGISTRY } from "../constants/fieldMap";
import SpeakerMaterialSection from "./SpeakerMaterialSection";
import ParsedContentPreview from "../../ParsedContentPreview";

/**
 * @param {object} segment - Raw Segment entity object
 * @param {string} field - Key from segment.ui_fields (e.g. "leader", "verse")
 * @param {function} onWrite - (segmentId, column, value) => void
 * @param {function} onWriteSongs - (segmentId, songs[]) => void
 * @param {function} onOpenVerseParser - () => void (already bound to segmentId by parent)
 */
const FieldRenderer = memo(function FieldRenderer({ segment, field, onWrite, onWriteSongs, onOpenVerseParser }) {
  const config = FIELD_REGISTRY[field];
  if (!config) {
    // Unknown field key — warn once, don't crash
    console.warn(`[FieldRenderer] Unknown ui_fields key: "${field}" on segment ${segment.id}`);
    return null;
  }

  // songs and sub_assignment_legacy are handled by parent (SegmentCard)
  if (config.type === 'songs' || config.type === 'sub_assignment_legacy') return null;

  const segmentId = segment.id;
  const value = segment[config.column] || '';

  return (
    <div className="space-y-0.5">
      {/* Label */}
      <Label className="text-[10px] text-gray-500 font-medium print:font-semibold">{config.label}</Label>

      {/* Print: read-only */}
      {value && (
        <div className="hidden print:block text-xs text-gray-800">{value}</div>
      )}

      {/* Screen: editable */}
      <div className="print:hidden">
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
          <div className="space-y-2">
            {segment.parsed_verse_data ? (
              <div className="mt-2 border rounded-md p-3 bg-slate-50">
                <ParsedContentPreview parsedData={segment.parsed_verse_data} />
              </div>
            ) : (
              <div className="mt-2 border border-dashed rounded-md p-4 text-center bg-gray-50">
                <BookOpen className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Sin contenido procesado</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Las citas bíblicas son de solo lectura aquí. Ve a <strong>Procesamiento de Mensajes</strong> para añadir o modificar contenido.
                </p>
              </div>
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
    </div>
  );
});

export default FieldRenderer;

// ── Internal controlled input components ──────────────────────

const DebouncedInput = memo(function DebouncedInput({ segmentId, column, value, placeholder, onWrite, className = "text-sm" }) {
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
});

const DebouncedTextarea = memo(function DebouncedTextarea({ segmentId, column, value, placeholder, onWrite }) {
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
});

const DebouncedAutocomplete = memo(function DebouncedAutocomplete({ segmentId, column, value, type, placeholder, hint, onWrite }) {
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
});