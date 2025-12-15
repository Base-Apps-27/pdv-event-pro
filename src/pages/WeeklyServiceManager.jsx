import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Save, Plus, Trash2, Printer, Copy, Edit, Sparkles, ChevronUp, ChevronDown, Eye, EyeOff, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { addMinutes, parse, format } from "date-fns";

export default function WeeklyServiceManager() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceData, setServiceData] = useState(null);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialSegmentDetails, setSpecialSegmentDetails] = useState({
    timeSlot: "9:30am",
    title: "",
    type: "Especial",
    duration: 15,
    insertAfterIdx: -1,
  });
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    instructions: "",
    category: "General",
    is_active: true,
    priority: 10,
    has_video: false,
    date_of_occurrence: ""
  });
  const [expandedSegments, setExpandedSegments] = useState({});

  const queryClient = useQueryClient();

  // Blueprint structure
  const BLUEPRINT = {
    "9:30am": [
      { type: "worship", title: "Equipo de A&A", duration: 35, fields: ["leader", "songs", "ministry_leader"] },
      { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"] },
      { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"] },
      { type: "message", title: "Mensaje", duration: 30, fields: ["preacher", "title", "verse"] },
      { type: "break", title: "RECESO", duration: 30, fields: [] }
    ],
    "11:30am": [
      { type: "worship", title: "Equipo de A&A", duration: 30, fields: ["leader", "songs", "ministry_leader"] },
      { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"] },
      { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"] },
      { type: "message", title: "Mensaje", duration: 30, fields: ["preacher", "title", "verse"] }
    ]
  };

  // Fetch or create service data for selected date
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['weeklyService', selectedDate],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date: selectedDate });
      return services[0] || null;
    },
    enabled: !!selectedDate
  });

  // Fetch announcements
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const fixedAnnouncements = allAnnouncements.filter(a => a.category === 'General' && a.is_active);

  const { data: dynamicAnnouncements = [] } = useQuery({
    queryKey: ['dynamicAnnouncements', selectedDate],
    queryFn: async () => {
      const selDate = new Date(selectedDate);
      const [items, events] = await Promise.all([
        base44.entities.AnnouncementItem.list(),
        base44.entities.Event.list()
      ]);
      
      // Filter items: show if date_of_occurrence is today or in the future
      const filteredItems = items.filter(a => {
        if (a.category === 'General' || !a.is_active) return false;
        if (!a.date_of_occurrence) return false;
        const occurrenceDate = new Date(a.date_of_occurrence);
        return occurrenceDate >= selDate;
      });

      // Filter events: show only if event hasn't started yet or is in progress
      const filteredEvents = events.filter(e => {
        if (!e.promote_in_announcements || !e.start_date) return false;
        const eventStartDate = new Date(e.start_date);
        // Show up to the start date
        return eventStartDate >= selDate;
      });

      // Combine and sort by occurrence date (earliest first)
      const combined = [
        ...filteredItems.map(a => ({ ...a, sortDate: new Date(a.date_of_occurrence) })),
        ...filteredEvents.map(e => ({ ...e, isEvent: true, sortDate: new Date(e.start_date) }))
      ];

      return combined.sort((a, b) => a.sortDate - b.sortDate);
    },
    enabled: !!selectedDate
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      if (existingData?.id) {
        return await base44.entities.Service.update(existingData.id, data);
      } else {
        return await base44.entities.Service.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['weeklyService']);
      setHasChanges(false);
      alert('Servicio guardado');
    }
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
      setEditingAnnouncement(null);
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnnouncementItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
      setEditingAnnouncement(null);
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id) => base44.entities.AnnouncementItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAnnouncements']);
      queryClient.invalidateQueries(['dynamicAnnouncements']);
    },
  });

  // Initialize service data from existing or blueprint
  useEffect(() => {
    if (existingData) {
      setServiceData(existingData);
      setSelectedAnnouncements(existingData.selected_announcements || []);
    } else {
      // Initialize from blueprint
      const initialData = {
        date: selectedDate,
        "9:30am": BLUEPRINT["9:30am"].map(seg => ({
          ...seg,
          data: {},
          songs: seg.type === "worship" ? [
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" }
          ] : undefined
        })),
        "11:30am": BLUEPRINT["11:30am"].map(seg => ({
          ...seg,
          data: {},
          songs: seg.type === "worship" ? [
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" },
            { title: "", lead: "" }
          ] : undefined
        })),
        coordinators: { "9:30am": "", "11:30am": "" },
        ujieres: { "9:30am": "", "11:30am": "" },
        sound: { "9:30am": "", "11:30am": "" },
        luces: { "9:30am": "", "11:30am": "" }
      };
      setServiceData(initialData);
    }
  }, [existingData, selectedDate]);

  // Auto-select dynamic announcements
  useEffect(() => {
    if (dynamicAnnouncements.length > 0 && !existingData) {
      setSelectedAnnouncements(prev => {
        const fixed = fixedAnnouncements.map(a => a.id);
        const dynamic = dynamicAnnouncements.map(a => a.id);
        return [...new Set([...fixed, ...dynamic])];
      });
    }
  }, [dynamicAnnouncements, fixedAnnouncements]);

  const updateSegmentField = (service, segmentIndex, field, value) => {
    setServiceData(prev => {
      const updated = { ...prev };
      if (field === 'songs') {
        updated[service][segmentIndex].songs = value;
      } else {
        updated[service][segmentIndex].data = {
          ...updated[service][segmentIndex].data,
          [field]: value
        };
      }
      return updated;
    });
    setHasChanges(true);
  };

  const updateTeamField = (field, service, value) => {
    setServiceData(prev => ({
      ...prev,
      [field]: { ...prev[field], [service]: value }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const dataToSave = {
      ...serviceData,
      selected_announcements: selectedAnnouncements,
      day_of_week: 'Sunday',
      name: `Domingo - ${selectedDate}`,
      status: 'active'
    };
    saveServiceMutation.mutate(dataToSave);
  };

  const handlePrint = () => {
    window.print();
  };

  const copyTo1130 = () => {
    if (window.confirm('¿Copiar datos de 9:30am a 11:30am?')) {
      setServiceData(prev => ({
        ...prev,
        "11:30am": prev["9:30am"].filter(s => s.type !== 'break' && s.type !== 'special').map(seg => ({ ...seg }))
      }));
      setHasChanges(true);
    }
  };

  const addSpecialSegment = () => {
    setServiceData(prev => {
      const updated = { ...prev };
      const newSegment = {
        type: "special",
        title: specialSegmentDetails.title,
        duration: specialSegmentDetails.duration,
        fields: ["description"],
        data: { description: "" }
      };

      const targetArray = updated[specialSegmentDetails.timeSlot];
      let insertIndex = specialSegmentDetails.insertAfterIdx + 1;
      if (insertIndex <= 0) insertIndex = 0;
      if (insertIndex > targetArray.length) insertIndex = targetArray.length;
      
      targetArray.splice(insertIndex, 0, newSegment);
      return updated;
    });
    setHasChanges(true);
    setShowSpecialDialog(false);
    setSpecialSegmentDetails({
      timeSlot: "9:30am", title: "", type: "Especial", duration: 15, insertAfterIdx: -1,
    });
  };

  const removeSpecialSegment = (timeSlot, index) => {
    setServiceData(prev => {
      const updated = { ...prev };
      updated[timeSlot].splice(index, 1);
      return updated;
    });
    setHasChanges(true);
  };

  const handleAnnouncementSubmit = () => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: announcementForm });
    } else {
      createAnnouncementMutation.mutate(announcementForm);
    }
  };

  const openAnnouncementEdit = (ann) => {
    setEditingAnnouncement(ann);
    setAnnouncementForm({
      title: ann.title,
      content: ann.content,
      instructions: ann.instructions || "",
      category: ann.category,
      is_active: ann.is_active,
      priority: ann.priority || 10,
      has_video: ann.has_video || false,
      date_of_occurrence: ann.date_of_occurrence || ""
    });
    setShowAnnouncementDialog(true);
  };

  const moveAnnouncementPriority = (ann, direction) => {
    const newPriority = direction === 'up' ? (ann.priority || 10) - 1 : (ann.priority || 10) + 1;
    updateAnnouncementMutation.mutate({
      id: ann.id,
      data: { ...ann, priority: newPriority }
    });
  };

  const toggleAnnouncementVisibility = (ann) => {
    updateAnnouncementMutation.mutate({
      id: ann.id,
      data: { ...ann, is_active: !ann.is_active }
    });
  };

  const handleDragEnd = (result, timeSlot) => {
    if (!result.destination) return;
    
    const items = Array.from(serviceData[timeSlot]);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    setServiceData(prev => ({
      ...prev,
      [timeSlot]: items
    }));
    setHasChanges(true);
  };

  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const calculateServiceTimes = (timeSlot) => {
    const segments = serviceData?.[timeSlot] || [];
    const totalDuration = segments
      .filter(seg => seg.type !== 'break' && seg.type !== 'ministry')
      .reduce((sum, seg) => sum + (seg.duration || 0), 0);
    
    const startTime = parse(timeSlot, "h:mma", new Date());
    const endTime = addMinutes(startTime, totalDuration);
    
    return {
      totalDuration,
      startTime: format(startTime, "h:mm a"),
      endTime: format(endTime, "h:mm a")
    };
  };

  if (!serviceData || isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 print:p-2">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">Gestión semanal unificada</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <Button onClick={handleSave} className="bg-pdv-teal text-white">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Date Selection */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-pdv-teal" />
            <div className="flex-1">
              <Label>Fecha del Domingo</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-3xl font-bold uppercase">Orden de Servicio</h1>
        <p className="text-xl text-blue-600">Domingo {selectedDate}</p>
      </div>

      {/* Two Services Side by Side */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 9:30 AM Service */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-red-600">9:30 a.m.</h2>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={copyTo1130}
                  className="print:hidden"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar a 11:30
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: "9:30am" }));
                    setShowSpecialDialog(true);
                  }}
                  className="print:hidden"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Especial
                </Button>
              </div>
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-3">
              <Badge variant="outline" className="bg-red-50">
                {calculateServiceTimes("9:30am").totalDuration} min total
              </Badge>
              <span>Termina: {calculateServiceTimes("9:30am").endTime}</span>
            </div>
          </div>

          <DragDropContext onDragEnd={(result) => handleDragEnd(result, "9:30am")}>
            <Droppable droppableId="9:30am">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {serviceData["9:30am"].map((segment, idx) => {
            const timeSlot = "9:30am";
            const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
            
            if (segment.type === "special") {
              return (
                <Draggable key={`${timeSlot}-special-${idx}`} draggableId={`${timeSlot}-special-${idx}`} index={idx}>
                  {(provided) => (
                    <Card 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="border-l-4 border-l-orange-500 bg-orange-50"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div {...provided.dragHandleProps} className="print:hidden">
                              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            </div>
                            <Sparkles className="w-4 h-4 text-orange-600" />
                            {segment.title}
                            <Badge className="ml-2 bg-orange-200 text-orange-800">Especial</Badge>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSpecialSegment(timeSlot, idx)}
                            className="print:hidden"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-3">
                        <Textarea
                          placeholder="Descripción / Notas"
                          value={segment.data?.description || ""}
                          onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)}
                          className="text-sm"
                          rows={2}
                        />
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              );
            }
            return (
              <Draggable key={`${timeSlot}-${idx}`} draggableId={`${timeSlot}-${idx}`} index={idx}>
                {(provided) => (
                  <Card 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="border-l-4 border-l-red-500"
                  >
                    <CardHeader className="pb-2 bg-gray-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div {...provided.dragHandleProps} className="print:hidden">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        </div>
                        <Clock className="w-4 h-4 text-red-600" />
                        {segment.title}
                        <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-3">
                  {segment.fields.includes("leader") && (
                    <Input
                      placeholder="Líder / Director"
                      value={segment.data?.leader || ""}
                      onChange={(e) => updateSegmentField("9:30am", idx, "leader", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("presenter") && (
                    <Input
                      placeholder="Presentador"
                      value={segment.data?.presenter || ""}
                      onChange={(e) => updateSegmentField("9:30am", idx, "presenter", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("preacher") && (
                    <Input
                      placeholder="Predicador"
                      value={segment.data?.preacher || ""}
                      onChange={(e) => updateSegmentField("9:30am", idx, "preacher", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("title") && (
                    <Input
                      placeholder="Título del Mensaje"
                      value={segment.data?.title || ""}
                      onChange={(e) => updateSegmentField("9:30am", idx, "title", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("verse") && (
                    <Input
                      placeholder="Verso / Cita Bíblica"
                      value={segment.data?.verse || ""}
                      onChange={(e) => updateSegmentField("9:30am", idx, "verse", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.songs && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                      {segment.songs.map((song, sIdx) => (
                        <div key={sIdx} className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder={`Canción ${sIdx + 1}`}
                            value={song.title}
                            onChange={(e) => {
                              const newSongs = [...segment.songs];
                              newSongs[sIdx].title = e.target.value;
                              updateSegmentField("9:30am", idx, "songs", newSongs);
                            }}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Líder"
                            value={song.lead}
                            onChange={(e) => {
                              const newSongs = [...segment.songs];
                              newSongs[sIdx].lead = e.target.value;
                              updateSegmentField("9:30am", idx, "songs", newSongs);
                            }}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {segment.fields.includes("ministry_leader") && (
                    <div className="bg-purple-50 border border-purple-200 rounded p-2">
                      <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                      <Input
                        placeholder="Líder de Ministración"
                        value={segment.data?.ministry_leader || ""}
                        onChange={(e) => updateSegmentField("9:30am", idx, "ministry_leader", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                    className="w-full text-xs mt-2 print:hidden"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    {isExpanded ? "Menos detalles" : "Más detalles"}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        placeholder="Notas de Proyección"
                        value={segment.data?.projection_notes || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "projection_notes", e.target.value)}
                        className="text-xs"
                        rows={2}
                      />
                      <Textarea
                        placeholder="Notas de Sonido"
                        value={segment.data?.sound_notes || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "sound_notes", e.target.value)}
                        className="text-xs"
                        rows={2}
                      />
                      <Textarea
                        placeholder="Notas Generales"
                        value={segment.data?.description_details || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "description_details", e.target.value)}
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

          {/* Team Section */}
          <Card className="bg-green-50 border-green-200 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">EQUIPO 9:30am</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Coordinador(a)" value={serviceData.coordinators?.["9:30am"] || ""} onChange={(e) => updateTeamField("coordinators", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Ujieres" value={serviceData.ujieres?.["9:30am"] || ""} onChange={(e) => updateTeamField("ujieres", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Sonido" value={serviceData.sound?.["9:30am"] || ""} onChange={(e) => updateTeamField("sound", "9:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Luces" value={serviceData.luces?.["9:30am"] || ""} onChange={(e) => updateTeamField("luces", "9:30am", e.target.value)} className="text-xs" />
            </CardContent>
          </Card>
        </div>

        {/* 11:30 AM Service */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-blue-600">11:30 a.m.</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: "11:30am" }));
                  setShowSpecialDialog(true);
                }}
                className="print:hidden"
              >
                <Plus className="w-4 h-4 mr-2" />
                Especial
              </Button>
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50">
                {calculateServiceTimes("11:30am").totalDuration} min total
              </Badge>
              <span>Termina: {calculateServiceTimes("11:30am").endTime}</span>
            </div>
          </div>

          <DragDropContext onDragEnd={(result) => handleDragEnd(result, "11:30am")}>
            <Droppable droppableId="11:30am">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {serviceData["11:30am"].map((segment, idx) => {
            const timeSlot = "11:30am";
            const isExpanded = expandedSegments[`${timeSlot}-${idx}`];
            
            if (segment.type === "special") {
              return (
                <Draggable key={`${timeSlot}-special-${idx}`} draggableId={`${timeSlot}-special-${idx}`} index={idx}>
                  {(provided) => (
                    <Card 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="border-l-4 border-l-orange-500 bg-orange-50"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div {...provided.dragHandleProps} className="print:hidden">
                              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            </div>
                            <Sparkles className="w-4 h-4 text-orange-600" />
                            {segment.title}
                            <Badge className="ml-2 bg-orange-200 text-orange-800">Especial</Badge>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSpecialSegment(timeSlot, idx)}
                            className="print:hidden"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-3">
                        <Textarea
                          placeholder="Descripción / Notas"
                          value={segment.data?.description || ""}
                          onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)}
                          className="text-sm"
                          rows={2}
                        />
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              );
            }
            return (
              <Draggable key={`${timeSlot}-${idx}`} draggableId={`${timeSlot}-${idx}`} index={idx}>
                {(provided) => (
                  <Card 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="border-l-4 border-l-blue-500"
                  >
                    <CardHeader className="pb-2 bg-gray-50">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div {...provided.dragHandleProps} className="print:hidden">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        </div>
                        <Clock className="w-4 h-4 text-blue-600" />
                        {segment.title}
                        <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-3">
                  {segment.fields.includes("leader") && (
                    <Input
                      placeholder="Líder / Director"
                      value={segment.data?.leader || ""}
                      onChange={(e) => updateSegmentField("11:30am", idx, "leader", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("presenter") && (
                    <Input
                      placeholder="Presentador"
                      value={segment.data?.presenter || ""}
                      onChange={(e) => updateSegmentField("11:30am", idx, "presenter", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("preacher") && (
                    <Input
                      placeholder="Predicador"
                      value={segment.data?.preacher || ""}
                      onChange={(e) => updateSegmentField("11:30am", idx, "preacher", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("title") && (
                    <Input
                      placeholder="Título del Mensaje"
                      value={segment.data?.title || ""}
                      onChange={(e) => updateSegmentField("11:30am", idx, "title", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.fields.includes("verse") && (
                    <Input
                      placeholder="Verso / Cita Bíblica"
                      value={segment.data?.verse || ""}
                      onChange={(e) => updateSegmentField("11:30am", idx, "verse", e.target.value)}
                      className="text-sm"
                    />
                  )}
                  {segment.songs && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                      {segment.songs.map((song, sIdx) => (
                        <div key={sIdx} className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder={`Canción ${sIdx + 1}`}
                            value={song.title}
                            onChange={(e) => {
                              const newSongs = [...segment.songs];
                              newSongs[sIdx].title = e.target.value;
                              updateSegmentField("11:30am", idx, "songs", newSongs);
                            }}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Líder"
                            value={song.lead}
                            onChange={(e) => {
                              const newSongs = [...segment.songs];
                              newSongs[sIdx].lead = e.target.value;
                              updateSegmentField("11:30am", idx, "songs", newSongs);
                            }}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {segment.fields.includes("ministry_leader") && (
                    <div className="bg-purple-50 border border-purple-200 rounded p-2">
                      <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
                      <Input
                        placeholder="Líder de Ministración"
                        value={segment.data?.ministry_leader || ""}
                        onChange={(e) => updateSegmentField("11:30am", idx, "ministry_leader", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSegmentExpanded(timeSlot, idx)}
                    className="w-full text-xs mt-2 print:hidden"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    {isExpanded ? "Menos detalles" : "Más detalles"}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        placeholder="Notas de Proyección"
                        value={segment.data?.projection_notes || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "projection_notes", e.target.value)}
                        className="text-xs"
                        rows={2}
                      />
                      <Textarea
                        placeholder="Notas de Sonido"
                        value={segment.data?.sound_notes || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "sound_notes", e.target.value)}
                        className="text-xs"
                        rows={2}
                      />
                      <Textarea
                        placeholder="Notas Generales"
                        value={segment.data?.description_details || ""}
                        onChange={(e) => updateSegmentField(timeSlot, idx, "description_details", e.target.value)}
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

          {/* Team Section */}
          <Card className="bg-blue-50 border-blue-200 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">EQUIPO 11:30am</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Coordinador(a)" value={serviceData.coordinators?.["11:30am"] || ""} onChange={(e) => updateTeamField("coordinators", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Ujieres" value={serviceData.ujieres?.["11:30am"] || ""} onChange={(e) => updateTeamField("ujieres", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Sonido" value={serviceData.sound?.["11:30am"] || ""} onChange={(e) => updateTeamField("sound", "11:30am", e.target.value)} className="text-xs" />
              <Input placeholder="Luces" value={serviceData.luces?.["11:30am"] || ""} onChange={(e) => updateTeamField("luces", "11:30am", e.target.value)} className="text-xs" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Announcements Section */}
      <Card className="print:break-before-page">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
            <Button
              onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementForm({ title: "", content: "", instructions: "", category: "General", is_active: true, priority: 10, has_video: false, date_of_occurrence: "" });
                setShowAnnouncementDialog(true);
              }}
              size="sm"
              className="bg-pdv-teal text-white print:hidden"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Anuncio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fixed Announcements */}
          <div className="space-y-3">
            <Label className="text-base font-bold text-gray-900">Anuncios Fijos</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {fixedAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border-2 rounded-lg bg-white hover:shadow-md transition-shadow">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      setHasChanges(true);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm leading-tight">{ann.title}</h3>
                      <div className="flex gap-1 flex-shrink-0 print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveAnnouncementPriority(ann, 'up')}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveAnnouncementPriority(ann, 'down')}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openAnnouncementEdit(ann)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            if (window.confirm('¿Eliminar?')) deleteAnnouncementMutation.mutate(ann.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">{ann.content}</p>
                    {ann.instructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                      <p className="text-xs text-amber-900 font-semibold mb-1">Instrucciones:</p>
                      <p className="text-xs text-amber-800 whitespace-pre-wrap">{ann.instructions}</p>
                    </div>
                    )}
                    {ann.has_video && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                        📹 Video
                      </Badge>
                    )}
                    </div>
                    </div>
                    ))}
                    </div>
                    </div>

          {/* Dynamic Announcements */}
          <div className="space-y-3">
            <Label className="text-base font-bold text-gray-900">Anuncios Dinámicos</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {dynamicAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-2 p-3 border-2 rounded-lg bg-blue-50 hover:shadow-md transition-shadow">
                  <Checkbox
                    checked={selectedAnnouncements.includes(ann.id)}
                    onCheckedChange={(checked) => {
                      setSelectedAnnouncements(prev => 
                        checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                      );
                      setHasChanges(true);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-sm leading-tight">{ann.isEvent ? ann.name : ann.title}</h3>
                          {ann.isEvent && <Badge className="bg-purple-200 text-purple-800 text-[10px]">Evento</Badge>}
                        </div>
                        {(ann.date_of_occurrence || ann.start_date) && (
                          <p className="text-xs font-semibold text-blue-600 mb-1">
                            📅 {ann.date_of_occurrence || ann.start_date} {ann.end_date && `- ${ann.end_date}`}
                          </p>
                        )}
                      </div>
                      {ann.isEvent && (
                        <div className="flex items-center gap-1 print:hidden">
                          <Checkbox
                            checked={ann.announcement_has_video}
                            onCheckedChange={(checked) => {
                              updateAnnouncementMutation.mutate({
                                id: ann.id,
                                data: { ...ann, announcement_has_video: checked }
                              });
                            }}
                          />
                          <span className="text-xs font-semibold text-purple-700">📹</span>
                        </div>
                      )}
                      {!ann.isEvent && (
                        <div className="flex gap-1 flex-shrink-0 print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'up')}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveAnnouncementPriority(ann, 'down')}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAnnouncementEdit(ann)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (window.confirm('¿Eliminar?')) deleteAnnouncementMutation.mutate(ann.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">
                      {ann.isEvent ? ann.announcement_blurb || ann.description : ann.content}
                    </p>
                    {ann.instructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                        <p className="text-xs text-amber-900 font-semibold mb-1">Instrucciones:</p>
                        <p className="text-xs text-amber-800 whitespace-pre-wrap">{ann.instructions}</p>
                      </div>
                    )}
                    {(ann.has_video || ann.announcement_has_video) && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                        📹 Video
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Segment Dialog */}
      <Dialog open={showSpecialDialog} onOpenChange={setShowSpecialDialog}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Insertar Segmento Especial ({specialSegmentDetails.timeSlot})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título del Segmento</Label>
              <Input
                value={specialSegmentDetails.title}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej. Presentación de Niños"
              />
            </div>
            <div className="space-y-2">
              <Label>Duración (minutos)</Label>
              <Input
                type="number"
                value={specialSegmentDetails.duration}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Insertar después de:</Label>
              <select
                className="w-full border rounded-md p-2"
                value={specialSegmentDetails.insertAfterIdx}
                onChange={(e) => setSpecialSegmentDetails(prev => ({ ...prev, insertAfterIdx: parseInt(e.target.value) }))}
              >
                <option value="-1">Al inicio</option>
                {serviceData[specialSegmentDetails.timeSlot]
                  .filter(seg => seg.type !== "special")
                  .map((segment, idx) => (
                    <option key={idx} value={idx}>{segment.title}</option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSpecialDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addSpecialSegment} className="bg-pdv-teal text-white">
                Añadir Segmento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? "Editar Anuncio" : "Nuevo Anuncio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={announcementForm.has_video}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, has_video: checked }))}
                />
                <Label className="font-semibold">📹 Incluye Video</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={announcementForm.is_active}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label className="font-semibold">👁️ Visible</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <select
                className="w-full border rounded-md p-2"
                value={announcementForm.category}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="General">General</option>
                <option value="Event">Evento</option>
                <option value="Ministry">Ministerio</option>
                <option value="Urgent">Urgente</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del anuncio"
              />
            </div>
            {announcementForm.category !== "General" && (
              <div className="space-y-2">
                <Label>Fecha de Ocurrencia</Label>
                <Input
                  type="date"
                  value={announcementForm.date_of_occurrence}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, date_of_occurrence: e.target.value }))}
                />
                <p className="text-xs text-gray-500">El anuncio se mostrará hasta esta fecha (inclusive)</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Contenido (Texto principal con contexto, fechas, horarios)</Label>
              <Textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Contenido completo del anuncio con todos los detalles necesarios..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Instrucciones para el Presentador (Opcional)</Label>
              <Textarea
                value={announcementForm.instructions}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Instrucciones especiales, notas de tono, recordatorios para el presentador..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad (menor = más arriba)</Label>
              <Input
                type="number"
                value={announcementForm.priority}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAnnouncementSubmit} className="bg-pdv-teal text-white">
                {editingAnnouncement ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}