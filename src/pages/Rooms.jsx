import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, MapPin, Video, Volume2, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function Rooms() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const queryClient = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Room.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms']);
      setShowDialog(false);
      setEditingRoom(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Room.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms']);
      setShowDialog(false);
      setEditingRoom(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Room.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      location_description: formData.get('location_description'),
      capacity: parseInt(formData.get('capacity')) || null,
      has_projection: formData.get('has_projection') === 'on',
      has_sound_system: formData.get('has_sound_system') === 'on',
      has_translation_feed: formData.get('has_translation_feed') === 'on',
      notes: formData.get('notes'),
    };

    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Salas</h1>
          <p className="text-slate-400 mt-1">Gestiona salas y sus capacidades técnicas</p>
        </div>
        <Button onClick={() => { setEditingRoom(null); setShowDialog(true); }} className="gradient-pdv text-white font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sala
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="bg-pdv-card border-slate-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-pdv-green bg-opacity-20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-pdv-green" />
                  </div>
                  <CardTitle className="text-lg text-white">{room.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(room); setShowDialog(true); }}>
                    <Edit className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm('¿Eliminar esta sala?')) {
                      deleteMutation.mutate(room.id);
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {room.location_description && (
                <p className="text-sm text-slate-400">{room.location_description}</p>
              )}
              {room.capacity && (
                <p className="text-sm text-slate-400">Capacidad: {room.capacity} personas</p>
              )}
              <div className="flex gap-2 mt-3">
                {room.has_projection && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Video className="w-4 h-4" />
                    <span>Proyección</span>
                  </div>
                )}
                {room.has_sound_system && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Volume2 className="w-4 h-4" />
                    <span>Sonido</span>
                  </div>
                )}
                {room.has_translation_feed && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Radio className="w-4 h-4" />
                    <span>Traducción</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-pdv-card border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{editingRoom ? 'Editar Sala' : 'Nueva Sala'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Nombre *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingRoom?.name}
                required 
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_description" className="text-slate-300">Descripción de ubicación</Label>
              <Input 
                id="location_description" 
                name="location_description" 
                defaultValue={editingRoom?.location_description}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity" className="text-slate-300">Capacidad</Label>
              <Input 
                id="capacity" 
                name="capacity" 
                type="number"
                defaultValue={editingRoom?.capacity}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-slate-300">Capacidades Técnicas</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_projection" 
                  name="has_projection"
                  defaultChecked={editingRoom?.has_projection ?? true}
                />
                <label htmlFor="has_projection" className="text-sm text-slate-300">Proyección</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_sound_system" 
                  name="has_sound_system"
                  defaultChecked={editingRoom?.has_sound_system ?? true}
                />
                <label htmlFor="has_sound_system" className="text-sm text-slate-300">Sistema de sonido</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_translation_feed" 
                  name="has_translation_feed"
                  defaultChecked={editingRoom?.has_translation_feed ?? false}
                />
                <label htmlFor="has_translation_feed" className="text-sm text-slate-300">Feed de traducción</label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Notas</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                defaultValue={editingRoom?.notes}
                rows={3}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                {editingRoom ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}