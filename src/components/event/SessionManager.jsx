import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, Clock, Edit, Trash2, List, ChevronRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SessionManager({ eventId, sessions, segments }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
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

  const openDialog = (session = null) => {
    setEditingSession(session);
    setFormData({
      name: session?.name || '',
      date: session?.date || '',
      planned_start_time: session?.planned_start_time || '',
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
          {sessions.map((session) => (
            <Card key={session.id} className={`hover:shadow-md transition-shadow border-l-4 ${sessionColors[session.session_color || 'blue']}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{session.name}</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                      {session.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {session.date}
                        </div>
                      )}
                      {session.planned_start_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {session.planned_start_time}
                        </div>
                      )}
                    </div>
                    {session.coordinators && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <Users className="w-4 h-4" />
                        <span>{session.coordinators}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="ml-4">
                    {getSegmentCount(session.id)} segmentos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(createPageUrl(`SessionDetail?id=${session.id}`))}
                    className="flex-1"
                  >
                    <List className="w-4 h-4 mr-2" />
                    Ver Segmentos
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openDialog(session)}
                  >
                    <Edit className="w-4 h-4" />
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Editar Sesión' : 'Nueva Sesión'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Información Básica</TabsTrigger>
                <TabsTrigger value="team">Equipo y Personal</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
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
                    <Label htmlFor="date">Fecha</Label>
                    <Input 
                      id="date" 
                      name="date" 
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateFormField('date', e.target.value)}
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
                    <Label htmlFor="planned_start_time">Hora Inicio</Label>
                    <Input 
                      id="planned_start_time" 
                      name="planned_start_time" 
                      type="time"
                      value={formData.planned_start_time}
                      onChange={(e) => updateFormField('planned_start_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planned_end_time">Hora Fin</Label>
                    <Input 
                      id="planned_end_time" 
                      name="planned_end_time" 
                      type="time"
                      value={formData.planned_end_time}
                      onChange={(e) => updateFormField('planned_end_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_stage_call_offset_min">Llegada de Equipos (min antes)</Label>
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

                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingSession ? 'Guardar' : 'Crear'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="team" className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
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

                <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingSession ? 'Guardar' : 'Crear'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}