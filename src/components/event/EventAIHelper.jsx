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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, CheckCircle2, AlertCircle, Loader2, X, ChevronRight, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/utils/i18n";
import { validateAIActions, formatValidationForDisplay } from "@/components/utils/segmentValidation";
import AIProposalReview from "@/components/event/AIProposalReview";

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
  const [validation, setValidation] = useState(null);
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

  const { data: segments = [] } = useQuery({
    queryKey: ['allSegments'],
    queryFn: () => base44.entities.Segment.list(),
    enabled: !!eventId
  });

  const eventSegments = segments.filter(seg => 
    sessions.some(s => s.id === seg.session_id)
  );

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
              description: "Sessions/sections found in the document, in chronological order",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Session name derived from section labels (e.g. 'Sección 1 — Viernes 13 de marzo'). MUST NOT be empty." },
                  date: { type: "string", description: "Date if found (YYYY-MM-DD)" },
                  start_time: { type: "string", description: "Earliest time in session (HH:MM 24h)" },
                  end_time: { type: "string", description: "Latest end time in session (HH:MM 24h)" },
                  segments: {
                    type: "array",
                    description: "Time blocks within this session, in order",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        type_hint: { type: "string", description: "Best guess: worship, sermon, break, lunch, registration, arts, drama, dance, prayer, video, announcements, MC, offering, welcome, panel, closing, special, other" },
                        start_time: { type: "string", description: "HH:MM 24h if visible" },
                        duration_min: { type: "number", description: "Duration in minutes if stated or calculable" },
                        presenter: { type: "string", description: "Speaker/leader name if listed" },
                        message_title: { type: "string", description: "Sermon/message title if this is a sermon" },
                        notes: { type: "string", description: "Any extra details from the document" }
                      }
                    }
                  }
                }
              }
            },
            event_name: { type: "string", description: "Event name if found in document" },
            event_dates: { type: "string", description: "Date range if found" },
            event_location: { type: "string", description: "Venue if found" },
            raw_notes: { type: "string", description: "Any other important info from the document" }
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

      const fileSection = hasExtractedData
        ? `\n## EXTRACTED SCHEDULE DATA (from uploaded file)\n${JSON.stringify(extractedSchedule, null, 2)}\n\nMap this to create_sessions + create_segments actions. Use type_hint→segment_type mapping below.`
        : attachedFileUrl
          ? `\n## ATTACHED FILE\nAnalyze the attached file and extract sessions/segments from it.`
          : '';

      const userInstruction = finalInput.trim()
        ? `"${finalInput}"`
        : hasExtractedData
          ? '"Create sessions and segments from the uploaded schedule"'
          : '"Analyze the attached file and create sessions and segments"';

      // Step 2: Lean LLM prompt (cut from ~5000 tokens to ~1500)
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
- create_sessions: New sessions. Include temp_session_ref for cross-referencing.
- create_segments: New segments. Use temp_session_ref to link to new sessions. MUST come AFTER create_sessions.
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
{"request_type":"query"|"action","type":"ask_event_clarification"(optional),"understood_request":"...","message":"...(if clarification)","options":[...],"query_result":{"summary":"...","details":[{"title":"...","info":"..."}]},"actions":[{"type":"create_sessions|update_sessions|create_segments|update_segments|update_event","description":"...","target_ids":["id"]|"all","create_data":[{...}],"changes":{...},"affected_count":N}],"warnings":[...],"requires_confirmation":true}`,
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
        const validationResult = validateAIActions(response.actions || []);
        setValidation(validationResult);
        setProposedActions(response);
        if (!validationResult.isValid || validationResult.warnings.length > 0) {
          setShowReview(true);
        }
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error(language === 'es' ? "Error al analizar la solicitud" : "Error analyzing request");
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

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
      // Session reference map: multiple keys → real session ID
      // Keys include: temp_session_ref, name, session_N (0-based and 1-based), normalized variants
      const sessionRefMap = {};
      // Ordered list of created session IDs for index-based fallback
      const createdSessionIds = [];

      // Normalize helper: lowercase, collapse whitespace, strip dashes/accents for fuzzy match
      const normalizeRef = (s) => (s || '').trim().toLowerCase()
        .replace(/[\u2014\u2013\u2012\u2011\u2010—–-]+/g, '-') // normalize all dash types
        .replace(/\s+/g, ' ');
      
      for (const action of actionsToExecute) {
        if (action.type === 'create_sessions') {
          for (let i = 0; i < (action.create_data || []).length; i++) {
            const sessionData = action.create_data[i];
            const tempRef = sessionData.temp_session_ref || sessionData.name || `session_${i}`;
            const { temp_session_ref, ...cleanData } = sessionData;
            // Ensure session always has a name (required field)
            if (!cleanData.name) {
              cleanData.name = `Sesión ${i + 1}`;
            }
            const newSession = await base44.entities.Session.create({
              event_id: eventId,
              ...cleanData
            });
            const sid = newSession.id;
            createdSessionIds.push(sid);

            // Register all possible keys for this session
            sessionRefMap[tempRef] = sid;
            sessionRefMap[normalizeRef(tempRef)] = sid;
            sessionRefMap[`session_${i}`] = sid;
            if (sessionData.name) {
              sessionRefMap[sessionData.name] = sid;
              sessionRefMap[normalizeRef(sessionData.name)] = sid;
            }
            if (temp_session_ref && temp_session_ref !== tempRef) {
              sessionRefMap[temp_session_ref] = sid;
              sessionRefMap[normalizeRef(temp_session_ref)] = sid;
            }

            console.log(`[AI_EXEC] Session ${i} created: id=${sid}, keys=[${tempRef}]`);
            totalAffected++;
          }
        }
        else if (action.type === 'update_sessions') {
          const targetIds = action.target_ids === 'all' 
            ? sessions.map(s => s.id) 
            : action.target_ids;
          if (targetIds.length === 0) throw new Error('No se encontraron sesiones para actualizar');
          for (const sessionId of targetIds) {
            await base44.entities.Session.update(sessionId, action.changes);
            totalAffected++;
          }
        }
        else if (action.type === 'create_segments') {
          for (const segmentData of action.create_data || []) {
            let resolvedSessionId = segmentData.session_id;
            const ref = segmentData.temp_session_ref;

            // 1) Exact match on temp_session_ref
            if (ref && sessionRefMap[ref]) {
              resolvedSessionId = sessionRefMap[ref];
            }
            // 2) Normalized match on temp_session_ref
            if (!resolvedSessionId && ref) {
              const normRef = normalizeRef(ref);
              if (sessionRefMap[normRef]) {
                resolvedSessionId = sessionRefMap[normRef];
              }
            }
            // 3) If session_id looks like a temp ref, resolve it
            if (!resolvedSessionId && segmentData.session_id && sessionRefMap[segmentData.session_id]) {
              resolvedSessionId = sessionRefMap[segmentData.session_id];
            }
            // 4) Index-based fallback: extract "Sección N" or "Session N" number → use Nth created session
            if (!resolvedSessionId && ref) {
              const numMatch = ref.match(/(?:secci[oó]n|session|seccion)\s*(\d+)/i);
              if (numMatch) {
                const idx = parseInt(numMatch[1]) - 1; // 0-based
                if (idx >= 0 && idx < createdSessionIds.length) {
                  resolvedSessionId = createdSessionIds[idx];
                  console.log(`[AI_EXEC] Segment ref="${ref}" resolved via index fallback → session index ${idx}`);
                }
              }
            }

            if (!resolvedSessionId) {
              console.warn(`[AI_EXEC] Could not resolve session for segment "${segmentData.title}", ref="${ref}". sessionRefMap keys:`, Object.keys(sessionRefMap));
            }

            const { temp_session_ref, ...cleanSegData } = segmentData;
            const validTypes = ["Alabanza","Bienvenida","Ofrenda","Plenaria","Video","Anuncio","Dinámica","Break","TechOnly","Oración","Especial","Cierre","MC","Ministración","Receso","Almuerzo","Artes","Breakout","Panel"];
            if (cleanSegData.segment_type && !validTypes.includes(cleanSegData.segment_type)) {
              cleanSegData.segment_type = "Especial";
            }
            await base44.entities.Segment.create({
              ...cleanSegData,
              session_id: resolvedSessionId
            });
            totalAffected++;
          }
        }
        else if (action.type === 'update_segments') {
          const targetIds = action.target_ids === 'all'
            ? eventSegments.map(s => s.id)
            : action.target_ids;
          if (targetIds.length === 0) throw new Error('No se encontraron segmentos para actualizar');
          for (const segmentId of targetIds) {
            await base44.entities.Segment.update(segmentId, action.changes);
            totalAffected++;
          }
        }
        else if (action.type === 'update_event' && event) {
          await base44.entities.Event.update(event.id, action.changes);
          totalAffected++;
        }
      }

      setExecutionStatus('success');
      setShowReview(false);
      queryClient.invalidateQueries(['sessions', eventId]);
      queryClient.invalidateQueries(['allSegments']);
      queryClient.invalidateQueries(['event', eventId]);
      
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
    setValidation(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: '#1F8A70' }} />
            {language === 'es' ? 'Asistente IA para Eventos' : 'Event AI Assistant'}
          </DialogTitle>
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

          {/* Input Area */}
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

          {/* Proposed Actions */}
          {proposedActions && executionStatus !== 'success' && !showReview && (
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">
                  {language === 'es' ? 'Entendí tu solicitud' : 'I understood your request'}:
                </h4>
                <p className="text-blue-800">{proposedActions.understood_request}</p>
              </Card>

              <Button 
                onClick={() => setShowReview(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Revisar Cambios' : 'Review Changes'}
              </Button>

              <Button variant="outline" onClick={reset} className="w-full">
                <Undo2 className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
            </div>
          )}

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

        {/* Review Modal */}
        <AIProposalReview
          isOpen={showReview}
          proposedActions={proposedActions}
          validation={validation}
          onApprove={executeActions}
          onCancel={() => { setShowReview(false); reset(); }}
          isExecuting={executionStatus === 'executing'}
        />

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