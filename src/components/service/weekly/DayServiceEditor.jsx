/**
 * DayServiceEditor — Core per-day editor for recurring services.
 *
 * Recurring Services Refactor (2026-02-23): Extracted from WeeklyServiceManager.
 * Each day tab renders its own DayServiceEditor with isolated state.
 *
 * Owns:
 *   - Service query (by date + day_of_week + service_type='weekly')
 *   - serviceData local state (isolated per day)
 *   - Blueprint lookup (via schedule's blueprint_id or shared blueprint)
 *   - Slot columns (ServiceSlotColumns)
 *   - useSegmentMutation + useWeeklyServiceHandlers
 *   - Metadata save mutation
 *   - External change subscription
 *   - localStorage backup
 *
 * Does NOT own (parent provides):
 *   - Announcements (shared across days)
 *   - Date picker (shared)
 *   - Print settings dialog (shared, parent-level)
 *
 * Owns per-day dialogs (not shared):
 *   - SpecialSegmentDialog (per-day state)
 *   - VerseParserDialog (per-day state)
 *   - Reset confirmation (per-day state via handlers)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/components/utils/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Loader2, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { safeGetItem, safeSetItem } from "@/components/utils/safeLocalStorage";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { ServiceDataContext, UpdatersContext } from "@/components/service/WeeklyServiceInputs";
import ServiceSlotColumns from "./ServiceSlotColumns";
import EmptyDayPrompt from "./EmptyDayPrompt";
import { useWeeklyServiceHandlers } from "./useWeeklyServiceHandlers";
import { loadWeeklyFromSessions } from "@/components/service/weeklySessionSync";
import { useSegmentMutation } from "./useSegmentMutation";
import useStaleGuard from "@/components/utils/useStaleGuard";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import VerseParserDialog from "@/components/service/VerseParserDialog";

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

export default function DayServiceEditor({
  dayOfWeek,
  date,
  sessions,
  blueprints,
  user,
  // Shared state/callbacks from parent
  selectedAnnouncements,
  fixedAnnouncements,
  dynamicAnnouncements,
  // Print settings (parent owns persistence)
  setPrintSettingsPage1,
  setPrintSettingsPage2,
  printSettingsPage1,
  printSettingsPage2,
  // Announcement mutations (parent owns)
  setEditingAnnouncement,
  setAnnouncementForm,
  setShowAnnouncementDialog,
  setOptimizingAnnouncement,
  editingAnnouncement,
  createAnnouncementMutation,
  updateAnnouncementMutation,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;

  // ── Core state ──
  const [serviceData, setServiceData] = useState(null);
  const [expandedSegments, setExpandedSegments] = useState({});
  const localStateInitializedRef = useRef(false);
  const [externalChangeAvailable, setExternalChangeAvailable] = useState(false);
  const ownSaveInProgressRef = useRef(false);
  const serviceDataRef = useRef(serviceData);
  useEffect(() => { serviceDataRef.current = serviceData; }, [serviceData]);

  // ── Per-day dialog state (owned by this editor, not shared) ──
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserContext, setVerseParserContext] = useState({ timeSlot: null, segmentIdx: null });
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialSegmentDetails, setSpecialSegmentDetails] = useState({
    timeSlot: "", title: "", duration: 15, insertAfterIdx: -1, presenter: "", translator: "",
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Phase 5: Concurrent editing guard
  const { captureBaseline: captureServiceBaseline } = useStaleGuard();

  // ── Entity Separation: per-field mutation hook ──
  const segmentMutation = useSegmentMutation();

  const slotNames = (sessions || []).map(s => s.name);

  // ── Service query: find existing service for this day + date ──
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['dayService', date, dayOfWeek],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date });
      if (!services || services.length === 0) return null;

      // Find weekly service for this specific day
      let candidates = services.filter(s =>
        s.status !== 'blueprint' &&
        s.service_type === 'weekly' &&
        s.day_of_week === dayOfWeek
      );

      // Legacy fallback: services without explicit day_of_week
      if (candidates.length === 0 && dayOfWeek === 'Sunday') {
        candidates = services.filter(s =>
          s.status !== 'blueprint' &&
          !s.service_type &&
          Object.keys(s).some(key => /^\d{1,2}:\d{2}(am|pm)$/i.test(key) && Array.isArray(s[key]) && s[key].length > 0) &&
          (!s.segments || s.segments.length === 0)
        );
      }

      if (candidates.length === 0) return null;
      const service = candidates.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];

      // Entity Lift: try loading from Session/Segment entities
      if (service?.id) {
        try {
          const entityData = await loadWeeklyFromSessions(base44, service.id, effectiveBlueprint);
          const hasSegments = entityData && Object.values(entityData).some(
            val => Array.isArray(val) && val.length > 0
          );
          if (hasSegments) {
            return { ...service, ...entityData, _fromEntities: true };
          }
        } catch (err) {
          console.warn(`[DayServiceEditor:${dayOfWeek}] Entity load failed:`, err.message);
        }
      }

      return service;
    },
    enabled: !!date,
    staleTime: Infinity,
  });

  // ── Metadata save mutation ──
  const saveMetadataMutation = useMutation({
    mutationFn: async ({ serviceId, metadata }) => {
      ownSaveInProgressRef.current = true;
      if (serviceId) {
        return base44.entities.Service.update(serviceId, metadata);
      } else {
        const created = await base44.entities.Service.create(metadata);
        return base44.entities.Service.update(created.id, { status: 'active' });
      }
    },
    onSuccess: (result) => {
      if (result?.updated_date) captureServiceBaseline(result.updated_date);
      queryClient.invalidateQueries({ queryKey: ['dayService', date, dayOfWeek] });
      setTimeout(() => { ownSaveInProgressRef.current = false; }, 3000);
    },
    onError: (error) => {
      ownSaveInProgressRef.current = false;
      toast.error('Error al guardar metadatos: ' + error.message);
    }
  });

  // ── Handlers ──
  const handlers = useWeeklyServiceHandlers({
    serviceData, setServiceData, selectedAnnouncements,
    updateAnnouncementMutation, fixedAnnouncements, dynamicAnnouncements,
    blueprintData: null,
    sessions,
    blueprints,
    setVerseParserOpen, setVerseParserContext, verseParserContext,
    setShowSpecialDialog, setSpecialSegmentDetails, specialSegmentDetails,
    setOptimizingAnnouncement, setPrintSettingsPage1, setPrintSettingsPage2,
    setEditingAnnouncement, setAnnouncementForm, setShowAnnouncementDialog,
    setShowResetConfirm, editingAnnouncement, createAnnouncementMutation,
    slotNames,
    segmentMutation,
  });

  // ── Initialize service data ──
  useEffect(() => { localStateInitializedRef.current = false; }, [date, dayOfWeek]);

  useEffect(() => {
    if (localStateInitializedRef.current) return;
    if (isLoading) return;

    if (existingData) {
      // Merge with blueprint for fields/sub_assignments (same logic as original)
      const mergeSegmentsWithBlueprint = (existingSegments, timeSlot) => {
        const normalizeType = (t) => {
          if (!t) return "";
          const lower = t.toLowerCase();
          if (lower === 'alabanza' || lower === 'worship') return 'worship';
          if (lower === 'bienvenida' || lower === 'welcome') return 'welcome';
          if (lower === 'ofrenda' || lower === 'ofrendas' || lower === 'offering') return 'offering';
          if (lower === 'plenaria' || lower === 'predica' || lower === 'mensaje' || lower === 'message') return 'message';
          return lower;
        };
        return existingSegments.map((savedSeg, idx) => {
          if (savedSeg.fields && savedSeg.fields.length > 0 && savedSeg._entityId) {
            const savedType = normalizeType(savedSeg.type);
            let subAssignments = savedSeg.sub_assignments || [];
            if (subAssignments.length === 0) {
              if (savedType === 'worship') subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
              else if (savedType === 'message') subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
            }
            let songs = savedSeg.songs;
            if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
              songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
            }
            return { ...savedSeg, sub_assignments: subAssignments, songs };
          }
          const savedType = normalizeType(savedSeg.type);
          const sessionDef = sessions?.find(s => s.name === timeSlot);
          const bp = sessionDef?.blueprint_id ? blueprints?.find(b => b.id === sessionDef.blueprint_id) : null;
          let bpSegments = bp?.segments || [];
          
          if (bp && bpSegments.length === 0) {
            const firstKey = Object.keys(bp).find(k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k));
            if (firstKey) bpSegments = bp[firstKey];
          }

          if (bpSegments.length > 0) {
            let blueprintSeg = bpSegments[idx];
            if (!blueprintSeg || normalizeType(blueprintSeg.type) !== savedType) {
              blueprintSeg = bpSegments.find(b => normalizeType(b.type) === savedType);
            }
            if (blueprintSeg) {
              const mergedFields = (savedSeg.fields && savedSeg.fields.length > 0) ? savedSeg.fields : (blueprintSeg.fields || []);
              let subAssignments = savedSeg.sub_assignments || blueprintSeg.sub_assignments || [];
              if (!subAssignments || subAssignments.length === 0) {
                if (savedType === 'worship') subAssignments = [{ label: 'Ministración de Sanidad y Milagros', person_field_name: 'ministry_leader', duration_min: 5 }];
                else if (savedType === 'message') subAssignments = [{ label: 'Cierre', person_field_name: 'cierre_leader', duration_min: 5 }];
              }
              let songs = savedSeg.songs;
              if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
                songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
              }
              return { ...savedSeg, fields: mergedFields, sub_assignments: subAssignments, songs };
            }
          }
          if (!savedSeg.fields || savedSeg.fields.length === 0) {
            let defaultFields = [];
            if (savedType === 'worship') defaultFields = ["leader", "songs", "ministry_leader"];
            else if (savedType === 'welcome') defaultFields = ["presenter"];
            else if (savedType === 'offering') defaultFields = ["presenter", "verse"];
            else if (savedType === 'message') defaultFields = ["preacher", "title", "verse"];
            if (defaultFields.length > 0) {
              let songs = savedSeg.songs;
              if (savedType === 'worship' && (!songs || !Array.isArray(songs) || songs.length === 0)) {
                songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
              }
              return { ...savedSeg, fields: defaultFields, songs };
            }
          }
          return savedSeg;
        });
      };

      const loadedData = { ...existingData };
      const defaultPreNotes = {};
      slotNames.forEach(name => { defaultPreNotes[name] = ""; });
      slotNames.forEach(name => {
        const existingSlotSegments = existingData[name] || [];
        if (existingSlotSegments.length > 0) {
          loadedData[name] = mergeSegmentsWithBlueprint(existingSlotSegments, name);
        } else {
          const sessionDef = sessions?.find(s => s.name === name);
          const bp = sessionDef?.blueprint_id ? blueprints?.find(b => b.id === sessionDef.blueprint_id) : null;
          let bpSegments = bp?.segments || [];
          
          if (bp && bpSegments.length === 0) {
            const firstKey = Object.keys(bp).find(k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k));
            if (firstKey) bpSegments = bp[firstKey];
          }

          loadedData[name] = bpSegments.map(seg => {
            const segmentCopy = {
              type: seg.type, title: seg.title, duration: seg.duration,
              fields: [...(seg.fields || [])], data: {},
              actions: seg.actions ? seg.actions.map(a => ({ ...a })) : [],
              sub_assignments: seg.sub_assignments ? seg.sub_assignments.map(sa => ({ ...sa })) : [],
              requires_translation: seg.requires_translation || false,
              default_translator_source: seg.default_translator_source || "manual"
            };
            if (seg.type === "worship") {
              segmentCopy.songs = [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }];
            }
            return segmentCopy;
          });
        }
      });
      loadedData.pre_service_notes = existingData.pre_service_notes || defaultPreNotes;
      const defaultRecesoNotes = {};
      slotNames.slice(0, -1).forEach(s => { defaultRecesoNotes[s] = ""; });
      loadedData.receso_notes = { ...defaultRecesoNotes, ...(existingData.receso_notes || {}) };
      loadedData.selected_announcements = existingData.selected_announcements || [];
      // Recurring Services Refactor: Ensure day_of_week + date are on serviceData
      // so PDF generator and other consumers can use them
      loadedData.day_of_week = dayOfWeek;
      loadedData.date = date;
      loadedData.id = existingData.id;
      setServiceData(loadedData);
      captureServiceBaseline(existingData.updated_date);
      localStateInitializedRef.current = true;
    } else {
      // No existing service — show empty prompt (don't auto-seed from blueprint)
      // The EmptyDayPrompt component handles creation
      setServiceData(null);
      localStateInitializedRef.current = true;
    }
  }, [existingData, date, dayOfWeek, isLoading, slotNames, sessions, blueprints]);

  // ── External change subscription ──
  useEffect(() => {
    if (!existingData?.id) return;
    const externalDebounce = { timer: null };
    const unsub = base44.entities.Service.subscribe((event) => {
      if (event.id !== existingData.id) return;
      if (ownSaveInProgressRef.current) return;
      if (externalDebounce.timer) clearTimeout(externalDebounce.timer);
      externalDebounce.timer = setTimeout(() => {
        setExternalChangeAvailable(true);
        toast.info('Programa actualizado por otro administrador');
      }, 2000);
    });
    return () => {
      if (externalDebounce.timer) clearTimeout(externalDebounce.timer);
      if (typeof unsub === 'function') unsub();
    };
  }, [existingData?.id]);

  const handleExternalReload = useCallback(() => {
    localStateInitializedRef.current = false;
    setExternalChangeAvailable(false);
    queryClient.invalidateQueries({ queryKey: ['dayService', date, dayOfWeek] });
    toast.info('Recargando programa...');
  }, [date, dayOfWeek, queryClient]);

  // ── localStorage backup ──
  useEffect(() => {
    if (!serviceData || !date) return;
    const timer = setTimeout(() => {
      const backupKey = `service_backup_${dayOfWeek}_${date}`;
      safeSetItem(backupKey, JSON.stringify({ data: serviceData, timestamp: new Date().toISOString() }));
    }, 5000);
    return () => clearTimeout(timer);
  }, [serviceData, date, dayOfWeek]);

  // ── Metadata auto-save ──
  useEffect(() => {
    if (!existingData?.id || !serviceData) return;
    const timer = setTimeout(() => {
      saveMetadataMutation.mutate({
        serviceId: existingData.id,
        metadata: {
          selected_announcements: selectedAnnouncements,
          print_settings_page1: printSettingsPage1,
          print_settings_page2: printSettingsPage2,
          receso_notes: serviceData.receso_notes || {},
          day_of_week: dayOfWeek,
          name: `${dayLabel} - ${date}`,
          status: 'active',
          service_type: 'weekly',
        }
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [selectedAnnouncements, printSettingsPage1, printSettingsPage2, date, dayOfWeek]);

  // ── Segment expand toggle ──
  const toggleSegmentExpanded = (timeSlot, idx) => {
    const key = `${timeSlot}-${idx}`;
    setExpandedSegments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Loading state ──
  if (isLoading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>;

  // ── No service: show create prompt ──
  if (!serviceData) {
    return (
      <EmptyDayPrompt
        dayOfWeek={dayOfWeek}
        date={date}
        slotNames={slotNames}
        blueprintData={null}
        onServiceCreated={() => {
          localStateInitializedRef.current = false;
          queryClient.invalidateQueries({ queryKey: ['dayService', date, dayOfWeek] });
        }}
      />
    );
  }

  // ── Render slot columns ──
  return (
    <ServiceDataContext.Provider value={serviceData}>
      <UpdatersContext.Provider value={{
        updateSegmentField: handlers.updateSegmentField,
        updateTeamField: handlers.updateTeamField,
        setServiceData,
        mutateSegmentField: segmentMutation.mutateSegmentField,
        mutateSongs: segmentMutation.mutateSongs,
        mutateDuration: segmentMutation.mutateDuration,
        mutateTeam: segmentMutation.mutateTeam,
        mutatePreServiceNotes: segmentMutation.mutatePreServiceNotes,
        mutateRecesoNotes: (...args) => {
          ownSaveInProgressRef.current = true;
          segmentMutation.mutateRecesoNotes(...args);
          setTimeout(() => { ownSaveInProgressRef.current = false; }, 3000);
        },
        mutateSubAssignment: segmentMutation.mutateSubAssignment,
      }}>
        <div className="space-y-4">
          {/* External change banner */}
          {externalChangeAvailable && (
            <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800 font-medium">
                  Otro administrador actualizó el programa.
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleExternalReload} className="border-blue-400 text-blue-700 hover:bg-blue-100 ml-4 shrink-0">
                <RefreshCw className="w-3 h-3 mr-1" />
                Recargar
              </Button>
            </div>
          )}

          {/* Service ID badge */}
          {existingData?.id && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-gray-400 font-mono">ID: {existingData.id}</Badge>
              {existingData?.updated_date && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  Actualizado: {new Date(existingData.updated_date).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
              {saveMetadataMutation.isPending && <Badge className="text-xs bg-yellow-500 text-white animate-pulse">Guardando...</Badge>}
            </div>
          )}

          {/* Per-day action bar: PDF download + Live View */}
          <div className="flex gap-2 items-center flex-wrap">
            <Button onClick={handlers.handleDownloadProgramPDF} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} className="font-semibold text-xs px-3 py-1.5">
              <Download className="w-3 h-3 mr-1" />PDF Programa
            </Button>
            <Button onClick={handlers.handleDownloadAnnouncementsPDF} style={{ backgroundColor: '#8DC63F', color: '#ffffff' }} className="font-semibold text-xs px-3 py-1.5">
              <Download className="w-3 h-3 mr-1" />PDF Anuncios
            </Button>
            <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${date}`)} variant="outline" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs px-3 py-1.5">
              <Eye className="w-3 h-3 mr-1" />Live View
            </Button>
          </div>

          {/* Slot columns */}
          <ServiceSlotColumns
            sundaySlotNames={slotNames}
            serviceData={serviceData}
            expandedSegments={expandedSegments}
            toggleSegmentExpanded={toggleSegmentExpanded}
            handlers={handlers}
            setServiceData={setServiceData}
            setSpecialSegmentDetails={setSpecialSegmentDetails}
            setShowSpecialDialog={setShowSpecialDialog}
            canEdit={hasPermission(user, 'edit_services')}
          />

          {/* Per-day dialogs: SpecialSegment, VerseParser, Reset */}
          <SpecialSegmentDialog
            open={showSpecialDialog} onOpenChange={setShowSpecialDialog}
            details={specialSegmentDetails} setDetails={setSpecialSegmentDetails}
            serviceSegments={serviceData?.[specialSegmentDetails?.timeSlot] || []}
            slotHasTranslation={false}
            onAdd={handlers.addSpecialSegment}
            tealStyle={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
          />
          <VerseParserDialog
            open={verseParserOpen}
            onOpenChange={setVerseParserOpen}
            initialText={verseParserContext.initialText || ""}
            onSave={handlers.handleSaveParsedVerses}
            language="es"
          />
        </div>
      </UpdatersContext.Provider>
    </ServiceDataContext.Provider>
  );
}