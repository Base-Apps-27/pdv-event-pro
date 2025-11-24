import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Calendar, MapPin, Edit, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ServiceTemplatesTab() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBlueprint, setEditingBlueprint] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: blueprints = [], isLoading } = useQuery({
    queryKey: ['service-blueprints'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Service.create({ ...data, status: 'blueprint', origin: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-blueprints']);
      setShowDialog(false);
      setEditingBlueprint(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Service.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-blueprints']);
      setShowDialog(false);
      setEditingBlueprint(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-blueprints']);
    },
  });

  const openDialog = (blueprint = null) => {
    setEditingBlueprint(blueprint);
    setFormData({
      name: blueprint?.name || '',
      day_of_week: blueprint?.day_of_week || 'Sunday',
      time: blueprint?.time || '',
      location: blueprint?.location || '',
      description: blueprint?.description || '',
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingBlueprint) {
      updateMutation.mutate({ id: editingBlueprint.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
            <h3 className="text-lg font-medium">Plantillas de Servicio (Blueprints)</h3>
            <p className="text-sm text-gray-500">Define la estructura base para tus servicios semanales</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blueprints.map((bp) => (
          <Card key={bp.id} className="hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-start">
                <span className="text-xl font-bold">{bp.name}</span>
                <FileText className="w-5 h-5 text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{bp.day_of_week} {bp.time && `- ${bp.time}`}</span>
                </div>
                {bp.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{bp.location}</span>
                  </div>
                )}
                {bp.description && <p className="italic text-xs">{bp.description}</p>}
                
                <div className="pt-4 flex gap-2">
                  <Link to={createPageUrl(`ServiceDetail?id=${bp.id}`)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Configurar Estructura
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => openDialog(bp)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500 hover:text-red-600"
                    onClick={() => {
                      if(confirm('¿Eliminar esta plantilla?')) deleteMutation.mutate(bp.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {blueprints.length === 0 && (
            <Card className="col-span-full p-12 text-center border-dashed border-2">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No hay plantillas de servicio</h3>
            <p className="text-slate-500 mb-4">Crea una plantilla para definir la estructura de tus reuniones semanales</p>
            <Button onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Plantilla
            </Button>
            </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlueprint ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Plantilla</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Domingo AM Estándar"
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Día Recurrente</Label>
                <Select 
                  value={formData.day_of_week} 
                  onValueChange={v => setFormData({...formData, day_of_week: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hora Base</Label>
                <Input 
                  type="time"
                  value={formData.time} 
                  onChange={e => setFormData({...formData, time: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ubicación por Defecto</Label>
              <Input 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}