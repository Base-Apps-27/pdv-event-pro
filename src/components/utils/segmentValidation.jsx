// Validation utility for AI-proposed segment/session changes
// Ensures type safety, enum validity, and required fields before execution

const VALID_SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video", "Anuncio",
  "Dinámica", "Break", "TechOnly", "Oración", "Especial", "Cierre",
  "MC", "Ministración", "Receso", "Almuerzo", "Artes", "Breakout"
];

const VALID_TRANSLATION_MODES = ["InPerson", "RemoteBooth"];

const VALID_SESSION_STATUSES = ["planning", "confirmed", "in_progress", "completed", "archived"];

const SEGMENT_TYPE_REQUIRED_FIELDS = {
  Plenaria: ["message_title"],
  Alabanza: ["number_of_songs"],
  Video: ["video_name", "video_location"],
  Anuncio: ["announcement_title"],
  Artes: ["art_types"],
  Breakout: ["breakout_rooms"]
};

// Map segment types to their missing fields for inline form display
const FIELD_LABELS = {
  message_title: "Mensaje Título / Message Title",
  number_of_songs: "Número de Canciones / Number of Songs",
  video_name: "Nombre del Video / Video Name",
  video_location: "Ubicación del Video / Video Location",
  announcement_title: "Título del Anuncio / Announcement Title",
  art_types: "Tipos de Artes / Art Types",
  breakout_rooms: "Salas de Sesión Paralela / Breakout Rooms"
};

/**
 * Validates AI-proposed actions before execution
 * Returns { isValid: boolean, errors: [], warnings: [] }
 */
export function validateAIActions(actions, context = {}) {
  const errors = [];
  const warnings = [];
  let actionIndex = 0;

  for (const action of actions) {
    actionIndex++;

    // Validate create_sessions
    if (action.type === 'create_sessions') {
      for (const [idx, sessionData] of (action.create_data || []).entries()) {
        if (!sessionData.name) {
          errors.push(`Session ${idx + 1}: "name" is required`);
        }
        if (!sessionData.date) {
          errors.push(`Session ${idx + 1}: "date" is required (format: YYYY-MM-DD)`);
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
          errors.push(`Segment ${idx + 1}: "title" is required`);
        }

        // Validate segment_type enum
        if (segmentData.segment_type && !VALID_SEGMENT_TYPES.includes(segmentData.segment_type)) {
          errors.push(`Segment ${idx + 1}: Invalid segment_type "${segmentData.segment_type}". Must be one of: ${VALID_SEGMENT_TYPES.join(", ")}`);
        }

        // Check type-specific required fields
        if (segmentData.segment_type && SEGMENT_TYPE_REQUIRED_FIELDS[segmentData.segment_type]) {
          const required = SEGMENT_TYPE_REQUIRED_FIELDS[segmentData.segment_type];
          for (const field of required) {
            if (!segmentData[field]) {
              errors.push(`Segment ${idx + 1} (${segmentData.segment_type}): "${field}" is required for this segment type`);
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
      }
    }

    // Validate update_sessions
    if (action.type === 'update_sessions') {
      if (action.changes) {
        if (action.changes.status && !VALID_SESSION_STATUSES.includes(action.changes.status)) {
          errors.push(`Action ${actionIndex}: Invalid session status "${action.changes.status}"`);
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
    warnings
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