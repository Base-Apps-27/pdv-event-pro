/**
 * SubAssignmentRow.jsx — V2 renders one sub-assignment input.
 * DECISION-003: Reads from segment.ui_sub_assignments (entity field).
 * HARDENING (Phase 9):
 *   - Memoized
 *   - Print: read-only display
 *   - Shows assignment status (filled vs empty)
 */

import React, { useState, useEffect, memo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

/**
 * @param {object} subConfig - { label, person_field_name, duration_min } from ui_sub_assignments
 * @param {object|null} childEntity - The child Segment entity (if exists)
 * @param {function} onWriteChild - (childEntityId, column, value) or (null, subConfig, value) for create
 * @param {string} parentSegmentId - The parent segment's ID (required for creating child segments)
 */
export default memo(function SubAssignmentRow({ subConfig, childEntity, onWriteChild, parentSegmentId }) {
  const value = childEntity?.presenter || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="bg-purple-50 border border-purple-200 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-semibold text-purple-800">
          {subConfig.label} {subConfig.duration_min ? `(${subConfig.duration_min} min)` : ''}
        </Label>
        {value ? (
          <Badge variant="outline" className="text-[9px] bg-green-50 border-green-300 text-green-700">Asignado</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] bg-gray-50 border-gray-300 text-gray-500">Pendiente</Badge>
        )}
      </div>
      {/* Screen: editable */}
      <div className="print:hidden">
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
              // Pass parentId so the handler can set parent_segment_id correctly
              onWriteChild(null, { ...subConfig, parentId: parentSegmentId }, val);
            }
          }}
          className="text-sm"
        />
      </div>
      {/* Print: read-only */}
      {value && (
        <div className="hidden print:block text-xs text-gray-800">{value}</div>
      )}
    </div>
  );
});