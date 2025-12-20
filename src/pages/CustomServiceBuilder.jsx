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
import { Calendar, Clock, Save, Plus, Trash2, Printer, ArrowLeft, GripVertical, ChevronUp, ChevronDown, Sparkles, Settings } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { addMinutes, parse, format } from "date-fns";
import PrintSettingsModal from "@/components/print/PrintSettingsModal";
import { formatDate as formatDateES } from "date-fns";
import { es } from "date-fns/locale";

export default function CustomServiceBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [serviceData, setServiceData] = useState({
    name: "",
    date: new Date().toISOString().split('T')[0],
    day_of_week: "",
    time: "10:00",
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

  const [expandedSegments, setExpandedSegments] = useState({});
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printSettingsPage1, setPrintSettingsPage1] = useState(null);

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
      setPrintSettingsPage1(existingService.print_settings_page1 || null);
    }
  }, [existingService]);

  // Auto-populate day of week from date
  useEffect(() => {
    if (serviceData.date) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dateObj = new Date(serviceData.date + 'T00:00:00');
      const dayOfWeek = days[dateObj.getDay()];
      if (dayOfWeek !== serviceData.day_of_week) {
        setServiceData(prev => ({ ...prev, day_of_week: dayOfWeek }));
      }
    }
  }, [serviceData.date]);

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
      print_settings_page1: printSettingsPage1,
      status: 'active'
    });
  };

  const handleSavePrintSettings = (newSettings) => {
    setPrintSettingsPage1(newSettings.page1);
    setServiceData(prev => ({
      ...prev,
      print_settings_page1: newSettings.page1
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const addSegment = () => {
    setServiceData(prev => ({
      ...prev,
      segments: [...prev.segments, getDefaultSegmentForm()]
    }));
  };

  const removeSegment = (idx) => {
    if (window.confirm('¿Eliminar este segmento?')) {
      setServiceData(prev => ({
        ...prev,
        segments: prev.segments.filter((_, i) => i !== idx)
      }));
    }
  };

  const updateSegmentField = (idx, field, value) => {
    setServiceData(prev => {
      const updated = { ...prev };
      if (field === 'songs') {
        updated.segments[idx].songs = value;
      } else {
        updated.segments[idx][field] = value;
      }
      return updated;
    });
  };

  const toggleSegmentExpanded = (idx) => {
    setExpandedSegments(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
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

  const activePrintSettingsPage1 = printSettingsPage1 || {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-2">
      <style>{`
        @media print {
          @page { 
            size: letter; 
            margin: 0;
          }
          
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            font-family: 'Inter', Helvetica, Arial, sans-serif;
            background: white;
            color: #374151;
          }

          .print-page-wrapper {
            padding: ${activePrintSettingsPage1.margins.top} ${activePrintSettingsPage1.margins.right} ${activePrintSettingsPage1.margins.bottom} ${activePrintSettingsPage1.margins.left};
          }
          
          .print-body-content {
            transform: scale(${activePrintSettingsPage1.globalScale});
            transform-origin: top left;
            font-size: calc(10.5pt * ${activePrintSettingsPage1.bodyFontScale});
            line-height: 1.3;
          }
          
          .print-body-content h1, 
          .print-body-content h2, 
          .print-body-content h3 {
            font-size: calc(1em * ${activePrintSettingsPage1.titleFontScale});
            page-break-after: avoid;
          }
          
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
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
          <Button variant="outline" onClick={() => setShowPrintSettings(true)} className="border-2 border-gray-400 font-semibold">
            <Settings className="w-4 h-4 mr-2" />
            Config. Impresión
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <PrintSettingsModal
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        settingsPage1={activePrintSettingsPage1}
        settingsPage2={activePrintSettingsPage1}
        onSave={handleSavePrintSettings}
        language="es"
      />

      {/* Print Layout */}
      <div className="hidden print:block print-page-wrapper">
      {/* FIXED Print Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-1 mx-auto mb-4" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }} />
        <h1 className="text-3xl font-bold uppercase mb-1">{serviceData.name || 'Orden de Servicio'}</h1>
        <p className="text-lg text-gray-600">{serviceData.day_of_week} - {serviceData.date}</p>
        {serviceData.time && <p className="text-sm text-gray-500">{serviceData.time}</p>}
      </div>

      {/* SCALABLE Body Content */}
      <div className="print-body-content">
      {/* Service Details */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Detalles del Servicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del Servicio *</Label>
              <Input
                value={serviceData.name}
                onChange={(e) => setServiceData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Servicio Especial de Navidad"
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={serviceData.date}
                onChange={(e) => setServiceData(prev => ({ ...prev, date: e.target.value }))}
                required
                className="w-full max-w-full"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Día de la Semana (auto)</Label>
              <Input
                value={serviceData.day_of_week}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={serviceData.time}
                onChange={(e) => setServiceData(prev => ({ ...prev, time: e.target.value }))}
                required
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
            onClick={addSegment}
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
                {serviceData.segments.map((segment, idx) => {
                  const isExpanded = expandedSegments[idx];
                  const isSpecial = segment.type === "Especial";
                  
                  return (
                    <Draggable key={`seg-${idx}`} draggableId={`seg-${idx}`} index={idx}>
                      {(provided) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`border-l-4 ${isSpecial ? 'border-l-orange-500 bg-orange-50' : 'border-l-pdv-teal'}`}
                        >
                          <CardHeader className="pb-2 bg-gray-50">
                            <div className="flex items-center gap-2 mb-2">
                              <div {...provided.dragHandleProps} className="print:hidden">
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                              </div>
                              {isSpecial ? <Sparkles className="w-4 h-4 text-orange-600" /> : <Clock className="w-4 h-4 text-pdv-teal" />}
                              <Input
                                value={segment.title}
                                onChange={(e) => updateSegmentField(idx, 'title', e.target.value)}
                                className="text-lg font-bold border-0 shadow-none p-0 h-auto focus-visible:ring-0 flex-1"
                                placeholder="Título del segmento"
                              />
                              <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeSegment(idx)}
                                className="print:hidden"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="print:hidden">
                              <Select 
                                value={segment.type} 
                                onValueChange={(value) => updateSegmentField(idx, 'type', value)}
                              >
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
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-3">
                            {/* Worship fields */}
                            {segment.type === 'worship' && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Líder / Director</Label>
                                    <AutocompleteInput
                                      type="leader"
                                      value={segment.leader}
                                      onChange={(e) => updateSegmentField(idx, 'leader', e.target.value)}
                                      placeholder="Nombre del líder"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                {segment.songs && segment.songs.length > 0 && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                                    {segment.songs.map((song, sIdx) => (
                                      <div key={sIdx} className="grid grid-cols-2 gap-2">
                                        <AutocompleteInput
                                          type="songTitle"
                                          placeholder={`Canción ${sIdx + 1}`}
                                          value={song.title}
                                          onChange={(e) => {
                                            const newSongs = [...segment.songs];
                                            newSongs[sIdx].title = e.target.value;
                                            updateSegmentField(idx, 'songs', newSongs);
                                          }}
                                          className="text-xs"
                                        />
                                        <AutocompleteInput
                                          type="leader"
                                          placeholder="Líder"
                                          value={song.lead}
                                          onChange={(e) => {
                                            const newSongs = [...segment.songs];
                                            newSongs[sIdx].lead = e.target.value;
                                            updateSegmentField(idx, 'songs', newSongs);
                                          }}
                                          className="text-xs"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Message fields */}
                            {segment.type === 'message' && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Predicador</Label>
                                    <AutocompleteInput
                                      type="preacher"
                                      value={segment.preacher}
                                      onChange={(e) => updateSegmentField(idx, 'preacher', e.target.value)}
                                      placeholder="Nombre del predicador"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Título del Mensaje</Label>
                                  <AutocompleteInput
                                    type="messageTitle"
                                    value={segment.messageTitle}
                                    onChange={(e) => updateSegmentField(idx, 'messageTitle', e.target.value)}
                                    placeholder="Título del mensaje"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Verso / Cita Bíblica</Label>
                                  <Input
                                    value={segment.verse}
                                    onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)}
                                    placeholder="Ej. Juan 3:16"
                                    className="text-sm"
                                  />
                                </div>
                              </>
                            )}

                            {/* Welcome fields */}
                            {segment.type === 'welcome' && (
                              <div className="grid md:grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">Presentador</Label>
                                  <AutocompleteInput
                                    type="presenter"
                                    value={segment.presenter}
                                    onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                    placeholder="Nombre del presentador"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Traductor</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    value={segment.translator}
                                    onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                    placeholder="Nombre del traductor"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Offering fields */}
                            {segment.type === 'offering' && (
                              <>
                                <div className="grid md:grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Presentador</Label>
                                    <AutocompleteInput
                                      type="presenter"
                                      value={segment.presenter}
                                      onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                      placeholder="Nombre del presentador"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Traductor</Label>
                                    <AutocompleteInput
                                      type="translator"
                                      value={segment.translator}
                                      onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                      placeholder="Nombre del traductor"
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Verso / Cita Bíblica</Label>
                                  <Input
                                    value={segment.verse}
                                    onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)}
                                    placeholder="Ej. Malaquías 3:10"
                                    className="text-sm"
                                  />
                                </div>
                              </>
                            )}

                            {/* Special/Generic fields */}
                            {segment.type === 'Especial' && (
                              <div className="grid md:grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">Presentador</Label>
                                  <AutocompleteInput
                                    type="presenter"
                                    value={segment.presenter}
                                    onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)}
                                    placeholder="Nombre del presentador"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Traductor</Label>
                                  <AutocompleteInput
                                    type="translator"
                                    value={segment.translator}
                                    onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)}
                                    placeholder="Nombre del traductor"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSegmentExpanded(idx)}
                              className="w-full text-xs mt-2 print:hidden"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                              {isExpanded ? "Menos detalles" : "Más detalles"}
                            </Button>

                            {isExpanded && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
                                  <Input
                                    type="number"
                                    value={segment.duration || 0}
                                    onChange={(e) => updateSegmentField(idx, 'duration', parseInt(e.target.value) || 0)}
                                    className="text-xs w-24"
                                  />
                                </div>
                                <Textarea
                                  placeholder="Descripción / Notas adicionales..."
                                  value={segment.description}
                                  onChange={(e) => updateSegmentField(idx, 'description', e.target.value)}
                                  className="text-xs"
                                  rows={3}
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
      </div>
      </div>

    </div>
  );
}