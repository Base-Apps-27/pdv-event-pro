import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Search, Plus, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SUGGESTION_TYPES = {
  presenter: "Presentador",
  translator: "Traductor",
  preacher: "Predicador",
  leader: "Líder",
  worshipLeader: "Líder de Alabanza",
  ministryLeader: "Líder de Ministración",
  songTitle: "Título de Canción",
  messageTitle: "Título de Mensaje"
};

export default function SuggestionsManager() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState("presenter");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formValue, setFormValue] = useState("");

  // Fetch suggestions
  const { data: allSuggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => base44.entities.SuggestionItem.list('-use_count'),
  });

  // Filter suggestions
  const filteredSuggestions = allSuggestions
    .filter(s => s.type === selectedType)
    .filter(s => !searchTerm || s.value.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (b.use_count || 0) - (a.use_count || 0));

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SuggestionItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['suggestions']);
      setShowDialog(false);
      setFormValue("");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SuggestionItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['suggestions']);
      setShowDialog(false);
      setEditingItem(null);
      setFormValue("");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SuggestionItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['suggestions']);
    }
  });

  const handleSave = () => {
    if (!formValue.trim()) return;

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: { ...editingItem, value: formValue.trim() }
      });
    } else {
      createMutation.mutate({
        type: selectedType,
        value: formValue.trim(),
        use_count: 0
      });
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormValue(item.value);
    setShowDialog(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormValue("");
    setShowDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-semibold mb-3 block">Tipo de Sugerencia</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SUGGESTION_TYPES).map(([key, label]) => (
              <Button
                key={key}
                variant={selectedType === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(key)}
                className={selectedType === key ? "bg-pdv-teal text-white" : ""}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search and Add */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <Input
              placeholder="Buscar sugerencias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button onClick={openCreate} className="bg-pdv-teal text-white flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Añadir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{SUGGESTION_TYPES[selectedType]} ({filteredSuggestions.length})</span>
            <Badge variant="outline" className="font-normal">
              Ordenado por uso más frecuente
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando sugerencias...</div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No se encontraron sugerencias." : "No hay sugerencias de este tipo aún."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSuggestions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium">{item.value}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.use_count || 0} usos
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${item.value}"?`)) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Sugerencia" : "Nueva Sugerencia"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Input value={SUGGESTION_TYPES[selectedType]} disabled className="mt-1" />
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Ingrese el valor..."
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-pdv-teal text-white">
                <Check className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}