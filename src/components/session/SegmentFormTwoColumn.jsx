import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, X, FileText, Plus, Trash2, ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import SegmentTimelinePreview from "./SegmentTimelinePreview";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", 
  "Especial", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Artes", "Breakout"
];

const COLOR_CODES = [
  { value: "worship", label: "Adoración" },
  { value: "preach", label: "Predicación" },
  { value: "break", label: "Descanso" },
  { value: "tech", label: "Técnico" },
  { value: "special", label: "Especial" },
  { value: "default", label: "Predeterminado" }
];

const DEPARTMENTS = [
  "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Kids", "Coordinador", "Stage & Decor", "Other"
];

export default function SegmentFormTwoColumn({ session, segment, templates, onClose, sessionId }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [editingAction, setEditingAction] = useState(null);
  const [actionForm, setActionForm] = useState({
    label: "",
    department: "Other",
    time_hint: "",
    details: ""
  });
  const [breakoutRooms, setBreakoutRooms] = useState(segment?.breakout_rooms || []);
  
  // Fetch segments to calculate suggested start time and validate overlaps
  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: () => base44.entities.Segment.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId,
  });
  
  // Calculate suggested start time for new segments
  const getSuggestedStartTime = () => {
    if (segment) return segment.start_time || "";
    if (allSegments.length === 0) return session?.planned_start_time || "";
    
    const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    return lastSegment.end_time || lastSegment.start_time || "";
  };
  
  const [formData, setFormData] = useState({
    title: segment?.title || "",
    segment_type: segment?.segment_type || "Plenaria",
    presenter: segment?.presenter || "",
    description_details: segment?.description_details || "",
    prep_instructions: segment?.prep_instructions || "",
    start_time: segment?.start_time || getSuggestedStartTime(),
    duration_min: segment?.duration_min || 30,
    projection_notes: segment?.projection_notes || "",
    sound_notes: segment?.sound_notes || "",
    ushers_notes: segment?.ushers_notes || "",
    translation_notes: segment?.translation_notes || "",
    stage_decor_notes: segment?.stage_decor_notes || "",
    other_notes: segment?.other_notes || "",
    show_in_general: segment?.show_in_general ?? true,
    show_in_projection: segment?.show_in_projection ?? true,
    show_in_sound: segment?.show_in_sound ?? true,
    show_in_ushers: segment?.show_in_ushers ?? true,
    color_code: segment?.color_code || "default",
    order: segment?.order || 1,
    message_title: segment?.message_title || "",
    scripture_references: segment?.scripture_references || "",
    number_of_songs: segment?.number_of_songs || 3,
    song_1_title: segment?.song_1_title || "",
    song_1_lead: segment?.song_1_lead || "",
    song_2_title: segment?.song_2_title || "",
    song_2_lead: segment?.song_2_lead || "",
    song_3_title: segment?.song_3_title || "",
    song_3_lead: segment?.song_3_lead || "",
    song_4_title: segment?.song_4_title || "",
    song_4_lead: segment?.song_4_lead || "",
    song_5_title: segment?.song_5_title || "",
    song_5_lead: segment?.song_5_lead || "",
    song_6_title: segment?.song_6_title || "",
    song_6_lead: segment?.song_6_lead || "",
    requires_translation: segment?.requires_translation || false,
    translation_mode: segment?.translation_mode || "InPerson",
    translator_name: segment?.translator_name || "",
    major_break: segment?.major_break || false,
    room_id: segment?.room_id || "",
    has_video: segment?.has_video || false,
    video_name: segment?.video_name || "",
    video_location: segment?.video_location || "",
    video_owner: segment?.video_owner || "",
    video_length_sec: segment?.video_length_sec || 0,
    art_types: segment?.art_types || [],
    drama_handheld_mics: segment?.drama_handheld_mics || 0,
    drama_headset_mics: segment?.drama_headset_mics || 0,
    drama_start_cue: segment?.drama_start_cue || "",
    drama_end_cue: segment?.drama_end_cue || "",
    drama_has_song: segment?.drama_has_song || false,
    drama_song_title: segment?.drama_song_title || "",
    drama_song_source: segment?.drama_song_source || "",
    drama_song_owner: segment?.drama_song_owner || "",
    dance_has_song: segment?.dance_has_song || false,
    dance_song_title: segment?.dance_song_title || "",
    dance_song_source: segment?.dance_song_source || "",
    dance_song_owner: segment?.dance_song_owner || "",
    dance_handheld_mics: segment?.dance_handheld_mics || 0,
    dance_headset_mics: segment?.dance_headset_mics || 0,
    dance_start_cue: segment?.dance_start_cue || "",
    dance_end_cue: segment?.dance_end_cue || "",
    art_other_description: segment?.art_other_description || "",
  });

  const calculateTimes = (startTime, durationMin) => {
    if (!startTime || !durationMin) return { end_time: "" };
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMin;

    const formatTime = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      end_time: formatTime(endMinutes)
    };
  };

  const times = calculateTimes(
    formData.start_time,
    formData.duration_min
  );

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.default_title || prev.title,
          segment_type: template.segment_type,
          duration_min: template.default_duration_min || prev.duration_min,
          projection_notes: template.default_projection_notes || "",
          sound_notes: template.default_sound_notes || "",
          ushers_notes: template.default_ushers_notes || "",
          color_code: template.default_color_code || "default",
          show_in_general: template.show_in_general ?? true,
          show_in_projection: template.show_in_projection ?? true,
          show_in_sound: template.show_in_sound ?? true,
          show_in_ushers: template.show_in_ushers ?? true,
        }));
      }
    }
  }, [selectedTemplate, templates]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Segment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['segmentActions', segment?.id],
    queryFn: () => segment?.id ? base44.entities.SegmentAction.filter({ segment_id: segment.id }, 'order') : [],
    enabled: !!segment?.id,
  });

  const createActionMutation = useMutation({
    mutationFn: (data) => base44.entities.SegmentAction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentActions', segment?.id]);
      setActionForm({ label: "", department: "Other", time_hint: "", details: "" });
      setEditingAction(null);
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SegmentAction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentActions', segment?.id]);
      setActionForm({ label: "", department: "Other", time_hint: "", details: "" });
      setEditingAction(null);
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (id) => base44.entities.SegmentAction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['segmentActions', segment?.id]);
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate segment times don't overlap with other segments in the same session
    if (formData.start_time && times.end_time && allSegments) {
      const otherSegments = allSegments.filter(s => s.id !== segment?.id);
      
      for (const existingSegment of otherSegments) {
        if (existingSegment.start_time && existingSegment.end_time) {
          const newStart = formData.start_time;
          const newEnd = times.end_time;
          const existingStart = existingSegment.start_time;
          const existingEnd = existingSegment.end_time;
          
          // Check for overlap
          if ((newStart >= existingStart && newStart < existingEnd) ||
              (newEnd > existingStart && newEnd <= existingEnd) ||
              (newStart <= existingStart && newEnd >= existingEnd)) {
            alert(`El segmento se solapa con "${existingSegment.title}" (${formatTimeToEST(existingStart)} - ${formatTimeToEST(existingEnd)}). Por favor ajusta los horarios.`);
            return;
          }
        }
      }
    }

    const data = {
      session_id: sessionId,
      ...formData,
      ...times,
      breakout_rooms: formData.segment_type === "Breakout" ? breakoutRooms : null,
    };

    if (segment) {
      updateMutation.mutate({ id: segment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addBreakoutRoom = () => {
    setBreakoutRooms([...breakoutRooms, {
      room_id: "",
      hosts: "",
      speakers: "",
      topic: "",
      general_notes: "",
      other_notes: "",
      requires_translation: false,
      translation_mode: "InPerson",
      translator_name: ""
    }]);
  };

  const removeBreakoutRoom = (index) => {
    setBreakoutRooms(breakoutRooms.filter((_, i) => i !== index));
  };

  const updateBreakoutRoom = (index, field, value) => {
    const updated = [...breakoutRooms];
    updated[index] = { ...updated[index], [field]: value };
    setBreakoutRooms(updated);
  };

  const isWorshipType = formData.segment_type === "Alabanza";
  const isPlenariaType = formData.segment_type === "Plenaria";
  const isBreakType = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
  const isTechOnly = formData.segment_type === "TechOnly";
  const isBreakoutType = formData.segment_type === "Breakout";
  const isVideoType = formData.segment_type === "Video";
  const isArtesType = formData.segment_type === "Artes";
  const isMcLedType = ["Bienvenida", "Ofrenda", "Anuncio", "Dinámica", "Oración", "Especial", "Cierre", "MC", "Ministración"].includes(formData.segment_type);
  
  const needsPresenter = !isBreakType && !isTechOnly && !isBreakoutType;
  const showDescription = !isTechOnly && !isVideoType;
  const showTranslation = !isBreakType && !isBreakoutType;
  const showUshersNotes = !isBreakType && !isTechOnly && !isBreakoutType;
  const showProjectionNotes = !isBreakType && !isBreakoutType;
  const showSoundNotes = !isBreakType && !isBreakoutType;
  const showOtherNotes = !isBreakoutType;
  const showActions = !isBreakType;
  
  const hasDrama = formData.art_types?.includes("DANCE");
  const hasDance = formData.art_types?.includes("DANCE");
  const hasArtVideo = formData.art_types?.includes("VIDEO");
  const hasOtherArt = formData.art_types?.includes("OTHER");

  const getPresenterLabel = () => {
    if (isPlenariaType) return "Predicador";
    if (isWorshipType) return "Líder de Alabanza";
    if (isArtesType) return "Grupo / Director";
    return "Presentador";
  };

  // Auto-lock has_video for Video type
  React.useEffect(() => {
    if (isVideoType && !formData.has_video) {
      setFormData(prev => ({ ...prev, has_video: true }));
    }
  }, [isVideoType]);

  const handleAddAction = () => {
    if (!actionForm.label || !segment?.id) return;

    const data = {
      segment_id: segment.id,
      order: editingAction ? editingAction.order : actions.length + 1,
      ...actionForm
    };

    if (editingAction) {
      updateActionMutation.mutate({ id: editingAction.id, data });
    } else {
      createActionMutation.mutate(data);
    }
  };

  const handleEditAction = (action) => {
    setEditingAction(action);
    setActionForm({
      label: action.label,
      department: action.department,
      time_hint: action.time_hint || "",
      details: action.details || ""
    });
  };

  const handleCancelAction = () => {
    setEditingAction(null);
    setActionForm({ label: "", department: "Other", time_hint: "", details: "" });
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const colorCodeLabels = {
    worship: "Adoración",
    preach: "Predicación",
    break: "Descanso",
    tech: "Técnico",
    special: "Especial",
    default: "Predeterminado"
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Sticky Summary Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{formData.title || "Nuevo Segmento"}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <Badge variant="outline" className="text-xs">{formData.segment_type}</Badge>
              {formData.presenter && <span>• {formData.presenter}</span>}
              {formData.start_time && <span>• {formatTimeToEST(formData.start_time)}</span>}
              {times.end_time && <span>→ {formatTimeToEST(times.end_time)}</span>}
              {formData.duration_min && <span>({formData.duration_min}m)</span>}
              {formData.requires_translation && <Badge className="bg-purple-100 text-purple-800 text-xs">TRAD</Badge>}
              <span>• {colorCodeLabels[formData.color_code]}</span>
            </div>
          </div>
        </div>

        {/* Anchor Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => scrollToSection('basico')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Básico</button>
          <button type="button" onClick={() => scrollToSection('contenido')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Contenido</button>
          {segment && <button type="button" onClick={() => scrollToSection('acciones')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Acciones</button>}
          <button type="button" onClick={() => scrollToSection('notas')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Notas</button>
          <button type="button" onClick={() => scrollToSection('otros')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Otros</button>
          {segment && <button type="button" onClick={() => scrollToSection('timeline')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap flex items-center gap-1"><ScrollText className="w-3 h-3"/>Timeline</button>}
        </div>
      </div>

      <div>
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* LEFT COLUMN - Content */}
          <div className="space-y-6">
            <div id="basico" className="bg-white rounded-lg border border-l-4 border-l-pdv-teal border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-teal"></div>
                <h3 className="font-bold text-lg text-slate-900">Información Básica</h3>
              </div>
              
              <div className="p-4">
              {!segment && templates.length > 0 && (
                <Card className="p-3 bg-blue-50 border-blue-200 mb-4">
                  <Label htmlFor="template" className="text-sm">Usar Plantilla</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="mt-1 bg-white">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input 
                    id="title" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required 
                    placeholder="PLENARIA #1: Conquistando"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="segment_type">Tipo *</Label>
                    <Select 
                      value={formData.segment_type}
                      onValueChange={(value) => setFormData({...formData, segment_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color_code">Color</Label>
                    <Select 
                      value={formData.color_code}
                      onValueChange={(value) => setFormData({...formData, color_code: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_CODES.map((color) => (
                          <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {needsPresenter && (
                  <div className="space-y-2">
                    <Label htmlFor="presenter">{getPresenterLabel()}</Label>
                    <Input 
                      id="presenter" 
                      value={formData.presenter}
                      onChange={(e) => setFormData({...formData, presenter: e.target.value})}
                      placeholder="Nombre"
                    />
                  </div>
                )}

                {!isBreakoutType && (
                  <div className="space-y-2">
                    <Label htmlFor="room_id">Sala</Label>
                    <Select 
                      value={formData.room_id}
                      onValueChange={(value) => setFormData({...formData, room_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sala..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              </div>
              </div>
            </div>

            <div id="contenido" className="bg-white rounded-lg border border-l-4 border-l-pdv-blue border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-blue"></div>
                <h3 className="font-bold text-lg text-slate-900">Contenido Específico</h3>
              </div>
              <div className="p-4 space-y-4">
                {formData.has_video && (
                  <div className="space-y-3 bg-blue-50 p-4 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold">Video</Label>
                      {!isVideoType && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({...formData, has_video: false})}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Nombre del Video *</Label>
                      <Input 
                        value={formData.video_name}
                        onChange={(e) => setFormData({...formData, video_name: e.target.value})}
                        placeholder="Video de Apertura"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ubicación</Label>
                      <Input 
                        value={formData.video_location}
                        onChange={(e) => setFormData({...formData, video_location: e.target.value})}
                        placeholder="ProPresenter > Videos > Opening.mp4"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Propietario</Label>
                        <Input 
                          value={formData.video_owner}
                          onChange={(e) => setFormData({...formData, video_owner: e.target.value})}
                          placeholder="PDV Media"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Duración (seg)</Label>
                        <Input 
                          type="number"
                          value={formData.video_length_sec}
                          onChange={(e) => setFormData({...formData, video_length_sec: parseInt(e.target.value) || 0})}
                          placeholder="120"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!formData.has_video && !isVideoType && !isBreakType && !isTechOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({...formData, has_video: true})}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Video
                  </Button>
                )}
                {isBreakoutType && (
                  <div className="space-y-3 bg-amber-50 p-4 rounded border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold">Salas Paralelas</Label>
                      <Button 
                        type="button"
                        size="sm" 
                        onClick={addBreakoutRoom}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Añadir Sala
                      </Button>
                    </div>

                    {breakoutRooms.length === 0 && (
                      <p className="text-sm text-gray-600 text-center py-4">
                        No hay salas definidas. Añade al menos una sala para el breakout.
                      </p>
                    )}

                    {breakoutRooms.map((room, index) => (
                      <Card key={index} className="p-3 bg-white border-gray-300">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Sala {index + 1}</Badge>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeBreakoutRoom(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Sala</Label>
                            <Select 
                              value={room.room_id}
                              onValueChange={(value) => updateBreakoutRoom(index, 'room_id', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {rooms.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Tema/Tópico</Label>
                            <Input 
                              value={room.topic}
                              onChange={(e) => updateBreakoutRoom(index, 'topic', e.target.value)}
                              placeholder="Nombre del taller o tópico"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Anfitrión(es) / Moderador(es)</Label>
                            <Input 
                              value={room.hosts}
                              onChange={(e) => updateBreakoutRoom(index, 'hosts', e.target.value)}
                              placeholder="Nombres de los anfitriones"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Presentador(es) / Panelistas</Label>
                            <Input 
                              value={room.speakers}
                              onChange={(e) => updateBreakoutRoom(index, 'speakers', e.target.value)}
                              placeholder="Nombres de los presentadores"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Notas de Producción</Label>
                            <Input 
                              value={room.general_notes}
                              onChange={(e) => updateBreakoutRoom(index, 'general_notes', e.target.value)}
                              placeholder="Instrucciones generales para producción"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Otras Notas</Label>
                            <Input 
                              value={room.other_notes}
                              onChange={(e) => updateBreakoutRoom(index, 'other_notes', e.target.value)}
                              placeholder="Instrucciones adicionales"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div className="border-t border-gray-200 pt-2 mt-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <Checkbox 
                                id={`requires_translation_${index}`}
                                checked={room.requires_translation}
                                onCheckedChange={(checked) => updateBreakoutRoom(index, 'requires_translation', checked)}
                              />
                              <label htmlFor={`requires_translation_${index}`} className="text-xs font-semibold cursor-pointer">
                                Requiere Traducción
                              </label>
                            </div>

                            {room.requires_translation && (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Modo</Label>
                                  <Select
                                    value={room.translation_mode}
                                    onValueChange={(value) => updateBreakoutRoom(index, 'translation_mode', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="InPerson">En Persona</SelectItem>
                                      <SelectItem value="RemoteBooth">Cabina Remota</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {room.translation_mode === "InPerson" && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Traductor</Label>
                                    <Input 
                                      value={room.translator_name}
                                      onChange={(e) => updateBreakoutRoom(index, 'translator_name', e.target.value)}
                                      placeholder="Nombre"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {isWorshipType && (
                  <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
                    <div className="flex items-center justify-between">
                      <Label>Canciones</Label>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">#</Label>
                        <Input 
                          type="number"
                          min="1"
                          max="6"
                          value={formData.number_of_songs}
                          onChange={(e) => setFormData({...formData, number_of_songs: parseInt(e.target.value) || 1})}
                          className="w-16 h-8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-1">
                      <Label className="text-xs">Título</Label>
                      <Label className="text-xs">Vocalista</Label>
                    </div>

                    {[...Array(formData.number_of_songs || 0)].map((_, idx) => {
                      const songNum = idx + 1;
                      return (
                        <div key={songNum} className="grid grid-cols-2 gap-2">
                          <Input 
                            value={formData[`song_${songNum}_title`]}
                            onChange={(e) => setFormData({...formData, [`song_${songNum}_title`]: e.target.value})}
                            placeholder={`Canción ${songNum}`}
                            className="text-sm"
                          />
                          <Input 
                            value={formData[`song_${songNum}_lead`]}
                            onChange={(e) => setFormData({...formData, [`song_${songNum}_lead`]: e.target.value})}
                            placeholder="Nombre"
                            className="text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {isPlenariaType && (
                  <div className="space-y-3 bg-orange-50 p-4 rounded border border-orange-200">
                    <div className="space-y-2">
                      <Label>Título del Mensaje</Label>
                      <Input 
                        value={formData.message_title}
                        onChange={(e) => setFormData({...formData, message_title: e.target.value})}
                        placeholder="Conquistando nuevas alturas"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Referencias Bíblicas</Label>
                      <Input 
                        value={formData.scripture_references}
                        onChange={(e) => setFormData({...formData, scripture_references: e.target.value})}
                        placeholder="Juan 3:16, Romanos 8:28"
                      />
                    </div>
                  </div>
                )}

                {!isTechOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="description_details">Descripción</Label>
                    <Textarea 
                      id="description_details" 
                      value={formData.description_details}
                      onChange={(e) => setFormData({...formData, description_details: e.target.value})}
                      rows={3}
                      placeholder="Detalles adicionales"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="prep_instructions">Instrucciones de Preparación</Label>
                  <Textarea 
                    id="prep_instructions" 
                    value={formData.prep_instructions}
                    onChange={(e) => setFormData({...formData, prep_instructions: e.target.value})}
                    rows={2}
                    placeholder="Configuración previa, chequeos necesarios..."
                  />
                </div>

                {isBreakType && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="major_break"
                      checked={formData.major_break}
                      onCheckedChange={(checked) => setFormData({...formData, major_break: checked})}
                    />
                    <label htmlFor="major_break" className="text-sm cursor-pointer">
                      Receso Mayor (Almuerzo/Cena)
                    </label>
                  </div>
                )}
              </div>
            </div>

            {segment && showActions && (
              <div id="acciones" className="bg-white rounded-lg border border-l-4 border-l-pdv-green border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pdv-green"></div>
                  <h3 className="font-bold text-lg text-slate-900">Acciones del Segmento</h3>
                </div>
                <div className="p-4 space-y-4">
                  {actions.length > 0 && (
                    <div className="space-y-2">
                      {actions.map((action) => (
                        <div key={action.id} className="bg-white p-3 rounded border text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <Badge variant="outline" className="text-xs">{action.department}</Badge>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAction(action)}
                                className="h-7 w-7 p-0"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteActionMutation.mutate(action.id)}
                                className="h-7 w-7 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="font-medium">{action.label}</div>
                          {action.time_hint && <div className="text-slate-500 italic text-xs mt-0.5">{action.time_hint}</div>}
                          {action.details && <div className="text-slate-600 text-xs mt-1">{action.details}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 pt-3 border-t">
                    <Label className="text-sm font-semibold">Añadir Nueva Acción</Label>
                    <Input
                      value={actionForm.label}
                      onChange={(e) => setActionForm({...actionForm, label: e.target.value})}
                      placeholder="Etiqueta de la acción"
                      className="h-9"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Departamento</Label>
                        <Select
                          value={actionForm.department}
                          onValueChange={(value) => setActionForm({...actionForm, department: value})}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pista de Tiempo</Label>
                        <Input
                          value={actionForm.time_hint}
                          onChange={(e) => setActionForm({...actionForm, time_hint: e.target.value})}
                          placeholder="ej. at 2:30"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Detalles</Label>
                      <Textarea
                        value={actionForm.details}
                        onChange={(e) => setActionForm({...actionForm, details: e.target.value})}
                        rows={2}
                        placeholder="Descripción completa de la acción..."
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingAction && (
                        <Button type="button" variant="outline" size="sm" onClick={handleCancelAction} className="flex-1">
                          Cancelar
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddAction}
                        disabled={!actionForm.label}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {editingAction ? "Actualizar Acción" : "Añadir Acción"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">

            {/* Segment Timeline Preview */}
            {segment && (
              <div id="timeline" className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <SegmentTimelinePreview segments={allSegments} currentSegmentId={segment.id} />
              </div>
            )}

            <div className="bg-white rounded-lg border border-l-4 border-l-pdv-orange border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-orange"></div>
                <h3 className="font-bold text-lg text-slate-900">Timing & Ejecución</h3>
              </div>

              <div className="p-4 space-y-4">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <Label className="font-semibold mb-3 block">Horarios *</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Inicio *</Label>
                      <Input 
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="h-9"
                        min={(() => {
                          if (segment || !allSegments || allSegments.length === 0) return undefined;
                          const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
                          const lastSegment = sortedSegments[sortedSegments.length - 1];
                          return lastSegment?.end_time;
                        })()}
                        required
                      />
                      {!segment && allSegments && allSegments.length > 0 && (() => {
                        const sortedSegments = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
                        const lastSegment = sortedSegments[sortedSegments.length - 1];
                        if (lastSegment?.end_time) {
                          return (
                            <p className="text-xs text-blue-600">
                              Debe ser después de {formatTimeToEST(lastSegment.end_time)} (fin de "{lastSegment.title}")
                            </p>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Duración (min) *</Label>
                      <Input 
                        type="number"
                        value={formData.duration_min}
                        onChange={(e) => setFormData({...formData, duration_min: parseInt(e.target.value)})}
                        className="h-9"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {times.end_time && (
                    <div className="mt-3 text-sm text-slate-600 border-t border-blue-300 pt-2">
                      <div className="flex justify-between">
                        <span>Fin estimado:</span>
                        <span className="font-mono font-medium text-blue-700">{formatTimeToEST(times.end_time)}</span>
                      </div>
                    </div>
                  )}

                  {allSegments && allSegments.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      ⚠️ Los segmentos no deben solaparse dentro de la sesión
                    </div>
                  )}
                </Card>

                {showTranslation && (
                  <Card className="p-4 bg-purple-50 border-purple-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Checkbox 
                        id="requires_translation"
                        checked={formData.requires_translation}
                        onCheckedChange={(checked) => setFormData({...formData, requires_translation: checked})}
                      />
                      <label htmlFor="requires_translation" className="font-semibold cursor-pointer">
                        Requiere Traducción
                      </label>
                    </div>

                    {formData.requires_translation && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Modo</Label>
                          <Select
                            value={formData.translation_mode}
                            onValueChange={(value) => setFormData({...formData, translation_mode: value})}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="InPerson">En Persona</SelectItem>
                              <SelectItem value="RemoteBooth">Cabina Remota</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.translation_mode === "InPerson" && (
                          <div className="space-y-2">
                            <Label className="text-xs">Traductor</Label>
                            <Input 
                              value={formData.translator_name}
                              onChange={(e) => setFormData({...formData, translator_name: e.target.value})}
                              placeholder="Nombre"
                              className="h-9"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}

                <div id="notas" className="bg-white rounded-lg border border-l-4 border-l-purple-500 border-slate-200 shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <h3 className="font-bold text-lg text-slate-900">Notas para Equipos</h3>
                  </div>
                  
                  <div className="p-4 space-y-3">
                  {isBreakoutType && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
                      <p className="text-gray-700">
                        Para segmentos de tipo Breakout, las notas se definen individualmente para cada sala en la sección de "Contenido Específico".
                      </p>
                    </div>
                  )}

                  {!isBreakType && !isBreakoutType && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-purple-700">Proyección</Label>
                        <Textarea 
                          value={formData.projection_notes}
                          onChange={(e) => setFormData({...formData, projection_notes: e.target.value})}
                          rows={2}
                          placeholder="Slides, videos..."
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">Sonido</Label>
                        <Textarea 
                          value={formData.sound_notes}
                          onChange={(e) => setFormData({...formData, sound_notes: e.target.value})}
                          rows={2}
                          placeholder="Micrófonos, cues..."
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}

                  {!isBreakType && !isTechOnly && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-green-700">Ujieres</Label>
                      <Textarea 
                        value={formData.ushers_notes}
                        onChange={(e) => setFormData({...formData, ushers_notes: e.target.value})}
                        rows={2}
                        placeholder="Instrucciones..."
                        className="text-sm"
                      />
                    </div>
                  )}

                  {formData.requires_translation && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-purple-700">Traducción</Label>
                      <Textarea 
                        value={formData.translation_notes}
                        onChange={(e) => setFormData({...formData, translation_notes: e.target.value})}
                        rows={2}
                        placeholder="Instrucciones para traductor..."
                        className="text-sm"
                      />
                    </div>
                  )}

                  {!isBreakType && !isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Stage & Decor</Label>
                      <Textarea 
                        value={formData.stage_decor_notes}
                        onChange={(e) => setFormData({...formData, stage_decor_notes: e.target.value})}
                        rows={2}
                        placeholder="Mover mesas, preparar escenario..."
                        className="text-sm"
                      />
                    </div>
                  )}

                  {!isBreakoutType && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-700">Otras Notas</Label>
                      <Textarea 
                        value={formData.other_notes}
                        onChange={(e) => setFormData({...formData, other_notes: e.target.value})}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>

                </div>
                </div>
              </div>

                <div id="otros" className="bg-white rounded-lg border border-l-4 border-l-slate-500 border-slate-200 shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <h3 className="font-bold text-lg text-slate-900">Opciones de Visibilidad</h3>
                  </div>
                  <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_general"
                        checked={formData.show_in_general}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_general: checked})}
                      />
                      <label htmlFor="show_in_general" className="cursor-pointer">General</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_projection"
                        checked={formData.show_in_projection}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_projection: checked})}
                      />
                      <label htmlFor="show_in_projection" className="cursor-pointer">Proyección</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_sound"
                        checked={formData.show_in_sound}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_sound: checked})}
                      />
                      <label htmlFor="show_in_sound" className="cursor-pointer">Sonido</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show_in_ushers"
                        checked={formData.show_in_ushers}
                        onCheckedChange={(checked) => setFormData({...formData, show_in_ushers: checked})}
                      />
                      <label htmlFor="show_in_ushers" className="cursor-pointer">Ujieres</label>
                    </div>
                  </div>
                </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-slate-50 p-4 flex justify-end gap-3 sticky bottom-0">
        <Button type="button" variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {segment ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}