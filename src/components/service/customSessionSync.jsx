/**
 * customSessionSync.js
 * Entity Lift L1.1: Reverse-transform for Custom Services.
 *
 * Loads Session + Segment entities and converts them back into the
 * CustomServiceBuilder JSON editing shape. This is the custom-service
 * equivalent of weeklySessionSync.loadWeeklyFromSessions().
 *
 * ARCHITECTURE:
 *   - READ-ONLY transform. Never writes to database.
 *   - Returns null if no session exists (signals JSON fallback).
 *   - Produces the exact same shape as normalizeServiceTeams(existingService).
 *
 * FIELD MAPPING (Entity → JSON):
 *   segment_type   → type
 *   duration_min   → duration
 *   presenter      → presenter (root + data)
 *   translator_name→ translator (root + data)
 *   message_title  → messageTitle (root + data)
 *   scripture_references → verse (root + data)
 *   song_N_title   → songs[] array
 *   segment_actions→ actions[] array
 *   parent/child   → sub_asignaciones[] array
 *
 * CONSUMERS:
 *   - CustomServiceBuilder (useEffect on existingService load)
 *   - WeekdayServicePanel (already handled by L1.4 JSON fallback)
 */

import { getNormalizedSongs } from '@/components/utils/segmentDataUtils';

/**
 * Load a custom service's program from Session/Segment entities.
 *
 * @param {object} base44 - The base44 SDK client instance
 * @param {string} serviceId - The Service entity ID
 * @returns {object|null} - The segments array in CustomServiceBuilder JSON shape,
 *                          or null if no session entities exist.
 */
export async function loadCustomFromSession(base44, serviceId) {
  if (!serviceId) return null;

  const sessions = await base44.entities.Session.filter({ service_id: serviceId });
  if (!sessions || sessions.length === 0) return null;

  // Custom services have a single session (unlike weekly which has one per time slot).
  // If multiple exist, take the most recently updated one.
  const session = sessions.sort((a, b) =>
    new Date(b.updated_date || 0) - new Date(a.updated_date || 0)
  )[0];

  // Fetch all segments for this session
  const allSegments = await base44.entities.Segment.filter({ session_id: session.id });

  // Separate parent segments from child segments (Ministración sub-assignments)
  const parentSegments = allSegments
    .filter(s => !s.parent_segment_id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const childSegments = allSegments.filter(s => s.parent_segment_id);

  // Transform each parent segment into the CustomServiceBuilder JSON shape
  const segments = parentSegments.map(seg => {
    const songs = getNormalizedSongs(seg);
    const segType = seg.segment_type || 'Especial';

    // Build the dual-write data object (CustomServiceBuilder reads from both root AND data)
    const data = {
      presenter: seg.presenter || '',
      leader: seg.presenter || '', // Worship segments use "leader" as the presenter alias
      preacher: seg.presenter || '', // Message segments use "preacher"
      translator: seg.translator_name || '',
      messageTitle: seg.message_title || '',
      message_title: seg.message_title || '',
      verse: seg.scripture_references || '',
      scripture_references: seg.scripture_references || '',
      parsed_verse_data: seg.parsed_verse_data || null,
      submitted_content: seg.submitted_content || '',
      description: seg.description_details || '',
      description_details: seg.description_details || '',
      coordinator_notes: seg.coordinator_notes || '',
      projection_notes: seg.projection_notes || '',
      sound_notes: seg.sound_notes || '',
      ushers_notes: seg.ushers_notes || '',
      translation_notes: seg.translation_notes || '',
      stage_decor_notes: seg.stage_decor_notes || '',
      presentation_url: seg.presentation_url || '',
      notes_url: seg.notes_url || '',
      content_is_slides_only: !!seg.content_is_slides_only,
      actions: seg.segment_actions || [],
    };

    // Include songs in data for PDF/entity compatibility
    if (songs.length > 0) {
      data.songs = songs;
    }

    // Build sub_asignaciones from child Ministración segments
    const children = childSegments
      .filter(c => c.parent_segment_id === seg.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const sub_asignaciones = children.length > 0
      ? children.map(child => ({
          _uiId: child.id, // Use entity ID as stable UI identifier
          _entityId: child.id, // Store explicit entity ID for sync matching
          title: child.title || '',
          presenter: child.presenter || '',
          duration: child.duration_min || 5,
        }))
      : undefined;

    // Generate a stable _uiId from the entity ID
    const _uiId = seg.id;

    return {
      // ─── Identity ───
      _uiId,
      _entityId: seg.id,
      _sessionId: seg.session_id,
      title: seg.title || '',
      type: segType,
      duration: seg.duration_min || 0,

      // ─── Root-level people fields (CustomServiceBuilder reads these directly) ───
      presenter: seg.presenter || '',
      leader: seg.presenter || '',
      preacher: seg.presenter || '',
      translator: seg.translator_name || '',
      messageTitle: seg.message_title || '',
      verse: seg.scripture_references || '',

      // ─── Root-level content fields ───
      presentation_url: seg.presentation_url || '',
      content_is_slides_only: !!seg.content_is_slides_only,
      parsed_verse_data: seg.parsed_verse_data || null,
      description: seg.description_details || '',
      description_details: seg.description_details || '',
      coordinator_notes: seg.coordinator_notes || '',
      projection_notes: seg.projection_notes || '',
      sound_notes: seg.sound_notes || '',
      ushers_notes: seg.ushers_notes || '',
      translation_notes: seg.translation_notes || '',
      stage_decor_notes: seg.stage_decor_notes || '',

      // ─── Songs (root-level array for SegmentTimelineCard) ───
      songs: songs.length > 0 ? songs : undefined,

      // ─── Sub-assignments ───
      sub_asignaciones,

      // ─── Actions ───
      actions: seg.segment_actions || [],

      // ─── Dual-write data object ───
      data,
    };
  });

  return {
    segments,
    sessionId: session.id,
    sessionUpdatedDate: session.updated_date,
  };
}