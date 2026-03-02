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
import { Loader2, ArrowLeft, Download, Eye, Plus } from "lucide-react";
import { toast } from "sonner";

// V2 hooks (shared with Weekly)
import { useWeeklyData } from "@/components/service/v2/hooks/useWeeklyData";
import { useEntityWrite } from "@/components/service/v2/hooks/useEntityWrite";
import { useExternalSync } from "@/components/service/v2/hooks/useExternalSync";
import { useMoveSegment } from "@/components/service/v2/actions/useMoveSegment";
import { useSpecialSegment } from "@/components/service/v2/actions/useSpecialSegment";

// Custom V2 components
import CustomMetadataForm from "@/components/service/custom-v2/CustomMetadataForm";
import CustomSegmentColumn from "@/components/service/custom-v2/CustomSegmentColumn";
import { useCustomServiceInit } from "@/components/service/custom-v2/useCustomServiceInit";
import { getDefaultUiFields, getDefaultSubAssignments } from "@/components/service/custom-v2/DEFAULT_UI_FIELDS";

// Shared components
import AnnouncementListSelector from "@/components/announcements/AnnouncementListSelector";
import SpecialSegmentDialog from "@/components/service/SpecialSegmentDialog";
import TeamSection from "@/components/service/v2/columns/TeamSection";
import VerseParserDialog from "@/components/service/VerseParserDialog";

// PDF
import { generateServiceProgramPDFWithAutoFit } from "@/components/service/generateProgramPDFWithAutoFit";
import { generateAnnouncementsPDF } from "@/components/service/generateAnnouncementsPDF";


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
    sessions, segmentsBySession, childSegments, psdBySession,
    isLoading: dataLoading, queryKey,
  } = useWeeklyData(serviceId);

  // ── Write hook ──
  const {
    writeSegment, writeSession, writePSD, writeSongs,
    dirtyIds, flushAll, flushEntity,
  } = useEntityWrite(queryKey);

  // ── External sync ──
  const { externalChangeAvailable, handleReload } = useExternalSync(serviceId, queryKey);

  // ── Action hooks ──
  const { move: moveSegment } = useMoveSegment(queryKey);
  const { add: addSpecial, remove: removeSpecial } = useSpecialSegment(queryKey);

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

  // ── Dialog state ──
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialDetails, setSpecialDetails] = useState({
    sessionId: '', title: '', duration: 15, insertAfterIdx: -1, presenter: '', translator: '',
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
    });
    setShowSpecialDialog(false);
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

  // ── PDF handlers ──
  const handlePrintProgram = useCallback(async () => {
    if (!existingService) return;
    const toastId = toast.loading(en ? 'Generating PDF...' : 'Generando PDF...');
    try {
      // Build a minimal serviceData shape for the PDF generator
      const pdfServiceData = {
        ...existingService,
        segments: segments.map(seg => ({
          ...seg,
          type: seg.segment_type,
          duration: seg.duration_min,
          songs: [],
          data: seg,
        })),
      };
      const result = await generateServiceProgramPDFWithAutoFit(pdfServiceData);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(result.pdf);
      link.download = `Programa-${existingService.date || 'servicio'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success(en ? 'PDF generated' : 'PDF generado', { id: toastId });
    } catch (err) {
      console.error('[PDF]', err);
      toast.error('Error: ' + err.message, { id: toastId });
    }
  }, [existingService, segments, en]);

  // ── Loading states ──
  if (serviceLoading || (serviceId && dataLoading)) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── No service: prompt to create ──
  if (!serviceId || !existingService) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('CustomServicesManager'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-5xl text-gray-900 uppercase tracking-tight">
              {en ? 'New Custom Service' : 'Nuevo Servicio Personalizado'}
            </h1>
            <p className="text-gray-500 mt-1">
              {en ? 'Create a new custom service with entity-first architecture' : 'Crea un nuevo servicio personalizado con arquitectura entity-first'}
            </p>
          </div>
        </div>
        <Button onClick={handleCreateNew} disabled={creating} style={tealStyle} className="font-semibold">
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          {en ? 'Create Service' : 'Crear Servicio'}
        </Button>
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
            <h1 className="text-5xl text-gray-900 uppercase tracking-tight">
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
              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                V2 Entity-First
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrintProgram} style={tealStyle} className="gap-2 font-semibold" size="sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'Program PDF' : 'PDF Programa'}</span>
          </Button>
          <Button onClick={() => navigate(createPageUrl('PublicProgramView'))} variant="outline" size="sm" className="gap-2">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'Live View' : 'Vista en Vivo'}</span>
          </Button>
        </div>
      </div>

      {/* External change banner */}
      {externalChangeAvailable && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center justify-between print:hidden">
          <span className="text-sm text-blue-800">
            {en ? 'Another admin made changes.' : 'Otro administrador hizo cambios.'}
          </span>
          <Button size="sm" onClick={handleReload} className="bg-blue-600 text-white hover:bg-blue-700">
            {en ? 'Reload' : 'Recargar'}
          </Button>
        </div>
      )}

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
          onWriteSongs={writeSongs}
          onWriteChild={handleWriteChild}
          onWriteSession={writeSession}
          onWritePSD={writePSD}
          onWriteDuration={handleWriteDuration}
          onOpenSpecialDialog={(sess) => {
            setSpecialDetails(prev => ({ ...prev, sessionId: sess.id }));
            setShowSpecialDialog(true);
          }}
          onMove={moveSegment}
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
        <TeamSection session={session} accentColor="teal" onWriteSession={writeSession} />
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