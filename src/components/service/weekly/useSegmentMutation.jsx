/**
 * useSegmentMutation — Per-field entity write hook for weekly services.
 *
 * Replaces the monolithic 5s-debounce → syncWeeklyToSessions pipeline with
 * individual entity writes. Each field edit debounces (300ms) and writes
 * directly to the appropriate entity (Segment, Session, PreSessionDetails).
 *
 * ARCHITECTURE:
 *   - Optimistic: setServiceData runs immediately (parent still provides instant UI)
 *   - Debounced: entity writes fire 300ms after last keystroke per (entityId+field)
 *   - Atomic: each write is a single entity.update() call, no bulk delete/recreate
 *   - Graceful: if _entityId is missing, the write is silently skipped
 *     (the existing blob save pipeline will create entities via syncWeeklyToSessions
 *     during the additive transition phases 1-3)
 *
 * CONSUMERS:
 *   - WeeklyServiceInputs (SegmentTextInput, SegmentAutocomplete, etc.)
 *   - useWeeklyServiceHandlers (structural operations: add/remove/move/copy)
 *   - ServiceTimeSlotColumn (duration, song add/remove)
 *
 * FIELD MAPPING (UI field name → entity column):
 *   See SEGMENT_FIELD_MAP below for the full mapping.
 */

import { useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// ═══════════════════════════════════════════════════════════════
// FIELD MAPPING: UI data key → Segment entity column
// ═══════════════════════════════════════════════════════════════

/**
 * Maps the `field` parameter from updateSegmentField(service, idx, field, value)
 * to the Segment entity column name. Fields not in this map are assumed to be
 * 1:1 (field name === column name).
 *
 * The UI stores person data under type-specific keys (leader, preacher, presenter)
 * but the entity has a single `presenter` column. The resolvePresenterField()
 * function handles this mapping dynamically based on segment type.
 */
const SEGMENT_FIELD_MAP = {
  // Person fields → single `presenter` column (resolved by segment type)
  leader: "presenter",
  preacher: "presenter",
  presenter: "presenter",

  // Text content fields
  translator: "translator_name",
  verse: "scripture_references",
  messageTitle: "message_title",
  message_title: "message_title",
  title: "message_title", // The "title" FIELD input (not segment.title which is the block name)

  // Notes fields (1:1 mapping)
  coordinator_notes: "coordinator_notes",
  projection_notes: "projection_notes",
  sound_notes: "sound_notes",
  ushers_notes: "ushers_notes",
  translation_notes: "translation_notes",
  stage_decor_notes: "stage_decor_notes",
  description_details: "description_details",
  description: "description_details",

  // Media/content fields
  presentation_url: "presentation_url",
  notes_url: "notes_url",
  content_is_slides_only: "content_is_slides_only",
  parsed_verse_data: "parsed_verse_data",
  submitted_content: "submitted_content",
};

/**
 * Team field mapping: UI team key → Session entity column.
 * The UI stores team data as serviceData[teamField][slotName] = value.
 * The Session entity stores it as session[sessionColumn] = value.
 */
const TEAM_FIELD_MAP = {
  coordinators: "coordinators",
  ujieres: "ushers_team",
  sound: "sound_team",
  luces: "tech_team",
  fotografia: "photography_team",
};

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useSegmentMutation() {
  // Map of pending writes: key = "entityId:fieldName" → { timerId, writeFn }
  // Stores both the timer ID (for cancellation) and the write function
  // (so flushPending can execute them immediately instead of dropping them).
  const timersRef = useRef({});

  /**
   * Execute all pending debounced writes immediately (fire-and-forget).
   * Called on unmount, beforeunload, and navigation to prevent data loss.
   */
  const flushPendingRef = useRef(null);
  flushPendingRef.current = () => {
    const entries = timersRef.current;
    const keys = Object.keys(entries);
    if (keys.length === 0) return;

    keys.forEach((key) => {
      const entry = entries[key];
      if (entry?.timerId) clearTimeout(entry.timerId);
      if (entry?.writeFn) {
        try { entry.writeFn(); } catch (err) {
          console.error(`[useSegmentMutation] Flush write failed for ${key}:`, err.message);
        }
      }
    });
    timersRef.current = {};
  };

  // Flush pending writes on unmount + beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (flushPendingRef.current) flushPendingRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // On React unmount: flush all pending writes so they aren't lost
      if (flushPendingRef.current) flushPendingRef.current();
    };
  }, []);

  /**
   * Internal: schedule a debounced write. Deduplicates by key.
   * If the same key is called again within 300ms, the previous timer is cancelled.
   * Stores the writeFn so flushPending can execute it if the component unmounts
   * before the timer fires.
   */
  const scheduleWrite = useCallback((key, writeFn) => {
    const existing = timersRef.current[key];
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }
    const timerId = setTimeout(async () => {
      delete timersRef.current[key];
      try {
        await writeFn();
      } catch (err) {
        console.error(`[useSegmentMutation] Write failed for ${key}:`, err.message);
      }
    }, 300);
    timersRef.current[key] = { timerId, writeFn };
  }, []);

  // ── Segment field mutation ──────────────────────────────────

  /**
   * Write a single field to a Segment entity.
   *
   * @param {string} entityId - The Segment entity ID (_entityId from serviceData)
   * @param {string} field - The UI field name (e.g., "leader", "verse", "coordinator_notes")
   * @param {*} value - The new value
   */
  const mutateSegmentField = useCallback((entityId, field, value) => {
    if (!entityId) {
      console.warn(`[useSegmentMutation] mutateSegmentField skipped: no entityId for field "${field}"`);
      return;
    }

    const column = SEGMENT_FIELD_MAP[field] || field;
    const key = `seg:${entityId}:${column}`;

    scheduleWrite(key, () =>
      base44.entities.Segment.update(entityId, { [column]: value })
    );
  }, [scheduleWrite]);

  // ── Songs mutation ──────────────────────────────────────────

  /**
   * Write the full songs array to a Segment entity.
   * Flattens the array into song_N_title/lead/key fields.
   *
   * @param {string} entityId - The Segment entity ID
   * @param {Array} songs - Array of { title, lead, key }
   */
  const mutateSongs = useCallback((entityId, songs) => {
    if (!entityId) { console.warn('[useSegmentMutation] mutateSongs skipped: no entityId'); return; }

    const key = `seg:${entityId}:songs`;

    scheduleWrite(key, () => {
      const payload = {};
      const safeArray = Array.isArray(songs) ? songs : [];

      // Write up to 6 song slots
      for (let i = 0; i < 6; i++) {
        const song = safeArray[i];
        payload[`song_${i + 1}_title`] = song?.title || "";
        payload[`song_${i + 1}_lead`] = song?.lead || "";
        payload[`song_${i + 1}_key`] = song?.key || "";
      }

      // Preserve song slot count for UI round-trip
      payload.number_of_songs = safeArray.length;

      return base44.entities.Segment.update(entityId, payload);
    });
  }, [scheduleWrite]);

  // ── Duration mutation ───────────────────────────────────────

  /**
   * Write duration to a Segment entity.
   *
   * @param {string} entityId - The Segment entity ID
   * @param {number} durationMin - The new duration in minutes
   */
  const mutateDuration = useCallback((entityId, durationMin) => {
    if (!entityId) { console.warn('[useSegmentMutation] mutateDuration skipped: no entityId'); return; }

    const key = `seg:${entityId}:duration`;

    scheduleWrite(key, () =>
      base44.entities.Segment.update(entityId, { duration_min: durationMin })
    );
  }, [scheduleWrite]);

  // ── Team field mutation ─────────────────────────────────────

  /**
   * Write a team field to a Session entity.
   *
   * @param {string} sessionId - The Session entity ID (_sessionIds[slotName])
   * @param {string} field - The UI team field name (coordinators, ujieres, sound, luces, fotografia)
   * @param {string} value - The new value
   */
  const mutateTeam = useCallback((sessionId, field, value) => {
    if (!sessionId) { console.warn(`[useSegmentMutation] mutateTeam skipped: no sessionId for field "${field}"`); return; }

    const column = TEAM_FIELD_MAP[field] || field;
    const key = `sess:${sessionId}:${column}`;

    scheduleWrite(key, () =>
      base44.entities.Session.update(sessionId, { [column]: value })
    );
  }, [scheduleWrite]);

  // ── Pre-service notes mutation ──────────────────────────────

  /**
   * Write pre-service notes to a PreSessionDetails entity.
   * Creates the entity if it doesn't exist.
   *
   * @param {string} sessionId - The Session entity ID
   * @param {string} value - The new general_notes value
   */
  const mutatePreServiceNotes = useCallback((sessionId, value) => {
    if (!sessionId) { console.warn('[useSegmentMutation] mutatePreServiceNotes skipped: no sessionId'); return; }

    const key = `psd:${sessionId}:general_notes`;

    scheduleWrite(key, async () => {
      const existing = await base44.entities.PreSessionDetails.filter({
        session_id: sessionId,
      });
      if (existing.length > 0) {
        await base44.entities.PreSessionDetails.update(existing[0].id, {
          general_notes: value,
        });
      } else if (value) {
        await base44.entities.PreSessionDetails.create({
          session_id: sessionId,
          general_notes: value,
        });
      }
    });
  }, [scheduleWrite]);

  // ── Receso notes mutation ───────────────────────────────────

  /**
   * Write receso notes to the Service entity.
   * Receso notes are stored as a JSON object on Service: { slotName: "notes" }
   *
   * @param {string} serviceId - The Service entity ID
   * @param {object} recesoNotes - The full receso_notes object
   */
  const mutateRecesoNotes = useCallback((serviceId, recesoNotes) => {
    if (!serviceId) { console.warn('[useSegmentMutation] mutateRecesoNotes skipped: no serviceId'); return; }

    const key = `svc:${serviceId}:receso_notes`;

    scheduleWrite(key, () =>
      base44.entities.Service.update(serviceId, { receso_notes: recesoNotes })
    );
  }, [scheduleWrite]);

  // ── Sub-assignment person mutation ──────────────────────────

  /**
   * Write a sub-assignment person to a child Segment entity.
   * Sub-assignments (e.g., Ministración) are stored as child Segment entities
   * with parent_segment_id pointing to the parent (e.g., Alabanza).
   *
   * @param {string} parentEntityId - The parent Segment entity ID
   * @param {string} sessionId - The Session entity ID (needed for create)
   * @param {string} serviceId - The Service entity ID (needed for create)
   * @param {number} childIndex - The 0-based index of the sub-assignment
   * @param {object} subConfig - The sub_assignment config { label, person_field_name, duration_min }
   * @param {string} value - The presenter name
   */
  const mutateSubAssignment = useCallback((parentEntityId, sessionId, serviceId, childIndex, subConfig, value) => {
    if (!parentEntityId || !sessionId) {
      console.warn(`[useSegmentMutation] mutateSubAssignment skipped: parentEntityId=${parentEntityId}, sessionId=${sessionId}`);
      return;
    }

    const key = `sub:${parentEntityId}:${childIndex}`;

    scheduleWrite(key, async () => {
      // Find existing child segments for this parent
      const allChildren = await base44.entities.Segment.filter({
        parent_segment_id: parentEntityId,
      });
      const sortedChildren = allChildren.sort((a, b) => (a.order || 0) - (b.order || 0));
      const existingChild = sortedChildren[childIndex];

      if (existingChild) {
        // Update existing child
        await base44.entities.Segment.update(existingChild.id, {
          presenter: value,
        });
      } else if (value) {
        // Create new child segment
        await base44.entities.Segment.create({
          session_id: sessionId,
          service_id: serviceId,
          parent_segment_id: parentEntityId,
          order: childIndex + 1,
          title: subConfig?.label || `Ministración ${childIndex + 1}`,
          segment_type: "Ministración",
          duration_min: subConfig?.duration_min || 5,
          presenter: value,
          show_in_general: false,
        });
      }
    });
  }, [scheduleWrite]);

  // ── Structural operations (non-debounced) ───────────────────

  /**
   * Create a new Segment entity. Used for add-special-segment and copy operations.
   * Returns the created entity (with ID).
   *
   * @param {object} segmentData - Full Segment entity data
   * @returns {Promise<object>} The created entity
   */
  const createSegment = useCallback(async (segmentData) => {
    return base44.entities.Segment.create(segmentData);
  }, []);

  /**
   * Delete a Segment entity. Used for remove-special-segment.
   *
   * @param {string} entityId - The Segment entity ID
   */
  const deleteSegment = useCallback(async (entityId) => {
    if (!entityId) return;
    return base44.entities.Segment.delete(entityId);
  }, []);

  /**
   * Update segment order values. Used for move-up/move-down.
   *
   * @param {string} entityId1 - First segment entity ID
   * @param {number} order1 - New order for first segment
   * @param {string} entityId2 - Second segment entity ID
   * @param {number} order2 - New order for second segment
   */
  const swapSegmentOrder = useCallback(async (entityId1, order1, entityId2, order2) => {
    if (!entityId1 || !entityId2) return;
    await Promise.all([
      base44.entities.Segment.update(entityId1, { order: order1 }),
      base44.entities.Segment.update(entityId2, { order: order2 }),
    ]);
  }, []);

  /**
   * Bulk delete all segments in a session. Used for reset-to-blueprint.
   *
   * @param {string} sessionId - The Session entity ID
   */
  const deleteAllSegmentsInSession = useCallback(async (sessionId) => {
    if (!sessionId) return;
    const segments = await base44.entities.Segment.filter({ session_id: sessionId });
    await Promise.all(segments.map(s => base44.entities.Segment.delete(s.id)));
  }, []);

  /**
   * Update a Session entity (e.g., planned_end_time after duration change).
   *
   * @param {string} sessionId - The Session entity ID
   * @param {object} data - Fields to update
   */
  const updateSession = useCallback(async (sessionId, data) => {
    if (!sessionId) return;
    return base44.entities.Session.update(sessionId, data);
  }, []);

  /**
   * Flush all pending debounced writes immediately (fire-and-forget).
   * Called before page unload or navigation to ensure no writes are lost.
   */
  const flushPending = useCallback(() => {
    if (flushPendingRef.current) flushPendingRef.current();
  }, []);

  return {
    // Per-field debounced writes
    mutateSegmentField,
    mutateSongs,
    mutateDuration,
    mutateTeam,
    mutatePreServiceNotes,
    mutateRecesoNotes,
    mutateSubAssignment,

    // Structural operations (immediate, not debounced)
    createSegment,
    deleteSegment,
    swapSegmentOrder,
    deleteAllSegmentsInSession,
    updateSession,

    // Lifecycle
    flushPending,
  };
}
