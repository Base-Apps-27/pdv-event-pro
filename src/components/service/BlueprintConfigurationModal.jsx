import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLOR_SCHEMES = {
  worship: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  preach: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  break: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  tech: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  special: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  default: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
};

export default function BlueprintConfigurationModal({ isOpen, onClose, blueprintId, initialServiceData, onSave, isSaving, title }) {
  const [sessionSegmentData, setSessionSegmentData] = useState([]);
  const [loadingBlueprintDetails, setLoadingBlueprintDetails] = useState(true);

  const { data: blueprintSessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['blueprintSessions', blueprintId],
    queryFn: () => base44.entities.Session.filter({ service_id: blueprintId }, 'order'),
    enabled: !!blueprintId && isOpen,
  });

  const { data: allBlueprintSegments = [], isLoading: isLoadingSegments } = useQuery({
    queryKey: ['blueprintSegments', blueprintId],
    queryFn: async () => {
      if (!blueprintId) return [];
      const segments = await base44.entities.Segment.list();
      // We need segments that belong to the sessions of this blueprint
      // Since filter by list of IDs isn't always available, we fetch all and filter in JS or fetch by session if possible
      // Assuming list() returns enough, but for safety/performance in real apps we might want a better query. 
      // Here we'll just filter the list result.
      return segments;
    },
    enabled: !!blueprintId && isOpen && !isLoadingSessions,
  });

  useEffect(() => {
    const hasSessions = blueprintSessions.length > 0;
    // We consider loaded if requests are done.
    // If sessions exist, we proceed to map them even if segments are empty.
    
    if (blueprintId && isOpen && !isLoadingSessions && !isLoadingSegments) {
      if (hasSessions) {
        const sessionIds = blueprintSessions.map(s => s.id);
        const relevantSegments = allBlueprintSegments.length > 0 
            ? allBlueprintSegments.filter(s => sessionIds.includes(s.session_id))
            : [];
        
        // Sort segments by order
        relevantSegments.sort((a, b) => (a.order || 0) - (b.order || 0));

        const data = blueprintSessions.map(session => {
          const segmentsInSession = relevantSegments.filter(s => s.session_id === session.id);
          return {
            sessionId: session.id,
            sessionName: session.name,
            segments: segmentsInSession.map(segment => ({
              segmentId: segment.id,
              title: segment.title,
              segment_type: segment.segment_type,
              color_code: segment.color_code,
              presenter: segment.presenter || "",
              message_title: segment.message_title || "",
              scripture_references: segment.scripture_references || "",
              number_of_songs: segment.number_of_songs || 0,
              song_1_title: segment.song_1_title || "",
              song_1_lead: segment.song_1_lead || "",
              song_2_title: segment.song_2_title || "",
              song_2_lead: segment.song_2_lead || "",
              song_3_title: segment.song_3_title || "",
              song_3_lead: segment.song_3_lead || "",
              song_4_title: segment.song_4_title || "",
              song_4_lead: segment.song_4_lead || "",
              song_5_title: segment.song_5_title || "",
              song_5_lead: segment.song_5_lead || "",
              song_6_title: segment.song_6_title || "",
              song_6_lead: segment.song_6_lead || "",
              announcement_title: segment.announcement_title || "",
              announcement_description: segment.announcement_description || "",
              announcement_date: segment.announcement_date || "",
            })),
          };
        });
        setSessionSegmentData(data);
      } else {
        // No sessions found
        setSessionSegmentData([]);
      }
      setLoadingBlueprintDetails(false);
    }
  }, [blueprintSessions, allBlueprintSegments, blueprintId, isOpen, isLoadingSessions, isLoadingSegments]);

  const handleSegmentFieldChange = (sessionIndex, segmentIndex, field, value) => {
    setSessionSegmentData(prev => {
      const newPrev = [...prev];
      newPrev[sessionIndex].segments[segmentIndex] = {
        ...newPrev[sessionIndex].segments[segmentIndex],
        [field]: value
      };
      return newPrev;
    });
  };

  const handleSubmit = () => {
    onSave({ ...initialServiceData, blueprintSessionSegmentData: sessionSegmentData });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title || "Configurar Servicio desde Plantilla"}</DialogTitle>
          <p className="text-sm text-gray-500">
            Completa o actualiza la información faltante para los segmentos clave.
          </p>
        </DialogHeader>

        {loadingBlueprintDetails || isLoadingSessions || isLoadingSegments ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            <span className="ml-3 text-gray-600">Cargando plantilla...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {sessionSegmentData.length === 0 && (
                <p className="text-center text-gray-500">Esta plantilla no tiene sesiones ni segmentos configurados.</p>
            )}
            {sessionSegmentData.map((session, sessionIndex) => (
              <div key={session.sessionId} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-lg mb-3 text-gray-800">{session.sessionName}</h4>
                <div className="space-y-4">
                  {session.segments.map((segment, segmentIndex) => {
                    const colorScheme = COLOR_SCHEMES[segment.color_code] || COLOR_SCHEMES.default;
                    
                    // Determine if this segment has editable fields relevant to the request
                    const isInteractive = 
                        (segment.segment_type !== "Break" && segment.segment_type !== "TechOnly") ||
                        segment.segment_type === "Alabanza";

                    if (!isInteractive) return null;

                    return (
                      <div key={segment.segmentId} className={`border-l-4 ${colorScheme.border} pl-4 py-3 bg-white rounded shadow-sm`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className={`${colorScheme.bg} ${colorScheme.text} border-none font-bold`}>
                                {segment.segment_type}
                            </Badge>
                            <span className="font-semibold text-gray-700">{segment.title}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Presenter Field - Common for most */}
                          {segment.segment_type !== "Break" && segment.segment_type !== "TechOnly" && segment.segment_type !== "Alabanza" && (
                              <div className="space-y-1">
                                  <Label htmlFor={`presenter-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Quién presenta / dirige</Label>
                                  <Input
                                      id={`presenter-${sessionIndex}-${segmentIndex}`}
                                      value={segment.presenter}
                                      onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'presenter', e.target.value)}
                                      placeholder="Nombre..."
                                      className="h-9"
                                  />
                              </div>
                          )}

                          {segment.segment_type === "Plenaria" && (
                            <>
                              <div className="space-y-1">
                                <Label htmlFor={`message_title-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Título del Mensaje</Label>
                                <Input
                                  id={`message_title-${sessionIndex}-${segmentIndex}`}
                                  value={segment.message_title}
                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'message_title', e.target.value)}
                                  placeholder="Título..."
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1 col-span-2">
                                <Label htmlFor={`scripture-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Citas Bíblicas</Label>
                                <Input
                                  id={`scripture-${sessionIndex}-${segmentIndex}`}
                                  value={segment.scripture_references}
                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'scripture_references', e.target.value)}
                                  placeholder="Ej. Juan 3:16, Salmos 23"
                                  className="h-9"
                                />
                              </div>
                            </>
                          )}

                          {segment.segment_type === "Alabanza" && (
                              <div className="col-span-2 space-y-3">
                                  {[...Array(segment.number_of_songs || 0)].map((_, songIdx) => (
                                      <div key={songIdx} className="grid grid-cols-12 gap-2 items-end">
                                          <div className="col-span-7 space-y-1">
                                              <Label htmlFor={`song-${songIdx}-title-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Canción {songIdx + 1}</Label>
                                              <Input
                                                  id={`song-${songIdx}-title-${sessionIndex}-${segmentIndex}`}
                                                  value={segment[`song_${songIdx + 1}_title`]}
                                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, `song_${songIdx + 1}_title`, e.target.value)}
                                                  placeholder="Título de la canción"
                                                  className="h-9"
                                              />
                                          </div>
                                          <div className="col-span-5 space-y-1">
                                              <Label htmlFor={`song-${songIdx}-lead-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Vocalista</Label>
                                              <Input
                                                  id={`song-${songIdx}-lead-${sessionIndex}-${segmentIndex}`}
                                                  value={segment[`song_${songIdx + 1}_lead`]}
                                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, `song_${songIdx + 1}_lead`, e.target.value)}
                                                  placeholder="Nombre"
                                                  className="h-9"
                                              />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}

                          {segment.segment_type === "Anuncio" && (
                            <>
                              <div className="space-y-1 col-span-2">
                                  <Label htmlFor={`announcement_title-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Título del Anuncio</Label>
                                  <Input
                                      id={`announcement_title-${sessionIndex}-${segmentIndex}`}
                                      value={segment.announcement_title}
                                      onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'announcement_title', e.target.value)}
                                      placeholder="Ej. Retiro de Jóvenes"
                                      className="h-9"
                                  />
                              </div>
                              <div className="space-y-1 col-span-2">
                                  <Label htmlFor={`announcement_description-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Descripción / Detalles</Label>
                                  <Textarea
                                      id={`announcement_description-${sessionIndex}-${segmentIndex}`}
                                      value={segment.announcement_description}
                                      onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'announcement_description', e.target.value)}
                                      placeholder="Puntos clave o script..."
                                      className="text-sm resize-none h-20"
                                  />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-pdv-teal hover:bg-pdv-green text-white font-bold" onClick={handleSubmit} disabled={isSaving || loadingBlueprintDetails}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {title?.includes('Bilingüe') ? 'Guardar Servicio Bilingüe' : (initialServiceData?.id ? 'Guardar Cambios' : 'Crear Servicio Completo')}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}