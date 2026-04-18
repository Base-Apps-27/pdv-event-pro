/**
 * CustomEditorV2.jsx — Entity-first custom service editor.
 *
 * DECISION (2026-03-02): Custom V2 Architecture.
 * Reuses 100% of Weekly V2 entity hooks:
 *   - useWeeklyData (loads Session/Segment/PSD entities by service_id)
 *   - useEntityWrite (debounced, coalesced, retry-aware entity writes)
 *   - SegmentCard + FieldRenderer + SegmentNotesPanel (shared rendering)
 *   - useMoveSegment, useSpecialSegment (entity CRUD for segments)
 *
 * NOT included (weekly-only):
 *   - useCopyBetweenSlots (single session)
 *   - useResetToBlueprint (no blueprints for custom)
 *   - SlotColumnContainer (single column, no tabs)
 *   - Receso injection (no inter-session breaks)
 *
 * CUSTOM-SPECIFIC:
 *   - CustomMetadataForm (service name, date, time, location)
 *   - CustomSegmentColumn (single-column segment list)
 *   - DEFAULT_UI_FIELDS (type-based field defaults instead of blueprint)
 *   - useCustomServiceInit (creates service + session + segments)
 *   - AnnouncementListSelector (shared with old Custom)
 *   - Announcements PDF + Program PDF generation
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasPermission } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Printer, Eye, Plus, FileText } from "lucide-react";
import { toast } from "sonner";

// V2 hooks (shared with Weekly)
import { useWeeklyData } from "@/components/service/v2/hooks/useWeeklyData";
import { useEntityWrite } from "@/components/service/v2/hooks/useEntityWrite";
// 2026-03-03: useExternalSync removed for consistency with WeeklyEditorV2.
// Real-time entity subscriptions + React Query already push external changes.
import { useMoveSegment } from "@/components/service/v2/actions/useMoveSegment";
import { useSpecialSegment } from "@/components/service/v2/actions/useSpecialSegment";
import { useStructuralLock } from "@/components/service/v2/hooks/useStructuralLock";

// Custom V2 components
import CustomMetadataForm from "@/components/service/custom-v2/CustomMetadataForm";
import CustomSegmentColumn from "@/components/service/custom-v2/CustomSegmentColumn";
import { useCustomServiceInit } from "@/components/service/custom-v2/useCustomServiceInit";
// getDefaultUiFields/getDefaultSubAssignments used internally by useCustomServiceInit — not needed here

// Shared components
import AnnouncementListSelector from "@/components/announcements/AnnouncementListSelector";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import TeamSection from "@/components/service/v2/columns/TeamSection";
import VerseParserDialog from "@/components/service/VerseParserDialog";

// PDF
import { generateServiceProgramPDFWithAutoFit } from "@/components/service/generateProgramPDFWithAutoFit";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";
import { getNormalizedSongs } from "@/components/utils/segmentDataUtils";


export default function CustomEditorV2() {
  const { user } = useCurrentUser();
  const { t, language } = useLanguage();
  const en = language === 'en';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceId = searchParams.get('id');

  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };

  // ── Load existing service ──
  const { data: existingService, isLoading: serviceLoading } = useQuery({
    queryKey: ['customServiceV2', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const results = await base44.entities.Service.filter({ id: serviceId });
      return results[0] || null;
    },
    enabled: !!serviceId,
    staleTime: 30_000,
  });

  // ── Load entities via V2 hook ──
  const {
    sessions, segmentsBySession, childSegments, psdBySession, songsBySegment,
    isLoading: dataLoading, queryKey,
  } = useWeeklyData(serviceId);

  // ── Write hook — 2026-04-15: writeSongs removed, songs use SegmentSong entity ──
  const {
    writeSegment, writeSession, writePSD,
    dirtyIds, flushAll, flushEntity,
  } = useEntityWrite(queryKey);

  // 2026-03-03: External sync removed — real-time entity subscriptions handle freshness
  // (consistent with WeeklyEditorV2 which removed useExternalSync on 2026-03-02).

  // ── Structural lock — serializes reorder, add, remove to prevent races ──
  // 2026-04-15: Same pattern as WeeklyEditorV2
  const { withLock, isBusy: structuralBusy } = useStructuralLock();

  // ── Action hooks ──
  const { move: moveSegment } = useMoveSegment(queryKey, sessions, withLock);
  const { add: addSpecial, remove: removeSpecial } = useSpecialSegment(queryKey, sessions, withLock);

  // ── Service init (for new services) ──
  const { createService, creating } = useCustomServiceInit();

  // ── Flush on unmount ──
  useEffect(() => {
    return () => { flushAll().catch(() => {}); };
  }, [flushAll]);

  // ── Derive single session ──
  const session = sessions[0] || null;
  const segments = session ? (segmentsBySession[session.id] || []) : [];
  const psd = session ? (psdBySession[session.id] || null) : null;

  // 2026-03-25: Auto-create state replaced with explicit user action.
  // DECISION: Removed auto-create useEffect that spawned services on page load,
  // which caused duplicate/orphan services when page was refreshed or double-navigated.
  // Now shows a create prompt that requires explicit user click.
  const [showCreatePrompt, setShowCreatePrompt] = useState(!serviceId);

  // ── Dialog state ──
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  // 2026-03-06: Added requires_translation + translation_mode + default_translator_source to special segment dialog state
  const [specialDetails, setSpecialDetails] = useState({
    sessionId: '', title: '', duration: 15, insertAfterIdx: -1, presenter: '', translator: '',
    requires_translation: false, translation_mode: 'InPerson', default_translator_source: 'manual',
  });
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserSegmentId, setVerseParserSegmentId] = useState(null);

  // ── Announcements state ──
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
  useEffect(() => {
    if (existingService?.selected_announcements) {
      setSelectedAnnouncements(existingService.selected_announcements);
    }
  }, [existingService?.id]);

  const handleAnnouncementsChange = useCallback((newSelection) => {
    setSelectedAnnouncements(newSelection);
    if (serviceId) {
      base44.entities.Service.update(serviceId, { selected_announcements: newSelection }).catch(err =>
        console.error('[CustomV2] Announcement save failed:', err.message)
      );
    }
  }, [serviceId]);

  // ── Verse parser ──
  const handleOpenVerseParser = useCallback((segmentId) => {
    setVerseParserSegmentId(segmentId);
    setVerseParserOpen(true);
  }, []);

  const verseParserInitialText = useMemo(() => {
    if (!verseParserSegmentId || !session) return '';
    const seg = segments.find(s => s.id === verseParserSegmentId);
    return seg?.scripture_references || '';
  }, [verseParserSegmentId, segments, session]);

  // ── Child write handler (sub-assignments) ──
  const handleWriteChild = useCallback((childId, columnOrConfig, value, sessionId, svcId) => {
    if (childId) {
      writeSegment(childId, 'presenter', value);
    } else if (value?.trim() && sessionId && columnOrConfig?.parentId) {
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
      }).catch(err => console.error('[CustomV2] Child create failed:', err.message));
    }
  }, [writeSegment, queryClient, queryKey]);

  // ── Duration write ──
  const handleWriteDuration = useCallback((segmentId, value) => {
    writeSegment(segmentId, 'duration_min', value);
  }, [writeSegment]);

  // ── Add segment override: uses DEFAULT_UI_FIELDS ──
  const handleAddSpecial = useCallback(() => {
    if (!session) return;
    const segmentType = 'Especial';
    addSpecial({
      sessionId: session.id,
      serviceId,
      title: specialDetails.title || 'Especial',
      duration: specialDetails.duration || 15,
      presenter: specialDetails.presenter || '',
      translator: specialDetails.translator || '',
      insertAfterIdx: specialDetails.insertAfterIdx,
      segmentType,
      // 2026-03-06: Thread translation fields
      requires_translation: specialDetails.requires_translation,
      translation_mode: specialDetails.translation_mode,
      default_translator_source: specialDetails.default_translator_source,
    });
    setShowSpecialDialog(false);
    setSpecialDetails({ sessionId: '', title: '', duration: 15, insertAfterIdx: -1, presenter: '', translator: '', requires_translation: false, translation_mode: 'InPerson', default_translator_source: 'manual' });
  }, [session, serviceId, specialDetails, addSpecial]);

  // ── New service creation ──
  const handleCreateNew = useCallback(async () => {
    const newId = await createService({
      name: en ? 'New Custom Service' : 'Nuevo Servicio Personalizado',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
    });
    if (newId) {
      setSearchParams({ id: newId });
    }
  }, [createService, en, setSearchParams]);

  // ── Service metadata update callback ──
  const handleServiceUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customServiceV2', serviceId] });
  }, [queryClient, serviceId]);

  // ── PDF handlers (2026-03-03: changed from download to print for consistency with Weekly V2) ──
  const handlePrintProgram = useCallback(async () => {
    if (!existingService) return;
    const toastId = toast.loading(en ? 'Generating PDF...' : 'Generando PDF del Programa...');
    try {
      // 2026-04-18: Fixed songs + data bridge for custom service PDF.
      // Previously hardcoded songs: [] — now uses getNormalizedSongs with SegmentSong entities.
      // data object now properly maps fields for the PDF renderer (leader, preacher, presenter, notes).
      const pdfServiceData = {
        ...existingService,
        segments: segments.map(seg => {
          // Attach _songs from songsBySegment so getNormalizedSongs can find SegmentSong entities
          const enrichedSeg = songsBySegment?.[seg.id]?.length > 0
            ? { ...seg, _songs: songsBySegment[seg.id] }
            : seg;
          const songs = getNormalizedSongs(enrichedSeg);
          return {
            ...seg,
            type: seg.segment_type,
            duration: seg.duration_min,
            songs,
            data: {
              ...seg,
              leader: seg.presenter || '',
              preacher: seg.presenter || '',
              presenter: seg.presenter || '',
              translator: seg.translator_name || '',
              songs,
            },
          };
        }),
      };
      const result = await generateServiceProgramPDFWithAutoFit(pdfServiceData);
      // result.pdf is a Blob — need pdfmake doc for .print(). Rebuild doc for print.
      // Simpler: open blob in new tab for printing
      const url = URL.createObjectURL(result.pdf);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          // Cleanup after a delay to allow print dialog
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        };
      }
      toast.success(en ? 'PDF ready to print' : 'PDF listo para imprimir', { id: toastId });
    } catch (err) {
      console.error('[PDF]', err);
      toast.error('Error: ' + err.message, { id: toastId });
    }
  }, [existingService, segments, songsBySegment, en]);

  // ── Announcements PDF handler (Phase 2) ──
  const handlePrintAnnouncements = useCallback(async () => {
    if (!selectedAnnouncements.length) {
      toast.error(en ? 'Please select at least one announcement.' : 'Por favor, selecciona al menos un anuncio.');
      return;
    }
    const toastId = toast.loading(en ? 'Generating Announcements PDF...' : 'Generando PDF de Anuncios...');
    try {
      const [allAnns, events] = await Promise.all([
        base44.entities.AnnouncementItem.list('priority'),
        base44.entities.Event.list(),
      ]);
      const selDate = existingService?.date ? new Date(existingService.date + 'T00:00:00') : new Date();
      const fixed = allAnns.filter(a => a.category === 'General' && a.is_active && selectedAnnouncements.includes(a.id));
      const dynamic = [
        ...allAnns.filter(a => {
          if (a.category === 'General' || !a.is_active) return false;
          if (!selectedAnnouncements.includes(a.id)) return false;
          return true;
        }),
        ...events.filter(e => {
          if (!e.promote_in_announcements || !e.start_date) return false;
          return new Date(e.start_date + 'T00:00:00') >= selDate;
        }).map(e => ({ ...e, isEvent: true }))
      ];
      const allForPrint = [...fixed, ...dynamic];
      if (allForPrint.length === 0) {
        toast.error(en ? 'No announcements to print' : 'No hay anuncios para imprimir', { id: toastId });
        return;
      }
      const pdf = await generateAnnouncementsPDF(allForPrint, existingService || { date: new Date().toISOString().split('T')[0] });
      pdf.print();
      toast.success(en ? 'PDF ready to print' : 'PDF listo para imprimir', { id: toastId });
    } catch (err) {
      console.error('[Announcements PDF]', err);
      toast.error('Error: ' + err.message, { id: toastId });
    }
  }, [selectedAnnouncements, existingService, en]);

  // 2026-03-25: Auto-create useEffect REMOVED.
  // Previous behavior (2026-03-03) triggered handleCreateNew() on mount when no ?id= param,
  // which caused phantom services on refresh, double-navigation, or accidental page visit.
  // Replaced with explicit "Create Service" prompt below (showCreatePrompt state).

  // ── Loading states ──
  if (serviceLoading || (serviceId && dataLoading)) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // 2026-03-25: Explicit creation prompt instead of auto-create
  if (!serviceId || !existingService) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center gap-6 min-h-[50vh]">
        {creating ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-gray-500 text-sm">
              {en ? 'Creating service...' : 'Creando servicio...'}
            </p>
          </>
        ) : (
          <>
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h2 className="text-2xl text-gray-900 uppercase">
                {en ? 'New Special Service' : 'Nuevo Servicio Especial'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {en ? 'This will create a service with default segments' : 'Se creará un servicio con segmentos predeterminados'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(createPageUrl('CustomServicesManager'))}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {en ? 'Back' : 'Volver'}
              </Button>
              <Button onClick={handleCreateNew} style={{ backgroundColor: '#1F8A70', color: '#fff' }} className="font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                {en ? 'Create Service' : 'Crear Servicio'}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={async () => {
            await flushAll();
            navigate(createPageUrl('CustomServicesManager'));
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-5xl text-gray-900 uppercase tracking-tight">
              {existingService.name || (en ? 'Edit Service' : 'Editar Servicio')}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {existingService.updated_date && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  {en ? 'Last updated' : 'Última actualización'}: {new Date(existingService.updated_date).toLocaleString(
                    en ? 'en-US' : 'es-ES',
                    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }
                  )}
                </Badge>
              )}
              {dirtyIds.size > 0 && (
                <Badge className="text-xs bg-yellow-500 text-white animate-pulse">
                  {en ? 'Saving...' : 'Guardando...'}
                </Badge>
              )}
              {/* 2026-03-03: Removed "V2 Entity-First" badge — developer artifact, not user-facing */}
            </div>
          </div>
        </div>
        {/* Action bar — matches Weekly V2 compact style */}
        <div className="flex gap-1.5 items-center flex-wrap">
          <Button onClick={handlePrintProgram} style={tealStyle} size="sm" className="font-semibold text-xs h-8 px-2" title={en ? 'Print Program' : 'Imprimir Programa'}>
            <Printer className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">{en ? 'Program' : 'Prog.'}</span>
          </Button>
          <Button onClick={handlePrintAnnouncements} style={{ backgroundColor: '#8DC63F', color: '#ffffff' }} size="sm" className="font-semibold text-xs h-8 px-2"
            disabled={!selectedAnnouncements.length}
            title={en ? 'Print Announcements' : 'Imprimir Anuncios'}
          >
            <Printer className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">{en ? 'Announce.' : 'Anun.'}</span>
          </Button>
          <Button onClick={() => navigate(createPageUrl('PublicProgramView'))} variant="outline" size="sm" className="text-xs h-8 px-2" title={en ? 'Live View' : 'Vista en Vivo'}>
            <Eye className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">{en ? 'Live' : 'Vivo'}</span>
          </Button>
        </div>
      </div>

      {/* 2026-03-03: External change banner removed — real-time subs handle data freshness */}

      {/* Service Metadata */}
      <CustomMetadataForm service={existingService} onServiceUpdated={handleServiceUpdated} />

      {/* Segment Column */}
      {session ? (
        <CustomSegmentColumn
          session={session}
          segments={segments}
          childSegments={childSegments}
          psd={psd}
          serviceId={serviceId}
          serviceTime={existingService.time || '10:00'}
          canEdit={hasPermission(user, 'edit_services')}
          onWrite={writeSegment}
          songsBySegment={songsBySegment}
          onWriteChild={handleWriteChild}
          onWritePSD={writePSD}
          onWriteDuration={handleWriteDuration}
          onOpenSpecialDialog={(sess) => {
            setSpecialDetails(prev => ({ ...prev, sessionId: sess.id }));
            setShowSpecialDialog(true);
          }}
          onMove={moveSegment}
          structuralBusy={structuralBusy}
          onRemove={(sessionId, idx, segmentId) => removeSpecial(sessionId, idx, segmentId)}
          onOpenVerseParser={handleOpenVerseParser}
          dirtyIds={dirtyIds}
          onFlushEntity={flushEntity}
          language={language}
        />
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6 text-center">
          <p className="text-sm text-amber-800">
            {en ? 'No session found. The service structure may be incomplete.' : 'No se encontró sesión. La estructura del servicio puede estar incompleta.'}
          </p>
        </div>
      )}

      {/* Service Team — elevated to page level so it's clearly before Announcements */}
      {session && (
        <TeamSection
          session={session}
          accentColor="teal"
          onWriteSession={writeSession}
          label={en ? 'SERVICE TEAM' : 'EQUIPO DEL SERVICIO'}
        />
      )}

      {/* Announcements */}
      <AnnouncementListSelector
        selectedAnnouncementIds={selectedAnnouncements}
        onSelectionChange={handleAnnouncementsChange}
        serviceDate={existingService.date}
      />

      {/* Special Segment Dialog */}
      <SpecialSegmentDialog
        open={showSpecialDialog}
        onOpenChange={setShowSpecialDialog}
        details={specialDetails}
        setDetails={setSpecialDetails}
        serviceSegments={segments.map(s => ({ ...s, type: s.segment_type }))}
        slotHasTranslation={false}
        onAdd={handleAddSpecial}
        tealStyle={tealStyle}
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
            if (result.verse) writeSegment(verseParserSegmentId, 'scripture_references', result.verse);
            if (result.parsed_data) writeSegment(verseParserSegmentId, 'parsed_verse_data', result.parsed_data);
          }
          setVerseParserOpen(false);
          setVerseParserSegmentId(null);
        }}
        language={language}
      />
    </div>
  );
}