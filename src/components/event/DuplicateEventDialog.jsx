import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2 } from "lucide-react";

export default function DuplicateEventDialog({ event, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [progress, setProgress] = useState("");

  // Reset form when event changes
  React.useEffect(() => {
    if (event && open) {
      setNewName(`${event.name} (Copia)`);
      setNewYear(event.year);
      setNewStartDate("");
      setProgress("");
    }
  }, [event, open]);

  const duplicateEventMutation = useMutation({
    mutationFn: async () => {
      setIsDuplicating(true);
      try {
        // 1. Create New Event
        setProgress("Creando nuevo evento...");
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
          status: "planning"
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
            // Clear specific dates/times if needed, but keeping them relative might be useful? 
            // For now, we'll keep the times but date might be wrong if we shifted duplicate. 
            // User can adjust dates later.
            date: null // Clear date to force user to set it
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
              session_id: newSession.id
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
              session_id: newSession.id
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
              session_id: newSession.id
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
                segment_id: newSegment.id
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
            Duplicar Evento
          </DialogTitle>
          <DialogDescription>
            Esto creará una copia completa del evento, incluyendo sesiones, segmentos y notas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="newName">Nuevo Nombre</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del evento"
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
            <div className="grid gap-2">
              <Label htmlFor="newStartDate">Nueva Fecha Inicio</Label>
              <Input
                id="newStartDate"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                disabled={isDuplicating}
              />
            </div>
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDuplicating ? "Duplicando..." : "Duplicar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}