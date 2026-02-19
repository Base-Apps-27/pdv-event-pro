// Validation utility for AI-proposed segment/session changes
// Ensures type safety, enum validity, and required fields before execution

export const VALID_SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video", "Anuncio",
  "Dinámica", "Break", "TechOnly", "Oración", "Especial", "Cierre",
  "MC", "Ministración", "Receso", "Almuerzo", "Artes", "Breakout", "Panel"
];

const VALID_TRANSLATION_MODES = ["InPerson", "RemoteBooth"];

const VALID_SESSION_STATUSES = ["planning", "confirmed", "in_progress", "completed", "archived"];

const VALID_EVENT_STATUSES = ["planning", "confirmed", "in_progress", "completed", "archived", "template"];

const VALID_SESSION_COLORS = ["green", "blue", "pink", "orange", "yellow", "purple", "red"];

const VALID_COLOR_CODES = ["worship", "preach", "break", "tech", "special", "default"];

const VALID_PRINT_COLORS = ["green", "blue", "pink", "orange", "yellow", "purple", "red", "teal", "charcoal"];

export const SEGMENT_TYPE_REQUIRED_FIELDS = {
  Plenaria: ["message_title"],
  Alabanza: ["number_of_songs"],
  Video: ["video_name"],
  Anuncio: ["announcement_title"],
  Artes: ["art_types"],
  Breakout: ["breakout_rooms"],
  Panel: ["panel_moderators"]
};

// Map segment types to their missing fields for inline form display
const FIELD_LABELS = {
  message_title: "Mensaje Título / Message Title",
  number_of_songs: "Número de Canciones / Number of Songs",
  video_name: "Nombre del Video / Video Name",
  video_location: "Ubicación del Video / Video Location",
  announcement_title: "Título del Anuncio / Announcement Title",
  art_types: "Tipos de Artes / Art Types",
  breakout_rooms: "Salas de Sesión Paralela / Breakout Rooms",
  panel_moderators: "Moderador(es) del Panel / Panel Moderator(s)"
};

/**
 * Validates AI-proposed actions before execution
 * Returns { isValid: boolean, errors: [], warnings: [] }
 */
