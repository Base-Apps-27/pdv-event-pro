/**
 * DEFAULT_UI_FIELDS.js — Default ui_fields by segment type for Custom V2.
 * 
 * DECISION (2026-03-02): Custom services don't use blueprints.
 * When a segment is created manually, its ui_fields are populated from
 * this map based on segment_type. This replaces the blueprint-driven
 * auto-population that Weekly V2 uses.
 *
 * Keys = Segment entity enum values (from segmentTypeMap).
 * Values = arrays of field keys matching FIELD_REGISTRY in fieldMap.js.
 */

export const DEFAULT_UI_FIELDS = {
  Alabanza:     ['leader', 'songs', 'translator', 'description'],
  Plenaria:     ['preacher', 'verse', 'translator', 'description'],
  Bienvenida:   ['presenter', 'translator', 'description'],
  Ofrenda:      ['presenter', 'translator', 'description'],
  Oración:      ['presenter', 'translator', 'description'],
  Cierre:       ['presenter', 'translator', 'description'],
  Anuncio:      ['presenter', 'description'],
  Video:        ['presenter', 'description'],
  Dinámica:     ['presenter', 'translator', 'description'],
  Ministración: ['presenter', 'translator', 'description'],
  Especial:     ['presenter', 'description'],
  MC:           ['presenter', 'description'],
  Receso:       ['description'],
  Almuerzo:     ['description'],
  Artes:        ['presenter', 'description'],
  Breakout:     ['presenter', 'description'],
  Panel:        ['presenter', 'description'],
  Break:        ['description'],
  TechOnly:     ['description'],
};

/**
 * DEFAULT_SUB_ASSIGNMENTS — Segment types that get sub-assignments by default.
 * Only Alabanza gets Ministración sub-assignments out of the box.
 * Admins can add more via the UI after creation.
 */
export const DEFAULT_SUB_ASSIGNMENTS = {
  Alabanza: [
    { label: 'Ministración', person_field_name: 'presenter', duration_min: 10 },
  ],
};

/**
 * getDefaultUiFields — Returns the default ui_fields array for a segment type.
 * Falls back to ['presenter', 'description'] for unknown types.
 */
export function getDefaultUiFields(segmentType) {
  return DEFAULT_UI_FIELDS[segmentType] || ['presenter', 'description'];
}

/**
 * getDefaultSubAssignments — Returns the default ui_sub_assignments for a segment type.
 */
export function getDefaultSubAssignments(segmentType) {
  return DEFAULT_SUB_ASSIGNMENTS[segmentType] || [];
}