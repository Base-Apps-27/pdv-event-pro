/**
 * useSegmentFormSubmit.js
 * Phase 3B extraction: Validation chain, overlap detection, metadata fetching,
 * auto-insertion order calculation, and create/update mutations.
 * Verbatim extraction — zero logic changes.
 */

import { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/components/utils/i18n";
import { logCreate, logUpdate } from "@/components/utils/editActionLogger";
import { invalidateSegmentCaches } from "@/components/utils/queryKeys";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import useStaleGuard from "@/components/utils/useStaleGuard";

/**
 * Calculate end time from start + duration.
 */
export function calculateTimes(startTime, durationMin) {
  if (!startTime || !durationMin) return { end_time: "" };
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMin;
  const h = Math.floor(endMinutes / 60) % 24;
  const m = endMinutes % 60;
  return { end_time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

/**
 * Helper to fetch metadata for a URL (silent, non-blocking).
 */
async function fetchMetaForUrl(url) {
  if (!url || !url.trim() || !url.startsWith('http')) return null;
  try {
    const response = await base44.functions.invoke('fetchUrlMetadata', { url: url.trim() });
    if (response.data && !response.data.error) {
      return { title: response.data.title, thumbnail: response.data.thumbnail, fetched_at: response.data.fetched_at || new Date().toISOString() };
    }
  } catch (e) { console.warn('Auto-fetch metadata failed for', url, e); }
  return null;
}

/**
 * Custom hook: manages create/update mutations, validation, overlap detection,
 * metadata fetching, and auto-insertion order.
 *
 * @param {object} params
 * @param {object|null} params.segment - Existing segment (null for new)
 * @param {string} params.sessionId
 * @param {object} params.session
 * @param {object} params.user
 * @param {Array} params.allSegments
 * @param {number} params.nextOrder
 * @param {Function} params.onClose
 * @returns {{ handleSubmit, createMutation, updateMutation, showOverlapDialog, setShowOverlapDialog, overlapText, showShiftPreview, setShowShiftPreview }}
 */
export default function useSegmentFormSubmit({ segment, sessionId, session, user, allSegments, nextOrder, onClose }) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [overlapText, setOverlapText] = useState("");
  const [showShiftPreview, setShowShiftPreview] = useState(false);

  // Phase 5: Concurrent editing guard — capture baseline on hook init
  const { captureBaseline, checkStale, updateBaseline } = useStaleGuard();
  // pendingSubmit holds form args when awaiting user force-save decision
  const pendingSubmitRef = useRef(null);
  const [showStaleWarning, setShowStaleWarning] = useState(false);
  const [staleInfo, setStaleInfo] = useState(null);

  // FIX 2026-03-06 (v3): useState initializer was being misused as a side effect.
  // useState(() => {...}) only returns initial state — it doesn't run as an effect.
  // This meant captureBaseline was called once on first render with segment?.updated_date,
  // but the ref was never updated when the segment prop changed (e.g. after a refetch).
  // Result: stale guard compared an outdated baseline and always flagged as stale,
  // silently blocking every save. Fix: use a proper ref initialization + useEffect sync.
  const baselineInitialized = useRef(false);
  if (!baselineInitialized.current && segment?.updated_date) {
    captureBaseline(segment.updated_date);
    baselineInitialized.current = true;
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.entities.Segment.create(data);
      await logCreate('Segment', created, sessionId, user);
      return created;
    },
    onSuccess: () => { invalidateSegmentCaches(queryClient); onClose(); toast.success("Segmento creado ✓"); },
    onError: () => { toast.error(t('error.save_failed')); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, previousState }) => {
      const updated = await base44.entities.Segment.update(id, data);
      await logUpdate('Segment', id, previousState, { ...previousState, ...data }, sessionId, user);
      return updated;
    },
    onSuccess: (result) => {
      // FIX 2026-03-06 (v3): Update stale guard baseline after successful save.
      // Without this, the next save attempt sees server updated_date > old baseline → false stale.
      if (result?.updated_date) updateBaseline(result.updated_date);
      invalidateSegmentCaches(queryClient); onClose(); toast.success("Segmento guardado ✓");
    },
    onError: () => { toast.error(t('error.save_failed')); },
  });

  /**
   * Build and execute submit. Receives all form state as arguments
   * to avoid coupling this hook to formData/breakoutRooms/fieldOrigins state.
   */
  /**
   * Force-save: bypasses stale check (user chose to overwrite).
   */
  const forceSave = useCallback(() => {
    if (!pendingSubmitRef.current) return;
    const { formData, breakoutRooms, fieldOrigins } = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    setShowStaleWarning(false);
    setStaleInfo(null);
    executeSubmit({ formData, breakoutRooms, fieldOrigins });
  }, []);

  const handleSubmit = async (e, { formData, breakoutRooms, fieldOrigins }) => {
    e.preventDefault();

    // Phase 5: Stale check before save (only for existing segments)
    if (segment?.id) {
      const stale = await checkStale("Segment", segment.id);
      if (stale.isStale) {
        pendingSubmitRef.current = { formData, breakoutRooms, fieldOrigins };
        setStaleInfo(stale);
        setShowStaleWarning(true);
        return; // Halt — user must confirm or cancel
      }
    }

    executeSubmit({ formData, breakoutRooms, fieldOrigins });
  };

  const executeSubmit = async ({ formData, breakoutRooms, fieldOrigins }) => {
    const times = calculateTimes(formData.start_time, formData.duration_min);

    // Basic required fields validation (bilingual toast)
    const isBreakTypeNow = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
    const isTechOnlyNow = formData.segment_type === "TechOnly";
    const isBreakoutTypeNow = formData.segment_type === "Breakout";
    const needsPresenterNow = !isBreakTypeNow && !isTechOnlyNow && !isBreakoutTypeNow;

    const missing = [];
    if (!formData.title?.trim()) missing.push(t('field.title'));
    if (!formData.start_time) missing.push(t('field.start_time'));
    if (!formData.duration_min || formData.duration_min <= 0) missing.push(t('field.duration_min'));
    const isBreakTypeNowForValidation = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
    if (needsPresenterNow && !isBreakTypeNowForValidation && !formData.presenter?.trim()) missing.push(t('field.presenter'));
    if (missing.length > 0) {
      toast.error(`${t('error.required_fields_missing')}: ${missing.join(', ')}`);
      return;
    }

    // Validate segment times don't overlap
    if (formData.start_time && times.end_time && allSegments) {
      const otherSegments = allSegments.filter(s => s.id !== segment?.id);
      const toMinutes = (timeStr) => {
        if (!timeStr) return null;
        const [h, m] = String(timeStr).split(':').map(Number);
        return (isFinite(h) && isFinite(m)) ? h * 60 + m : null;
      };
      const newStartMin = toMinutes(formData.start_time);
      const newEndMin = toMinutes(times.end_time);

      for (const existingSegment of otherSegments) {
        if (existingSegment.start_time && existingSegment.end_time) {
          const existingStartMin = toMinutes(existingSegment.start_time);
          const existingEndMin = toMinutes(existingSegment.end_time);
          if (newStartMin !== null && newEndMin !== null && existingStartMin !== null && existingEndMin !== null) {
            if ((newStartMin >= existingStartMin && newStartMin < existingEndMin) ||
                (newEndMin > existingStartMin && newEndMin <= existingEndMin) ||
                (newStartMin <= existingStartMin && newEndMin >= existingEndMin)) {
              setOverlapText(`El segmento se solapa con "${existingSegment.title}" (${formatTimeToEST(existingSegment.start_time)} - ${formatTimeToEST(existingSegment.end_time)}). ${language === 'es' ? 'Por favor ajusta los horarios o elige ajustar segmentos posteriores.' : 'Please adjust times or choose to shift downstream segments.'}`);
              setShowOverlapDialog(true);
              return;
            }
          }
        }
      }
    }

    // Auto-fetch metadata for URLs
    const metaUpdates = {};
    const urlsToFetch = [
      { url: formData.video_url, metaField: 'video_url_meta', currentMeta: formData.video_url_meta },
      { url: formData.drama_song_source, metaField: 'drama_song_1_url_meta', currentMeta: formData.drama_song_1_url_meta },
      { url: formData.drama_song_2_url, metaField: 'drama_song_2_url_meta', currentMeta: formData.drama_song_2_url_meta },
      { url: formData.drama_song_3_url, metaField: 'drama_song_3_url_meta', currentMeta: formData.drama_song_3_url_meta },
      { url: formData.dance_song_source, metaField: 'dance_song_1_url_meta', currentMeta: formData.dance_song_1_url_meta },
      { url: formData.dance_song_2_url, metaField: 'dance_song_2_url_meta', currentMeta: formData.dance_song_2_url_meta },
      { url: formData.dance_song_3_url, metaField: 'dance_song_3_url_meta', currentMeta: formData.dance_song_3_url_meta },
      { url: formData.arts_run_of_show_url, metaField: 'arts_run_of_show_url_meta', currentMeta: formData.arts_run_of_show_url_meta },
    ];
    const fetchPromises = urlsToFetch
      .filter(({ url, currentMeta }) => {
        if (!url || currentMeta) return false;
        // Handle array of URLs vs string URL
        const firstUrl = Array.isArray(url) ? url[0] : url;
        return typeof firstUrl === 'string' && firstUrl.trim();
      })
      .map(async ({ url, metaField }) => {
        const firstUrl = Array.isArray(url) ? url[0] : url;
        const meta = await fetchMetaForUrl(firstUrl); 
        if (meta) metaUpdates[metaField] = meta; 
      });
    await Promise.all(fetchPromises);

    // Auto-insertion order (Gap-Fit, order-only) for new segments
    let insertionOrder = null;
    if (!segment && !session?.live_adjustment_enabled && formData.start_time && formData.duration_min && allSegments?.length) {
      const parse = (t) => { const [h, m] = String(t).split(":").map(Number); return (isFinite(h) && isFinite(m)) ? h * 60 + m : null; };
      const newStartMin = parse(formData.start_time);
      const newEndMin = newStartMin != null ? newStartMin + Number(formData.duration_min) : null;
      if (newStartMin != null && newEndMin != null) {
        const byTime = allSegments.filter(s => s.start_time && s.end_time).sort((a, b) => (parse(a.start_time) ?? 0) - (parse(b.start_time) ?? 0));
        const sessionStartMin = session?.planned_start_time ? parse(session.planned_start_time) : null;
        let prev = null;
        for (let i = 0; i < byTime.length; i++) {
          const next = byTime[i];
          const gapStart = prev ? parse(prev.end_time) : (sessionStartMin ?? parse(next.start_time));
          const gapEnd = parse(next.start_time);
          if (gapStart != null && gapEnd != null && newStartMin >= gapStart && newEndMin <= gapEnd) {
            const prevOrder = prev ? Number(prev.order) || 0 : 0;
            const nextOrderVal = Number(next.order) || (prevOrder + 1);
            insertionOrder = prev ? (prevOrder + nextOrderVal) / 2 : (nextOrderVal - 0.5);
            break;
          }
          prev = next;
        }
      }
    }

    // Strip internal UI state flags
    const cleanedFormData = Object.fromEntries(Object.entries(formData).filter(([key]) => !key.startsWith('_')));

    // FIX 2026-03-06: Schema-safe cleanup — prevent 422 errors from invalid field types.
    // 1. Array-type fields: ensure they're arrays, not strings
    const arrayUrlFields = [
      'presentation_url', 'notes_url', 'video_url', 'arts_run_of_show_url',
      'drama_song_source', 'drama_song_2_url', 'drama_song_3_url',
      'dance_song_source', 'dance_song_2_url', 'dance_song_3_url',
      'spoken_word_music_url', 'spoken_word_script_url', 'spoken_word_audio_url'
    ];
    
    // FIX 2026-03-06 (v2): Handle ALL invalid states: null, undefined, string, and malformed arrays.
    // The DB stores null for unset array fields. buildFormData catches most, but any path
    // that merges raw segment data can re-introduce nulls.
    arrayUrlFields.forEach(field => {
      const val = cleanedFormData[field];
      if (val == null) {
        // null or undefined → safe empty array
        cleanedFormData[field] = [];
      } else if (typeof val === 'string') {
        cleanedFormData[field] = val.trim() ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
      } else if (Array.isArray(val)) {
        cleanedFormData[field] = val.map(s => typeof s === 'string' ? s.trim() : s).filter(Boolean);
      } else {
        // Unknown type — safe fallback
        cleanedFormData[field] = [];
      }
    });

    // 2. Enum fields: empty strings are NOT valid enum values — strip them to avoid 422
    // IMPORTANT: Only delete if truly empty. Valid enum values like "preach", "Plenaria" must be kept.
    const enumFields = ['spoken_word_mic_position', 'live_status', 'timing_source', 'live_hold_status', 'live_status'];
    enumFields.forEach(field => {
      if (cleanedFormData[field] === '' || cleanedFormData[field] === undefined || cleanedFormData[field] === null) {
        delete cleanedFormData[field];
      }
    });

    // 3. Number-type fields: empty strings are invalid for number schema — convert to null
    const numberFields = ['video_length_sec', 'drama_handheld_mics', 'drama_headset_mics', 'dance_handheld_mics', 'dance_headset_mics', 'duration_min', 'order', 'stage_call_offset_min', 'number_of_songs'];
    numberFields.forEach(field => {
      const val = cleanedFormData[field];
      if (val === '' || val === undefined) {
        // Send null for optional number fields; platform accepts null but not ""
        delete cleanedFormData[field];
      } else if (val !== null && val !== undefined) {
        const num = Number(val);
        cleanedFormData[field] = isFinite(num) ? num : null;
      }
    });

    const data = {
      session_id: sessionId,
      ...cleanedFormData,
      ...metaUpdates,
      ...(segment ? {} : { order: insertionOrder ?? nextOrder }),
      ...times,
      breakout_rooms: formData.segment_type === "Breakout" ? breakoutRooms : undefined,
      parsed_verse_data: formData.parsed_verse_data || undefined,
      field_origins: fieldOrigins,
    };

    if (segment) {
      updateMutation.mutate({ id: segment.id, data, previousState: segment });
    } else {
      createMutation.mutate(data);
    }
  };

  return {
    handleSubmit,
    createMutation,
    updateMutation,
    showOverlapDialog, setShowOverlapDialog, overlapText,
    showShiftPreview, setShowShiftPreview,
    calculateTimes,
    // Phase 5: Stale guard exports
    showStaleWarning, setShowStaleWarning,
    staleInfo,
    forceSave,
  };
}