/**
 * SegmentFormTwoColumn.jsx
 * Phase 3B FINAL: Slim orchestrator (~600 lines).
 *
 * Extracted (Phase 3B):
 * - useSegmentFormState.js — form init, sync, template application (~200 lines)
 * - useSegmentFormSubmit.js — validation, overlap, metadata, mutations (~200 lines)
 * - segment-form/VideoSection.jsx — video fields
 * - segment-form/PlenariaSection.jsx — message fields
 * - segment-form/PanelSection.jsx — panel fields
 *
 * Previously extracted (before 3B):
 * - ArtesFormSection, BreakoutRoomsEditor, SegmentActionsEditor
 * - WorshipSongsSection, TeamNotesSection, VisibilityTogglesSection
 * - AnnouncementSeriesSection
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, X, ScrollText } from "lucide-react";
import OverlapDetectedDialog from "./OverlapDetectedDialog";
import ShiftPreviewModal from "./ShiftPreviewModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TimePicker from "@/components/ui/TimePicker";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import SegmentTimelinePreview from "./SegmentTimelinePreview";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import AnnouncementSeriesManager from "../announcements/AnnouncementSeriesManager";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import ArtesFormSection from "./ArtesFormSection";
import BreakoutRoomsEditor from "./BreakoutRoomsEditor";
import SegmentActionsEditor from "./SegmentActionsEditor";
import WorshipSongsSection from "./WorshipSongsSection";
import AnnouncementSeriesSection from "./AnnouncementSeriesSection";
import TeamNotesSection from "./TeamNotesSection";
import VisibilityTogglesSection from "./VisibilityTogglesSection";
import { useLanguage } from "@/components/utils/i18n";
import { invalidateSegmentCaches } from "@/components/utils/queryKeys";

// Phase 3B extracted hooks and components
import useSegmentFormState from "./useSegmentFormState";
import useSegmentFormSubmit, { calculateTimes } from "./useSegmentFormSubmit";
import VideoSection from "./segment-form/VideoSection";
import PlenariaSection from "./segment-form/PlenariaSection";
import PanelSection from "./segment-form/PanelSection";
import StaleEditWarningDialog from "./StaleEditWarningDialog";

const SEGMENT_TYPES = [
  "Alabanza", "Bienvenida", "Ofrenda", "Plenaria", "Video",
  "Anuncio", "Dinámica", "TechOnly", "Oración",
  "Especial", "Cierre", "MC", "Ministración", "Receso", "Almuerzo", "Artes", "Panel", "Breakout"
];

const TYPE_TO_COLOR = {
  "Alabanza": "worship", "Plenaria": "preach", "Panel": "special",
  "Break": "break", "Receso": "break", "Almuerzo": "break",
  "TechOnly": "tech", "Video": "tech", "Especial": "special",
  "Artes": "special", "Ministración": "special",
};
const getColorForType = (type) => TYPE_TO_COLOR[type] || "default";

export default function SegmentFormTwoColumn({ session, segment, templates, onClose, sessionId, user }) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [showSeriesManager, setShowSeriesManager] = useState(false);
  const [showVerseParser, setShowVerseParser] = useState(false);

  // Fetch announcement series for selection
  const { data: announcementSeries = [] } = useQuery({
    queryKey: ['announcementSeries'],
    queryFn: () => base44.entities.AnnouncementSeries.list(),
  });

  // VALIDATION-ONLY QUERY — see queryKeys.js for cache architecture
  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: () => base44.entities.Segment.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId,
  });

  const nextOrder = React.useMemo(() => {
    if (!allSegments || allSegments.length === 0) return 1;
    const max = Math.max(...allSegments.map(s => Number(s.order) || 0));
    return (isFinite(max) ? max : 0) + 1;
  }, [allSegments]);

  // Phase 3B: extracted form state hook
  const {
    formData, setFormData, updateField,
    breakoutRooms, setBreakoutRooms,
    fieldOrigins, setFieldOrigins,
    selectedTemplate, setSelectedTemplate,
  } = useSegmentFormState({ segment, session, allSegments, templates });

  // Phase 3B: extracted submit hook
  const {
    handleSubmit: rawHandleSubmit,
    createMutation, updateMutation,
    showOverlapDialog, setShowOverlapDialog, overlapText,
    showShiftPreview, setShowShiftPreview,
    // Phase 5: Concurrent editing guard
    showStaleWarning, setShowStaleWarning,
    staleInfo,
    forceSave,
  } = useSegmentFormSubmit({ segment, sessionId, session, user, allSegments, nextOrder, onClose });

  const times = calculateTimes(formData.start_time, formData.duration_min);

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  // ── Type-derived booleans ──
  const isWorshipType = formData.segment_type === "Alabanza";
  const isPlenariaType = formData.segment_type === "Plenaria";
  const isBreakType = ["Break", "Receso", "Almuerzo"].includes(formData.segment_type);
  const isTechOnly = formData.segment_type === "TechOnly";
  const isBreakoutType = formData.segment_type === "Breakout";
  const isVideoType = formData.segment_type === "Video";
  const isArtesType = formData.segment_type === "Artes";
  const isPanelType = formData.segment_type === "Panel";
  const isAnnouncementType = formData.segment_type === "Anuncio";

  const needsPresenter = !isTechOnly && !isBreakoutType && !isPanelType;
  const presenterOptionalForBreak = isBreakType;
  const showTranslation = !isBreakoutType;
  const showActions = true;
  const requiresSala = !isBreakoutType;

  // Auto-default Sala to 'Santuario'
  useEffect(() => {
    if (requiresSala && !formData.room_id && rooms && rooms.length) {
      const santuario = rooms.find(r => typeof r.name === 'string' && r.name.toLowerCase().includes('santuario'));
      if (santuario) setFormData(prev => ({ ...prev, room_id: santuario.id }));
    }
  }, [requiresSala, rooms]);

  // Computed submit readiness
  const isPlaceholder = (val) => typeof val === 'string' && /^(tbd|por definir|---)$/i.test(val.trim());
  const hasValueOrPlaceholder = (val) => Boolean(val && String(val).trim()) || isPlaceholder(val);
  const canSubmit = hasValueOrPlaceholder(formData.title) && Boolean(formData.segment_type) &&
    (!needsPresenter || presenterOptionalForBreak || hasValueOrPlaceholder(formData.presenter)) &&
    (!requiresSala || Boolean(formData.room_id));

  const getPresenterLabel = () => {
    if (isPlenariaType) return language === 'es' ? 'Predicador' : 'Preacher';
    if (isWorshipType) return language === 'es' ? 'Líder de Alabanza' : 'Worship Leader';
    if (isArtesType) return language === 'es' ? 'Grupo / Director' : 'Group / Director';
    if (isBreakType) return language === 'es' ? 'Encargado de Transición' : 'Transition Host';
    return t('field.presenter');
  };

  // Auto-lock has_video for Video type
  React.useEffect(() => { if (isVideoType && !formData.has_video) setFormData(prev => ({ ...prev, has_video: true })); }, [isVideoType]);
  React.useEffect(() => { if (isArtesType && formData.art_types?.includes('VIDEO') && !formData.has_video) setFormData(prev => ({ ...prev, has_video: true })); }, [isArtesType, formData.art_types]);

  const scrollToSection = (sectionId) => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const colorCodeLabels = { worship: "Adoración", preach: "Predicación", break: "Descanso", tech: "Técnico", special: "Especial", default: "Predeterminado" };

  return (
    <form onSubmit={(e) => rawHandleSubmit(e, { formData, breakoutRooms, fieldOrigins })} className="flex flex-col">
      {/* Sticky Summary Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{formData.title || "Nuevo Segmento"}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <Badge variant="outline" className="text-xs">{formData.segment_type}</Badge>
              {formData.presenter && <span>• {formData.presenter}</span>}
              {formData.start_time && <span>• {formatTimeToEST(formData.start_time)}</span>}
              {times.end_time && <span>→ {formatTimeToEST(times.end_time)}</span>}
              {formData.duration_min && <span>({formData.duration_min}m)</span>}
              {formData.requires_translation && <Badge className="bg-purple-100 text-purple-800 text-xs">TRAD</Badge>}
              <span>• {colorCodeLabels[formData.color_code]}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => scrollToSection('basico')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Básico</button>
          <button type="button" onClick={() => scrollToSection('contenido')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Contenido</button>
          <button type="button" onClick={() => scrollToSection('acciones')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Acciones</button>
          <button type="button" onClick={() => scrollToSection('notas')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Notas</button>
          <button type="button" onClick={() => scrollToSection('otros')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap">Otros</button>
          {segment && <button type="button" onClick={() => scrollToSection('timeline')} className="flex-shrink-0 text-xs px-2 py-1 rounded hover:bg-slate-100 whitespace-nowrap flex items-center gap-1"><ScrollText className="w-3 h-3"/>Timeline</button>}
        </div>
      </div>

      <div>
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* LEFT COLUMN - Content */}
          <div className="space-y-6">
            <div id="basico" className="bg-white rounded-lg border border-l-4 border-l-pdv-teal border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-teal"></div>
                <h3 className="font-bold text-lg text-slate-900">Información Básica</h3>
              </div>
              <div className="p-4">
                {!segment && templates.length > 0 && (
                  <Card className="p-3 bg-blue-50 border-blue-200 mb-4">
                    <Label htmlFor="template" className="text-sm">Usar Plantilla</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>{templates.map(tmpl => <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Card>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input id="title" value={formData.title} onChange={(e) => updateField('title', e.target.value)} required placeholder="PLENARIA #1: Conquistando" />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'title')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="segment_type">Tipo <span className="text-red-500">*</span></Label>
                      <Select value={formData.segment_type} onValueChange={(value) => { updateField('segment_type', value); setFormData(prev => ({ ...prev, segment_type: value, color_code: getColorForType(value) })); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SEGMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {needsPresenter && (
                    <div className="space-y-2">
                      <Label htmlFor="presenter">{isBreakType ? (language === 'es' ? 'Encargado de Transición' : 'Transition Host') : getPresenterLabel()}{!presenterOptionalForBreak && <span className="text-red-500">*</span>}</Label>
                      <div className="relative">
                        <Input id="presenter" value={formData.presenter} onChange={(e) => updateField('presenter', e.target.value)} placeholder={isBreakType ? (language === 'es' ? 'Persona dando instrucciones (opcional)' : 'Person giving instructions (optional)') : "Nombre"} />
                        <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'presenter')} />
                      </div>
                      {isBreakType && <p className="text-xs text-gray-500">{language === 'es' ? 'Persona que da instrucciones desde la tarima durante el receso' : 'Person giving stage instructions during the break'}</p>}
                    </div>
                  )}
                  {!isBreakoutType && (
                    <div className="space-y-2">
                      <Label htmlFor="room_id">Sala {requiresSala && <span className="text-red-500">*</span>}</Label>
                      <Select value={formData.room_id} onValueChange={(value) => setFormData({...formData, room_id: value})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar sala..." /></SelectTrigger>
                        <SelectContent>{rooms.map(room => <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div id="contenido" className="bg-white rounded-lg border border-l-4 border-l-pdv-blue border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-blue"></div>
                <h3 className="font-bold text-lg text-slate-900">Contenido Específico</h3>
              </div>
              <div className="p-4 space-y-4">
                {isAnnouncementType && <AnnouncementSeriesSection formData={formData} updateField={updateField} announcementSeries={announcementSeries} onManageSeries={() => setShowSeriesManager(true)} />}
                <VideoSection formData={formData} setFormData={setFormData} isVideoType={isVideoType} isBreakType={isBreakType} isTechOnly={isTechOnly} />
                {isArtesType && <ArtesFormSection formData={formData} setFormData={setFormData} language={language} />}
                {isBreakoutType && <BreakoutRoomsEditor breakoutRooms={breakoutRooms} setBreakoutRooms={setBreakoutRooms} rooms={rooms} language={language} />}
                {isWorshipType && <WorshipSongsSection formData={formData} setFormData={setFormData} />}
                {isPlenariaType && <PlenariaSection formData={formData} setFormData={setFormData} onOpenVerseParser={() => setShowVerseParser(true)} />}
                {!isTechOnly && (
                  <div className="space-y-2">
                    <Label htmlFor="description_details">Descripción</Label>
                    <div className="relative">
                      <Textarea id="description_details" value={formData.description_details} onChange={(e) => updateField('description_details', e.target.value)} rows={3} placeholder="Detalles adicionales" />
                      <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'description_details')} />
                    </div>
                  </div>
                )}
                {isPanelType && <PanelSection formData={formData} setFormData={setFormData} />}
                {isBreakType && (
                  <div className="flex items-center space-x-2">
                    <Checkbox id="major_break" checked={formData.major_break} onCheckedChange={(checked) => setFormData({...formData, major_break: checked})} />
                    <label htmlFor="major_break" className="text-sm cursor-pointer">Receso Mayor (Almuerzo/Cena)</label>
                  </div>
                )}
              </div>
            </div>

            {showActions && <SegmentActionsEditor actions={formData.segment_actions} onChange={(newActions) => setFormData({...formData, segment_actions: newActions})} formData={formData} language={language} />}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {segment && (
              <div id="timeline" className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <SegmentTimelinePreview segments={allSegments} currentSegmentId={segment.id} />
              </div>
            )}

            <div className="bg-white rounded-lg border border-l-4 border-l-pdv-orange border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pdv-orange"></div>
                <h3 className="font-bold text-lg text-slate-900">Tiempos y Ejecución</h3>
              </div>
              <div className="p-4 space-y-4">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <Label className="font-semibold mb-3 block">Horarios *</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Inicio <span className="text-red-500">*</span></Label>
                      <TimePicker value={formData.start_time} onChange={(val) => setFormData({...formData, start_time: val})} placeholder="Seleccionar hora" className="h-9" invalid={!formData.start_time} required />
                      {!segment && allSegments && allSegments.length > 0 && (() => {
                        const sortedSegs = [...allSegments].sort((a, b) => (a.order || 0) - (b.order || 0));
                        const last = sortedSegs[sortedSegs.length - 1];
                        if (last?.end_time) return <p className="text-xs text-blue-600">Debe ser después de {formatTimeToEST(last.end_time)} (fin de "{last.title}")</p>;
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Duración (min) <span className="text-red-500">*</span></Label>
                      <Input type="number" value={formData.duration_min} onChange={(e) => setFormData({...formData, duration_min: parseInt(e.target.value)})} className="h-9" min="1" required />
                    </div>
                  </div>
                  {times.end_time && (
                    <div className="mt-3 text-sm text-slate-600 border-t border-blue-300 pt-2">
                      <div className="flex justify-between"><span>Fin estimado:</span><span className="font-mono font-medium text-blue-700">{formatTimeToEST(times.end_time)}</span></div>
                    </div>
                  )}
                  {allSegments && allSegments.length > 0 && <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">⚠️ Los segmentos no deben solaparse dentro de la sesión</div>}
                </Card>

                {showTranslation && (
                  <Card className="p-4 bg-purple-50 border-purple-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Checkbox id="requires_translation" checked={formData.requires_translation} onCheckedChange={(checked) => setFormData({...formData, requires_translation: checked})} />
                      <label htmlFor="requires_translation" className="font-semibold cursor-pointer">Requiere Traducción</label>
                    </div>
                    {formData.requires_translation && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Modo</Label>
                          <Select value={formData.translation_mode} onValueChange={(value) => setFormData({...formData, translation_mode: value})}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="InPerson">En Persona (en tarima)</SelectItem>
                              <SelectItem value="RemoteBooth">Cabina Remota (audífonos)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">{formData.translation_mode === "InPerson" ? "Traductor (en tarima)" : "Traductor (cabina)"}</Label>
                          <Input value={formData.translator_name} onChange={(e) => setFormData({...formData, translator_name: e.target.value})} placeholder="Nombre" className="h-9" />
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <TeamNotesSection formData={formData} updateField={updateField} setFormData={setFormData} fieldOrigins={fieldOrigins} isBreakType={isBreakType} isBreakoutType={isBreakoutType} isTechOnly={isTechOnly} requiresTranslation={formData.requires_translation} />
              </div>
            </div>

            <VisibilityTogglesSection formData={formData} setFormData={setFormData} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-slate-50 p-4 flex justify-end gap-3 sticky bottom-0 z-20">
        <Button type="button" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />{t('btn.cancel') || 'Cancelar'}</Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="submit" disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-4 h-4 mr-2" />{segment ? (t('btn.save') || 'Guardar') : (t('btn.confirm') || 'Crear')}
              </Button>
            </span>
          </TooltipTrigger>
          {!canSubmit && (
            <TooltipContent>
              <div className="text-xs">
                {t('error.required_fields_missing')}: {[
                  !hasValueOrPlaceholder(formData.title) && t('field.title'),
                  !formData.segment_type && t('field.type'),
                  (needsPresenter && !hasValueOrPlaceholder(formData.presenter)) && getPresenterLabel(),
                  (requiresSala && !formData.room_id) && t('field.room')
                ].filter(Boolean).join(', ')}
                <div className="mt-1 text-slate-500">{t('hint.allowed_placeholders')}</div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Modals */}
      {showSeriesManager && <AnnouncementSeriesManager isOpen={showSeriesManager} onClose={() => setShowSeriesManager(false)} initialSeriesId={formData.announcement_series_id || "new"} onSelect={(seriesId) => updateField('announcement_series_id', seriesId)} />}
      <VerseParserDialog open={showVerseParser} onOpenChange={setShowVerseParser} initialText={formData.scripture_references} onSave={({ parsed_data, verse }) => { setFormData(prev => ({ ...prev, scripture_references: verse, parsed_verse_data: parsed_data })); }} language={language} />
      <OverlapDetectedDialog open={showOverlapDialog} message={overlapText} onCancel={() => setShowOverlapDialog(false)} onProceed={() => { setShowOverlapDialog(false); setShowShiftPreview(true); }} />
      <StaleEditWarningDialog open={showStaleWarning} onCancel={() => setShowStaleWarning(false)} onForceSave={forceSave} staleInfo={staleInfo} language={language} />
      <ShiftPreviewModal
        open={showShiftPreview}
        onClose={() => setShowShiftPreview(false)}
        session={session}
        segments={allSegments}
        editedSegment={segment}
        newStartTime={formData.start_time}
        onConfirm={async ({ affected }) => {
          const updates = [];
          for (const a of affected) { updates.push(base44.entities.Segment.update(a.id, { start_time: a.newStart, end_time: a.newEnd })); }
          const currentTimes = calculateTimes(formData.start_time, formData.duration_min);
          const currentData = { session_id: sessionId, ...formData, ...currentTimes, breakout_rooms: formData.segment_type === "Breakout" ? breakoutRooms : undefined, field_origins: fieldOrigins };
          if (segment) { updates.push(base44.entities.Segment.update(segment.id, currentData)); } else { updates.push(base44.entities.Segment.create(currentData)); }
          await Promise.all(updates);
          invalidateSegmentCaches(queryClient);
          setShowShiftPreview(false);
          onClose();
        }}
      />
    </form>
  );
}