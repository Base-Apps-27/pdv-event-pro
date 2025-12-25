import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Save, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

export default function ServiceTemplatesTab() {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const greenStyle = { color: '#8DC63F' };
  
  const queryClient = useQueryClient();
  const [expandedSegments, setExpandedSegments] = useState({});

  // Hardcoded defaults to merge if database blueprint is incomplete
  const DEFAULT_ACTIONS = {
    "9:30am": {
      "worship": [
        { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
      ],
      "welcome": [],
      "offering": [
        { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
      ],
      "message": [
        { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
        { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
      ]
    },
    "11:30am": {
      "worship": [
        { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
      ],
      "welcome": [],
      "offering": [
        { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
      ],
      "message": [
        { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
        { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
      ]
    }
  };

  // Fetch or create the Sunday blueprint
  const { data: existingBlueprint, isLoading } = useQuery({
    queryKey: ['sunday-blueprint'],
    queryFn: async () => {
      const blueprints = await base44.entities.Service.filter({ status: 'blueprint', day_of_week: 'Sunday' });
      return blueprints[0] || null;
    }
  });

  const [blueprintData, setBlueprintData] = useState({
    name: "Servicios Dominicales",
    day_of_week: "Sunday",
    "9:30am": [
      { title: "Equipo de A&A", type: "worship", duration: 35, songs: [{ title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }], data: {}, actions: [] },
      { title: "Bienvenida y Anuncios", type: "welcome", duration: 5, data: {}, actions: [] },
      { title: "Ofrendas", type: "offering", duration: 5, data: {}, actions: [] },
      { title: "Mensaje", type: "message", duration: 45, data: {}, actions: [] }
    ],
    "11:30am": [
      { title: "Equipo de A&A", type: "worship", duration: 35, songs: [{ title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }], data: {}, actions: [] },
      { title: "Bienvenida y Anuncios", type: "welcome", duration: 5, data: {}, actions: [] },
      { title: "Ofrendas", type: "offering", duration: 5, data: {}, actions: [] },
      { title: "Mensaje", type: "message", duration: 45, data: {}, actions: [] }
    ],
    coordinators: { "9:30am": "", "11:30am": "" },
    ujieres: { "9:30am": "", "11:30am": "" },
    sound: { "9:30am": "", "11:30am": "" },
    luces: { "9:30am": "", "11:30am": "" }
  });

  useEffect(() => {
    if (existingBlueprint) {
      // Ensure existing blueprint has segment arrays, populate with defaults if empty
      const populated = { ...existingBlueprint };

      // Helper to merge default actions into segments
      const mergeDefaultActions = (segments, timeSlot) => {
        return segments.map(seg => {
          // If actions are missing or empty, use defaults based on segment type
          if (!seg.actions || seg.actions.length === 0) {
            const defaultActions = DEFAULT_ACTIONS[timeSlot]?.[seg.type] || [];
            return {
              ...seg,
              actions: defaultActions.map(a => ({ ...a }))
            };
          }
          return seg;
        });
      };

      // Helper to merge default sub_assignments and migrate old data
      const mergeSubAssignments = (segments) => {
        return segments.map(seg => {
          let subAssignments = seg.sub_assignments || [];

          // Migration: Move ministry_leader from data to sub_assignments
          if (seg.data?.ministry_leader && !subAssignments.find(s => s.person_field_name === 'ministry_leader')) {
            subAssignments.push({
              label: 'Ministración de Sanidad y Milagros',
              person_field_name: 'ministry_leader',
              duration_min: 5
            });
          }

          // Migration: Move cierre_leader from data to sub_assignments
          if (seg.data?.cierre_leader && !subAssignments.find(s => s.person_field_name === 'cierre_leader')) {
            subAssignments.push({
              label: 'Cierre',
              person_field_name: 'cierre_leader',
              duration_min: 5
            });
          }

          // Add default sub_assignments based on type if not present
          if (seg.type === 'worship' && !subAssignments.find(s => s.person_field_name === 'ministry_leader')) {
            subAssignments.push({
              label: 'Ministración de Sanidad y Milagros',
              person_field_name: 'ministry_leader',
              duration_min: 5
            });
          }

          if (seg.type === 'message' && !subAssignments.find(s => s.person_field_name === 'cierre_leader')) {
            subAssignments.push({
              label: 'Cierre',
              person_field_name: 'cierre_leader',
              duration_min: 5
            });
          }

          return { ...seg, sub_assignments: subAssignments };
        });
      };

      if (!populated["9:30am"] || populated["9:30am"].length === 0) {
        populated["9:30am"] = [
          { title: "Equipo de A&A", type: "worship", duration: 35, songs: [{ title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }], data: {}, actions: DEFAULT_ACTIONS["9:30am"]["worship"].map(a => ({ ...a })), sub_assignments: [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }] },
          { title: "Bienvenida y Anuncios", type: "welcome", duration: 5, data: {}, actions: [], sub_assignments: [] },
          { title: "Ofrendas", type: "offering", duration: 5, data: {}, actions: DEFAULT_ACTIONS["9:30am"]["offering"].map(a => ({ ...a })), sub_assignments: [] },
          { title: "Mensaje", type: "message", duration: 45, data: {}, actions: DEFAULT_ACTIONS["9:30am"]["message"].map(a => ({ ...a })), sub_assignments: [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }] }
        ];
      } else {
        populated["9:30am"] = mergeSubAssignments(mergeDefaultActions(populated["9:30am"], "9:30am"));
      }

      if (!populated["11:30am"] || populated["11:30am"].length === 0) {
        populated["11:30am"] = [
          { title: "Equipo de A&A", type: "worship", duration: 35, songs: [{ title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }, { title: "", lead: "" }], data: {}, actions: DEFAULT_ACTIONS["11:30am"]["worship"].map(a => ({ ...a })), sub_assignments: [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }] },
          { title: "Bienvenida y Anuncios", type: "welcome", duration: 5, data: {}, actions: [], sub_assignments: [] },
          { title: "Ofrendas", type: "offering", duration: 5, data: {}, actions: DEFAULT_ACTIONS["11:30am"]["offering"].map(a => ({ ...a })), sub_assignments: [] },
          { title: "Mensaje", type: "message", duration: 45, data: {}, actions: DEFAULT_ACTIONS["11:30am"]["message"].map(a => ({ ...a })), sub_assignments: [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }] }
        ];
      } else {
        populated["11:30am"] = mergeSubAssignments(mergeDefaultActions(populated["11:30am"], "11:30am"));
      }
      
      setBlueprintData(populated);
    }
  }, [existingBlueprint]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingBlueprint?.id) {
        return await base44.entities.Service.update(existingBlueprint.id, data);
      } else {
        return await base44.entities.Service.create({ ...data, status: 'blueprint' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sunday-blueprint']);
      alert('Blueprint guardado correctamente');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(blueprintData);
  };

  const updateSegmentField = (service, segmentIndex, field, value) => {
    setBlueprintData(prev => {
      const updated = { ...prev };
      if (!updated[service] || !updated[service][segmentIndex]) return prev;

      if (field === 'songs') {
        updated[service][segmentIndex].songs = value;
      } else if (field === 'actions') {
        updated[service][segmentIndex].actions = value;
      } else if (field === 'sub_assignments') {
        updated[service][segmentIndex].sub_assignments = value;
      } else if (field === 'duration' || field === 'title' || field === 'type') {
        updated[service][segmentIndex][field] = value;
      } else {
        updated[service][segmentIndex].data = {
          ...updated[service][segmentIndex].data,
          [field]: value
        };
      }
      return updated;
    });
  };

  const addSegment = (service) => {
    setBlueprintData(prev => ({
      ...prev,
      [service]: [...(prev[service] || []), {
        title: "",
        type: "Especial",
        duration: 15,
        data: {},
        actions: []
      }]
    }));
  };

  const removeSegment = (service, idx) => {
    if (window.confirm('¿Eliminar este segmento del blueprint?')) {
      setBlueprintData(prev => ({
        ...prev,
        [service]: (prev[service] || []).filter((_, i) => i !== idx)
      }));
    }
  };

  const toggleSegmentExpanded = (service, idx) => {
    const key = `${service}-${idx}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDragEnd = (result, service) => {
    if (!result.destination) return;
    
    const items = Array.from(blueprintData[service] || []);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    setBlueprintData(prev => ({
      ...prev,
      [service]: items
    }));
  };

  if (isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  const renderServiceColumn = (service, title, color) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-2xl font-bold ${color}`}>{title}</h3>
        <Button 
          size="sm" 
          onClick={() => addSegment(service)} 
          className="bg-gray-900 hover:bg-gray-800 text-white print:hidden"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir
        </Button>
      </div>

      <DragDropContext onDragEnd={(result) => handleDragEnd(result, service)}>
        <Droppable droppableId={service}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {blueprintData[service]?.map((segment, idx) => {
                const isExpanded = expandedSegments[`${service}-${idx}`];
                const isSpecial = segment.type === "Especial";
                
                return (
                  <Draggable key={`${service}-${idx}`} draggableId={`${service}-${idx}`} index={idx}>
                    {(provided) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border-l-4 ${isSpecial ? 'border-l-orange-500 bg-orange-50' : color === 'text-red-600' ? 'border-l-red-500' : 'border-l-blue-500'}`}
                      >
                        <CardHeader className="pb-2 bg-gray-50">
                          <div className="flex items-center gap-2 mb-2">
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            </div>
                            {isSpecial ? <Sparkles className="w-4 h-4 text-orange-600" /> : <Clock className="w-4 h-4" />}
                            <Input
                              value={segment.title}
                              onChange={(e) => updateSegmentField(service, idx, 'title', e.target.value)}
                              className="text-lg font-bold border-0 shadow-none p-0 h-auto focus-visible:ring-0 flex-1"
                              placeholder="Título"
                            />
                            <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
                            <Button variant="ghost" size="sm" onClick={() => removeSegment(service, idx)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                          <Select value={segment.type} onValueChange={(value) => updateSegmentField(service, idx, 'type', value)}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="worship">Alabanza</SelectItem>
                              <SelectItem value="message">Mensaje</SelectItem>
                              <SelectItem value="welcome">Bienvenida</SelectItem>
                              <SelectItem value="offering">Ofrenda</SelectItem>
                              <SelectItem value="Especial">Especial</SelectItem>
                            </SelectContent>
                          </Select>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-3">
                          {segment.type === 'worship' && segment.songs && (
                            <div className="space-y-1">
                             <Label className="text-xs font-semibold" style={greenStyle}>Estructura de Canciones</Label>
                              {segment.songs.map((song, sIdx) => (
                                <div key={sIdx} className="text-xs text-gray-500">
                                  Canción {sIdx + 1} (placeholder)
                                </div>
                              ))}
                            </div>
                          )}

                          {segment.sub_assignments && segment.sub_assignments.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {segment.sub_assignments.map((subAssign, saIdx) => {
                                const personValue = segment.data?.[subAssign.person_field_name] || "";
                                if (!personValue) return null;
                                return (
                                  <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm">
                                    <strong>{subAssign.label}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                    {subAssign.duration_min && <span className="text-xs text-gray-500 ml-2">({subAssign.duration_min} min)</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSegmentExpanded(service, idx)}
                            className="w-full text-xs mt-2"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                            {isExpanded ? "Menos detalles" : "Más detalles"}
                          </Button>

                          {isExpanded && (
                            <div className="space-y-2 pt-2 border-t">
                              <div className="space-y-1">
                                <Label className="text-xs font-semibold">Duración (minutos)</Label>
                                <Input
                                  type="number"
                                  value={segment.duration || 0}
                                  onChange={(e) => updateSegmentField(service, idx, 'duration', parseInt(e.target.value) || 0)}
                                  className="text-xs w-24"
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold">👥 Sub-Asignaciones</Label>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const subAssignments = segment.sub_assignments || [];
                                      updateSegmentField(service, idx, 'sub_assignments', [...subAssignments, { label: '', person_field_name: '', duration_min: 0 }]);
                                    }}
                                    className="h-6 text-xs"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Añadir
                                  </Button>
                                </div>
                                {(segment.sub_assignments || []).map((subAssign, saIdx) => (
                                  <div key={saIdx} className="bg-purple-50 border border-purple-200 rounded p-2 space-y-2">
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="Etiqueta (ej: Ministración)"
                                        value={subAssign.label || ''}
                                        onChange={(e) => {
                                          const subs = [...(segment.sub_assignments || [])];
                                          subs[saIdx] = { ...subs[saIdx], label: e.target.value };
                                          updateSegmentField(service, idx, 'sub_assignments', subs);
                                        }}
                                        className="text-xs flex-1"
                                      />
                                      <Input
                                        placeholder="Campo (ej: ministry_leader)"
                                        value={subAssign.person_field_name || ''}
                                        onChange={(e) => {
                                          const subs = [...(segment.sub_assignments || [])];
                                          subs[saIdx] = { ...subs[saIdx], person_field_name: e.target.value };
                                          updateSegmentField(service, idx, 'sub_assignments', subs);
                                        }}
                                        className="text-xs flex-1"
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Min"
                                        value={subAssign.duration_min || 0}
                                        onChange={(e) => {
                                          const subs = [...(segment.sub_assignments || [])];
                                          subs[saIdx] = { ...subs[saIdx], duration_min: parseInt(e.target.value) || 0 };
                                          updateSegmentField(service, idx, 'sub_assignments', subs);
                                        }}
                                        className="text-xs w-16"
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const subs = (segment.sub_assignments || []).filter((_, i) => i !== saIdx);
                                          updateSegmentField(service, idx, 'sub_assignments', subs);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                      </Button>
                                    </div>
                                    <AutocompleteInput
                                      type="person"
                                      value={segment.data?.[subAssign.person_field_name] || ""}
                                      onChange={(e) => {
                                        updateSegmentField(service, idx, subAssign.person_field_name, e.target.value);
                                      }}
                                      placeholder="Nombre de la persona"
                                      className="text-xs"
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold">🏅 Acciones para Coordinador</Label>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const actions = segment.actions || [];
                                      updateSegmentField(service, idx, 'actions', [...actions, { label: '', timing: 'before_start', offset_min: 0 }]);
                                    }}
                                    className="h-6 text-xs"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Añadir
                                  </Button>
                                </div>
                                {(segment.actions || []).map((action, aIdx) => (
                                  <div key={aIdx} className="bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="Ej: Enviar texto: 844-555-5555"
                                        value={action.label || ''}
                                        onChange={(e) => {
                                          const actions = [...(segment.actions || [])];
                                          actions[aIdx] = { ...actions[aIdx], label: e.target.value };
                                          updateSegmentField(service, idx, 'actions', actions);
                                        }}
                                        className="text-xs flex-1"
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const actions = (segment.actions || []).filter((_, i) => i !== aIdx);
                                          updateSegmentField(service, idx, 'actions', actions);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Textarea
                                placeholder="Notas para Coordinador"
                                value={segment.data?.coordinator_notes || ""}
                                onChange={(e) => updateSegmentField(service, idx, "coordinator_notes", e.target.value)}
                                className="text-xs"
                                rows={2}
                              />
                              <Textarea
                                placeholder="Notas de Proyección"
                                value={segment.data?.projection_notes || ""}
                                onChange={(e) => updateSegmentField(service, idx, "projection_notes", e.target.value)}
                                className="text-xs"
                                rows={2}
                              />
                              <Textarea
                                placeholder="Notas de Sonido"
                                value={segment.data?.sound_notes || ""}
                                onChange={(e) => updateSegmentField(service, idx, "sound_notes", e.target.value)}
                                className="text-xs"
                                rows={2}
                              />
                              <Textarea
                                placeholder="Notas Generales"
                                value={segment.data?.description_details || ""}
                                onChange={(e) => updateSegmentField(service, idx, "description_details", e.target.value)}
                                className="text-xs"
                                rows={2}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Blueprint: Servicios Dominicales</h3>
          <p className="text-sm text-gray-500 mt-1">Define la estructura fija que se aplicará cada semana</p>
        </div>
        <Button onClick={handleSave} style={tealStyle} size="icon" title="Guardar Blueprint">
          <Save className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {renderServiceColumn("9:30am", "9:30 a.m.", "text-red-600")}
        {renderServiceColumn("11:30am", "11:30 a.m.", "text-blue-600")}
      </div>
    </div>
  );
}