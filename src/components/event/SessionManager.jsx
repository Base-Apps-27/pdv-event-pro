import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, Clock, Edit, Trash2, List, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function SessionManager({ eventId, sessions, segments }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      event_id: eventId,
      name: formData.get('name'),
      date: formData.get('date'),
      planned_start_time: formData.get('planned_start_time'),
      planned_end_time: formData.get('planned_end_time'),
      default_stage_call_offset_min: parseInt(formData.get('default_stage_call_offset_min') || 15),
      location: formData.get('location'),
      notes: formData.get('notes'),
      order: editingSession?.order || sessions.length + 1,
    };

    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSegmentCount = (sessionId) => {
    return segments.filter(seg => seg.session_id === sessionId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Sesiones del Evento</h2>
        <Button onClick={() => { setEditingSession(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sesión
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No hay sesiones</h3>
          <p className="text-slate-500 mb-4">Comienza agregando la primera sesión del evento</p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Primera Sesión
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
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
                    onClick={() => { setEditingSession(session); setShowDialog(true); }}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Editar Sesión' : 'Nueva Sesión'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Sesión *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingSession?.name}
                required 
                placeholder="Sábado Noche"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date"
                  defaultValue={editingSession?.date}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input 
                  id="location" 
                  name="location" 
                  defaultValue={editingSession?.location}
                  placeholder="Salón principal"
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
                  defaultValue={editingSession?.planned_start_time}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_end_time">Hora Fin</Label>
                <Input 
                  id="planned_end_time" 
                  name="planned_end_time" 
                  type="time"
                  defaultValue={editingSession?.planned_end_time}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_stage_call_offset_min">Llamado Escenario (min)</Label>
                <Input 
                  id="default_stage_call_offset_min" 
                  name="default_stage_call_offset_min" 
                  type="number"
                  defaultValue={editingSession?.default_stage_call_offset_min || 15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                defaultValue={editingSession?.notes}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingSession ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}