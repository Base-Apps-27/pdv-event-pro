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
import { Save, X, FileText, Plus, Trash2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { formatTimeToEST } from "@/utils/timeFormat";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", 
  "Especial", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Artes"
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
  "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres", "Kids", "Other"
];

export default function SegmentFormTwoColumn({ session, segment, templates, onClose, sessionId }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [overrideCallTime, setOverrideCallTime] = useState(!!segment?.stage_call_offset_min);
  const [actionForm, setActionForm] = useState({
    label: "",
    department: "Other",
    time_hint: "",
    details: ""
  });
  const [formData, setFormData] = useState({
    title: segment?.title || "",
    segment_type: segment?.segment_type || "Plenaria",
    presenter: segment?.presenter || "",
    description_details: segment?.description_details || "",
    start_time: segment?.start_time || "",
    duration_min: segment?.duration_min || 30,
    stage_call_offset_min: segment?.stage_call_offset_min || session?.default_stage_call_offset_min || 15,
    projection_notes: segment?.projection_notes || "",
    sound_notes: segment?.sound_notes || "",
    ushers_notes: segment?.ushers_notes || "",
    translation_notes: segment?.translation_notes || "",
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
    translator_name: segment?.translator_name || "",
    major_break: segment?.major_break || false,
  });

  const calculateTimes = (startTime, durationMin, offsetMin) => {
    if (!startTime || !durationMin) return { end_time: "", stage_call_time: "" };
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMin;
    const stageCallMinutes = startMinutes - offsetMin;

    const formatTime = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      end_time: formatTime(endMinutes),
      stage_call_time: formatTime(stageCallMinutes)
    };
  };

  const times = calculateTimes(
    formData.start_time,
    formData.duration_min,
    overrideCallTime ? formData.stage_call_offset_min : session?.default_stage_call_offset_min || 15
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
          stage_call_offset_min: template.default_stage_call_offset_min || prev.stage_call_offset_min,
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

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      session_id: sessionId,
      ...formData,
      ...times,
      stage_call_offset_min: overrideCallTime ? formData.stage_call_offset_min : null,
    };

    if (segment) {
      updateMutation.mutate({ id: segment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isWorshipType = formData.segment_type === "Alabanza";
  const isPlenariaType = formData.segment_type === "Plenaria";
  const isBreakType = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
  const isTechOnly = formData.segment_type === "TechOnly";
  const needsPresenter = !isBreakType && !isTechOnly;

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

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* LEFT COLUMN - Content */}
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-4 text-slate-900">Contenido del Momento</h3>

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
                    <Label htmlFor="presenter">
                      {isWorshipType ? "Líder de Alabanza" : isPlenariaType ? "Predicador" : "Presentador"}
                    </Label>
                    <Input 
                      id="presenter" 
                      value={formData.presenter}
                      onChange={(e) => setFormData({...formData, presenter: e.target.value})}
                      placeholder="Nombre"
                    />
                  </div>
                )}

                {isWorshipType && (
                  <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
                    <div className="flex items-center justify-between">
                      <Label>Canciones</Label>
                      <Input 
                        type="number"
                        min="1"
                        max="6"
                        value={formData.number_of_songs}
                        onChange={(e) => setFormData({...formData, number_of_songs: parseInt(e.target.value) || 1})}
                        className="w-16 h-8"
                      />
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
                            placeholder="Vocalista"
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

                <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="requires_translation"
                      checked={formData.requires_translation}
                      onCheckedChange={(checked) => setFormData({...formData, requires_translation: checked})}
                    />
                    <label htmlFor="requires_translation" className="text-sm cursor-pointer font-medium">
                      Requiere traducción
                    </label>
                  </div>

                  {formData.requires_translation && (
                    <Input 
                      value={formData.translator_name}
                      onChange={(e) => setFormData({...formData, translator_name: e.target.value})}
                      placeholder="Nombre del traductor"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Execution */}
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-4 text-slate-900">Detalles de Ejecución</h3>

              <div className="space-y-4">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <Label className="font-semibold mb-3 block">Horarios</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Inicio</Label>
                      <Input 
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Duración (min)</Label>
                      <Input 
                        type="number"
                        value={formData.duration_min}
                        onChange={(e) => setFormData({...formData, duration_min: parseInt(e.target.value)})}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {times.end_time && (
                    <div className="mt-3 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Fin estimado:</span>
                        <span className="font-mono font-medium">{formatTimeToEST(times.end_time)}</span>
                      </div>
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Llegada de Equipos</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOverrideCallTime(!overrideCallTime)}
                        className="h-7 text-xs"
                      >
                        {overrideCallTime ? "Usar predeterminado" : "Personalizar"}
                      </Button>
                    </div>

                    {overrideCallTime ? (
                      <Input 
                        type="number"
                        value={formData.stage_call_offset_min}
                        onChange={(e) => setFormData({...formData, stage_call_offset_min: parseInt(e.target.value)})}
                        className="h-9"
                        placeholder="min antes"
                      />
                    ) : (
                      <div className="text-sm bg-white p-2 rounded border">
                        Predeterminado: {session?.default_stage_call_offset_min || 15} min antes
                      </div>
                    )}

                    {times.stage_call_time && (
                      <div className="text-sm text-blue-600 font-medium">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Llamado: {formatTimeToEST(times.stage_call_time)}
                      </div>
                    )}
                  </div>
                </Card>

                <div className="space-y-3">
                  <Label className="font-semibold">Notas para Equipos</Label>
                  
                  {!isBreakType && (
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

                  {!isBreakType && !isTechOnly && (
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

                  {formData.requires_translation && (
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

                  <div className="space-y-1">
                    <Label className="text-xs text-gray-700">Otras Notas</Label>
                    <Textarea 
                      value={formData.other_notes}
                      onChange={(e) => setFormData({...formData, other_notes: e.target.value})}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>

                {segment && (
                  <Card className="p-3 bg-slate-50 border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Acciones ({actions.length})</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowActions(!showActions)}
                        className="h-7"
                      >
                        {showActions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>

                    {showActions && (
                      <div className="space-y-2 mt-3">
                        {actions.map((action) => (
                          <div key={action.id} className="bg-white p-2 rounded border text-xs flex justify-between items-start">
                            <div className="flex-1">
                              <Badge variant="outline" className="text-xs">{action.department}</Badge>
                              <div className="font-medium mt-1">{action.label}</div>
                              {action.time_hint && <div className="text-slate-500 italic">{action.time_hint}</div>}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAction(action)}
                                className="h-6 w-6 p-0"
                              >
                                <FileText className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteActionMutation.mutate(action.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div className="space-y-2 mt-3 pt-3 border-t">
                          <Input
                            value={actionForm.label}
                            onChange={(e) => setActionForm({...actionForm, label: e.target.value})}
                            placeholder="Etiqueta"
                            className="h-8 text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={actionForm.department}
                              onValueChange={(value) => setActionForm({...actionForm, department: value})}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPARTMENTS.map((dept) => (
                                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={actionForm.time_hint}
                              onChange={(e) => setActionForm({...actionForm, time_hint: e.target.value})}
                              placeholder="Pista"
                              className="h-8 text-sm"
                            />
                          </div>
                          <Textarea
                            value={actionForm.details}
                            onChange={(e) => setActionForm({...actionForm, details: e.target.value})}
                            rows={2}
                            placeholder="Detalles..."
                            className="text-sm"
                          />
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
                              <Plus className="w-3 h-3 mr-1" />
                              {editingAction ? "Actualizar" : "Añadir"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Visibilidad</Label>
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
        </div>
      </div>

      <div className="border-t bg-slate-50 p-4 flex justify-end gap-3">
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