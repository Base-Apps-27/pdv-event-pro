/**
 * MoveSegmentDialog.jsx — Move a segment from one session to another within the same event.
 * 
 * FEATURE: Move Segment Between Sessions (2026-03-06)
 * 
 * Handles:
 * - Target session selection (sibling sessions only, excludes current)
 * - Insertion position picker (after which segment, or at beginning)
 * - Auto-calculates timing based on insertion position
 * - StreamBlock orphaning warning
 * - LiveDirector active blocking
 * - Child sub-segment migration (parent_segment_id family)
 * - Reindexing of both source and target sessions
 * - Live state reset on moved segment
 * - Audit logging via EditActionLog
 * 
 * Dependencies:
 *   - Segment entity (session_id, order, timing fields, live fields)
 *   - StreamBlock entity (anchor_segment_id, session_id, orphaned)
 *   - EditActionLog (via editActionLogger.logUpdate)
 *   - queryKeys.js (invalidateSegmentCaches, sessionKeys)
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
import { ArrowRight, AlertTriangle, Clock, Radio, Users } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { logUpdate } from "@/components/utils/editActionLogger";
import { invalidateSegmentCaches, sessionKeys } from "@/components/utils/queryKeys";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";

/**
 * Calculate end_time from start_time + duration_min
 */
