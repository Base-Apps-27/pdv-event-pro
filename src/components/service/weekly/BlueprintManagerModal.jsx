/**
 * BlueprintManagerModal — Full-screen modal for managing Blueprint templates.
 *
 * Refactored 2026-02-24: Extracted from ServiceScheduleManager to avoid rendering
 * inside the scrollable schedule config dialog. Now opens as its own Dialog so the
 * blueprint list and editor each have a clean, dedicated surface.
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, LayoutTemplate, Trash2, Edit, ArrowLeft, Check, X } from "lucide-react";
import BlueprintEditor from "./BlueprintEditor";
import { toast } from "sonner";

export default function BlueprintManagerModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [editingBlueprintId, setEditingBlueprintId] = useState(null);
  const [newBlueprintName, setNewBlueprintName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const { data: blueprints = [], isLoading } = useQuery({
    queryKey: ['serviceBlueprintsList'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (name) =>
      base44.entities.Service.create({ name, status: 'blueprint', origin: 'blueprint', segments: [] }),
    onSuccess: (newBp) => {
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      setEditingBlueprintId(newBp.id);
      toast.success("Blueprint creado");
    },
    onError: (err) => toast.error("Error: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      toast.success("Blueprint eliminado");
      setEditingBlueprintId(null);
    },
  });

  const handleCreate = () => {
    if (!newBlueprintName.trim()) return;
    createMutation.mutate(newBlueprintName.trim());
    setNewBlueprintName("");
    setShowCreateForm(false);
  };

  const handleRename = async (bp) => {
    const newName = window.prompt("Nuevo nombre:", bp.name);
    if (newName && newName !== bp.name) {
      await base44.entities.Service.update(bp.id, { name: newName });
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      toast.success("Renombrado");
    }
  };

  const handleClose = () => {
    setEditingBlueprintId(null);
    onClose();
  };

  // Segment count — supports both new .segments and legacy named-slot keys
  const getSegmentCount = (bp) => {
    if (bp.segments?.length > 0) return bp.segments.length;
    const legacySlots = Object.keys(bp).filter(
      k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k)
    );
    return legacySlots.reduce((sum, k) => sum + (bp[k]?.length || 0), 0);
  };

  const editingBp = blueprints.find(b => b.id === editingBlueprintId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {editingBlueprintId ? (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500" onClick={() => setEditingBlueprintId(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                </Button>
                <span className="text-lg">Editando: {editingBp?.name}</span>
              </>
            ) : (
              <span className="text-2xl font-bold uppercase">Blueprints (Plantillas)</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {editingBlueprintId ? (
          <BlueprintEditor blueprintId={editingBlueprintId} />
        ) : (
          <div className="space-y-4 mt-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Administra las plantillas que puedes asignar a tus sesiones</p>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} className="hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Blueprint
                </Button>
              )}
            </div>

            {showCreateForm && (
              <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                <Input
                  autoFocus
                  value={newBlueprintName}
                  onChange={(e) => setNewBlueprintName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreateForm(false); setNewBlueprintName(""); } }}
                  placeholder="Ej. Culto de Jóvenes"
                  className="flex-1"
                />
                <Button size="sm" onClick={handleCreate} disabled={!newBlueprintName.trim() || createMutation.isPending} style={{ backgroundColor: '#1F8A70', color: '#fff' }}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setNewBlueprintName(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {isLoading ? (
              <p className="text-gray-400 text-center py-6">Cargando...</p>
            ) : blueprints.length === 0 ? (
              <div className="border-dashed border-2 border-gray-300 rounded-lg p-8 text-center">
                <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay blueprints creados aún.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {blueprints.map(bp => {
                  const count = getSegmentCount(bp);
                  const legacySlots = Object.keys(bp).filter(
                    k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k)
                  );
                  const isLegacy = !bp.segments && legacySlots.length > 0;

                  return (
                    <Card key={bp.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base text-gray-800">{bp.name || 'Sin nombre'}</CardTitle>
                            <p className="text-xs text-gray-400 mt-0.5">ID: {bp.id.slice(-6)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-blue-600" onClick={() => handleRename(bp)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => { if (window.confirm('¿Eliminar blueprint?')) deleteMutation.mutate(bp.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {isLegacy ? (
                            legacySlots.map(slot => (
                              <Badge key={slot} variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                {slot} ({bp[slot]?.length || 0})
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                              {count} segmento{count !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full text-sm text-pdv-teal border-pdv-teal hover:bg-pdv-teal hover:text-white"
                          onClick={() => setEditingBlueprintId(bp.id)}
                        >
                          <LayoutTemplate className="w-4 h-4 mr-2" />
                          Editar Plantilla
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}