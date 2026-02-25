import React, { useContext, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Plus, Minus, Trash2, Sparkles, ChevronUp, ChevronDown, ArrowRight, ChevronsRight, BookOpen, Save, Check, Loader2 } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import {
  ServiceDataContext,
  UpdatersContext,
  SongInputRow,
  PreServiceNotesInput,
  RecesoNotesInput,
  TeamInput,
  SegmentTextInput,
  SegmentTextarea,
  SegmentAutocomplete,
} from "@/components/service/WeeklyServiceInputs";

/**
 * ServiceTimeSlotColumn — Extracted from WeeklyServiceManager (Phase 3A).
 * Renders one complete time-slot column for any configured session slot:
 *   - Header with time, add-special button, copy-all button
 *   - Pre-service notes
 *   - Segment cards (standard + special)
 *   - Receso (every slot except the last)
 *   - Team section
 *
 * Props:
 *   timeSlot              — dynamic slot name from ServiceSchedule
 *   slotIndex             — 0-based position for color cycling
 *   serviceData           — full service state
 *   expandedSegments      — object tracking expanded segment keys
 *   toggleSegmentExpanded — callback(timeSlot, idx)
 *   handleMoveSegment     — callback(timeSlot, idx, 'up'|'down')
 *   removeSpecialSegment  — callback(timeSlot, idx)
 *   updateSegmentField    — callback(service, idx, field, value)
 *   debouncedSave         — callback(fieldKey) for manual save triggers
 *   setServiceData        — state setter
 *   handleOpenVerseParser — callback(timeSlot, idx)
 *   calculateServiceTimes — callback(timeSlot) => timing info
 *   copySegmentToNextSlot     — callback(idx)            [first slot only]
 *   copyPreServiceNotesToNextSlot — callback()           [first slot only]
 *   copyTeamToNextSlot        — callback()               [first slot only]
 *   copyAllToNextSlot         — callback()               [second+ slots only]
 *   nextSlotName              — string name of target slot for copy labels
 *   isLastSlot                — boolean: true if this is the last slot (no receso after)
 *   onOpenSpecialDialog   — callback(timeSlot)
 *   canEdit               — boolean permission
 */
