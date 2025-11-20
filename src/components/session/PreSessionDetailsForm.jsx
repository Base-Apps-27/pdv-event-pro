import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

export default function PreSessionDetailsForm({ sessionId, preSessionDetails, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    music_profile_id: preSessionDetails?.music_profile_id || "",
    slide_pack_id: preSessionDetails?.slide_pack_id || "",
    registration_desk_open_time: preSessionDetails?.registration_desk_open_time || "",
    library_open_time: preSessionDetails?.library_open_time || "",
    facility_notes: preSessionDetails?.facility_notes || "",
    general_notes: preSessionDetails?.general_notes || "",
  });

  const { data: musicProfiles = [] } = useQuery({
    queryKey: ['musicProfiles'],
    queryFn: () => base44.entities.MusicProfile.list(),
  });

  const { data: slidePacks = [] } = useQuery({
    queryKey: ['slidePacks'],
    queryFn: () => base44.entities.SlidePack.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PreSessionDetails.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['preSessionDetails', sessionId]);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PreSessionDetails.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['preSessionDetails', sessionId]);
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      session_id: sessionId,
      ...formData,
    };

    if (preSessionDetails) {
      updateMutation.mutate({ id: preSessionDetails.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="music_profile_id">Música de Ambiente</Label>
        <Select
          value={formData.music_profile_id}
          onValueChange={(value) => setFormData({ ...formData, music_profile_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar perfil de música..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Ninguno</SelectItem>
            {musicProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slide_pack_id">Loop de Proyección</Label>
        <Select
          value={formData.slide_pack_id}
          onValueChange={(value) => setFormData({ ...formData, slide_pack_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar paquete de slides..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Ninguno</SelectItem>
            {slidePacks.map((pack) => (
              <SelectItem key={pack.id} value={pack.id}>
                {pack.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="registration_desk_open_time">Apertura Registro</Label>
          <Input
            type="time"
            id="registration_desk_open_time"
            value={formData.registration_desk_open_time}
            onChange={(e) => setFormData({ ...formData, registration_desk_open_time: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="library_open_time">Apertura Librería</Label>
          <Input
            type="time"
            id="library_open_time"
            value={formData.library_open_time}
            onChange={(e) => setFormData({ ...formData, library_open_time: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="facility_notes">Notas de Instalaciones</Label>
        <Textarea
          id="facility_notes"
          value={formData.facility_notes}
          onChange={(e) => setFormData({ ...formData, facility_notes: e.target.value })}
          rows={3}
          placeholder="Notas sobre apertura de puertas, zonas específicas..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="general_notes">Notas Generales</Label>
        <Textarea
          id="general_notes"
          value={formData.general_notes}
          onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
          rows={3}
          placeholder="Cualquier otra instrucción importante pre-sesión..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {preSessionDetails ? 'Guardar Cambios' : 'Crear Detalles Pre-Sesión'}
        </Button>
      </div>
    </form>
  );
}