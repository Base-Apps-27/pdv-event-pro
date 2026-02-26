/**
 * SpeakerMaterialSection.jsx — V2 speaker material inputs (presentation URL, notes URL, slides-only toggle).
 * Only rendered for segments that have 'verse' in ui_fields (message/plenaria segments).
 */

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SPEAKER_MATERIAL_FIELDS } from "../constants/fieldMap";

export default function SpeakerMaterialSection({ segment, onWrite }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2 space-y-2">
      <Label className="text-xs font-semibold text-slate-700">Material del Orador</Label>
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
  );
}

function SpeakerInput({ segment, column, placeholder, onWrite }) {
  const value = segment[column] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        setLocal(e.target.value);
        onWrite(segment.id, column, e.target.value);
      }}
      className="text-xs bg-white"
    />
  );
}