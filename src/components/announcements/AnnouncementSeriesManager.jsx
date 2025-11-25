import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Save, X, GripVertical, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";

export default function AnnouncementSeriesManager({ isOpen, onClose, initialSeriesId, onSelect }) {
  const [selectedSeriesId, setSelectedSeriesId] = useState(initialSeriesId || "new");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    fixed_announcement_ids: [],
    include_dynamic_events: true,
    max_dynamic_events: 3,
    event_target_filter: [],
    sort_strategy: "FixedFirst"
  });
  
  const queryClient = useQueryClient();

  const { data: seriesList = [], isLoading: isLoadingSeries } = useQuery({
    queryKey: ['announcementSeries'],
    queryFn: () => base44.entities.AnnouncementSeries.list(),
  });

  const { data: availableAnnouncements = [] } = useQuery({
    queryKey: ['announcementItems'],
    queryFn: () => base44.entities.AnnouncementItem.filter({ is_active: true }),
  });

  // Fetch selected series details if editing
  const { data: selectedSeries } = useQuery({
    queryKey: ['announcementSeries', selectedSeriesId],
    queryFn: () => base44.entities.AnnouncementSeries.get(selectedSeriesId),
    enabled: !!selectedSeriesId && selectedSeriesId !== "new",
  });

  useEffect(() => {
    if (selectedSeriesId === "new") {
      setFormData({
        name: "",
        description: "",
        fixed_announcement_ids: [],
        include_dynamic_events: true,
        max_dynamic_events: 3,
        event_target_filter: [],
        sort_strategy: "FixedFirst"
      });
    } else if (selectedSeries) {
      setFormData({
        name: selectedSeries.name,
        description: selectedSeries.description || "",
        fixed_announcement_ids: selectedSeries.fixed_announcement_ids || [],
        include_dynamic_events: selectedSeries.include_dynamic_events ?? true,
        max_dynamic_events: selectedSeries.max_dynamic_events || 3,
        event_target_filter: selectedSeries.event_target_filter || [],
        sort_strategy: selectedSeries.sort_strategy || "FixedFirst"
      });
    }
  }, [selectedSeriesId, selectedSeries]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnouncementSeries.create(data),
    onSuccess: (newSeries) => {
      queryClient.invalidateQueries(['announcementSeries']);
      if (onSelect) onSelect(newSeries.id);
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({id, data}) => base44.entities.AnnouncementSeries.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementSeries']);
      if (onSelect) onSelect(selectedSeriesId);
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedSeriesId === "new") {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: selectedSeriesId, data: formData });
    }
  };

  const toggleFixedAnnouncement = (id) => {
    setFormData(prev => {
      const current = prev.fixed_announcement_ids || [];
      if (current.includes(id)) {
        return { ...prev, fixed_announcement_ids: current.filter(i => i !== id) };
      } else {
        return { ...prev, fixed_announcement_ids: [...current, id] };
      }
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(formData.fixed_announcement_ids);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFormData(prev => ({ ...prev, fixed_announcement_ids: items }));
  };

  // Available fixed announcements that are NOT yet selected
  const unselectedAnnouncements = availableAnnouncements.filter(a => !formData.fixed_announcement_ids.includes(a.id));
  
  // Get full objects for selected IDs to display
  const selectedAnnouncements = formData.fixed_announcement_ids
    .map(id => availableAnnouncements.find(a => a.id === id))
    .filter(Boolean);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Series de Anuncios</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar - Series List */}
          <div className="space-y-4 border-r pr-4">
            <div className="flex justify-between items-center">
                <Label>Mis Series</Label>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSeriesId("new")} disabled={selectedSeriesId === "new"}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
            <div className="space-y-2">
                <div 
                    className={`p-2 rounded cursor-pointer text-sm ${selectedSeriesId === "new" ? "bg-pdv-teal text-white font-bold" : "hover:bg-gray-100"}`}
                    onClick={() => setSelectedSeriesId("new")}
                >
                    + Nueva Serie
                </div>
                {seriesList.map(series => (
                    <div 
                        key={series.id}
                        className={`p-2 rounded cursor-pointer text-sm ${selectedSeriesId === series.id ? "bg-slate-200 font-bold" : "hover:bg-gray-100"}`}
                        onClick={() => setSelectedSeriesId(series.id)}
                    >
                        {series.name}
                    </div>
                ))}
            </div>
          </div>

          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            <form id="series-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label>Nombre de la Serie</Label>
                    <Input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="Ej. Anuncios Dominicales Standard" 
                        required 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Estrategia de Orden</Label>
                        <Select 
                            value={formData.sort_strategy} 
                            onValueChange={v => setFormData({...formData, sort_strategy: v})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FixedFirst">Fijos primero, luego Eventos</SelectItem>
                                <SelectItem value="DynamicFirst">Eventos primero, luego Fijos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-8">
                         <Checkbox 
                            id="include_events"
                            checked={formData.include_dynamic_events}
                            onCheckedChange={c => setFormData({...formData, include_dynamic_events: c})}
                        />
                        <Label htmlFor="include_events">Incluir Eventos Próximos (Dinámicos)</Label>
                    </div>
                </div>

                {formData.include_dynamic_events && (
                    <div className="bg-slate-50 p-4 rounded border space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-slate-700 font-bold">Configuración de Eventos</Label>
                            <Badge variant="outline">Dinámico</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Máximo de Eventos</Label>
                                <Input 
                                    type="number" 
                                    min="1" 
                                    value={formData.max_dynamic_events}
                                    onChange={e => setFormData({...formData, max_dynamic_events: parseInt(e.target.value)})}
                                />
                             </div>
                             <div className="space-y-2">
                                <Label>Filtro por Tags (Opcional)</Label>
                                <Input 
                                    placeholder="Ej. Domingo, General (separados por coma)"
                                    value={formData.event_target_filter?.join(", ")}
                                    onChange={e => setFormData({...formData, event_target_filter: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                                />
                                <p className="text-xs text-gray-500">Dejar vacío para incluir todos los eventos promocionados</p>
                             </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <Label>Anuncios Fijos (Arrastrar para ordenar)</Label>
                    <div className="border rounded-lg p-4 min-h-[200px] space-y-4">
                        {/* Selected List (Sortable) */}
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="selected-announcements">
                                {(provided) => (
                                    <div 
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-2"
                                    >
                                        {selectedAnnouncements.map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm group"
                                                    >
                                                        <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab hover:text-gray-600">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="font-semibold">{item.title}</span>
                                                            <span className="text-xs text-gray-500 ml-2 truncate">{item.category}</span>
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => toggleFixedAnnouncement(item.id)}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {selectedAnnouncements.length === 0 && (
                                            <div className="text-center text-gray-400 py-4 text-sm border-2 border-dashed rounded">
                                                No hay anuncios fijos seleccionados. Selecciona de la lista abajo.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>

                        <div className="pt-4 border-t">
                            <Label className="text-xs text-gray-500 mb-2 block">Disponibles para añadir:</Label>
                            <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto">
                                {unselectedAnnouncements.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors">
                                        <span>{item.title}</span>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 text-green-600"
                                            onClick={() => toggleFixedAnnouncement(item.id)}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                {unselectedAnnouncements.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No hay más anuncios disponibles.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="series-form" disabled={createMutation.isLoading || updateMutation.isLoading}>
                {(createMutation.isLoading || updateMutation.isLoading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Serie
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}