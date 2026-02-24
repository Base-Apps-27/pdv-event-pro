/**
 * BlueprintEditor — Admin UI for editing the service blueprint (status='blueprint').
 * 
 * Blueprint Revamp (2026-02-18): Single source of truth for what gets seeded
 * into new weekly services. Lives alongside ServiceScheduleManager in the
 * schedule configuration dialog.
 *
 * Shows one tab per time slot defined in the blueprint (e.g. 9:30am, 11:30am).
 * Each tab lists the default segments with full control over fields, actions,
 * sub-assignments, translation config, and durations.
 */

import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Save, Loader2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import BlueprintSegmentEditor from "./BlueprintSegmentEditor";
import { useServiceSchedules } from "./useServiceSchedules";

export default function BlueprintEditor({ blueprintId }) {
  const queryClient = useQueryClient();

  const { data: blueprint, isLoading } = useQuery({
    queryKey: ['serviceBlueprint', blueprintId],
    queryFn: async () => {
      if (!blueprintId) return null;
      return await base44.entities.Service.get(blueprintId);
    },
    enabled: !!blueprintId
  });

  const [segments, setSegments] = useState([]);
  const [dirty, setDirty] = useState(false);
  const initializedRef = React.useRef(null);

  useEffect(() => {
    if (!blueprint) return;
    const currentId = blueprint.id;
    if (initializedRef.current === currentId) return;

    // Always use only the canonical `segments` array — never fall back to legacy named-slot keys.
    // Legacy blueprints (e.g. "Servicios Dominicales") store data in "9:30am"/"11:30am" keys;
    // those are intentionally ignored here. Edit via "Nuevo Blueprint" to start fresh.
    const initialSegments = Array.isArray(blueprint.segments) ? blueprint.segments : [];

    setSegments(JSON.parse(JSON.stringify(initialSegments)));
    setDirty(false);
    initializedRef.current = currentId;
  }, [blueprint]);

  const saveMutation = useMutation({
    mutationFn: async (updatedSegments) => {
      if (!blueprint?.id) throw new Error("No blueprint found");
      return base44.entities.Service.update(blueprint.id, { segments: updatedSegments });
    },
    onSuccess: () => {
      initializedRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      setDirty(false);
      toast.success("Blueprint guardado correctamente");
    },
    onError: (err) => toast.error("Error al guardar: " + err.message),
  });

  const updateSegment = (idx, updatedSeg) => {
    setSegments(prev => {
      const arr = [...prev];
      arr[idx] = updatedSeg;
      return arr;
    });
    setDirty(true);
  };

  const removeSegment = (idx) => {
    setSegments(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const moveSegment = (idx, direction) => {
    setSegments(prev => {
      const arr = [...prev];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return prev;
      [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
      return arr;
    });
    setDirty(true);
  };

  const addSegment = () => {
    setSegments(prev => [
      ...prev,
      {
        type: "special",
        title: "Nuevo Segmento",
        duration: 10,
        fields: ["presenter"],
        data: {},
        actions: [],
        sub_assignments: [],
        requires_translation: false,
        default_translator_source: "manual",
      },
    ]);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="text-center py-12 space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="text-gray-600 font-medium">No se encontró un blueprint en la base de datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900 uppercase">Segmentos del Blueprint</h3>
          <p className="text-sm text-gray-500">Estos segmentos se usarán al generar una nueva sesión con esta plantilla.</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(segments)}
          disabled={!dirty || saveMutation.isPending}
          style={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
          className="hover:opacity-90"
        >
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Guardar Blueprint</>
          )}
        </Button>
      </div>

      {dirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Tienes cambios sin guardar.</span>
        </div>
      )}

      <div className="space-y-3 mt-4">
        {segments.length === 0 && (
          <div className="text-center py-8 bg-gray-50 border border-dashed rounded-lg text-gray-500">
            No hay segmentos definidos en este blueprint.
          </div>
        )}

        {segments.map((seg, idx) => (
          <BlueprintSegmentEditor
            key={`seg-${idx}`}
            segment={seg}
            index={idx}
            total={segments.length}
            onChange={(i, updated) => updateSegment(i, updated)}
            onRemove={(i) => removeSegment(i)}
            onMove={(i, dir) => moveSegment(i, dir)}
          />
        ))}

        <Button
          variant="outline"
          onClick={addSegment}
          className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:border-[#1F8A70] hover:text-[#1F8A70] mt-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Segmento
        </Button>
      </div>
    </div>
  );
}