export function validateAIActions(actions, context = {}, allowDraft = false) {
  const errors = [];
  const warnings = [];
  const fixableErrors = []; // Errors that user can fix in form
  let actionIndex = 0;

  for (const action of actions) {
    actionIndex++;

    // Validate create_sessions
    // 2026-02-19: Downgraded session.name from hard error to fixable so file
    // imports can still proceed (admin fills name afterward). Without this,
    // the Approve button is permanently disabled when the LLM omits names.
    if (action.type === 'create_sessions') {
      for (const [idx, sessionData] of (action.create_data || []).entries()) {
        if (!sessionData.name) {
          const warnMsg = `Session ${idx + 1}: "name" is recommended — admin should set it`;
          warnings.push(warnMsg);
          fixableErrors.push({
            actionIndex: actionIndex - 1,
            segmentIndex: idx,
            field: 'name',
            message: warnMsg
          });
        }
        if (!sessionData.date) {
          // Downgraded: PDF docs often omit exact dates; admin will fix
          warnings.push(`Session ${idx + 1}: "date" not specified — admin should set it`);
        }
        if (!sessionData.planned_start_time) {
          warnings.push(`Session ${idx + 1}: "planned_start_time" not specified`);
        }
      }
    }

    // Validate create_segments
    if (action.type === 'create_segments') {
      for (const [idx, segmentData] of (action.create_data || []).entries()) {
        if (!segmentData.title) {
          // Downgraded: title can be set by admin later
          warnings.push(`Segment ${idx + 1}: "title" not specified — admin should set it`);
        }

        // Validate segment_type enum — downgrade to warning if unrecognized
        // (PDF parsing may produce unexpected labels; admin can fix)
        if (segmentData.segment_type && !VALID_SEGMENT_TYPES.includes(segmentData.segment_type)) {
          warnings.push(`Segment ${idx + 1}: Unrecognized segment_type "${segmentData.segment_type}" — will default to "Especial"`);
        }

        // Check type-specific required fields — track as fixable
        // PDF-ingested segments often lack type-specific detail fields; treat as warnings,
        // not hard errors, so admins can review and fill them in later.
        if (segmentData.segment_type && SEGMENT_TYPE_REQUIRED_FIELDS[segmentData.segment_type]) {
          const required = SEGMENT_TYPE_REQUIRED_FIELDS[segmentData.segment_type];
          for (const field of required) {
            if (!segmentData[field]) {
              const warnMsg = `Segment ${idx + 1} (${segmentData.segment_type}): "${field}" is recommended for this segment type`;
              warnings.push(warnMsg);
              fixableErrors.push({
                actionIndex,
                segmentIndex: idx,
                field,
                message: warnMsg
              });
            }
          }
        }

        // Validate translation fields
        if (segmentData.requires_translation && segmentData.translation_mode) {
          if (!VALID_TRANSLATION_MODES.includes(segmentData.translation_mode)) {
            errors.push(`Segment ${idx + 1}: Invalid translation_mode "${segmentData.translation_mode}". Must be: ${VALID_TRANSLATION_MODES.join(", ")}`);
          }
        }

        // Warn if translation_mode set but requires_translation is false
        if (segmentData.translation_mode && !segmentData.requires_translation) {
          warnings.push(`Segment ${idx + 1}: translation_mode set but requires_translation is false`);
        }

        // Warn if translator_name set but translation not enabled
        if (segmentData.translator_name && !segmentData.requires_translation) {
          warnings.push(`Segment ${idx + 1}: translator_name set but requires_translation is false`);
        }
      }
    }

    // Validate update_segments
    if (action.type === 'update_segments') {
      if (action.changes) {
        if (action.changes.segment_type && !VALID_SEGMENT_TYPES.includes(action.changes.segment_type)) {
          errors.push(`Action ${actionIndex}: Invalid segment_type "${action.changes.segment_type}"`);
        }

        if (action.changes.translation_mode && !VALID_TRANSLATION_MODES.includes(action.changes.translation_mode)) {
          errors.push(`Action ${actionIndex}: Invalid translation_mode "${action.changes.translation_mode}"`);
        }

        if (action.changes.color_code && !VALID_COLOR_CODES.includes(action.changes.color_code)) {
          errors.push(`Action ${actionIndex}: Invalid color_code "${action.changes.color_code}"`);
        }
      }
    }

    // Validate update_sessions
    if (action.type === 'update_sessions') {
      if (action.changes) {
        if (action.changes.status && !VALID_SESSION_STATUSES.includes(action.changes.status)) {
          errors.push(`Action ${actionIndex}: Invalid session status "${action.changes.status}"`);
        }

        if (action.changes.session_color && !VALID_SESSION_COLORS.includes(action.changes.session_color)) {
          errors.push(`Action ${actionIndex}: Invalid session_color "${action.changes.session_color}"`);
        }
      }
    }

    // Validate update_event
    if (action.type === 'update_event') {
      if (action.changes) {
        if (action.changes.status && !VALID_EVENT_STATUSES.includes(action.changes.status)) {
          errors.push(`Action ${actionIndex}: Invalid event status "${action.changes.status}"`);
        }

        if (action.changes.print_color && !VALID_PRINT_COLORS.includes(action.changes.print_color)) {
          errors.push(`Action ${actionIndex}: Invalid print_color "${action.changes.print_color}"`);
        }
      }
    }

    // Warn if empty changes on update
    if ((action.type === 'update_sessions' || action.type === 'update_segments') && (!action.changes || Object.keys(action.changes).length === 0)) {
      warnings.push(`Action ${actionIndex}: Update action has no changes specified`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fixableErrors // Errors user can fix inline
  };
}

/**
 * Format validation results for display
 */
export function formatValidationForDisplay(validation) {
  return {
    hasErrors: validation.errors.length > 0,
    hasWarnings: validation.warnings.length > 0,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    messages: [
      ...validation.errors.map(e => ({ type: 'error', text: e })),
      ...validation.warnings.map(w => ({ type: 'warning', text: w }))
    ]
  };
}