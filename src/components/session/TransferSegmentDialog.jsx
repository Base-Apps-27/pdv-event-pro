/**
 * TransferSegmentDialog.jsx
 * 2026-03-12: Unified Move + Copy dialog for segments.
 *
 * Replaces MoveSegmentDialog + DuplicateSegmentDialog with a single modal.
 * Mode toggle at top selects "Move" or "Copy" — each path is fully independent
 * in execution but shares the UI shell (session picker, warnings, confirm).
 *
 * MOVE path:
 *  - Updates existing segment: session_id, order, timing
 *  - Re-indexes source + target sessions
 *  - Resets live state fields
 *  - Handles StreamBlock orphaning
 *  - Migrates child sub-segments
 *  - Blocked if LiveDirector active on either session
 *
 * COPY path:
 *  - Creates new segment at end of target session
 *  - Copies all content fields, sets origin: 'duplicate'
 *  - Clears all live state fields
 *  - Target session includes current session (can copy within same session)
 *  - No position picker — always appends to end
 *
 * Dependencies:
 *  - Segment entity, StreamBlock entity, EditActionLog entity
 *  - queryKeys.js (invalidateSegmentCaches)
 *  - editActionLogger (logUpdate)
 */

import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Copy, AlertTriangle, Clock, Radio, Users } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { logUpdate } from "@/components/utils/editActionLogger";
import { invalidateSegmentCaches, sessionKeys } from "@/components/utils/queryKeys";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";

// Live state fields reset on both move and copy
const LIVE_RESET = {
  is_live_adjusted: false,
  actual_start_time: null,
  actual_end_time: null,
  timing_source: "plan",
  live_status: "active",
  live_hold_status: null,
  live_hold_placed_at: null,
  live_hold_placed_by: null,
};

// Fields excluded when building a copy payload
const COPY_EXCLUDE = new Set([
  'id', 'created_date', 'updated_date', 'created_by',
  'session_id', 'order',
  'start_time', 'end_time', 'stage_call_time',
  ...Object.keys(LIVE_RESET),
]);

