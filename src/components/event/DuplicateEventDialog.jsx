import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2 } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { createFieldOrigins } from "@/components/utils/fieldOrigins";
import {
  stripEvent, stripSession, stripPreSessionDetails,
  stripSegment, stripSegmentAction, shouldCopyHospitalityTasks
} from "@/components/utils/stripEventContent";

export default function DuplicateEventDialog({ event, open, onOpenChange, mode = "duplicate" }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [progress, setProgress] = useState("");

  const isTemplateMode = mode === "template";
  const isFromTemplateMode = mode === "from_template";

  // Reset form when event changes
  React.useEffect(() => {
    if (event && open) {
      if (isTemplateMode) {
        setNewName(`Plantilla: ${event.name}`);
        setNewYear(new Date().getFullYear()); // Templates usually don't have a specific year, but we need one for the schema. Default to current.
        setNewStartDate("");
      } else if (isFromTemplateMode) {
        setNewName(event.name.replace("Plantilla: ", ""));
        setNewYear(new Date().getFullYear());
        setNewStartDate("");
      } else {
        setNewName(`${event.name} (Copia)`);
        setNewYear(event.year);
        setNewStartDate("");
      }
      setProgress("");
    }
  }, [event, open, mode]);

  const duplicateEventMutation = useMutation({
    mutationFn: async () => {
      setIsDuplicating(true);
      try {
        // 1. Create New Event
        setProgress("Creando nuevo evento...");
        const originType = isFromTemplateMode ? 'template' : (mode === 'duplicate' ? 'duplicate' : 'manual');
        const eventData = {
          ...event,
          id: undefined, // Clear ID to create new
          created_date: undefined,
          updated_date: undefined,
          created_by: undefined,
          name: newName,
          year: parseInt(newYear),
          start_date: newStartDate || null,
          end_date: null, // Clear end date as it might not match duration
          status: isTemplateMode ? "template" : "planning",
          origin: originType,
          field_origins: createFieldOrigins(event, originType)
        };
        
        const newEvent = await base44.entities.Event.create(eventData);
        
        // 2. Fetch all data from source event
        setProgress("Leyendo datos del evento original...");
        const sessions = await base44.entities.Session.filter({ event_id: event.id });
        const allSegments = await base44.entities.Segment.list(); // Optimization: filter in memory or use backend filter if needed. Using list might be heavy but safer if filter is limited. Better to filter by session IDs if possible but that's N calls.
        // Actually, let's fetch segments per session to be safer or assume list is okay for now. 
        // Given the platform constraints, listing all segments might be too much if there are thousands. 
        // Let's filter segments by session_id in the loop.
        
        // 3. Duplicate Sessions and their children
        let sessionCount = 0;
        for (const session of sessions) {
          sessionCount++;
          setProgress(`Duplicando sesión ${sessionCount} de ${sessions.length}...`);
          
          const sessionData = {
            ...session,
            id: undefined,
            created_date: undefined,
            updated_date: undefined,
            created_by: undefined,
            event_id: newEvent.id,
            date: null, // Clear date to force user to set it
            origin: originType,
            field_origins: createFieldOrigins(session, originType)
          };
          
          const newSession = await base44.entities.Session.create(sessionData);
          
          // 3a. Duplicate PreSessionDetails
          const preSessionDetails = await base44.entities.PreSessionDetails.filter({ session_id: session.id });
          for (const detail of preSessionDetails) {
          await base44.entities.PreSessionDetails.create({
            ...detail,
            id: undefined,
            created_date: undefined,
            updated_date: undefined,
            created_by: undefined,
            session_id: newSession.id,
            origin: originType,
            field_origins: createFieldOrigins(detail, originType)
          });
          }

          // 3b. Duplicate HospitalityTasks
          const hospitalityTasks = await base44.entities.HospitalityTask.filter({ session_id: session.id });
          for (const task of hospitalityTasks) {
          await base44.entities.HospitalityTask.create({
            ...task,
            id: undefined,
            created_date: undefined,
            updated_date: undefined,
            created_by: undefined,
            session_id: newSession.id,
            origin: originType,
            field_origins: createFieldOrigins(task, originType)
          });
          }

          // 3c. Duplicate Segments
          const segments = await base44.entities.Segment.filter({ session_id: session.id });
          for (const segment of segments) {
            const newSegment = await base44.entities.Segment.create({
              ...segment,
              id: undefined,
              created_date: undefined,
              updated_date: undefined,
              created_by: undefined,
              session_id: newSession.id,
              origin: originType,
              field_origins: createFieldOrigins(segment, originType)
            });

            // 3d. Duplicate Segment Actions
            const actions = await base44.entities.SegmentAction.filter({ segment_id: segment.id });
            for (const action of actions) {
              await base44.entities.SegmentAction.create({
                ...action,
                id: undefined,
                created_date: undefined,
                updated_date: undefined,
                created_by: undefined,
                segment_id: newSegment.id,
                origin: originType,
                field_origins: createFieldOrigins(action, originType)
              });
            }
          }
        }

        setProgress("¡Duplicación completada!");
        return newEvent;
      } catch (error) {
        console.error("Error duplicating event:", error);
        throw error;
      } finally {
        setIsDuplicating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      onOpenChange(false);
    }
  });

  const handleDuplicate = () => {
    if (!newName || !newYear) return;
    duplicateEventMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isDuplicating && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            <Copy className="w-6 h-6 text-blue-600" />
            {isTemplateMode ? "Guardar como Plantilla" : isFromTemplateMode ? "Crear desde Plantilla" : "Duplicar Evento"}
          </DialogTitle>
          <DialogDescription>
            {isTemplateMode 
              ? "Esto guardará el evento como una plantilla reutilizable en la sección de Plantillas."
              : "Esto creará una copia completa del evento, incluyendo sesiones, segmentos y notas."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="newName">Nombre</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              disabled={isDuplicating}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="newYear">Año</Label>
              <Input
                id="newYear"
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="2025"
                disabled={isDuplicating}
              />
            </div>
            {!isTemplateMode && (
              <div className="grid gap-2">
                <Label htmlFor="newStartDate">Fecha Inicio</Label>
                <DatePicker
                  value={newStartDate}
                  onChange={(val) => setNewStartDate(val)}
                  placeholder="Seleccionar fecha"
                  disabled={isDuplicating}
                />
              </div>
            )}
          </div>
          
          {isDuplicating && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600 py-2 bg-blue-50 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDuplicating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDuplicate} 
            disabled={!newName || !newYear || isDuplicating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isDuplicating ? (isTemplateMode ? "Guardando..." : "Creando...") : (isTemplateMode ? "Guardar Plantilla" : "Crear Evento")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}