import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/ui/DatePicker";
import { createFieldOrigins } from "@/components/utils/fieldOrigins";
import {
  stripEvent, stripSession, stripPreSessionDetails,
  stripSegment, stripSegmentAction, stripStreamBlock, shouldCopyHospitalityTasks
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
        // Determine origin type for field_origins tracking
        const originType = isFromTemplateMode ? 'template' : (mode === 'duplicate' ? 'duplicate' : 'manual');
        // Template mode: strip all instance-specific content, keep only structure
        const shouldStrip = isTemplateMode;

        // 1. Create New Event
        setProgress(shouldStrip ? "Creando plantilla (limpiando contenido)..." : "Creando nuevo evento...");
        let baseEventData = { ...event };
        if (shouldStrip) {
          baseEventData = stripEvent(baseEventData);
        }
        const eventData = {
          ...baseEventData,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          created_by: undefined,
          name: newName,
          year: parseInt(newYear),
          start_date: newStartDate || null,
          end_date: null,
          status: isTemplateMode ? "template" : "planning",
          origin: originType,
          field_origins: createFieldOrigins(event, originType)
        };
        
        const newEvent = await base44.entities.Event.create(eventData);
        
        // 2. Fetch sessions from source event
        setProgress("Leyendo estructura del evento original...");
        const sessions = await base44.entities.Session.filter({ event_id: event.id });
        
        // 3. Duplicate Sessions and their children
        let sessionCount = 0;
        for (const session of sessions) {
          sessionCount++;
          setProgress(`${shouldStrip ? 'Copiando estructura' : 'Duplicando'} sesión ${sessionCount} de ${sessions.length}...`);
          
          let sessionBase = { ...session };
          if (shouldStrip) {
            sessionBase = stripSession(sessionBase);
          }
          const sessionData = {
            ...sessionBase,
            id: undefined,
            created_date: undefined,
            updated_date: undefined,
            created_by: undefined,
            event_id: newEvent.id,
            date: null, // Always clear date to force user to set it
            origin: originType,
            field_origins: createFieldOrigins(session, originType)
          };
          
          const newSession = await base44.entities.Session.create(sessionData);
          
          // 3a. Duplicate PreSessionDetails (stripped for templates)
          const preSessionDetails = await base44.entities.PreSessionDetails.filter({ session_id: session.id });
          for (const detail of preSessionDetails) {
            let detailBase = { ...detail };
            if (shouldStrip) {
              detailBase = stripPreSessionDetails(detailBase);
            }
            await base44.entities.PreSessionDetails.create({
              ...detailBase,
              id: undefined,
              created_date: undefined,
              updated_date: undefined,
              created_by: undefined,
              session_id: newSession.id,
              origin: originType,
              field_origins: createFieldOrigins(detail, originType)
            });
          }

          // 3b. Duplicate HospitalityTasks (skipped entirely for templates)
          if (!shouldStrip || shouldCopyHospitalityTasks()) {
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
          }

          // 3c. Duplicate Segments (stripped for templates)
          // Build old→new segment ID map for StreamBlock anchor remapping
          const segmentIdMap = {};
          const segments = await base44.entities.Segment.filter({ session_id: session.id });
          for (const segment of segments) {
            let segmentBase = { ...segment };
            if (shouldStrip) {
              segmentBase = stripSegment(segmentBase);
            }
            const newSegment = await base44.entities.Segment.create({
              ...segmentBase,
              id: undefined,
              created_date: undefined,
              updated_date: undefined,
              created_by: undefined,
              session_id: newSession.id,
              origin: originType,
              field_origins: createFieldOrigins(segment, originType)
            });
            segmentIdMap[segment.id] = newSegment.id;

            // 3d. Duplicate Segment Actions (stripped for templates)
            const actions = await base44.entities.SegmentAction.filter({ segment_id: segment.id });
            for (const action of actions) {
              let actionBase = { ...action };
              if (shouldStrip) {
                actionBase = stripSegmentAction(actionBase);
              }
              await base44.entities.SegmentAction.create({
                ...actionBase,
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

          // 3e. Duplicate StreamBlocks (livestream timeline, stripped for templates)
          // StreamBlocks reference session_id and optionally anchor_segment_id
          const streamBlocks = await base44.entities.StreamBlock.filter({ session_id: session.id });
          for (const block of streamBlocks) {
            let blockBase = { ...block };
            if (shouldStrip) {
              blockBase = stripStreamBlock(blockBase);
            }
            // Remap anchor_segment_id to the new segment's ID
            const remappedAnchor = block.anchor_segment_id
              ? (segmentIdMap[block.anchor_segment_id] || null)
              : null;
            await base44.entities.StreamBlock.create({
              ...blockBase,
              id: undefined,
              created_date: undefined,
              updated_date: undefined,
              created_by: undefined,
              session_id: newSession.id,
              anchor_segment_id: remappedAnchor,
              // If anchor couldn't be remapped, mark orphaned and snapshot last known start
              orphaned: (block.anchor_segment_id && !remappedAnchor) ? true : false,
              last_known_start: (block.anchor_segment_id && !remappedAnchor) ? (block.last_known_start || '') : '',
            });
          }
        }

        setProgress(shouldStrip ? "¡Plantilla creada!" : "¡Duplicación completada!");
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
      queryClient.invalidateQueries(['eventTemplates']);
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
              ? "Se copiará la estructura del evento (sesiones, tipos de segmento, duraciones, orden) pero se eliminarán todos los nombres, canciones, versículos, notas y contenido específico. Los campos clave se marcarán como [TBD]."
              : isFromTemplateMode
              ? "Se creará un nuevo evento desde la plantilla. La estructura estará lista — solo necesitas llenar los nombres, canciones y contenido."
              : "Esto creará una copia completa del evento, incluyendo sesiones, segmentos, notas y todo el contenido."}
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