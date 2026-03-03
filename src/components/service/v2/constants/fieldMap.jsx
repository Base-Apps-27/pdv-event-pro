/**
 * fieldMap.js — V2 Weekly Editor Field Registry
 * DECISION-003: Single source of truth for field metadata.
 *
 * Every UI field that can appear on a segment is registered here.
 * FieldRenderer reads from this registry — no conditionals, no fallbacks.
 *
 * i18n (2026-03-03): Labels now use translation keys (e.g. 'fieldMap.presenter').
 * Components consuming these must pass each `labelKey` through `t()` at render time.
 *
 * `column` = the Segment entity column name to read/write.
 * `labelKey` = i18n translation key for the display label.
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
  leader:      { column: 'presenter',            labelKey: 'fieldMap.worshipLeader', hintKey: 'fieldMap.worshipLeaderHint', type: 'autocomplete', autocompleteType: 'worshipLeader' },
  presenter:   { column: 'presenter',            labelKey: 'fieldMap.presenter',     type: 'autocomplete', autocompleteType: 'presenter' },
  preacher:    { column: 'presenter',            labelKey: 'fieldMap.preacher',      type: 'autocomplete', autocompleteType: 'preacher' },
  title:       { column: 'message_title',        labelKey: 'fieldMap.messageTitle',  type: 'text' },
  verse:       { column: 'scripture_references', labelKey: 'fieldMap.verse',         type: 'text', hasVerseParser: true },
  songs:       { column: null,                   labelKey: 'fieldMap.songs',         type: 'songs' },
  translator:  { column: 'translator_name',      labelKey: 'fieldMap.translator',    type: 'autocomplete', autocompleteType: 'translator' },
  description: { column: 'description_details',  labelKey: 'fieldMap.description',   type: 'textarea' },
  ministry_leader: { column: null,               labelKey: 'fieldMap.ministry',      type: 'sub_assignment_legacy' },
};

/**
 * Team fields: displayed in TeamSection per session.
 * `key`    = the serviceData team key (used for receso_notes compatibility)
 * `column` = Session entity column name
 * `labelKey` = i18n key for display label
 */
export const TEAM_FIELDS = [
  { key: 'coordinators',  column: 'coordinators',      labelKey: 'fieldMap.coordinator' },
  { key: 'ujieres',       column: 'ushers_team',       labelKey: 'fieldMap.ushers' },
  { key: 'sound',         column: 'sound_team',        labelKey: 'fieldMap.soundTeam' },
  { key: 'luces',         column: 'tech_team',         labelKey: 'fieldMap.lightsTeam' },
  { key: 'fotografia',    column: 'photography_team',  labelKey: 'fieldMap.photographyTeam' },
];

/**
 * Notes fields: displayed in the expandable notes panel per segment.
 * `column` = Segment entity column name
 * `labelKey` = i18n key for display label
 */
export const NOTES_FIELDS = [
  { column: 'coordinator_notes',   labelKey: 'fieldMap.coordinatorNotes' },
  { column: 'projection_notes',    labelKey: 'fieldMap.projectionNotes' },
  { column: 'sound_notes',         labelKey: 'fieldMap.soundNotes' },
  { column: 'ushers_notes',        labelKey: 'fieldMap.ushersNotes' },
  { column: 'translation_notes',   labelKey: 'fieldMap.translationNotes' },
  { column: 'livestream_notes',    labelKey: 'fieldMap.livestreamNotes' },
  { column: 'stage_decor_notes',   labelKey: 'fieldMap.stageDecorNotes' },
  { column: 'microphone_assignments', labelKey: 'fieldMap.micAssignments' },
  { column: 'prep_instructions',   labelKey: 'fieldMap.prepInstructions' },
  { column: 'other_notes',         labelKey: 'fieldMap.otherNotes' },
  { column: 'description_details', labelKey: 'fieldMap.generalNotes' },
];

/**
 * Speaker material fields: displayed for message/plenaria segments.
 * These appear when 'verse' is in ui_fields.
 */
export const SPEAKER_MATERIAL_FIELDS = [
  { column: 'presentation_url',      labelKey: 'fieldMap.presentationLink', type: 'text' },
  { column: 'notes_url',             labelKey: 'fieldMap.notesLink',        type: 'text' },
  { column: 'content_is_slides_only', labelKey: 'fieldMap.slidesOnly',      type: 'checkbox' },
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