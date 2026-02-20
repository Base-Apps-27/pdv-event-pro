/**
 * EventAIHelper.jsx
 * 
 * 2-step pipeline for file imports (2026-02-18):
 * Step 1: ExtractDataFromUploadedFile → structured schedule data (fast, purpose-built)
 * Step 2: InvokeLLM with extracted text data → map to create_sessions/create_segments
 * This avoids sending a raw PDF to a vision model with a giant prompt (which times out).
 *
 * For text-only requests: single InvokeLLM call with lean prompt.
 * File-only submissions are now allowed (no text required when a file is attached).
 */
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Send, CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/utils/i18n";
import { validateAIActions, VALID_SEGMENT_TYPES } from "@/components/utils/segmentValidation";
import AIProposalEditor from "@/components/event/AIProposalEditor";

import EventClarificationPicker from "@/components/event/EventClarificationPicker";
import AIFileUploadZone from "@/components/event/AIFileUploadZone";
import { fuzzySearchEvents } from "@/components/utils/eventFuzzySearch";

export default function EventAIHelper({ eventId, isOpen, onClose }) {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const { language, t } = useLanguage();
  
  const queryClient = useQueryClient();
  const textareaRef = useRef(null);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(""); // "extracting" | "analyzing"
  const [proposedActions, setProposedActions] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [clarificationOptions, setClarificationOptions] = useState(null);
  const [showClarification, setShowClarification] = useState(false);
  const [sourceEventData, setSourceEventData] = useState(null);
  const [isLoadingSourceEvent, setIsLoadingSourceEvent] = useState(false);
  const [attachedFileUrl, setAttachedFileUrl] = useState(null);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    enabled: !!eventId,
    select: (data) => data[0]
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: () => base44.entities.Session.filter({ event_id: eventId }),
    enabled: !!eventId
  });

  // Improvement #7: Scoped segment query — only fetch segments for this event's sessions,
  // not all segments in the entire app. Falls back gracefully if no sessions exist yet.
  const sessionIds = sessions.map(s => s.id).filter(Boolean);
  const { data: eventSegments = [] } = useQuery({
    queryKey: ['eventSegments', eventId, sessionIds.join(',')],
    queryFn: () => base44.entities.Segment.filter({ session_id: { $in: sessionIds } }),
    enabled: !!eventId && sessionIds.length > 0
  });

  // Lightweight event index (last 2 years) — cached, non-blocking
  const { data: eventIndex = [] } = useQuery({
    queryKey: ['eventIndex'],
    queryFn: async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const minYear = twoYearsAgo.getFullYear();
      
      const allEvents = await base44.entities.Event.list();
      return allEvents
        .filter(e => e.year >= minYear)
        .map(e => ({ id: e.id, name: e.name, year: e.year, session_count: 0 }))
        .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 60,
    enabled: isOpen
  });

  // ── Step 1: Extract structured data from file (fast, no LLM vision) ──
  // 2026-02-20: Strengthened schema descriptions to prevent session merging/skipping
  const extractFileData = async () => {
    if (!attachedFileUrl) return null;
    setProcessingStep("extracting");
    try {
      const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: attachedFileUrl,
        json_schema: {
          type: "object",
          properties: {
            sessions: {
              type: "array",
              description: "CRITICAL: Extract ALL sessions/sections EXACTLY as labeled in the document. Look for explicit section headers like 'SECCIÓN 1', 'SECCIÓN 2', 'SESSION 1', etc. and create ONE session per labeled section. Do NOT merge sections. Do NOT create sessions for meal breaks (Almuerzo/Lunch) — those are segments within a session. If the document shows 4 sections (SECCIÓN 1, SECCIÓN 2, SECCIÓN 3, SECCIÓN 4), you MUST return exactly 4 sessions. Typical events have 1-2 sessions per day, 2-6 sessions total across multiple days.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "EXACT session name from the document's section header (e.g. 'SECCIÓN 1 VIERNES 13 DE MARZO' → 'Sección 1 — Viernes 13 de marzo'). Copy the section label exactly, just clean up formatting. NEVER leave empty." },
                  date: { type: "string", description: "Date in YYYY-MM-DD format extracted from the section header" },
                  start_time: { type: "string", description: "First activity time in this section (HH:MM 24h). For registration sessions, use registration time." },
                  end_time: { type: "string", description: "Last activity end time in this section (HH:MM 24h). Include meal breaks that end the session." },
                  segments: {
                    type: "array",
                    description: "ALL schedule items listed under this section header, in chronological order. Include registration, breaks, meals, etc. as segments. Every line item with a time = one segment.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Activity name as written in the document" },
                        type_hint: { type: "string", description: "Best guess: worship, sermon, break, lunch, registration, arts, drama, dance, prayer, video, announcements, MC, offering, welcome, panel, closing, special, other" },
                        start_time: { type: "string", description: "HH:MM 24h format" },
                        duration_min: { type: "number", description: "Duration in minutes if stated (look for patterns like '60min', '10 mins', or calculate from time gaps)" },
                        presenter: { type: "string", description: "Speaker/leader name if listed (e.g. 'A. Tere Paz', 'Laura Paz')" },
                        message_title: { type: "string", description: "Message/sermon title if this is a sermon/plenaria (e.g. 'Autor de La Vida', 'Plenitud de Vida')" },
                        notes: { type: "string", description: "Any parenthetical notes or extra details" }
                      }
                    }
                  }
                }
              }
            },
            event_name: { type: "string", description: "Event name/title from document header" },
            event_dates: { type: "string", description: "Date range if found" },
            event_location: { type: "string", description: "Venue if found" },
            raw_notes: { type: "string", description: "Any other important info" }
          }
        }
      });

      if (extraction.status === 'success' && extraction.output) {
        return extraction.output;
      }
      console.warn("[AI_FILE] Extraction returned status:", extraction.status, extraction.details);
      return null;
    } catch (err) {
      console.warn("[AI_FILE] ExtractDataFromUploadedFile error:", err.message);
      return null;
    }
  };

  // ── Build compact context for LLM (trimmed vs old bloated version) ──
  const buildContext = () => ({
    event: event ? {
      id: event.id, name: event.name, year: event.year,
      location: event.location, start_date: event.start_date,
      end_date: event.end_date, theme: event.theme
    } : null,
    sessions: sessions.map(s => ({
      id: s.id, name: s.name, date: s.date,
      planned_start_time: s.planned_start_time,
      planned_end_time: s.planned_end_time,
      presenter: s.presenter, session_color: s.session_color,
      is_translated_session: s.is_translated_session
    })),
    segments: eventSegments.map(seg => ({
      id: seg.id, title: seg.title, session_id: seg.session_id,
      segment_type: seg.segment_type, start_time: seg.start_time,
      duration_min: seg.duration_min, presenter: seg.presenter,
      message_title: seg.message_title, color_code: seg.color_code,
      order: seg.order
    }))
  });

  // ── LLM response JSON schema (shared) ──
  const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      request_type: { type: "string" },
      type: { type: "string" },
      understood_request: { type: "string" },
      message: { type: "string" },
      options: { type: "array", items: { type: "object" } },
      query_result: {
        type: "object",
        properties: {
          summary: { type: "string" },
          details: { type: "array", items: { type: "object", properties: { title: { type: "string" }, info: { type: "string" } } } }
        }
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            description: { type: "string" },
            target_ids: {},
            create_data: { type: "array", items: { type: "object" } },
            changes: { type: "object" },
            affected_count: { type: "number" }
          }
        }
      },
      warnings: { type: "array", items: { type: "string" } },
      requires_confirmation: { type: "boolean" }
    }
  };

  // ── Main analysis function ──
  const analyzeRequest = async (inputText = null, sourceEventContext = null) => {
    const finalInput = inputText || userInput;
    // Allow file-only submissions (no text required)
    if (!finalInput.trim() && !attachedFileUrl) return;

    setIsProcessing(true);
    setProposedActions(null);
    setQueryResult(null);

    try {
      // Step 1: If file is attached, extract structured data first
      let extractedSchedule = null;
      if (attachedFileUrl) {
        extractedSchedule = await extractFileData();
      }

      setProcessingStep("analyzing");

      const contextSummary = buildContext();
      const availableEventsStr = eventIndex.length > 0
        ? eventIndex.map(e => `${e.name} (${e.year})`).slice(0, 10).join(', ')
        : 'None';
      const sourceEventStr = sourceEventContext
        ? `\nSOURCE EVENT: ${sourceEventContext.sourceEvent.name} (${sourceEventContext.sourceEvent.year}), ${sourceEventContext.sourceSessions.length} sessions, ${sourceEventContext.sourceSegments.length} segments`
        : '';

      // Build file section — structured data if available, vision fallback otherwise
      const hasExtractedData = extractedSchedule?.sessions?.length > 0;
      const fileUrls = (attachedFileUrl && !hasExtractedData) ? [attachedFileUrl] : undefined;

      // Log extraction results for diagnostics (2026-02-20)
      if (hasExtractedData) {
        console.log(`[AI_FILE] Extraction found ${extractedSchedule.sessions.length} sessions:`,
          extractedSchedule.sessions.map(s => `"${s.name}" (${s.segments?.length || 0} segs)`));
      }

      const fileSection = hasExtractedData
        ? `\n## EXTRACTED SCHEDULE DATA (from uploaded file)\n${JSON.stringify(extractedSchedule, null, 2)}\n\nCRITICAL: Map ALL ${extractedSchedule.sessions.length} sessions above to create_sessions_with_segments actions. Do NOT skip or merge any sessions. Each extracted session = one session in your output.`
        : attachedFileUrl
          ? `\n## ATTACHED FILE\nAnalyze the attached file and extract sessions/segments from it.`
          : '';

      const userInstruction = finalInput.trim()
        ? `"${finalInput}"`
        : hasExtractedData
          ? '"Create sessions and segments from the uploaded schedule"'
          : '"Analyze the attached file and create sessions and segments"';

      // Step 2: Lean LLM prompt
      // ARCHITECTURE NOTE (2026-02-20): For file imports with extracted data, we use
      // "create_sessions_with_segments" action type — each session carries its own
      // segments array, so executeActions creates the session, gets the real ID, and
      // immediately creates its segments. No temp_session_ref cross-referencing needed.
      // The old create_sessions + create_segments split caused chronic null session_id
      // because the LLM inconsistently populated temp_session_ref on segments.
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant managing church event data. You can QUERY info or PROPOSE actions.

## CURRENT EVENT
${JSON.stringify(contextSummary, null, 2)}

## AVAILABLE EVENTS (last 2 years)
${availableEventsStr}${sourceEventStr}
${fileSection}

## USER REQUEST
${userInstruction}

## TASK
Determine if QUERY or ACTION. For actions, propose changes using these types:
- create_sessions_with_segments: PREFERRED for new sessions. Each session object has a "segments" array with its child segments. This is the ONLY way to create new sessions and segments.
- update_sessions / update_segments / update_event: Modify existing records.

## SESSION NAMING (CRITICAL)
Every session MUST have a "name" field. Derive it from the document:
- "SECCIÓN 1 VIERNES 13 DE MARZO" → name: "Sección 1 — Viernes 13 de marzo"
- "SESSION 2 SATURDAY" → name: "Session 2 — Saturday"
- If no section label, use: "Sesión 1", "Sesión 2", etc.
NEVER leave name empty or null.

## SEGMENT TYPE ENUM
Alabanza, Plenaria, Bienvenida, Ofrenda, Video, Anuncio, Dinámica, Break, TechOnly, Oración, Especial, Cierre, MC, Ministración, Receso, Almuerzo, Artes, Breakout, Panel

## TYPE HINT → SEGMENT_TYPE MAPPING
worship→Alabanza, sermon/message/plenaria→Plenaria, break→Break/Receso, lunch/dinner→Almuerzo, arts/drama/dance→Artes, prayer→Oración, video→Video, announcements→Anuncio, MC→MC, offering→Ofrenda, welcome→Bienvenida, panel→Panel, closing→Cierre, special/other→Especial

## REGISTRATION HANDLING (IMPORTANT)
"Registración" / "Registration" is NOT a segment. It is pre-session arrival/setup time.
- Set the session's planned_start_time to the registration open time
- Set the first actual program segment's start_time to when the program begins (after registration)
- Do NOT create a segment for registration

## ALMUERZO / LUNCH HANDLING (IMPORTANT)
"Almuerzo" / "Lunch" / "Cena" / "Dinner" are long breaks, NOT separate sessions.
- They MUST be the LAST segment of the session that precedes them (segment_type: "Almuerzo", major_break: true, color_code: "break").
- Do NOT create a standalone session for a meal break.
- The session's planned_end_time should extend to include the meal break duration.
- The next session starts after the meal break ends.

## COLOR_CODE MAPPING
worship→Alabanza/Ministración, preach→Plenaria, break→Break/Receso/Almuerzo, special→Artes/Especial, default→others. Almuerzo→major_break:true.

## KEY FIELDS
Segments: title, segment_type, start_time (HH:MM), duration_min, presenter, message_title (Plenaria), color_code, order, major_break
Sessions: name, date (YYYY-MM-DD), planned_start_time, planned_end_time (HH:MM), session_color, order
Alabanza extras: number_of_songs, song_1_title..song_6_title, song_1_lead..song_6_lead, song_1_key..song_6_key
Panel extras: panel_moderators, panel_panelists
Event: name, theme, location, status, start_date, end_date
Full session fields: is_translated_session, translation_team, sound_team, tech_team, coordinators, admin_team, ushers_team, hospitality_team, photography_team, worship_leader, lights_team, video_team, notes
Full segment fields: requires_translation, translation_mode, translator_name, projection_notes, sound_notes, ushers_notes, stage_decor_notes, description_details, prep_instructions, microphone_assignments, stage_call_offset_min, show_in_general, show_in_projection, show_in_sound, show_in_ushers

## CROSS-EVENT REFERENCES
If uncertain which past event: {"type":"ask_event_clarification","message":"Which?","options":[{id,name,year}]}

## RESPONSE FORMAT (JSON)
For creating sessions with segments, use EXACTLY this structure:
{"request_type":"action","understood_request":"...","actions":[{"type":"create_sessions_with_segments","description":"...","create_data":[{"name":"Session Name","date":"YYYY-MM-DD","planned_start_time":"HH:MM","planned_end_time":"HH:MM","session_color":"blue","order":1,"segments":[{"title":"...","segment_type":"...","start_time":"HH:MM","duration_min":30,"presenter":"...","order":1,"color_code":"default"}]}],"affected_count":N}],"warnings":[],"requires_confirmation":true}

For queries: {"request_type":"query","understood_request":"...","query_result":{"summary":"...","details":[{"title":"...","info":"..."}]}}
For updates: {"request_type":"action","actions":[{"type":"update_sessions|update_segments|update_event","target_ids":["id"]|"all","changes":{...}}]}
For clarification: {"type":"ask_event_clarification","message":"Which?","options":[{id,name,year}]}`,
        ...(fileUrls ? { file_urls: fileUrls } : {}),
        response_json_schema: RESPONSE_SCHEMA
      });

      if (response.request_type === 'query') {
        setQueryResult(response);
      } else if (response.type === 'ask_event_clarification') {
        const matches = fuzzySearchEvents(eventIndex, response.message || '');
        setClarificationOptions(matches.length > 0 ? matches : response.options || []);
        setShowClarification(true);
      } else {
        // Diagnostic: warn if LLM dropped real sessions from extraction (2026-02-20)
        // Exclude meal-break "sessions" that the extraction may produce but the LLM
        // correctly folds into the preceding session per ALMUERZO/LUNCH rules.
        if (hasExtractedData) {
          const mealPattern = /^(almuerzo|lunch|cena|dinner|comida|desayuno|breakfast)\b/i;
          const realExtracted = extractedSchedule.sessions.filter(s => !mealPattern.test((s.name || '').trim()));
          const extractedCount = realExtracted.length;
          const llmSessionCount = (response.actions || [])
            .filter(a => a.type === 'create_sessions_with_segments' || a.type === 'create_sessions')
            .reduce((sum, a) => sum + (a.create_data?.length || 0), 0);
          if (llmSessionCount < extractedCount) {
            console.warn(`[AI_SESSION_DROP] Extraction had ${extractedCount} real sessions but LLM only returned ${llmSessionCount}. User can add missing ones in editor.`);
            toast.warning(
              language === 'es'
                ? `Se detectaron ${extractedCount} sesiones pero la IA generó ${llmSessionCount}. Revisa y agrega las faltantes.`
                : `${extractedCount} sessions detected but AI generated ${llmSessionCount}. Review and add missing ones.`
            );
          }
        }

        // Always open the interactive editor so the user can see & edit
        // the full session/segment tree before confirming.
        setProposedActions(response);
        setShowReview(true);
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error(language === 'es' ? "Error al analizar la solicitud" : "Error analyzing request");
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  /**
   * executeActions — Atomic session+segments execution (2026-02-20 v3)
   *
   * ARCHITECTURE: The LLM now returns "create_sessions_with_segments" actions
   * where each session object carries a "segments" array. This eliminates
   * cross-referencing entirely:
   *   1. Create session → get real ID
   *   2. Create each child segment with that real ID
   *   3. Move to next session
   *
   * Backward compat: Still handles legacy create_sessions / create_segments
   * in case the LLM falls back to the old format.
   */
  const executeActions = async (actions = null, isDraft = false) => {
    const actionsToExecute = actions || proposedActions?.actions;
    if (!actionsToExecute?.length) return;

    const finalValidation = validateAIActions(actionsToExecute || [], {}, isDraft);
    if (!finalValidation.isValid && !isDraft) {
      toast.error(language === 'es' 
        ? 'No se puede ejecutar: hay errores de validación' 
        : 'Cannot execute: validation errors present');
      return;
    }

    setExecutionStatus('executing');

    try {
      let totalAffected = 0;

      for (const action of actionsToExecute) {
        // ── PRIMARY PATH: Atomic session + segments ──
        if (action.type === 'create_sessions_with_segments') {
          for (let i = 0; i < (action.create_data || []).length; i++) {
            const sessionData = action.create_data[i];
            // Extract segments array from the session object
            const { segments: childSegments, temp_session_ref, ...cleanSessionData } = sessionData;

            if (!cleanSessionData.name) cleanSessionData.name = `Sesión ${i + 1}`;

            // 1. Create the session
            const newSession = await base44.entities.Session.create({
              event_id: eventId,
              order: cleanSessionData.order ?? (i + 1),
              ...cleanSessionData
            });
            const sessionId = newSession.id;
            console.log(`[AI_EXEC] Session[${i}] created: id=${sessionId}, name="${cleanSessionData.name}"`);
            totalAffected++;

            // Improvement #1: Use bulkCreate for segments (was sequential create loop).
            // Cuts N API calls per session down to 1, ~4x faster overall.
            if (childSegments?.length > 0) {
              const bulkData = childSegments.map((seg, j) => {
                const { temp_session_ref: _ref, session_id: _sid, ...cleanSegData } = seg;
                if (cleanSegData.segment_type && !VALID_SEGMENT_TYPES.includes(cleanSegData.segment_type)) {
                  cleanSegData.segment_type = "Especial";
                }
                return {
                  session_id: sessionId,
                  order: cleanSegData.order ?? (j + 1),
                  ...cleanSegData
                };
              });
              await base44.entities.Segment.bulkCreate(bulkData);
              totalAffected += bulkData.length;
              console.log(`[AI_EXEC] Session[${i}]: ${bulkData.length} segments bulk-created`);
            }
          }
        }
        // ── LEGACY COMPAT: Separate create_sessions (without segments) ──
        else if (action.type === 'create_sessions') {
          for (let i = 0; i < (action.create_data || []).length; i++) {
            const { temp_session_ref, segments: childSegments, ...cleanData } = action.create_data[i];
            if (!cleanData.name) cleanData.name = `Sesión ${i + 1}`;
            const newSession = await base44.entities.Session.create({
              event_id: eventId,
              order: cleanData.order ?? (i + 1),
              ...cleanData
            });
            console.log(`[AI_EXEC] Legacy session[${i}] created: id=${newSession.id}`);
            totalAffected++;

            // Legacy path: also uses bulkCreate for consistency (Improvement #1)
            if (childSegments?.length > 0) {
              const bulkData = childSegments.map((seg, j) => {
                const { temp_session_ref: _r, session_id: _s, ...cleanSegData } = seg;
                if (cleanSegData.segment_type && !VALID_SEGMENT_TYPES.includes(cleanSegData.segment_type)) {
                  cleanSegData.segment_type = "Especial";
                }
                return {
                  session_id: newSession.id,
                  order: cleanSegData.order ?? (j + 1),
                  ...cleanSegData
                };
              });
              await base44.entities.Segment.bulkCreate(bulkData);
              totalAffected += bulkData.length;
              console.log(`[AI_EXEC] Legacy session[${i}]: ${bulkData.length} inline segments bulk-created`);
            }
          }
        }
        // ── LEGACY COMPAT: Standalone create_segments (orphan risk — log warning) ──
        else if (action.type === 'create_segments') {
          console.warn(`[AI_EXEC] Legacy create_segments detected — segments may be orphaned without session_id`);
          for (const segmentData of action.create_data || []) {
            const { temp_session_ref: _r, ...cleanSegData } = segmentData;
            const rawSessionId = cleanSegData.session_id;
            const isRealId = rawSessionId && /^[a-f0-9]{24}$/i.test(rawSessionId);
            if (!isRealId) {
              console.warn(`[AI_EXEC] Segment "${cleanSegData.title}" has non-ObjectId session_id="${rawSessionId}" — will be null`);
              delete cleanSegData.session_id;
            }
            if (cleanSegData.segment_type && !VALID_SEGMENT_TYPES.includes(cleanSegData.segment_type)) {
              cleanSegData.segment_type = "Especial";
            }
            await base44.entities.Segment.create(cleanSegData);
            totalAffected++;
          }
        }
        // ── Updates ──
        else if (action.type === 'update_sessions') {
          const targetIds = action.target_ids === 'all' 
            ? sessions.map(s => s.id) 
            : action.target_ids;
          for (const sessionId of targetIds) {
            await base44.entities.Session.update(sessionId, action.changes);
            totalAffected++;
          }
        }
        else if (action.type === 'update_segments') {
          const targetIds = action.target_ids === 'all'
            ? eventSegments.map(s => s.id)
            : action.target_ids;
          for (const segId of targetIds) {
            await base44.entities.Segment.update(segId, action.changes);
            totalAffected++;
          }
        }
        else if (action.type === 'update_event' && event) {
          await base44.entities.Event.update(event.id, action.changes);
          totalAffected++;
        }
      }

      // Improvement #10: Auto-create EventDay records for each unique date in created sessions.
      // Improvement #5: Auto-fill event start_date/end_date if empty.
      const createActions = actionsToExecute.filter(a =>
        a.type === 'create_sessions_with_segments' || a.type === 'create_sessions'
      );
      if (createActions.length > 0 && event) {
        const allDates = createActions
          .flatMap(a => (a.create_data || []).map(s => s.date))
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i) // unique
          .sort();

        // EventDay creation — only for dates that don't already have one
        if (allDates.length > 0) {
          try {
            const existingDays = await base44.entities.EventDay.filter({ event_id: eventId });
            const existingDates = new Set(existingDays.map(d => d.date));
            const newDays = allDates
              .filter(d => !existingDates.has(d))
              .map(d => {
                const dt = new Date(d + 'T12:00:00');
                const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                return { event_id: eventId, date: d, day_of_week: dayNames[dt.getDay()] };
              });
            if (newDays.length > 0) {
              await base44.entities.EventDay.bulkCreate(newDays);
              console.log(`[AI_EXEC] Auto-created ${newDays.length} EventDay records`);
            }
          } catch (edErr) {
            console.warn('[AI_EXEC] EventDay auto-creation failed (non-blocking):', edErr.message);
          }
        }

        // Auto-fill event dates if empty
        if (allDates.length > 0 && (!event.start_date || !event.end_date)) {
          try {
            const updates = {};
            if (!event.start_date) updates.start_date = allDates[0];
            if (!event.end_date) updates.end_date = allDates[allDates.length - 1];
            if (Object.keys(updates).length > 0) {
              await base44.entities.Event.update(event.id, updates);
              console.log(`[AI_EXEC] Auto-filled event dates:`, updates);
            }
          } catch (dateErr) {
            console.warn('[AI_EXEC] Event date auto-fill failed (non-blocking):', dateErr.message);
          }
        }
      }

      setExecutionStatus('success');
      setShowReview(false);
      queryClient.invalidateQueries(['sessions', eventId]);
      queryClient.invalidateQueries({ queryKey: ['eventSegments', eventId], exact: false });
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['eventDays', eventId]);
      
      const actionVerb = actionsToExecute.some(a => a.type.startsWith('create')) 
        ? (language === 'es' ? 'creados' : 'created')
        : (language === 'es' ? 'actualizados' : 'updated');
      toast.success(`${totalAffected} registros ${actionVerb} correctamente`);
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionStatus('error');
      toast.error("Error al aplicar cambios: " + error.message);
    }
  };

  const handleClarificationSelect = async (selectedEvent) => {
    setIsLoadingSourceEvent(true);
    try {
      const sourceSessions = await base44.entities.Session.filter({ event_id: selectedEvent.id });
      const sessionIds = sourceSessions.map(s => s.id);
      const sourceSegments = sessionIds.length > 0 
        ? await base44.entities.Segment.filter({ session_id: { $in: sessionIds } })
        : [];

      setSourceEventData({
        event: { id: selectedEvent.id, name: selectedEvent.name, year: selectedEvent.year },
        sessions: sourceSessions,
        segments: sourceSegments
      });

      await analyzeRequest(userInput, {
        sourceEvent: { id: selectedEvent.id, name: selectedEvent.name, year: selectedEvent.year },
        sourceSessions,
        sourceSegments
      });

      setShowClarification(false);
    } catch (error) {
      console.error('Error loading source event:', error);
      toast.error(language === 'es' ? 'Error al cargar evento' : 'Error loading event');
    } finally {
      setIsLoadingSourceEvent(false);
    }
  };

  const reset = () => {
    setUserInput("");
    setProposedActions(null);
    setQueryResult(null);
    setExecutionStatus(null);
    setShowReview(false);
    setClarificationOptions(null);
    setShowClarification(false);
    setSourceEventData(null);
    setAttachedFileUrl(null);
    setProcessingStep("");
  };

  // Processing step label for UX feedback
  const processingLabel = processingStep === "extracting"
    ? (language === 'es' ? 'Extrayendo datos del archivo...' : 'Extracting data from file...')
    : processingStep === "analyzing"
      ? (language === 'es' ? 'Analizando...' : 'Analyzing...')
      : (language === 'es' ? 'Procesando...' : 'Processing...');

  // Submit is enabled if there's text OR a file attached
  const canSubmit = (userInput.trim().length > 0 || !!attachedFileUrl) && !isProcessing;

  // When the editor is open, hide the parent dialog entirely — user sees only
  // the ScheduleEditor overlay. Prevents the "blank parent behind editor" flash
  // that made it look like processing failed and reverted to Submit. (2026-02-20)
  if (showReview) {
    return (
      <>
        <AIProposalEditor
          isOpen={showReview}
          proposedActions={proposedActions}
          onApprove={(actions) => executeActions(actions, false)}
          onCancel={() => { setShowReview(false); reset(); }}
          isExecuting={executionStatus === 'executing'}
        />
      </>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: '#1F8A70' }} />
            {language === 'es' ? 'Asistente IA para Eventos' : 'Event AI Assistant'}
          </DialogTitle>
          {/* Improvement #8: a11y — DialogDescription to suppress aria-describedby warning */}
          <DialogDescription className="sr-only">
            {language === 'es'
              ? 'Sube un archivo o escribe instrucciones para que la IA genere sesiones y segmentos.'
              : 'Upload a file or type instructions for the AI to generate sessions and segments.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Badge */}
          {event && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg flex-wrap">
              <span className="font-medium">{language === 'es' ? 'Evento' : 'Event'}:</span>
              <Badge variant="outline">{event.name} {event.year}</Badge>
              <span className="text-gray-400">•</span>
              <span>{sessions.length} {language === 'es' ? 'sesiones' : 'sessions'}, {eventSegments.length} {language === 'es' ? 'segmentos' : 'segments'}</span>
            </div>
          )}

          {/* Input Area — hidden when AI returned results or execution succeeded */}
          {!proposedActions && !queryResult && executionStatus !== 'success' && (
            <div className="space-y-3">
              <AIFileUploadZone
                onFileUploaded={(url) => setAttachedFileUrl(url)}
                disabled={isProcessing}
              />

              <Textarea
                ref={textareaRef}
                placeholder={language === 'es' 
                  ? attachedFileUrl
                    ? "(Opcional) Agrega instrucciones adicionales, o envía directamente para crear sesiones del archivo"
                    : "Pregunta o solicita cambios. Ejemplos:\n• ¿Qué sesiones tienen traducción?\n• Cambiar todas las sesiones a traducción en persona"
                  : attachedFileUrl
                    ? "(Optional) Add extra instructions, or submit directly to create sessions from the file"
                    : "Ask a question or request changes. Examples:\n• What sessions have translation?\n• Change all sessions to in-person translation"}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={attachedFileUrl ? 2 : 4}
                className="resize-none"
              />

              <div className="flex justify-end">
                <Button 
                  onClick={() => analyzeRequest()} 
                  disabled={!canSubmit}
                  style={tealStyle}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {processingLabel}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {language === 'es' ? 'Enviar' : 'Submit'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Query Results */}
          {queryResult && executionStatus !== 'success' && (
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">
                  {language === 'es' ? 'Respuesta' : 'Answer'}:
                </h4>
                <p className="text-blue-800">{queryResult.understood_request}</p>
              </Card>

              {queryResult.query_result?.summary && (
                <Card className="p-4 bg-white border-gray-200">
                  <p className="text-gray-800 font-medium mb-3">{queryResult.query_result.summary}</p>
                  
                  {queryResult.query_result.details?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {queryResult.query_result.details.map((detail, idx) => (
                        <div key={idx} className="border-l-2 pl-3 py-1" style={{ borderColor: '#1F8A70' }}>
                          <div className="font-semibold text-gray-900">{detail.title}</div>
                          <div className="text-sm text-gray-700">{detail.info}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              <Button variant="outline" onClick={reset} className="w-full">
                <Undo2 className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Nueva Consulta' : 'New Query'}
              </Button>
            </div>
          )}

          {/* Note: Proposed actions now open the interactive editor directly (showReview=true).
              No intermediate "Review Changes" button needed. */}

          {/* Success State */}
          {executionStatus === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {language === 'es' ? '¡Cambios Aplicados!' : 'Changes Applied!'}
              </h3>
              <p className="text-gray-600 mb-6">
                {proposedActions?.actions?.reduce((sum, a) => sum + (a.affected_count || 0), 0)} {language === 'es' ? 'registros actualizados' : 'records updated'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={reset}>
                  {language === 'es' ? 'Nueva Solicitud' : 'New Request'}
                </Button>
                <Button onClick={onClose}>
                  {language === 'es' ? 'Cerrar' : 'Close'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Note: AIProposalEditor is rendered at the top level when showReview=true,
            so the parent dialog is fully hidden and the user sees only the editor. */}

        {/* Event Clarification Picker */}
        <EventClarificationPicker
          isOpen={showClarification}
          options={clarificationOptions}
          onSelect={handleClarificationSelect}
          onCancel={() => setShowClarification(false)}
          isLoading={isLoadingSourceEvent}
        />
      </DialogContent>
    </Dialog>
  );
}