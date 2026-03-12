/**
 * DuplicateSegmentDialog.jsx
 * 2026-03-12: Duplicate a segment into a chosen session (same or sibling).
 *
 * Behavior (per user decision):
 *  - Exact copy of all content fields
 *  - Target: one session picker (includes current session)
 *  - Insertion: end of target session
 *  - Sets origin: 'duplicate', resets all live state fields
 *  - Audit logged via EditActionLog
 *
 * Dependencies:
 *  - Segment entity
 *  - EditActionLog
 *  - queryKeys.js (invalidateSegmentCaches)
 */

import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { invalidateSegmentCaches } from "@/components/utils/queryKeys";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";

// Fields that must NOT be copied verbatim — they are reset or recalculated
const LIVE_RESET_FIELDS = {
  is_live_adjusted: false,
  actual_start_time: null,
  actual_end_time: null,
  timing_source: "plan",
  live_status: "active",
  live_hold_status: null,
  live_hold_placed_at: null,
  live_hold_placed_by: null,
};

// Fields that should NOT be carried over to the duplicate
const EXCLUDE_FIELDS = new Set([
  'id', 'created_date', 'updated_date', 'created_by',
  'session_id', 'order',
  'start_time', 'end_time', 'stage_call_time',
  ...Object.keys(LIVE_RESET_FIELDS),
]);

export default function DuplicateSegmentDialog({ open, onOpenChange, segment, sessions, allSegments, currentSessionId, user }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const [targetSessionId, setTargetSessionId] = useState("");

  // Reset state when dialog opens — default to same session
  React.useEffect(() => {
    if (open) {
      setTargetSessionId(currentSessionId || "");
    }
  }, [open, currentSessionId]);

  // All sessions sorted chronologically (includes current)
  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      return (a.planned_start_time || '').localeCompare(b.planned_start_time || '');
    });
  }, [sessions]);

  // Segments in target session — to determine end position
  const targetSegments = useMemo(() => {
    if (!targetSessionId || !allSegments) return [];
    return allSegments
      .filter(s => s.session_id === targetSessionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [targetSessionId, allSegments]);

  const targetSession = sessions?.find(s => s.id === targetSessionId);
  const sourceSession = sessions?.find(s => s.id === currentSessionId);

  // New order = end of target session
  const newOrder = useMemo(() => {
    if (targetSegments.length === 0) return 1;
    return Math.max(...targetSegments.map(s => s.order || 0)) + 1;
  }, [targetSegments]);

  // New start time = end_time of last segment in target session
  const newStartTime = useMemo(() => {
    if (targetSegments.length === 0) return targetSession?.planned_start_time || null;
    const last = targetSegments[targetSegments.length - 1];
    return last?.end_time || null;
  }, [targetSegments, targetSession]);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!segment || !targetSessionId) throw new Error("Missing segment or target session");

      // Build payload: copy all non-excluded fields
      const payload = {};
      for (const [key, value] of Object.entries(segment)) {
        if (!EXCLUDE_FIELDS.has(key)) {
          payload[key] = value;
        }
      }

      // Set controlled fields
      Object.assign(payload, {
        session_id: targetSessionId,
        order: newOrder,
        start_time: newStartTime,
        end_time: null, // will be recalculated by the user or timing tools
        stage_call_time: null,
        origin: 'duplicate',
        ...LIVE_RESET_FIELDS,
      });

      const newSeg = await base44.entities.Segment.create(payload);

      // Audit log
      await base44.entities.EditActionLog.create({
        entity_type: 'Segment',
        entity_id: newSeg.id,
        parent_id: targetSessionId,
        action_type: 'create',
        field_changes: {},
        previous_state: null,
        new_state: payload,
        description: `[DUPLICATE] "${segment.title}" → "${targetSession?.name || targetSessionId}"`,
        user_email: user?.email || null,
        user_name: user?.display_name || user?.full_name || null,
        undone: false,
      });

      return { targetSessionName: targetSession?.name || targetSessionId };
    },
    onSuccess: ({ targetSessionName }) => {
      invalidateSegmentCaches(queryClient);
      queryClient.invalidateQueries(['editActionLogs']);
      toast.success(
        language === 'es'
          ? `Segmento duplicado en "${targetSessionName}"`
          : `Segment duplicated into "${targetSessionName}"`
      );
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        language === 'es'
          ? `Error al duplicar: ${err.message}`
          : `Duplicate failed: ${err.message}`
      );
    },
  });

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            {language === 'es' ? 'Duplicar Segmento' : 'Duplicate Segment'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'es' ? 'Copiar este segmento a una sesión' : 'Copy this segment to a session'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Source segment info */}
          <div className="bg-slate-50 rounded-lg p-3 border">
            <div className="text-xs text-slate-500 mb-1">
              {language === 'es' ? 'Duplicando segmento' : 'Duplicating segment'}
            </div>
            <div className="font-semibold text-slate-900">{segment.title}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{segment.segment_type}</Badge>
              {segment.start_time && <span className="font-mono">{formatTimeToEST(segment.start_time)}</span>}
              {segment.duration_min && <span>• {segment.duration_min}min</span>}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {language === 'es' ? 'Sesión origen' : 'Source session'}:{' '}
              <span className="font-medium text-slate-600">{sourceSession?.name}</span>
            </div>
          </div>

          {/* Target session picker */}
          <div className="space-y-2">
            <Label>{language === 'es' ? 'Sesión destino' : 'Target session'}</Label>
            <Select value={targetSessionId} onValueChange={setTargetSessionId}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'es' ? 'Seleccionar sesión…' : 'Select session…'} />
              </SelectTrigger>
              <SelectContent>
                {sortedSessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {s.id === currentSessionId && (
                        <span className="text-xs text-slate-400">({language === 'es' ? 'esta sesión' : 'this session'})</span>
                      )}
                      {s.date && <span className="text-xs text-slate-500">{s.date}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Placement info */}
          {targetSessionId && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
              <strong>{language === 'es' ? 'Posición:' : 'Position:'}</strong>{' '}
              {language === 'es'
                ? `Al final de "${targetSession?.name}" (posición ${newOrder})`
                : `At the end of "${targetSession?.name}" (position ${newOrder})`
              }
              {newStartTime && (
                <span className="ml-1 font-mono text-amber-700">· {formatTimeToEST(newStartTime)}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={() => duplicateMutation.mutate()}
              disabled={!targetSessionId || duplicateMutation.isPending}
              className="gap-2"
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 100%)', color: '#fff' }}
            >
              <Copy className="w-4 h-4" />
              {duplicateMutation.isPending
                ? (language === 'es' ? 'Duplicando...' : 'Duplicating...')
                : (language === 'es' ? 'Duplicar' : 'Duplicate')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}