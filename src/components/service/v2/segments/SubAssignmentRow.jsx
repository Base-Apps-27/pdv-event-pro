/**
 * SubAssignmentRow.jsx — V2 renders one sub-assignment input.
 * DECISION-003: Reads from segment.ui_sub_assignments (entity field).
 * HARDENING (Phase 9):
 *   - Memoized
 *   - Print: read-only display
 *   - Shows assignment status (filled vs empty)
 */

import React, { useState, useEffect, useRef, memo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useLanguage } from "@/components/utils/i18n.jsx";

/**
 * @param {object} subConfig - { label, person_field_name, duration_min } from ui_sub_assignments
 * @param {object|null} childEntity - The child Segment entity (if exists)
 * @param {function} onWriteChild - (childEntityId, column, value) or (null, subConfig, value) for create
 * @param {string} parentSegmentId - The parent segment's ID (required for creating child segments)
 */
/**
 * BUGFIX (2026-02-26): Comprehensive sub-assignment management.
 * 
 * Key behaviors:
 * 1. If childEntity exists → update its presenter via onWriteChild (debounced by useEntityWrite)
 * 2. If childEntity doesn't exist → debounce locally (600ms) then call onWriteChild to CREATE once.
 *    This prevents rapid-fire creation of multiple orphan segments while the user types.
 * 3. Once a child is created, subsequent keystrokes take path #1 (update, not create).
 * 4. parentSegmentId is always required for creates to prevent orphan segments.
 */
export default memo(function SubAssignmentRow({ subConfig, childEntity, onWriteChild, parentSegmentId }) {
  const { t } = useLanguage();
  const value = childEntity?.presenter || '';
  const [local, setLocal] = useState(value);
  const createTimerRef = useRef(null);

  // Sync local state when entity value changes (e.g. after create completes)
  useEffect(() => { setLocal(value); }, [value]);

  // Cleanup create timer on unmount
  useEffect(() => {
    return () => {
      if (createTimerRef.current) clearTimeout(createTimerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocal(val);

    if (childEntity?.id) {
      // Child entity exists → update via the standard write path (already debounced)
      onWriteChild(childEntity.id, 'presenter', val);
    } else {
      // No child entity yet — debounce CREATE to avoid multiple creates while typing.
      // Cancel any pending create timer so only the final value triggers a create.
      if (createTimerRef.current) clearTimeout(createTimerRef.current);

      if (val.trim()) {
        createTimerRef.current = setTimeout(() => {
          createTimerRef.current = null;
          // Double-check we still don't have a child (it may have arrived via refetch)
          onWriteChild(null, { ...subConfig, parentId: parentSegmentId }, val);
        }, 600);
      }
    }
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-semibold text-purple-800">
          {subConfig.label} {subConfig.duration_min ? `(${subConfig.duration_min} min)` : ''}
        </Label>
        {value ? (
          <Badge variant="outline" className="text-[9px] bg-green-50 border-green-300 text-green-700">{t('sub.assigned')}</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] bg-gray-50 border-gray-300 text-gray-500">{t('sub.pending')}</Badge>
        )}
      </div>
      {/* Screen: editable */}
      <div className="print:hidden">
        <AutocompleteInput
          type="person"
          placeholder={t('sub.nameFor').replace('{label}', subConfig.label)}
          value={local}
          onChange={handleChange}
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