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
  const queryClient = useQueryClient();
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [proposedActions, setProposedActions] = useState(null);
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

    try {
      const contextSummary = {
        event: event ? { id: event.id, name: event.name, year: event.year } : null,
        sessions: sessions.map(s => ({ 
          id: s.id, 
          name: s.name, 
          date: s.date,
          is_translated_session: s.is_translated_session,
          translation_team: s.translation_team
        })),
        segments_count: eventSegments.length,
        segments_sample: eventSegments.slice(0, 5).map(seg => ({
          id: seg.id,
          title: seg.title,
          session_id: seg.session_id,
          requires_translation: seg.requires_translation,
          translation_mode: seg.translation_mode
        }))
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI assistant helping manage church event data. Analyze the user's request and propose specific database actions.

## CURRENT EVENT CONTEXT
${JSON.stringify(contextSummary, null, 2)}

## USER REQUEST
"${userInput}"

## YOUR TASK
1. Understand what the user wants to change
2. Propose specific actions to accomplish it
3. Be precise about which records will be affected

## SUPPORTED ACTION TYPES
- update_sessions: Update session fields (translation settings, teams, times, etc.)
- update_segments: Update segment fields (translation, notes, times, presenters, etc.)
- update_event: Update event fields

## RESPONSE FORMAT (JSON only)
{
  "understood_request": "Brief summary of what you understood",
  "actions": [
    {
      "type": "update_sessions" | "update_segments" | "update_event",
      "description": "Human readable description",
      "target_ids": ["id1", "id2"] or "all",
      "changes": { "field_name": "new_value" },
      "affected_count": number
    }
  ],
  "warnings": ["Any warnings or clarifications needed"],
  "requires_confirmation": true
}

## FIELD REFERENCE
Sessions: is_translated_session, translation_team, sound_team, tech_team, coordinators, admin_team, ushers_team, hospitality_team, worship_leader, planned_start_time, planned_end_time, notes
Segments: requires_translation, translation_mode ("InPerson" or "RemoteBooth"), translator_name, presenter, projection_notes, sound_notes, ushers_notes, start_time, duration_min
Event: name, theme, location, status, print_color

For translation mode changes:
- "InPerson" = On-stage/live translation
- "RemoteBooth" = Headphones/booth translation`,
        response_json_schema: {
          type: "object",
          properties: {
            understood_request: { type: "string" },
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

      setProposedActions(response);
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
    setExecutionStatus(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pdv-teal" />
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
          {!proposedActions && executionStatus !== 'success' && (
            <div className="space-y-3">
              <Textarea
                placeholder="Describe lo que necesitas cambiar. Ejemplos:
• Cambiar todas las sesiones a traducción en persona
• Actualizar el traductor de todos los segmentos a 'Juan Pérez'
• Marcar todos los segmentos de Plenaria como requieren traducción
• Cambiar el equipo de sonido de todas las sesiones"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button 
                onClick={analyzeRequest} 
                disabled={!userInput.trim() || isProcessing}
                className="w-full bg-pdv-teal hover:bg-pdv-teal/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Analizar Solicitud
                  </>
                )}
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
                      <ChevronRight className="w-5 h-5 text-pdv-teal mt-0.5" />
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
                  className="flex-1 bg-green-600 hover:bg-green-700"
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