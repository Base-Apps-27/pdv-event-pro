/**
 * buildPdfData.js — Converts V2 entity data to legacy PDF format.
 * 
 * The Weekly PDF generators (generateWeeklyProgramPDF, generateAnnouncementsPDF)
 * expect the old JSON-blob shape: serviceData[slotName] = array of segments with
 * {type, title, duration, data: {presenter, ...}, songs: [...], sub_assignments, ...}
 *
 * This utility bridges V2 entity data → legacy PDF shape.
 * DECISION: Converter only, no state mutation. Pure function.
 */

import { normalizeSegmentType } from "@/components/utils/segmentTypeMap";

/**
 * Build the legacy PDF data shape from V2 entity objects.
 *
 * @param {object} params
 * @param {object} existingService - The Service entity (metadata: date, day_of_week, receso_notes, etc.)
 * @param {object[]} sessions - Session entities, sorted by order
 * @param {Object<string, object[]>} segmentsBySession - Segment entities grouped by session ID
 * @param {Object<string, object>} childSegments - Child segments by parent_segment_id
 * @param {Object<string, object>} psdBySession - PreSessionDetails by session ID
 * @returns {object} Legacy serviceData shape for PDF generators
 */
import { getNormalizedSongs } from "@/components/utils/segmentDataUtils";

// 2026-04-16: Added songsBySegment param so PDF can access SegmentSong data
export function buildPdfData({ existingService, sessions, segmentsBySession, childSegments, psdBySession, songsBySegment }) {
  if (!existingService || !sessions || sessions.length === 0) return null;

  const slotNames = sessions.map(s => s.name);
  const result = {
    _slotNames: slotNames,
    date: existingService.date,
    day_of_week: existingService.day_of_week,
    receso_notes: existingService.receso_notes || {},
    print_settings_page1: existingService.print_settings_page1,
    print_settings_page2: existingService.print_settings_page2,
    // Team fields by slot
    coordinators: {},
    ujieres: {},
    sound: {},
    luces: {},
    fotografia: {},
    pre_service_notes: {},
  };

  sessions.forEach(session => {
    const slotName = session.name;

    // Team fields from session entity
    result.coordinators[slotName] = session.coordinators || '';
    result.ujieres[slotName] = session.ushers_team || '';
    result.sound[slotName] = session.sound_team || '';
    result.luces[slotName] = session.lights_team || session.tech_team || '';
    result.fotografia[slotName] = session.photography_team || '';

    // Pre-service notes from PSD entity
    const psd = psdBySession[session.id];
    result.pre_service_notes[slotName] = psd?.general_notes || '';

    // Segments → legacy format
    const segments = segmentsBySession[session.id] || [];
    result[slotName] = segments.map(rawSeg => {
      // 2026-04-16: Attach _songs from songsBySegment map so getNormalizedSongs can find them
      const seg = songsBySegment?.[rawSeg.id]?.length > 0
        ? { ...rawSeg, _songs: songsBySegment[rawSeg.id] }
        : rawSeg;
      const type = normalizeSegmentType(seg.segment_type);
      const children = childSegments?.[seg.id] || [];

      // Build sub_assignments from ui_sub_assignments + children
      const subAssignments = (seg.ui_sub_assignments || []).map(sub => {
        // Try to find the child entity that matches this sub-assignment
        const child = children.find(c =>
          c.title === sub.label || c.segment_type === 'Ministración'
        );
        return {
          ...sub,
          // If there's a matching child entity, use its presenter value
          _childPresenter: child?.presenter || '',
        };
      });

      // Build data object (mimics what the old JSON blob had)
      const data = {};
      if (seg.presenter) data.presenter = seg.presenter;
      if (seg.worship_leader) data.leader = seg.worship_leader;
      if (seg.message_title) data.title = seg.message_title;
      if (seg.scripture_references) data.verse = seg.scripture_references;
      if (seg.translator_name) data.translator = seg.translator_name;
      if (seg.description_details) data.description_details = seg.description_details;
      if (seg.coordinator_notes) data.coordinator_notes = seg.coordinator_notes;
      if (seg.projection_notes) data.projection_notes = seg.projection_notes;
      if (seg.sound_notes) data.sound_notes = seg.sound_notes;
      if (seg.ushers_notes) data.ushers_notes = seg.ushers_notes;
      if (seg.translation_notes) data.translation_notes = seg.translation_notes;
      if (seg.stage_decor_notes) data.stage_decor_notes = seg.stage_decor_notes;
      // 2026-02-28: Added livestream_notes — was missing from PDF data bridge (present on entity)
      if (seg.livestream_notes) data.livestream_notes = seg.livestream_notes;
      if (seg.other_notes) data.other_notes = seg.other_notes;
      if (seg.panel_moderators) data.panel_moderators = seg.panel_moderators;
      if (seg.panel_panelists) data.panel_panelists = seg.panel_panelists;
      if (seg.parsed_verse_data) data.parsed_verse_data = seg.parsed_verse_data;

      // Handle role fields based on type
      if (type === 'worship') {
        data.leader = seg.presenter || seg.worship_leader || '';
      } else if (type === 'message') {
        data.preacher = seg.presenter || '';
        data.messageTitle = seg.message_title || '';
      } else {
        // For all other types, presenter goes to data.presenter
        data.presenter = seg.presenter || '';
      }

      // Sub-assignment person fields → data
      // 2026-02-28: BUGFIX — person_field_name can be "" (empty string), which is falsy.
      // Must check with !== undefined instead of truthiness to allow empty-string keys.
      subAssignments.forEach(sub => {
        if (sub.person_field_name !== undefined && sub.person_field_name !== null && sub._childPresenter) {
          data[sub.person_field_name] = sub._childPresenter;
        }
      });

      // 2026-04-16: Songs — use getNormalizedSongs (SegmentSong entity → flat field fallback)
      const songs = getNormalizedSongs(seg);

      // Actions from segment_actions field or linked SegmentAction entities
      const actions = seg.actions || seg.segment_actions || [];

      return {
        type,
        segment_type: seg.segment_type,
        title: seg.title || '',
        duration: seg.duration_min || 0,
        fields: seg.ui_fields || [],
        data,
        songs: songs.length > 0 ? songs : undefined,
        sub_assignments: subAssignments.length > 0 ? subAssignments : undefined,
        ui_sub_assignments: seg.ui_sub_assignments,
        requires_translation: seg.requires_translation || false,
        translation_mode: seg.translation_mode,
        default_translator_source: seg.default_translator_source || 'manual',
        actions,
        presentation_url: seg.presentation_url,
        notes_url: seg.notes_url,
        content_is_slides_only: seg.content_is_slides_only,
      };
    });
  });

  return result;
}