import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { Calendar, Clock, Save, Plus, Trash2, Printer, ArrowLeft, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { addMinutes, parse, format } from "date-fns";

export default function CustomServiceBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [serviceData, setServiceData] = useState({
    name: "",
    day_of_week: "Sunday",
    time: "10:00",
    date: new Date().toISOString().split('T')[0],
    location: "",
    description: "",
    segments: [
      {
        title: "Equipo de A&A",
        type: "worship",
        duration: 35,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [
          { title: "", lead: "" },
          { title: "", lead: "" },
          { title: "", lead: "" },
          { title: "", lead: "" }
        ],
        description: "",
        actions: []
      },
      {
        title: "Bienvenida y Anuncios",
        type: "welcome",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      },
      {
        title: "Ofrendas",
        type: "offering",
        duration: 5,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      },
      {
        title: "Mensaje",
        type: "message",
        duration: 45,
        presenter: "",
        translator: "",
        preacher: "",
        leader: "",
        messageTitle: "",
        verse: "",
        songs: [],
        description: "",
        actions: []
      }
    ],
    coordinators: "",
    ujieres: "",
    sound: "",
    luces: "",
    notes: ""
  });

  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const getDefaultSegmentForm = () => ({
    title: "",
    type: "Especial",
    duration: 15,
    presenter: "",
    translator: "",
    preacher: "",
    leader: "",
    messageTitle: "",
    verse: "",
    songs: [],
    description: "",
    actions: []
  });

  const [segmentForm, setSegmentForm] = useState(getDefaultSegmentForm());

  const { data: existingService } = useQuery({
    queryKey: ['customService', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const service = await base44.entities.Service.filter({ id: serviceId });
      return service[0] || null;
    },
    enabled: !!serviceId
  });

  useEffect(() => {
    if (existingService) {
      setServiceData(existingService);
    }
  }, [existingService]);

  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      if (serviceId) {
        return await base44.entities.Service.update(serviceId, data);
      } else {
        return await base44.entities.Service.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customService']);
      queryClient.invalidateQueries(['services']);
      alert('Servicio guardado');
    }
  });

  const handleSave = () => {
    saveServiceMutation.mutate({
      ...serviceData,
      status: 'active'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const addSegment = () => {
    if (editingSegmentIdx !== null) {
      const updated = [...serviceData.segments];
      updated[editingSegmentIdx] = segmentForm;
      setServiceData(prev => ({ ...prev, segments: updated }));
    } else {
      setServiceData(prev => ({
        ...prev,
        segments: [...prev.segments, segmentForm]
      }));
    }
    setShowSegmentDialog(false);
    setEditingSegmentIdx(null);
    setSegmentForm(getDefaultSegmentForm());
  };

  const removeSegment = (idx) => {
    setServiceData(prev => ({
      ...prev,
      segments: prev.segments.filter((_, i) => i !== idx)
    }));
  };

  const editSegment = (idx) => {
    setEditingSegmentIdx(idx);
    setSegmentForm(serviceData.segments[idx]);
    setShowSegmentDialog(true);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(serviceData.segments);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    setServiceData(prev => ({ ...prev, segments: items }));
  };

  const calculateTotalTime = () => {
    const total = serviceData.segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
    if (!serviceData.time) return { total, endTime: "N/A" };
    
    const startTime = parse(serviceData.time, "HH:mm", new Date());
    const endTime = addMinutes(startTime, total);
    
    return {
      total,
      endTime: format(endTime, "h:mm a")
    };
  };

  const timeCalc = calculateTotalTime();

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-2">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
              {serviceId ? 'Editar Servicio' : 'Nuevo Servicio Personalizado'}
            </h1>
            <p className="text-gray-500 mt-1">Crea servicios especiales con horarios y elementos personalizados</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSave} className="bg-pdv-teal text-white">
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <div className="w-20 h-1 mx-auto mb-4" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }} />
        <h1 className="text-3xl font-bold uppercase mb-1">{serviceData.name || 'Orden de Servicio'}</h1>
        <p className="text-lg text-gray-600">{serviceData.day_of_week} - {serviceData.date}</p>
        {serviceData.time && <p className="text-sm text-gray-500">{serviceData.time}</p>}
      </div>

      {/* Service Details */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Detalles del Servicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nombre del Servicio *</Label>
              <Input
                value={serviceData.name}
                onChange={(e) => setServiceData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Servicio Especial de Navidad"
              />
            </div>
            <div className="space-y-2">
              <Label>Día de la Semana *</Label>
              <Select value={serviceData.day_of_week} onValueChange={(value) => setServiceData(prev => ({ ...prev, day_of_week: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sunday">Domingo</SelectItem>
                  <SelectItem value="Monday">Lunes</SelectItem>
                  <SelectItem value="Tuesday">Martes</SelectItem>
                  <SelectItem value="Wednesday">Miércoles</SelectItem>
                  <SelectItem value="Thursday">Jueves</SelectItem>
                  <SelectItem value="Friday">Viernes</SelectItem>
                  <SelectItem value="Saturday">Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={serviceData.time}
                onChange={(e) => setServiceData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={serviceData.date}
                onChange={(e) => setServiceData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input
                value={serviceData.location}
                onChange={(e) => setServiceData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Santuario principal"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={serviceData.description}
              onChange={(e) => setServiceData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              placeholder="Descripción breve del servicio..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 uppercase">Programa del Servicio</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="bg-blue-50">
                {timeCalc.total} min total
              </Badge>
              <span className="text-sm text-gray-600">
                Termina: {timeCalc.endTime}
              </span>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditingSegmentIdx(null);
              setSegmentForm(getDefaultSegmentForm());
              setShowSegmentDialog(true);
            }}
            className="bg-pdv-teal text-white print:hidden"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Segmento
          </Button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="segments">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {serviceData.segments.map((segment, idx) => (
                  <Draggable key={`seg-${idx}`} draggableId={`seg-${idx}`} index={idx}>
                    {(provided) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="border-l-4 border-l-pdv-teal"
                      >
                        <CardHeader className="pb-2 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <div {...provided.dragHandleProps} className="print:hidden">
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                              </div>
                              <Clock className="w-4 h-4 text-pdv-teal" />
                              {segment.title}
                              <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                            </CardTitle>
                            <div className="flex gap-2 print:hidden">
                              <Button variant="ghost" size="sm" onClick={() => editSegment(idx)}>
                                Editar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => removeSegment(idx)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-3">
                          <div className="text-sm space-y-1">
                            {segment.presenter && <p><strong>Presentador:</strong> {segment.presenter}</p>}
                            {segment.translator && <p><strong>Traductor:</strong> {segment.translator}</p>}
                            {segment.preacher && <p><strong>Predicador:</strong> {segment.preacher}</p>}
                            {segment.leader && <p><strong>Líder:</strong> {segment.leader}</p>}
                            {segment.messageTitle && <p><strong>Mensaje:</strong> {segment.messageTitle}</p>}
                            {segment.verse && <p><strong>Verso:</strong> {segment.verse}</p>}
                            {segment.songs && segment.songs.length > 0 && (
                              <div>
                                <strong>Canciones:</strong>
                                <ul className="ml-4 list-disc">
                                  {segment.songs.map((song, sIdx) => (
                                    <li key={sIdx}>{song.title} {song.lead && `(${song.lead})`}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {segment.description && <p className="text-gray-600 mt-2">{segment.description}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {serviceData.segments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No hay segmentos añadidos. Haz clic en "Añadir Segmento" para comenzar.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team Section */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Equipo del Servicio</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Coordinador(a)</Label>
            <AutocompleteInput
              type="presenter"
              value={serviceData.coordinators}
              onChange={(e) => setServiceData(prev => ({ ...prev, coordinators: e.target.value }))}
              placeholder="Nombre del coordinador"
            />
          </div>
          <div className="space-y-2">
            <Label>Ujieres</Label>
            <Input
              value={serviceData.ujieres}
              onChange={(e) => setServiceData(prev => ({ ...prev, ujieres: e.target.value }))}
              placeholder="Nombres de ujieres"
            />
          </div>
          <div className="space-y-2">
            <Label>Sonido</Label>
            <Input
              value={serviceData.sound}
              onChange={(e) => setServiceData(prev => ({ ...prev, sound: e.target.value }))}
              placeholder="Equipo de sonido"
            />
          </div>
          <div className="space-y-2">
            <Label>Luces/Proyección</Label>
            <Input
              value={serviceData.luces}
              onChange={(e) => setServiceData(prev => ({ ...prev, luces: e.target.value }))}
              placeholder="Equipo de luces"
            />
          </div>
        </CardContent>
      </Card>

      {/* Segment Dialog */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{editingSegmentIdx !== null ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título del Segmento *</Label>
                <Input
                  value={segmentForm.title}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Alabanza y Adoración"
                />
              </div>
              <div className="space-y-2">
                <Label>Duración (minutos) *</Label>
                <Input
                  type="number"
                  value={segmentForm.duration}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Presentador</Label>
                <AutocompleteInput
                  type="presenter"
                  value={segmentForm.presenter}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, presenter: e.target.value }))}
                  placeholder="Nombre del presentador"
                />
              </div>
              <div className="space-y-2">
                <Label>Traductor</Label>
                <AutocompleteInput
                  type="translator"
                  value={segmentForm.translator}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, translator: e.target.value }))}
                  placeholder="Nombre del traductor"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Predicador</Label>
                <AutocompleteInput
                  type="preacher"
                  value={segmentForm.preacher}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, preacher: e.target.value }))}
                  placeholder="Nombre del predicador"
                />
              </div>
              <div className="space-y-2">
                <Label>Líder/Director</Label>
                <AutocompleteInput
                  type="leader"
                  value={segmentForm.leader}
                  onChange={(e) => setSegmentForm(prev => ({ ...prev, leader: e.target.value }))}
                  placeholder="Nombre del líder"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título del Mensaje</Label>
              <AutocompleteInput
                type="messageTitle"
                value={segmentForm.messageTitle}
                onChange={(e) => setSegmentForm(prev => ({ ...prev, messageTitle: e.target.value }))}
                placeholder="Título del mensaje o enseñanza"
              />
            </div>

            <div className="space-y-2">
              <Label>Verso / Cita Bíblica</Label>
              <Input
                value={segmentForm.verse}
                onChange={(e) => setSegmentForm(prev => ({ ...prev, verse: e.target.value }))}
                placeholder="Ej. Juan 3:16"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción / Notas</Label>
              <Textarea
                value={segmentForm.description}
                onChange={(e) => setSegmentForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Descripción adicional o notas especiales..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addSegment} className="bg-pdv-teal text-white">
                {editingSegmentIdx !== null ? 'Actualizar' : 'Añadir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}