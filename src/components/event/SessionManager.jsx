import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, Clock, Edit, Trash2, List, ChevronRight, Users, ChevronDown, ChevronUp, RefreshCw, Utensils, Bookmark, Copy } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import SegmentList from "../session/SegmentList";
import SegmentFormTwoColumn from "../session/SegmentFormTwoColumn";
import PreSessionDetailsForm from "../session/PreSessionDetailsForm";
import HospitalityTasksModal from "../session/HospitalityTasksModal";
import StreamBlockList from "../session/StreamBlockList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { logCreate, logUpdate, logDelete } from "@/components/utils/editActionLogger";
import { hasPermission } from "@/components/utils/permissions";

// SessionManager - handles session CRUD with edit logging
// user prop is required for audit logging of create/update/delete actions
// Permission-aware: LivestreamAdmin (manage_stream_blocks only) gets read-only sessions,
// can only interact with the Livestream tab on sessions that have has_livestream enabled.
export default function SessionManager({ eventId, serviceId, sessions, segments, event, user }) {
  // Permission booleans for scoped rendering
  const canEditSessions = hasPermission(user, 'edit_events');
  const canEditSegments = hasPermission(user, 'edit_events');
  const canManageStreamBlocks = hasPermission(user, 'manage_stream_blocks');
  // Stream-only user: has manage_stream_blocks but NOT edit_events
  const isStreamOnly = canManageStreamBlocks && !canEditSessions;
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [showPreSessionDetailsDialog, setShowPreSessionDetailsDialog] = useState(false);
  // Hospitality modal has its own sessionId state to decouple from segment expansion
  // This ensures the modal always knows which session it's operating on
  const [hospitalityModalSessionId, setHospitalityModalSessionId] = useState(null);
  const [formData, setFormData] = useState({});
  const [fieldOrigins, setFieldOrigins] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.entities.Session.create(data);
      await logCreate('Session', created, eventId || serviceId, user);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId || serviceId]);
      queryClient.invalidateQueries(['editActionLogs']);
      setShowDialog(false);
      setEditingSession(null);
      toast.success("Sesión creada ✓");
    },
    onError: (err) => toast.error(`Error al crear sesión: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, previousState }) => {
      const updated = await base44.entities.Session.update(id, data);
      await logUpdate('Session', id, previousState, { ...previousState, ...data }, eventId || serviceId, user);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId || serviceId]);
      queryClient.invalidateQueries(['editActionLogs']);
      setShowDialog(false);
      setEditingSession(null);
      toast.success("Sesión actualizada ✓");
    },
    onError: (err) => toast.error(`Error al actualizar sesión: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionToDelete) => {
      await base44.entities.Session.delete(sessionToDelete.id);
      await logDelete('Session', sessionToDelete, eventId || serviceId, user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', eventId || serviceId]);
      queryClient.invalidateQueries(['editActionLogs']);
      toast.success("Sesión eliminada");
    },
    onError: (err) => toast.error(`Error al eliminar sesión: ${err.message}`),
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
    setFieldOrigins(session?.field_origins || {});
    
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
      lights_team: session?.lights_team || '',
      video_team: session?.video_team || '',
      tech_team: session?.tech_team || '',
      ushers_team: session?.ushers_team || '',
      translation_team: session?.translation_team || '',
      hospitality_team: session?.hospitality_team || '',
      photography_team: session?.photography_team || '',
      worship_leader: session?.worship_leader || '',
      session_color: session?.session_color || 'blue',
      is_translated_session: session?.is_translated_session || false,
      has_livestream: session?.has_livestream || false,
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
          toast.warning(`La sesión se solapa con "${existingSession.name}" (${formatTimeToEST(existingStart)} - ${formatTimeToEST(existingEnd)}). Por favor ajusta los horarios.`);
          return;
        }
      }
    }
    
    const data = {
      ...(eventId ? { event_id: eventId } : {}),
      ...(serviceId ? { service_id: serviceId } : {}),
      ...formData,
      default_stage_call_offset_min: parseInt(formData.default_stage_call_offset_min || 15),
      order: editingSession?.order || sessions.length + 1,
      field_origins: fieldOrigins,
    };

    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data, previousState: editingSession });
    } else {
      createMutation.mutate(data);
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
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
        {canEditSessions && (
          <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Sesión
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {isStreamOnly ? 'No hay sesiones con Livestream' : 'No hay sesiones'}
          </h3>
          <p className="text-slate-500 mb-4">
            {isStreamOnly 
              ? 'El administrador principal debe crear sesiones y habilitar Livestream'
              : 'Comienza agregando la primera sesión del evento'}
          </p>
          {canEditSessions && (
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Sesión
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {/* Stream-only users only see sessions with has_livestream enabled */}
          {[...(isStreamOnly ? sessions.filter(s => s.has_livestream) : sessions)].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            const aTime = a.planned_start_time || '';
            const bTime = b.planned_start_time || '';
            return aTime.localeCompare(bTime);
          }).map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const sessionSegments = getSessionSegments(session.id);

            return (
              <Card key={session.id} className={`hover:shadow-md transition-shadow border-l-4 ${sessionColors[session.session_color || 'blue']}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <CardTitle className="text-xl">{session.name}</CardTitle>
                        {session.origin === 'template' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="h-5 px-1 bg-blue-50 text-blue-600 border-blue-200 text-[10px]">
                                  <Bookmark className="w-3 h-3 mr-1" />
                                  Plantilla
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Esta sesión proviene de una plantilla</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {session.origin === 'duplicate' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="h-5 px-1 bg-amber-50 text-amber-600 border-amber-200 text-[10px]">
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copia
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Esta sesión es una copia duplicada</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      
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
                            Citación de Equipos: {session.default_stage_call_offset_min} min antes
                          </span>
                        </div>
                      )}

                      {session.is_translated_session && (
                        <div className="mt-2 mb-1">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">
                            <Users className="w-3 h-3 mr-1" />
                            Sesión Bilingüe
                          </Badge>
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
                        {session.lights_team && (
                          <div className="bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            <span className="font-bold text-amber-700">LUCES:</span>
                            <span className="text-slate-700 ml-1">{session.lights_team}</span>
                          </div>
                        )}
                        {session.video_team && (
                          <div className="bg-cyan-50 px-2 py-1 rounded border border-cyan-200">
                            <span className="font-bold text-cyan-700">VIDEO:</span>
                            <span className="text-slate-700 ml-1">{session.video_team}</span>
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
                      {isStreamOnly ? 'Stream Blocks' : 'Ver Segmentos'}
                      {isExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>
                    {canEditSessions && (
                      <>
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
                          onClick={() => setHospitalityModalSessionId(session.id)}
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
                              deleteMutation.mutate(session);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t pt-3">
                      {/* Stream-only users: only see the stream editor on livestream sessions */}
                      {isStreamOnly ? (
                        session.has_livestream ? (
                          <div className="grid md:grid-cols-3 gap-6">
                            {/* Left Rail: Read-only segment reference */}
                            <div className="md:col-span-1 border-r border-slate-100 pr-4 opacity-70 hover:opacity-100 transition-opacity hidden md:block">
                              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Referencia: Sala Principal</h4>
                              <div className="space-y-2 text-xs">
                                {sessionSegments.map((seg, idx) => (
                                  <div key={seg.id} className="p-2 border rounded bg-slate-50 flex justify-between">
                                    <div>
                                      <span className="font-bold mr-2 text-slate-500">{idx + 1}.</span>
                                      {seg.title}
                                    </div>
                                    <div className="font-mono text-slate-400">{formatTimeToEST(seg.start_time)}</div>
                                  </div>
                                ))}
                                {sessionSegments.length === 0 && (
                                  <p className="text-slate-400 italic py-4 text-center">Esperando que el admin cree segmentos...</p>
                                )}
                              </div>
                            </div>
                            {/* Right Rail: Stream Editor (full CRUD for stream-only user) */}
                            <div className="md:col-span-2">
                              <StreamBlockList 
                                sessionId={session.id}
                                segments={sessionSegments}
                                sessionDate={session.date}
                                user={user}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            <p>Livestream no habilitado para esta sesión.</p>
                            <p className="text-xs mt-1">El administrador principal debe habilitar Livestream en esta sesión.</p>
                          </div>
                        )
                      ) : session.has_livestream ? (
                        <Tabs defaultValue="main" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="main">Programa Principal (Sala)</TabsTrigger>
                            <TabsTrigger value="stream" className="flex items-center gap-2">
                              Livestream
                              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1 h-4">LIVE</Badge>
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="main" className="space-y-3 mt-0">
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
                              user={user}
                            />
                          </TabsContent>
                          
                          <TabsContent value="stream" className="mt-0">
                            <div className="grid md:grid-cols-3 gap-6">
                              {/* Left Rail: Reference */}
                              <div className="md:col-span-1 border-r border-slate-100 pr-4 opacity-70 hover:opacity-100 transition-opacity hidden md:block">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Referencia: Sala Principal</h4>
                                <div className="space-y-2 text-xs">
                                  {sessionSegments.map((seg, idx) => (
                                    <div key={seg.id} className="p-2 border rounded bg-slate-50 flex justify-between">
                                      <div>
                                        <span className="font-bold mr-2 text-slate-500">{idx + 1}.</span>
                                        {seg.title}
                                      </div>
                                      <div className="font-mono text-slate-400">{formatTimeToEST(seg.start_time)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Right Rail: Stream Editor */}
                              <div className="md:col-span-2">
                                <StreamBlockList 
                                  sessionId={session.id}
                                  segments={sessionSegments}
                                  sessionDate={session.date}
                                  user={user}
                                />
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <div className="space-y-3">
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
                            user={user}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CRITICAL: Use fresh segment from query, not stale editingSegment state
          editingSegment holds the snapshot from when user clicked edit
          segments array is refetched after save, so lookup by ID gets fresh data
          This prevents stale display after save-and-reopen without closing dialog */}
      <Dialog open={showSegmentForm} onOpenChange={setShowSegmentForm}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle>
            <DialogDescription className="sr-only">Formulario de segmento</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <SegmentFormTwoColumn 
              session={sessions.find(s => s.id === expandedSessionId)}
              segment={editingSegment ? segments.find(s => s.id === editingSegment.id) || editingSegment : null}
              templates={templates}
              onClose={handleCloseSegmentForm}
              sessionId={expandedSessionId}
              user={user}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreSessionDetailsDialog} onOpenChange={setShowPreSessionDetailsDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 border-b border-gray-100 p-6 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">Detalles Pre-Sesión</DialogTitle>
            <DialogDescription className="sr-only">Formulario de detalles pre-sesión</DialogDescription>
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
        sessionId={hospitalityModalSessionId} 
        isOpen={!!hospitalityModalSessionId} 
        onClose={() => setHospitalityModalSessionId(null)}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 border-b border-gray-100 p-6 pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingSession ? 'Editar Sesión' : 'Nueva Sesión'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Section Navigation Pills */}
            <div className="px-6 pt-4 pb-2 bg-white border-b shrink-0">
              <div className="flex gap-2">
                <Badge 
                  variant="outline" 
                  className="bg-blue-50 border-blue-300 text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => document.getElementById('section-basic-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Información Básica
                </Badge>
                <Badge 
                  variant="outline" 
                  className="bg-green-50 border-green-300 text-green-700 cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => document.getElementById('section-team')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <Users className="w-3 h-3 mr-1" />
                  Equipo y Personal
                </Badge>
              </div>
            </div>

            <div className="space-y-0 overflow-y-auto flex-1">
            {/* Section 1: Basic Info */}
            <div id="section-basic-info" className="bg-blue-50/30 border-l-4 border-blue-500 px-6 py-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 uppercase font-['Bebas_Neue'] tracking-wide">Información Básica</h3>
              </div>
              <div className="space-y-4 max-w-full">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Sesión *</Label>
                  <div className="relative">
                    <Input 
                      id="name" 
                      name="name" 
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      required 
                      placeholder="Viernes PM / Sábado AM"
                    />
                    <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'name')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Fecha *</Label>
                  <div className="relative">
                    <Select 
                      value={formData.date} 
                      onValueChange={(val) => updateFormField('date', val)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar fecha del evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Generate date range from event start_date to end_date
                          if (!event?.start_date) return <SelectItem value={null}>No hay fechas disponibles</SelectItem>;
                          
                          const startDate = new Date(event.start_date + 'T00:00:00');
                          const endDate = event.end_date ? new Date(event.end_date + 'T00:00:00') : startDate;
                          const dates = [];
                          
                          // Generate all dates in range
                          let currentDate = new Date(startDate);
                          while (currentDate <= endDate) {
                            const year = currentDate.getFullYear();
                            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                            const day = String(currentDate.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${day}`;
                            
                            // Format display: "2/13/26 - Jueves"
                            const displayMonth = currentDate.getMonth() + 1;
                            const displayDay = currentDate.getDate();
                            const displayYear = String(currentDate.getFullYear()).slice(-2);
                            const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'long' });
                            const displayText = `${displayMonth}/${displayDay}/${displayYear} - ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
                            
                            dates.push({ value: dateStr, label: displayText });
                            currentDate.setDate(currentDate.getDate() + 1);
                          }
                          
                          return dates.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'date')} />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="planned_start_time">Hora Inicio *</Label>
                    <div className="relative">
                      <TimePicker
                        value={formData.planned_start_time}
                        onChange={(val) => updateFormField('planned_start_time', val)}
                        placeholder="Seleccionar hora"
                        required
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'planned_start_time')} />
                    </div>
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
                    <div className="relative">
                      <TimePicker
                        value={formData.planned_end_time}
                        onChange={(val) => updateFormField('planned_end_time', val)}
                        placeholder="Seleccionar hora"
                        required
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'planned_end_time')} />
                    </div>
                    {formData.planned_start_time && (
                      <p className="text-xs text-slate-500 mt-1">
                        Debe ser después de {formatTimeToEST(formData.planned_start_time)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_stage_call_offset_min">Citación de Equipos (min antes)</Label>
                    <div className="relative">
                      <Input 
                        id="default_stage_call_offset_min" 
                        name="default_stage_call_offset_min" 
                        type="number"
                        value={formData.default_stage_call_offset_min}
                        onChange={(e) => updateFormField('default_stage_call_offset_min', e.target.value)}
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'default_stage_call_offset_min')} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session_color">Color de Sesión</Label>
                  <div className="relative">
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
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'session_color')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <div className="relative">
                    <Textarea 
                      id="notes" 
                      name="notes" 
                      value={formData.notes}
                      onChange={(e) => updateFormField('notes', e.target.value)}
                      rows={3}
                    />
                    <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'notes')} />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="is_translated_session" 
                    checked={formData.is_translated_session}
                    onCheckedChange={(checked) => updateFormField('is_translated_session', checked)}
                  />
                  <label
                    htmlFor="is_translated_session"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Esta sesión requiere traducción (Bilingüe)
                  </label>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t mt-4">
                  <Switch 
                    id="has_livestream" 
                    checked={formData.has_livestream}
                    onCheckedChange={(checked) => updateFormField('has_livestream', checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="has_livestream"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Habilitar Livestream
                    </label>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Activa la pestaña de gestión para el programa paralelo de transmisión.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Team & Personnel */}
            <div id="section-team" className="bg-green-50/30 border-l-4 border-green-500 px-6 py-4 mt-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 uppercase font-['Bebas_Neue'] tracking-wide">Equipo y Personal</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4 max-w-full">
                <div className="space-y-2">
                  <Label htmlFor="admin_team">Administración</Label>
                    <div className="relative">
                      <Input 
                        id="admin_team" 
                        name="admin_team" 
                        value={formData.admin_team}
                        onChange={(e) => updateFormField('admin_team', e.target.value)}
                        placeholder="Isabel Gómez / Yassiel Santos"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'admin_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coordinators">Coordinadores</Label>
                    <div className="relative">
                      <Input 
                        id="coordinators" 
                        name="coordinators" 
                        value={formData.coordinators}
                        onChange={(e) => updateFormField('coordinators', e.target.value)}
                        placeholder="Rita R. & Indiana"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'coordinators')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sound_team">Equipo de Sonido</Label>
                    <div className="relative">
                      <Input 
                        id="sound_team" 
                        name="sound_team" 
                        value={formData.sound_team}
                        onChange={(e) => updateFormField('sound_team', e.target.value)}
                        placeholder="P. Randy G."
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'sound_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lights_team">Equipo de Luces</Label>
                    <div className="relative">
                      <Input 
                        id="lights_team" 
                        name="lights_team" 
                        value={formData.lights_team}
                        onChange={(e) => updateFormField('lights_team', e.target.value)}
                        placeholder="Danny M."
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'lights_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_team">Equipo de Video</Label>
                    <div className="relative">
                      <Input 
                        id="video_team" 
                        name="video_team" 
                        value={formData.video_team}
                        onChange={(e) => updateFormField('video_team', e.target.value)}
                        placeholder="Rick E."
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'video_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tech_team">Equipo Técnico</Label>
                    <div className="relative">
                      <Input 
                        id="tech_team" 
                        name="tech_team" 
                        value={formData.tech_team}
                        onChange={(e) => updateFormField('tech_team', e.target.value)}
                        placeholder="Rick & Danny"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'tech_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ushers_team">Equipo de Ujieres</Label>
                    <div className="relative">
                      <Input 
                        id="ushers_team" 
                        name="ushers_team" 
                        value={formData.ushers_team}
                        onChange={(e) => updateFormField('ushers_team', e.target.value)}
                        placeholder="Emilio & Magda H."
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'ushers_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="translation_team">Equipo de Traducción</Label>
                    <div className="relative">
                      <Input 
                        id="translation_team" 
                        name="translation_team" 
                        value={formData.translation_team}
                        onChange={(e) => updateFormField('translation_team', e.target.value)}
                        placeholder="Jeremy Mateo"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'translation_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hospitality_team">Equipo de Hospitalidad</Label>
                    <div className="relative">
                      <Input 
                        id="hospitality_team" 
                        name="hospitality_team" 
                        value={formData.hospitality_team}
                        onChange={(e) => updateFormField('hospitality_team', e.target.value)}
                        placeholder="Mercedes G. & Verla"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'hospitality_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photography_team">Fotografía</Label>
                    <div className="relative">
                      <Input 
                        id="photography_team" 
                        name="photography_team" 
                        value={formData.photography_team}
                        onChange={(e) => updateFormField('photography_team', e.target.value)}
                        placeholder="Jeremy M."
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'photography_team')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="worship_leader">Líder de Alabanza</Label>
                    <div className="relative">
                      <Input 
                        id="worship_leader" 
                        name="worship_leader" 
                        value={formData.worship_leader}
                        onChange={(e) => updateFormField('worship_leader', e.target.value)}
                        placeholder="Anthony Estrella"
                      />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'worship_leader')} />
                    </div>
                  </div>
              </div>
            </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t shrink-0 px-6 pb-4 bg-white shadow-lg">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" style={gradientStyle} className="text-white font-bold uppercase">
                {editingSession ? 'Guardar Cambios' : 'Crear Sesión'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}