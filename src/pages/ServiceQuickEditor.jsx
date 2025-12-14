import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Calendar, Clock, Save, Plus, Trash2, Copy } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function ServiceQuickEditor() {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingSegments, setEditingSegments] = useState({});
  const [showSpecialSegmentDialog, setShowSpecialSegmentDialog] = useState(false);
  const [specialSegmentType, setSpecialSegmentType] = useState("");
  const [insertAfterSegmentId, setInsertAfterSegmentId] = useState("");
  
  const queryClient = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  // Fetch or create session for selected date
  const { data: dateSession, isLoading: loadingSession } = useQuery({
    queryKey: ['dateSession', selectedServiceId, selectedDate],
    queryFn: async () => {
      if (!selectedServiceId || !selectedDate) return null;
      
      // Check if session exists for this date
      const existingSessions = await base44.entities.Session.filter({
        service_id: selectedServiceId,
        date: selectedDate
      });
      
      if (existingSessions.length > 0) {
        return existingSessions[0];
      }
      
      return null;
    },
    enabled: !!selectedServiceId && !!selectedDate,
  });

  // Fetch blueprint session from service
  const { data: blueprintSession } = useQuery({
    queryKey: ['blueprintSession', selectedServiceId],
    queryFn: async () => {
      if (!selectedServiceId) return null;
      const sessions = await base44.entities.Session.filter({ service_id: selectedServiceId });
      return sessions.find(s => s.origin === 'blueprint') || sessions[0] || null;
    },
    enabled: !!selectedServiceId,
  });

  // Fetch segments for current session
  const { data: sessionSegments = [] } = useQuery({
    queryKey: ['sessionSegments', dateSession?.id],
    queryFn: async () => {
      if (!dateSession?.id) return [];
      const segs = await base44.entities.Segment.filter({ session_id: dateSession.id }, 'order');
      return segs;
    },
    enabled: !!dateSession?.id,
  });

  // Fetch blueprint segments
  const { data: blueprintSegments = [] } = useQuery({
    queryKey: ['blueprintSegments', blueprintSession?.id],
    queryFn: async () => {
      if (!blueprintSession?.id) return [];
      const segs = await base44.entities.Segment.filter({ session_id: blueprintSession.id }, 'order');
      return segs;
    },
    enabled: !!blueprintSession?.id,
  });

  const createSessionMutation = useMutation({
    mutationFn: async ({ serviceId, date, blueprintSessionId, blueprintSegs }) => {
      const service = services.find(s => s.id === serviceId);
      const blueprint = await base44.entities.Session.filter({ id: blueprintSessionId });
      const bpSession = blueprint[0];
      
      // Create new session
      const newSession = await base44.entities.Session.create({
        service_id: serviceId,
        name: `${service.name} - ${date}`,
        date: date,
        planned_start_time: bpSession?.planned_start_time || service.time,
        origin: 'template',
        field_origins: {}
      });

      // Copy segments from blueprint
      for (let i = 0; i < blueprintSegs.length; i++) {
        const bpSeg = blueprintSegs[i];
        await base44.entities.Segment.create({
          session_id: newSession.id,
          order: bpSeg.order,
          segment_type: bpSeg.segment_type,
          title: bpSeg.title,
          start_time: bpSeg.start_time,
          duration_min: bpSeg.duration_min,
          end_time: bpSeg.end_time,
          projection_notes: bpSeg.projection_notes,
          sound_notes: bpSeg.sound_notes,
          number_of_songs: bpSeg.number_of_songs,
          origin: 'template',
          field_origins: {},
          show_in_general: bpSeg.show_in_general
        });
      }

      return newSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dateSession']);
      queryClient.invalidateQueries(['sessionSegments']);
    },
  });

  const updateSegmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionSegments']);
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Segment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionSegments']);
      setShowSpecialSegmentDialog(false);
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: (id) => base44.entities.Segment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionSegments']);
    },
  });

  const handleCreateFromBlueprint = () => {
    if (!blueprintSession?.id || !selectedServiceId || !selectedDate) return;
    createSessionMutation.mutate({
      serviceId: selectedServiceId,
      date: selectedDate,
      blueprintSessionId: blueprintSession.id,
      blueprintSegs: blueprintSegments
    });
  };

  const handleSegmentUpdate = (segmentId, field, value) => {
    setEditingSegments(prev => ({
      ...prev,
      [segmentId]: {
        ...prev[segmentId],
        [field]: value
      }
    }));
  };

  const saveAllChanges = async () => {
    for (const segId of Object.keys(editingSegments)) {
      const segment = sessionSegments.find(s => s.id === segId);
      await updateSegmentMutation.mutateAsync({
        id: segId,
        data: { ...segment, ...editingSegments[segId] }
      });
    }
    setEditingSegments({});
    alert('Cambios guardados');
  };

  const handleInsertSpecialSegment = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const insertIndex = sessionSegments.findIndex(s => s.id === insertAfterSegmentId);
    const newOrder = insertIndex >= 0 ? sessionSegments[insertIndex].order + 0.5 : sessionSegments.length;

    createSegmentMutation.mutate({
      session_id: dateSession.id,
      segment_type: specialSegmentType,
      title: formData.get('title'),
      start_time: formData.get('start_time'),
      duration_min: parseInt(formData.get('duration_min')),
      order: newOrder,
      origin: 'manual'
    });
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const hasChanges = Object.keys(editingSegments).length > 0;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Editor Rápido de Servicios
          </h1>
          <p className="text-gray-500 mt-1">Llena el programa semanal desde tu plantilla maestra</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <Button onClick={saveAllChanges} className="bg-pdv-teal text-white">
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Service and Date Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Servicio</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
              >
                <option value="">Seleccionar servicio...</option>
                {services.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.day_of_week}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fecha del Servicio</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create from Blueprint or Edit */}
      {selectedServiceId && !dateSession && !loadingSession && (
        <Card className="border-2 border-dashed border-pdv-teal">
          <CardContent className="p-8 text-center">
            <Calendar className="w-16 h-16 text-pdv-teal mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No existe un servicio para esta fecha</h3>
            <p className="text-gray-600 mb-4">Crea uno nuevo desde la plantilla maestra</p>
            <Button onClick={handleCreateFromBlueprint} className="bg-pdv-teal text-white">
              <Copy className="w-4 h-4 mr-2" />
              Crear desde Plantilla
            </Button>
          </CardContent>
        </Card>
      )}

      {dateSession && sessionSegments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold uppercase">Programa del Servicio</h2>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowSpecialSegmentDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Insertar Segmento Especial
            </Button>
          </div>

          {sessionSegments.map((segment) => {
            const currentEdits = editingSegments[segment.id] || {};
            const displaySegment = { ...segment, ...currentEdits };

            return (
              <Card key={segment.id} className="border border-gray-200">
                <CardHeader className="pb-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-pdv-teal" />
                      <div>
                        <span className="font-bold text-lg">
                          {displaySegment.start_time && formatTimeToEST(displaySegment.start_time)}
                        </span>
                        <span className="text-gray-600 ml-2">•</span>
                        <span className="font-semibold ml-2">{displaySegment.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{displaySegment.segment_type}</Badge>
                      {segment.origin !== 'template' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => {
                            if (window.confirm('¿Eliminar este segmento?')) {
                              deleteSegmentMutation.mutate(segment.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3 pt-4">
                  {/* Presenter/Leader */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      {displaySegment.segment_type === 'Alabanza' ? 'Director(es)' : 'Presentador'}
                    </Label>
                    <Input
                      value={displaySegment.presenter || ''}
                      onChange={(e) => handleSegmentUpdate(segment.id, 'presenter', e.target.value)}
                      placeholder="Ej. P. Juan Pérez"
                      className="text-sm"
                    />
                  </div>

                  {/* Songs for Worship */}
                  {displaySegment.segment_type === 'Alabanza' && displaySegment.number_of_songs > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                      {[...Array(displaySegment.number_of_songs)].map((_, idx) => {
                        const songNum = idx + 1;
                        return (
                          <div key={songNum} className="grid grid-cols-2 gap-2">
                            <Input
                              value={displaySegment[`song_${songNum}_title`] || ''}
                              onChange={(e) => handleSegmentUpdate(segment.id, `song_${songNum}_title`, e.target.value)}
                              placeholder={`Canción ${songNum}`}
                              className="text-xs"
                            />
                            <Input
                              value={displaySegment[`song_${songNum}_lead`] || ''}
                              onChange={(e) => handleSegmentUpdate(segment.id, `song_${songNum}_lead`, e.target.value)}
                              placeholder="Líder"
                              className="text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Projection Notes */}
                  {displaySegment.projection_notes && (
                    <div className="bg-purple-50 p-2 rounded text-xs">
                      <p className="font-semibold text-purple-800">Proyección:</p>
                      <p className="text-purple-700">{displaySegment.projection_notes}</p>
                    </div>
                  )}

                  {/* Sound Notes */}
                  {displaySegment.sound_notes && (
                    <div className="bg-red-50 p-2 rounded text-xs">
                      <p className="font-semibold text-red-800">Sonido:</p>
                      <p className="text-red-700">{displaySegment.sound_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Insert Special Segment Dialog */}
      <Dialog open={showSpecialSegmentDialog} onOpenChange={setShowSpecialSegmentDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Insertar Segmento Especial</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInsertSpecialSegment} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Segmento</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={specialSegmentType}
                onChange={(e) => setSpecialSegmentType(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="Especial">Santa Cena</option>
                <option value="Especial">Presentación de Bebés</option>
                <option value="Especial">Bautismos</option>
                <option value="Especial">Otro Especial</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input name="title" required placeholder="Ej. Santa Cena" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora de Inicio</Label>
                <Input name="start_time" type="time" required />
              </div>
              <div className="space-y-2">
                <Label>Duración (min)</Label>
                <Input name="duration_min" type="number" defaultValue="15" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Insertar después de</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={insertAfterSegmentId}
                onChange={(e) => setInsertAfterSegmentId(e.target.value)}
              >
                <option value="">Inicio</option>
                {sessionSegments.map(seg => (
                  <option key={seg.id} value={seg.id}>{seg.title}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowSpecialSegmentDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-pdv-teal text-white">
                Insertar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}