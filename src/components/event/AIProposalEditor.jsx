/**
 * AIProposalEditor.jsx — Interactive visual editor for AI-proposed sessions+segments
 * 
 * 2026-02-20: Replaces AIProposalReview. Shows sessions as cards with nested
 * editable segments. User can rename, retype, reorder, move segments between
 * sessions, and delete items before confirming execution.
 *
 * Input: proposedActions with create_sessions_with_segments actions
 * Output: cleaned actions ready for executeActions
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/utils/i18n";
import { CheckCircle2, Loader2, AlertTriangle, Plus } from "lucide-react";
import { VALID_SEGMENT_TYPES } from "@/components/utils/segmentValidation";
import SessionEditorCard from "@/components/event/SessionEditorCard";

/**
 * Flatten all create_sessions_with_segments actions into an editable model.
 * Returns array of session objects, each with a `segments` array.
 */
function buildEditableModel(proposedActions) {
  if (!proposedActions?.actions) return [];
  const sessions = [];
  for (const action of proposedActions.actions) {
    if (action.type === 'create_sessions_with_segments' || action.type === 'create_sessions') {
      for (const sd of (action.create_data || [])) {
        sessions.push({
          _key: crypto.randomUUID(),
          name: sd.name || '',
          date: sd.date || '',
          planned_start_time: sd.planned_start_time || '',
          planned_end_time: sd.planned_end_time || '',
          session_color: sd.session_color || 'blue',
          order: sd.order ?? sessions.length + 1,
          is_translated_session: sd.is_translated_session || false,
          presenter: sd.presenter || '',
          notes: sd.notes || '',
          // Preserve any extra session fields
          _extra: Object.fromEntries(
            Object.entries(sd).filter(([k]) => ![
              'name','date','planned_start_time','planned_end_time','session_color',
              'order','is_translated_session','presenter','notes','segments','temp_session_ref'
            ].includes(k))
          ),
          segments: (sd.segments || []).map((seg, idx) => ({
            _key: crypto.randomUUID(),
            title: seg.title || '',
            segment_type: VALID_SEGMENT_TYPES.includes(seg.segment_type) ? seg.segment_type : 'Especial',
            start_time: seg.start_time || '',
            duration_min: seg.duration_min || null,
            presenter: seg.presenter || '',
            message_title: seg.message_title || '',
            color_code: seg.color_code || 'default',
            order: seg.order ?? (idx + 1),
            // Preserve extra segment fields
            _extra: Object.fromEntries(
              Object.entries(seg).filter(([k]) => ![
                'title','segment_type','start_time','duration_min','presenter',
                'message_title','color_code','order','temp_session_ref','session_id'
              ].includes(k))
            )
          }))
        });
      }
    }
    // update actions pass through unchanged (handled separately)
  }
  return sessions;
}

/** Rebuild actions array from editable model */
function modelToActions(sessions, originalActions) {
  const newActions = [];

  // Re-create the create_sessions_with_segments action
  if (sessions.length > 0) {
    newActions.push({
      type: 'create_sessions_with_segments',
      description: `Create ${sessions.length} sessions with segments`,
      create_data: sessions.map((s, sIdx) => {
        const { _key, _extra, segments, ...sessionFields } = s;
        return {
          ...sessionFields,
          ..._extra,
          order: sIdx + 1,
          segments: segments.map((seg, segIdx) => {
            const { _key: _k, _extra: _e, ...segFields } = seg;
            return { ...segFields, ..._e, order: segIdx + 1 };
          })
        };
      }),
      affected_count: sessions.reduce((sum, s) => sum + 1 + s.segments.length, 0)
    });
  }

  // Carry forward any non-create actions (updates, etc.)
  if (originalActions?.actions) {
    for (const a of originalActions.actions) {
      if (a.type !== 'create_sessions_with_segments' && a.type !== 'create_sessions' && a.type !== 'create_segments') {
        newActions.push(a);
      }
    }
  }

  return newActions;
}

