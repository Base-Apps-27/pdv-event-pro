import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, CheckCircle2, AlertCircle, Loader2, X, ChevronRight, Undo2 } from "lucide-react";
import { toast } from "sonner";

export default function EventAIHelper({ eventId, isOpen, onClose }) {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  
  const queryClient = useQueryClient();
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [proposedActions, setProposedActions] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null); // null, 'executing', 'success', 'error'

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

  const analyzeRequest = async () => {
    if (!userInput.trim()) return;
    
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
          is_translated_session: s.is_translated_session,
          translation_team: s.translation_team,
          sound_team: s.sound_team,
          tech_team: s.tech_team,
          coordinators: s.coordinators,
          worship_leader: s.worship_leader
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
          translator_name: seg.translator_name
        }))
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant helping manage church event data. You can either QUERY information or PROPOSE actions.

## CURRENT EVENT CONTEXT
${JSON.stringify(contextSummary, null, 2)}

## USER REQUEST
"${userInput}"

## YOUR TASK
First, determine if this is a QUERY (asking for information) or an ACTION (requesting changes).

### For QUERIES (asking for information):
Return information in a structured, readable format. Be comprehensive and pull relevant data from the event context.

### For ACTIONS (requesting changes):
1. Understand what the user wants to change.
2. Propose specific actions to accomplish it.
3. Be precise about which records will be affected.
4. CRITICAL: Always infer the correct field and its specific meaning based on context. Use the detailed schema below.

## SUPPORTED ACTION TYPES
- update_sessions: Update session fields
- update_segments: Update segment fields
- update_event: Update event fields

## DETAILED SCHEMA KNOWLEDGE

### Event Fields
- name: (string) Full event name
- theme: (string) Event theme or motto
- location: (string) Physical venue
- status: (enum) "planning", "confirmed", "in_progress", "completed", "archived"
- print_color: (enum) "green", "blue", "pink", "orange", "yellow", "purple", "red", "teal", "charcoal"

### Session Fields
- name: (string) Session name (e.g., "Sección 1")
- date: (string) Session date "YYYY-MM-DD"
- planned_start_time, planned_end_time: (string) "HH:MM"
- location: (string) Specific location for session
- presenter: (string) Main presenter/speaker
- is_translated_session: (boolean) Session requires translation
- translation_team, sound_team, tech_team, coordinators, admin_team, ushers_team, hospitality_team, worship_leader: (string) Team member names

### Segment Fields (CRITICAL - varies by segment_type)
- title: (string) Main title
- segment_type: (enum) "Alabanza", "Plenaria", "Bienvenida", "Ofrenda", "Video", "Anuncio", "Dinámica", "Break", "Artes", "Cierre", "MC", etc.
- start_time: (string) "HH:MM"
- duration_min: (number) Duration in minutes
- presenter: (string) Speaker/leader name
- requires_translation: (boolean) Segment needs translation
- translation_mode: (enum) "InPerson" or "RemoteBooth"
- translator_name: (string) Translator name
- projection_notes, sound_notes, ushers_notes, stage_decor_notes, other_notes: (string) Team-specific instructions

#### Type-Specific Fields:

**segment_type="Plenaria" (Sermons/Messages):**
- message_title: (string) Sermon title
- scripture_references: (string) Bible references
- description_details: (string) Panel details

**segment_type="Alabanza" (Worship/Songs):**
CRITICAL: When user mentions song titles, map to these fields:
- number_of_songs: (number, 1-6) Count of songs
- song_1_title, song_2_title, song_3_title, song_4_title, song_5_title, song_6_title: (string) Individual song titles
- song_1_lead, song_2_lead, song_3_lead, song_4_lead, song_5_lead, song_6_lead: (string) Lead vocalist per song

**segment_type="Artes" (Arts/Drama/Dance):**
- art_types: (array) ["DANCE", "DRAMA", "VIDEO", "OTHER"]
- drama_handheld_mics, drama_headset_mics: (number) Mic counts
- drama_start_cue, drama_end_cue: (string) Cues
- dance_song_title, dance_song_source: (string) Song details

**segment_type="Video":**
- has_video: (boolean) Always true
- video_name, video_location, video_owner: (string) Video details
- video_length_sec: (number) Duration in seconds

**segment_type="Anuncio" (Announcements):**
- announcement_series_id: (string) AnnouncementSeries ID
- announcement_title, announcement_description: (string) Override content

**segment_type="Breakout":**
- breakout_rooms: (array of objects) Room configs with room_id, hosts, speakers, topic

### Segment Actions (within segment.segment_actions array)
- label: (string) Short description
- department: (enum) "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Alabanza", "Stage & Decor", "Translation", "Other"
- timing: (enum) "before_start", "after_start", "before_end", "absolute"
- offset_min: (number) Minutes offset
- notes: (string) Additional details

## PARSING EXAMPLES

**"Change worship songs in Session 2 to El Es, Su Vida, and He Is"**
→ Find Alabanza segment in Session 2
→ changes: { number_of_songs: 3, song_1_title: "El Es", song_2_title: "Su Vida", song_3_title: "He Is" }

**"Set Juan as translator for all Plenaria segments"**
→ Filter segments where segment_type="Plenaria"
→ changes: { translator_name: "Juan", requires_translation: true }

