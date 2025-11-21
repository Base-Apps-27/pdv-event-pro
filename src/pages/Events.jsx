import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, MapPin, Edit, Trash2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeleteEventDialog from "@/components/event/DeleteEventDialog";

export default function Events() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setShowDialog(false);
      setEditingEvent(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setShowDialog(false);
      setEditingEvent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      setEventToDelete(null);
    },
  });

  const handleDeleteClick = (event) => {
    // First confirmation: Browser alert
    if (window.confirm("¿Estás seguro de que deseas iniciar el proceso de eliminación? Se requerirá una confirmación adicional.")) {
      setEventToDelete(event);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      theme: formData.get('theme'),
      year: parseInt(formData.get('year')),
      location: formData.get('location'),
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date'),
      description: formData.get('description'),
      status: formData.get('status'),
      print_color: formData.get('print_color'),
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (event) => {
    setEditingEvent(event);
    setShowDialog(true);
  };

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  const statusLabels = {
    planning: "Planificación",
    confirmed: "Confirmado",
    in_progress: "En Progreso",
    completed: "Completado",
    archived: "Archivado"
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 uppercase">Eventos</h1>
          <p className="text-gray-600 mt-1">Gestiona congresos y eventos especiales</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setShowDialog(true); }} className="gradient-pdv text-white hover:opacity-90 font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Card key={event.id} className="hover:shadow-lg transition-shadow bg-white border-gray-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2 text-gray-900">{event.name}</CardTitle>
                  <Badge className={`${statusColors[event.status]} border text-xs`}>
                    {statusLabels[event.status]}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-gray-300">{event.year}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {event.theme && (
                  <p className="text-sm text-pdv-green font-semibold italic">"{event.theme}"</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location || "Sin ubicación"}</span>
                </div>

                {event.start_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{event.start_date} {event.end_date && `- ${event.end_date}`}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200 flex gap-2">
                  <Link to={createPageUrl(`EventDetail?id=${event.id}`)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white">
                      Ver Detalles
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(event)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Evento *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={editingEvent?.name}
                  required 
                  placeholder="Congreso 2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Año *</Label>
                <Input 
                  id="year" 
                  name="year" 
                  type="number"
                  defaultValue={editingEvent?.year || new Date().getFullYear()}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Tema/Lema</Label>
              <Input 
                id="theme" 
                name="theme" 
                defaultValue={editingEvent?.theme}
                placeholder="Conquistando nuevas alturas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input 
                id="location" 
                name="location" 
                defaultValue={editingEvent?.location}
                placeholder="Centro de Convenciones"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha Inicio</Label>
                <Input 
                  id="start_date" 
                  name="start_date" 
                  type="date"
                  defaultValue={editingEvent?.start_date}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Fecha Fin</Label>
                <Input 
                  id="end_date" 
                  name="end_date" 
                  type="date"
                  defaultValue={editingEvent?.end_date}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select name="status" defaultValue={editingEvent?.status || 'planning'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planificación</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="print_color">Color de Impresión</Label>
                <Select name="print_color" defaultValue={editingEvent?.print_color || 'blue'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Azul</SelectItem>
                    <SelectItem value="green">Verde</SelectItem>
                    <SelectItem value="pink">Rosa</SelectItem>
                    <SelectItem value="orange">Naranja</SelectItem>
                    <SelectItem value="yellow">Amarillo</SelectItem>
                    <SelectItem value="purple">Morado</SelectItem>
                    <SelectItem value="red">Rojo</SelectItem>
                    <SelectItem value="teal">Turquesa</SelectItem>
                    <SelectItem value="charcoal">Carbón</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea 
                id="description" 
                name="description" 
                defaultValue={editingEvent?.description}
                rows={3}
                placeholder="Descripción general del evento"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                {editingEvent ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteEventDialog 
        open={!!eventToDelete} 
        onOpenChange={(open) => !open && setEventToDelete(null)}
        onConfirm={() => deleteMutation.mutate(eventToDelete.id)}
        eventName={eventToDelete?.name}
      />
    </div>
  );
}