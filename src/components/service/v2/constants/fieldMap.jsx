/**
 * fieldMap.js — V2 Weekly Editor Field Registry
 * DECISION-003: Single source of truth for field metadata.
 *
 * Every UI field that can appear on a segment is registered here.
 * FieldRenderer reads from this registry — no conditionals, no fallbacks.
 *
 * `column` = the Segment entity column name to read/write.
 * `label`  = Spanish display label.
 * `type`   = input component type.
 * `autocompleteType` = suggestion type for AutocompleteInput.
 * `hasVerseParser` = shows verse parser button alongside.
 *
 * HARDENING (Phase 8):
 *   - Added livestream_notes and show_in_livestream to NOTES_FIELDS
 *   - Added microphone_assignments and other_notes
 *   - Added prep_instructions for coordinator prep
 *   - SPEAKER_MATERIAL_FIELDS now includes all content delivery fields
 *   - TEXT_COPY_COLUMNS exported for cross-slot copy consistency
 */

export const FIELD_REGISTRY = {
  leader:      { column: 'presenter',            label: 'Director de A&A',     type: 'autocomplete', autocompleteType: 'worshipLeader', hint: 'Sarah Manzano o Anthony Estrella' },
  presenter:   { column: 'presenter',            label: 'Presentador',         type: 'autocomplete', autocompleteType: 'presenter' },
  preacher:    { column: 'presenter',            label: 'Predicador',          type: 'autocomplete', autocompleteType: 'preacher' },
  title:       { column: 'message_title',        label: 'Título del Mensaje',  type: 'text' },
  verse:       { column: 'scripture_references', label: 'Verso / Cita Bíblica', type: 'text', hasVerseParser: true },
  songs:       { column: null,                   label: 'Canciones',           type: 'songs' },
  translator:  { column: 'translator_name',      label: 'Traductor(a)',        type: 'autocomplete', autocompleteType: 'translator' },
  description: { column: 'description_details',  label: 'Descripción / Notas', type: 'textarea' },
  ministry_leader: { column: null,               label: 'Ministración',        type: 'sub_assignment_legacy' },
};

/**
 * Team fields: displayed in TeamSection per session.
 * `key`    = the serviceData team key (used for receso_notes compatibility)
 * `column` = Session entity column name
 * `label`  = Spanish display label
 */
export const TEAM_FIELDS = [
  { key: 'coordinators',  column: 'coordinators',      label: 'Coordinador(a)' },
  { key: 'ujieres',       column: 'ushers_team',       label: 'Ujieres' },
  { key: 'sound',         column: 'sound_team',        label: 'Sonido' },
  { key: 'luces',         column: 'tech_team',         label: 'Luces' },
  { key: 'fotografia',    column: 'photography_team',  label: 'Fotografía' },
];

/**
 * Notes fields: displayed in the expandable notes panel per segment.
 * `column` = Segment entity column name
 * `label`  = Spanish display label
 */
export const NOTES_FIELDS = [
  { column: 'coordinator_notes',   label: 'Notas para Coordinador' },
  { column: 'projection_notes',    label: 'Notas de Proyección' },
  { column: 'sound_notes',         label: 'Notas de Sonido' },
  { column: 'ushers_notes',        label: 'Notas de Ujieres' },
  { column: 'translation_notes',   label: 'Notas de Traducción' },
  { column: 'livestream_notes',    label: 'Notas de Livestream' },
  { column: 'stage_decor_notes',   label: 'Notas de Stage/Decor' },
  { column: 'microphone_assignments', label: 'Asignación de Micrófonos' },
  { column: 'prep_instructions',   label: 'Instrucciones de Preparación' },
  { column: 'other_notes',         label: 'Notas Adicionales' },
  { column: 'description_details', label: 'Notas Generales' },
];

/**
 * Speaker material fields: displayed for message/plenaria segments.
 * These appear when 'verse' is in ui_fields.
 */
export const SPEAKER_MATERIAL_FIELDS = [
  { column: 'presentation_url',      label: 'Enlace a Presentación (Slides)', type: 'text' },
  { column: 'notes_url',             label: 'Link de Bosquejo / Notas (PDF o Doc)', type: 'text' },
  { column: 'content_is_slides_only', label: 'Solo Slides (Sin versículos)', type: 'checkbox' },
];

/**
 * Text columns eligible for cross-slot copy.
 * Exported so useCopyBetweenSlots stays in sync with the registry.
 */
export const TEXT_COPY_COLUMNS = [
  'presenter', 'message_title', 'scripture_references', 'translator_name',
  'description_details', 'coordinator_notes', 'projection_notes',
  'sound_notes', 'ushers_notes', 'translation_notes', 'stage_decor_notes',
  'livestream_notes', 'microphone_assignments', 'other_notes', 'prep_instructions',
  // Speaker material
  'presentation_url', 'notes_url', 'content_is_slides_only',
];