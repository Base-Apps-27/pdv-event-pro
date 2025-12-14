import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Printer, Calendar, Clock, Save } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function ServiceQuickEditor() {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState([]);
  const [segments, setSegments] = useState({});
  
  const queryClient = useQueryClient();

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  // Fetch sessions for selected service
  const { data: serviceSessions = [] } = useQuery({
    queryKey: ['serviceSessions', selectedServiceId],
    queryFn: () => base44.entities.Session.filter({ service_id: selectedServiceId }, 'order'),
    enabled: !!selectedServiceId,
    onSuccess: (data) => {
      setSessions(data);
    }
  });

  // Fetch segments for sessions
  const { data: allSegments = [] } = useQuery({
    queryKey: ['serviceSegments', selectedServiceId],
    queryFn: async () => {
      if (!serviceSessions.length) return [];
      const segs = await base44.entities.Segment.list('order');
      return segs.filter(seg => serviceSessions.some(s => s.id === seg.session_id));
    },
    enabled: !!selectedServiceId && serviceSessions.length > 0,
    onSuccess: (data) => {
      // Organize segments by session
      const segmentsBySession = {};
      data.forEach(seg => {
        if (!segmentsBySession[seg.session_id]) {
          segmentsBySession[seg.session_id] = [];
        }
        segmentsBySession[seg.session_id].push(seg);
      });
      setSegments(segmentsBySession);
    }
  });

  const updateSegmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['serviceSegments']);
    },
  });

  const handleSegmentUpdate = (segmentId, field, value) => {
    setSegments(prev => {
      const newSegments = { ...prev };
      Object.keys(newSegments).forEach(sessionId => {
        const segIndex = newSegments[sessionId].findIndex(s => s.id === segmentId);
        if (segIndex !== -1) {
          newSegments[sessionId][segIndex] = {
            ...newSegments[sessionId][segIndex],
            [field]: value
          };
        }
      });
      return newSegments;
    });
  };

  const saveAllChanges = async () => {
    const allSegs = Object.values(segments).flat();
    for (const seg of allSegs) {
      await updateSegmentMutation.mutateAsync({ 
        id: seg.id, 
        data: seg 
      });
    }
    alert('Cambios guardados exitosamente');
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Editor Rápido de Servicios
          </h1>
          <p className="text-gray-500 mt-1">Actualiza nombres de canciones y participantes</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={saveAllChanges}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Service and Date Selection */}
      <Card className="print:hidden">
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

      {selectedServiceId && sessions.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {sessions.map((session, sessionIndex) => {
            const sessionSegments = segments[session.id] || [];
            
            return (
              <Card key={session.id} className="border-l-4 border-pdv-teal">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl uppercase">{session.name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {session.planned_start_time && formatTimeToEST(session.planned_start_time)}
                      </p>
                    </div>
                    <Badge className="bg-pdv-green text-white">
                      {sessionSegments.length} segmentos
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 space-y-4">
                  {sessionSegments.map((segment) => (
                    <Card key={segment.id} className="border border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-pdv-teal" />
                          <span className="font-bold">
                            {segment.start_time && formatTimeToEST(segment.start_time)}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="font-semibold">{segment.title}</span>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        {/* Main Presenter/Leader */}
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">
                            {segment.segment_type === 'Alabanza' ? 'Director(es)' : 'Presentador'}
                          </Label>
                          <Input
                            value={segment.presenter || ''}
                            onChange={(e) => handleSegmentUpdate(segment.id, 'presenter', e.target.value)}
                            placeholder="Ej. P. Juan Pérez, A. María López"
                            className="text-sm"
                          />
                        </div>

                        {/* Songs for Worship */}
                        {segment.segment_type === 'Alabanza' && segment.number_of_songs > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                            {[...Array(segment.number_of_songs)].map((_, idx) => {
                              const songNum = idx + 1;
                              return (
                                <div key={songNum} className="grid grid-cols-2 gap-2">
                                  <Input
                                    value={segment[`song_${songNum}_title`] || ''}
                                    onChange={(e) => handleSegmentUpdate(segment.id, `song_${songNum}_title`, e.target.value)}
                                    placeholder={`Canción ${songNum}`}
                                    className="text-xs"
                                  />
                                  <Input
                                    value={segment[`song_${songNum}_lead`] || ''}
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
                        {segment.projection_notes && (
                          <div className="bg-purple-50 p-2 rounded text-xs">
                            <p className="font-semibold text-purple-800">Proyección:</p>
                            <p className="text-purple-700">{segment.projection_notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedServiceId && sessions.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-gray-600">Este servicio no tiene sesiones configuradas aún.</p>
        </Card>
      )}

      {!selectedServiceId && (
        <Card className="p-12 text-center border-dashed border-2">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona un servicio para comenzar</p>
        </Card>
      )}
    </div>
  );
}