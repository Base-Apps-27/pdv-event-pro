/**
 * SpeakerMaterialSection.jsx — V2 speaker material inputs.
 * HARDENING (Phase 9):
 *   - Memoized
 *   - Print: shows URLs as clickable links
 *   - URL validation visual hint (green border for valid URLs)
 */

import React, { useState, useEffect, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "lucide-react";
import { SPEAKER_MATERIAL_FIELDS } from "../constants/fieldMap";

function isValidUrl(str) {
  if (!str) return false;
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('www.');
}

export default memo(function SpeakerMaterialSection({ segment, onWrite }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2 space-y-2">
      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
        <Link className="w-3 h-3" />
        Material del Orador
      </Label>

      {/* Screen: editable */}
      <div className="print:hidden space-y-2">
        {SPEAKER_MATERIAL_FIELDS.map(f => {
          if (f.type === 'checkbox') {
            return (
              <div key={f.column} className="flex items-center space-x-2">
                <Checkbox
                  checked={!!segment[f.column]}
                  onCheckedChange={(checked) => onWrite(segment.id, f.column, checked)}
                  id={`${f.column}-${segment.id}`}
                  className="bg-white"
                />
                <label
                  htmlFor={`${f.column}-${segment.id}`}
                  className="text-xs cursor-pointer text-gray-600"
                >
                  {f.label}
                </label>
              </div>
            );
          }
          return (
            <SpeakerInput
              key={f.column}
              segment={segment}
              column={f.column}
              placeholder={f.label}
              onWrite={onWrite}
            />
          );
        })}
      </div>

      {/* Print: read-only with links */}
      <div className="hidden print:block space-y-1">
        {SPEAKER_MATERIAL_FIELDS.map(f => {
          const val = segment[f.column];
          if (!val) return null;
          if (f.type === 'checkbox') {
            return val ? (
              <div key={f.column} className="text-xs text-gray-700">✓ {f.label}</div>
            ) : null;
          }
          return (
            <div key={f.column} className="text-xs">
              <span className="font-semibold">{f.label}:</span>{' '}
              {isValidUrl(val) ? (
                <a href={val.startsWith('http') ? val : `https://${val}`} className="text-blue-600 underline">{val}</a>
              ) : (
                <span className="text-gray-700">{val}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SpeakerInput = memo(function SpeakerInput({ segment, column, placeholder, onWrite }) {
  const value = segment[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const hasUrl = isValidUrl(local);

  return (
    <Input
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        setLocal(e.target.value);
        onWrite(segment.id, column, e.target.value);
      }}
      className={`text-xs bg-white ${hasUrl ? 'border-green-400 focus:border-green-500' : ''}`}
    />
  );
});