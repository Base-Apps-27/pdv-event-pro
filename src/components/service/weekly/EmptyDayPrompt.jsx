/**
 * EmptyDayPrompt — Shown when a day has a ServiceSchedule but no Service entity.
 * 
 * Recurring Services Refactor (2026-02-23): Provides a "Create Service" button
 * that creates a Service entity with the correct day_of_week, date, and segments
 * seeded from the schedule's blueprint (or Sunday blueprint as fallback).
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

export default function EmptyDayPrompt({ dayOfWeek, date, slotNames, blueprintData, onServiceCreated }) {
  const [creating, setCreating] = useState(false);
  const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Build empty team objects for all slots
      const emptySlotObj = {};
      slotNames.forEach(name => { emptySlotObj[name] = ""; });

      // Seed segments from blueprint if available
      const servicePayload = {
        name: `${dayLabel} - ${date}`,
        day_of_week: dayOfWeek,
        date,
        status: "active",
        service_type: "weekly",
        origin: "manual",
        coordinators: { ...emptySlotObj },
        ujieres: { ...emptySlotObj },
        sound: { ...emptySlotObj },
        luces: { ...emptySlotObj },
        fotografia: { ...emptySlotObj },
        pre_service_notes: { ...emptySlotObj },
        receso_notes: {},
        selected_announcements: [],
        segments: [],
      };

      // Build receso notes for non-last slots
      slotNames.slice(0, -1).forEach(s => { servicePayload.receso_notes[s] = ""; });

      // Seed segments per slot from blueprint
      const cloneSegments = (bpSegments) => (bpSegments || []).map(seg => {
        const clone = JSON.parse(JSON.stringify(seg));
        if (clone.data) clone.data = {};
        if (seg.type === "worship") {
          clone.songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
        }
        return clone;
      });

      // blueprintData is the full Service blueprint object (status='blueprint').
      // Use the canonical `segments` array — no slot keys, segments apply to all sessions.
      const bpSegments = blueprintData?.segments || [];
      slotNames.forEach(name => {
        servicePayload[name] = cloneSegments(bpSegments);
      });

      const created = await base44.entities.Service.create(servicePayload);
      toast.success(`Servicio para ${dayLabel} creado`);
      onServiceCreated?.(created);
    } catch (err) {
      toast.error("Error al crear servicio: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="p-8 text-center bg-white border-2 border-dashed border-gray-300">
      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-600 mb-1 font-medium">No hay servicio para {dayLabel}</p>
      <p className="text-gray-400 text-sm mb-4">Fecha: {date}</p>
      <Button
        onClick={handleCreate}
        disabled={creating}
        style={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
        className="hover:opacity-90"
      >
        {creating ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</>
        ) : (
          <><Plus className="w-4 h-4 mr-2" />Crear Servicio para {dayLabel}</>
        )}
      </Button>
    </Card>
  );
}