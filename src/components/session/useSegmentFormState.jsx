/**
 * useSegmentFormState.js
 * Phase 3B extraction: Form initialization + sync logic from SegmentFormTwoColumn.
 * Contains the massive useState block, the useEffect re-sync on segment change,
 * template application, and the updateField helper.
 * Verbatim extraction — zero logic changes.
 */

import { useState, useEffect } from "react";

/**
 * Build the initial formData object from a segment (or defaults).
 * Used both for initial state and re-sync.
 */
function buildFormData(segment, suggestedStartTime) {
  return {
    title: segment?.title || "",
    segment_type: segment?.segment_type || "Plenaria",
    presenter: segment?.presenter || "",
    description_details: segment?.description_details || "",
    prep_instructions: segment?.prep_instructions || "",
    start_time: segment?.start_time || suggestedStartTime,
    duration_min: segment?.duration_min || 30,
    projection_notes: segment?.projection_notes || "",
    sound_notes: segment?.sound_notes || "",
    ushers_notes: segment?.ushers_notes || "",
    translation_notes: segment?.translation_notes || "",
    stage_decor_notes: segment?.stage_decor_notes || "",
    other_notes: segment?.other_notes || "",
    show_in_general: segment?.show_in_general ?? true,
    show_in_projection: segment?.show_in_projection ?? true,
    show_in_sound: segment?.show_in_sound ?? true,
    show_in_ushers: segment?.show_in_ushers ?? true,
    color_code: segment?.color_code || "default",
    order: segment?.order || 1,
    message_title: segment?.message_title || "",
    scripture_references: segment?.scripture_references || "",
    number_of_songs: segment?.number_of_songs || 3,
    song_1_title: segment?.song_1_title || "",
    song_1_lead: segment?.song_1_lead || "",
    song_2_title: segment?.song_2_title || "",
    song_2_lead: segment?.song_2_lead || "",
    song_3_title: segment?.song_3_title || "",
    song_3_lead: segment?.song_3_lead || "",
    song_4_title: segment?.song_4_title || "",
    song_4_lead: segment?.song_4_lead || "",
    song_5_title: segment?.song_5_title || "",
    song_5_lead: segment?.song_5_lead || "",
    song_6_title: segment?.song_6_title || "",
    song_6_lead: segment?.song_6_lead || "",
    requires_translation: segment?.requires_translation || false,
    translation_mode: segment?.translation_mode || "InPerson",
    translator_name: segment?.translator_name || "",
    panel_moderators: segment?.panel_moderators || "",
    panel_panelists: segment?.panel_panelists || "",
    major_break: segment?.major_break || false,
    room_id: segment?.room_id || "",
    has_video: segment?.has_video || false,
    video_name: segment?.video_name || "",
    video_location: segment?.video_location || "",
    video_owner: segment?.video_owner || "",
    video_length_sec: segment?.video_length_sec || 0,
    art_types: segment?.art_types || [],
    drama_handheld_mics: segment?.drama_handheld_mics || 0,
    drama_headset_mics: segment?.drama_headset_mics || 0,
    drama_start_cue: segment?.drama_start_cue || "",
    drama_end_cue: segment?.drama_end_cue || "",
    drama_has_song: segment?.drama_has_song || false,
    drama_song_title: segment?.drama_song_title || "",
    drama_song_source: segment?.drama_song_source || "",
    drama_song_owner: segment?.drama_song_owner || "",
    dance_has_song: segment?.dance_has_song || false,
    dance_song_title: segment?.dance_song_title || "",
    dance_song_source: segment?.dance_song_source || "",
    dance_song_owner: segment?.dance_song_owner || "",
    dance_handheld_mics: segment?.dance_handheld_mics || 0,
    dance_headset_mics: segment?.dance_headset_mics || 0,
    dance_start_cue: segment?.dance_start_cue || "",
    dance_end_cue: segment?.dance_end_cue || "",
    art_other_description: segment?.art_other_description || "",
    video_url: segment?.video_url || "",
    video_url_meta: segment?.video_url_meta || null,
    drama_song_1_url_meta: segment?.drama_song_1_url_meta || null,
    drama_song_2_title: segment?.drama_song_2_title || "",
    drama_song_2_url: segment?.drama_song_2_url || "",
    drama_song_2_owner: segment?.drama_song_2_owner || "",
    drama_song_2_url_meta: segment?.drama_song_2_url_meta || null,
    drama_song_3_title: segment?.drama_song_3_title || "",
    drama_song_3_url: segment?.drama_song_3_url || "",
    drama_song_3_owner: segment?.drama_song_3_owner || "",
    drama_song_3_url_meta: segment?.drama_song_3_url_meta || null,
    dance_song_1_url_meta: segment?.dance_song_1_url_meta || null,
    dance_song_2_title: segment?.dance_song_2_title || "",
    dance_song_2_url: segment?.dance_song_2_url || "",
    dance_song_2_owner: segment?.dance_song_2_owner || "",
    dance_song_2_url_meta: segment?.dance_song_2_url_meta || null,
    dance_song_3_title: segment?.dance_song_3_title || "",
    dance_song_3_url: segment?.dance_song_3_url || "",
    dance_song_3_owner: segment?.dance_song_3_owner || "",
    dance_song_3_url_meta: segment?.dance_song_3_url_meta || null,
    arts_run_of_show_url: segment?.arts_run_of_show_url || "",
    arts_run_of_show_url_meta: segment?.arts_run_of_show_url_meta || null,
    announcement_title: segment?.announcement_title || "",
    announcement_description: segment?.announcement_description || "",
    announcement_date: segment?.announcement_date || "",
    announcement_tone: segment?.announcement_tone || "",
    announcement_series_id: segment?.announcement_series_id || "",
    segment_actions: segment?.segment_actions || [],
    parsed_verse_data: segment?.parsed_verse_data || null,
  };
}

