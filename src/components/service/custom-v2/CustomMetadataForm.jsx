/**
 * CustomMetadataForm.jsx — Custom V2 service metadata inputs.
 * 
 * DECISION (2026-03-02): Service-level fields (name, date, time, location,
 * description) are saved directly to the Service entity via debounced writes.
 * This is separate from segment-level writes (which go through useEntityWrite).
 *
 * Bilingual: all labels support EN/ES via useLanguage.
 */

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import { toast } from "sonner";

const DEBOUNCE_MS = 1200;

export default memo(function CustomMetadataForm({ service, onServiceUpdated }) {
  const { language } = useLanguage();
  const en = language === 'en';

  // Local state mirrors service entity for instant UI
  const [name, setName] = useState(service?.name || '');
  const [date, setDate] = useState(service?.date || '');
  const [time, setTime] = useState(service?.time || '10:00');
  const [location, setLocation] = useState(service?.location || '');
  const [description, setDescription] = useState(service?.description || '');

  // Sync from prop when service changes externally
  useEffect(() => {
    if (service) {
      setName(service.name || '');
      setDate(service.date || '');
      setTime(service.time || '10:00');
      setLocation(service.location || '');
      setDescription(service.description || '');
    }
  }, [service?.id, service?.updated_date]);

  // Auto-compute day_of_week
  const dayOfWeek = (() => {
    if (!date) return '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date + 'T00:00:00').getDay()] || '';
  })();

  // Debounced save to Service entity
  const timerRef = useRef(null);
  const saveField = useCallback((updates) => {
    if (!service?.id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await base44.entities.Service.update(service.id, updates);
        onServiceUpdated?.();
      } catch (err) {
        console.error('[CustomMetadata] Save failed:', err.message);
        toast.error(en ? 'Save failed' : 'Error al guardar');
      }
    }, DEBOUNCE_MS);
  }, [service?.id, onServiceUpdated, en]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>{en ? 'Service Details' : 'Detalles del Servicio'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{en ? 'Service Name *' : 'Nombre del Servicio *'}</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                saveField({ name: e.target.value, day_of_week: dayOfWeek });
              }}
              placeholder={en ? 'E.g. Special Christmas Service' : 'Ej. Servicio Especial de Navidad'}
            />
          </div>
          <div className="space-y-2">
            <Label>{en ? 'Date *' : 'Fecha *'}</Label>
            <DatePicker
              value={date}
              onChange={(val) => {
                setDate(val);
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dow = val ? days[new Date(val + 'T00:00:00').getDay()] : '';
                saveField({ date: val, day_of_week: dow });
              }}
              className="w-full max-w-full"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{en ? 'Day of Week (auto)' : 'Día de la Semana (auto)'}</Label>
            <Input value={dayOfWeek} disabled className="bg-gray-50" />
          </div>
          <div className="space-y-2">
            <Label>{en ? 'Time *' : 'Hora *'}</Label>
            <TimePicker
              value={time}
              onChange={(val) => {
                setTime(val);
                saveField({ time: val });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{en ? 'Location' : 'Ubicación'}</Label>
            <Input
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                saveField({ location: e.target.value });
              }}
              placeholder={en ? 'Main sanctuary' : 'Santuario principal'}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{en ? 'Description' : 'Descripción'}</Label>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              saveField({ description: e.target.value });
            }}
            rows={2}
            placeholder={en ? 'Brief service description...' : 'Descripción breve del servicio...'}
          />
        </div>
      </CardContent>
    </Card>
  );
});