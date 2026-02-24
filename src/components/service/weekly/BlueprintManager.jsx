import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutTemplate, Trash2, Edit } from "lucide-react";
import BlueprintEditor from "./BlueprintEditor";
import { toast } from "sonner";

export default function BlueprintManager() {
  const queryClient = useQueryClient();
  const [editingBlueprintId, setEditingBlueprintId] = useState(null);

  const { data: blueprints = [], isLoading } = useQuery({
    queryKey: ['serviceBlueprintsList'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
  });

  const createMutation = useMutation({
    mutationFn: async (name) => {
      return base44.entities.Service.create({
        name,
        status: 'blueprint',
        origin: 'blueprint',
        "Principal": [] // default slot
      });
    },
    onSuccess: (newBp) => {
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      setEditingBlueprintId(newBp.id);
      toast.success("Blueprint creado");
    },
    onError: (err) => toast.error("Error: " + err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      toast.success("Blueprint eliminado");
      if (editingBlueprintId) setEditingBlueprintId(null);
    }
  });

  const handleCreate = () => {
    const name = window.prompt("Nombre del Blueprint (ej. Culto de Jóvenes):");
    if (name) {
      createMutation.mutate(name);
    }
  };

  const handleRename = async (bp) => {
    const newName = window.prompt("Nuevo nombre:", bp.name);
    if (newName && newName !== bp.name) {
      await base44.entities.Service.update(bp.id, { name: newName });
      queryClient.invalidateQueries({ queryKey: ['serviceBlueprintsList'] });
      toast.success("Renombrado");
    }
  };

  if (editingBlueprintId) {
    const bp = blueprints.find(b => b.id === editingBlueprintId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => setEditingBlueprintId(null)}>
            &larr; Volver a Blueprints
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Editando: {bp?.name}</h2>
        </div>
        <BlueprintEditor blueprintId={editingBlueprintId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 uppercase">Blueprints (Plantillas)</h2>
          <p className="text-sm text-gray-500">Administra las plantillas independientes que puedes asignar a tus horarios</p>
        </div>
        <Button onClick={handleCreate} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} className="hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Blueprint
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : blueprints.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 p-8 text-center">
          <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No hay blueprints creados.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blueprints.map(bp => {
            const slots = Object.keys(bp).filter(k => Array.isArray(bp[k]) && !['segments', 'selected_announcements'].includes(k));
            return (
              <Card key={bp.id} className="hover:shadow-md transition-shadow relative group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start pr-8">
                    <div>
                      <CardTitle className="text-lg text-gray-800">{bp.name || 'Sin nombre'}</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">ID: {bp.id.slice(-6)}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleRename(bp); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar blueprint?')) deleteMutation.mutate(bp.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {slots.length > 0 ? slots.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs font-normal bg-gray-100 text-gray-600 border-gray-200">
                        {s} ({bp[s]?.length || 0})
                      </Badge>
                    )) : (
                      <span className="text-xs text-amber-500">Sin slots definidos</span>
                    )}
                  </div>
                  <Button variant="outline" className="w-full text-pdv-teal border-pdv-teal hover:bg-pdv-teal hover:text-white" onClick={() => setEditingBlueprintId(bp.id)}>
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
  );
}