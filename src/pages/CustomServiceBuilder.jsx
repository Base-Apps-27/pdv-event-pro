/**
 * CustomServiceBuilder.jsx
 * Phase 3C FINAL: Slim orchestrator (~680 lines).
 *
 * Extracted components:
 * - compressionLevel.js — getCompressionLevel utility
 * - customServicePrintStyles.js — all print CSS (~440 lines)
 * - sessionSync.js — syncToSession backend mutation (~192 lines)
 * - SegmentTimelineCard.jsx — per-segment card (~536 lines)
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { Calendar, Save, Plus, ArrowLeft, Download } from "lucide-react";
import AnnouncementListSelector from "@/components/announcements/AnnouncementListSelector";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import AnimatedSortableItem from "@/components/shared/AnimatedSortableItem";
import { AnimatePresence } from "framer-motion";
import { addMinutes, parse, format } from "date-fns";
import VerseParserDialog from "@/components/service/VerseParserDialog";
// Phase 4: removed unused getSegmentData import (now only used in sessionSync.js)
import { normalizeSegment, normalizeServiceTeams } from "@/components/utils/segmentDataUtils";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";
import { generateServiceProgramPDFWithAutoFit } from "@/components/service/generateProgramPDFWithAutoFit";
import { useLanguage } from "@/components/utils/i18n";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { toast } from "sonner";
import { hasPermission } from "@/components/utils/permissions";
import { safeGetItem, safeSetItem } from "@/components/utils/safeLocalStorage";

// Phase 3C extracted modules
import { getCompressionLevel } from "@/components/utils/compressionLevel";
import { CUSTOM_SERVICE_PRINT_CSS } from "@/components/print/customServicePrintStyles";
import { syncToSession } from "@/components/service/sessionSync";
// Universal log (2026-02-19): Service creates/updates now logged for full audit trail
import { logCreate, logUpdate } from "@/components/utils/editActionLogger";
// Entity Lift L1.1: Load segments from Session/Segment entities when available
import { loadCustomFromSession } from "@/components/service/customSessionSync";
import SegmentTimelineCard from "@/components/service/custom-builder/SegmentTimelineCard";
import useStaleGuard from "@/components/utils/useStaleGuard";
import StaleEditWarningDialog from "@/components/session/StaleEditWarningDialog";

export default function CustomServiceBuilder() {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  const queryClient = useQueryClient();

  // ── Core state ──
  const [serviceData, setServiceData] = useState({
    name: "", date: new Date().toISOString().split('T')[0], day_of_week: "", time: "10:00",
    location: "", description: "",
    segments: [
      normalizeSegment({ _uiId: "init-1", title: "Equipo de A&A", type: "Alabanza", duration: 35, presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", songs: [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: [] }),
      normalizeSegment({ _uiId: "init-2", title: "Bienvenida y Anuncios", type: "Bienvenida", duration: 5, presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", songs: [], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: [] }),
      normalizeSegment({ _uiId: "init-3", title: "Ofrendas", type: "Ofrenda", duration: 5, presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", songs: [], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: [] }),
      normalizeSegment({ _uiId: "init-4", title: "Mensaje", type: "Plenaria", duration: 45, presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", songs: [], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: [] }),
    ],
    coordinators: { main: "" }, ujieres: { main: "" }, sound: { main: "" },
    luces: { main: "" }, fotografia: { main: "" }, notes: "", selected_announcements: []
  });

  const [expandedSegments, setExpandedSegments] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle");
  const [highlightedSegmentId, setHighlightedSegmentId] = useState(null);
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ segmentIdx: null });
  const [segmentToDelete, setSegmentToDelete] = useState(null);

  // Phase 5: Concurrent editing guard for service-level saves
  const { captureBaseline, checkStale, updateBaseline } = useStaleGuard();
  const [showStaleWarning, setShowStaleWarning] = useState(false);
  const [staleInfo, setStaleInfo] = useState(null);

  const generateUiId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

  const getDefaultSegmentForm = () => ({
    _uiId: generateUiId(), title: "", type: "Especial", duration: 15, sub_asignaciones: [],
    data: { presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", presentation_url: "", content_is_slides_only: false, songs: [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: [] },
    presenter: "", translator: "", preacher: "", leader: "", messageTitle: "", verse: "", presentation_url: "", content_is_slides_only: false, songs: [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }], description: "", description_details: "", coordinator_notes: "", projection_notes: "", sound_notes: "", ushers_notes: "", translation_notes: "", stage_decor_notes: "", actions: []
  });

  // ── Queries ──
  const { data: existingService } = useQuery({
    queryKey: ['customService', serviceId],
    queryFn: async () => { if (!serviceId) return null; const service = await base44.entities.Service.filter({ id: serviceId }); return service[0] || null; },
    enabled: !!serviceId
  });

  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const selectedAnnouncementsForPrint = allAnnouncements.filter(a => serviceData.selected_announcements?.includes(a.id));

  // ── Load existing service ──
  // Entity Lift L1.1: Try loading segments from Session/Segment entities first.
  // Falls back to Service.segments[] JSON if no entities exist.
  // This ensures services saved before syncToSession was wired still load correctly.
  useEffect(() => {
    if (!existingService) return;

    const loadServiceData = async () => {
      const sanitizedService = normalizeServiceTeams(existingService);
      if (!sanitizedService.selected_announcements) sanitizedService.selected_announcements = [];

      // L1.1: Try entity path first
      let usedEntityPath = false;
      try {
        const entityData = await loadCustomFromSession(base44, existingService.id);
        if (entityData && entityData.segments && entityData.segments.length > 0) {
          // Entity-sourced segments: assign _uiId for UI keying
          sanitizedService.segments = entityData.segments.map(s => ({
            ...s,
            _uiId: s._uiId || generateUiId(),
          }));
          usedEntityPath = true;
          console.info('[ENTITY_LIFT L1.1] Loaded', entityData.segments.length, 'segments from entities for service', existingService.id);
        }
      } catch (err) {
        console.warn('[ENTITY_LIFT L1.1] Entity load failed, falling back to JSON:', err.message);
      }

      // JSON fallback: use Service.segments[] if entity path didn't produce data
      if (!usedEntityPath && sanitizedService.segments) {
        sanitizedService.segments = sanitizedService.segments.map(s => ({
          ...s,
          _uiId: s._uiId || generateUiId(),
        }));
      }

      setServiceData(sanitizedService);
      setLastSavedData(JSON.parse(JSON.stringify(sanitizedService)));
      setHasUnsavedChanges(false);
      // Phase 5: Capture baseline for stale detection
      captureBaseline(existingService.updated_date);

      // Local backup recovery
      const backupKey = `service_backup_${existingService.id}`;
      const backup = safeGetItem(backupKey);
      if (backup) {
        try {
          const { timestamp } = JSON.parse(backup);
          const backupDate = new Date(timestamp);
          const serverDate = existingService.updated_date ? new Date(existingService.updated_date) : new Date(0);
          if (backupDate > serverDate) {
            // Backup is newer than server — user may have unsaved local changes
          }
        } catch (error) { console.error('[BACKUP RECOVERY ERROR]', error.message); }
      }
    };

    loadServiceData();
  }, [existingService]);

  // Auto-populate day of week
  useEffect(() => {
    if (serviceData.date) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = days[new Date(serviceData.date + 'T00:00:00').getDay()];
      if (dayOfWeek !== serviceData.day_of_week) setServiceData(prev => ({ ...prev, day_of_week: dayOfWeek }));
    }
  }, [serviceData.date]);

  // ── Mutation ──
  const saveServiceMutation = useMutation({
    mutationFn: async (data) => {
      const sanitizedData = normalizeServiceTeams(data);
      if (serviceId) return await base44.entities.Service.update(serviceId, sanitizedData);
      return await base44.entities.Service.create(sanitizedData);
    },
    onSuccess: async (result) => {
      // SYNC TO SESSION/SEGMENTS for Live Control support
      try { await syncToSession(base44, result, serviceData.segments); } catch (err) { console.error("Failed to sync session data:", err); }
      queryClient.invalidateQueries(['customService']);
      queryClient.invalidateQueries(['services']);
      setLastSavedData(JSON.parse(JSON.stringify(serviceData)));
      setHasUnsavedChanges(false);
      setAutoSaveStatus("saved");
      if (result?.id) {
        safeSetItem(`service_backup_${result.id}`, JSON.stringify({ data: result, timestamp: new Date().toISOString() }));
      }
      if (autoSaveStatus !== "saving") toast.success('Servicio guardado exitosamente en ' + new Date().toLocaleTimeString('es-ES', { timeZone: 'America/New_York' }));
    },
    onError: (error) => { setAutoSaveStatus("error"); toast.error('Error al guardar: ' + error.message); }
  });

  // Determine service_type: preserve existing type if editing, default to 'one_off' for new
  const resolvedServiceType = existingService?.service_type || 'one_off';

  const handleSave = async () => {
    // Phase 5: Check for concurrent edits before manual save
    if (serviceId) {
      const stale = await checkStale("Service", serviceId);
      if (stale.isStale) {
        setStaleInfo(stale);
        setShowStaleWarning(true);
        return;
      }
    }
    saveServiceMutation.mutate({ ...serviceData, status: 'active', service_type: resolvedServiceType });
  };

  const forceSaveService = () => {
    setShowStaleWarning(false);
    setStaleInfo(null);
    saveServiceMutation.mutate({ ...serviceData, status: 'active', service_type: resolvedServiceType });
  };

  // ── Side effects ──
  useEffect(() => {
    if (!lastSavedData) return;
    setHasUnsavedChanges(JSON.stringify(serviceData) !== JSON.stringify(lastSavedData));
  }, [serviceData, lastSavedData]);

  useEffect(() => {
    if (!hasUnsavedChanges || !serviceId) return;
    setAutoSaveStatus("saving");
    // Phase 3: Auto-save must include service_type to maintain one_off discrimination
    const timer = setTimeout(() => saveServiceMutation.mutate({ ...serviceData, status: 'active', service_type: 'one_off' }), 3000);
    return () => clearTimeout(timer);
  }, [serviceData, hasUnsavedChanges, serviceId]);

  useEffect(() => {
    const handleBeforeUnload = (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = 'Tienes cambios sin guardar.'; return e.returnValue; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ── Handlers ──
  const handleDownloadProgramPDF = async () => {
    const toastId = toast.loading(t('pdf.generating') || 'Generando PDF...');
    try {
      const result = await generateServiceProgramPDFWithAutoFit(serviceData, (msg) => toast.loading(msg, { id: toastId }));
      const link = document.createElement('a'); link.href = URL.createObjectURL(result.pdf); link.download = `Programa-${serviceData.date || 'servicio'}.pdf`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
      toast.success((t('pdf.generated') || 'PDF generado exitosamente') + (result.isCached ? ' ✓ (Cached)' : ''), { id: toastId });
    } catch (error) { console.error('[PDF ERROR]', error); toast.error(t('pdf.error') || 'Error generando PDF: ' + (error?.message || 'Error desconocido'), { id: toastId }); }
  };

  const handleDownloadAnnouncementsPDF = async () => {
    try {
      if (!selectedAnnouncementsForPrint || selectedAnnouncementsForPrint.length === 0) { toast.error('Por favor, selecciona al menos un anuncio.'); return; }
      const pdf = await generateAnnouncementsPDF(selectedAnnouncementsForPrint, serviceData.date);
      pdf.download(`Anuncios-${serviceData.date || 'servicio'}.pdf`);
    } catch (error) { console.error('[PDF ERROR]', error); toast.error('Error generando PDF de anuncios: ' + (error?.message || 'Error desconocido')); }
  };

  const addSegment = () => setServiceData(prev => ({ ...prev, segments: [...prev.segments, getDefaultSegmentForm()] }));
  const confirmRemoveSegment = () => { if (segmentToDelete !== null) { setServiceData(prev => ({ ...prev, segments: prev.segments.filter((_, i) => i !== segmentToDelete) })); setSegmentToDelete(null); } };

  const updateSegmentField = (idx, field, value) => {
    setServiceData(prev => {
      const segments = [...prev.segments]; const segment = { ...segments[idx] };
      if (field === 'songs') { segment.songs = value; } else { segment[field] = value; }
      if (!segment.data) segment.data = {};
      if (field === 'songs') { segment.data.songs = value; } else { segment.data[field] = value; }
      segments[idx] = segment;
      return { ...prev, segments };
    });
  };

  const toggleSegmentExpanded = (idx) => setExpandedSegments(prev => ({ ...prev, [idx]: !prev[idx] }));

  const moveSegmentUp = (idx) => {
    if (idx === 0) return;
    const items = Array.from(serviceData.segments); const movingSegment = items[idx];
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    setServiceData(prev => ({ ...prev, segments: items })); setHighlightedSegmentId(movingSegment._uiId);
  };

  const moveSegmentDown = (idx) => {
    if (idx === serviceData.segments.length - 1) return;
    const items = Array.from(serviceData.segments); const movingSegment = items[idx];
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    setServiceData(prev => ({ ...prev, segments: items })); setHighlightedSegmentId(movingSegment._uiId);
  };

  const handleOpenVerseParser = (idx) => {
    const segment = serviceData.segments[idx];
    setVerseParserContext({ segmentIdx: idx, initialText: segment.verse || "" });
    setVerseParserOpen(true);
  };

  const handleSaveParsedVerses = (data) => {
    const { segmentIdx } = verseParserContext;
    setServiceData(prev => {
      const updated = { ...prev }; const segment = updated.segments[segmentIdx];
      updated.segments[segmentIdx] = { ...segment, parsed_verse_data: data.parsed_data, data: { ...(segment.data || {}), parsed_verse_data: data.parsed_data, verse: segment.verse || segment.data?.verse } };
      return updated;
    });
    setVerseParserOpen(false); setVerseParserContext({ segmentIdx: null });
  };

  const calculateTotalTime = () => {
    const total = serviceData.segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
    if (!serviceData.time) return { total, endTime: "N/A" };
    const startTime = parse(serviceData.time, "HH:mm", new Date());
    return { total, endTime: format(addMinutes(startTime, total), "h:mm a") };
  };
  const timeCalc = calculateTotalTime();

  // ── Compression CSS vars ──
  const level = getCompressionLevel(serviceData);
  const marginVal = level === 'aggressive' ? '0.25in' : level === 'moderate' ? '0.35in' : '0.5in';
  const segMargin = level === 'aggressive' ? '6pt' : level === 'moderate' ? '8pt' : '10pt';
  const lineH = level === 'aggressive' ? '1.2' : '1.3';

  // ── Render ──
  return (
    <div className="p-6 md:p-8 space-y-8 print:p-0" style={{ '--print-margin-top': marginVal, '--print-margin-right': marginVal, '--print-margin-bottom': marginVal, '--print-margin-left': marginVal, '--print-segment-margin': segMargin, '--print-line-height': lineH }}>
      <style>{CUSTOM_SERVICE_PRINT_CSS}</style>

      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('CustomServicesManager'))}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-5xl text-gray-900 uppercase tracking-tight">{serviceId ? (language === 'es' ? 'Editar Servicio' : 'Edit Service') : (language === 'es' ? 'Nuevo Servicio Personalizado' : 'New Custom Service')}</h1>
            <p className="text-gray-500 mt-1">{language === 'es' ? 'Crea servicios especiales con horarios y elementos personalizados' : 'Create special services with custom schedules and elements'}</p>
            <div className="flex items-center gap-3 mt-2">
              {existingService?.updated_date && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  {language === 'es' ? 'Última actualización' : 'Last updated'}: {new Date(existingService.updated_date).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}
                </Badge>
              )}
              {hasUnsavedChanges && <Badge className="text-xs bg-yellow-500 text-white animate-pulse">{language === 'es' ? 'Cambios sin guardar' : 'Unsaved changes'}</Badge>}
              {autoSaveStatus === "saving" && <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">{language === 'es' ? 'Guardando automáticamente...' : 'Auto-saving...'}</Badge>}
              {autoSaveStatus === "saved" && !hasUnsavedChanges && <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">✓ {language === 'es' ? 'Auto-guardado' : 'Auto-saved'}</Badge>}
              {autoSaveStatus === "error" && <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">⚠ {language === 'es' ? 'Error al guardar' : 'Save error'}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveServiceMutation.isPending} style={tealStyle} className="font-semibold"><Save className="w-5 h-5 mr-2" />{saveServiceMutation.isPending ? t('btn.saving') : t('common.save')}</Button>
          <Button onClick={handleDownloadProgramPDF} style={tealStyle} className="gap-2 font-semibold" title={language === 'es' ? 'Descargar Programa como PDF' : 'Download Program as PDF'}><Download className="w-4 h-4" />{language === 'es' ? 'PDF Programa' : 'Program PDF'}</Button>
          <Button onClick={handleDownloadAnnouncementsPDF} disabled={!serviceData.selected_announcements || serviceData.selected_announcements.length === 0} style={tealStyle} className="gap-2 font-semibold" title={language === 'es' ? 'Descargar Anuncios como PDF' : 'Download Announcements as PDF'}><Download className="w-4 h-4" />{language === 'es' ? 'PDF Anuncios' : 'Announcements PDF'}</Button>
        </div>
      </div>

      {/* Delete Segment Confirmation */}
      <Dialog open={segmentToDelete !== null} onOpenChange={(open) => !open && setSegmentToDelete(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader><DialogTitle>{language === 'es' ? '¿Eliminar este segmento?' : 'Delete this segment?'}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">{language === 'es' ? 'Esta acción no se puede deshacer.' : 'This action cannot be undone.'}</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setSegmentToDelete(null)}>{t('common.cancel')}</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmRemoveSegment}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verse Parser Dialog */}
      <VerseParserDialog open={verseParserOpen} onOpenChange={setVerseParserOpen} initialText={verseParserContext.initialText || ""} onSave={handleSaveParsedVerses} language={language} />

      {/* Phase 5: Concurrent editing warning */}
      <StaleEditWarningDialog open={showStaleWarning} onCancel={() => setShowStaleWarning(false)} onForceSave={forceSaveService} staleInfo={staleInfo} language={language} />

      {/* Service Details */}
      <Card className="print:hidden">
        <CardHeader><CardTitle>{language === 'es' ? 'Detalles del Servicio' : 'Service Details'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'es' ? 'Nombre del Servicio *' : 'Service Name *'}</Label>
              <Input value={serviceData.name} onChange={(e) => setServiceData(prev => ({ ...prev, name: e.target.value }))} placeholder={language === 'es' ? 'Ej. Servicio Especial de Navidad' : 'E.g. Special Christmas Service'} required className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>{language === 'es' ? 'Fecha *' : 'Date *'}</Label>
              <DatePicker value={serviceData.date} onChange={(val) => setServiceData(prev => ({ ...prev, date: val }))} placeholder={t('placeholder.selectDate')} required className="w-full max-w-full" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{language === 'es' ? 'Día de la Semana (auto)' : 'Day of Week (auto)'}</Label><Input value={serviceData.day_of_week} disabled className="bg-gray-50" /></div>
            <div className="space-y-2"><Label>{language === 'es' ? 'Hora *' : 'Time *'}</Label><TimePicker value={serviceData.time} onChange={(val) => setServiceData(prev => ({ ...prev, time: val }))} placeholder={language === 'es' ? 'Seleccionar hora' : 'Select time'} required /></div>
            <div className="space-y-2"><Label>{t('common.location')}</Label><Input value={serviceData.location} onChange={(e) => setServiceData(prev => ({ ...prev, location: e.target.value }))} placeholder={language === 'es' ? 'Santuario principal' : 'Main sanctuary'} /></div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'es' ? 'Descripción' : 'Description'}</Label>
            <Textarea value={serviceData.description} onChange={(e) => setServiceData(prev => ({ ...prev, description: e.target.value }))} rows={2} placeholder={language === 'es' ? 'Descripción breve del servicio...' : 'Brief service description...'} />
          </div>
        </CardContent>
      </Card>

      {/* Service Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl text-gray-900 uppercase">{language === 'es' ? 'Programa del Servicio' : 'Service Program'}</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="bg-blue-50">{timeCalc.total} min {language === 'es' ? 'total' : 'total'}</Badge>
              <span className="text-sm text-gray-600">{language === 'es' ? 'Inicia' : 'Starts'}: {formatTimeToEST(serviceData.time)} | {language === 'es' ? 'Termina' : 'Ends'}: {timeCalc.endTime}</span>
            </div>
          </div>
          <Button onClick={addSegment} style={tealStyle} className="print:hidden"><Plus className="w-4 h-4 mr-2" />{language === 'es' ? 'Añadir Segmento' : 'Add Segment'}</Button>
        </div>

        <AnimatePresence>
          <div className="space-y-3">
            {serviceData.segments.map((segment, idx) => {
              const segmentId = segment._uiId || `seg-${idx}`;
              return (
                <AnimatedSortableItem key={segmentId} id={segmentId} isHighlighted={highlightedSegmentId === segmentId}>
                  <SegmentTimelineCard
                    segment={segment}
                    idx={idx}
                    isExpanded={expandedSegments[idx]}
                    totalSegments={serviceData.segments.length}
                    updateSegmentField={updateSegmentField}
                    toggleSegmentExpanded={toggleSegmentExpanded}
                    moveSegmentUp={moveSegmentUp}
                    moveSegmentDown={moveSegmentDown}
                    removeSegment={setSegmentToDelete}
                    handleOpenVerseParser={handleOpenVerseParser}
                    generateUiId={generateUiId}
                  />
                </AnimatedSortableItem>
              );
            })}
          </div>
        </AnimatePresence>

        {serviceData.segments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>{language === 'es' ? 'No hay segmentos añadidos. Haz clic en "Añadir Segmento" para comenzar.' : 'No segments added. Click "Add Segment" to begin.'}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Announcements */}
      <AnnouncementListSelector
        selectedAnnouncementIds={serviceData.selected_announcements}
        onSelectionChange={(newSelection) => setServiceData(prev => ({ ...prev, selected_announcements: newSelection }))}
        serviceDate={serviceData.date}
      />

      {/* Team Section */}
      <Card className="print:hidden">
        <CardHeader><CardTitle>{language === 'es' ? 'Equipo del Servicio' : 'Service Team'}</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>{language === 'es' ? 'Coordinador(a)' : 'Coordinator'}</Label><AutocompleteInput type="presenter" value={serviceData.coordinators?.main || ""} onChange={(e) => setServiceData(prev => ({ ...prev, coordinators: { ...prev.coordinators, main: e.target.value } }))} placeholder={language === 'es' ? 'Nombre del coordinador' : 'Coordinator name'} /></div>
          <div className="space-y-2"><Label>{language === 'es' ? 'Ujieres' : 'Ushers'}</Label><AutocompleteInput type="ujieres" value={serviceData.ujieres?.main || ""} onChange={(e) => setServiceData(prev => ({ ...prev, ujieres: { ...prev.ujieres, main: e.target.value } }))} placeholder={language === 'es' ? 'Nombres de ujieres' : 'Usher names'} /></div>
          <div className="space-y-2"><Label>{language === 'es' ? 'Sonido' : 'Sound'}</Label><AutocompleteInput type="sound" value={serviceData.sound?.main || ""} onChange={(e) => setServiceData(prev => ({ ...prev, sound: { ...prev.sound, main: e.target.value } }))} placeholder={language === 'es' ? 'Equipo de sonido' : 'Sound team'} /></div>
          <div className="space-y-2"><Label>{language === 'es' ? 'Luces/Proyección' : 'Lights/Projection'}</Label><AutocompleteInput type="tech" value={serviceData.luces?.main || ""} onChange={(e) => setServiceData(prev => ({ ...prev, luces: { ...prev.luces, main: e.target.value } }))} placeholder={language === 'es' ? 'Equipo de luces' : 'Lights team'} /></div>
          <div className="space-y-2"><Label>{language === 'es' ? 'Fotografía' : 'Photography'}</Label><AutocompleteInput type="tech" value={serviceData.fotografia?.main || ""} onChange={(e) => setServiceData(prev => ({ ...prev, fotografia: { ...prev.fotografia, main: e.target.value } }))} placeholder={language === 'es' ? 'Equipo de fotografía' : 'Photography team'} /></div>
        </CardContent>
      </Card>
    </div>
  );
}