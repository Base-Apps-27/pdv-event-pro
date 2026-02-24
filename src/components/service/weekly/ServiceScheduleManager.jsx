/**
 * ServiceScheduleManager — Admin UI for managing recurring service schedules.
 *
 * Phase 1 Entity Lift: Replaces hardcoded TIME_SLOTS in weeklySessionSync.
 * Allows admins to define what days have services, how many sessions per day,
 * and what times those sessions start.
 *
 * Decision: "ServiceSchedule entity replaces hardcoded TIME_SLOTS" (2026-02-18)
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Plus, Trash2, Clock, Calendar, GripVertical } from "lucide-react";
import { toast } from "sonner";
import BlueprintManager from "./BlueprintManager";
// Universal log (2026-02-19): ServiceSchedule mutations now logged
import { logCreate, logUpdate, logDelete } from "@/components/utils/editActionLogger";
import { useCurrentUser } from "@/components/utils/useCurrentUser";

const DAYS_ES = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

const SESSION_COLORS = ["green", "blue", "red", "purple", "orange", "yellow", "pink"];

export default function ServiceScheduleManager() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  // Double-confirmation state for destructive delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['serviceSchedules'],
    queryFn: () => base44.entities.ServiceSchedule.list('day_of_week'),
  });

  const { data: blueprints = [] } = useQuery({
    queryKey: ['serviceBlueprintsList'],
    queryFn: () => base44.entities.Service.filter({ status: 'blueprint' }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        const { id, created_date, updated_date, created_by, ...updateData } = data;
        return base44.entities.ServiceSchedule.update(id, updateData).then(r => ({ result: r, prev: data, isUpdate: true }));
      }
      return base44.entities.ServiceSchedule.create(data).then(r => ({ result: r, isUpdate: false }));
    },
    onSuccess: ({ result, prev, isUpdate }) => {
      queryClient.invalidateQueries(['serviceSchedules']);
      setShowDialog(false);
      setEditingSchedule(null);
      toast.success("Horario guardado");
      if (isUpdate) logUpdate('ServiceSchedule', result.id, prev, result, null, user);
      else logCreate('ServiceSchedule', result, null, user);
    },
    onError: (err) => toast.error("Error: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.ServiceSchedule.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['serviceSchedules']);
      toast.success("Horario eliminado");
      if (variables.schedule) logDelete('ServiceSchedule', variables.schedule, null, user);
    },
  });

  const openNew = () => {
    setEditingSchedule({
      name: "",
      day_of_week: "Sunday",
      is_active: true,
      sessions: [{ name: "9:30am", planned_start_time: "09:30", order: 1, color: "green" }],
    });
    setShowDialog(true);
  };

  const openEdit = (schedule) => {
    setEditingSchedule({ ...schedule });
    setShowDialog(true);
  };

  const addSession = () => {
    if (!editingSchedule) return;
    const nextOrder = (editingSchedule.sessions?.length || 0) + 1;
    const color = SESSION_COLORS[(nextOrder - 1) % SESSION_COLORS.length];
    setEditingSchedule(prev => ({
      ...prev,
      sessions: [...(prev.sessions || []), { name: "", planned_start_time: "", order: nextOrder, color }]
    }));
  };

  const updateSession = (idx, field, value) => {
    setEditingSchedule(prev => {
      const sessions = [...(prev.sessions || [])];
      sessions[idx] = { ...sessions[idx], [field]: value };
      return { ...prev, sessions };
    });
  };

  const removeSession = (idx) => {
    setEditingSchedule(prev => ({
      ...prev,
      sessions: (prev.sessions || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }))
    }));
  };

  const handleSave = () => {
    if (!editingSchedule?.name || !editingSchedule?.day_of_week) {
      toast.error("Nombre y día son requeridos");
      return;
    }
    if (!editingSchedule.sessions?.length) {
      toast.error("Debe haber al menos una sesión");
      return;
    }
    // Validate all sessions have name + time
    for (const s of editingSchedule.sessions) {
      if (!s.name || !s.planned_start_time) {
        toast.error("Todas las sesiones necesitan nombre y hora");
        return;
      }
    }
    saveMutation.mutate(editingSchedule);
  };

  // Group schedules by day for display
  const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const sortedSchedules = [...schedules].sort((a, b) =>
    DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 uppercase">Horarios Recurrentes</h2>
          <p className="text-sm text-gray-500">Define qué días hay servicios y cuántas sesiones tiene cada día</p>
        </div>
        <Button onClick={openNew} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} className="hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Horario
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-center py-8">Cargando...</p>
      ) : sortedSchedules.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No hay horarios configurados. El sistema usará los horarios predeterminados del servidor.</p>
          <Button onClick={openNew} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Configurar Primer Horario
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedSchedules.map(schedule => (
            <Card
              key={schedule.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${!schedule.is_active ? 'opacity-50' : ''}`}
              onClick={() => openEdit(schedule)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{schedule.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {DAYS_ES[schedule.day_of_week] || schedule.day_of_week}
                    </Badge>
                  </div>
                  {!schedule.is_active && (
                    <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(schedule.sessions || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-sm">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="font-medium text-gray-700">{s.name}</span>
                      <span className="text-gray-400 text-xs">({s.planned_start_time})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Blueprint Manager */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <BlueprintManager />
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditingSchedule(null); } }}>
        <DialogContent className="max-w-lg bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule?.id ? 'Editar Horario' : 'Nuevo Horario'}</DialogTitle>
          </DialogHeader>

          {editingSchedule && (
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-1">
                <Label>Nombre del Horario *</Label>
                <Input
                  value={editingSchedule.name}
                  onChange={(e) => setEditingSchedule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Servicio Dominical"
                />
              </div>

              {/* Day */}
              <div className="space-y-1">
                <Label>Día de la Semana *</Label>
                <Select
                  value={editingSchedule.day_of_week}
                  onValueChange={(val) => setEditingSchedule(prev => ({ ...prev, day_of_week: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_ORDER.map(day => (
                      <SelectItem key={day} value={day}>{DAYS_ES[day]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Blueprint */}
              <div className="space-y-1">
                <Label>Blueprint Base (Plantilla)</Label>
                <Select
                  value={editingSchedule.blueprint_id || "default"}
                  onValueChange={(val) => setEditingSchedule(prev => ({ ...prev, blueprint_id: val === "default" ? null : val }))}
                >
                  <SelectTrigger><SelectValue placeholder="Usar blueprint principal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Automático (Principal/Fallback)</SelectItem>
                    {blueprints.map(bp => (
                      <SelectItem key={bp.id} value={bp.id}>{bp.name || 'Sin nombre'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Los servicios generados de este horario clonarán esta plantilla.</p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingSchedule.is_active}
                  onCheckedChange={(val) => setEditingSchedule(prev => ({ ...prev, is_active: val }))}
                />
                <Label>Activo</Label>
              </div>

              {/* Sessions */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Sesiones</Label>
                  <Button size="sm" variant="outline" onClick={addSession}>
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar Sesión
                  </Button>
                </div>

                {(editingSchedule.sessions || []).map((session, idx) => (
                  <Card key={idx} className="bg-gray-50 border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        <span className="text-xs text-gray-400 font-mono w-5">#{session.order}</span>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={session.name}
                            onChange={(e) => updateSession(idx, 'name', e.target.value)}
                            placeholder="9:30am"
                            className="text-sm h-8"
                          />
                          <Input
                            type="time"
                            value={session.planned_start_time}
                            onChange={(e) => updateSession(idx, 'planned_start_time', e.target.value)}
                            className="text-sm h-8"
                          />
                        </div>
                        <Select
                          value={session.color || "green"}
                          onValueChange={(val) => updateSession(idx, 'color', val)}
                        >
                          <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SESSION_COLORS.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(editingSchedule.sessions || []).length > 1 && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeSession(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-2">
                {editingSchedule.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setDeleteConfirmText(""); setShowDeleteConfirm(true); }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => { setShowDialog(false); setEditingSchedule(null); }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} className="hover:opacity-90">
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — requires typing the schedule name */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open) { setShowDeleteConfirm(false); setDeleteConfirmText(""); } }}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-700">
              Esta acción eliminará el horario <strong>"{editingSchedule?.name}"</strong> de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">
                Escribe <span className="font-mono font-bold text-gray-900">ELIMINAR</span> para confirmar:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== "ELIMINAR" || deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate({ id: editingSchedule.id, schedule: editingSchedule }, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                      setShowDialog(false);
                      setEditingSchedule(null);
                    }
                  });
                }}
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar Definitivamente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}