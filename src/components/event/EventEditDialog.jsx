import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/DatePicker";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import OutOfRangeSessionsModal from "./OutOfRangeSessionsModal";
import { logUpdate } from "@/components/utils/editActionLogger";
import { toast } from "sonner";

// UX-AUDIT #6 FIX (2026-03-06): Supports BOTH create (event=null) and edit (event=object).
// Previously bailed on !event — now routes to createMutation when no event passed.
export default function EventEditDialog({ open, onOpenChange, event, onSaved, user }) {
  const queryClient = useQueryClient();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  const [formData, setFormData] = useState({});
  const [fieldOrigins, setFieldOrigins] = useState({});

  // Reset form when dialog opens — supports both create (event=null) and edit
  useEffect(() => {
    if (!open) return;
    setFieldOrigins(event?.field_origins || {});
    setFormData({
      name: event?.name || '',
      slug: event?.slug || '',
      theme: event?.theme || '',
      year: event?.year || new Date().getFullYear(),
      location: event?.location || '',
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      description: event?.description || '',
      status: event?.status || 'planning',
      print_color: event?.print_color || 'blue',
      promote_in_announcements: event?.promote_in_announcements || false,
      promotion_start_date: event?.promotion_start_date || '',
      promotion_end_date: event?.promotion_end_date || '',
      announcement_blurb: event?.announcement_blurb || '',
      promotion_targets: event?.promotion_targets ? event.promotion_targets.join(', ') : '',
    });
  }, [event, open]);

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const generateSlug = (name, year) => {
    return `${name}-${year}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const [previousRange, setPreviousRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (event) {
      setPreviousRange({ start: event.start_date || '', end: event.end_date || '' });
    }
  }, [event]);

  const [showRangeFix, setShowRangeFix] = useState(false);
  const [pendingRange, setPendingRange] = useState({ start: '', end: '' });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, previousState }) => {
      const updated = await base44.entities.Event.update(id, data);
      await logUpdate('Event', id, previousState, { ...previousState, ...data }, null, user);
      return updated;
    },
    onSuccess: () => {
      // Refresh both list and detail caches
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['event', event?.id]);
      queryClient.invalidateQueries(['editActionLogs']);
      if (onSaved) onSaved();
      toast.success("Evento actualizado ✓");
      // If range changed, open session-fix modal
      const changed = (previousRange.start !== pendingRange.start) || (previousRange.end !== pendingRange.end);
      if (changed) {
        setShowRangeFix(true);
      } else {
        onOpenChange(false);
      }
    },
    onError: (err) => {
      toast.error(`Error al actualizar: ${err.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!event) return;
    const slug = formData.slug || generateSlug(formData.name, formData.year);
    const data = {
      ...formData,
      slug,
      year: parseInt(formData.year),
      field_origins: fieldOrigins,
      promotion_targets: (formData.promotion_targets || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    };
    setPendingRange({ start: data.start_date || '', end: data.end_date || '' });
    updateMutation.mutate({ id: event.id, data, previousState: event });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">Editar Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Evento *</Label>
              <div className="relative">
                <Input id="name" value={formData.name || ''} onChange={(e) => updateFormField('name', e.target.value)} required placeholder="Congreso 2025" />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'name')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Año *</Label>
              <div className="relative">
                <Input id="year" type="number" value={formData.year || ''} onChange={(e) => updateFormField('year', e.target.value)} required />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'year')} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Tema/Lema</Label>
            <div className="relative">
              <Input id="theme" value={formData.theme || ''} onChange={(e) => updateFormField('theme', e.target.value)} placeholder="Conquistando nuevas alturas" />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'theme')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <div className="relative">
              <Input id="location" value={formData.location || ''} onChange={(e) => updateFormField('location', e.target.value)} placeholder="Centro de Convenciones" />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'location')} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <div className="relative">
                <DatePicker value={formData.start_date || ''} onChange={(val) => updateFormField('start_date', val)} placeholder="Seleccionar fecha" />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'start_date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <div className="relative">
                <DatePicker value={formData.end_date || ''} onChange={(val) => updateFormField('end_date', val)} placeholder="Seleccionar fecha" />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'end_date')} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="relative">
                <Select value={formData.status || 'planning'} onValueChange={(value) => updateFormField('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">En Planificación</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="in_progress">En Curso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'status')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color de Impresión</Label>
              <div className="relative">
                <Select value={formData.print_color || 'blue'} onValueChange={(value) => updateFormField('print_color', value)}>
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
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'print_color')} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <div className="relative">
              <Textarea value={formData.description || ''} onChange={(e) => updateFormField('description', e.target.value)} rows={3} placeholder="Descripción general del evento" />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description')} />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox id="promote_in_announcements" checked={!!formData.promote_in_announcements} onCheckedChange={(checked) => updateFormField('promote_in_announcements', checked)} />
              <Label htmlFor="promote_in_announcements" className="font-bold" style={{ color: '#1F8A70' }}>Promocionar en Anuncios</Label>
            </div>

            {formData.promote_in_announcements && (
              <div className="space-y-4 pl-6 border-l-2" style={{ borderColor: 'rgba(31, 138, 112, 0.2)' }}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inicio Promoción</Label>
                    <DatePicker value={formData.promotion_start_date || ''} onChange={(val) => updateFormField('promotion_start_date', val)} placeholder="Seleccionar fecha" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin Promoción</Label>
                    <DatePicker value={formData.promotion_end_date || ''} onChange={(val) => updateFormField('promotion_end_date', val)} placeholder="Seleccionar fecha" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Blurb para Anuncio (Corto)</Label>
                  <Textarea value={formData.announcement_blurb || ''} onChange={(e) => updateFormField('announcement_blurb', e.target.value)} rows={2} placeholder="Texto corto para leer en anuncios..." />
                </div>
                <div className="space-y-2">
                  <Label>Targets (Tags separados por coma)</Label>
                  <Input value={formData.promotion_targets || ''} onChange={(e) => updateFormField('promotion_targets', e.target.value)} placeholder="Ej. Domingo AM, Jóvenes" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="text-white font-bold uppercase" style={gradientStyle} disabled={updateMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Follow-up modal to fix sessions outside new event dates */}
      <OutOfRangeSessionsModal
        open={showRangeFix}
        onOpenChange={(v) => {
          setShowRangeFix(v);
          if (!v) onOpenChange(false);
        }}
        eventId={event?.id}
        newStartDate={pendingRange.start}
        newEndDate={pendingRange.end}
      />
    </Dialog>
  );
}