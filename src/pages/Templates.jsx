import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FileText, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", "Especial", "Cierre"
];

const COLOR_CODES = [
  { value: "worship", label: "Adoración" },
  { value: "preach", label: "Predicación" },
  { value: "break", label: "Descanso" },
  { value: "tech", label: "Técnico" },
  { value: "special", label: "Especial" },
  { value: "default", label: "Predeterminado" }
];

export default function Templates() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.SegmentTemplate.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SegmentTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates']);
      setShowDialog(false);
      setEditingTemplate(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SegmentTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates']);
      setShowDialog(false);
      setEditingTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SegmentTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      name: formData.get('name'),
      segment_type: formData.get('segment_type'),
      default_title: formData.get('default_title'),
      default_duration_min: parseInt(formData.get('default_duration_min')),
      default_stage_call_offset_min: parseInt(formData.get('default_stage_call_offset_min')),
      default_projection_notes: formData.get('default_projection_notes'),
      default_sound_notes: formData.get('default_sound_notes'),
      default_ushers_notes: formData.get('default_ushers_notes'),
      default_color_code: formData.get('default_color_code'),
      show_in_general: formData.get('show_in_general') === 'on',
      show_in_projection: formData.get('show_in_projection') === 'on',
      show_in_sound: formData.get('show_in_sound') === 'on',
      show_in_ushers: formData.get('show_in_ushers') === 'on',
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const colorSchemes = {
    worship: "bg-purple-100 text-purple-800 border-purple-200",
    preach: "bg-orange-100 text-orange-800 border-orange-200",
    break: "bg-gray-100 text-gray-800 border-gray-200",
    tech: "bg-blue-100 text-blue-800 border-blue-200",
    special: "bg-pink-100 text-pink-800 border-pink-200",
    default: "bg-slate-100 text-slate-700 border-slate-200"
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Plantillas de Segmentos</h1>
          <p className="text-slate-600 mt-1">Crea plantillas reutilizables para agilizar la programación</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge className={`${colorSchemes[template.default_color_code || 'default']} border text-xs`}>
                      {template.segment_type}
                    </Badge>
                  </div>
                </div>
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {template.default_title && (
                  <div>
                    <p className="text-xs text-slate-500">Título predeterminado</p>
                    <p className="text-sm font-medium text-slate-900">{template.default_title}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Duración</p>
                    <p className="font-medium">{template.default_duration_min} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Llamado</p>
                    <p className="font-medium">{template.default_stage_call_offset_min} min antes</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setEditingTemplate(template); setShowDialog(true); }}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (confirm('¿Eliminar esta plantilla?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && (
          <Card className="col-span-full p-12 text-center border-dashed border-2">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No hay plantillas</h3>
            <p className="text-slate-500 mb-4">Crea tu primera plantilla para agilizar la creación de segmentos</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Plantilla
            </Button>
          </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Plantilla *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingTemplate?.name}
                required 
                placeholder="Bloque de Alabanza 30min"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="segment_type">Tipo de Segmento *</Label>
                <Select name="segment_type" defaultValue={editingTemplate?.segment_type || "Plenaria"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_color_code">Color</Label>
                <Select name="default_color_code" defaultValue={editingTemplate?.default_color_code || "default"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_CODES.map((color) => (
                      <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_title">Título Predeterminado</Label>
              <Input 
                id="default_title" 
                name="default_title" 
                defaultValue={editingTemplate?.default_title}
                placeholder="Alabanza y Adoración"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_duration_min">Duración (minutos)</Label>
                <Input 
                  id="default_duration_min" 
                  name="default_duration_min" 
                  type="number"
                  defaultValue={editingTemplate?.default_duration_min || 30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_stage_call_offset_min">Llamado Escenario (min antes)</Label>
                <Input 
                  id="default_stage_call_offset_min" 
                  name="default_stage_call_offset_min" 
                  type="number"
                  defaultValue={editingTemplate?.default_stage_call_offset_min || 15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_projection_notes">Notas Proyección</Label>
              <Textarea 
                id="default_projection_notes" 
                name="default_projection_notes" 
                defaultValue={editingTemplate?.default_projection_notes}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_sound_notes">Notas Sonido</Label>
              <Textarea 
                id="default_sound_notes" 
                name="default_sound_notes" 
                defaultValue={editingTemplate?.default_sound_notes}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_ushers_notes">Notas Ujieres</Label>
              <Textarea 
                id="default_ushers_notes" 
                name="default_ushers_notes" 
                defaultValue={editingTemplate?.default_ushers_notes}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label>Visibilidad Predeterminada</Label>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_general"
                    name="show_in_general"
                    defaultChecked={editingTemplate?.show_in_general ?? true}
                  />
                  <label htmlFor="show_in_general" className="text-sm cursor-pointer">
                    Programa General
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_projection"
                    name="show_in_projection"
                    defaultChecked={editingTemplate?.show_in_projection ?? true}
                  />
                  <label htmlFor="show_in_projection" className="text-sm cursor-pointer">
                    Vista Proyección
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_sound"
                    name="show_in_sound"
                    defaultChecked={editingTemplate?.show_in_sound ?? true}
                  />
                  <label htmlFor="show_in_sound" className="text-sm cursor-pointer">
                    Vista Sonido
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show_in_ushers"
                    name="show_in_ushers"
                    defaultChecked={editingTemplate?.show_in_ushers ?? true}
                  />
                  <label htmlFor="show_in_ushers" className="text-sm cursor-pointer">
                    Vista Ujieres
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingTemplate ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}