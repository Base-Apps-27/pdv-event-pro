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

export default function BlueprintEditor() {
  const queryClient = useQueryClient();

  const { data: blueprint, isLoading } = useQuery({
    queryKey: ['serviceBlueprint'],
    queryFn: async () => {
      const blueprints = await base44.entities.Service.filter({ status: 'blueprint' });
      return blueprints[0] || null;
    },
  });

  // Local editing state — deep clone of blueprint slot data
  const [slots, setSlots] = useState({});
  const [dirty, setDirty] = useState(false);

  // Phase 2: Pull configured slot names from ServiceSchedule entity
  const { getTimeSlotsForDay } = useServiceSchedules();
  const scheduledSlotNames = useMemo(() => {
    return getTimeSlotsForDay("Sunday").map(s => s.name);
  }, [getTimeSlotsForDay]);

  // Discover slot names: union of blueprint keys + scheduled slots
  // This ensures new slots appear in the editor even if the blueprint doesn't have them yet.
  const slotNames = useMemo(() => {
    if (!blueprint) return scheduledSlotNames.length > 0 ? scheduledSlotNames : [];
    const blueprintKeys = Object.keys(blueprint).filter(key => {
      const val = blueprint[key];
      return Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0].type;
    });
    const merged = new Set([...blueprintKeys, ...scheduledSlotNames]);
    return Array.from(merged).sort();
  }, [blueprint, scheduledSlotNames]);

  // Track which slots are missing from the DB blueprint (need seeding)
  const missingSlots = useMemo(() => {
    if (!blueprint) return [];
    return slotNames.filter(name => {
      const val = blueprint[name];
      return !Array.isArray(val) || val.length === 0;
    });
  }, [blueprint, slotNames]);

  const [activeSlot, setActiveSlot] = useState("");

  // Initialize local state when blueprint loads
  useEffect(() => {
    if (slotNames.length === 0) return;
    const initial = {};
    slotNames.forEach(name => {
      initial[name] = JSON.parse(JSON.stringify(blueprint?.[name] || []));
    });
    setSlots(initial);
    setDirty(false);
    if (!activeSlot || !slotNames.includes(activeSlot)) {
      setActiveSlot(slotNames[0]);
    }
  }, [blueprint, slotNames]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updatedSlots) => {
      if (!blueprint?.id) throw new Error("No blueprint found");
      return base44.entities.Service.update(blueprint.id, updatedSlots);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['serviceBlueprint']);
      setDirty(false);
      toast.success("Blueprint guardado correctamente");
    },
    onError: (err) => toast.error("Error al guardar: " + err.message),
  });

  const handleSave = () => {
    saveMutation.mutate(slots);
  };

  // Segment CRUD per slot
  const updateSegment = (slotName, idx, updatedSeg) => {
    setSlots(prev => {
      const updated = { ...prev };
      updated[slotName] = [...(prev[slotName] || [])];
      updated[slotName][idx] = updatedSeg;
      return updated;
    });
    setDirty(true);
  };

  const removeSegment = (slotName, idx) => {
    setSlots(prev => {
      const updated = { ...prev };
      updated[slotName] = (prev[slotName] || []).filter((_, i) => i !== idx);
      return updated;
    });
    setDirty(true);
  };

  const moveSegment = (slotName, idx, direction) => {
    setSlots(prev => {
      const updated = { ...prev };
      const arr = [...(prev[slotName] || [])];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return prev;
      [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
      updated[slotName] = arr;
      return updated;
    });
    setDirty(true);
  };

  const addSegment = (slotName) => {
    setSlots(prev => {
      const updated = { ...prev };
      updated[slotName] = [
        ...(prev[slotName] || []),
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
      ];
      return updated;
    });
    setDirty(true);
  };

  // Seed an empty slot by cloning segments from an existing slot
  const seedSlotFrom = (targetSlot, sourceSlot) => {
    const source = slots[sourceSlot];
    if (!source || source.length === 0) {
      toast.error(`El slot ${sourceSlot} no tiene segmentos para copiar.`);
      return;
    }
    setSlots(prev => ({
      ...prev,
      [targetSlot]: JSON.parse(JSON.stringify(source)),
    }));
    setDirty(true);
    toast.success(`Segmentos copiados de ${sourceSlot} a ${targetSlot}`);
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
        <p className="text-sm text-gray-400">Debe existir un registro de Service con status = "blueprint" para configurar los valores predeterminados.</p>
      </div>
    );
  }

  const totalDuration = (slotName) => {
    return (slots[slotName] || []).reduce((sum, s) => sum + (s.duration || 0), 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900 uppercase">Diseño Predeterminado</h3>
          <p className="text-sm text-gray-500">Define los segmentos, campos y acciones que se incluyen al crear un servicio nuevo</p>
        </div>
        <Button
          onClick={handleSave}
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
          <span>Tienes cambios sin guardar. Los cambios aquí afectarán todos los servicios nuevos que se creen.</span>
        </div>
      )}

      {/* Alert for new slots missing blueprint segments */}
      {missingSlots.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {missingSlots.length === 1
                ? `El slot "${missingSlots[0]}" es nuevo y no tiene segmentos predeterminados.`
                : `Los slots ${missingSlots.map(s => `"${s}"`).join(', ')} son nuevos y no tienen segmentos predeterminados.`}
            </span>
          </div>
          <p className="text-xs text-blue-600">Usa la pestaña correspondiente para copiar segmentos desde un slot existente o agregarlos manualmente.</p>
        </div>
      )}

      {slotNames.length > 0 && (
        <Tabs value={activeSlot} onValueChange={setActiveSlot}>
          <TabsList className="h-9 bg-gray-200">
            {slotNames.map(name => {
              const isEmpty = !slots[name] || slots[name].length === 0;
              return (
                <TabsTrigger
                  key={name}
                  value={name}
                  className={`px-4 py-1 text-sm font-bold text-gray-700 data-[state=active]:text-white ${isEmpty ? 'text-amber-600' : ''}`}
                  style={{ '--tw-ring-color': 'transparent' }}
                  data-active-style="true"
                >
                  <style>{`
                    [data-active-style][data-state="active"] { background-color: #1F8A70 !important; color: #ffffff !important; }
                    [data-active-style][data-state="active"] .badge-duration { color: rgba(255,255,255,0.8) !important; border-color: rgba(255,255,255,0.4) !important; }
                  `}</style>
                  {name}
                  {isEmpty ? (
                    <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-600">vacío</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 text-[10px] text-gray-600 border-gray-400 badge-duration">
                      {totalDuration(name)} min
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {slotNames.map(slotName => {
            const slotSegments = slots[slotName] || [];
            const isEmpty = slotSegments.length === 0;
            const otherSlots = slotNames.filter(n => n !== slotName && (slots[n] || []).length > 0);

            return (
              <TabsContent key={slotName} value={slotName} className="mt-3">
                <div className="space-y-3">
                  {/* Empty slot: show seeding options */}
                  {isEmpty && otherSlots.length > 0 && (
                    <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-6 text-center space-y-3">
                      <p className="text-sm text-blue-700 font-medium">
                        Este slot no tiene segmentos predeterminados.
                      </p>
                      <p className="text-xs text-blue-500">Copia la estructura desde un slot existente:</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {otherSlots.map(source => (
                          <Button
                            key={source}
                            size="sm"
                            variant="outline"
                            className="border-blue-400 text-blue-700 hover:bg-blue-100"
                            onClick={() => seedSlotFrom(slotName, source)}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar de {source}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-blue-400">— o agrega segmentos manualmente abajo —</p>
                    </div>
                  )}

                  {slotSegments.map((seg, idx) => (
                    <BlueprintSegmentEditor
                      key={`${slotName}-${idx}`}
                      segment={seg}
                      index={idx}
                      total={slotSegments.length}
                      onChange={(i, updated) => updateSegment(slotName, i, updated)}
                      onRemove={(i) => removeSegment(slotName, i)}
                      onMove={(i, dir) => moveSegment(slotName, i, dir)}
                    />
                  ))}

                  <Button
                    variant="outline"
                    onClick={() => addSegment(slotName)}
                    className="w-full border-dashed border-2 border-gray-300 text-gray-500 hover:border-pdv-teal hover:text-pdv-teal"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Segmento a {slotName}
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}