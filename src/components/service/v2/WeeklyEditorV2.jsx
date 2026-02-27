/**
 * WeeklyEditorV2.jsx — V2 day-level weekly service editor.
 * DECISION-003: Entity-first, zero intermediate JSON.
 *
 * Replaces DayServiceEditor entirely. Receives date + dayOfWeek + sessions
 * from WeeklyServiceManager. Loads entities via useWeeklyData.
 * Renders via SlotColumnContainer. Writes via useEntityWrite.
 *
 * NO serviceData blob. NO ServiceDataContext. NO UpdatersContext.
 * NO weeklySessionSync. NO mergeSegmentsWithBlueprint.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/components/utils/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, RotateCcw, ShieldCheck, RefreshCw, Users, Plus, AlertCircle, Download, Tv, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { useWeeklyData } from "./hooks/useWeeklyData";
import { useEntityWrite } from "./hooks/useEntityWrite";
import { useExternalSync } from "./hooks/useExternalSync";
import { useResetToBlueprint } from "./actions/useResetToBlueprint";
import { useMoveSegment } from "./actions/useMoveSegment";
import { useSpecialSegment } from "./actions/useSpecialSegment";
import { useCopyBetweenSlots } from "./actions/useCopyBetweenSlots";
import SlotColumnContainer from "./columns/SlotColumnContainer";
import EmptyDayPrompt from "@/components/service/weekly/EmptyDayPrompt";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import { buildPdfData } from "./utils/buildPdfData";
import { generateWeeklyProgramPDF } from "@/components/service/generateWeeklyProgramPDF";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

export default function WeeklyEditorV2({
  dayOfWeek,
  date,
  sessions: sessionDefs,
  blueprints,
  user,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Find existing service for this day + date ──
  const { data: existingService, isLoading: serviceLoading } = useQuery({
    queryKey: ['dayServiceV2', date, dayOfWeek],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date });
      const match = services?.find(s =>
        s.status !== 'blueprint' &&
        s.service_type === 'weekly' &&
        s.day_of_week === dayOfWeek
      );
      return match || null;
    },
    enabled: !!date,
  });

  const serviceId = existingService?.id;

  // ── Load entities via V2 hook (NO transformation) ──
  const {
    sessions, segmentsBySession, childSegments, psdBySession,
    isLoading: dataLoading, queryKey
  } = useWeeklyData(serviceId);

  // ── Write hook (single write path, coalesced + retry) ──
  const {
    writeSegment, writeSession, writePSD, writeSongs,
    dirtyIds, flushAll, flushEntity
  } = useEntityWrite(queryKey);

  // ── External sync (watches Service + Segment + Session) ──
  const { externalChangeAvailable, handleReload, markOwnWrite } = useExternalSync(serviceId, queryKey);

  // ── Flush before navigating away ──
  useEffect(() => {
    return () => {
      // Component unmounting — flush any pending writes
      flushAll().catch(() => {});
    };
  }, [flushAll]);

  // ── Action hooks ──
  const { execute: executeReset } = useResetToBlueprint(queryKey);
  const { move: moveSegment } = useMoveSegment(queryKey);
  const { add: addSpecial, remove: removeSpecial } = useSpecialSegment(queryKey);
  const { copySegmentContent, copyAllToSlot } = useCopyBetweenSlots(
    segmentsBySession, sessions, psdBySession,
    writeSegment, writeSession, writePSD, writeSongs, childSegments
  );

  // ── Sub-assignment child write handler ──
  // BUGFIX (2026-02-26): Previously, parent_segment_id was not being passed,
  // causing child Ministración segments to be created as top-level segments.
  // useWeeklyData then treated them as parent segments with empty ui_fields,
  // showing amber "unconfigured" warnings. Now parentId is properly threaded
  // from SubAssignmentRow through subConfig.
  const handleWriteChild = useCallback((childId, columnOrConfig, value, sessionId, svcId) => {
    if (childId) {
      // Existing child — update
      writeSegment(childId, 'presenter', value);
    } else if (value?.trim() && sessionId && columnOrConfig?.parentId) {
      // No child entity yet — create one
      // Guard: require parentId to prevent creating orphaned top-level segments
      base44.entities.Segment.create({
        session_id: sessionId,
        service_id: svcId,
        parent_segment_id: columnOrConfig.parentId,
        order: 1,
        title: columnOrConfig?.label || 'Sub-asignación',
        segment_type: 'Ministración',
        duration_min: columnOrConfig?.duration_min || 5,
        presenter: value.trim(),
        show_in_general: false,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey });
      }).catch(err => console.error('[V2] Child create failed:', err.message));
    } else if (!columnOrConfig?.parentId && !childId) {
      // Safety: log if parentId is missing — do NOT create an orphan segment
      console.warn('[V2] handleWriteChild blocked: no parentId for sub-assignment create', {
        label: columnOrConfig?.label, sessionId, value
      });
    }
  }, [writeSegment, queryClient, queryKey]);

  // ── Duration write ──
  const handleWriteDuration = useCallback((segmentId, value) => {
    writeSegment(segmentId, 'duration_min', value);
  }, [writeSegment]);

  // ── Metadata auto-save (announcements, receso, print settings stored on Service) ──
  // This is minimal — V2 only needs to save receso_notes on the Service entity.
  // Announcements and print settings are managed by parent (WeeklyServiceManager).

  // ── Blueprint resolution ──
  // BUGFIX (2026-02-26): Previously returned only the FIRST blueprint found,
  // so the 11:30am session would get reset with the 9:30am blueprint.
  // Now we resolve per-session blueprints keyed by session name.
  const blueprintsBySessionName = useMemo(() => {
    const map = {};
    for (const sess of (sessionDefs || [])) {
      if (sess.blueprint_id && blueprints?.length) {
        const found = blueprints.find(b => b.id === sess.blueprint_id);
        if (found) map[sess.name] = found;
      }
    }
    return map;
  }, [sessionDefs, blueprints]);

  // Legacy compat: resolvedBlueprint = first found (for UI checks like "has any blueprint")
  const resolvedBlueprint = useMemo(() => {
    const first = Object.values(blueprintsBySessionName)[0];
    return first || null;
  }, [blueprintsBySessionName]);

  // ── Dialog state ──
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetTargetSessionId, setResetTargetSessionId] = useState(null); // null = all, string = single session
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialDetails, setSpecialDetails] = useState({ sessionId: '', title: '', duration: 15, insertAfterIdx: -1, presenter: '', translator: '' });
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserSegmentId, setVerseParserSegmentId] = useState(null);

  const slotNames = useMemo(() => sessions.map(s => s.name), [sessions]);

  // ── PDF download handlers ──
  const handleDownloadProgramPDF = useCallback(async () => {
    const toastId = toast.loading('Generando PDF del Programa...');
    try {
      const pdfData = buildPdfData({
        existingService,
        sessions,
        segmentsBySession,
        childSegments,
        psdBySession,
      });
      if (!pdfData) { toast.error('No hay datos para generar PDF', { id: toastId }); return; }
      const pdf = await generateWeeklyProgramPDF(pdfData);
      pdf.download(`Programa-${existingService.day_of_week || 'Servicio'}-${date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  }, [existingService, sessions, segmentsBySession, childSegments, psdBySession, date]);

  const handleDownloadAnnouncementsPDF = useCallback(async () => {
    const toastId = toast.loading('Generando PDF de Anuncios...');
    try {
      // We need announcements data - fetch fresh
      const [allAnns, events] = await Promise.all([
        base44.entities.AnnouncementItem.list('priority'),
        base44.entities.Event.list(),
      ]);

      const selDate = new Date(date + 'T00:00:00');
      const fixed = allAnns.filter(a => a.category === 'General' && a.is_active);
      const dynamic = [
        ...allAnns.filter(a => {
          if (a.category === 'General' || !a.is_active) return false;
          if (!a.date_of_occurrence) return false;
          return new Date(a.date_of_occurrence + 'T00:00:00') >= selDate;
        }),
        ...events.filter(e => {
          if (!e.promote_in_announcements || !e.start_date) return false;
          return new Date(e.start_date + 'T00:00:00') >= selDate;
        }).map(e => ({ ...e, isEvent: true }))
      ];

      const allForPrint = [...fixed, ...dynamic];
      if (allForPrint.length === 0) { toast.error('No hay anuncios', { id: toastId }); return; }

      const pdfData = buildPdfData({
        existingService,
        sessions,
        segmentsBySession,
        childSegments,
        psdBySession,
      });

      const pdf = await generateAnnouncementsPDF(allForPrint, pdfData || { date });
      pdf.download(`Anuncios-${existingService?.day_of_week || 'Servicio'}-${date}.pdf`);
      toast.success('PDF descargado', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error generando PDF: ' + error.message, { id: toastId });
    }
  }, [existingService, sessions, segmentsBySession, childSegments, psdBySession, date]);

  // ── Verse parser handler ──
  const handleOpenVerseParser = useCallback((segmentId) => {
    setVerseParserSegmentId(segmentId);
    // Find segment to get initial text
    setVerseParserOpen(true);
  }, []);

  // Find the segment for verse parser initial text
  const verseParserInitialText = useMemo(() => {
    if (!verseParserSegmentId) return '';
    for (const sessionId in segmentsBySession) {
      const seg = (segmentsBySession[sessionId] || []).find(s => s.id === verseParserSegmentId);
      if (seg) return seg.scripture_references || '';
    }
    return '';
  }, [verseParserSegmentId, segmentsBySession]);

  // ── Loading ──
  if (serviceLoading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>;

  // ── No service: create prompt ──
  if (!existingService) {
    return (
      <EmptyDayPrompt
        dayOfWeek={dayOfWeek}
        date={date}
        slotNames={(sessionDefs || []).map(s => s.name)}
        blueprintData={resolvedBlueprint}
        onServiceCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['dayServiceV2', date, dayOfWeek] });
        }}
      />
    );
  }

  if (dataLoading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>;

  // ── Data error ──
  if (!dataLoading && sessions.length === 0 && serviceId) {
    return (
      <div className="p-6 bg-amber-50 border-2 border-amber-300 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-800 font-medium">
            No se encontraron sesiones para este servicio.
          </p>
        </div>
        <p className="text-xs text-amber-700">
          El servicio existe (ID: {serviceId}) pero no tiene sesiones.
          Restablezca desde el blueprint para recrear la estructura.
        </p>
        {resolvedBlueprint && (
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => {
              // Create sessions + segments from blueprint directly
              toast.info("Use el botón de Restablecer después de crear sesiones manualmente, o contacte un administrador.");
            }}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reparar Estructura
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* External change banner */}
      {externalChangeAvailable && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800 font-medium">Otro administrador actualizó el programa.</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReload} className="border-blue-400 text-blue-700 hover:bg-blue-100 ml-4 shrink-0">
            <RefreshCw className="w-3 h-3 mr-1" />Recargar
          </Button>
        </div>
      )}

      {/* Service meta */}
      {existingService?.updated_date && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
            {new Date(existingService.updated_date).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-1.5 items-center flex-wrap">
        <Button onClick={handleDownloadProgramPDF} style={{ backgroundColor: '#1F8A70', color: '#ffffff' }} size="sm" className="font-semibold text-xs h-8 px-2" title="Descargar Programa">
          <Download className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Prog.</span>
        </Button>
        <Button onClick={handleDownloadAnnouncementsPDF} style={{ backgroundColor: '#8DC63F', color: '#ffffff' }} size="sm" className="font-semibold text-xs h-8 px-2" title="Descargar Anuncios">
          <Download className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Anun.</span>
        </Button>
        <Button onClick={() => navigate(createPageUrl('PublicCountdownDisplay') + `?date=${date}`)} variant="outline" size="sm" className="border-purple-400 text-purple-700 hover:bg-purple-600 hover:text-white border-2 font-semibold text-xs h-8 px-2" title="TV Display">
          <Tv className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">TV</span>
        </Button>
        <Button onClick={() => navigate(createPageUrl('MyProgram') + `?date=${date}`)} variant="outline" size="sm" className="border-blue-400 text-blue-700 hover:bg-blue-600 hover:text-white border-2 font-semibold text-xs h-8 px-2" title="Mi Programa">
          <UserCircle className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Mi Prog.</span>
        </Button>
        {resolvedBlueprint && (
          <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} className="border-amber-400 text-amber-700 hover:bg-amber-50 border font-semibold text-xs h-8 px-2" title="Restablecer estructura predeterminada">
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        <div title="V2 Entity-Direct Editor" className="flex items-center justify-center w-8 h-8 rounded bg-green-50 border border-green-200">
          <ShieldCheck className="w-4 h-4 text-green-600" />
        </div>
        <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">V2</Badge>
      </div>

      {/* Reset confirm — supports per-session or all-sessions */}
      {showResetConfirm && resolvedBlueprint && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">¿Restablecer estructura predeterminada?</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {resetTargetSessionId
                ? `Solo "${sessions.find(s => s.id === resetTargetSessionId)?.name}" será restablecido. El contenido ingresado en esa sesión se borrará.`
                : 'TODAS las sesiones serán restablecidas. Todo el contenido ingresado se borrará.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Per-session buttons */}
            {sessions.map(s => (
              <Button key={s.id} size="sm" variant={resetTargetSessionId === s.id ? "default" : "outline"}
                className={`text-xs h-7 px-3 ${resetTargetSessionId === s.id ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-amber-400 text-amber-700 hover:bg-amber-100'}`}
                onClick={() => setResetTargetSessionId(resetTargetSessionId === s.id ? null : s.id)}
              >
                {s.name?.replace('am', ' a.m.').replace('pm', ' p.m.')}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-7 px-3"
              onClick={() => {
                const targetSessions = resetTargetSessionId
                  ? sessions.filter(s => s.id === resetTargetSessionId)
                  : sessions;
                setShowResetConfirm(false);
                setResetTargetSessionId(null);
                // BUGFIX (2026-02-26): Use per-session blueprints so each session
                // gets its own blueprint (e.g. 9:30am vs 11:30am have different
                // requires_translation settings).
                executeReset({
                  sessions: targetSessions,
                  blueprintsBySessionName,
                  // Legacy fallback: single blueprint segments for sessions without dedicated blueprint
                  blueprintSegments: resolvedBlueprint?.segments || [],
                  serviceId,
                });
              }}
            >
              {resetTargetSessionId ? 'Restablecer Sesión' : 'Restablecer Todo'}
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => { setShowResetConfirm(false); setResetTargetSessionId(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Slot columns — entity-direct rendering */}
      <SlotColumnContainer
        sessions={sessions}
        segmentsBySession={segmentsBySession}
        childSegments={childSegments}
        psdBySession={psdBySession}
        columnProps={{
          serviceId,
          recesoNotes: existingService?.receso_notes || {},
          canEdit: hasPermission(user, 'edit_services'),
          onWrite: writeSegment,
          onWriteSongs: writeSongs,
          onWriteChild: handleWriteChild,
          onWriteSession: writeSession,
          onWritePSD: writePSD,
          onWriteDuration: handleWriteDuration,
          onOpenVerseParser: handleOpenVerseParser,
          onOpenSpecialDialog: (session) => {
            setSpecialDetails(prev => ({ ...prev, sessionId: session.id }));
            setShowSpecialDialog(true);
          },
          onMove: moveSegment,
          onRemove: (sessionId, idx, segmentId) => removeSpecial(sessionId, idx, segmentId),
          onCopyToNext: copySegmentContent,
          onCopyAllToSlot: copyAllToSlot,
          onResetSession: resolvedBlueprint ? (sessionId) => {
            setResetTargetSessionId(sessionId);
            setShowResetConfirm(true);
          } : null,
          dirtyIds,
          onFlushEntity: flushEntity,
          markOwnWrite,
        }}
      />

      {/* Special Segment Dialog */}
      <SpecialSegmentDialog
        open={showSpecialDialog}
        onOpenChange={setShowSpecialDialog}
        details={specialDetails}
        setDetails={setSpecialDetails}
        serviceSegments={(segmentsBySession[specialDetails.sessionId] || []).map(s => ({
          ...s, type: s.segment_type, // V2→V1 adapter: SpecialSegmentDialog filters by .type
        }))}
        slotHasTranslation={false}
        onAdd={() => {
          addSpecial({
            sessionId: specialDetails.sessionId,
            serviceId,
            title: specialDetails.title,
            duration: specialDetails.duration,
            presenter: specialDetails.presenter,
            translator: specialDetails.translator,
            insertAfterIdx: specialDetails.insertAfterIdx,
          });
          setShowSpecialDialog(false);
        }}
        tealStyle={{ backgroundColor: '#1F8A70', color: '#ffffff' }}
      />

      {/* Verse Parser Dialog */}
      <VerseParserDialog
        open={verseParserOpen}
        onOpenChange={(open) => {
          setVerseParserOpen(open);
          if (!open) setVerseParserSegmentId(null);
        }}
        initialText={verseParserInitialText}
        onSave={(result) => {
          if (verseParserSegmentId && result) {
            // Write parsed verse string back to entity
            if (result.verse) writeSegment(verseParserSegmentId, 'scripture_references', result.verse);
            if (result.parsed_data) writeSegment(verseParserSegmentId, 'parsed_verse_data', result.parsed_data);
          }
          setVerseParserOpen(false);
          setVerseParserSegmentId(null);
        }}
        language="es"
      />
    </div>
  );
}