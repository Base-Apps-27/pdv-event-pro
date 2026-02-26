/**
 * SubAssignmentRow.jsx — V2 renders one sub-assignment input.
 * DECISION-003: Reads from segment.ui_sub_assignments (entity field).
 * Writes to child Segment entity via dedicated handler.
 */

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

/**
 * @param {object} subConfig - { label, person_field_name, duration_min } from ui_sub_assignments
 * @param {object|null} childEntity - The child Segment entity (if exists)
 * @param {function} onWriteChild - (childEntityId, column, value) or (null, subConfig, value) for create
 */
export default function SubAssignmentRow({ subConfig, childEntity, onWriteChild }) {
  const value = childEntity?.presenter || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="bg-purple-50 border border-purple-200 rounded p-2">
      <Label className="text-xs font-semibold text-purple-800 mb-1">
        {subConfig.label} {subConfig.duration_min ? `(${subConfig.duration_min} min)` : ''}
      </Label>
      <AutocompleteInput
        type="person"
        placeholder={`Nombre para ${subConfig.label}`}
        value={local}
        onChange={(e) => {
          const val = e.target.value;
          setLocal(val);
          if (childEntity?.id) {
            onWriteChild(childEntity.id, 'presenter', val);
          } else {
            // No child entity yet — parent handler will create one
            onWriteChild(null, subConfig, val);
          }
        }}
        className="text-sm"
      />
    </div>
  );
}