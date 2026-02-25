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
import { resolveSegmentEnum } from "@/components/utils/segmentTypeMap";

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

export default function EmptyDayPrompt({ dayOfWeek, date, slotNames, blueprintData, onServiceCreated }) {
  // blueprintData: the resolved Service blueprint object (status='blueprint'), or null
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
        // segments: [], // REMOVED: Do not write legacy JSON segments
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
      
      // Create Service entity first
      const createdService = await base44.entities.Service.create(servicePayload);

      // HYDRATION: Create Session and Segment entities immediately
      // This ensures useSegmentMutation has IDs to write to.
      for (const slotName of slotNames) {
        // 1. Create Session
        const session = await base44.entities.Session.create({
          service_id: createdService.id,
          name: slotName,
          date: date,
          order: slotNames.indexOf(slotName) + 1
        });

        // 2. Create Segments for this session
        const segmentsToCreate = cloneSegments(bpSegments);
        for (let i = 0; i < segmentsToCreate.length; i++) {
          const segData = segmentsToCreate[i];
          
          // DECISION-002 Contract 2: Shared type normalization
          const resolvedType = resolveSegmentEnum(segData.type);

          const entityPayload = {
            session_id: session.id,
            service_id: createdService.id,
            order: i + 1,
            title: segData.title || "Untitled",
            segment_type: resolvedType,
            duration_min: Number(segData.duration) || 0,
            show_in_general: true,
            ui_fields: Array.isArray(segData.fields) ? segData.fields : [],
            ui_sub_assignments: Array.isArray(segData.sub_assignments) ? segData.sub_assignments.map(sa => ({
              label: sa.label || "Untitled",
              person_field_name: sa.person_field_name || "",
              duration_min: Number(sa.duration_min || sa.duration) || 0
            })) : [],
            requires_translation: !!segData.requires_translation,
            default_translator_source: segData.default_translator_source || "manual",
          };
          
          if (segData.number_of_songs !== undefined) {
             entityPayload.number_of_songs = Number(segData.number_of_songs) || 0;
          }
          
          await base44.entities.Segment.create(entityPayload);
        }
      }

      toast.success(`Servicio para ${dayLabel} creado con estructura completa`);
      onServiceCreated?.(createdService);
    } catch (err) {
      console.error("Error creating service:", err);
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
      {blueprintData ? (
        <p className="text-xs text-[#1F8A70] font-medium mb-4">
          Se usará el blueprint: <span className="font-bold">{blueprintData.name || `Blueprint asignado`}</span>
          {' '}({(blueprintData.segments || []).length} segmentos)
        </p>
      ) : (
        <p className="text-xs text-amber-600 mb-4">Sin blueprint configurado — se creará vacío</p>
      )}
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