export default function ServiceTimeSlotColumn({
  timeSlot,
  slotIndex = 0,
  serviceData,
  expandedSegments,
  toggleSegmentExpanded,
  handleMoveSegment,
  removeSpecialSegment,
  updateSegmentField,
  debouncedSave,
  setServiceData,
  handleOpenVerseParser,
  calculateServiceTimes,
  copySegmentToNextSlot,
  copyPreServiceNotesToNextSlot,
  copyTeamToNextSlot,
  copyAllToNextSlot,
  nextSlotName,
  isLastSlot = false,
  onOpenSpecialDialog,
  canEdit,
  style,
}) {
  // Dynamic accent color based on slot position
  const SLOT_ACCENT_COLORS = ['red', 'blue', 'purple', 'amber', 'green'];
  const accentColor = SLOT_ACCENT_COLORS[slotIndex % SLOT_ACCENT_COLORS.length];
  const timingInfo = calculateServiceTimes(timeSlot);
  const segments = serviceData[timeSlot] || [];
  const { mutateSongs } = useContext(UpdatersContext) || {};

  // Add/remove song slots for worship segments
  const addSongSlot = useCallback((segIdx) => {
    const seg = serviceData?.[timeSlot]?.[segIdx];
    setServiceData(prev => {
      const arr = [...(prev[timeSlot] || [])];
      if (!arr[segIdx]) return prev;
      const s = { ...arr[segIdx] };
      const songs = [...(s.songs || [])];
      if (songs.length >= 10) return prev;
      songs.push({ title: "", lead: "", key: "" });
      s.songs = songs;
      arr[segIdx] = s;
      // Entity write: update song slots
      if (mutateSongs && seg?._entityId) {
        mutateSongs(seg._entityId, songs);
      }
      return { ...prev, [timeSlot]: arr };
    });
  }, [timeSlot, setServiceData, mutateSongs, serviceData]);

  const removeSongSlot = useCallback((segIdx) => {
    const seg = serviceData?.[timeSlot]?.[segIdx];
    setServiceData(prev => {
      const arr = [...(prev[timeSlot] || [])];
      if (!arr[segIdx]) return prev;
      const s = { ...arr[segIdx] };
      const songs = [...(s.songs || [])];
      if (songs.length <= 1) return prev;
      songs.pop();
      s.songs = songs;
      arr[segIdx] = s;
      // Entity write: update song slots
      if (mutateSongs && seg?._entityId) {
        mutateSongs(seg._entityId, songs);
      }
      return { ...prev, [timeSlot]: arr };
    });
  }, [timeSlot, setServiceData, mutateSongs, serviceData]);

  return (
    <div className="space-y-4" style={style}>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* H-BUG-7 FIX (2026-02-20): Static class map so Tailwind JIT can detect at build time */}
          <h2 className={`text-3xl ${
            { teal: 'text-teal-600', green: 'text-green-600', blue: 'text-blue-600', orange: 'text-orange-600', purple: 'text-purple-600' }[accentColor] || 'text-gray-600'
          }`}>
            {timeSlot.replace('am', ' a.m.').replace('pm', ' p.m.')}
          </h2>
          {canEdit && (
            <div className="flex gap-2">
              {copyAllToNextSlot && (
                <Button
                  size="sm"
                  onClick={copyAllToNextSlot}
                  className="print:hidden bg-blue-600 hover:bg-blue-700 text-white font-semibold border-2 border-blue-600"
                >
                  <ChevronsRight className="w-4 h-4 mr-2" />
                  Copiar Todo
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenSpecialDialog(timeSlot)}
                className="print:hidden border-2 border-gray-400 bg-white text-gray-900 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Especial
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={timingInfo.isOverage ? "bg-amber-100 border-amber-400 text-amber-900 font-bold" : `bg-${accentColor}-50`}>
            {timingInfo.totalDuration} min total
            {timingInfo.isOverage && ` (+${timingInfo.overageAmount} min)`}
          </Badge>
          <span>Termina: {timingInfo.endTime}</span>
          <span className="text-xs text-gray-500">(Meta: 90 min)</span>
          {timingInfo.isOverage && (
            <Badge className="bg-amber-600 text-white text-xs">⚠ Sobrepasa</Badge>
          )}
        </div>
      </div>

      {/* Pre-Service Block */}
      <Card className="bg-gray-100 border-2 border-gray-400">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
            <Clock className="w-4 h-4" />
            PRE-SERVICIO
            <Badge variant="outline" className="ml-auto text-xs text-gray-600 border-gray-500">Antes de iniciar</Badge>
            {copyPreServiceNotesToNextSlot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPreServiceNotesToNextSlot}
                className="print:hidden h-7 px-2 hover:bg-blue-50"
                title="Copiar a siguiente"
              >
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          <PreServiceNotesInput service={timeSlot} />
        </CardContent>
      </Card>

      {/* Segments */}
      <div className="space-y-4">
        {segments.filter(seg => seg.type !== 'break').map((segment, idx) => {
          const isExpanded = expandedSegments[`${timeSlot}-${idx}`];

          if (segment.type === "special") {
            return (
              <SpecialSegmentCard
                key={`${timeSlot}-special-${idx}`}
                timeSlot={timeSlot}
                segment={segment}
                idx={idx}
                isExpanded={isExpanded}
                serviceData={serviceData}
                toggleSegmentExpanded={toggleSegmentExpanded}
                handleMoveSegment={handleMoveSegment}
                removeSpecialSegment={removeSpecialSegment}
                updateSegmentField={updateSegmentField}
                debouncedSave={debouncedSave}
                setServiceData={setServiceData}
              />
            );
          }

          return (
            <StandardSegmentCard
              key={`${timeSlot}-${idx}`}
              timeSlot={timeSlot}
              segment={segment}
              idx={idx}
              isExpanded={isExpanded}
              serviceData={serviceData}
              accentColor={accentColor}
              toggleSegmentExpanded={toggleSegmentExpanded}
              handleMoveSegment={handleMoveSegment}
              updateSegmentField={updateSegmentField}
              debouncedSave={debouncedSave}
              setServiceData={setServiceData}
              handleOpenVerseParser={handleOpenVerseParser}
              copySegmentToNextSlot={copySegmentToNextSlot}
              nextSlotName={nextSlotName}
              canEdit={canEdit}
              addSongSlot={addSongSlot}
              removeSongSlot={removeSongSlot}
            />
          );
        })}
      </div>

      {/* Receso — shown after every slot except the last (break between consecutive slots) */}
      {!isLastSlot && (
        <Card className="bg-gray-100 border-2 border-gray-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              RECESO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            <RecesoNotesInput slotName={timeSlot} />
          </CardContent>
        </Card>
      )}

      {/* Team Section */}
      <Card className={`bg-${accentColor}-50 border-${accentColor}-300 border-2 print:hidden`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            EQUIPO {timeSlot}
            {copyTeamToNextSlot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyTeamToNextSlot}
                className="h-7 px-2 hover:bg-blue-50"
                title="Copiar a siguiente"
              >
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TeamInput field="coordinators" service={timeSlot} placeholder="Coordinador(a)" />
          <TeamInput field="ujieres" service={timeSlot} placeholder="Ujieres" />
          <TeamInput field="sound" service={timeSlot} placeholder="Sonido" />
          <TeamInput field="luces" service={timeSlot} placeholder="Luces" />
          <TeamInput field="fotografia" service={timeSlot} placeholder="Fotografía" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * SegmentSaveButton — Per-segment save indicator and manual save trigger.
 * Flashes red while the segment has unsaved (pending) entity writes.
 * Clicking immediately flushes all pending writes for this segment.
 */
function SegmentSaveButton({ entityId }) {
  const { dirtyEntities, flushEntity } = useContext(UpdatersContext) || {};
  const [saving, setSaving] = useState(false);

  if (!entityId || !dirtyEntities || !flushEntity) return null;

  const isDirty = dirtyEntities.has(String(entityId));

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await flushEntity(entityId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSave}
      disabled={saving}
      className={`h-6 px-1.5 print:hidden transition-all ${
        saving
          ? 'text-amber-500'
          : isDirty
            ? 'text-red-600 animate-pulse bg-red-50 hover:bg-red-100'
            : 'text-green-600 opacity-50 hover:opacity-100'
      }`}
      title={saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardado"}
    >
      {saving ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isDirty ? (
        <Save className="w-3.5 h-3.5" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}

/**
 * SpecialSegmentCard — renders an orange "special" segment card.
 */
function SpecialSegmentCard({
  timeSlot, segment, idx, isExpanded, serviceData,
  toggleSegmentExpanded, handleMoveSegment, removeSpecialSegment,
  updateSegmentField, debouncedSave, setServiceData,
}) {
  const totalSegments = serviceData[timeSlot]?.length || 0;
  const { mutateDuration } = useContext(UpdatersContext) || {};
  return (
    <Card className="border-2 border-gray-300 border-l-4 border-l-orange-500 bg-orange-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="print:hidden flex flex-col gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => handleMoveSegment(timeSlot, idx, 'up')} disabled={idx === 0} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleMoveSegment(timeSlot, idx, 'down')} disabled={idx === totalSegments - 1} className="h-4 w-5 p-0 hover:bg-blue-100">
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            <Sparkles className="w-4 h-4 text-orange-600" />
            {segment.title}
            <Badge className="ml-2 bg-orange-200 text-orange-800">Especial</Badge>
            <SegmentSaveButton entityId={segment._entityId} />
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => removeSpecialSegment(timeSlot, idx)} className="print:hidden">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        <AutocompleteInput type="presenter" placeholder="Presentador" value={segment.data?.presenter || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "presenter", e.target.value)} className="text-sm" />
        <AutocompleteInput type="translator" placeholder="Traductor" value={segment.data?.translator || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "translator", e.target.value)} className="text-sm" />
        <Textarea placeholder="Descripción / Notas" value={segment.data?.description || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "description", e.target.value)} className="text-sm" rows={2} />

        <Button variant="ghost" size="sm" onClick={() => toggleSegmentExpanded(timeSlot, idx)} className="w-full text-xs mt-2 print:hidden">
          {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {isExpanded ? "Menos detalles" : "Más detalles"}
        </Button>

        {isExpanded && (
          <div className="space-y-2 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
              <Input type="number" value={segment.duration || 0} onChange={(e) => {
                const newDuration = parseInt(e.target.value) || 0;
                setServiceData(prev => {
                  const updated = { ...prev };
                  updated[timeSlot] = [...prev[timeSlot]];
                  updated[timeSlot][idx] = { ...updated[timeSlot][idx], duration: newDuration };
                  return updated;
                });
                // Entity write: debounced duration update
                if (mutateDuration && segment._entityId) {
                  mutateDuration(segment._entityId, newDuration);
                }
              }} className="text-xs w-24" />
            </div>
            <Textarea placeholder="Notas para Coordinador" value={segment.data?.coordinator_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "coordinator_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas de Proyección" value={segment.data?.projection_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "projection_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas de Sonido" value={segment.data?.sound_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "sound_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas de Ujieres" value={segment.data?.ushers_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "ushers_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas de Traducción" value={segment.data?.translation_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "translation_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas de Stage/Decor" value={segment.data?.stage_decor_notes || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "stage_decor_notes", e.target.value)} className="text-xs" rows={2} />
            <Textarea placeholder="Notas Generales" value={segment.data?.description_details || ""} onChange={(e) => updateSegmentField(timeSlot, idx, "description_details", e.target.value)} className="text-xs" rows={2} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * StandardSegmentCard — renders a standard (non-special) segment card.
 */
function StandardSegmentCard({
  timeSlot, segment, idx, isExpanded, serviceData, accentColor,
  toggleSegmentExpanded, handleMoveSegment, updateSegmentField,
  debouncedSave, setServiceData, handleOpenVerseParser, copySegmentToNextSlot, nextSlotName,
  canEdit, addSongSlot, removeSongSlot,
}) {
  const filteredSegments = serviceData[timeSlot]?.filter(s => s.type !== 'break') || [];
  const totalFiltered = filteredSegments.length;
  const { mutateDuration } = useContext(UpdatersContext) || {};

  return (
    <Card className={`border-2 border-gray-300 border-l-4 border-l-${accentColor}-500 bg-white`}>
      <CardHeader className="pb-2 bg-gray-50">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="print:hidden flex flex-col gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => handleMoveSegment(timeSlot, idx, 'up')} disabled={idx === 0} className="h-4 w-5 p-0 hover:bg-blue-100">
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleMoveSegment(timeSlot, idx, 'down')} disabled={idx === totalFiltered - 1} className="h-4 w-5 p-0 hover:bg-blue-100">
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>
          <Clock className={`w-4 h-4 text-${accentColor}-600`} />
          {segment.title}
          <Badge variant="outline" className="ml-auto text-xs">{segment.duration} min</Badge>
          <SegmentSaveButton entityId={segment._entityId} />
          {copySegmentToNextSlot && (
            <Button variant="ghost" size="sm" onClick={() => copySegmentToNextSlot(idx)} className="print:hidden h-7 px-2 hover:bg-blue-50" title="Copiar a siguiente">
              <ArrowRight className="w-4 h-4 text-blue-600" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {/* Director field (for worship segments, stored as presenter) */}
        {segment.fields?.includes("presenter") && segment.type === "Alabanza" && (
          <div className="space-y-1">
            <SegmentAutocomplete service={timeSlot} segmentIndex={idx} field="presenter" type="worshipLeader" placeholder="Director" />
            <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              💡 Sarah Manzano o Anthony Estrella (quien esté sirviendo). Si ninguno, el Director de Banda designado.
            </p>
          </div>
        )}
        {segment.fields?.includes("presenter") && (
          <SegmentAutocomplete service={timeSlot} segmentIndex={idx} field="presenter" type="presenter" placeholder="Presentador" />
        )}
        {segment.fields?.includes("preacher") && (
          <SegmentAutocomplete service={timeSlot} segmentIndex={idx} field="preacher" type="preacher" placeholder="Predicador" />
        )}
        {segment.fields?.includes("title") && (
          <SegmentTextInput service={timeSlot} segmentIndex={idx} field="title" placeholder="Título del Mensaje" />
        )}

        {/* Verse + Speaker Materials (message segments) */}
        {segment.fields?.includes("verse") && segment.type === 'message' && (
          <div className="space-y-1">
            <div className="flex gap-2">
              <SegmentTextInput service={timeSlot} segmentIndex={idx} field="verse" placeholder="Verso / Cita Bíblica" className="text-sm flex-1" />
              <Button variant="outline" size="sm" onClick={() => handleOpenVerseParser(timeSlot, idx)} className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0" title="Analizar versos y bosquejo">
                <BookOpen className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-500 italic">💡 Usa el ícono 📖 para extraer y estructurar referencias bíblicas</p>
            {segment.data?.parsed_verse_data && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                ✓ Analizado ({segment.data.parsed_verse_data.sections?.length || 0} elementos)
              </Badge>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2 space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Material del Orador</Label>
              <SegmentTextInput service={timeSlot} segmentIndex={idx} field="presentation_url" placeholder="Enlace a Presentación (Slides)" className="text-xs bg-white" />
              <div className="flex items-center space-x-2">
                <Checkbox checked={segment.content_is_slides_only || false} onCheckedChange={(checked) => updateSegmentField(timeSlot, idx, "content_is_slides_only", checked)} id={`slides-only-${timeSlot}-${idx}`} className="bg-white" />
                <label htmlFor={`slides-only-${timeSlot}-${idx}`} className="text-xs cursor-pointer text-gray-600">Solo Slides (Sin versículos)</label>
              </div>
              <SegmentTextInput service={timeSlot} segmentIndex={idx} field="notes_url" placeholder="Link de Bosquejo / Notas (PDF o Doc)" className="text-xs bg-white" />
            </div>
          </div>
        )}

        {/* Songs */}
        {segment.songs && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">Canciones</Label>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">{segment.songs.length}</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeSongSlot(idx)} disabled={segment.songs.length <= 1} title="Quitar canción">
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => addSongSlot(idx)} disabled={segment.songs.length >= 10} title="Agregar canción">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            {segment.songs.map((_, sIdx) => (
              <SongInputRow key={sIdx} service={timeSlot} segmentIndex={idx} songIndex={sIdx} />
            ))}
          </div>
        )}

        {/* Translation */}
        {segment.requires_translation && (() => {
          // Extract source segment type from default_translator_source
          const sourceMatch = segment.default_translator_source?.match(/^(.+)_segment_translator$/);
          const sourceType = sourceMatch ? sourceMatch[1] : null;
          const sourceSegment = sourceType 
            ? serviceData[timeSlot]?.find(s => s.type?.toLowerCase() === sourceType.toLowerCase())
            : null;
          
          const sourceLabels = {
            'worship': 'Alabanza',
            'alabanza': 'Alabanza',
            'ofrenda': 'Ofrenda',
            'offering': 'Ofrenda',
            'bienvenida': 'Bienvenida',
            'welcome': 'Bienvenida',
            'message': 'Mensaje',
            'plenaria': 'Mensaje'
          };
          
          const sourceLabel = sourceType ? (sourceLabels[sourceType.toLowerCase()] || sourceType) : null;
          
          return (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <Label className="text-xs font-semibold text-blue-800 mb-1">
                🌐 Traductor(a)
                {sourceLabel && (
                  <span className="ml-2 text-[10px] font-normal text-blue-600">(auto-rellena de {sourceLabel})</span>
                )}
              </Label>
              <SegmentAutocomplete
                service={timeSlot}
                segmentIndex={idx}
                field="translator"
                type="translator"
                placeholder={
                  sourceSegment?.data?.translator 
                    ? sourceSegment.data.translator 
                    : sourceLabel 
                      ? `Del segmento de ${sourceLabel}` 
                      : "Nombre del traductor"
                }
              />
            </div>
          );
        })()}

        {/* Sub-Assignments */}
        {segment.sub_assignments && segment.sub_assignments.length > 0 && (
          <div className="space-y-2 border-t pt-2 mt-2">
            <Label className="text-xs font-semibold text-purple-800">Sub-Asignaciones</Label>
            {segment.sub_assignments.map((subAssign, saIdx) => (
              <div key={saIdx} className="bg-purple-50 border border-purple-200 rounded p-2">
                <Label className="text-xs font-semibold text-purple-800 mb-1">
                  {subAssign.label} {subAssign.duration_min ? `(${subAssign.duration_min} min)` : ''}
                </Label>
                <SegmentAutocomplete service={timeSlot} segmentIndex={idx} field={subAssign.person_field_name} type="person" placeholder={`Nombre para ${subAssign.label}`} />
              </div>
            ))}
          </div>
        )}

        {/* Legacy ministry_leader fallback */}
        {!segment.sub_assignments?.length && segment.fields?.includes("ministry_leader") && (
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <Label className="text-xs font-semibold text-purple-800 mb-1">Ministración de Sanidad y Milagros (5 min)</Label>
            <SegmentAutocomplete service={timeSlot} segmentIndex={idx} field="ministry_leader" type="ministryLeader" placeholder="Líder de Ministración" />
          </div>
        )}

        {/* Expand/collapse details */}
        <Button variant="ghost" size="sm" onClick={() => toggleSegmentExpanded(timeSlot, idx)} className="w-full text-xs mt-2 print:hidden">
          {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {isExpanded ? "Menos detalles" : "Más detalles"}
        </Button>

        {isExpanded && (
          <div className="space-y-2 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
              <Input type="number" value={segment.duration || 0} onChange={(e) => {
                const newDuration = parseInt(e.target.value) || 0;
                setServiceData(prev => {
                  const updated = { ...prev };
                  updated[timeSlot] = [...prev[timeSlot]];
                  updated[timeSlot][idx] = { ...updated[timeSlot][idx], duration: newDuration };
                  return updated;
                });
                // Entity write: debounced duration update
                if (mutateDuration && segment._entityId) {
                  mutateDuration(segment._entityId, newDuration);
                }
              }} className="text-xs w-24" />
            </div>
            {segment.actions && segment.actions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                <Label className="text-xs font-semibold text-amber-900 mb-2 block">⏰ Acciones para Coordinador</Label>
                <div className="space-y-1">
                  {segment.actions.map((action, aIdx) => (
                    <div key={aIdx} className="text-xs text-amber-800 flex items-start gap-1">
                      <span className="font-semibold">•</span>
                      <span>{action?.label || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="coordinator_notes" placeholder="Notas para Coordinador" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="projection_notes" placeholder="Notas de Proyección" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="sound_notes" placeholder="Notas de Sonido" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="ushers_notes" placeholder="Notas de Ujieres" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="translation_notes" placeholder="Notas de Traducción" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="stage_decor_notes" placeholder="Notas de Stage/Decor" className="text-xs" />
            <SegmentTextarea service={timeSlot} segmentIndex={idx} field="description_details" placeholder="Notas Generales" className="text-xs" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}