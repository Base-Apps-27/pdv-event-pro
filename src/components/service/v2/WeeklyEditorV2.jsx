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

import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/components/utils/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Eye, RotateCcw, ShieldCheck, RefreshCw, Users, Plus } from "lucide-react";
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

  // ── Write hook (single write path) ──
  const {
    writeSegment, writeSession, writePSD, writeSongs,
    dirtyIds, flushAll, flushEntity
  } = useEntityWrite(queryKey);

  // ── External sync ──
  const { externalChangeAvailable, handleReload, markOwnWrite } = useExternalSync(serviceId, queryKey);

  // ── Action hooks ──
  const { execute: executeReset } = useResetToBlueprint(queryKey);
  const { move: moveSegment } = useMoveSegment(queryKey);
  const { add: addSpecial, remove: removeSpecial } = useSpecialSegment(queryKey);
  const { copySegmentContent, copyAllToSlot } = useCopyBetweenSlots(
    segmentsBySession, sessions, psdBySession,
    writeSegment, writeSession, writePSD, writeSongs
  );

  // ── Sub-assignment child write handler ──
  const handleWriteChild = useCallback((childId, columnOrConfig, value, sessionId, svcId) => {
    if (childId) {
      // Existing child — update
      writeSegment(childId, 'presenter', value);
    } else if (value && sessionId) {
      // No child entity yet — create one
      base44.entities.Segment.create({
        session_id: sessionId,
        service_id: svcId,
        parent_segment_id: columnOrConfig?.parentId, // from subConfig
        order: 1,
        title: columnOrConfig?.label || 'Sub-asignación',
        segment_type: 'Ministración',
        duration_min: columnOrConfig?.duration_min || 5,
        presenter: value,
        show_in_general: false,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey });
      }).catch(err => console.error('[V2] Child create failed:', err.message));
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
  const resolvedBlueprint = useMemo(() => {
    for (const sess of (sessionDefs || [])) {
      if (sess.blueprint_id && blueprints?.length) {
        const found = blueprints.find(b => b.id === sess.blueprint_id);
        if (found) return found;
      }
    }
    return null;
  }, [sessionDefs, blueprints]);

  // ── Dialog state ──
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialDetails, setSpecialDetails] = useState({ sessionId: '', title: '', duration: 15, insertAfterIdx: -1, presenter: '', translator: '' });
  const [verseParserOpen, setVerseParserOpen] = useState(false);

  const slotNames = useMemo(() => sessions.map(s => s.name), [sessions]);

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
        <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${date}`)} variant="outline" size="sm" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs h-8 px-2" title="Live View">
          <Eye className="w-4 h-4" />
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

      {/* Reset confirm */}
      {showResetConfirm && resolvedBlueprint && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">¿Restablecer estructura predeterminada?</p>
            <p className="text-xs text-amber-700 mt-0.5">El contenido ingresado se borrará.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-4 shrink-0">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-7 px-3"
              onClick={() => {
                setShowResetConfirm(false);
                executeReset({
                  sessions,
                  blueprintSegments: resolvedBlueprint.segments || [],
                  serviceId,
                });
              }}
            >
              Restablecer Todo
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setShowResetConfirm(false)}>
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
          onOpenSpecialDialog: (session) => {
            setSpecialDetails(prev => ({ ...prev, sessionId: session.id }));
            setShowSpecialDialog(true);
          },
          onMove: moveSegment,
          onRemove: (sessionId, idx, segmentId) => removeSpecial(sessionId, idx, segmentId),
          onCopyToNext: copySegmentContent,
          onCopyAllToSlot: copyAllToSlot,
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
        serviceSegments={segmentsBySession[specialDetails.sessionId] || []}
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
        onOpenChange={setVerseParserOpen}
        initialText=""
        onSave={() => setVerseParserOpen(false)}
        language="es"
      />
    </div>
  );
}