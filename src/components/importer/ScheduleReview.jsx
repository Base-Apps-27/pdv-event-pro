import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, Edit2, ArrowRight, Settings, Music, Mic, Users, CalendarPlus, Calendar, Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ScheduleReview({ data, onConfirm, onCancel }) {
  const [importMode, setImportMode] = useState("new"); // "new" or "existing"
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventData, setEventData] = useState(data.event || { name: "", date: "" });

  // Fetch existing events for the dropdown
  const { data: existingEvents } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => base44.entities.Event.list('-start_date', 50),
    enabled: importMode === "existing"
  });
  const [sessionData, setSessionData] = useState(data.session || { name: "", description: "" });
  const [preSessionData, setPreSessionData] = useState(data.pre_session || { registration_desk_open_time: "" });
  const [segments, setSegments] = useState(data.segments || []);
  
  // For Segment Details Dialog
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const [editingSegment, setEditingSegment] = useState(null);

  const handleSegmentChange = (index, field, value) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setSegments(newSegments);
  };

  const handleDeleteSegment = (index) => {
    setSegments(segments.filter((_, i) => i !== index));
  };

  const handleAddSegment = () => {
    setSegments([...segments, { 
      time: "", 
      title: "New Segment", 
      type: "Alabanza", 
      presenter: "",
      notes: "" 
    }]);
  };

  const openEditDialog = (idx) => {
    setEditingSegmentIdx(idx);
    setEditingSegment({ ...segments[idx] });
  };

  const saveEditDialog = () => {
    const newSegments = [...segments];
    newSegments[editingSegmentIdx] = editingSegment;
    setSegments(newSegments);
    setEditingSegmentIdx(null);
  };

  const handleConfirm = () => {
    onConfirm({
      mode: importMode,
      existingEventId: selectedEventId,
      event: eventData,
      session: sessionData,
      pre_session: preSessionData,
      segments: segments
    });
  };

  const segmentTypes = [
    "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video", 
    "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", 
    "Especial", "Cierre"
  ];

  return (
    <div className="my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2 border-pdv-teal/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-pdv-teal">
              <Edit2 className="w-5 h-5" />
              Revisar Datos Extraídos
            </CardTitle>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Verificación Requerida
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Verifica los datos extraídos antes de importar.
          </p>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Import Mode Selection */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Label className="text-xs font-bold uppercase text-gray-500 mb-3 block">Modo de Importación</Label>
            <RadioGroup defaultValue="new" value={importMode} onValueChange={setImportMode} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="mode-new" />
                <Label htmlFor="mode-new" className="flex items-center gap-2 cursor-pointer font-medium">
                  <CalendarPlus className="w-4 h-4 text-pdv-teal" /> Crear Nuevo Evento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="mode-existing" />
                <Label htmlFor="mode-existing" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Calendar className="w-4 h-4 text-blue-600" /> Agregar a Evento Existente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Event Details (Conditional) */}
          {importMode === "new" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <h3 className="col-span-full text-xs font-bold uppercase text-pdv-teal tracking-wider mb-2">Datos del Nuevo Evento</h3>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Nombre del Evento</Label>
                <Input value={eventData.name} onChange={(e) => setEventData({...eventData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Fecha (YYYY-MM-DD)</Label>
                <Input value={eventData.date} onChange={(e) => setEventData({...eventData, date: e.target.value})} />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
               <h3 className="text-xs font-bold uppercase text-blue-700 tracking-wider mb-2">Seleccionar Evento Existente</h3>
               <div className="space-y-2">
                 <Label className="text-xs text-gray-500">Evento</Label>
                 <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona un evento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingEvents?.map(evt => (
                        <SelectItem key={evt.id} value={evt.id}>
                          {evt.name} ({evt.year})
                        </SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
               </div>
            </div>
          )}

          {/* Session Details (Always visible but context changes) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
            <h3 className="col-span-full text-xs font-bold uppercase text-pdv-teal tracking-wider mb-2">Datos de la Sesión</h3>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Nombre de Sesión</Label>
              <Input value={sessionData.name} onChange={(e) => setSessionData({...sessionData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Registro / Apertura (Hora)</Label>
              <Input 
                value={preSessionData.registration_desk_open_time || ""} 
                onChange={(e) => setPreSessionData({...preSessionData, registration_desk_open_time: e.target.value})}
                placeholder="00:00"
              />
            </div>
          </div>

          {/* Team Details */}
          <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
             <h3 className="text-xs font-bold uppercase text-pdv-teal tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Equipos y Responsables
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Admin Team</Label>
                    <Input className="h-8 text-sm" value={sessionData.admin_team || ""} onChange={(e) => setSessionData({...sessionData, admin_team: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Tech Team</Label>
                    <Input className="h-8 text-sm" value={sessionData.tech_team || ""} onChange={(e) => setSessionData({...sessionData, tech_team: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Sonido</Label>
                    <Input className="h-8 text-sm" value={sessionData.sound_team || ""} onChange={(e) => setSessionData({...sessionData, sound_team: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Ujieres</Label>
                    <Input className="h-8 text-sm" value={sessionData.ushers_team || ""} onChange={(e) => setSessionData({...sessionData, ushers_team: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Coordinadores</Label>
                    <Input className="h-8 text-sm" value={sessionData.coordinators || ""} onChange={(e) => setSessionData({...sessionData, coordinators: e.target.value})} />
                </div>
             </div>
          </div>

          {/* Segments Table */}
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-gray-600">Segmentos ({segments.length})</span>
              <Button size="sm" variant="ghost" onClick={handleAddSegment} className="h-8 text-pdv-teal">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[80px]">Hora</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-[80px] text-center">Detalles</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment, idx) => (
                  <TableRow key={idx} className="group hover:bg-slate-50">
                    <TableCell className="p-2">
                      <Input 
                        value={segment.time} 
                        onChange={(e) => handleSegmentChange(idx, 'time', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="00:00"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Select 
                        value={segmentTypes.includes(segment.type) ? segment.type : "Alabanza"} 
                        onValueChange={(val) => handleSegmentChange(idx, 'type', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {segmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-2">
                      <Input 
                        value={segment.title} 
                        onChange={(e) => handleSegmentChange(idx, 'title', e.target.value)}
                        className="h-8 text-xs font-medium"
                        placeholder="Título"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input 
                        value={segment.presenter} 
                        onChange={(e) => handleSegmentChange(idx, 'presenter', e.target.value)}
                        className="h-8 text-xs text-gray-500"
                        placeholder="Nombre"
                      />
                    </TableCell>
                    <TableCell className="p-2 text-center">
                         <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEditDialog(idx)}>
                            <Settings className="w-3 h-3 mr-1" />
                            Editar
                         </Button>
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDeleteSegment(idx)}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="bg-pdv-teal hover:bg-pdv-teal/90 text-white shadow-sm gap-2">
            <Check className="w-4 h-4" />
            Confirmar y Crear
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>

      {/* Detailed Edit Dialog */}
      <Dialog open={editingSegmentIdx !== null} onOpenChange={(open) => !open && setEditingSegmentIdx(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Editar Detalles del Segmento</DialogTitle>
            </DialogHeader>
            {editingSegment && (
                <ScrollArea className="max-h-[60vh]">
                    <div className="grid gap-4 py-4 pr-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Duración (min)</Label>
                                <Input 
                                    type="number" 
                                    value={editingSegment.duration_min || ""} 
                                    onChange={(e) => setEditingSegment({...editingSegment, duration_min: parseInt(e.target.value) || 0})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Notas / Instrucciones</Label>
                                <Input 
                                    value={editingSegment.notes || ""} 
                                    onChange={(e) => setEditingSegment({...editingSegment, notes: e.target.value})} 
                                />
                            </div>
                        </div>

                        {editingSegment.type === 'Alabanza' && (
                            <div className="border rounded-lg p-4 bg-blue-50/50 space-y-4">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-blue-700">
                                    <Music className="w-4 h-4" /> Detalles de Alabanza
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label className="text-xs">Canción 1</Label>
                                        <Input placeholder="Título" className="bg-white h-8" value={editingSegment.song_1_title || ""} onChange={(e) => setEditingSegment({...editingSegment, song_1_title: e.target.value})} />
                                        <Input placeholder="Líder" className="bg-white h-7 text-xs" value={editingSegment.song_1_lead || ""} onChange={(e) => setEditingSegment({...editingSegment, song_1_lead: e.target.value})} />
                                     </div>
                                     <div className="space-y-2">
                                        <Label className="text-xs">Canción 2</Label>
                                        <Input placeholder="Título" className="bg-white h-8" value={editingSegment.song_2_title || ""} onChange={(e) => setEditingSegment({...editingSegment, song_2_title: e.target.value})} />
                                        <Input placeholder="Líder" className="bg-white h-7 text-xs" value={editingSegment.song_2_lead || ""} onChange={(e) => setEditingSegment({...editingSegment, song_2_lead: e.target.value})} />
                                     </div>
                                     <div className="space-y-2">
                                        <Label className="text-xs">Canción 3</Label>
                                        <Input placeholder="Título" className="bg-white h-8" value={editingSegment.song_3_title || ""} onChange={(e) => setEditingSegment({...editingSegment, song_3_title: e.target.value})} />
                                        <Input placeholder="Líder" className="bg-white h-7 text-xs" value={editingSegment.song_3_lead || ""} onChange={(e) => setEditingSegment({...editingSegment, song_3_lead: e.target.value})} />
                                     </div>
                                     <div className="space-y-2">
                                        <Label className="text-xs">Canción 4</Label>
                                        <Input placeholder="Título" className="bg-white h-8" value={editingSegment.song_4_title || ""} onChange={(e) => setEditingSegment({...editingSegment, song_4_title: e.target.value})} />
                                        <Input placeholder="Líder" className="bg-white h-7 text-xs" value={editingSegment.song_4_lead || ""} onChange={(e) => setEditingSegment({...editingSegment, song_4_lead: e.target.value})} />
                                     </div>
                                </div>
                            </div>
                        )}

                        {editingSegment.type === 'Plenaria' && (
                            <div className="border rounded-lg p-4 bg-purple-50/50 space-y-4">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-purple-700">
                                    <Mic className="w-4 h-4" /> Detalles de Plenaria
                                </h4>
                                <div className="space-y-2">
                                    <Label>Título del Mensaje</Label>
                                    <Input className="bg-white" value={editingSegment.message_title || ""} onChange={(e) => setEditingSegment({...editingSegment, message_title: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Escrituras / Citas</Label>
                                    <Input className="bg-white" value={editingSegment.scripture_references || ""} onChange={(e) => setEditingSegment({...editingSegment, scripture_references: e.target.value})} />
                                </div>
                            </div>
                        )}

                        {/* Segment Actions */}
                        <div className="border rounded-lg p-4 bg-orange-50/50 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-orange-700">
                                    <Zap className="w-4 h-4" /> Acciones / Tareas de Preparación
                                </h4>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        const newActions = [...(editingSegment.segment_actions || []), {
                                            label: "",
                                            department: "Other",
                                            timing: "before_end",
                                            offset_min: 5,
                                            is_prep: true,
                                            is_required: false,
                                            notes: ""
                                        }];
                                        setEditingSegment({...editingSegment, segment_actions: newActions});
                                    }}
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Agregar Acción
                                </Button>
                            </div>

                            {(editingSegment.segment_actions || []).length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No hay acciones definidas para este segmento.</p>
                            ) : (
                                <div className="space-y-3">
                                    {(editingSegment.segment_actions || []).map((action, actionIdx) => (
                                        <div key={actionIdx} className="bg-white border rounded-md p-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    placeholder="Etiqueta (ej: A&A sube)" 
                                                    className="flex-1 h-8 text-sm"
                                                    value={action.label || ""}
                                                    onChange={(e) => {
                                                        const newActions = [...editingSegment.segment_actions];
                                                        newActions[actionIdx] = {...action, label: e.target.value};
                                                        setEditingSegment({...editingSegment, segment_actions: newActions});
                                                    }}
                                                />
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-red-400 hover:text-red-600"
                                                    onClick={() => {
                                                        const newActions = editingSegment.segment_actions.filter((_, i) => i !== actionIdx);
                                                        setEditingSegment({...editingSegment, segment_actions: newActions});
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Select 
                                                    value={action.department || "Other"} 
                                                    onValueChange={(val) => {
                                                        const newActions = [...editingSegment.segment_actions];
                                                        newActions[actionIdx] = {...action, department: val};
                                                        setEditingSegment({...editingSegment, segment_actions: newActions});
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Equipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Admin">Admin</SelectItem>
                                                        <SelectItem value="MC">MC</SelectItem>
                                                        <SelectItem value="Sound">Sonido</SelectItem>
                                                        <SelectItem value="Projection">Proyección</SelectItem>
                                                        <SelectItem value="Ujieres">Ujieres</SelectItem>
                                                        <SelectItem value="Alabanza">Alabanza</SelectItem>
                                                        <SelectItem value="Stage & Decor">Escenario</SelectItem>
                                                        <SelectItem value="Translation">Traducción</SelectItem>
                                                        <SelectItem value="Other">Otro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select 
                                                    value={action.timing || "before_end"} 
                                                    onValueChange={(val) => {
                                                        const newActions = [...editingSegment.segment_actions];
                                                        newActions[actionIdx] = {...action, timing: val};
                                                        setEditingSegment({...editingSegment, segment_actions: newActions});
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Timing" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="before_start">Antes de iniciar</SelectItem>
                                                        <SelectItem value="after_start">Después de iniciar</SelectItem>
                                                        <SelectItem value="before_end">Antes de terminar</SelectItem>
                                                        <SelectItem value="absolute">Hora exacta</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-1">
                                                    <Input 
                                                        type="number" 
                                                        className="h-8 text-xs w-16"
                                                        value={action.offset_min || 0}
                                                        onChange={(e) => {
                                                            const newActions = [...editingSegment.segment_actions];
                                                            newActions[actionIdx] = {...action, offset_min: parseInt(e.target.value) || 0};
                                                            setEditingSegment({...editingSegment, segment_actions: newActions});
                                                        }}
                                                    />
                                                    <span className="text-xs text-gray-500">min</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={action.is_prep ?? true}
                                                        onChange={(e) => {
                                                            const newActions = [...editingSegment.segment_actions];
                                                            newActions[actionIdx] = {...action, is_prep: e.target.checked};
                                                            setEditingSegment({...editingSegment, segment_actions: newActions});
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span>Es preparación</span>
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={action.is_required ?? false}
                                                        onChange={(e) => {
                                                            const newActions = [...editingSegment.segment_actions];
                                                            newActions[actionIdx] = {...action, is_required: e.target.checked};
                                                            setEditingSegment({...editingSegment, segment_actions: newActions});
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span>Requerido</span>
                                                </label>
                                            </div>
                                            <Input 
                                                placeholder="Notas adicionales..."
                                                className="h-8 text-xs"
                                                value={action.notes || ""}
                                                onChange={(e) => {
                                                    const newActions = [...editingSegment.segment_actions];
                                                    newActions[actionIdx] = {...action, notes: e.target.value};
                                                    setEditingSegment({...editingSegment, segment_actions: newActions});
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingSegmentIdx(null)}>Cancelar</Button>
                <Button onClick={saveEditDialog}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}