**"Update sound team to Rick for all sessions"**
→ target_ids: "all" sessions
→ changes: { sound_team: "Rick" }

## RESPONSE FORMAT (JSON only)
{
  "request_type": "query" | "action",
  "understood_request": "Brief summary",
  "query_result": { "summary": "...", "details": [...] },
  "actions": [{
    "type": "update_sessions" | "update_segments" | "update_event",
    "description": "Human readable",
    "target_ids": ["id1"] or "all",
    "changes": { "field_name": "value" },
    "affected_count": number
  }],
  "warnings": ["..."],
  "requires_confirmation": true
}`,
        response_json_schema: {
          type: "object",
          properties: {
            request_type: { type: "string" },
            understood_request: { type: "string" },
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
      } else {
        setProposedActions(response);
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Error al analizar la solicitud");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeActions = async () => {
    if (!proposedActions?.actions?.length) return;

    setExecutionStatus('executing');

    try {
      for (const action of proposedActions.actions) {
        if (action.type === 'update_sessions') {
          const targetIds = action.target_ids === 'all' 
            ? sessions.map(s => s.id) 
            : action.target_ids;
          
          for (const sessionId of targetIds) {
            await base44.entities.Session.update(sessionId, action.changes);
          }
        } 
        else if (action.type === 'update_segments') {
          const targetIds = action.target_ids === 'all'
            ? eventSegments.map(s => s.id)
            : action.target_ids;
          
          for (const segmentId of targetIds) {
            await base44.entities.Segment.update(segmentId, action.changes);
          }
        }
        else if (action.type === 'update_event' && event) {
          await base44.entities.Event.update(event.id, action.changes);
        }
      }

      setExecutionStatus('success');
      queryClient.invalidateQueries(['sessions', eventId]);
      queryClient.invalidateQueries(['allSegments']);
      queryClient.invalidateQueries(['event', eventId]);
      toast.success("Cambios aplicados correctamente");
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionStatus('error');
      toast.error("Error al aplicar cambios: " + error.message);
    }
  };

  const reset = () => {
    setUserInput("");
    setProposedActions(null);
    setQueryResult(null);
    setExecutionStatus(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: '#1F8A70' }} />
            Asistente IA para Eventos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Badge */}
          {event && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="font-medium">Evento:</span>
              <Badge variant="outline">{event.name} {event.year}</Badge>
              <span className="text-gray-400">•</span>
              <span>{sessions.length} sesiones, {eventSegments.length} segmentos</span>
            </div>
          )}

          {/* Input Area */}
          {!proposedActions && !queryResult && executionStatus !== 'success' && (
            <div className="space-y-3">
              <Textarea
                placeholder="Pregunta o solicita cambios. Ejemplos:

CONSULTAS:
• ¿Qué sesiones tienen traducción?
• ¿Quién presenta los segmentos de Plenaria?
• Muéstrame los horarios de la Sesión 3
• ¿Qué equipo de sonido está asignado?

ACCIONES:
• Cambiar todas las sesiones a traducción en persona
• Actualizar el traductor de todos los segmentos a 'Juan Pérez'
• Marcar todos los segmentos de Plenaria como requieren traducción"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <Button 
                onClick={analyzeRequest} 
                disabled={!userInput.trim() || isProcessing}
                style={tealStyle}
                className="w-full"
              >
               {isProcessing ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   Procesando...
                 </>
               ) : (
                 <>
                   <Send className="w-4 h-4 mr-2" />
                   Enviar
                 </>
               )}
              </Button>
            </div>
          )}

          {/* Query Results */}
          {queryResult && executionStatus !== 'success' && (
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Respuesta:</h4>
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
                Nueva Consulta
              </Button>
            </div>
          )}

          {/* Proposed Actions */}
          {proposedActions && executionStatus !== 'success' && (
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Entendí tu solicitud:</h4>
                <p className="text-blue-800">{proposedActions.understood_request}</p>
              </Card>

              {proposedActions.warnings?.length > 0 && (
                <Card className="p-4 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900">Advertencias:</h4>
                      <ul className="text-amber-800 text-sm mt-1 space-y-1">
                        {proposedActions.warnings.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Acciones a ejecutar:</h4>
                {proposedActions.actions?.map((action, idx) => (
                  <Card key={idx} className="p-3 border-gray-200">
                    <div className="flex items-start gap-3">
                      <ChevronRight className="w-5 h-5 mt-0.5" style={{ color: '#1F8A70' }} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{action.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <Badge variant="outline" className="bg-gray-50">
                            Tipo: {action.type}
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50">
                            Afecta: {action.affected_count} registros
                          </Badge>
                        </div>
                        {action.changes && (
                          <div className="mt-2 text-xs bg-gray-50 p-2 rounded font-mono">
                            {Object.entries(action.changes).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-purple-600">{k}</span>: <span className="text-green-600">"{String(v)}"</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={reset}
                  className="flex-1"
                  disabled={executionStatus === 'executing'}
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={executeActions}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={executionStatus === 'executing'}
                >
                  {executionStatus === 'executing' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar y Ejecutar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {executionStatus === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¡Cambios Aplicados!</h3>
              <p className="text-gray-600 mb-6">
                {proposedActions?.actions?.reduce((sum, a) => sum + (a.affected_count || 0), 0)} registros actualizados
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={reset}>
                  Nueva Solicitud
                </Button>
                <Button onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}