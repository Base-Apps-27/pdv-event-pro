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
  const [globalValues, setGlobalValues] = useState({
    presenter: "",
    message_title: "",
    scripture_references: "",
    announcement_title: "",
    announcement_description: "",
    songs: Array(6).fill({ title: "", lead: "" })
  });

  const { data: blueprintSessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['blueprintSessions', blueprintId],
    queryFn: () => base44.entities.Session.filter({ service_id: blueprintId }, 'order'),
    enabled: !!blueprintId && isOpen,
  });

  const { data: allBlueprintSegments = [], isLoading: isLoadingSegments } = useQuery({
    queryKey: ['blueprintSegments', blueprintId],
    queryFn: async () => {
      if (!blueprintId || !blueprintSessions.length) return [];

      // Fetch segments for each session individually to ensure we get all of them
      // (base44.entities.Segment.list() has a default limit of 50)
      const segmentsPromises = blueprintSessions.map(session => 
        base44.entities.Segment.filter({ session_id: session.id })
      );

      const segmentsArrays = await Promise.all(segmentsPromises);
      return segmentsArrays.flat();
    },
    enabled: !!blueprintId && isOpen && !isLoadingSessions && blueprintSessions.length > 0,
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
            isTranslated: session.is_translated_session || false,
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
              translator_name: segment.translator_name || "",
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

  const handleGlobalChange = (field, value, songIndex = null, subField = null) => {
    // Update global state
    setGlobalValues(prev => {
      if (songIndex !== null) {
        const newSongs = [...prev.songs];
        newSongs[songIndex] = { ...newSongs[songIndex], [subField]: value };
        return { ...prev, songs: newSongs };
      }
      return { ...prev, [field]: value };
    });

    // Propagate to ALL sessions
    setSessionSegmentData(prev => {
      return prev.map(session => ({
        ...session,
        segments: session.segments.map(segment => {
          let updates = {};
          
          if (songIndex !== null && segment.segment_type === "Alabanza") {
             updates[`song_${songIndex + 1}_${subField}`] = value;
          } else if (segment.segment_type === "Plenaria" && (field === 'message_title' || field === 'scripture_references')) {
             updates[field] = value;
          } else if (segment.segment_type === "Anuncio" && (field === 'announcement_title' || field === 'announcement_description')) {
             updates[field] = value;
          } else if (field === 'presenter' && segment.segment_type !== 'Break' && segment.segment_type !== 'TechOnly') {
             // Only update presenter if it seems appropriate (e.g. not Break)
             // But maybe user wants global presenter for MC?
             // Let's be selective: Plenaria, Bienvenida, Anuncio, MC usually share presenter? 
             // Or just apply to all interactive segments if they match the type?
             // Simpler: Apply 'presenter' global only to specific types if we had type-specific globals.
             // But here 'presenter' is a generic global. Let's apply it to everything except Alabanza/Break/Tech/Video?
             // Actually, usually Speaker is specific to Plenaria. MC is specific to MC. 
             // Let's restrict global 'presenter' to Plenaria for now, or remove global presenter and keep it per-segment type?
             // User asked for "link like fields".
             // I'll apply 'presenter' to Plenaria and Bienvenida and Cierre.
             if (['Plenaria', 'Bienvenida', 'Cierre', 'MC'].includes(segment.segment_type)) {
                updates[field] = value;
             }
          }

          return { ...segment, ...updates };
        })
      }));
    });
  };

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
      <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title || "Configurar Servicio desde Plantilla"}</DialogTitle>
          <p className="text-sm text-gray-500">
            Ingresa los datos generales arriba para aplicarlos a todas las sesiones, o edita cada sesión individualmente.
          </p>
        </DialogHeader>

        {loadingBlueprintDetails || isLoadingSessions || isLoadingSegments ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            <span className="ml-3 text-gray-600">Cargando plantilla...</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Global Configuration Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-pdv-teal text-white text-xs px-2 py-1 rounded">GLOBAL</span>
                Datos Generales del Servicio
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Songs (Assuming typical service has worship) */}
                <div className="space-y-3">
                   <Label className="text-xs font-bold text-slate-500 uppercase">Alabanza (Global)</Label>
                   {[0, 1, 2].map((idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-7">
                          <Input 
                            placeholder={`Canción ${idx + 1}`} 
                            className="h-8 text-sm bg-white"
                            value={globalValues.songs[idx].title}
                            onChange={(e) => handleGlobalChange('songs', e.target.value, idx, 'title')}
                          />
                        </div>
                        <div className="col-span-5">
                           <Input 
                            placeholder="Vocalista" 
                            className="h-8 text-sm bg-white"
                            value={globalValues.songs[idx].lead}
                            onChange={(e) => handleGlobalChange('songs', e.target.value, idx, 'lead')}
                           />
                        </div>
                      </div>
                   ))}
                </div>

                {/* Message & Announcements */}
                <div className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Mensaje / Plenaria</Label>
                      <Input 
                        placeholder="Título del Mensaje" 
                        className="h-9 bg-white"
                        value={globalValues.message_title}
                        onChange={(e) => handleGlobalChange('message_title', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                         <Input 
                            placeholder="Predicador" 
                            className="h-9 bg-white"
                            value={globalValues.presenter}
                            onChange={(e) => handleGlobalChange('presenter', e.target.value)}
                         />
                         <Input 
                            placeholder="Citas Bíblicas" 
                            className="h-9 bg-white"
                            value={globalValues.scripture_references}
                            onChange={(e) => handleGlobalChange('scripture_references', e.target.value)}
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Anuncios</Label>
                      <Input 
                        placeholder="Título Anuncio Principal" 
                        className="h-9 bg-white"
                        value={globalValues.announcement_title}
                        onChange={(e) => handleGlobalChange('announcement_title', e.target.value)}
                      />
                   </div>
                </div>
              </div>
            </div>

            {sessionSegmentData.length === 0 && (
                <p className="text-center text-gray-500">Esta plantilla no tiene sesiones ni segmentos configurados.</p>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sessionSegmentData.map((session, sessionIndex) => (
              <div key={session.sessionId} className={`border rounded-lg p-4 ${session.isTranslated ? 'bg-purple-50 border-purple-200' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-lg text-gray-800">{session.sessionName}</h4>
                   {session.isTranslated && <Badge className="bg-purple-600">Bilingüe / Traducción</Badge>}
                </div>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {session.segments.map((segment, segmentIndex) => {
                    const colorScheme = COLOR_SCHEMES[segment.color_code] || COLOR_SCHEMES.default;
                    
                    // Determine if this segment has editable fields relevant to the request
                    const isInteractive = 
                        (segment.segment_type !== "Break" && segment.segment_type !== "TechOnly") ||
                        segment.segment_type === "Alabanza";

                    if (!isInteractive) return null;

                    return (
                      <div key={segment.segmentId} className={`border-l-4 ${colorScheme.border} pl-4 py-3 bg-white/50 rounded shadow-sm`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className={`${colorScheme.bg} ${colorScheme.text} border-none font-bold`}>
                                {segment.segment_type}
                            </Badge>
                            <span className="font-semibold text-gray-700 text-sm">{segment.title}</span>
                        </div>

                        <div className="space-y-3">
                          {/* Presenter Field - Common for most */}
                          {segment.segment_type !== "Break" && segment.segment_type !== "TechOnly" && segment.segment_type !== "Alabanza" && (
                              <div className="grid grid-cols-1 gap-2">
                                  <div>
                                    <Label htmlFor={`presenter-${sessionIndex}-${segmentIndex}`} className="text-xs font-medium text-gray-500">Quién presenta</Label>
                                    <Input
                                        id={`presenter-${sessionIndex}-${segmentIndex}`}
                                        value={segment.presenter}
                                        onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'presenter', e.target.value)}
                                        placeholder="Nombre..."
                                        className="h-8 text-sm"
                                    />
                                  </div>
                              </div>
                          )}

                          {session.isTranslated && (
                             <div className="bg-purple-50 p-2 rounded border border-purple-100">
                                <Label htmlFor={`trans-${sessionIndex}-${segmentIndex}`} className="text-xs font-bold text-purple-700">Traductor</Label>
                                <Input
                                    id={`trans-${sessionIndex}-${segmentIndex}`}
                                    value={segment.translator_name}
                                    onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'translator_name', e.target.value)}
                                    placeholder="Nombre del traductor..."
                                    className="h-8 text-sm border-purple-200"
                                />
                             </div>
                          )}

                          {segment.segment_type === "Plenaria" && (
                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Título</Label>
                                <Input
                                  value={segment.message_title}
                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'message_title', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Citas</Label>
                                <Input
                                  value={segment.scripture_references}
                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'scripture_references', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}

                          {segment.segment_type === "Alabanza" && (
                              <div className="space-y-2">
                                  {[...Array(segment.number_of_songs || 0)].map((_, songIdx) => (
                                      <div key={songIdx} className="grid grid-cols-12 gap-2 items-center">
                                          <div className="col-span-1 text-xs text-gray-400 font-mono">{songIdx+1}</div>
                                          <div className="col-span-7">
                                              <Input
                                                  value={segment[`song_${songIdx + 1}_title`]}
                                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, `song_${songIdx + 1}_title`, e.target.value)}
                                                  placeholder="Título"
                                                  className="h-7 text-xs"
                                              />
                                          </div>
                                          <div className="col-span-4">
                                              <Input
                                                  value={segment[`song_${songIdx + 1}_lead`]}
                                                  onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, `song_${songIdx + 1}_lead`, e.target.value)}
                                                  placeholder="Vocal"
                                                  className="h-7 text-xs"
                                              />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}

                          {segment.segment_type === "Anuncio" && (
                            <div className="space-y-2">
                                <Input
                                    value={segment.announcement_title}
                                    onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'announcement_title', e.target.value)}
                                    placeholder="Título"
                                    className="h-8 text-sm"
                                />
                                <Textarea
                                    value={segment.announcement_description}
                                    onChange={(e) => handleSegmentFieldChange(sessionIndex, segmentIndex, 'announcement_description', e.target.value)}
                                    placeholder="Detalles..."
                                    className="text-xs resize-none h-16"
                                />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
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