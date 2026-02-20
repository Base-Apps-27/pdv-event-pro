/**
 * ScheduleEditor — Visual editor for AI-proposed sessions + segments.
 *
 * REPLACES the old AIProposalReview modal. Instead of a read-only list of
 * "actions" with JSON dumps, this component shows the proposed schedule as
 * editable session cards with inline segment rows. The user can:
 *   - Rename sessions, change dates/times/colors
 *   - Add/remove/reorder segments within any session
 *   - Edit segment titles, types, times, durations, presenters
 *   - Add entirely new sessions
 *   - Then confirm → executeActions receives the final edited data
 *
 * Data flow:
 *   1. EventAIHelper extracts structured data from file/LLM
 *   2. This component receives it as `proposedSessions` (array of session
 *      objects, each with a `segments` array)
 *   3. User edits freely
 *   4. On confirm, returns a single `create_sessions_with_segments` action
 *      with the final state
 *
 * ARCHITECTURE (2026-02-20 v4): This is a pure UI component. It does NOT
 * call any entity APIs. The parent (EventAIHelper) handles execution.
 */
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Plus, AlertCircle, Info } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import ScheduleEditorSession from "./ScheduleEditorSession";

/**
 * Normalizes raw AI output (any shape) into an array of session objects
 * with nested segments arrays. Handles:
 *   - create_sessions_with_segments actions
 *   - Legacy create_sessions + create_segments combos
 *   - Direct session arrays from extraction
 */
function normalizeToSessions(proposedActions) {
  if (!proposedActions) return [];

  // If already a plain array of sessions (from extraction path)
  if (Array.isArray(proposedActions)) {
    return proposedActions.map((s, i) => ({
      name: s.name || `Sesión ${i + 1}`,
      date: s.date || "",
      planned_start_time: s.planned_start_time || s.start_time || "",
      planned_end_time: s.planned_end_time || s.end_time || "",
      session_color: s.session_color || "blue",
      order: s.order ?? (i + 1),
      segments: (s.segments || []).map((seg, j) => normalizeSegment(seg, j))
    }));
  }

  // If it's the LLM response object with actions array
  const actions = proposedActions.actions || [];
  const sessions = [];

  for (const action of actions) {
    if (action.type === "create_sessions_with_segments" || action.type === "create_sessions") {
      for (const [i, sd] of (action.create_data || []).entries()) {
        sessions.push({
          name: sd.name || `Sesión ${sessions.length + 1}`,
          date: sd.date || "",
          planned_start_time: sd.planned_start_time || sd.start_time || "",
          planned_end_time: sd.planned_end_time || sd.end_time || "",
          session_color: sd.session_color || "blue",
          order: sd.order ?? (sessions.length + 1),
          segments: (sd.segments || []).map((seg, j) => normalizeSegment(seg, j))
        });
      }
    }
  }

  // If there were standalone create_segments and at least one session exists, attach to last session
  // (legacy compat — shouldn't happen with new prompt but safe to handle)
  for (const action of actions) {
    if (action.type === "create_segments") {
      const targetSession = sessions[sessions.length - 1];
      if (targetSession) {
        const existingCount = targetSession.segments.length;
        for (const [j, seg] of (action.create_data || []).entries()) {
          targetSession.segments.push(normalizeSegment(seg, existingCount + j));
        }
      } else {
        // No sessions at all — create a default one
        sessions.push({
          name: "Sesión 1",
          date: "",
          planned_start_time: "",
          planned_end_time: "",
          session_color: "blue",
          order: 1,
          segments: (action.create_data || []).map((seg, j) => normalizeSegment(seg, j))
        });
      }
    }
  }

  return sessions;
}

function normalizeSegment(seg, idx) {
  return {
    title: seg.title || "",
    segment_type: seg.segment_type || "Especial",
    start_time: seg.start_time || "",
    duration_min: seg.duration_min ?? "",
    presenter: seg.presenter || "",
    message_title: seg.message_title || "",
    description_details: seg.description_details || seg.notes || "",
    color_code: seg.color_code || "default",
    order: seg.order ?? (idx + 1)
  };
}

