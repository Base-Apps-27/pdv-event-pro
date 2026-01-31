import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Utensils, Clock, MapPin, FileText } from "lucide-react";

/**
 * HospitalityTasksViewModal - Read-only modal for Live View
 * Displays hospitality tasks for a session without edit capabilities.
 * For editing, use HospitalityTasksModal in the admin/edit surfaces.
 */
export default function HospitalityTasksViewModal({ sessionId, sessionName, isOpen, onClose }) {
  const { data: hospitalityTasks = [], isLoading } = useQuery({
    queryKey: ['hospitalityTasksView', sessionId],
    queryFn: () => base44.entities.HospitalityTask.filter({ session_id: sessionId }, 'order'),
    enabled: isOpen && !!sessionId,
  });

  const categoryColors = {
    Breakfast: "bg-amber-100 text-amber-800",
    Lunch: "bg-orange-100 text-orange-800",
    Dinner: "bg-red-100 text-red-800",
    Snacks: "bg-yellow-100 text-yellow-800",
    Setup: "bg-blue-100 text-blue-800",
    Cleanup: "bg-green-100 text-green-800",
    Other: "bg-gray-100 text-gray-800",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Utensils className="w-5 h-5 text-pink-600" />
            </div>
            Hospitalidad
          </DialogTitle>
          {sessionName && (
            <p className="text-sm text-gray-600 mt-1">{sessionName}</p>
          )}
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando tareas...</div>
          ) : hospitalityTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay tareas de hospitalidad para esta sesión.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {hospitalityTasks.map((task) => (
                <div key={task.id} className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`text-xs ${categoryColors[task.category] || categoryColors.Other}`}>
                      {task.category}
                    </Badge>
                    {task.time_hint && (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" />
                        {task.time_hint}
                      </span>
                    )}
                  </div>
                  
                  <p className="font-semibold text-gray-900 mb-2">{task.description}</p>
                  
                  {task.location_notes && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 mb-1">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{task.location_notes}</span>
                    </div>
                  )}
                  
                  {task.notes && (
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{task.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}