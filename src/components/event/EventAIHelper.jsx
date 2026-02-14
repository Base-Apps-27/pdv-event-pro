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
import VoiceInputButton from "@/components/event/VoiceInputButton";
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
  const [proposedActions, setProposedActions] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null); // null, 'executing', 'success', 'error'
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
        .map(e => ({
          id: e.id,
          name: e.name,
          year: e.year,
          session_count: 0
        }))
        .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 60,
    enabled: isOpen
  });

  const analyzeRequest = async (inputText = null, sourceEventContext = null) => {
    const finalInput = inputText || userInput;
    if (!finalInput.trim()) return;

    setIsProcessing(true);
    setProposedActions(null);
    setQueryResult(null);

    try {
      const contextSummary = {
        event: event ? { 
          id: event.id, 
          name: event.name, 
          year: event.year, 
          location: event.location,
          start_date: event.start_date,
          end_date: event.end_date,
          theme: event.theme
        } : null,
        sessions: sessions.map(s => ({ 
          id: s.id, 
          name: s.name, 
          date: s.date,
          planned_start_time: s.planned_start_time,
          planned_end_time: s.planned_end_time,
          location: s.location,
          presenter: s.presenter,
          session_color: s.session_color,
          is_translated_session: s.is_translated_session,
          translation_team: s.translation_team,
          sound_team: s.sound_team,
          tech_team: s.tech_team,
          coordinators: s.coordinators,
          admin_team: s.admin_team,
          ushers_team: s.ushers_team,
          hospitality_team: s.hospitality_team,
          photography_team: s.photography_team,
          worship_leader: s.worship_leader,
          lights_team: s.lights_team,
          video_team: s.video_team,
          notes: s.notes
        })),
        segments: eventSegments.map(seg => ({
          id: seg.id,
          title: seg.title,
          session_id: seg.session_id,
          segment_type: seg.segment_type,
          start_time: seg.start_time,
          duration_min: seg.duration_min,
          presenter: seg.presenter,
          requires_translation: seg.requires_translation,
          translation_mode: seg.translation_mode,
          translator_name: seg.translator_name,
          room_id: seg.room_id,
          major_break: seg.major_break,
          color_code: seg.color_code,
          show_in_general: seg.show_in_general,
          show_in_projection: seg.show_in_projection,
          show_in_sound: seg.show_in_sound,
          show_in_ushers: seg.show_in_ushers,
          message_title: seg.message_title,
          panel_moderators: seg.panel_moderators,
          panel_panelists: seg.panel_panelists,
          presentation_url: seg.presentation_url,
          notes_url: seg.notes_url,
          has_video: seg.has_video,
          stage_call_offset_min: seg.stage_call_offset_min
        }))
      };

      // Build event index context for LLM
      const availableEventsStr = eventIndex.length > 0
        ? eventIndex.map(e => `${e.name} (${e.year})`).slice(0, 10).join(', ')
        : 'None';

      // Add source event context if user selected one
      const sourceEventStr = sourceEventContext
        ? `\n\nSOURCE EVENT CONTEXT (user selected):\nEvent: ${sourceEventContext.sourceEvent.name} (${sourceEventContext.sourceEvent.year})\nSessions: ${sourceEventContext.sourceSessions.length}\nSegments: ${sourceEventContext.sourceSegments.length}`
        : '';

      // Build file_urls array if user attached a file
      const fileUrls = attachedFileUrl ? [attachedFileUrl] : undefined;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant helping manage church event data. You can either QUERY information or PROPOSE actions.

## CURRENT EVENT CONTEXT
${JSON.stringify(contextSummary, null, 2)}

## AVAILABLE EVENTS (last 2 years, for reference)
${availableEventsStr}${sourceEventStr}

## USER REQUEST
"${finalInput}"

${attachedFileUrl ? `## ATTACHED FILE
The user has attached a PDF or image file. Analyze its content carefully.
If it contains a schedule/program/itinerary, extract ALL sessions and segments from it.
- Map each time block to the correct segment_type (Alabanza, Plenaria, Artes, Bienvenida, Ofrenda, Dinámica, Break, Receso, Almuerzo, Panel, MC, Ministración, Cierre, Especial, Oración, TechOnly, Video, Anuncio).
- Use exact times from the document in HH:MM 24-hour format.
- Extract presenter/speaker names when available.
- For Plenaria segments, extract the message_title from the document.
- For Artes segments with a song name, set the title to include it.
- Group segments by "Sección" / "Session" / day as separate sessions.
- Calculate duration_min from start times of consecutive segments (or use durations if explicitly stated).
- For the last segment of a session where duration isn't clear, estimate based on context (30 min is a safe default).
- IMPORTANT: Times and durations from preliminary documents may not be 100% accurate. Do your best to extract what's there, but don't worry about perfect alignment — admins will review and adjust. Use reasonable estimates when exact times are unclear. If a segment's start_time can't be determined, omit it (admin will set it later). If duration_min can't be determined, estimate based on segment type (e.g., Alabanza ~30min, Plenaria ~45min, Break ~15min, Receso ~10min, Almuerzo ~60min).
- Use the event's existing start_date/end_date to set session dates. If not set, use dates from the document.
- Set session planned_start_time to the first segment's time and planned_end_time to the last segment's end (estimate if unclear).
- Set color_code: worship for Alabanza/Ministración, preach for Plenaria, break for Break/Receso/Almuerzo, special for Artes/Especial, default for others.
- If any segment type doesn't cleanly map to the enum, use the closest match or "Especial" as fallback.
- Mark Almuerzo segments as major_break: true.
- IMPORTANT: Always create both sessions AND their segments in the correct order. Use order field (1, 2, 3...) for proper sequencing.
- Leave team assignments, notes, and other instance fields blank — they'll be filled later.
- For fields you cannot determine from the document, leave them blank or use "[TBD]" for presenter if not specified.
` : ''}

## YOUR TASK
First, determine if this is a QUERY (asking for information) or an ACTION (requesting changes).

### For QUERIES (asking for information):
Return information in a structured, readable format. Be comprehensive and pull relevant data from the event context.

### For ACTIONS (requesting changes):
1. Understand what the user wants to change.
2. **CRITICAL DECISION**: Does the user want to CREATE NEW records or UPDATE EXISTING records?
   - If creating NEW sessions/segments that don't exist yet → use create_sessions or create_segments
   - If modifying EXISTING sessions/segments → use update_sessions or update_segments
3. Propose specific actions to accomplish it.
4. Be precise about which records will be affected.
5. CRITICAL: Always infer the correct field and its specific meaning based on context. Use the detailed schema below.

## SUPPORTED ACTION TYPES
- create_sessions: Create new sessions (provide full session data including event_id, name, date, times). You may include a "temp_session_ref" field (e.g. "session_1") for cross-referencing in create_segments.
- update_sessions: Update existing session fields
- create_segments: Create new segments (provide full segment data including session_id, title, segment_type, times). If creating segments for sessions that are also being created in this same request, set "temp_session_ref" to match the session's temp_session_ref instead of session_id. The system will resolve it after session creation. IMPORTANT: Always put create_sessions BEFORE create_segments in the actions array.
- update_segments: Update existing segment fields
- update_event: Update event fields

## DETAILED SCHEMA KNOWLEDGE

### Event Fields
- name: (string) Full event name
- theme: (string) Event theme or motto
- location: (string) Physical venue
- status: (enum) "planning", "confirmed", "in_progress", "completed", "archived"
- print_color: (enum) "green", "blue", "pink", "orange", "yellow", "purple", "red", "teal", "charcoal"
- start_date: (string) "YYYY-MM-DD"
- end_date: (string) "YYYY-MM-DD"
- description: (string) General event description

### Session Fields
- name: (string) Session name (e.g., "Sección 1")
- date: (string) Session date "YYYY-MM-DD"
- planned_start_time, planned_end_time: (string) "HH:MM"
- location: (string) Specific location for session
- presenter: (string) Main presenter/speaker
- session_color: (enum) "green", "blue", "pink", "orange", "yellow", "purple", "red"
- is_translated_session: (boolean) Session requires translation
- translation_team: (string) Translation team members
- sound_team: (string) Sound team members
- tech_team: (string) Technical/video/lights team members
- coordinators: (string) Session coordinators
- admin_team: (string) Administration team members
- ushers_team: (string) Ushers/hospitality team
- hospitality_team: (string) Hospitality team members
- photography_team: (string) Photography/media team members
- worship_leader: (string) Worship leader name
- lights_team: (string) Lights team members
- video_team: (string) Video/broadcast team members
- notes: (string) General session notes

### Segment Fields (CRITICAL - varies by segment_type)
- title: (string) Main title
- segment_type: (enum) "Alabanza", "Plenaria", "Bienvenida", "Ofrenda", "Video", "Anuncio", "Dinámica", "Break", "Artes", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Oración", "Especial", "TechOnly", "Breakout", "Panel"
- start_time: (string) "HH:MM"
- duration_min: (number) Duration in minutes
- presenter: (string) Speaker/leader name
- description_details: (string) Detailed description or panel details
- prep_instructions: (string) Preparation instructions (setup, checks, etc.)
- requires_translation: (boolean) Segment needs translation
- translation_mode: (enum) "InPerson" or "RemoteBooth"
- translator_name: (string) Translator name
- translation_notes: (string) Translation booth instructions
- projection_notes: (string) Instructions for projection team
- sound_notes: (string) Instructions for sound team
- ushers_notes: (string) Instructions for ushers/hospitality
- stage_decor_notes: (string) Instructions for stage & decor team
- other_notes: (string) Additional notes
- microphone_assignments: (string) Microphone assignments
- room_id: (string) Reference to Room entity for this segment
- stage_call_offset_min: (number) Minutes before start for team arrival
- major_break: (boolean) True for major breaks (lunch, dinner)
- show_in_general: (boolean, default true) Show in general program
- show_in_projection: (boolean, default true) Show in projection view
- show_in_sound: (boolean, default true) Show in sound view
- show_in_ushers: (boolean, default true) Show in ushers view
- color_code: (enum) "worship", "preach", "break", "tech", "special", "default"

#### Type-Specific Fields:

**segment_type="Plenaria" (Sermons/Messages):**
- message_title: (string) Sermon title
- scripture_references: (string) Bible references
- description_details: (string) Panel details or summary
- presentation_url: (string) Link to presentation slides
- notes_url: (string) Link to speaker notes (PDF/Doc) for media team
- content_is_slides_only: (boolean) If true, slides replace verses

**segment_type="Panel":**
- panel_moderators: (string) Names of panel moderator(s)
- panel_panelists: (string) Names of panelist(s)
- description_details: (string) Panel topic description

**segment_type="Alabanza" (Worship/Songs):**
CRITICAL: When user mentions song titles, map to these fields:
- number_of_songs: (number, 1-6) Count of songs
- song_1_title, song_2_title, song_3_title, song_4_title, song_5_title, song_6_title: (string) Individual song titles
- song_1_lead, song_2_lead, song_3_lead, song_4_lead, song_5_lead, song_6_lead: (string) Lead vocalist per song
- song_1_key, song_2_key, song_3_key, song_4_key, song_5_key, song_6_key: (string) Musical key per song

**segment_type="Artes" (Arts/Drama/Dance):**
- art_types: (array) ["DANCE", "DRAMA", "VIDEO", "OTHER"]
- drama_handheld_mics, drama_headset_mics: (number) Mic counts
- drama_start_cue, drama_end_cue: (string) Cues
- drama_has_song: (boolean) Does the drama include a song
- drama_song_title: (string) Title of song 1 in drama
- drama_song_source: (string) URL/link to song 1 in drama
- drama_song_owner: (string) Owner of song 1 in drama
- drama_song_2_title, drama_song_2_url, drama_song_2_owner: (string) Song 2 details
- drama_song_3_title, drama_song_3_url, drama_song_3_owner: (string) Song 3 details
- dance_has_song: (boolean) Does the dance include a song
- dance_song_title: (string) Title of song 1 for dance
- dance_song_source: (string) URL/link to song 1 for dance
- dance_song_owner: (string) Owner of song 1 for dance
- dance_song_2_title, dance_song_2_url, dance_song_2_owner: (string) Dance song 2 details
- dance_song_3_title, dance_song_3_url, dance_song_3_owner: (string) Dance song 3 details
- dance_handheld_mics, dance_headset_mics: (number) Mic counts for dance
- dance_start_cue, dance_end_cue: (string) Dance cues
- art_other_description: (string) Description for other art type
- arts_run_of_show_url: (string) Link to arts run of show PDF

**segment_type="Video":**
- has_video: (boolean) Always true
- video_name: (string) Name of the video
- video_location: (string) Location/path of the video file (flash drive, folder)
- video_owner: (string) Owner or source of the video
- video_length_sec: (number) Duration in seconds
- video_url: (string) Direct link to video file or streaming URL

**segment_type="Anuncio" (Announcements):**
- announcement_series_id: (string) AnnouncementSeries ID
- announcement_title: (string) Announcement title
- announcement_description: (string) Full description/script for announcement
- announcement_date: (string) Relevant date "YYYY-MM-DD"
- announcement_tone: (string) Tone guideline (e.g., Energetic, Serious, Informative)

**segment_type="Breakout":**
- breakout_rooms: (array of objects) Room configs with:
  - room_id: (string) Reference to Room
  - hosts: (string) Moderator/facilitator names
  - speakers: (string) Speaker/panelist names
  - topic: (string) Topic or title for this breakout
  - general_notes: (string) General production notes
  - other_notes: (string) Other specific instructions
  - requires_translation: (boolean) Does this room require translation
  - translation_mode: (enum) "InPerson" or "RemoteBooth"
  - translator_name: (string) Translator name for this room

**segment_type="Break" / "Receso" / "Almuerzo":**
- major_break: (boolean) True for major breaks (lunch, dinner)
- description_details: (string) Break instructions

**ANY segment with a video (even non-Video type):**
- has_video: (boolean) Set true if segment includes a video
- video_name, video_location, video_owner, video_url: (string) Video details

**ANY segment with presentation content:**
- presentation_url: (string) Link to slides/presentation
- notes_url: (string) Link to speaker notes PDF/Doc
- content_is_slides_only: (boolean) If true, presentation replaces verses

### Segment Actions (within segment.segment_actions array)
- label: (string) Short description (e.g., "A&A sube", "MC entra")
- department: (enum) "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Kids", "Coordinador", "Stage & Decor", "Alabanza", "Translation", "Other"
- timing: (enum) "before_start", "after_start", "before_end", "absolute"
- offset_min: (number) Minutes offset from timing reference point
- absolute_time: (string) "HH:MM" — only used when timing is "absolute"
- is_prep: (boolean) True if preparation task (before segment), false if in-segment cue
- is_required: (boolean) True if mandatory action
- notes: (string) Additional details or instructions

## PARSING EXAMPLES

**"Create 3 sessions, Friday PM, Saturday AM, Saturday PM"** (NO SESSIONS EXIST YET)
→ type: "create_sessions"
→ create_data: [
  { name: "Viernes PM", date: "2026-06-12", planned_start_time: "19:00" },
  { name: "Sábado AM", date: "2026-06-13", planned_start_time: "09:00" },
  { name: "Sábado PM", date: "2026-06-13", planned_start_time: "19:00" }
]

**"Change worship songs in Session 2 to El Es, Su Vida, and He Is"** (SESSION 2 EXISTS)
→ type: "update_segments"
→ Find Alabanza segment in Session 2
→ changes: { number_of_songs: 3, song_1_title: "El Es", song_2_title: "Su Vida", song_3_title: "He Is" }

**"Set Juan as translator for all Plenaria segments"** (SEGMENTS EXIST)
→ type: "update_segments"
→ Filter segments where segment_type="Plenaria"
→ changes: { translator_name: "Juan", requires_translation: true }

**"Update sound team to Rick for all sessions"** (SESSIONS EXIST)
→ type: "update_sessions"
→ target_ids: "all" sessions
→ changes: { sound_team: "Rick" }

**"Add a panel segment with moderator Ana and panelists Pedro, Maria, Jose"** (SESSION EXISTS)
→ type: "create_segments"
→ create_data: [{ session_id: "...", title: "Panel", segment_type: "Panel", panel_moderators: "Ana", panel_panelists: "Pedro, Maria, Jose" }]

**"Hide all Break segments from the projection view"** (SEGMENTS EXIST)
→ type: "update_segments"
→ Filter segments where segment_type="Break"
→ changes: { show_in_projection: false }

**"Mark all Almuerzo segments as major break"**
→ type: "update_segments"
→ Filter segments where segment_type="Almuerzo"
→ changes: { major_break: true }

**"Set session color to green for all Saturday sessions"**
→ type: "update_sessions"
→ Filter sessions by date matching Saturday
→ changes: { session_color: "green" }

**"Add presentation slides link for the Plenaria in Session 3"**
→ type: "update_segments"
→ Find Plenaria in Session 3
→ changes: { presentation_url: "https://..." }

**"Set stage call offset to 20 minutes for all Alabanza segments"**
→ type: "update_segments"
→ Filter segments where segment_type="Alabanza"
→ changes: { stage_call_offset_min: 20 }

**"Add a drama segment with 3 handheld mics, start cue is 'lights dim', end cue is 'applause'"**
→ type: "create_segments"
→ create_data: [{ session_id: "...", title: "Drama", segment_type: "Artes", art_types: ["DRAMA"], drama_handheld_mics: 3, drama_start_cue: "lights dim", drama_end_cue: "applause" }]

**"Set photography team to Maria for sessions 1 and 2"**
→ type: "update_sessions"
→ target_ids: [session1_id, session2_id]
→ changes: { photography_team: "Maria" }

**FROM AN ATTACHED PDF/IMAGE with schedule "Sección 1 Viernes, Sección 2 Sábado AM, etc."**
→ actions: [
  { type: "create_sessions", create_data: [
    { name: "Sección 1 — Viernes PM", temp_session_ref: "session_1", date: "2026-03-13", planned_start_time: "17:30", planned_end_time: "21:30", order: 1 },
    { name: "Sección 2 — Sábado AM", temp_session_ref: "session_2", date: "2026-03-14", planned_start_time: "08:00", planned_end_time: "13:40", order: 2 }
  ]},
  { type: "create_segments", create_data: [
    { temp_session_ref: "session_1", title: "Registración", segment_type: "TechOnly", start_time: "17:30", duration_min: 120, order: 1, color_code: "tech", show_in_general: true },
    { temp_session_ref: "session_1", title: "Alabanza y Adoración", segment_type: "Alabanza", start_time: "19:30", duration_min: 40, order: 2, color_code: "worship" },
    { temp_session_ref: "session_1", title: "Plenaria 1: Autor de La Vida", segment_type: "Plenaria", start_time: "20:30", duration_min: 60, presenter: "A. Tere Paz", message_title: "Autor de La Vida", order: 5, color_code: "preach" }
  ]}
]

## IMPORTANT: HANDLING CROSS-EVENT REFERENCES
If user mentions a past event and you're uncertain which one they mean (< 80% confidence):
- Respond with: {"type": "ask_event_clarification", "message": "Event X or Y?", "options": [{id, name, year}, ...]}
- Provide up to 3 best-guess options using fuzzy matching on available events
- Do NOT proceed with action until user clarifies

## RESPONSE FORMAT (JSON only)
{
  "request_type": "query" | "action",
  "type": "ask_event_clarification" (optional, if asking for clarification),
  "understood_request": "Brief summary",
  "message": "Question for user (if type=ask_event_clarification)",
  "options": [{id, name, year}, ...] (if type=ask_event_clarification),
  "query_result": { "summary": "...", "details": [...] },
  "actions": [{
    "type": "create_sessions" | "update_sessions" | "create_segments" | "update_segments" | "update_event",
    "description": "Human readable",
    "target_ids": ["id1"] or "all" (only for updates),
    "create_data": [{ full object }] (only for creates),
    "changes": { "field_name": "value" } (only for updates),
    "affected_count": number
  }],
  "warnings": ["..."],
  "requires_confirmation": true
}`,
        ...(fileUrls ? { file_urls: fileUrls } : {}),
        response_json_schema: {
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
                details: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      info: { type: "string" }
                    }
                  }
                }
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
        }
      });

      if (response.request_type === 'query') {
        setQueryResult(response);
      } else if (response.type === 'ask_event_clarification') {
        // AI is asking which event the user meant
        // Use fuzzy search to find best matches and let user pick
        const matches = fuzzySearchEvents(eventIndex, response.message || '');
        setClarificationOptions(matches.length > 0 ? matches : response.options || []);
        setShowClarification(true);
      } else {
        // Validate actions before showing confirmation
        const validationResult = validateAIActions(response.actions || []);
        setValidation(validationResult);
        setProposedActions(response);
        
        // Auto-show review if there are warnings/errors
        if (!validationResult.isValid || validationResult.warnings.length > 0) {
          setShowReview(true);
        }
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Error al analizar la solicitud");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeActions = async (actions = null, isDraft = false) => {
    const actionsToExecute = actions || proposedActions?.actions;
    if (!actionsToExecute?.length) return;

    // Allow execution if draft mode or validation passes
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
      // Track session name → new ID mapping for cross-action references
      // When AI creates sessions + segments from a PDF, segments reference session
      // by temp_session_ref (e.g. "session_1") which must be resolved after creation.
      const sessionRefMap = {};
      
      for (const action of actionsToExecute) {
        if (action.type === 'create_sessions') {
          // Create new sessions and build reference map
          for (let i = 0; i < (action.create_data || []).length; i++) {
            const sessionData = action.create_data[i];
            // Extract temp ref before creating (AI may set temp_session_ref for cross-referencing)
            const tempRef = sessionData.temp_session_ref || sessionData.name || `session_${i}`;
            const { temp_session_ref, ...cleanData } = sessionData;
            const newSession = await base44.entities.Session.create({
              event_id: eventId,
              ...cleanData
            });
            // Map multiple keys to the same new session ID for flexible resolution
            sessionRefMap[tempRef] = newSession.id;
            sessionRefMap[`session_${i}`] = newSession.id;
            sessionRefMap[`session_${i + 1}`] = newSession.id;
            if (sessionData.name) sessionRefMap[sessionData.name] = newSession.id;
            totalAffected++;
          }
        }
        else if (action.type === 'update_sessions') {
          const targetIds = action.target_ids === 'all' 
            ? sessions.map(s => s.id) 
            : action.target_ids;
          
          if (targetIds.length === 0) {
            throw new Error(`No se encontraron sesiones para actualizar`);
          }
          
          for (const sessionId of targetIds) {
            await base44.entities.Session.update(sessionId, action.changes);
            totalAffected++;
          }
        }
        else if (action.type === 'create_segments') {
          // Create new segments, resolving temp session refs from sessionRefMap
          for (const segmentData of action.create_data || []) {
            let resolvedSessionId = segmentData.session_id;
            // Resolve temp_session_ref → real session ID
            if (segmentData.temp_session_ref && sessionRefMap[segmentData.temp_session_ref]) {
              resolvedSessionId = sessionRefMap[segmentData.temp_session_ref];
            }
            // Also try to resolve session_id if it looks like a temp ref
            if (resolvedSessionId && sessionRefMap[resolvedSessionId]) {
              resolvedSessionId = sessionRefMap[resolvedSessionId];
            }
            const { temp_session_ref, ...cleanSegData } = segmentData;
            // Auto-correct invalid segment_type to "Especial" (PDF parsing may produce unexpected labels)
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
          
          if (targetIds.length === 0) {
            throw new Error(`No se encontraron segmentos para actualizar`);
          }
          
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
      const message = language === 'es' 
        ? `${totalAffected} registros ${actionVerb} correctamente`
        : `${totalAffected} records ${actionVerb} successfully`;
      toast.success(message);
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionStatus('error');
      toast.error("Error al aplicar cambios: " + error.message);
    }
  };

  const handleClarificationSelect = async (selectedEvent) => {
    setIsLoadingSourceEvent(true);
    try {
      // Fetch source event's sessions and segments
      const sessions = await base44.entities.Session.filter({ event_id: selectedEvent.id });
      const sessionIds = sessions.map(s => s.id);
      const segments = sessionIds.length > 0 
        ? await base44.entities.Segment.filter({ session_id: { $in: sessionIds } })
        : [];

      setSourceEventData({
        event: { id: selectedEvent.id, name: selectedEvent.name, year: selectedEvent.year },
        sessions,
        segments
      });

      // Re-run analysis with source event context
      await analyzeRequest(userInput, {
        sourceEvent: { id: selectedEvent.id, name: selectedEvent.name, year: selectedEvent.year },
        sourceSessions: sessions,
        sourceSegments: segments
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
  };

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
              {/* File Upload Zone — PDFs and images */}
              <AIFileUploadZone
                onFileUploaded={(url) => setAttachedFileUrl(url)}
                disabled={isProcessing}
              />

              <Textarea
                ref={textareaRef}
                placeholder={language === 'es' 
                  ? attachedFileUrl
                    ? "Describe qué hacer con el archivo. Ej: 'Crea las sesiones y segmentos de este programa'"
                    : "Pregunta o solicita cambios. Ejemplos:\n\nCONSULTAS:\n• ¿Qué sesiones tienen traducción?\n• ¿Quién presenta los segmentos de Plenaria?\n\nACCIONES:\n• Cambiar todas las sesiones a traducción en persona"
                  : attachedFileUrl
                    ? "Describe what to do with the file. E.g.: 'Create sessions and segments from this program'"
                    : "Ask a question or request changes. Examples:\n\nQUERIES:\n• What sessions have translation?\n• Who presents the Plenaria segments?\n\nACTIONS:\n• Change all sessions to in-person translation"}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={attachedFileUrl ? 3 : 5}
                className="resize-none"
              />

              {/* Voice + Submit Controls */}
              <div className="flex flex-col sm:flex-row gap-2">
                <VoiceInputButton 
                  textareaRef={textareaRef}
                  onTranscriptionComplete={() => {
                    // Update userInput state when voice completes
                    if (textareaRef.current) {
                      setUserInput(textareaRef.current.value);
                    }
                  }}
                />
                <Button 
                  onClick={() => analyzeRequest()} 
                  disabled={!userInput.trim() || isProcessing}
                  style={tealStyle}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === 'es' ? 'Procesando...' : 'Processing...'}
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

              <Button 
                variant="outline" 
                onClick={reset}
                className="w-full"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Nueva Consulta' : 'New Query'}
              </Button>
            </div>
          )}

          {/* Proposed Actions - Show review modal instead */}
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

              <Button 
                variant="outline" 
                onClick={reset}
                className="w-full"
              >
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
          onCancel={() => {
            setShowReview(false);
            reset();
          }}
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