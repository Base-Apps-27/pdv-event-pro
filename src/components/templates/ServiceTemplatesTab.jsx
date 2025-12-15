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
  const queryClient = useQueryClient();
  const [expandedSegments, setExpandedSegments] = useState({});

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
    "9:30am": [],
    "11:30am": [],
    coordinators: { "9:30am": "", "11:30am": "" },
    ujieres: { "9:30am": "", "11:30am": "" },
    sound: { "9:30am": "", "11:30am": "" },
    luces: { "9:30am": "", "11:30am": "" }
  });

  useEffect(() => {
    if (existingBlueprint) {
      setBlueprintData(existingBlueprint);
    } else {
      // Initialize with default structure
      setBlueprintData({
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
      if (field === 'songs') {
        updated[service][segmentIndex].songs = value;
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
      [service]: [...prev[service], {
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
        [service]: prev[service].filter((_, i) => i !== idx)
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
    
    const items = Array.from(blueprintData[service]);
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
        <Button size="sm" onClick={() => addSegment(service)} className="print:hidden">
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
                              <Label className="text-xs font-semibold text-pdv-green">Estructura de Canciones</Label>
                              {segment.songs.map((song, sIdx) => (
                                <div key={sIdx} className="text-xs text-gray-500">
                                  Canción {sIdx + 1} (placeholder)
                                </div>
                              ))}
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
        <Button onClick={handleSave} className="bg-pdv-teal text-white">
          <Save className="w-4 h-4 mr-2" />
          Guardar Blueprint
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {renderServiceColumn("9:30am", "9:30 a.m.", "text-red-600")}
        {renderServiceColumn("11:30am", "11:30 a.m.", "text-blue-600")}
      </div>
    </div>
  );
}