function calcEndTime(startTime, durationMin) {
  if (!startTime || !durationMin) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + Number(durationMin);
  return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

function calcStageCall(startTime, offsetMin) {
  if (!startTime || !offsetMin) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m - Number(offsetMin);
  if (totalMin < 0) return null;
  return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

export default function TransferSegmentDialog({
  open, onOpenChange,
  segment, sessions, allSegments, currentSessionId, user,
  defaultMode = "move", // "move" | "copy"
}) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState(defaultMode);
  const [targetSessionId, setTargetSessionId] = useState("");
  const [insertAfter, setInsertAfter] = useState("__end__"); // move only

  const es = language === 'es';

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setMode(defaultMode);
      // Move: default to a sibling; Copy: default to current session
      setTargetSessionId(defaultMode === 'copy' ? (currentSessionId || "") : "");
      setInsertAfter("__end__");
    }
  }, [open, defaultMode, currentSessionId]);

  // Also reset insertAfter when mode changes
  React.useEffect(() => {
    setInsertAfter("__end__");
    if (mode === 'copy') {
      setTargetSessionId(currentSessionId || "");
    } else {
      setTargetSessionId("");
    }
  }, [mode, currentSessionId]);

  // MOVE: sibling sessions only (excludes current)
  const siblineSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions]
      .filter(s => s.id !== currentSessionId)
      .sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.planned_start_time || '').localeCompare(b.planned_start_time || '');
      });
  }, [sessions, currentSessionId]);

  // COPY: all sessions including current
  const allSortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      return (a.planned_start_time || '').localeCompare(b.planned_start_time || '');
    });
  }, [sessions]);

  const sessionList = mode === 'move' ? siblineSessions : allSortedSessions;

  // Segments in target session
  const targetSegments = useMemo(() => {
    if (!targetSessionId || !allSegments) return [];
    return allSegments
      .filter(s => s.session_id === targetSessionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [targetSessionId, allSegments]);

  const sourceSession = sessions?.find(s => s.id === currentSessionId);
  const targetSession = sessions?.find(s => s.id === targetSessionId);

  // --- MOVE-specific data ---
  const { data: anchoredStreamBlocks = [] } = useQuery({
    queryKey: ['streamBlocks', 'anchor', segment?.id],
    queryFn: () => base44.entities.StreamBlock.filter({ anchor_segment_id: segment?.id }),
    enabled: !!segment?.id && open && mode === 'move',
  });

  const liveDirectorActive =
    sourceSession?.live_adjustment_enabled ||
    targetSession?.live_adjustment_enabled;

  const childSegments = useMemo(() => {
    if (!segment || !allSegments) return [];
    return allSegments.filter(s => s.parent_segment_id === segment.id);
  }, [segment, allSegments]);

  const calculatedTiming = useMemo(() => {
    if (mode !== 'move' || !targetSessionId || !segment) return null;
    let newStartTime = null;
    if (insertAfter === "__start__") {
      newStartTime = targetSession?.planned_start_time || targetSegments[0]?.start_time || null;
    } else if (insertAfter === "__end__") {
      const last = targetSegments[targetSegments.length - 1];
      newStartTime = last?.end_time || targetSession?.planned_start_time || null;
    } else {
      const afterSeg = targetSegments.find(s => s.id === insertAfter);
      newStartTime = afterSeg?.end_time || null;
    }
    return {
      start_time: newStartTime,
      end_time: calcEndTime(newStartTime, segment.duration_min),
      stage_call_time: calcStageCall(newStartTime, segment.stage_call_offset_min),
    };
  }, [mode, targetSessionId, insertAfter, segment, targetSession, targetSegments]);

  // --- COPY-specific data ---
  const copyNewOrder = useMemo(() => {
    if (targetSegments.length === 0) return 1;
    return Math.max(...targetSegments.map(s => s.order || 0)) + 1;
  }, [targetSegments]);

  const copyNewStartTime = useMemo(() => {
    if (targetSegments.length === 0) return targetSession?.planned_start_time || null;
    return targetSegments[targetSegments.length - 1]?.end_time || null;
  }, [targetSegments, targetSession]);

  // --- MOVE mutation ---
  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!segment || !targetSessionId) throw new Error("Missing segment or target");
      if (liveDirectorActive) throw new Error("Cannot move while Live Director is active");

      const previousState = { ...segment };
      const sourceSessionSegments = allSegments
        .filter(s => s.session_id === currentSessionId && s.id !== segment.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      let newOrder;
      if (insertAfter === "__start__") {
        newOrder = 0.5;
      } else if (insertAfter === "__end__") {
        newOrder = targetSegments.reduce((max, s) => Math.max(max, s.order || 0), 0) + 1;
      } else {
        const afterSeg = targetSegments.find(s => s.id === insertAfter);
        newOrder = (afterSeg?.order || 0) + 0.5;
      }

      const movePayload = {
        session_id: targetSessionId,
        order: newOrder,
        start_time: calculatedTiming?.start_time || null,
        end_time: calculatedTiming?.end_time || null,
        stage_call_time: calculatedTiming?.stage_call_time || null,
        ...LIVE_RESET,
      };

      const writes = [base44.entities.Segment.update(segment.id, movePayload)];

      for (const child of childSegments) {
        writes.push(base44.entities.Segment.update(child.id, { session_id: targetSessionId, ...LIVE_RESET }));
      }

      sourceSessionSegments.forEach((seg, i) => {
        if (seg.order !== i + 1) writes.push(base44.entities.Segment.update(seg.id, { order: i + 1 }));
      });

      const newTargetList = [...targetSegments, { id: segment.id, order: newOrder }]
        .sort((a, b) => a.order - b.order);

      newTargetList.forEach((seg, i) => {
        const correctOrder = i + 1;
        if (seg.id === segment.id) {
          writes.push(base44.entities.Segment.update(segment.id, { order: correctOrder }));
        } else if (seg.order !== correctOrder) {
          writes.push(base44.entities.Segment.update(seg.id, { order: correctOrder }));
        }
      });

      for (const block of anchoredStreamBlocks) {
        if (block.session_id === currentSessionId) {
          writes.push(base44.entities.StreamBlock.update(block.id, { orphaned: true, last_known_start: segment.start_time || null }));
        }
      }

      await Promise.all(writes);

      await logUpdate('Segment', segment.id, previousState, { ...previousState, ...movePayload }, targetSessionId, user);
      await base44.entities.EditActionLog.create({
        entity_type: 'Segment',
        entity_id: segment.id,
        parent_id: targetSessionId,
        action_type: 'update',
        field_changes: { session_id: { old_value: currentSessionId, new_value: targetSessionId } },
        previous_state: previousState,
        new_state: { ...previousState, ...movePayload },
        description: `[MOVE] "${segment.title}" ${es ? 'de' : 'from'} "${sourceSession?.name}" → "${targetSession?.name}"`,
        user_email: user?.email || null,
        user_name: user?.display_name || user?.full_name || null,
        undone: false,
      });

      return targetSession?.name || targetSessionId;
    },
    onSuccess: (targetName) => {
      invalidateSegmentCaches(queryClient);
      sessionKeys.invalidateAll(queryClient);
      queryClient.invalidateQueries(['streamBlocks']);
      queryClient.invalidateQueries(['editActionLogs']);
      toast.success(es ? `Segmento movido a "${targetName}"` : `Segment moved to "${targetName}"`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(es ? `Error al mover: ${err.message}` : `Move failed: ${err.message}`),
  });

  // --- COPY mutation ---
  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!segment || !targetSessionId) throw new Error("Missing segment or target");

      const payload = {};
      for (const [key, value] of Object.entries(segment)) {
        if (!COPY_EXCLUDE.has(key)) payload[key] = value;
      }
      Object.assign(payload, {
        session_id: targetSessionId,
        order: copyNewOrder,
        start_time: copyNewStartTime,
        end_time: null,
        stage_call_time: null,
        origin: 'duplicate',
        ...LIVE_RESET,
      });

      const newSeg = await base44.entities.Segment.create(payload);

      await base44.entities.EditActionLog.create({
        entity_type: 'Segment',
        entity_id: newSeg.id,
        parent_id: targetSessionId,
        action_type: 'create',
        field_changes: {},
        previous_state: null,
        new_state: payload,
        description: `[DUPLICATE] "${segment.title}" → "${targetSession?.name}"`,
        user_email: user?.email || null,
        user_name: user?.display_name || user?.full_name || null,
        undone: false,
      });

      return targetSession?.name || targetSessionId;
    },
    onSuccess: (targetName) => {
      invalidateSegmentCaches(queryClient);
      queryClient.invalidateQueries(['editActionLogs']);
      toast.success(es ? `Segmento copiado a "${targetName}"` : `Segment copied to "${targetName}"`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(es ? `Error al copiar: ${err.message}` : `Copy failed: ${err.message}`),
  });

  const isPending = moveMutation.isPending || copyMutation.isPending;
  const canConfirm = !!targetSessionId && !isPending && (mode === 'copy' || !liveDirectorActive);

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            {es ? 'Transferir Segmento' : 'Transfer Segment'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {es ? 'Mover o copiar este segmento' : 'Move or copy this segment'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setMode('move')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-colors ${
                mode === 'move'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              {es ? 'Mover' : 'Move'}
            </button>
            <button
              onClick={() => setMode('copy')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-colors border-l border-slate-200 ${
                mode === 'copy'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Copy className="w-4 h-4" />
              {es ? 'Copiar' : 'Copy'}
            </button>
          </div>

          {/* Source segment info */}
          <div className="bg-slate-50 rounded-lg p-3 border">
            <div className="text-xs text-slate-500 mb-1">
              {mode === 'move'
                ? (es ? 'Moviendo segmento' : 'Moving segment')
                : (es ? 'Copiando segmento' : 'Copying segment')
              }
            </div>
            <div className="font-semibold text-slate-900">{segment.title}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{segment.segment_type}</Badge>
              {segment.start_time && <span className="font-mono">{formatTimeToEST(segment.start_time)}</span>}
              {segment.duration_min && <span>• {segment.duration_min}min</span>}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {es ? 'Sesión actual' : 'Current session'}:{' '}
              <span className="font-medium text-slate-600">{sourceSession?.name}</span>
            </div>
          </div>

          {/* LiveDirector block (move only) */}
          {mode === 'move' && liveDirectorActive && (
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                <strong>{t('move.liveDirectorBlocked')}</strong><br />
                {t('move.liveDirectorBlockedDesc')}
              </AlertDescription>
            </Alert>
          )}

          {/* Target session picker */}
          <div className="space-y-2">
            <Label>{es ? 'Sesión destino' : 'Target session'}</Label>
            {sessionList.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                {es ? 'No hay otras sesiones disponibles' : 'No other sessions available'}
              </p>
            ) : (
              <Select value={targetSessionId} onValueChange={(val) => { setTargetSessionId(val); setInsertAfter("__end__"); }}>
                <SelectTrigger>
                  <SelectValue placeholder={es ? 'Seleccionar sesión…' : 'Select session…'} />
                </SelectTrigger>
                <SelectContent>
                  {sessionList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {mode === 'copy' && s.id === currentSessionId && (
                          <span className="text-xs text-slate-400">({es ? 'esta sesión' : 'this session'})</span>
                        )}
                        {s.date && <span className="text-xs text-slate-500">{s.date}</span>}
                        {s.planned_start_time && <span className="text-xs text-slate-400">{formatTimeToEST(s.planned_start_time)}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* MOVE: insertion position */}
          {mode === 'move' && targetSessionId && (
            <div className="space-y-2">
              <Label>{t('move.insertPosition')}</Label>
              <Select value={insertAfter} onValueChange={setInsertAfter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__start__">{t('move.atBeginning')}</SelectItem>
                  {targetSegments.map((s, idx) => (
                    <SelectItem key={s.id} value={s.id}>
                      {t('move.afterSegment')} #{idx + 1}: {s.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="__end__">{t('move.atEnd')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* MOVE: timing preview */}
          {mode === 'move' && targetSessionId && calculatedTiming?.start_time && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
                <Clock className="w-4 h-4" />
                {t('move.timingPreview')}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-blue-600">{t('move.newStart')}</div>
                  <div className="font-mono font-medium">{formatTimeToEST(calculatedTiming.start_time)}</div>
                </div>
                {calculatedTiming.end_time && (
                  <div>
                    <div className="text-xs text-blue-600">{t('move.newEnd')}</div>
                    <div className="font-mono font-medium">{formatTimeToEST(calculatedTiming.end_time)}</div>
                  </div>
                )}
                {calculatedTiming.stage_call_time && (
                  <div>
                    <div className="text-xs text-blue-600">{t('move.stageCall')}</div>
                    <div className="font-mono font-medium">{formatTimeToEST(calculatedTiming.stage_call_time)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COPY: placement info */}
          {mode === 'copy' && targetSessionId && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
              <strong>{es ? 'Posición:' : 'Position:'}</strong>{' '}
              {es
                ? `Al final de "${targetSession?.name}" (posición ${copyNewOrder})`
                : `At the end of "${targetSession?.name}" (position ${copyNewOrder})`
              }
              {copyNewStartTime && (
                <span className="ml-1 font-mono text-amber-700">· {formatTimeToEST(copyNewStartTime)}</span>
              )}
            </div>
          )}

          {/* MOVE: child segments warning */}
          {mode === 'move' && childSegments.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <Users className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {t('move.childSegmentsWarning').replace('{count}', childSegments.length)}
              </AlertDescription>
            </Alert>
          )}

          {/* MOVE: StreamBlock warning */}
          {mode === 'move' && anchoredStreamBlocks.length > 0 && (
            <Alert className="border-orange-300 bg-orange-50">
              <Radio className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                {t('move.streamBlockWarning').replace('{count}', anchoredStreamBlocks.length)}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('btn.cancel')}
            </Button>
            <Button
              onClick={() => mode === 'move' ? moveMutation.mutate() : copyMutation.mutate()}
              disabled={!canConfirm}
              className={`gap-2 text-white ${mode === 'move' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {mode === 'move' ? <ArrowRight className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {isPending
                ? (es ? 'Procesando...' : 'Processing...')
                : mode === 'move'
                  ? t('move.confirm')
                  : (es ? 'Copiar' : 'Copy')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}