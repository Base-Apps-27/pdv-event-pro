/**
 * BreakoutRoomsEditor.jsx
 * Phase 3B Extraction: Breakout rooms editor from SegmentFormTwoColumn
 * ~250 lines extracted — handles adding, removing, and editing breakout room configurations.
 * 
 * Props:
 *   breakoutRooms - array of room objects
 *   setBreakoutRooms - state setter
 *   rooms - array of Room entities (for room selection dropdown)
 *   language - 'es' | 'en'
 */
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export default function BreakoutRoomsEditor({ breakoutRooms, setBreakoutRooms, rooms, language }) {
  const addRoom = () => {
    setBreakoutRooms([...breakoutRooms, {
      room_id: "",
      hosts: "",
      speakers: "",
      topic: "",
      general_notes: "",
      other_notes: "",
      requires_translation: false,
      translation_mode: "InPerson",
      translator_name: ""
    }]);
  };

  const removeRoom = (index) => {
    setBreakoutRooms(breakoutRooms.filter((_, i) => i !== index));
  };

  const updateRoom = (index, field, value) => {
    const updated = [...breakoutRooms];
    updated[index] = { ...updated[index], [field]: value };
    setBreakoutRooms(updated);
  };

  return (
    <div className="space-y-3 bg-amber-50 p-4 rounded border border-amber-200">
      <div className="flex items-center justify-between mb-2">
        <Label className="font-semibold">Salas Paralelas</Label>
        <Button type="button" size="sm" onClick={addRoom} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          Añadir Sala
        </Button>
      </div>

      {breakoutRooms.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-4">
          No hay salas definidas. Añade al menos una sala para el breakout.
        </p>
      )}

      {breakoutRooms.map((room, index) => (
        <Card key={index} className="p-3 bg-white border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">Sala {index + 1}</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRoom(index)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Sala</Label>
              <Select value={room.room_id} onValueChange={(value) => updateRoom(index, 'room_id', value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tema/Tópico</Label>
              <Input value={room.topic} onChange={(e) => updateRoom(index, 'topic', e.target.value)} placeholder="Nombre del taller o tópico" className="h-8 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Anfitrión(es) / Moderador(es)</Label>
              <Input value={room.hosts} onChange={(e) => updateRoom(index, 'hosts', e.target.value)} placeholder="Nombres de los anfitriones" className="h-8 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Presentador(es) / Panelistas</Label>
              <Input value={room.speakers} onChange={(e) => updateRoom(index, 'speakers', e.target.value)} placeholder="Nombres de los presentadores" className="h-8 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas de Producción</Label>
              <Input value={room.general_notes} onChange={(e) => updateRoom(index, 'general_notes', e.target.value)} placeholder="Instrucciones generales para producción" className="h-8 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Otras Notas</Label>
              <Input value={room.other_notes} onChange={(e) => updateRoom(index, 'other_notes', e.target.value)} placeholder="Instrucciones adicionales" className="h-8 text-sm" />
            </div>

            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`requires_translation_${index}`}
                  checked={room.requires_translation}
                  onCheckedChange={(checked) => updateRoom(index, 'requires_translation', checked)}
                />
                <label htmlFor={`requires_translation_${index}`} className="text-xs font-semibold cursor-pointer">
                  Requiere Traducción
                </label>
              </div>

              {room.requires_translation && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Modo</Label>
                    <Select value={room.translation_mode} onValueChange={(value) => updateRoom(index, 'translation_mode', value)}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="InPerson">En Persona</SelectItem>
                        <SelectItem value="RemoteBooth">Cabina Remota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      {room.translation_mode === "InPerson" ? "Traductor (en persona)" : "Traductor (cabina)"}
                    </Label>
                    <Input value={room.translator_name} onChange={(e) => updateRoom(index, 'translator_name', e.target.value)} placeholder="Nombre" className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}