/**
 * Custom hook: manages formData, fieldOrigins, breakoutRooms, template application,
 * and re-sync when segment changes.
 *
 * @param {object} params
 * @param {object|null} params.segment - Existing segment (null for new)
 * @param {object} params.session - Parent session
 * @param {Array} params.allSegments - All segments in the session (for suggested start time)
 * @param {Array} params.templates - Available segment templates
 * @returns {{ formData, setFormData, updateField, breakoutRooms, setBreakoutRooms, fieldOrigins, setFieldOrigins, selectedTemplate, setSelectedTemplate }}
 */
export default function useSegmentFormState({ segment, session, allSegments, templates }) {
  // Calculate suggested start time for new segments
  const getSuggestedStartTime = () => {
    if (segment) return segment.start_time || "";
    if (!allSegments || allSegments.length === 0) return session?.planned_start_time || "";
    const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    return lastSegment.end_time || lastSegment.start_time || "";
  };

  const [formData, setFormData] = useState(() => buildFormData(segment, getSuggestedStartTime()));
  const [fieldOrigins, setFieldOrigins] = useState(segment?.field_origins || {});
  const [breakoutRooms, setBreakoutRooms] = useState(segment?.breakout_rooms || []);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // CRITICAL: Re-sync formData when parent passes fresh segment after DB refetch
  // Prevents stale display after save-without-close workflow
  // Watch segment.updated_date to detect when React Query refetches fresh data
  useEffect(() => {
    if (segment) {
      setFormData(buildFormData(segment, getSuggestedStartTime()));
      setBreakoutRooms(segment.breakout_rooms || []);
      setFieldOrigins(segment.field_origins || {});
    }
  }, [segment?.id, segment?.updated_date]);

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.default_title || prev.title,
          segment_type: template.segment_type,
          duration_min: template.default_duration_min || prev.duration_min,
          projection_notes: template.default_projection_notes || "",
          sound_notes: template.default_sound_notes || "",
          ushers_notes: template.default_ushers_notes || "",
          color_code: template.default_color_code || "default",
          show_in_general: template.show_in_general ?? true,
          show_in_projection: template.show_in_projection ?? true,
          show_in_sound: template.show_in_sound ?? true,
          show_in_ushers: template.show_in_ushers ?? true,
        }));
        setFieldOrigins(prev => ({
          ...prev,
          title: template.default_title ? 'template' : prev.title,
          segment_type: 'template',
          duration_min: template.default_duration_min ? 'template' : prev.duration_min,
          projection_notes: template.default_projection_notes ? 'template' : 'manual',
          sound_notes: template.default_sound_notes ? 'template' : 'manual',
          ushers_notes: template.default_ushers_notes ? 'template' : 'manual',
          color_code: template.default_color_code ? 'template' : 'manual',
        }));
      }
    }
  }, [selectedTemplate, templates]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  return {
    formData, setFormData,
    updateField,
    breakoutRooms, setBreakoutRooms,
    fieldOrigins, setFieldOrigins,
    selectedTemplate, setSelectedTemplate,
  };
}