import React, { useState, useEffect } from "react";
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
import { useLanguage } from "@/components/utils/i18n";

export default function Rooms() {
  const { t } = useLanguage();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
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
          <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">{t('rooms.title')}</h1>
          <p className="text-gray-600 mt-1">{t('rooms.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditingRoom(null); setShowDialog(true); }} style={gradientStyle} className="text-white font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          {t('rooms.newRoom')}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="bg-white border-gray-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-pdv-green bg-opacity-10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-pdv-green" />
                  </div>
                  <CardTitle className="text-lg text-gray-900">{room.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(room); setShowDialog(true); }}>
                    <Edit className="w-4 h-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm(t('rooms.deleteConfirm'))) {
                      deleteMutation.mutate(room.id);
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {room.location_description && (
                <p className="text-sm text-gray-600">{room.location_description}</p>
              )}
              {room.capacity && (
                <p className="text-sm text-gray-600">{t('common.capacity')}: {room.capacity} {t('common.people')}</p>
              )}
              <div className="flex gap-2 mt-3">
                {room.has_projection && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Video className="w-4 h-4" />
                    <span>{t('common.projection')}</span>
                  </div>
                )}
                {room.has_sound_system && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Volume2 className="w-4 h-4" />
                    <span>{t('common.sound')}</span>
                  </div>
                )}
                {room.has_translation_feed && (
                  <div className="flex items-center gap-1 text-xs text-pdv-green">
                    <Radio className="w-4 h-4" />
                    <span>{t('common.translation')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">{editingRoom ? t('rooms.editRoom') : t('rooms.newRoom')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')} *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingRoom?.name}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_description">{t('rooms.locationDesc')}</Label>
              <Input 
                id="location_description" 
                name="location_description" 
                defaultValue={editingRoom?.location_description}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">{t('common.capacity')}</Label>
              <Input 
                id="capacity" 
                name="capacity" 
                type="number"
                defaultValue={editingRoom?.capacity}
              />
            </div>

            <div className="space-y-3">
              <Label>{t('rooms.technicalCapabilities')}</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_projection" 
                  name="has_projection"
                  defaultChecked={editingRoom?.has_projection ?? true}
                />
                <label htmlFor="has_projection" className="text-sm">{t('common.projection')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_sound_system" 
                  name="has_sound_system"
                  defaultChecked={editingRoom?.has_sound_system ?? true}
                />
                <label htmlFor="has_sound_system" className="text-sm">{t('rooms.soundSystem')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_translation_feed" 
                  name="has_translation_feed"
                  defaultChecked={editingRoom?.has_translation_feed ?? false}
                />
                <label htmlFor="has_translation_feed" className="text-sm">{t('rooms.translationFeed')}</label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes')}</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                defaultValue={editingRoom?.notes}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" style={gradientStyle} className="text-white font-bold uppercase">
                {editingRoom ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}