function calcEndTime(startTime, durationMin) {
  if (!startTime || !durationMin) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + Number(durationMin);
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Calculate stage_call_time from start_time - offset
 */
function calcStageCall(startTime, offsetMin) {
  if (!startTime || !offsetMin) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m - Number(offsetMin);
  if (totalMin < 0) return null;
  const callH = Math.floor(totalMin / 60) % 24;
  const callM = totalMin % 60;
  return `${String(callH).padStart(2, '0')}:${String(callM).padStart(2, '0')}`;
}

export default function MoveSegmentDialog({ open, onOpenChange, segment, sessions, allSegments, currentSessionId, user }) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [targetSessionId, setTargetSessionId] = useState("");
  const [insertAfter, setInsertAfter] = useState("__end__"); // segment id or "__start__" or "__end__"

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setTargetSessionId("");
      setInsertAfter("__end__");
    }
  }, [open]);

  // Sibling sessions (same event, exclude current)
  const siblineSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(s => s.id !== currentSessionId)
      .sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.planned_start_time || '').localeCompare(b.planned_start_time || '');
      });
  }, [sessions, currentSessionId]);

  // Segments in target session
  const targetSegments = useMemo(() => {
    if (!targetSessionId || !allSegments) return [];
    return allSegments
      .filter(s => s.session_id === targetSessionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [targetSessionId, allSegments]);

  // Check for StreamBlocks anchored to this segment
  const { data: anchoredStreamBlocks = [] } = useQuery({
    queryKey: ['streamBlocks', 'anchor', segment?.id],
    queryFn: () => base44.entities.StreamBlock.filter({ anchor_segment_id: segment?.id }),
    enabled: !!segment?.id && open,
  });
  const hasAnchoredStreamBlocks = anchoredStreamBlocks.length > 0;

  // Check if LiveDirector is active on source or target session
  const sourceSession = sessions?.find(s => s.id === currentSessionId);
  const targetSession = sessions?.find(s => s.id === targetSessionId);
  const liveDirectorActive = 
    sourceSession?.live_adjustment_enabled || 
    targetSession?.live_adjustment_enabled;

  // Child sub-segments (segments with parent_segment_id = this segment)
  const childSegments = useMemo(() => {
    if (!segment || !allSegments) return [];
    return allSegments.filter(s => s.parent_segment_id === segment.id);
  }, [segment, allSegments]);

  // Calculate new timing based on insertion position
  const calculatedTiming = useMemo(() => {
    if (!targetSessionId || !segment) return null;

    let newStartTime = null;

    if (insertAfter === "__start__") {
      // Insert at beginning — use session start time or first segment's start
      newStartTime = targetSession?.planned_start_time || (targetSegments[0]?.start_time) || null;
    } else if (insertAfter === "__end__") {
      // Insert at end — use last segment's end_time
      const lastSeg = targetSegments[targetSegments.length - 1];
      newStartTime = lastSeg?.end_time || targetSession?.planned_start_time || null;
    } else {
      // Insert after specific segment
      const afterSeg = targetSegments.find(s => s.id === insertAfter);
      newStartTime = afterSeg?.end_time || null;
    }

    const newEndTime = calcEndTime(newStartTime, segment.duration_min);
    const newStageCall = calcStageCall(newStartTime, segment.stage_call_offset_min);

    return { start_time: newStartTime, end_time: newEndTime, stage_call_time: newStageCall };
  }, [targetSessionId, insertAfter, segment, targetSession, targetSegments]);

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!segment || !targetSessionId) throw new Error("Missing segment or target session");
      if (liveDirectorActive) throw new Error("Cannot move while Live Director is active");

      const previousState = { ...segment };
      const sourceSessionSegments = allSegments
        .filter(s => s.session_id === currentSessionId && s.id !== segment.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // --- STEP 1: Calculate new order in target session ---
      let newOrder;
      if (insertAfter === "__start__") {
        newOrder = 0.5; // Will be renormalized
      } else if (insertAfter === "__end__") {
        const maxOrder = targetSegments.reduce((max, s) => Math.max(max, s.order || 0), 0);
        newOrder = maxOrder + 1;
      } else {
        const afterSeg = targetSegments.find(s => s.id === insertAfter);
        newOrder = (afterSeg?.order || 0) + 0.5; // Will be renormalized
      }

      // --- STEP 2: Build update payload for the moved segment ---
      const movePayload = {
        session_id: targetSessionId,
        order: newOrder,
        start_time: calculatedTiming?.start_time || null,
        end_time: calculatedTiming?.end_time || null,
        stage_call_time: calculatedTiming?.stage_call_time || null,
        // Reset live state fields
        is_live_adjusted: false,
        actual_start_time: null,
        actual_end_time: null,
        timing_source: "plan",
        live_status: "active",
        live_hold_status: null,
        live_hold_placed_at: null,
        live_hold_placed_by: null,
      };

      const writes = [];

      // Update the main segment
      writes.push(base44.entities.Segment.update(segment.id, movePayload));

      // --- STEP 3: Move child sub-segments too ---
      for (const child of childSegments) {
        writes.push(base44.entities.Segment.update(child.id, {
          session_id: targetSessionId,
          // Reset live state on children too
          is_live_adjusted: false,
          actual_start_time: null,
          actual_end_time: null,
          timing_source: "plan",
          live_status: "active",
          live_hold_status: null,
          live_hold_placed_at: null,
          live_hold_placed_by: null,
        }));
      }

      // --- STEP 4: Re-index source session (close the gap) ---
      sourceSessionSegments.forEach((seg, i) => {
        if (seg.order !== i + 1) {
          writes.push(base44.entities.Segment.update(seg.id, { order: i + 1 }));
        }
      });

      // --- STEP 5: Re-index target session (normalize fractional orders) ---
      // Build the new target list including the moved segment
      const newTargetList = [...targetSegments, { id: segment.id, order: newOrder }]
        .sort((a, b) => a.order - b.order);
      
      newTargetList.forEach((seg, i) => {
        const correctOrder = i + 1;
        // Skip the moved segment (already has order in movePayload, but we may need to fix it)
        if (seg.id === segment.id) {
          // Update the move payload order to the correct normalized value
          writes.push(base44.entities.Segment.update(segment.id, { order: correctOrder }));
        } else if (seg.order !== correctOrder) {
          writes.push(base44.entities.Segment.update(seg.id, { order: correctOrder }));
        }
      });

      // --- STEP 6: Orphan StreamBlocks anchored to this segment in the old session ---
      if (hasAnchoredStreamBlocks) {
        for (const block of anchoredStreamBlocks) {
          if (block.session_id === currentSessionId) {
            writes.push(base44.entities.StreamBlock.update(block.id, {
              orphaned: true,
              last_known_start: segment.start_time || null,
            }));
          }
        }
      }

      // Execute all writes
      await Promise.all(writes);

      // --- STEP 7: Audit log ---
      const sourceSessionName = sourceSession?.name || currentSessionId;
      const targetSessionName = targetSession?.name || targetSessionId;
      
      await logUpdate(
        'Segment',
        segment.id,
        previousState,
        { ...previousState, ...movePayload, order: newTargetList.findIndex(s => s.id === segment.id) + 1 },
        targetSessionId,
        user
      );

      // Log a custom move description by creating an additional EditActionLog
      await base44.entities.EditActionLog.create({
        entity_type: 'Segment',
        entity_id: segment.id,
        parent_id: targetSessionId,
        action_type: 'update',
        field_changes: {
          session_id: { old_value: currentSessionId, new_value: targetSessionId },
        },
        previous_state: previousState,
        new_state: { ...previousState, ...movePayload },
        description: `[MOVE] ${language === 'es' ? 'Se movió' : 'Moved'} "${segment.title}" ${language === 'es' ? 'de' : 'from'} "${sourceSessionName}" → "${targetSessionName}"`,
        user_email: user?.email || null,
        user_name: user?.display_name || user?.full_name || null,
        undone: false,
      });

      return { sourceSessionName, targetSessionName };
    },
    onSuccess: ({ sourceSessionName, targetSessionName }) => {
      // Invalidate all affected caches
      invalidateSegmentCaches(queryClient);
      sessionKeys.invalidateAll(queryClient);
      queryClient.invalidateQueries(['streamBlocks']);
      queryClient.invalidateQueries(['editActionLogs']);

      toast.success(
        language === 'es'
          ? `Segmento movido a "${targetSessionName}"`
          : `Segment moved to "${targetSessionName}"`
      );
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        language === 'es'
          ? `Error al mover: ${err.message}`
          : `Move failed: ${err.message}`
      );
    },
  });

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            {t('move.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('move.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current segment info */}
          <div className="bg-slate-50 rounded-lg p-3 border">
            <div className="text-xs text-slate-500 mb-1">{t('move.movingSegment')}</div>
            <div className="font-semibold text-slate-900">{segment.title}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{segment.segment_type}</Badge>
              {segment.start_time && <span className="font-mono">{formatTimeToEST(segment.start_time)}</span>}
              {segment.duration_min && <span>• {segment.duration_min}min</span>}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {t('move.currentSession')}: <span className="font-medium text-slate-600">{sourceSession?.name}</span>
            </div>
          </div>

          {/* LiveDirector block */}
          {liveDirectorActive && (
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                <strong>{t('move.liveDirectorBlocked')}</strong>
                <br />
                {t('move.liveDirectorBlockedDesc')}
              </AlertDescription>
            </Alert>
          )}

          {/* Target session picker */}
          <div className="space-y-2">
            <Label>{t('move.targetSession')}</Label>
            {siblineSessions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">{t('move.noOtherSessions')}</p>
            ) : (
              <Select value={targetSessionId} onValueChange={(val) => { setTargetSessionId(val); setInsertAfter("__end__"); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('move.selectSession')} />
                </SelectTrigger>
                <SelectContent>
                  {siblineSessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.date && <span className="text-xs text-slate-500">{s.date}</span>}
                        {s.planned_start_time && <span className="text-xs text-slate-400">{formatTimeToEST(s.planned_start_time)}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Insertion position picker */}
          {targetSessionId && (
            <div className="space-y-2">
              <Label>{t('move.insertPosition')}</Label>
              <Select value={insertAfter} onValueChange={setInsertAfter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {/* Timing preview */}
          {targetSessionId && calculatedTiming?.start_time && (
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

          {/* Child segments warning */}
          {childSegments.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <Users className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {t('move.childSegmentsWarning').replace('{count}', childSegments.length)}
              </AlertDescription>
            </Alert>
          )}

          {/* StreamBlock warning */}
          {hasAnchoredStreamBlocks && (
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
              onClick={() => moveMutation.mutate()}
              disabled={!targetSessionId || liveDirectorActive || moveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              {moveMutation.isPending
                ? (language === 'es' ? 'Moviendo...' : 'Moving...')
                : t('move.confirm')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}