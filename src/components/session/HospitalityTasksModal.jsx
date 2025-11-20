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

const HOSPITALITY_CATEGORIES = [
  "Breakfast", "Lunch", "Dinner", "Snacks", "Setup", "Cleanup", "Other"
];

export default function HospitalityTasksModal({ sessionId, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    category: "Other",
    time_hint: "",
    description: "",
    location_notes: "",
    notes: "",
  });

  const { data: hospitalityTasks = [], isLoading } = useQuery({
    queryKey: ['hospitalityTasks', sessionId],
    queryFn: () => base44.entities.HospitalityTask.filter({ session_id: sessionId }, 'order'),
    enabled: isOpen && !!sessionId,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.HospitalityTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['hospitalityTasks', sessionId]);
      setTaskForm({
        category: "Other",
        time_hint: "",
        description: "",
        location_notes: "",
        notes: "",
      });
      setEditingTask(null);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.HospitalityTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['hospitalityTasks', sessionId]);
      setTaskForm({
        category: "Other",
        time_hint: "",
        description: "",
        location_notes: "",
        notes: "",
      });
      setEditingTask(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.HospitalityTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['hospitalityTasks', sessionId]);
    },
  });

  const handleEditTask = (task) => {
    setEditingTask(task);
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
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Tareas de Hospitalidad
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-3">
            <h3 className="font-bold text-md">Tareas Existentes</h3>
            {isLoading ? (
              <p>Cargando tareas...</p>
            ) : hospitalityTasks.length === 0 ? (
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
                <Select
                  value={taskForm.category}
                  onValueChange={(value) => setTaskForm({ ...taskForm, category: value })}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <Input
                  id="description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  required
                  placeholder="Ej: Preparar desayuno para staff"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_hint">Hora/Pista de Tiempo</Label>
                <Input
                  id="time_hint"
                  value={taskForm.time_hint}
                  onChange={(e) => setTaskForm({ ...taskForm, time_hint: e.target.value })}
                  placeholder="Ej: 7:30 AM, al final de la sesión"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_notes">Notas de Ubicación</Label>
                <Textarea
                  id="location_notes"
                  value={taskForm.location_notes}
                  onChange={(e) => setTaskForm({ ...taskForm, location_notes: e.target.value })}
                  rows={2}
                  placeholder="Ej: Sala A comidas calientes, Sala B café"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Cualquier nota extra para el equipo..."
                />
              </div>

              <div className="flex justify-end gap-2">
                {editingTask && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar Edición
                  </Button>
                )}
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
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