export default function AIProposalEditor({
  isOpen,
  proposedActions,
  onApprove,
  onCancel,
  isExecuting
}) {
  const { language } = useLanguage();
  const [sessions, setSessions] = useState([]);

  // Initialize editable model when proposedActions changes
  useEffect(() => {
    if (proposedActions && isOpen) {
      setSessions(buildEditableModel(proposedActions));
    }
  }, [proposedActions, isOpen]);

  // ── Session-level handlers ──
  const updateSession = useCallback((key, field, value) => {
    setSessions(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s));
  }, []);

  const deleteSession = useCallback((key) => {
    setSessions(prev => prev.filter(s => s._key !== key));
  }, []);

  // ── Segment-level handlers ──
  const updateSegment = useCallback((sessionKey, segKey, field, value) => {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        segments: s.segments.map(seg =>
          seg._key === segKey ? { ...seg, [field]: value } : seg
        )
      };
    }));
  }, []);

  const deleteSegment = useCallback((sessionKey, segKey) => {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return { ...s, segments: s.segments.filter(seg => seg._key !== segKey) };
    }));
  }, []);

  const moveSegment = useCallback((fromSessionKey, segKey, toSessionKey) => {
    setSessions(prev => {
      let movedSeg = null;
      const updated = prev.map(s => {
        if (s._key === fromSessionKey) {
          const seg = s.segments.find(sg => sg._key === segKey);
          movedSeg = seg;
          return { ...s, segments: s.segments.filter(sg => sg._key !== segKey) };
        }
        return s;
      });
      if (!movedSeg) return prev;
      return updated.map(s => {
        if (s._key === toSessionKey) {
          return { ...s, segments: [...s.segments, movedSeg] };
        }
        return s;
      });
    });
  }, []);

  // Improvement #2: Add a blank session to the end of the list
  const addSession = useCallback(() => {
    setSessions(prev => [...prev, {
      _key: crypto.randomUUID(),
      name: '',
      date: '',
      planned_start_time: '',
      planned_end_time: '',
      session_color: 'blue',
      order: prev.length + 1,
      is_translated_session: false,
      presenter: '',
      notes: '',
      _extra: {},
      segments: []
    }]);
  }, []);

  // Improvement #3: Add a blank segment to a specific session
  const addSegment = useCallback((sessionKey) => {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        segments: [...s.segments, {
          _key: crypto.randomUUID(),
          title: '',
          segment_type: 'Especial',
          start_time: '',
          duration_min: null,
          presenter: '',
          message_title: '',
          color_code: 'default',
          order: s.segments.length + 1,
          _extra: {}
        }]
      };
    }));
  }, []);

  // ── Stats ──
  const totalSessions = sessions.length;
  const totalSegments = sessions.reduce((sum, s) => sum + s.segments.length, 0);
  const hasEmpty = sessions.some(s => !s.name.trim());

  // ── Approve handler ──
  const handleConfirm = () => {
    const actions = modelToActions(sessions, proposedActions);
    onApprove(actions, false);
  };

  if (!isOpen || !proposedActions) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0">
        {/* Header — Improvement #8: Added DialogDescription for a11y */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-base">
            {language === 'es' ? 'Revisar y Editar Programa' : 'Review & Edit Program'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'es'
              ? 'Editor visual para revisar y modificar sesiones y segmentos propuestos por la IA antes de crearlos.'
              : 'Visual editor to review and modify AI-proposed sessions and segments before creating them.'}
          </DialogDescription>
          <div className="flex items-center gap-3 mt-1.5">
            <Badge variant="outline" className="text-xs">
              {totalSessions} {language === 'es' ? 'sesiones' : 'sessions'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {totalSegments} {language === 'es' ? 'segmentos' : 'segments'}
            </Badge>
            {proposedActions.understood_request && (
              <span className="text-xs text-gray-500 truncate">
                {proposedActions.understood_request}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sessions.length === 0 && (
            <div className="text-center text-gray-500 py-12 text-sm">
              {language === 'es' ? 'No se encontraron sesiones para crear.' : 'No sessions found to create.'}
            </div>
          )}

          {sessions.map((session, sIdx) => (
            <SessionEditorCard
              key={session._key}
              session={session}
              sessionIndex={sIdx}
              allSessions={sessions}
              onUpdateSession={updateSession}
              onDeleteSession={deleteSession}
              onUpdateSegment={updateSegment}
              onDeleteSegment={deleteSegment}
              onMoveSegment={moveSegment}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-5 py-3 flex flex-col sm:flex-row gap-2 bg-gray-50">
          {hasEmpty && (
            <div className="flex items-center gap-1.5 text-amber-600 text-xs flex-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {language === 'es' ? 'Algunas sesiones no tienen nombre' : 'Some sessions have no name'}
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onCancel} disabled={isExecuting}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isExecuting || sessions.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'es' ? 'Creando...' : 'Creating...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {language === 'es'
                    ? `Crear ${totalSessions} Sesiones + ${totalSegments} Segmentos`
                    : `Create ${totalSessions} Sessions + ${totalSegments} Segments`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}