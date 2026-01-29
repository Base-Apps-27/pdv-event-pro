import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Utensils } from "lucide-react";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";

const HOSPITALITY_CATEGORIES = [
  "Breakfast", "Lunch", "Dinner", "Snacks", "Setup", "Cleanup", "Other"
];

export default function HospitalityTasksModal({ sessionId, isOpen, onClose, hospitalityTasks = [], queryClient: externalQueryClient }) {
  const localQueryClient = useQueryClient();
  const queryClient = externalQueryClient || localQueryClient;
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    category: "Other",
    time_hint: "",
    description: "",
    location_notes: "",
    notes: "",
  });
  const [fieldOrigins, setFieldOrigins] = useState({});

  const updateField = (field, value) => {
    setTaskForm(prev => ({ ...prev, [field]: value }));
    if (fieldOrigins[field] && fieldOrigins[field] !== 'manual') {
      setFieldOrigins(prev => ({ ...prev, [field]: 'manual' }));
    }
  };

  const createTaskMutation = useMutation({
    mutationFn: (data) => {
      if (!sessionId) throw new Error('No session ID available');
      return base44.entities.HospitalityTask.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalityTasks', sessionId] });
      setTaskForm({
        category: "Other",
        time_hint: "",
        description: "",
        location_notes: "",
        notes: "",
      });
      setEditingTask(null);
    },
    onError: (error) => {
      console.error('[HospitalityTasksModal] Create error:', error);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.HospitalityTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalityTasks', sessionId] });
      setTaskForm({
        category: "Other",
        time_hint: "",
        description: "",
        location_notes: "",
        notes: "",
      });
      setEditingTask(null);
    },
    onError: (error) => {
      console.error('[HospitalityTasksModal] Update error:', error);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.HospitalityTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalityTasks', sessionId] });
    },
    onError: (error) => {
      console.error('[HospitalityTasksModal] Delete error:', error);
    },
  });

  const handleEditTask = (task) => {
    setEditingTask(task);
    setFieldOrigins(task.field_origins || {});
    setTaskForm({
    category: task.category,
    time_hint: task.time_hint || "",
    description: task.description,
    location_notes: task.location_notes || "",
    notes: task.notes || "",
    });
    };

    const handleCancelEdit = () => {
    setEditingTask(null);
    setFieldOrigins({});
    setTaskForm({
    category: "Other",
    time_hint: "",
    description: "",
    location_notes: "",
    notes: "",
    });
    };

  const handleSubmitTask = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      session_id: sessionId,
      order: editingTask ? editingTask.order : hospitalityTasks.length + 1,
      ...taskForm,
      field_origins: fieldOrigins,
    };

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: dataToSubmit });
    } else {
      createTaskMutation.mutate(dataToSubmit);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            <div className="p-2 bg-pdv-pink/10 rounded-lg">
              <Utensils className="w-5 h-5 text-pdv-pink" />
            </div>
            Tareas de Hospitalidad
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-3">
            <h3 className="font-bold text-md">Tareas Existentes</h3>
            {hospitalityTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No hay tareas de hospitalidad para esta sesión.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {hospitalityTasks.map((task) => (
                  <div key={task.id} className="p-3 border rounded-md shadow-sm bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{task.category}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditTask(task)} className="h-7 w-7 p-0">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTaskMutation.mutate(task.id)} className="h-7 w-7 p-0 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="font-medium text-sm text-gray-800">{task.description}</p>
                    {task.time_hint && <p className="text-xs text-gray-600">Hora: {task.time_hint}</p>}
                    {task.location_notes && <p className="text-xs text-gray-600">Ubicación: {task.location_notes}</p>}
                    {task.notes && <p className="text-xs text-gray-600">Notas: {task.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-md">{editingTask ? 'Editar Tarea' : 'Añadir Nueva Tarea'}</h3>
            <form onSubmit={handleSubmitTask} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <div className="relative">
                  <Select
                    value={taskForm.category}
                    onValueChange={(value) => updateField('category', value)}
                  >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOSPITALITY_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'category')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <div className="relative">
                  <Input
                    id="description"
                    value={taskForm.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    required
                    placeholder="Ej: Preparar desayuno para staff"
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_hint">Hora/Pista de Tiempo</Label>
                <div className="relative">
                  <Input
                    id="time_hint"
                    value={taskForm.time_hint}
                    onChange={(e) => updateField('time_hint', e.target.value)}
                    placeholder="Ej: 7:30 AM, al final de la sesión"
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'time_hint')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_notes">Notas de Ubicación</Label>
                <div className="relative">
                  <Textarea
                    id="location_notes"
                    value={taskForm.location_notes}
                    onChange={(e) => updateField('location_notes', e.target.value)}
                    rows={2}
                    placeholder="Ej: Sala A comidas calientes, Sala B café"
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'location_notes')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <div className="relative">
                  <Textarea
                    id="notes"
                    value={taskForm.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={2}
                    placeholder="Cualquier nota extra para el equipo..."
                  />
                  <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'notes')} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {editingTask && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar Edición
                  </Button>
                )}
                <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingTask ? 'Guardar Cambios' : 'Añadir Tarea'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}