export default function ScheduleEditor({
  isOpen,
  proposedActions,
  onConfirm,
  onCancel,
  isExecuting
}) {
  const { language } = useLanguage();

  // Initialize editable state from proposed data
  const initialSessions = useMemo(
    () => normalizeToSessions(proposedActions),
    [proposedActions]
  );

  const [editedSessions, setEditedSessions] = useState(initialSessions);

  // Reset when proposedActions changes
  React.useEffect(() => {
    setEditedSessions(normalizeToSessions(proposedActions));
  }, [proposedActions]);

  if (!isOpen) return null;

  const totalSegments = editedSessions.reduce(
    (sum, s) => sum + (s.segments?.length || 0),
    0
  );

  const updateSession = (idx, updated) => {
    const next = [...editedSessions];
    next[idx] = updated;
    setEditedSessions(next);
  };

  const removeSession = (idx) => {
    const next = editedSessions.filter((_, i) => i !== idx);
    next.forEach((s, i) => { s.order = i + 1; });
    setEditedSessions(next);
  };

  const addSession = () => {
    setEditedSessions([
      ...editedSessions,
      {
        name: `Sesión ${editedSessions.length + 1}`,
        date: "",
        planned_start_time: "",
        planned_end_time: "",
        session_color: "blue",
        order: editedSessions.length + 1,
        segments: []
      }
    ]);
  };

  // Simple validation
  const warnings = [];
  editedSessions.forEach((s, i) => {
    if (!s.name?.trim()) warnings.push(`${language === "es" ? "Sesión" : "Session"} ${i + 1}: ${language === "es" ? "sin nombre" : "no name"}`);
    (s.segments || []).forEach((seg, j) => {
      if (!seg.title?.trim()) warnings.push(`${s.name || `Sesión ${i + 1}`} / Seg ${j + 1}: ${language === "es" ? "sin título" : "no title"}`);
    });
  });

  const handleConfirm = () => {
    // Build the final action in create_sessions_with_segments format
    const finalAction = {
      type: "create_sessions_with_segments",
      description: `Create ${editedSessions.length} sessions with ${totalSegments} segments`,
      create_data: editedSessions.map((s, i) => ({
        name: s.name || `Sesión ${i + 1}`,
        date: s.date || undefined,
        planned_start_time: s.planned_start_time || undefined,
        planned_end_time: s.planned_end_time || undefined,
        session_color: s.session_color || "blue",
        order: i + 1,
        segments: (s.segments || []).map((seg, j) => ({
          ...seg,
          order: j + 1
        }))
      })),
      affected_count: editedSessions.length + totalSegments
    };

    onConfirm([finalAction], false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            {language === "es" ? "Editar Programa Propuesto" : "Edit Proposed Schedule"}
          </DialogTitle>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <Badge variant="outline">
              {editedSessions.length} {language === "es" ? "sesiones" : "sessions"}
            </Badge>
            <Badge variant="outline">
              {totalSegments} {language === "es" ? "segmentos" : "segments"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {editedSessions.length === 0 && (
            <Card className="p-8 text-center text-gray-400">
              {language === "es"
                ? "No se encontraron sesiones. Agrega una para comenzar."
                : "No sessions found. Add one to get started."}
            </Card>
          )}

          {editedSessions.map((session, idx) => (
            <ScheduleEditorSession
              key={idx}
              session={session}
              sessionIndex={idx}
              onSessionChange={(updated) => updateSession(idx, updated)}
              onRemoveSession={() => removeSession(idx)}
              totalSessions={editedSessions.length}
            />
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed text-gray-500"
            onClick={addSession}
          >
            <Plus className="w-4 h-4 mr-2" />
            {language === "es" ? "Agregar Sesión" : "Add Session"}
          </Button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 shrink-0 space-y-2">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex items-start gap-2 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">
                  {language === "es"
                    ? `${warnings.length} campo(s) vacíos — se pueden completar después`
                    : `${warnings.length} empty field(s) — can be filled in later`}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isExecuting} className="flex-1">
              {language === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isExecuting || editedSessions.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isExecuting ? (
                <>
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {language === "es" ? "Creando..." : "Creating..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {language === "es"
                    ? `Crear ${editedSessions.length} sesiones con ${totalSegments} segmentos`
                    : `Create ${editedSessions.length} sessions with ${totalSegments} segments`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}