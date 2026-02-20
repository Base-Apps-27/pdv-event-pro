/**
 * useWeeklyServiceHandlers.js
 * Phase 3A extraction: All handler functions from WeeklyServiceManager.
 * Verbatim extraction — zero logic changes.
 * 
 * Accepts state + setters + mutations from the parent and returns all handlers.
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
  selectedDate,
  selectedAnnouncements,
  printSettingsPage1,
  printSettingsPage2,
  saveServiceMutation,
  updateAnnouncementMutation,
  fixedAnnouncements,
  dynamicAnnouncements,
  blueprintData,
  // Setters for state owned by parent
  setSavingField,
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
}) {
  // Phase 2: derive first and second slot for copy operations
  const firstSlot = slotNames[0] || "9:30am";
  const secondSlot = slotNames[1] || "11:30am";
  // Ref to always have current serviceData for debounced saves
  const serviceDataRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    serviceDataRef.current = serviceData;
  }, [serviceData]);

  // Update handlers (pure state mutation, no saves)
  const updateSegmentField = (service, segmentIndex, field, value) => {
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
      
      // Auto-propagate translator from worship to other segments (for non-first slots with translation)
      if (field === 'translator' && service !== firstSlot && newSegment.type === 'worship') {
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
  };

  const updateTeamField = (field, service, value) => {
    setServiceData(prev => ({
      ...prev,
      [field]: { ...prev[field], [service]: value }
    }));
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

  // Debounced save
  const debouncedSave = useCallback((fieldKey) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSavingField(fieldKey);

    saveTimeoutRef.current = setTimeout(() => {
      const currentData = serviceDataRef.current;
      if (!currentData) {
        setSavingField(null);
        return;
      }
      
      const dataToSave = {
        ...currentData,
        selected_announcements: selectedAnnouncements,
        print_settings_page1: printSettingsPage1,
        print_settings_page2: printSettingsPage2,
        day_of_week: 'Sunday',
        name: `Domingo - ${selectedDate}`,
        status: 'active',
        service_type: 'weekly'
      };
      
      saveServiceMutation.mutate(dataToSave, {
        onSettled: () => {
          setSavingField(null);
        }
      });
    }, 800);
  }, [selectedDate, selectedAnnouncements, saveServiceMutation, printSettingsPage1, printSettingsPage2, setSavingField]);

  const handleSaveParsedVerses = (data) => {
    const { timeSlot, segmentIdx } = verseParserContext;
    
    setServiceData(prev => {
      const updated = { ...prev };
      const currentVerse = updated[timeSlot][segmentIdx].data?.verse || "";
      updated[timeSlot][segmentIdx].data = {
        ...updated[timeSlot][segmentIdx].data,
        verse: currentVerse, // Preserve existing verse text
        parsed_verse_data: data.parsed_data
      };
      return updated;
    });
    
    debouncedSave(`${timeSlot}-${segmentIdx}-verse-parsed`);
    setVerseParserOpen(false);
    setVerseParserContext({ timeSlot: null, segmentIdx: null });
  };

  // Phase 2: copy from first slot to second slot (dynamic names)
  const copy930To1130 = () => {
    if (slotNames.length < 2) return;
    setSavingField('copy-services');
    setServiceData(prev => {
      if (!prev) return prev;

      const updated = { ...prev };

      const copiedSegments = (updated[firstSlot] || []).map(seg => ({
        ...seg,
        data: { ...seg.data },
        actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
        songs: seg.songs ? seg.songs.map(s => ({ ...s })) : undefined,
      }));

      updated[secondSlot] = copiedSegments;

      // Always copy pre-service notes and team info
      if (updated.pre_service_notes) updated.pre_service_notes[secondSlot] = updated.pre_service_notes[firstSlot] || "";
      if (updated.coordinators) updated.coordinators[secondSlot] = updated.coordinators[firstSlot] || "";
      if (updated.ujieres) updated.ujieres[secondSlot] = updated.ujieres[firstSlot] || "";
      if (updated.sound) updated.sound[secondSlot] = updated.sound[firstSlot] || "";
      if (updated.luces) updated.luces[secondSlot] = updated.luces[firstSlot] || "";
      if (updated.fotografia) updated.fotografia[secondSlot] = updated.fotografia[firstSlot] || "";

      return updated;
    });
    debouncedSave('copy-services');
  };

  const copySegmentTo1130 = (segmentIndex) => {
    if (slotNames.length < 2) return;
    setSavingField(`copy-segment-${segmentIndex}`);
    setServiceData(prev => {
      if (!prev) return prev;

      const updated = { ...prev };
      const sourceSeg = (updated[firstSlot] || [])[segmentIndex];

      if (sourceSeg) {
        const copiedSegment = {
          ...sourceSeg,
          data: { ...sourceSeg.data },
          actions: sourceSeg.actions ? sourceSeg.actions.map(a => ({ ...a })) : [],
          songs: sourceSeg.songs ? sourceSeg.songs.map(s => ({ ...s })) : undefined,
        };
        if (!updated[secondSlot]) updated[secondSlot] = [];
        updated[secondSlot][segmentIndex] = copiedSegment;
      }

      return updated;
    });
    debouncedSave(`copy-segment-${segmentIndex}`);
  };

  const copyPreServiceNotesTo1130 = () => {
    if (slotNames.length < 2) return;
    setSavingField('copy-preservice');
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.pre_service_notes) updated.pre_service_notes[secondSlot] = updated.pre_service_notes[firstSlot] || "";
      return updated;
    });
    debouncedSave('copy-preservice');
  };

  const copyTeamTo1130 = () => {
    if (slotNames.length < 2) return;
    setSavingField('copy-team');
    setServiceData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.coordinators) updated.coordinators[secondSlot] = updated.coordinators[firstSlot] || "";
      if (updated.ujieres) updated.ujieres[secondSlot] = updated.ujieres[firstSlot] || "";
      if (updated.sound) updated.sound[secondSlot] = updated.sound[firstSlot] || "";
      if (updated.luces) updated.luces[secondSlot] = updated.luces[firstSlot] || "";
      if (updated.fotografia) updated.fotografia[secondSlot] = updated.fotografia[firstSlot] || "";
      return updated;
    });
    debouncedSave('copy-team');
  };

  /**
   * executeResetToBlueprint — RESET-SLOT-FIX (2026-02-20)
   * Now accepts an optional array of slot names to reset.
   * If omitted or empty, resets ALL slots (backward-compatible).
   */
  const executeResetToBlueprint = (slotsToReset) => {
    setShowResetConfirm(false);

    setSavingField('reset-blueprint');
    
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
        segmentCopy.songs = [
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" },
          { title: "", lead: "", key: "" }
        ];
      }
      return segmentCopy;
    });

    const initialData = { ...serviceData };
    if (!activeBlueprint) {
      toast.error("No se encontró el blueprint en la base de datos. No se puede restablecer.");
      setSavingField(null);
      return;
    }

    // RESET-SLOT-FIX: Only reset the selected slots (or all if not specified)
    const targetSlots = (slotsToReset && slotsToReset.length > 0) ? slotsToReset : slotNames;
    targetSlots.forEach(name => {
      const bpSegments = activeBlueprint[name] || activeBlueprint[firstSlot] || [];
      initialData[name] = mapBpSegments(bpSegments);
    });

    setServiceData(initialData);
    
    // Force immediate save
    const dataToSave = {
      ...initialData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active',
      service_type: 'weekly'
    };
    
    const resetLabel = targetSlots.length < slotNames.length
      ? `Horarios restablecidos: ${targetSlots.join(', ')}`
      : "Servicio restablecido al diseño original";

    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null),
      onSuccess: () => {
        toast.success(resetLabel);
      }
    });
  };

  const addSpecialSegment = () => {
    setSavingField('add-special');
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

    const updatedData = { ...serviceData };
    const targetArray = [...updatedData[specialSegmentDetails.timeSlot]];
    let insertIndex = specialSegmentDetails.insertAfterIdx + 1;
    if (insertIndex <= 0) insertIndex = 0;
    if (insertIndex > targetArray.length) insertIndex = targetArray.length;
    
    targetArray.splice(insertIndex, 0, newSegment);
    updatedData[specialSegmentDetails.timeSlot] = targetArray;
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
    });
    
    setShowSpecialDialog(false);
    setSpecialSegmentDetails({
      timeSlot: "9:30am", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
    });
  };

  const removeSpecialSegment = (timeSlot, index) => {
    setSavingField('remove-special');
    const updatedData = { ...serviceData };
    const targetArray = [...updatedData[timeSlot]];
    targetArray.splice(index, 1);
    updatedData[timeSlot] = targetArray;
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
    });
  };

  const handleMoveSegment = (timeSlot, index, direction) => {
    setSavingField('reorder');
    const items = [...serviceData[timeSlot]];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) return;
    
    // Swap items
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    
    const updatedData = {
      ...serviceData,
      [timeSlot]: items
    };
    
    setServiceData(updatedData);
    
    const dataToSave = {
      ...updatedData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    
    saveServiceMutation.mutate(dataToSave, {
      onSettled: () => setSavingField(null)
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
    debouncedSave('print-settings');
  };

  const handleDownloadProgramPDF = async () => {
    const toastId = toast.loading('Generando PDF del Programa...');
    try {
      // Entity Lift: inject _slotNames so PDF generator uses dynamic columns
      const pdfData = { ...serviceData, _slotNames: slotNames };
      const pdf = await generateWeeklyProgramPDF(pdfData);
      pdf.download(`Programa-Domingo-${serviceData.date}.pdf`);
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
      pdf.download(`Anuncios-Domingo-${serviceData.date}.pdf`);
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
    copy930To1130,
    copySegmentTo1130,
    copyPreServiceNotesTo1130,
    copyTeamTo1130,
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