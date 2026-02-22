/**
 * useWeeklyServiceHandlers.js
 * All handler functions for WeeklyServiceManager.
 *
 * PER-FIELD PUSH (2026-02-21): Handlers update local state AND push the
 * changed field directly to the entity. This replaces the monolithic
 * blur-triggered full sync that was causing data loss when admins typed
 * faster than the sync could complete. The full syncWeeklyToSessions
 * is retained only as a 30-second safety net for structural changes.
 *
 * Each handler receives a pushFn callback through its options. After
 * updating serviceData, it fires pushFn with the entity push details.
 * pushFn is fire-and-forget (non-blocking) — the UI never waits for it.
 */

import { useCallback, useRef, useEffect } from "react";
import { addMinutes, format as formatDate } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { generateWeeklyProgramPDF } from "@/components/service/generateWeeklyProgramPDF";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";
import { safeParseTimeSlot } from "@/components/service/pdfUtils";

export function useWeeklyServiceHandlers({
  serviceData,
  setServiceData,
  selectedAnnouncements,
  updateAnnouncementMutation,
  fixedAnnouncements,
  dynamicAnnouncements,
  blueprintData,
  // Setters for state owned by parent
  setVerseParserOpen,
  setVerseParserContext,
  verseParserContext,
  setShowSpecialDialog,
  setSpecialSegmentDetails,
  specialSegmentDetails,
  setOptimizingAnnouncement,
  setPrintSettingsPage1,
  setPrintSettingsPage2,
  setEditingAnnouncement,
  setAnnouncementForm,
  setShowAnnouncementDialog,
  setShowResetConfirm,
  editingAnnouncement,
  createAnnouncementMutation,
  // Phase 2: dynamic slot names from ServiceSchedule
  slotNames = ["9:30am", "11:30am"],
  // Per-field push: fire-and-forget entity push callback
  // Signature: pushFn(type, { entityId, sessionId, field, value, songs })
  pushFn,
  // IMMEDIATE-SYNC (2026-02-21): Callback to request a fast full sync after
  // structural changes (reset, add/remove segment) that create segments
  // without entity IDs, making per-field push inoperative.
  requestImmediateSync,
}) {
  // Phase 2: derive first slot for blueprint fallback reference
  const firstSlot = slotNames[0];

  // Update handlers: state mutation + per-field entity push
  const updateSegmentField = (service, segmentIndex, field, value) => {
    // Read entity ID before setState (stable across renders, set during init)
    const entityId = serviceData?.[service]?.[segmentIndex]?._entityId;

    setServiceData(prev => {
      // Deep clone the service array we are modifying to ensure immutability
      const newServiceArray = [...(prev[service] || [])];

      // Clone the specific segment we are updating
      if (!newServiceArray[segmentIndex]) return prev;
      const newSegment = { ...newServiceArray[segmentIndex] };

      // Define fields that sit at the root of the segment object
      const rootFields = ['songs', 'presentation_url', 'notes_url', 'content_is_slides_only'];

      if (rootFields.includes(field)) {
        newSegment[field] = value;
      } else {
        newSegment.data = {
          ...newSegment.data,
          [field]: value
        };
      }

      // Place the updated segment back into the new array
      newServiceArray[segmentIndex] = newSegment;

      const updated = {
        ...prev,
        [service]: newServiceArray
      };

      // Auto-propagate translator from worship to other segments in the SAME slot
      // that have default_translator_source='worship_segment_translator'.
      if (field === 'translator' && newSegment.type === 'worship') {
        const worshipTranslator = value;
        updated[service] = updated[service].map((seg, idx) => {
          if (idx !== segmentIndex && seg.default_translator_source === 'worship_segment_translator' && !seg.data?.translator) {
            return {
              ...seg,
              data: {
                ...seg.data,
                translator: worshipTranslator
              }
            };
          }
          return seg;
        });
      }

      return updated;
    });

    if (entityId) {
      // Per-field push: fire-and-forget entity update (fast path)
      if (pushFn) pushFn("segment", { entityId, field, value });
    } else {
      // No entity ID yet — segments haven't been created in DB.
      // Request an immediate full sync (2s) so entities get created
      // and subsequent blur pushes will have a valid entityId.
      if (requestImmediateSync) requestImmediateSync();
    }
  };

  const updateTeamField = (field, service, value) => {
    // Read session ID for this slot (from first segment's metadata)
    const sessionId = serviceData?._sessionIds?.[service]
      || serviceData?.[service]?.[0]?._sessionId;

    setServiceData(prev => ({
      ...prev,
      [field]: { ...prev[field], [service]: value }
    }));

    if (sessionId) {
      // Per-field push: fire-and-forget Session entity update
      if (pushFn) pushFn("team", { sessionId, field, value });
    } else {
      // No session yet — trigger immediate sync to create Session entity
      if (requestImmediateSync) requestImmediateSync();
    }
  };

  const handleOpenVerseParser = (timeSlot, segmentIdx) => {
    const currentVerse = serviceData[timeSlot][segmentIdx]?.data?.verse || "";
    const currentParsedData = serviceData[timeSlot][segmentIdx]?.data?.parsed_verse_data;
    
    setVerseParserContext({ 
      timeSlot, 
      segmentIdx,
      initialText: currentVerse,
      initialParsed: currentParsedData
    });
    setVerseParserOpen(true);
  };

  // debouncedSave: no-op retained for backward compatibility.
  // Auto-save in WeeklyServiceManager is the single save path.
  const debouncedSave = useCallback(() => {}, []);

  const handleSaveParsedVerses = (data) => {
    const { timeSlot, segmentIdx } = verseParserContext;

    setServiceData(prev => {
      const updated = { ...prev };
      const currentVerse = updated[timeSlot][segmentIdx].data?.verse || "";
      updated[timeSlot][segmentIdx].data = {
        ...updated[timeSlot][segmentIdx].data,
        verse: currentVerse,
        parsed_verse_data: data.parsed_data
      };
      return updated;
    });

    setVerseParserOpen(false);
    setVerseParserContext({ timeSlot: null, segmentIdx: null });
  };

  // ── CONTENT-ONLY COPY (2026-02-21) ──────────────────────────────────
  // Copy operations transfer ONLY user-entered text content (data, songs)
  // from source segments onto target segments. Structural metadata is
  // preserved on the target: type, title, duration, fields, sub_assignments,
  // actions, _entityId, _sessionId, requires_translation, default_translator_source.
  // This prevents: (a) entity ID leaks causing cross-slot entity writes,
  // (b) blueprint structural metadata being overwritten, (c) slot-specific
  // actions and translation config being lost.

  /** Merge source text content onto an existing target segment. */
  const copyContentToTarget = (sourceSeg, targetSeg) => {
    // Extract source text data — exclude data.actions (structural, not content)
    const { actions: _srcActions, ...sourceTextData } = (sourceSeg.data || {});
    return {
      ...targetSeg,                          // keep ALL target structure + entity IDs
      data: {
        ...targetSeg.data,                   // preserve target data.actions etc.
        ...sourceTextData,                   // overlay source text fields
      },
      songs: sourceSeg.songs
        ? sourceSeg.songs.map(s => ({ ...s }))
        : targetSeg.songs,
    };
  };

  /** Fallback: clone source segment for positions with no target, stripping entity refs. */
  const cloneSegmentWithoutEntityRefs = (seg) => {
    const { _entityId, _sessionId, ...rest } = seg;
    return {
      ...rest,
      data: { ...seg.data },
      actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
      songs: seg.songs ? seg.songs.map(s => ({ ...s })) : undefined,
    };
  };

  // ── N-SLOT COPY OPERATIONS (2026-02-21) ─────────────────────────────
  // All copy functions accept (sourceSlot, targetSlot) so they work for
  // any pair of consecutive slots, not just first→second.

  const copyAllToNextSlot = (sourceSlot, targetSlot) => {
    if (!sourceSlot || !targetSlot) return;
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      const sourceSegments = updated[sourceSlot] || [];
      const targetSegments = updated[targetSlot] || [];

      updated[targetSlot] = sourceSegments.map((sourceSeg, idx) => {
        const targetSeg = targetSegments[idx];
        if (targetSeg) {
          return copyContentToTarget(sourceSeg, targetSeg);
        }
        // No target at this position (e.g. extra special segment) — clone without entity refs
        return cloneSegmentWithoutEntityRefs(sourceSeg);
      });

      if (updated.pre_service_notes) updated.pre_service_notes[targetSlot] = updated.pre_service_notes[sourceSlot] || "";
      if (updated.coordinators) updated.coordinators[targetSlot] = updated.coordinators[sourceSlot] || "";
      if (updated.ujieres) updated.ujieres[targetSlot] = updated.ujieres[sourceSlot] || "";
      if (updated.sound) updated.sound[targetSlot] = updated.sound[sourceSlot] || "";
      if (updated.luces) updated.luces[targetSlot] = updated.luces[sourceSlot] || "";
      if (updated.fotografia) updated.fotografia[targetSlot] = updated.fotografia[sourceSlot] || "";
      return updated;
    });
  };

  const copySegmentToNextSlot = (sourceSlot, targetSlot, segmentIndex) => {
    if (!sourceSlot || !targetSlot) return;
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      const sourceSeg = (updated[sourceSlot] || [])[segmentIndex];
      if (!sourceSeg) return prev;

      if (!updated[targetSlot]) updated[targetSlot] = [];
      updated[targetSlot] = [...updated[targetSlot]];
      const targetSeg = updated[targetSlot][segmentIndex];

      if (targetSeg) {
        updated[targetSlot][segmentIndex] = copyContentToTarget(sourceSeg, targetSeg);
      } else {
        updated[targetSlot][segmentIndex] = cloneSegmentWithoutEntityRefs(sourceSeg);
      }
      return updated;
    });
  };

  const copyPreServiceNotesToNextSlot = (sourceSlot, targetSlot) => {
    if (!sourceSlot || !targetSlot) return;
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.pre_service_notes) updated.pre_service_notes[targetSlot] = updated.pre_service_notes[sourceSlot] || "";
      return updated;
    });
  };

  const copyTeamToNextSlot = (sourceSlot, targetSlot) => {
    if (!sourceSlot || !targetSlot) return;
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.coordinators) updated.coordinators[targetSlot] = updated.coordinators[sourceSlot] || "";
      if (updated.ujieres) updated.ujieres[targetSlot] = updated.ujieres[sourceSlot] || "";
      if (updated.sound) updated.sound[targetSlot] = updated.sound[sourceSlot] || "";
      if (updated.luces) updated.luces[targetSlot] = updated.luces[sourceSlot] || "";
      if (updated.fotografia) updated.fotografia[targetSlot] = updated.fotografia[sourceSlot] || "";
      return updated;
    });
  };

  /**
   * executeResetToBlueprint — RESET-SLOT-FIX (2026-02-20)
   * Now accepts an optional array of slot names to reset.
   * If omitted or empty, resets ALL slots (backward-compatible).
   */
  const executeResetToBlueprint = (slotsToReset) => {
    setShowResetConfirm(false);

    // Blueprint Revamp (2026-02-18): DB blueprint only. No hardcoded fallback.
    const activeBlueprint = blueprintData;
    
    // Helper to get default fields if blueprint is corrupted/missing them
    const getDefaultFields = (type) => {
      const t = type?.toLowerCase() || '';
      if (t === 'worship') return ["leader", "songs", "ministry_leader"];
      if (t === 'welcome') return ["presenter"];
      if (t === 'offering') return ["presenter", "verse"];
      if (t === 'message') return ["preacher", "title", "verse"];
      return [];
    };

    const mapBpSegments = (bpSegments) => (bpSegments || []).map(seg => {
      const fields = seg.fields && seg.fields.length > 0 ? seg.fields : getDefaultFields(seg.type);
      const segmentCopy = {
        type: seg.type,
        title: seg.title,
        duration: seg.duration,
        fields: [...fields],
        data: {},
        actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
        sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
        requires_translation: seg.requires_translation || false,
        default_translator_source: seg.default_translator_source || "manual"
      };
      if (seg.type === "worship") {
        const songCount = seg.number_of_songs || 4;
        segmentCopy.songs = Array.from({ length: songCount }, () => ({ title: "", lead: "", key: "" }));
        segmentCopy.number_of_songs = songCount;
      }
      return segmentCopy;
    });

    const initialData = { ...serviceData };
    if (!activeBlueprint) {
      toast.error("No se encontró el blueprint en la base de datos. No se puede restablecer.");
      return;
    }

    // RESET-SLOT-FIX: Only reset the selected slots (or all if not specified)
    const targetSlots = (slotsToReset && slotsToReset.length > 0) ? slotsToReset : slotNames;
    targetSlots.forEach(name => {
      let bpSegments = activeBlueprint[name];
      if (!bpSegments || bpSegments.length === 0) {
        // Slot has no dedicated blueprint definition — warn and fall back to first slot
        if (name !== firstSlot) {
          toast.info(`Blueprint para "${name}" no encontrado. Usando segmentos de ${firstSlot}.`);
        }
        bpSegments = activeBlueprint[firstSlot] || [];
      }
      initialData[name] = mapBpSegments(bpSegments);
    });

    setServiceData(initialData);

    // IMMEDIATE-SYNC (2026-02-21): Reset creates fresh segments without _entityId,
    // so per-field push is dead until the next full sync assigns new entity IDs.
    // Request an immediate sync (2s) instead of waiting for the 30s safety net.
    if (requestImmediateSync) requestImmediateSync();

    const resetLabel = targetSlots.length < slotNames.length
      ? `Horarios restablecidos: ${targetSlots.join(', ')}`
      : "Servicio restablecido al diseño original";
    toast.success(resetLabel);
  };

  const addSpecialSegment = () => {
    const newSegment = {
      type: "special",
      title: specialSegmentDetails.title,
      duration: specialSegmentDetails.duration,
      fields: ["description"],
      data: {
        description: "",
        presenter: specialSegmentDetails.presenter,
        translator: specialSegmentDetails.translator
      },
      actions: []
    };

    setServiceData(prev => {
      const updated = { ...prev };
      const targetArray = [...(updated[specialSegmentDetails.timeSlot] || [])];
      let insertIndex = specialSegmentDetails.insertAfterIdx + 1;
      if (insertIndex <= 0) insertIndex = 0;
      if (insertIndex > targetArray.length) insertIndex = targetArray.length;
      targetArray.splice(insertIndex, 0, newSegment);
      updated[specialSegmentDetails.timeSlot] = targetArray;
      return updated;
    });

    // New segment has no _entityId — request immediate sync
    if (requestImmediateSync) requestImmediateSync();

    setShowSpecialDialog(false);
    setSpecialSegmentDetails({
      timeSlot: firstSlot || "", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
    });
  };

  const removeSpecialSegment = (timeSlot, index) => {
    setServiceData(prev => {
      const updated = { ...prev };
      const targetArray = [...(updated[timeSlot] || [])];
      targetArray.splice(index, 1);
      updated[timeSlot] = targetArray;
      return updated;
    });
  };

  const handleMoveSegment = (timeSlot, index, direction) => {
    setServiceData(prev => {
      const items = [...(prev[timeSlot] || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return prev;
      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      return { ...prev, [timeSlot]: items };
    });
  };

  const handleAnnouncementSubmit = (formData) => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: formData });
    } else {
      createAnnouncementMutation.mutate(formData);
    }
  };

  const openAnnouncementEdit = (ann) => {
    setEditingAnnouncement(ann);
    setAnnouncementForm({
      title: ann.title,
      content: ann.content,
      instructions: ann.instructions || "",
      category: ann.category,
      is_active: ann.is_active,
      priority: ann.priority || 10,
      has_video: ann.has_video || false,
      date_of_occurrence: ann.date_of_occurrence || "",
      emphasize: ann.emphasize || false
    });
    setShowAnnouncementDialog(true);
  };

  const optimizeAnnouncementWithAI = async (formData, setResult) => {
    setOptimizingAnnouncement(true);
    
    const isStatic = formData?.category === "General";
    
    // Different limits for static vs dynamic
    const limits = isStatic 
      ? { title: 60, body: 420, cue: 200 }
      : { title: 80, body: 600, cue: 300 };
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a church communications editor optimizing an announcement for print and presentation.

ANNOUNCEMENT TYPE: ${isStatic ? 'STATIC (appears every week)' : 'DYNAMIC (event/ministry promotion)'}
CATEGORY: ${formData?.category || 'General'}

CURRENT CONTENT:
Title: ${formData?.title || '(empty)'}
Body: ${formData?.content || '(empty)'}
CUE/Instructions: ${formData?.instructions || '(empty)'}
${!isStatic && formData?.date_of_occurrence ? `Event Date: ${formData.date_of_occurrence}` : ''}
${formData?.emphasize ? 'EMPHASIZED: Yes (important announcement)' : ''}

STRICT CHARACTER LIMITS:
- Title: max ${limits.title} characters (currently ${(formData?.title || '').length})
- Body: max ${limits.body} characters (currently ${(formData?.content || '').replace(/<[^>]*>/g, '').length})
- CUE: max ${limits.cue} characters (currently ${(formData?.instructions || '').replace(/<[^>]*>/g, '').length})

FORMATTING OPTIONS (use HTML tags):
- <b>bold</b> for emphasis on key words/phrases
- <i>italic</i> for dates, times, locations
- Use bullet points (•) for lists (max 3-4 bullets)
- Use line breaks for paragraph separation

OPTIMIZATION RULES:
1. PRESERVE all essential information (dates, times, locations, contact info)
2. ${isStatic ? 'Keep it brief and punchy - this repeats weekly' : 'Include WHO, WHAT, WHEN, WHERE if applicable'}
3. Title: Action-oriented, attention-grabbing, NO formatting tags
4. Body: 
   - Lead with the most important info
   - Use <b>bold</b> for key action items or highlights
   - Use <i>italic</i> for dates/times/locations
   - Bullet points for multiple items
5. CUE: Brief presenter instructions (tone, gestures, emphasis points)
6. Output in the SAME LANGUAGE as the input (Spanish or English)
7. If content is good, improve clarity/formatting without major rewrites
8. ${formData?.emphasize ? 'This is EMPHASIZED - make it impactful and urgent' : ''}

Return ONLY valid JSON:
{
  "title": "optimized title (plain text, no HTML)",
  "content": "optimized body with HTML formatting",
  "instructions": "optimized CUE with HTML formatting or empty string"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            instructions: { type: "string" }
          },
          required: ["title", "content"]
        }
      });

      if (result && setResult) {
        setResult({
          title: (result.title || formData.title).substring(0, limits.title),
          content: (result.content || formData.content).substring(0, limits.body + 100), // Allow extra for HTML tags
          instructions: (result.instructions || formData.instructions || "").substring(0, limits.cue + 50)
        });
      }
    } catch (error) {
      console.error('AI optimization error:', error);
      // Phase 1: Replaced alert() with toast (2026-02-11)
      toast.error('Error al optimizar / Error optimizing: ' + error.message);
    } finally {
      setOptimizingAnnouncement(false);
    }
  };

  const moveAnnouncementPriority = (ann, direction) => {
    const newPriority = direction === 'up' ? (ann.priority || 10) - 1 : (ann.priority || 10) + 1;
    updateAnnouncementMutation.mutate({
      id: ann.id,
      data: { ...ann, priority: newPriority }
    });
  };

  const handleSavePrintSettings = (newSettings) => {
    setPrintSettingsPage1(newSettings.page1);
    setPrintSettingsPage2(newSettings.page2);
    setServiceData(prev => ({
      ...prev,
      print_settings_page1: newSettings.page1,
      print_settings_page2: newSettings.page2
    }));
  };

  const handleDownloadProgramPDF = async () => {
    const toastId = toast.loading('Generando PDF del Programa...');
    try {
      // Entity Lift: inject _slotNames so PDF generator uses dynamic columns
      const pdfData = { ...serviceData, _slotNames: slotNames };
      const pdf = await generateWeeklyProgramPDF(pdfData);
      pdf.download(`Programa-${serviceData.day_of_week || 'Servicio'}-${serviceData.date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  };

  const handleDownloadAnnouncementsPDF = async () => {
    const toastId = toast.loading('Generando PDF de Anuncios...');
    try {
      const allAnns = [...fixedAnnouncements, ...dynamicAnnouncements];
      const selectedForPrint = allAnns.filter(a => selectedAnnouncements.includes(a.id));
      
      if (selectedForPrint.length === 0) {
        toast.error('No hay anuncios seleccionados', { id: toastId });
        return;
      }

      const pdf = await generateAnnouncementsPDF(selectedForPrint, serviceData);
      pdf.download(`Anuncios-${serviceData.day_of_week || 'Servicio'}-${serviceData.date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  };

  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    // Note: This returns a setter function; parent must provide setExpandedSegments
    return key;
  };

  const calculateServiceTimes = (timeSlot) => {
    const segments = serviceData?.[timeSlot] || [];
    const totalDuration = segments
      .filter(seg => seg.type !== 'break' && seg.type !== 'ministry')
      .reduce((sum, seg) => sum + (seg.duration || 0), 0);
    
    // Centralised safe time parser — eliminates RangeError: Invalid time value
    const startTime = safeParseTimeSlot(timeSlot);

    const endTime = addMinutes(startTime, totalDuration);
    const targetDuration = 90;
    const isOverage = totalDuration > targetDuration;
    const overageAmount = totalDuration - targetDuration;

    return {
      totalDuration,
      startTime: formatDate(startTime, "h:mm a"),
      endTime: formatDate(endTime, "h:mm a"),
      isOverage,
      overageAmount,
      targetDuration
    };
  };

  return {
    // Segment handlers
    updateSegmentField,
    updateTeamField,
    handleOpenVerseParser,
    handleSaveParsedVerses,
    debouncedSave,
    // Copy handlers
    copyAllToNextSlot,
    copySegmentToNextSlot,
    copyPreServiceNotesToNextSlot,
    copyTeamToNextSlot,
    // Blueprint reset
    executeResetToBlueprint,
    // Special segment handlers
    addSpecialSegment,
    removeSpecialSegment,
    handleMoveSegment,
    // Announcement handlers
    handleAnnouncementSubmit,
    openAnnouncementEdit,
    optimizeAnnouncementWithAI,
    moveAnnouncementPriority,
    // Print/PDF handlers
    handleSavePrintSettings,
    handleDownloadProgramPDF,
    handleDownloadAnnouncementsPDF,
    // Time calculation
    calculateServiceTimes,
  };
}