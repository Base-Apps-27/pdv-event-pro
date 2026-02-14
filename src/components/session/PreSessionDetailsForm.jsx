import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";

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

  const [fieldOrigins, setFieldOrigins] = useState(preSessionDetails?.field_origins || {});

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PreSessionDetails.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['preSessionDetails', sessionId]);
      onClose();
      toast.success("Detalles pre-sesión creados ✓");
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PreSessionDetails.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['preSessionDetails', sessionId]);
      onClose();
      toast.success("Detalles pre-sesión guardados ✓");
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      session_id: sessionId,
      ...formData,
      field_origins: fieldOrigins,
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
        <div className="relative">
          <Input
            id="music_profile_id"
            value={formData.music_profile_id}
            onChange={(e) => updateField('music_profile_id', e.target.value)}
            placeholder="Ej: Pre-service worship mix ES/EN low volume"
          />
          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'music_profile_id')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slide_pack_id">Loop de Proyección</Label>
        <div className="relative">
          <Input
            id="slide_pack_id"
            value={formData.slide_pack_id}
            onChange={(e) => updateField('slide_pack_id', e.target.value)}
            placeholder="Ej: Pre-service loop Generales 2025"
          />
          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'slide_pack_id')} />
        </div>
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
        <div className="relative">
          <Textarea
            id="facility_notes"
            value={formData.facility_notes}
            onChange={(e) => updateField('facility_notes', e.target.value)}
            rows={3}
            placeholder="Notas sobre apertura de puertas, zonas específicas..."
          />
          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'facility_notes')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="general_notes">Notas Generales</Label>
        <div className="relative">
          <Textarea
            id="general_notes"
            value={formData.general_notes}
            onChange={(e) => updateField('general_notes', e.target.value)}
            rows={3}
            placeholder="Cualquier otra instrucción importante pre-sesión..."
          />
          <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'general_notes')} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
          <Save className="w-4 h-4 mr-2" />
          {preSessionDetails ? 'Guardar Cambios' : 'Crear Detalles Pre-Sesión'}
        </Button>
      </div>
    </form>
  );
}