/**
 * useWeeklyServiceHandlers.js
 * All handler functions for WeeklyServiceManager.
 *
 * SIMPLIFIED SAVE (2026-02-22): Handlers now ONLY update local state.
 * 5s debounced timer in WeeklyServiceManager handles all DB writes.
 * No per-field push, no blur callbacks, no entity ID checks.
 */

import { useCallback, useRef, useEffect } from "react";
import { addMinutes, format as formatDate } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { generateWeeklyProgramPDF } from "@/components/service/generateWeeklyProgramPDF";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";
import { safeParseTimeSlot } from "@/components/service/pdfUtils";
import { resolveSegmentEnum } from "@/components/utils/segmentTypeMap";

export function useWeeklyServiceHandlers({
  serviceData,    // NOTE: This is the serviceData snapshot at last render — use serviceDataRef for latest in callbacks
  setServiceData,
  selectedAnnouncements,
  updateAnnouncementMutation,
  fixedAnnouncements,
  dynamicAnnouncements,
  blueprintData,
  sessions,
  blueprints,
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
  // Entity Separation: per-field mutation hook instance
  segmentMutation,
}) {
  // Phase 2: derive first slot for blueprint fallback reference
  const firstSlot = slotNames[0];

  // Update handlers: state mutation + entity write.
  // Entity writes for the primary field are handled by input components.
  // Auto-propagation entity writes are collected and fired OUTSIDE the
  // state updater to avoid the React 18 strict-mode double-invocation issue.
  const updateSegmentField = (service, segmentIndex, field, value) => {
    const propagationWrites = [];

    setServiceData(prev => {
      const newServiceArray = [...(prev[service] || [])];
      if (!newServiceArray[segmentIndex]) return prev;
      const newSegment = { ...newServiceArray[segmentIndex] };

      // Fields that sit at the root of the segment object (not inside .data)
      const rootFields = ['songs', 'presentation_url', 'notes_url', 'content_is_slides_only'];

      if (rootFields.includes(field)) {
        newSegment[field] = value;
      } else {
        newSegment.data = { ...newSegment.data, [field]: value };
      }

      newServiceArray[segmentIndex] = newSegment;
      const updated = { ...prev, [service]: newServiceArray };

      // Auto-propagate translator to segments that reference this segment type
      if (field === 'translator' && newSegment.type) {
        const sourceType = newSegment.type.toLowerCase();
        const sourceKey = `${sourceType}_segment_translator`;
        
        updated[service] = updated[service].map((seg, idx) => {
          if (idx !== segmentIndex && seg.default_translator_source === sourceKey && !seg.data?.translator) {
            // Collect entity writes to run after state updater returns
            if (seg._entityId) {
              propagationWrites.push(seg._entityId);
            }
            return { ...seg, data: { ...seg.data, translator: value } };
          }
          return seg;
        });
      }

      return updated;
    });

    // Fire auto-propagation entity writes outside the state updater
    if (segmentMutation && propagationWrites.length > 0) {
      propagationWrites.forEach(entityId => {
        segmentMutation.mutateSegmentField(entityId, 'translator', value);
      });
    }
  };

  const updateTeamField = (field, service, value) => {
    // State-only: entity write is handled by TeamInput via UpdatersContext.mutateTeam
    setServiceData(prev => {
      return { ...prev, [field]: { ...prev[field], [service]: value } };
    });
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
    let entityIdForWrite = null;

    setServiceData(prev => {
      const updated = { ...prev };
      const seg = updated[timeSlot][segmentIdx];
      const currentVerse = seg.data?.verse || "";
      updated[timeSlot][segmentIdx] = {
        ...seg,
        data: {
          ...seg.data,
          verse: currentVerse,
          parsed_verse_data: data.parsed_data
        }
      };
      entityIdForWrite = seg._entityId;
      return updated;
    });

    // Entity write: parsed verse data (outside state updater)
    if (segmentMutation && entityIdForWrite) {
      segmentMutation.mutateSegmentField(entityIdForWrite, 'parsed_verse_data', data.parsed_data);
    }

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

      // Entity writes: copy content to target entities
      if (segmentMutation) {
        const targetSessionId = updated._sessionIds?.[targetSlot];
        const sourceSessionId = updated._sessionIds?.[sourceSlot];

        // Update each target segment's content fields via entity write
        updated[targetSlot].forEach((seg, idx) => {
          if (seg._entityId && sourceSegments[idx]) {
            const src = sourceSegments[idx];
            // Copy text fields from source to target entity
            const textFields = ['presenter', 'preacher', 'translator', 'verse',
              'messageTitle', 'description_details', 'coordinator_notes', 'projection_notes',
              'sound_notes', 'ushers_notes', 'translation_notes', 'stage_decor_notes'];
            textFields.forEach(f => {
              const val = src.data?.[f];
              if (val !== undefined) {
                segmentMutation.mutateSegmentField(seg._entityId, f, val);
              }
            });
            // Copy songs
            if (src.songs) {
              segmentMutation.mutateSongs(seg._entityId, src.songs);
            }
          }
        });

        // Copy team fields to target session
        if (targetSessionId) {
          ['coordinators', 'ujieres', 'sound', 'luces', 'fotografia'].forEach(f => {
            const val = updated[f]?.[sourceSlot] || "";
            segmentMutation.mutateTeam(targetSessionId, f, val);
          });
        }

        // Copy pre-service notes
        if (targetSessionId) {
          const preNotes = updated.pre_service_notes?.[sourceSlot] || "";
          segmentMutation.mutatePreServiceNotes(targetSessionId, preNotes);
        }
      }

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
        // Entity write: copy content fields to target entity
        if (segmentMutation && targetSeg._entityId) {
          const textFields = ['presenter', 'preacher', 'translator', 'verse',
           'messageTitle', 'description_details', 'coordinator_notes', 'projection_notes',
           'sound_notes', 'ushers_notes', 'translation_notes', 'stage_decor_notes'];
          textFields.forEach(f => {
            const val = sourceSeg.data?.[f];
            if (val !== undefined) {
              segmentMutation.mutateSegmentField(targetSeg._entityId, f, val);
            }
          });
          if (sourceSeg.songs) {
            segmentMutation.mutateSongs(targetSeg._entityId, sourceSeg.songs);
          }
        }
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
      const notes = updated.pre_service_notes?.[sourceSlot] || "";
      if (updated.pre_service_notes) updated.pre_service_notes[targetSlot] = notes;
      // Entity write: copy pre-service notes to target session
      const targetSessionId = updated._sessionIds?.[targetSlot];
      if (segmentMutation && targetSessionId) {
        segmentMutation.mutatePreServiceNotes(targetSessionId, notes);
      }
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
      // Entity write: copy team fields to target session
      const targetSessionId = updated._sessionIds?.[targetSlot];
      if (segmentMutation && targetSessionId) {
        ['coordinators', 'ujieres', 'sound', 'luces', 'fotografia'].forEach(f => {
          segmentMutation.mutateTeam(targetSessionId, f, updated[f]?.[sourceSlot] || "");
        });
      }
      return updated;
    });
  };

  /**
   * executeResetToBlueprint — RESET-SLOT-FIX (2026-02-20)
   * Now accepts an optional array of slot names to reset.
   * If omitted or empty, resets ALL slots (backward-compatible).
   * 
   * RELIABILITY FIX (2026-02-24):
   * This function now performs a FULL synchronous reset:
   * 1. Deletes old segments in the session
   * 2. Creates NEW segments from blueprint immediately in DB
   * 3. Updates local state with the new structure AND the new entity IDs
   * This ensures subsequent field edits have a valid _entityId to write to.
   */
  const executeResetToBlueprint = async (slotsToReset) => {
    setShowResetConfirm(false);
    const toastId = toast.loading("Restableciendo estructura...");

    try {
      // Helper to get default fields if blueprint is corrupted/missing them
      const getDefaultFields = (type) => {
        const t = type?.toLowerCase() || '';
        if (t === 'worship') return ["leader", "songs"];
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

      // DECISION-002 Contract 4: Snapshot before destructive reset.
      // Capture segment IDs so we can log them if something fails.
      const preResetSnapshot = {};
      for (const slotName of (slotsToReset && slotsToReset.length > 0 ? slotsToReset : slotNames)) {
        const sessionId = serviceData?._sessionIds?.[slotName];
        if (sessionId) {
          try {
            const existingSegs = await base44.entities.Segment.filter({ session_id: sessionId });
            preResetSnapshot[slotName] = existingSegs.map(s => ({ id: s.id, title: s.title, type: s.segment_type }));
          } catch (e) {
            preResetSnapshot[slotName] = [];
          }
        }
      }
      console.log("[executeResetToBlueprint] Pre-reset snapshot:", JSON.stringify(preResetSnapshot));

      // Use current serviceData.id directly (avoids stale state closure issues).
      // serviceData is a dependency of this handler, so it's always fresh.
      if (!serviceData?.id) {
         throw new Error("Service ID missing. Cannot reset. Please refresh the page.");
      }

      let nextState = { ...serviceData };
      const targetSlots = (slotsToReset && slotsToReset.length > 0) ? slotsToReset : slotNames;

      for (const slotName of targetSlots) {
        // 1. Resolve Blueprint
        const sessionDef = sessions?.find(s => s.name === slotName);
        const bp = sessionDef?.blueprint_id ? blueprints?.find(b => b.id === sessionDef.blueprint_id) : null;
        let bpSegments = bp?.segments || [];
        
        // Legacy migration fallback
        if (bp && bpSegments.length === 0) {
          const firstKey = Object.keys(bp).find(k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k));
          if (firstKey) bpSegments = bp[firstKey];
        }

        if (!bpSegments || bpSegments.length === 0) {
          console.warn(`Blueprint for "${slotName}" empty/missing. using empty list.`);
          bpSegments = [];
        }

        const newSegmentsData = mapBpSegments(bpSegments);
        
        // 2. Ensure Session exists
        let sessionId = nextState._sessionIds?.[slotName];
        if (!sessionId) {
          // Create Session on the fly
            const newSession = await base44.entities.Session.create({
              service_id: serviceData.id,
              name: slotName,
              // Assuming default date/order logic is handled by backend or we accept defaults
              date: nextState.date
            });
          sessionId = newSession.id;
          nextState = { 
            ...nextState, 
            _sessionIds: { ...nextState._sessionIds, [slotName]: sessionId } 
          };
        }

        // 3. Delete Old Segments
        if (segmentMutation) {
          await segmentMutation.deleteAllSegmentsInSession(sessionId);
        }

        // 4. Create New Segments in DB & Inject IDs
        const createdSegments = [];
        for (let i = 0; i < newSegmentsData.length; i++) {
          const segData = newSegmentsData[i];
          
          // DECISION-002 Contract 2: Shared type normalization
          const resolvedType = resolveSegmentEnum(segData.type);

          // Map to entity structure, ensuring strict schema compliance
          const entityPayload = {
            session_id: sessionId,
            service_id: serviceData.id,
            order: i + 1,
            title: segData.title || "Untitled",
            segment_type: resolvedType,
            duration_min: Number(segData.duration) || 0,
            show_in_general: true,
            ui_fields: Array.isArray(segData.fields) ? segData.fields : [],
            ui_sub_assignments: Array.isArray(segData.sub_assignments) ? segData.sub_assignments.map(sa => ({
              label: sa.label || "Untitled",
              person_field_name: sa.person_field_name || "",
              duration_min: Number(sa.duration_min || sa.duration) || 0
            })) : [],
            requires_translation: !!segData.requires_translation,
            default_translator_source: segData.default_translator_source || "manual",
          };

          if (segData.number_of_songs !== undefined) {
            entityPayload.number_of_songs = Number(segData.number_of_songs) || 0;
          }

          let created = null;
          if (segmentMutation) {
             created = await segmentMutation.createSegment(entityPayload);
          }

          // Merge ID back into local state object
          createdSegments.push({
            ...segData,
            _entityId: created?.id,
            _sessionId: sessionId
          });
        }

        nextState[slotName] = createdSegments;
      }

      // Mark as entity-backed so metadata save doesn't redundantly write segments to blob
      nextState._fromEntities = true;
      setServiceData(nextState);

      const resetLabel = targetSlots.length < slotNames.length
        ? `Horarios restablecidos: ${targetSlots.join(', ')}`
        : "Servicio restablecido al diseño original";
      toast.success(resetLabel, { id: toastId });

    } catch (error) {
      console.error("Reset failed:", error);
      toast.error("Error al restablecer: " + error.message, { id: toastId });
    }
  };

  const addSpecialSegment = () => {
    const timeSlot = specialSegmentDetails.timeSlot;
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

    let insertIndex;
    setServiceData(prev => {
      const updated = { ...prev };
      const targetArray = [...(updated[timeSlot] || [])];
      insertIndex = specialSegmentDetails.insertAfterIdx + 1;
      if (insertIndex <= 0) insertIndex = 0;
      if (insertIndex > targetArray.length) insertIndex = targetArray.length;
      targetArray.splice(insertIndex, 0, newSegment);
      updated[timeSlot] = targetArray;
      return updated;
    });

    // Entity write: create Segment entity for the new special segment
    if (segmentMutation && serviceData?._sessionIds?.[timeSlot]) {
      const sessionId = serviceData._sessionIds[timeSlot];
      segmentMutation.createSegment({
        session_id: sessionId,
        service_id: serviceData?.id,
        order: (insertIndex || 0) + 1,
        title: specialSegmentDetails.title,
        segment_type: "Especial",
        duration_min: specialSegmentDetails.duration,
        presenter: specialSegmentDetails.presenter || "",
        translator_name: specialSegmentDetails.translator || "",
        show_in_general: true,
        ui_fields: ["description"],
        ui_sub_assignments: [],
      }).then(created => {
        // Inject the new entity ID into local state
        if (created?.id) {
          setServiceData(prev => {
            const arr = [...(prev[timeSlot] || [])];
            // Find the special segment we just inserted (match by title + no _entityId)
            const idx = arr.findIndex(s => s.type === 'special' && s.title === specialSegmentDetails.title && !s._entityId);
            if (idx >= 0) {
              arr[idx] = { ...arr[idx], _entityId: created.id, _sessionId: sessionId };
              return { ...prev, [timeSlot]: arr };
            }
            return prev;
          });
        }
      }).catch(err => {
        console.error('[addSpecialSegment] Entity create failed:', err.message);
      });
    }

    setShowSpecialDialog(false);
    setSpecialSegmentDetails({
      timeSlot: firstSlot || "", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
    });
  };

  const removeSpecialSegment = (timeSlot, index) => {
    // Capture entity ID before removing from state
    const entityId = serviceData?.[timeSlot]?.[index]?._entityId;

    setServiceData(prev => {
      const updated = { ...prev };
      const targetArray = [...(updated[timeSlot] || [])];
      targetArray.splice(index, 1);
      updated[timeSlot] = targetArray;
      return updated;
    });

    // Entity write: delete Segment entity
    if (segmentMutation && entityId) {
      segmentMutation.deleteSegment(entityId).catch(err => {
        console.error('[removeSpecialSegment] Entity delete failed:', err.message);
      });
    }
  };

  const handleMoveSegment = (timeSlot, index, direction) => {
    // Capture entity IDs and orders before swapping
    const items = serviceData?.[timeSlot] || [];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const seg1 = items[index];
    const seg2 = items[targetIndex];

    setServiceData(prev => {
      const arr = [...(prev[timeSlot] || [])];
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return { ...prev, [timeSlot]: arr };
    });

    // Entity write: swap order values
    if (segmentMutation && seg1?._entityId && seg2?._entityId) {
      // Use 1-based order matching the original positions
      segmentMutation.swapSegmentOrder(
        seg1._entityId, targetIndex + 1,
        seg2._entityId, index + 1
      ).catch(err => {
        console.error('[handleMoveSegment] Entity order swap failed:', err.message);
      });
    }
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