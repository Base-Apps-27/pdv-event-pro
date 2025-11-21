import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, Clock, Edit, Trash2, List, ChevronRight, Users, ChevronDown, ChevronUp, RefreshCw, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SegmentList from "../session/SegmentList";
import SegmentFormTwoColumn from "../session/SegmentFormTwoColumn";
import PreSessionDetailsForm from "../session/PreSessionDetailsForm";
import HospitalityTasksModal from "../session/HospitalityTasksModal";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function SessionManager({ eventId, sessions, segments }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [showPreSessionDetailsDialog, setShowPreSessionDetailsDialog] = useState(false);
  const [showHospitalityTasksModal, setShowHospitalityTasksModal] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Session.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId]);
      setShowDialog(false);
      setEditingSession(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Session.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId]);
      setShowDialog(false);
      setEditingSession(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Session.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId]);
    },
  });

  const recalculateTimesMutation = useMutation({
    mutationFn: async (sessionId) => {
      const sessionSegments = segments
        .filter(seg => seg.session_id === sessionId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // Calculate all new times first using the newly calculated values
      const updatedSegments = [];
      for (let i = 0; i < sessionSegments.length; i++) {
        const segment = sessionSegments[i];
        const previousSegment = i > 0 ? updatedSegments[i - 1] : null;

        let newStartTime = segment.start_time;
        if (previousSegment && previousSegment.end_time) {
          newStartTime = previousSegment.end_time;
        }

        // Calculate new end time based on duration
        let newEndTime = segment.end_time;
        if (newStartTime && segment.duration_min) {
          const [hours, minutes] = newStartTime.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + segment.duration_min;
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        }

        updatedSegments.push({
          id: segment.id,
          start_time: newStartTime,
          end_time: newEndTime
        });
      }

      // Update all segments at once
      await Promise.all(
        updatedSegments.map(seg => 
          base44.entities.Segment.update(seg.id, {
            start_time: seg.start_time,
            end_time: seg.end_time
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['segments']);
    },
  });

  const openDialog = (session = null) => {
    setEditingSession(session);
    
    // Calculate suggested start time for new sessions based on previous session
    let suggestedStartTime = '';
    if (!session && sessions.length > 0) {
      const sortedSessions = [...sessions].sort((a, b) => (a.order || 0) - (b.order || 0));
      const lastSession = sortedSessions[sortedSessions.length - 1];
      if (lastSession.planned_end_time) {
        suggestedStartTime = lastSession.planned_end_time;
      }
    }
    
    setFormData({
      name: session?.name || '',
      date: session?.date || '',
      planned_start_time: session?.planned_start_time || suggestedStartTime,
      planned_end_time: session?.planned_end_time || '',
      default_stage_call_offset_min: session?.default_stage_call_offset_min || 15,
      location: session?.location || '',
      notes: session?.notes || '',
      admin_team: session?.admin_team || '',
      coordinators: session?.coordinators || '',
      sound_team: session?.sound_team || '',
      tech_team: session?.tech_team || '',
      ushers_team: session?.ushers_team || '',
      translation_team: session?.translation_team || '',
      hospitality_team: session?.hospitality_team || '',
      photography_team: session?.photography_team || '',
      worship_leader: session?.worship_leader || '',
      session_color: session?.session_color || 'blue',
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate session times don't overlap with other sessions on the same day
    if (formData.date && formData.planned_start_time && formData.planned_end_time) {
      const sameDaySessions = sessions.filter(s => 
        s.date === formData.date && 
        s.id !== editingSession?.id &&
        s.planned_start_time && 
        s.planned_end_time
      );
      
      for (const existingSession of sameDaySessions) {
        const newStart = formData.planned_start_time;
        const newEnd = formData.planned_end_time;
        const existingStart = existingSession.planned_start_time;
        const existingEnd = existingSession.planned_end_time;
        
        // Check for overlap
        if ((newStart >= existingStart && newStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)) {
          alert(`La sesión se solapa con "${existingSession.name}" (${formatTimeToEST(existingStart)} - ${formatTimeToEST(existingEnd)}). Por favor ajusta los horarios.`);
          return;
        }
      }
    }
    
    const data = {
      event_id: eventId,
      ...formData,
      default_stage_call_offset_min: parseInt(formData.default_stage_call_offset_min || 15),
      order: editingSession?.order || sessions.length + 1,
    };

    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getSegmentCount = (sessionId) => {
    return segments.filter(seg => seg.session_id === sessionId).length;
  };

  const getSessionSegments = (sessionId) => {
    return segments.filter(seg => seg.session_id === sessionId).sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.SegmentTemplate.list(),
  });

  const { data: preSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails', expandedSessionId],
    queryFn: () => base44.entities.PreSessionDetails.filter({ session_id: expandedSessionId }),
    enabled: !!expandedSessionId,
  });

  const toggleSession = (sessionId) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  const handleEditSegment = (segment, sessionId) => {
    setEditingSegment(segment);
    setExpandedSessionId(sessionId);
    setShowSegmentForm(true);
  };

  const handleCloseSegmentForm = () => {
    setShowSegmentForm(false);
    setEditingSegment(null);
  };

  const handleAddSegment = (sessionId) => {
    setExpandedSessionId(sessionId);
    setEditingSegment(null);
    setShowSegmentForm(true);
  };

  const sessionColors = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    pink: "bg-pink-50 border-pink-200",
    orange: "bg-orange-50 border-orange-200",
    yellow: "bg-yellow-50 border-yellow-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200"
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Sesiones del Evento</h2>
        <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sesión
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No hay sesiones</h3>
          <p className="text-slate-500 mb-4">Comienza agregando la primera sesión del evento</p>
          <Button onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Primera Sesión
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const sessionSegments = getSessionSegments(session.id);

            return (
              <Card key={session.id} className={`hover:shadow-md transition-shadow border-l-4 ${sessionColors[session.session_color || 'blue']}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-3">{session.name}</CardTitle>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {session.date && (
                          <div>
                            <span className="text-slate-500 text-xs">Fecha</span>
                            <div className="font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {session.date}
                            </div>
                          </div>
                        )}
                        {session.planned_start_time && (
                          <div>
                            <span className="text-slate-500 text-xs">Inicio</span>
                            <div className="font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeToEST(session.planned_start_time)}
                            </div>
                          </div>
                        )}
                        {session.planned_end_time && (
                          <div>
                            <span className="text-slate-500 text-xs">Fin</span>
                            <div className="font-medium">{formatTimeToEST(session.planned_end_time)}</div>
                          </div>
                        )}
                        {session.location && (
                          <div>
                            <span className="text-slate-500 text-xs">Ubicación</span>
                            <div className="font-medium truncate">{session.location}</div>
                          </div>
                        )}
                      </div>

                      {session.default_stage_call_offset_min && (
                        <div className="mt-2 text-sm">
                          <span className="text-blue-600 font-semibold">
                            Llegada de Equipos: {session.default_stage_call_offset_min} min antes
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                        {session.admin_team && (
                          <div className="bg-orange-50 px-2 py-1 rounded border border-orange-200">
                            <span className="font-bold text-orange-700">ADMIN:</span>
                            <span className="text-slate-700 ml-1">{session.admin_team}</span>
                          </div>
                        )}
                        {session.coordinators && (
                          <div className="bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            <span className="font-bold text-blue-700">COORD:</span>
                            <span className="text-slate-700 ml-1">{session.coordinators}</span>
                          </div>
                        )}
                        {session.sound_team && (
                          <div className="bg-red-50 px-2 py-1 rounded border border-red-200">
                            <span className="font-bold text-red-700">SONIDO:</span>
                            <span className="text-slate-700 ml-1">{session.sound_team}</span>
                          </div>
                        )}
                        {session.tech_team && (
                          <div className="bg-purple-50 px-2 py-1 rounded border border-purple-200">
                            <span className="font-bold text-purple-700">TÉCNICO:</span>
                            <span className="text-slate-700 ml-1">{session.tech_team}</span>
                          </div>
                        )}
                        {session.ushers_team && (
                          <div className="bg-green-50 px-2 py-1 rounded border border-green-200">
                            <span className="font-bold text-green-700">UJIERES:</span>
                            <span className="text-slate-700 ml-1">{session.ushers_team}</span>
                          </div>
                        )}
                        {session.translation_team && (
                          <div className="bg-pink-50 px-2 py-1 rounded border border-pink-200">
                            <span className="font-bold text-pink-700">TRAD:</span>
                            <span className="text-slate-700 ml-1">{session.translation_team}</span>
                          </div>
                        )}
                        {session.hospitality_team && (
                          <div className="bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                            <span className="font-bold text-yellow-700">HOSPIT:</span>
                            <span className="text-slate-700 ml-1">{session.hospitality_team}</span>
                          </div>
                        )}
                        {session.photography_team && (
                          <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            <span className="font-bold text-slate-700">FOTO:</span>
                            <span className="text-slate-700 ml-1">{session.photography_team}</span>
                          </div>
                        )}
                        {session.worship_leader && (
                          <div className="bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                            <span className="font-bold text-indigo-700">ALABANZA:</span>
                            <span className="text-slate-700 ml-1">{session.worship_leader}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="text-base px-3 py-1 whitespace-nowrap">
                      {getSegmentCount(session.id)} segmentos
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleSession(session.id)}
                      className="flex-1"
                    >
                      <List className="w-4 h-4 mr-2" />
                      Ver Segmentos
                      {isExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => recalculateTimesMutation.mutate(session.id)}
                      disabled={recalculateTimesMutation.isPending}
                      title="Recalcular horarios"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowHospitalityTasksModal(true)}
                      title="Tareas de Hospitalidad"
                    >
                      <Utensils className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openDialog(session)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Eliminar esta sesión y todos sus segmentos?')) {
                          deleteMutation.mutate(session.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="border-t pt-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-slate-900">Segmentos del Programa</h3>
                        <Button 
                          size="sm"
                          onClick={() => handleAddSegment(session.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Nuevo Segmento
                        </Button>
                      </div>
                      
                      <SegmentList 
                        segments={sessionSegments}
                        sessionId={session.id}
                        onEdit={(segment) => handleEditSegment(segment, session.id)}
                        onEditPreSession={() => setShowPreSessionDetailsDialog(true)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showSegmentForm} onOpenChange={setShowSegmentForm}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <SegmentFormTwoColumn 
              session={sessions.find(s => s.id === expandedSessionId)}
              segment={editingSegment}
              templates={templates}
              onClose={handleCloseSegmentForm}
              sessionId={expandedSessionId}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreSessionDetailsDialog} onOpenChange={setShowPreSessionDetailsDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 border-b border-gray-100 p-6 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">Detalles Pre-Sesión</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <PreSessionDetailsForm
              sessionId={expandedSessionId}
              preSessionDetails={preSessionDetails.length > 0 ? preSessionDetails[0] : null}
              onClose={() => setShowPreSessionDetailsDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <HospitalityTasksModal 
        sessionId={expandedSessionId} 
        isOpen={showHospitalityTasksModal} 
        onClose={() => setShowHospitalityTasksModal(false)}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 border-b border-gray-100 p-6 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingSession ? 'Editar Sesión' : 'Nueva Sesión'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="space-y-6 overflow-y-auto flex-1 px-6 py-4">
            <div>
              <h3 className="font-bold text-lg mb-4 text-slate-900">Información Básica</h3>
              <div className="space-y-4 max-w-full">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Sesión *</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                    required 
                    placeholder="Viernes PM / Sábado AM"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha *</Label>
                    <Input 
                      id="date" 
                      name="date" 
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateFormField('date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input 
                      id="location" 
                      name="location" 
                      value={formData.location}
                      onChange={(e) => updateFormField('location', e.target.value)}
                      placeholder="Santuario / Salón principal"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="planned_start_time">Hora Inicio *</Label>
                    <Input 
                      id="planned_start_time" 
                      name="planned_start_time" 
                      type="time"
                      value={formData.planned_start_time}
                      onChange={(e) => updateFormField('planned_start_time', e.target.value)}
                      min={(() => {
                        if (!formData.date || editingSession) return undefined;
                        const sameDaySessions = sessions.filter(s => 
                          s.date === formData.date && 
                          s.planned_end_time
                        ).sort((a, b) => (a.planned_end_time || '').localeCompare(b.planned_end_time || ''));
                        const lastSession = sameDaySessions[sameDaySessions.length - 1];
                        return lastSession?.planned_end_time;
                      })()}
                      required
                    />
                    {formData.date && !editingSession && (() => {
                      const sameDaySessions = sessions.filter(s => 
                        s.date === formData.date && 
                        s.planned_end_time
                      ).sort((a, b) => (a.planned_end_time || '').localeCompare(b.planned_end_time || ''));
                      const lastSession = sameDaySessions[sameDaySessions.length - 1];
                      if (lastSession) {
                        return (
                          <p className="text-xs text-blue-600 mt-1">
                            Debe ser después de {formatTimeToEST(lastSession.planned_end_time)} (fin de "{lastSession.name}")
                          </p>
                        );
                      }
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planned_end_time">Hora Fin *</Label>
                    <Input 
                      id="planned_end_time" 
                      name="planned_end_time" 
                      type="time"
                      value={formData.planned_end_time}
                      onChange={(e) => updateFormField('planned_end_time', e.target.value)}
                      min={formData.planned_start_time}
                      required
                    />
                    {formData.planned_start_time && (
                      <p className="text-xs text-slate-500 mt-1">
                        Debe ser después de {formatTimeToEST(formData.planned_start_time)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_stage_call_offset_min">Citación de Equipos (min antes)</Label>
                    <Input 
                      id="default_stage_call_offset_min" 
                      name="default_stage_call_offset_min" 
                      type="number"
                      value={formData.default_stage_call_offset_min}
                      onChange={(e) => updateFormField('default_stage_call_offset_min', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session_color">Color de Sesión</Label>
                  <Select name="session_color" value={formData.session_color} onValueChange={(value) => updateFormField('session_color', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="blue">Azul</SelectItem>
                      <SelectItem value="pink">Rosa</SelectItem>
                      <SelectItem value="orange">Naranja</SelectItem>
                      <SelectItem value="yellow">Amarillo</SelectItem>
                      <SelectItem value="purple">Morado</SelectItem>
                      <SelectItem value="red">Rojo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea 
                    id="notes" 
                    name="notes" 
                    value={formData.notes}
                    onChange={(e) => updateFormField('notes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />
              
            <div>
              <h3 className="font-bold text-lg mb-4 text-slate-900">Equipo y Personal</h3>
              <div className="grid md:grid-cols-2 gap-4 max-w-full">
                <div className="space-y-2">
                  <Label htmlFor="admin_team">Administración</Label>
                    <Input 
                      id="admin_team" 
                      name="admin_team" 
                      value={formData.admin_team}
                      onChange={(e) => updateFormField('admin_team', e.target.value)}
                      placeholder="Isabel Gómez / Yassiel Santos"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coordinators">Coordinadores</Label>
                    <Input 
                      id="coordinators" 
                      name="coordinators" 
                      value={formData.coordinators}
                      onChange={(e) => updateFormField('coordinators', e.target.value)}
                      placeholder="Rita R. & Indiana"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sound_team">Equipo de Sonido</Label>
                    <Input 
                      id="sound_team" 
                      name="sound_team" 
                      value={formData.sound_team}
                      onChange={(e) => updateFormField('sound_team', e.target.value)}
                      placeholder="P. Randy G."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tech_team">Equipo Técnico</Label>
                    <Input 
                      id="tech_team" 
                      name="tech_team" 
                      value={formData.tech_team}
                      onChange={(e) => updateFormField('tech_team', e.target.value)}
                      placeholder="Rick & Danny"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ushers_team">Equipo de Ujieres</Label>
                    <Input 
                      id="ushers_team" 
                      name="ushers_team" 
                      value={formData.ushers_team}
                      onChange={(e) => updateFormField('ushers_team', e.target.value)}
                      placeholder="Emilio & Magda H."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="translation_team">Equipo de Traducción</Label>
                    <Input 
                      id="translation_team" 
                      name="translation_team" 
                      value={formData.translation_team}
                      onChange={(e) => updateFormField('translation_team', e.target.value)}
                      placeholder="Jeremy Mateo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hospitality_team">Equipo de Hospitalidad</Label>
                    <Input 
                      id="hospitality_team" 
                      name="hospitality_team" 
                      value={formData.hospitality_team}
                      onChange={(e) => updateFormField('hospitality_team', e.target.value)}
                      placeholder="Mercedes G. & Verla"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photography_team">Fotografía</Label>
                    <Input 
                      id="photography_team" 
                      name="photography_team" 
                      value={formData.photography_team}
                      onChange={(e) => updateFormField('photography_team', e.target.value)}
                      placeholder="Jeremy M."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="worship_leader">Líder de Alabanza</Label>
                    <Input 
                      id="worship_leader" 
                      name="worship_leader" 
                      value={formData.worship_leader}
                      onChange={(e) => updateFormField('worship_leader', e.target.value)}
                      placeholder="Anthony Estrella"
                    />
                  </div>
              </div>
            </div>

            </div>
            <div className="flex justify-end gap-3 pt-4 border-t shrink-0 px-6 pb-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                {editingSession ? 'Guardar Cambios' : 'Crear Sesión'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}