import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, Edit2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ScheduleReview({ data, onConfirm, onCancel }) {
  const [eventData, setEventData] = useState(data.event || { name: "", date: "" });
  const [sessionData, setSessionData] = useState(data.session || { name: "", description: "" });
  const [segments, setSegments] = useState(data.segments || []);

  const handleSegmentChange = (index, field, value) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setSegments(newSegments);
  };

  const handleDeleteSegment = (index) => {
    setSegments(segments.filter((_, i) => i !== index));
  };

  const handleAddSegment = () => {
    setSegments([...segments, { 
      time: "", 
      title: "New Segment", 
      type: "Alabanza", 
      presenter: "",
      notes: "" 
    }]);
  };

  const handleConfirm = () => {
    onConfirm({
      event: eventData,
      session: sessionData,
      segments: segments
    });
  };

  const segmentTypes = [
    "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video", 
    "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", 
    "Especial", "Cierre"
  ];

  return (
    <div className="my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2 border-pdv-teal/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-pdv-teal">
              <Edit2 className="w-5 h-5" />
              Revisar Datos Extraídos
            </CardTitle>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Verificación Requerida
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            La IA ha extraído la siguiente información. Por favor verifica y corrige si es necesario antes de crear.
          </p>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-gray-500">Evento</Label>
              <Input 
                value={eventData.name} 
                onChange={(e) => setEventData({...eventData, name: e.target.value})}
                placeholder="Nombre del Evento"
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-gray-500">Fecha</Label>
              <Input 
                value={eventData.date} 
                onChange={(e) => setEventData({...eventData, date: e.target.value})}
                placeholder="YYYY-MM-DD" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-gray-500">Sesión</Label>
              <Input 
                value={sessionData.name} 
                onChange={(e) => setSessionData({...sessionData, name: e.target.value})}
                placeholder="Nombre de la Sesión"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-gray-500">Descripción / Notas</Label>
              <Input 
                value={sessionData.description} 
                onChange={(e) => setSessionData({...sessionData, description: e.target.value})}
                placeholder="Notas de la sesión"
              />
            </div>
          </div>

          {/* Segments Table */}
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-gray-600">Segmentos ({segments.length})</span>
              <Button size="sm" variant="ghost" onClick={handleAddSegment} className="h-8 text-pdv-teal">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">Hora</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment, idx) => (
                  <TableRow key={idx} className="group hover:bg-slate-50">
                    <TableCell className="p-2">
                      <Input 
                        value={segment.time} 
                        onChange={(e) => handleSegmentChange(idx, 'time', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="00:00"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Select 
                        value={segmentTypes.includes(segment.type) ? segment.type : "Alabanza"} 
                        onValueChange={(val) => handleSegmentChange(idx, 'type', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {segmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-2">
                      <Input 
                        value={segment.title} 
                        onChange={(e) => handleSegmentChange(idx, 'title', e.target.value)}
                        className="h-8 text-xs font-medium"
                        placeholder="Título"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input 
                        value={segment.presenter} 
                        onChange={(e) => handleSegmentChange(idx, 'presenter', e.target.value)}
                        className="h-8 text-xs text-gray-500"
                        placeholder="Nombre"
                      />
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDeleteSegment(idx)}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
          <Button variant="outline" onClick={onCancel}>
            Cancelar / Chatear
          </Button>
          <Button onClick={handleConfirm} className="bg-pdv-teal hover:bg-pdv-teal/90 text-white shadow-sm gap-2">
            <Check className="w-4 h-4" />
            Confirmar y Crear
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}