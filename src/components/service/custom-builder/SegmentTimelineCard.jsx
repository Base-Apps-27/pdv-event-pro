/**
 * SegmentTimelineCard.jsx
 * Phase 3C extraction: Per-segment card body from CustomServiceBuilder.
 * Renders the full card interior for a single segment in the timeline.
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { Clock, Plus, Trash2, Sparkles, ArrowUp, ArrowDown, ChevronUp, ChevronDown, BookOpen } from "lucide-react";

// Phase 7: Memoized — pure display component, re-renders only on prop changes
const SegmentTimelineCard = React.memo(function SegmentTimelineCard({
  segment,
  idx,
  isExpanded,
  totalSegments,
  updateSegmentField,
  toggleSegmentExpanded,
  moveSegmentUp,
  moveSegmentDown,
  removeSegment,
  handleOpenVerseParser,
  generateUiId,
}) {
  const isSpecial = segment.type === "Especial";

  return (
    <Card className={`border-l-4 ${isSpecial ? 'border-l-orange-500 bg-orange-50' : 'border-l-pdv-teal'}`}>
      <CardHeader className="pb-2 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex flex-col gap-1 print:hidden">
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => moveSegmentUp(idx)} disabled={idx === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => moveSegmentDown(idx)} disabled={idx === totalSegments - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
          {isSpecial ? <Sparkles className="w-4 h-4 text-orange-600" /> : <Clock className="w-4 h-4 text-pdv-teal" />}
          <Input
            value={segment.title}
            onChange={(e) => updateSegmentField(idx, 'title', e.target.value)}
            className="text-lg font-bold border-0 shadow-none p-0 h-auto focus-visible:ring-0 flex-1"
            placeholder="Título del segmento"
          />
          <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
          <Button variant="ghost" size="sm" onClick={() => removeSegment(idx)} className="print:hidden">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
        <div className="print:hidden">
          <Select
            value={segment.type}
            onValueChange={(value) => {
              updateSegmentField(idx, 'type', value);
              if ((value === 'Alabanza' || value === 'worship') && (!segment.songs || segment.songs.length === 0)) {
                updateSegmentField(idx, 'songs', [
                  { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" },
                  { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }
                ]);
              }
            }}
          >
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Alabanza">Alabanza</SelectItem>
              <SelectItem value="Plenaria">Plenaria (Mensaje)</SelectItem>
              <SelectItem value="Bienvenida">Bienvenida</SelectItem>
              <SelectItem value="Ofrenda">Ofrenda</SelectItem>
              <SelectItem value="Anuncio">Anuncio</SelectItem>
              <SelectItem value="Video">Video</SelectItem>
              <SelectItem value="Dinámica">Dinámica</SelectItem>
              <SelectItem value="Oración">Oración</SelectItem>
              <SelectItem value="Ministración">Ministración</SelectItem>
              <SelectItem value="Cierre">Cierre</SelectItem>
              <SelectItem value="Especial">Especial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {/* Worship fields */}
        {(segment.type === 'Alabanza' || segment.type === 'worship') && (
          <>
            <div className="grid md:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Líder / Director</Label>
                <AutocompleteInput type="leader" value={segment.leader} onChange={(e) => updateSegmentField(idx, 'leader', e.target.value)} placeholder="Nombre del líder" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Traductor</Label>
                <AutocompleteInput type="translator" value={segment.translator} onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)} placeholder="Nombre del traductor" className="text-sm" />
              </div>
            </div>
            {segment.songs && segment.songs.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-pdv-green">Canciones</Label>
                {segment.songs.map((song, sIdx) => (
                  <div key={sIdx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <AutocompleteInput type="songTitle" placeholder={`Canción ${sIdx + 1}`} value={song.title} onChange={(e) => { const newSongs = [...segment.songs]; newSongs[sIdx].title = e.target.value; updateSegmentField(idx, 'songs', newSongs); }} className="text-xs" />
                    </div>
                    <div className="col-span-4">
                      <AutocompleteInput type="leader" placeholder="Líder" value={song.lead} onChange={(e) => { const newSongs = [...segment.songs]; newSongs[sIdx].lead = e.target.value; updateSegmentField(idx, 'songs', newSongs); }} className="text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input placeholder="Tono" value={song.key || ""} onChange={(e) => { const newSongs = [...segment.songs]; newSongs[sIdx].key = e.target.value; updateSegmentField(idx, 'songs', newSongs); }} className="text-xs h-9" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Sub-Asignaciones (Ministración) within Alabanza */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-pdv-green">Sub-Asignaciones (Ministración)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  const newSubAsignaciones = [...(segment.sub_asignaciones || []), { _uiId: generateUiId(), title: "", presenter: "", duration: 5 }];
                  updateSegmentField(idx, 'sub_asignaciones', newSubAsignaciones);
                }} className="h-6 text-xs text-pdv-teal hover:bg-pdv-teal/10">
                  <Plus className="w-3 h-3 mr-1" />Agregar
                </Button>
              </div>
              {(segment.sub_asignaciones || []).length > 0 && (
                <div className="space-y-2 bg-gray-50 p-2 rounded-md">
                  {segment.sub_asignaciones.map((sub, subIdx) => (
                    <div key={sub._uiId || subIdx} className="flex gap-2 items-start bg-white p-2 rounded border border-gray-200">
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-6 space-y-1">
                          <Label className="text-xs text-gray-600">Título</Label>
                          <Input type="text" value={sub.title || ""} onChange={(e) => { const updated = [...segment.sub_asignaciones]; updated[subIdx].title = e.target.value; updateSegmentField(idx, 'sub_asignaciones', updated); }} placeholder="Ej. Sanidad y Milagros" className="text-xs h-8" />
                        </div>
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs text-gray-600">Ministra</Label>
                          <AutocompleteInput type="presenter" value={sub.presenter || ""} onChange={(e) => { const updated = [...segment.sub_asignaciones]; updated[subIdx].presenter = e.target.value; updateSegmentField(idx, 'sub_asignaciones', updated); }} placeholder="Nombre" className="text-xs h-8" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-gray-600">Min</Label>
                          <Input type="number" min="1" max="60" value={sub.duration || 5} onChange={(e) => { const updated = [...segment.sub_asignaciones]; updated[subIdx].duration = parseInt(e.target.value) || 5; updateSegmentField(idx, 'sub_asignaciones', updated); }} className="text-xs h-8" />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => { const updated = segment.sub_asignaciones.filter((_, i) => i !== subIdx); updateSegmentField(idx, 'sub_asignaciones', updated); }} className="h-8 w-8 text-red-400 hover:text-red-600 mt-6">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Message fields */}
        {(segment.type === 'Plenaria' || segment.type === 'message') && (
          <>
            <div className="grid md:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Predicador</Label>
                <AutocompleteInput type="preacher" value={segment.preacher} onChange={(e) => updateSegmentField(idx, 'preacher', e.target.value)} placeholder="Nombre del predicador" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Traductor</Label>
                <AutocompleteInput type="translator" value={segment.translator} onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)} placeholder="Nombre del traductor" className="text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Título del Mensaje</Label>
              <AutocompleteInput type="messageTitle" value={segment.messageTitle} onChange={(e) => updateSegmentField(idx, 'messageTitle', e.target.value)} placeholder="Título del mensaje" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Verso / Cita Bíblica</Label>
              <div className="flex gap-2">
                <Input value={segment.verse} onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)} placeholder="Ej. Juan 3:16" className="text-sm flex-1" />
                <Button variant="outline" size="sm" onClick={() => handleOpenVerseParser(idx)} className="border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0" title="Analizar versos">
                  <BookOpen className="w-4 h-4" />
                </Button>
              </div>
              {(segment.parsed_verse_data || segment.data?.parsed_verse_data) && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700 mt-1">
                  ✓ Analizado ({(segment.parsed_verse_data || segment.data?.parsed_verse_data).sections?.length || 0} elementos)
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Enlace a Presentación (Slides)</Label>
              <Input value={segment.presentation_url} onChange={(e) => updateSegmentField(idx, 'presentation_url', e.target.value)} placeholder="https://..." className="text-sm" />
              <div className="flex items-center space-x-2 mt-1">
                <Checkbox id={`slides_only_${idx}`} checked={segment.content_is_slides_only} onCheckedChange={(checked) => updateSegmentField(idx, 'content_is_slides_only', checked)} />
                <label htmlFor={`slides_only_${idx}`} className="text-xs cursor-pointer text-gray-600">Solo Slides (Sin versículos)</label>
              </div>
            </div>
          </>
        )}

        {/* Welcome fields */}
        {(segment.type === 'Bienvenida' || segment.type === 'welcome') && (
          <div className="grid md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Presentador</Label>
              <AutocompleteInput type="presenter" value={segment.presenter} onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)} placeholder="Nombre del presentador" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Traductor</Label>
              <AutocompleteInput type="translator" value={segment.translator} onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)} placeholder="Nombre del traductor" className="text-sm" />
            </div>
          </div>
        )}

        {/* Offering fields */}
        {(segment.type === 'Ofrenda' || segment.type === 'offering') && (
          <>
            <div className="grid md:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Presentador</Label>
                <AutocompleteInput type="presenter" value={segment.presenter} onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)} placeholder="Nombre del presentador" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Traductor</Label>
                <AutocompleteInput type="translator" value={segment.translator} onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)} placeholder="Nombre del traductor" className="text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Verso / Cita Bíblica</Label>
              <Input value={segment.verse} onChange={(e) => updateSegmentField(idx, 'verse', e.target.value)} placeholder="Ej. Malaquías 3:10" className="text-sm" />
            </div>
          </>
        )}

        {/* Special/Generic fields */}
        {['Especial', 'Anuncio', 'Video', 'Dinámica', 'Oración', 'Ministración', 'Cierre'].includes(segment.type) && (
          <div className="grid md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">{segment.type === 'Ministración' ? 'Ministra' : 'Presentador'}</Label>
              <AutocompleteInput type="presenter" value={segment.presenter} onChange={(e) => updateSegmentField(idx, 'presenter', e.target.value)} placeholder="Nombre del presentador" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Traductor</Label>
              <AutocompleteInput type="translator" value={segment.translator} onChange={(e) => updateSegmentField(idx, 'translator', e.target.value)} placeholder="Nombre del traductor" className="text-sm" />
            </div>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={() => toggleSegmentExpanded(idx)} className="w-full text-xs mt-2 print:hidden">
          {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {isExpanded ? "Menos detalles" : "Más detalles"}
        </Button>

        {isExpanded && (
          <div className="space-y-2 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Duración (minutos)</Label>
              <Input type="number" value={segment.duration || 0} onChange={(e) => updateSegmentField(idx, 'duration', parseInt(e.target.value) || 0)} className="text-xs w-24" />
            </div>
            <Textarea placeholder="Descripción / Notas adicionales..." value={segment.description} onChange={(e) => updateSegmentField(idx, 'description', e.target.value)} className="text-xs" rows={3} />
            <div className="grid md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Coordinador</Label>
                <Textarea placeholder="Instrucciones para el coordinador..." value={segment.coordinator_notes || ""} onChange={(e) => updateSegmentField(idx, 'coordinator_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Proyección</Label>
                <Textarea placeholder="Instrucciones para pantallas..." value={segment.projection_notes || ""} onChange={(e) => updateSegmentField(idx, 'projection_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Sonido</Label>
                <Textarea placeholder="Instrucciones para audio..." value={segment.sound_notes || ""} onChange={(e) => updateSegmentField(idx, 'sound_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Ujieres</Label>
                <Textarea placeholder="Instrucciones para ujieres..." value={segment.ushers_notes || ""} onChange={(e) => updateSegmentField(idx, 'ushers_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Traducción</Label>
                <Textarea placeholder="Instrucciones para traducción..." value={segment.translation_notes || ""} onChange={(e) => updateSegmentField(idx, 'translation_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Notas Stage/Decor</Label>
                <Textarea placeholder="Instrucciones para escenario..." value={segment.stage_decor_notes || ""} onChange={(e) => updateSegmentField(idx, 'stage_decor_notes', e.target.value)} className="text-xs" rows={2} />
              </div>
            </div>
            <div className="space-y-1 pt-2">
              <Label className="text-xs font-semibold text-gray-700">Notas Generales / Detalles</Label>
              <Textarea placeholder="Detalles adicionales para el programa..." value={segment.description_details || ""} onChange={(e) => updateSegmentField(idx, 'description_details', e.target.value)} className="text-xs" rows={2} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}