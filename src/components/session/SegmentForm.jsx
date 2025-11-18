import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, X, FileText, Plus, Trash2 } from "lucide-react";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "Break", "TechOnly", "Oración", 
  "Especial", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Artes"
];

const COLOR_CODES = [
  { value: "worship", label: "Adoración" },
  { value: "preach", label: "Predicación" },
  { value: "break", label: "Descanso" },
  { value: "tech", label: "Técnico" },
  { value: "special", label: "Especial" },
  { value: "default", label: "Predeterminado" }
];

export default function SegmentForm({ session, segment, templates, onClose, sessionId }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [formData, setFormData] = useState({
    title: segment?.title || "",
    segment_type: segment?.segment_type || "Plenaria",
    presenter: segment?.presenter || "",
    description_details: segment?.description_details || "",
    start_time: segment?.start_time || "",
    duration_min: segment?.duration_min || 30,
    stage_call_offset_min: segment?.stage_call_offset_min || session?.default_stage_call_offset_min || 15,
    projection_notes: segment?.projection_notes || "",
    sound_notes: segment?.sound_notes || "",
    ushers_notes: segment?.ushers_notes || "",
    translation_notes: segment?.translation_notes || "",
    other_notes: segment?.other_notes || "",
    show_in_general: segment?.show_in_general ?? true,
    show_in_projection: segment?.show_in_projection ?? true,
    show_in_sound: segment?.show_in_sound ?? true,
    show_in_ushers: segment?.show_in_ushers ?? true,
    color_code: segment?.color_code || "default",
    order: segment?.order || 1,
    message_title: segment?.message_title || "",
    scripture_references: segment?.scripture_references || "",
    number_of_songs: segment?.number_of_songs || 3,
    song_1_title: segment?.song_1_title || "",
    song_1_lead: segment?.song_1_lead || "",
    song_2_title: segment?.song_2_title || "",
    song_2_lead: segment?.song_2_lead || "",
    song_3_title: segment?.song_3_title || "",
    song_3_lead: segment?.song_3_lead || "",
    song_4_title: segment?.song_4_title || "",
    song_4_lead: segment?.song_4_lead || "",
    song_5_title: segment?.song_5_title || "",
    song_5_lead: segment?.song_5_lead || "",
    song_6_title: segment?.song_6_title || "",
    song_6_lead: segment?.song_6_lead || "",
    requires_translation: segment?.requires_translation || false,
    translator_name: segment?.translator_name || "",
    major_break: segment?.major_break || false,
  });

  const calculateTimes = (startTime, durationMin, offsetMin) => {
    if (!startTime || !durationMin) return { end_time: "", stage_call_time: "" };
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMin;
    const stageCallMinutes = startMinutes - offsetMin;

    const formatTime = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      end_time: formatTime(endMinutes),
      stage_call_time: formatTime(stageCallMinutes)
    };
  };

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.default_title || prev.title,
          segment_type: template.segment_type,
          duration_min: template.default_duration_min || prev.duration_min,
          stage_call_offset_min: template.default_stage_call_offset_min || prev.stage_call_offset_min,
          projection_notes: template.default_projection_notes || "",
          sound_notes: template.default_sound_notes || "",
          ushers_notes: template.default_ushers_notes || "",
          color_code: template.default_color_code || "default",
          show_in_general: template.show_in_general ?? true,
          show_in_projection: template.show_in_projection ?? true,
          show_in_sound: template.show_in_sound ?? true,
          show_in_ushers: template.show_in_ushers ?? true,
        }));
      }
    }
  }, [selectedTemplate, templates]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Segment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments', sessionId]);
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const times = calculateTimes(
      formData.start_time,
      formData.duration_min,
      formData.stage_call_offset_min
    );

    const data = {
      session_id: sessionId,
      ...formData,
      ...times,
    };

    if (segment) {
      updateMutation.mutate({ id: segment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isWorshipType = formData.segment_type === "Alabanza";
  const isPlenariaType = formData.segment_type === "Plenaria";
  const isBreakType = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
  const isTechOnly = formData.segment_type === "TechOnly";
  const isVideoType = formData.segment_type === "Video";
  const needsPresenter = !isBreakType && !isTechOnly;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!segment && templates.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="template" className="text-blue-900 font-medium">Usar Plantilla</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="mt-2 bg-white">
                  <SelectValue placeholder="Seleccionar plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input 
            id="title" 
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required 
            placeholder="PLENARIA #1: Conquistando"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="segment_type">Tipo de Segmento *</Label>
          <Select 
            value={formData.segment_type}
            onValueChange={(value) => setFormData({...formData, segment_type: value})}
          >
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
      </div>

      {needsPresenter && (
        <div className="space-y-2">
          <Label htmlFor="presenter">
            {isWorshipType ? "Líder de Alabanza" : isPlenariaType ? "Predicador" : "Presentador"}
          </Label>
          <Input 
            id="presenter" 
            value={formData.presenter}
            onChange={(e) => setFormData({...formData, presenter: e.target.value})}
            placeholder="Nombre de la persona"
          />
        </div>
      )}

      {!isTechOnly && (
        <div className="space-y-2">
          <Label htmlFor="description_details">Descripción</Label>
          <Textarea 
            id="description_details" 
            value={formData.description_details}
            onChange={(e) => setFormData({...formData, description_details: e.target.value})}
            rows={2}
            placeholder="Detalles adicionales"
          />
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_time">Hora Inicio</Label>
          <Input 
            id="start_time" 
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({...formData, start_time: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration_min">Duración (min)</Label>
          <Input 
            id="duration_min" 
            type="number"
            value={formData.duration_min}
            onChange={(e) => setFormData({...formData, duration_min: parseInt(e.target.value)})}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stage_call_offset_min">Llegada de Equipos (min antes)</Label>
          <Input 
            id="stage_call_offset_min" 
            type="number"
            value={formData.stage_call_offset_min}
            onChange={(e) => setFormData({...formData, stage_call_offset_min: parseInt(e.target.value)})}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="color_code">Color</Label>
          <Select 
            value={formData.color_code}
            onValueChange={(value) => setFormData({...formData, color_code: value})}
          >
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

      {isPlenariaType && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Detalles de Plenaria</h3>
            
            <div className="space-y-2">
              <Label htmlFor="message_title">Título del Mensaje</Label>
              <Input 
                id="message_title" 
                value={formData.message_title}
                onChange={(e) => setFormData({...formData, message_title: e.target.value})}
                placeholder="Conquistando nuevas alturas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scripture_references">Referencias Bíblicas</Label>
              <Input 
                id="scripture_references" 
                value={formData.scripture_references}
                onChange={(e) => setFormData({...formData, scripture_references: e.target.value})}
                placeholder="Juan 3:16, Romanos 8:28"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="requires_translation"
                checked={formData.requires_translation}
                onCheckedChange={(checked) => setFormData({...formData, requires_translation: checked})}
              />
              <label htmlFor="requires_translation" className="text-sm cursor-pointer">
                Requiere traducción
              </label>
            </div>

            {formData.requires_translation && (
              <div className="space-y-2">
                <Label htmlFor="translator_name">Traductor</Label>
                <Input 
                  id="translator_name" 
                  value={formData.translator_name}
                  onChange={(e) => setFormData({...formData, translator_name: e.target.value})}
                  placeholder="Nombre del traductor"
                />
              </div>
            )}
          </div>
        </>
      )}

      {isWorshipType && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Canciones del Set</h3>
            
            <div className="space-y-2">
              <Label htmlFor="number_of_songs">Número de Canciones (1-6)</Label>
              <Input 
                id="number_of_songs" 
                type="number"
                min="1"
                max="6"
                value={formData.number_of_songs}
                onChange={(e) => setFormData({...formData, number_of_songs: parseInt(e.target.value) || 1})}
              />
            </div>

            {[...Array(formData.number_of_songs || 0)].map((_, idx) => {
              const songNum = idx + 1;
              return (
                <Card key={songNum} className="p-4 bg-gray-50">
                  <h4 className="font-medium text-sm text-gray-700 mb-3">Canción {songNum}</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`song_${songNum}_title`}>Título</Label>
                      <Input 
                        id={`song_${songNum}_title`}
                        value={formData[`song_${songNum}_title`]}
                        onChange={(e) => setFormData({...formData, [`song_${songNum}_title`]: e.target.value})}
                        placeholder="Nombre de la canción"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`song_${songNum}_lead`}>Vocalista Principal</Label>
                      <Input 
                        id={`song_${songNum}_lead`}
                        value={formData[`song_${songNum}_lead`]}
                        onChange={(e) => setFormData({...formData, [`song_${songNum}_lead`]: e.target.value})}
                        placeholder="Nombre del vocalista"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {isBreakType && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="major_break"
                checked={formData.major_break}
                onCheckedChange={(checked) => setFormData({...formData, major_break: checked})}
              />
              <label htmlFor="major_break" className="text-sm cursor-pointer">
                Receso Mayor (Almuerzo/Cena)
              </label>
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Notas para Equipos</h3>
        
        {!isBreakType && (
          <div className="space-y-2">
            <Label htmlFor="projection_notes">Notas Proyección</Label>
            <Textarea 
              id="projection_notes" 
              value={formData.projection_notes}
              onChange={(e) => setFormData({...formData, projection_notes: e.target.value})}
              rows={2}
              placeholder="Slides, videos, efectos..."
            />
          </div>
        )}

        {!isBreakType && (
          <div className="space-y-2">
            <Label htmlFor="sound_notes">Notas Sonido</Label>
            <Textarea 
              id="sound_notes" 
              value={formData.sound_notes}
              onChange={(e) => setFormData({...formData, sound_notes: e.target.value})}
              rows={2}
              placeholder="Micrófonos, pistas, cues..."
            />
          </div>
        )}

        {!isBreakType && !isTechOnly && (
          <div className="space-y-2">
            <Label htmlFor="ushers_notes">Notas Ujieres</Label>
            <Textarea 
              id="ushers_notes" 
              value={formData.ushers_notes}
              onChange={(e) => setFormData({...formData, ushers_notes: e.target.value})}
              rows={2}
              placeholder="Instrucciones para ujieres..."
            />
          </div>
        )}

        {formData.requires_translation && (
          <div className="space-y-2">
            <Label htmlFor="translation_notes">Notas Traducción</Label>
            <Textarea 
              id="translation_notes" 
              value={formData.translation_notes}
              onChange={(e) => setFormData({...formData, translation_notes: e.target.value})}
              rows={2}
              placeholder="Instrucciones para el traductor..."
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="other_notes">Otras Notas</Label>
          <Textarea 
            id="other_notes" 
            value={formData.other_notes}
            onChange={(e) => setFormData({...formData, other_notes: e.target.value})}
            rows={2}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Visibilidad en Reportes</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_general"
              checked={formData.show_in_general}
              onCheckedChange={(checked) => setFormData({...formData, show_in_general: checked})}
            />
            <label htmlFor="show_in_general" className="text-sm cursor-pointer">
              Mostrar en Programa General
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_projection"
              checked={formData.show_in_projection}
              onCheckedChange={(checked) => setFormData({...formData, show_in_projection: checked})}
            />
            <label htmlFor="show_in_projection" className="text-sm cursor-pointer">
              Mostrar en Vista Proyección
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_sound"
              checked={formData.show_in_sound}
              onCheckedChange={(checked) => setFormData({...formData, show_in_sound: checked})}
            />
            <label htmlFor="show_in_sound" className="text-sm cursor-pointer">
              Mostrar en Vista Sonido
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_ushers"
              checked={formData.show_in_ushers}
              onCheckedChange={(checked) => setFormData({...formData, show_in_ushers: checked})}
            />
            <label htmlFor="show_in_ushers" className="text-sm cursor-pointer">
              Mostrar en Vista Ujieres
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {segment ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}