import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  History, 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowUpDown, 
  User, 
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  Layers,
  Undo2,
  Loader2
} from "lucide-react";
import { formatTimestampToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";
import { undoUpdate, undoDelete } from "@/components/utils/editActionLogger";

const ACTION_ICONS = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  reorder: ArrowUpDown
};

const ACTION_COLORS = {
  create: "bg-green-100 text-green-700 border-green-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  delete: "bg-red-100 text-red-700 border-red-200",
  reorder: "bg-purple-100 text-purple-700 border-purple-200"
};

const ENTITY_ICONS = {
  Event: Calendar,
  Session: Layers,
  Segment: FileText,
  EventDay: Calendar,
  PreSessionDetails: Clock
};

const ENTITY_LABELS = {
  Event: { es: 'Evento', en: 'Event' },
  Session: { es: 'Sesión', en: 'Session' },
  Segment: { es: 'Segmento', en: 'Segment' },
  EventDay: { es: 'Día', en: 'Day' },
  PreSessionDetails: { es: 'Pre-Sesión', en: 'Pre-Session' }
};

const ACTION_LABELS = {
  create: { es: 'Creado', en: 'Created' },
  update: { es: 'Actualizado', en: 'Updated' },
  delete: { es: 'Eliminado', en: 'Deleted' },
  reorder: { es: 'Reordenado', en: 'Reordered' }
};

// Field display names for common fields
const FIELD_LABELS = {
  title: { es: 'Título', en: 'Title' },
  name: { es: 'Nombre', en: 'Name' },
  presenter: { es: 'Presentador', en: 'Presenter' },
  start_time: { es: 'Hora Inicio', en: 'Start Time' },
  end_time: { es: 'Hora Fin', en: 'End Time' },
  duration_min: { es: 'Duración', en: 'Duration' },
  segment_type: { es: 'Tipo', en: 'Type' },
  description_details: { es: 'Descripción', en: 'Description' },
  projection_notes: { es: 'Notas Proyección', en: 'Projection Notes' },
  sound_notes: { es: 'Notas Sonido', en: 'Sound Notes' },
  ushers_notes: { es: 'Notas Ujieres', en: 'Ushers Notes' },
  translation_notes: { es: 'Notas Traducción', en: 'Translation Notes' },
  requires_translation: { es: 'Requiere Traducción', en: 'Requires Translation' },
  order: { es: 'Orden', en: 'Order' },
  planned_start_time: { es: 'Hora Planificada', en: 'Planned Time' },
  planned_end_time: { es: 'Hora Fin Planificada', en: 'Planned End' },
  location: { es: 'Ubicación', en: 'Location' },
  date: { es: 'Fecha', en: 'Date' },
  theme: { es: 'Tema', en: 'Theme' },
  status: { es: 'Estado', en: 'Status' },
  message_title: { es: 'Título Mensaje', en: 'Message Title' },
  scripture_references: { es: 'Citas Bíblicas', en: 'Scripture' },
  number_of_songs: { es: '# Canciones', en: '# Songs' },
  room_id: { es: 'Sala', en: 'Room' },
  prep_instructions: { es: 'Instrucciones Prep', en: 'Prep Instructions' },
  segment_actions: { es: 'Acciones', en: 'Actions' },
  color_code: { es: 'Color', en: 'Color' },
  show_in_general: { es: 'Mostrar en General', en: 'Show in General' },
  show_in_projection: { es: 'Mostrar en Proyección', en: 'Show in Projection' },
  show_in_sound: { es: 'Mostrar en Sonido', en: 'Show in Sound' },
  show_in_ushers: { es: 'Mostrar en Ujieres', en: 'Show in Ushers' },
  admin_team: { es: 'Equipo Admin', en: 'Admin Team' },
  coordinators: { es: 'Coordinadores', en: 'Coordinators' },
  sound_team: { es: 'Equipo Sonido', en: 'Sound Team' },
  lights_team: { es: 'Equipo Luces', en: 'Lights Team' },
  video_team: { es: 'Equipo Video', en: 'Video Team' },
  tech_team: { es: 'Equipo Técnico', en: 'Tech Team' },
  ushers_team: { es: 'Equipo Ujieres', en: 'Ushers Team' },
  translation_team: { es: 'Equipo Traducción', en: 'Translation Team' },
  hospitality_team: { es: 'Equipo Hospitalidad', en: 'Hospitality Team' },
  photography_team: { es: 'Equipo Fotografía', en: 'Photography Team' },
  worship_leader: { es: 'Líder Alabanza', en: 'Worship Leader' },
  session_color: { es: 'Color Sesión', en: 'Session Color' },
  is_translated_session: { es: 'Sesión Bilingüe', en: 'Bilingual Session' },
  notes: { es: 'Notas', en: 'Notes' },
  other_notes: { es: 'Otras Notas', en: 'Other Notes' },
  stage_decor_notes: { es: 'Notas Escenario', en: 'Stage Notes' },
  translator_name: { es: 'Traductor', en: 'Translator' },
  translation_mode: { es: 'Modo Traducción', en: 'Translation Mode' },
  panel_moderators: { es: 'Moderadores', en: 'Moderators' },
  panel_panelists: { es: 'Panelistas', en: 'Panelists' },
  has_video: { es: 'Tiene Video', en: 'Has Video' },
  video_name: { es: 'Nombre Video', en: 'Video Name' },
  announcement_series_id: { es: 'Serie Anuncios', en: 'Announcement Series' }
};

function FieldChangeItem({ field, change, language }) {
  const fieldLabel = FIELD_LABELS[field]?.[language] || field;
  
  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 50) + '...';
    if (typeof val === 'string' && val.length > 60) return val.slice(0, 60) + '...';
    return String(val);
  };
  
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <span className="font-medium text-slate-600 min-w-[100px]">{fieldLabel}:</span>
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span className="text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded text-xs">
          {formatValue(change.old_value)}
        </span>
        <span className="text-slate-400">→</span>
        <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded text-xs">
          {formatValue(change.new_value)}
        </span>
      </div>
    </div>
  );
}

function LogEntry({ log, language, sessions, onUndo, currentUser }) {
  const [expanded, setExpanded] = React.useState(false);
  const [undoing, setUndoing] = React.useState(false);
  const ActionIcon = ACTION_ICONS[log.action_type] || Pencil;
  const EntityIcon = ENTITY_ICONS[log.entity_type] || FileText;
  const actionColor = ACTION_COLORS[log.action_type] || ACTION_COLORS.update;
  
  // Determine if this log entry can be undone
  // - update and delete can be undone
  // - create cannot be undone (would need to delete, which is destructive)
  // - reorder could be undone but adds complexity
  const canUndo = !log.undone && (log.action_type === 'update' || log.action_type === 'delete');
  
  const handleUndo = async (e) => {
    e.stopPropagation();
    if (undoing || !canUndo) return;
    
    // Confirmation prompt - undo is a significant action
    const confirmMessage = language === 'es' 
      ? `¿Deshacer este cambio?\n\n${log.description}\n\nEsta acción no se puede revertir automáticamente.`
      : `Undo this change?\n\n${log.description}\n\nThis action cannot be automatically reverted.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setUndoing(true);
    try {
      let result;
      if (log.action_type === 'update') {
        result = await undoUpdate(log, currentUser);
      } else if (log.action_type === 'delete') {
        result = await undoDelete(log, currentUser);
      }
      
      if (result?.success) {
        onUndo?.();
        // Show success feedback (could use toast, but alert is simple and reliable)
        const successMessage = log.action_type === 'delete' && result.newEntityId
          ? (language === 'es' ? `Restaurado con nuevo ID: ${result.newEntityId}` : `Restored with new ID: ${result.newEntityId}`)
          : (language === 'es' ? 'Cambio deshecho exitosamente' : 'Change undone successfully');
        toast.success(successMessage);
      } else {
        console.error('Undo failed:', result?.error);
        // Display conflict fields if present
        const errorMessage = result?.conflictFields
          ? (language === 'es'
              ? `No se puede deshacer: campos modificados posteriormente: ${result.conflictFields.join(', ')}`
              : `Cannot undo: fields modified since: ${result.conflictFields.join(', ')}`)
          : (result?.error || 'Failed to undo');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Undo error:', error);
      toast.error(language === 'es' ? 'Error al deshacer' : 'Error undoing action');
    } finally {
      setUndoing(false);
    }
  };
  
  const entityLabel = ENTITY_LABELS[log.entity_type]?.[language] || log.entity_type;
  const actionLabel = ACTION_LABELS[log.action_type]?.[language] || log.action_type;
  
  // Get entity title from new_state or previous_state
  const entityTitle = log.new_state?.title || log.new_state?.name || 
                      log.previous_state?.title || log.previous_state?.name || '';
  
  // Get parent session name if available
  const parentSession = log.parent_id ? sessions?.find(s => s.id === log.parent_id) : null;
  
  const hasFieldChanges = log.field_changes && Object.keys(log.field_changes).length > 0;
  const fieldCount = hasFieldChanges ? Object.keys(log.field_changes).length : 0;
  
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Header - Always visible */}
      <div 
        className={`p-3 flex items-start gap-3 ${hasFieldChanges ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        onClick={() => hasFieldChanges && setExpanded(!expanded)}
      >
        {/* Action Icon */}
        <div className={`p-2 rounded-lg ${actionColor} border flex-shrink-0`}>
          <ActionIcon className="w-4 h-4" />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs gap-1">
              <EntityIcon className="w-3 h-3" />
              {entityLabel}
            </Badge>
            <Badge className={`text-xs ${actionColor} border`}>
              {actionLabel}
            </Badge>
            {entityTitle && (
              <span className="font-semibold text-slate-900 truncate">{entityTitle}</span>
            )}
          </div>
          
          {/* Description */}
          <p className="text-sm text-slate-600 mt-1">{log.description}</p>
          
          {/* Parent context */}
          {parentSession && (
            <p className="text-xs text-slate-500 mt-0.5">
              en sesión: {parentSession.name}
            </p>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestampToEST(log.created_date)}
            </span>
            {log.user_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {log.user_name}
              </span>
            )}
            {fieldCount > 0 && (
              <span className="text-blue-600">
                {fieldCount} {language === 'es' ? 'campo(s) modificado(s)' : 'field(s) changed'}
              </span>
            )}
          </div>
        </div>
        
        {/* Undo button and Expand indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canUndo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={undoing}
              className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              title={language === 'es' ? 'Deshacer' : 'Undo'}
            >
              {undoing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Undo2 className="w-4 h-4" />
              )}
            </Button>
          )}
          {hasFieldChanges && (
            <div className="text-slate-400">
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded Field Changes */}
      {expanded && hasFieldChanges && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {language === 'es' ? 'Cambios Detallados' : 'Detailed Changes'}
          </p>
          <div className="space-y-1">
            {Object.entries(log.field_changes).map(([field, change]) => (
              <FieldChangeItem key={field} field={field} change={change} language={language} />
            ))}
          </div>
        </div>
      )}
      
      {/* Undone indicator */}
      {log.undone && (
        <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ↩️ {language === 'es' ? 'Deshecho' : 'Undone'} {log.undone_at && `• ${formatTimestampToEST(log.undone_at)}`}
          {log.undone_by && ` • por ${log.undone_by}`}
        </div>
      )}
    </div>
  );
}

export default function EditHistoryModal({ open, onClose, eventId, sessions = [], currentUser = null }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  
  // Fetch logs for this event and all its sessions
  const sessionIds = React.useMemo(() => sessions.map(s => s.id), [sessions]);
  
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['editActionLogs', eventId, sessionIds.join(',')],
    queryFn: async () => {
      // Fetch logs for the event itself
      const eventLogs = await base44.entities.EditActionLog.filter(
        { entity_id: eventId },
        '-created_date',
        100
      );
      
      // Fetch logs for sessions and segments (parent_id = event or session)
      const parentIds = [eventId, ...sessionIds];
      const childLogs = await Promise.all(
        parentIds.map(pid => 
          base44.entities.EditActionLog.filter({ parent_id: pid }, '-created_date', 50)
        )
      );
      
      // Combine and dedupe
      const allLogs = [...eventLogs, ...childLogs.flat()];
      const seen = new Set();
      const deduped = allLogs.filter(log => {
        if (seen.has(log.id)) return false;
        seen.add(log.id);
        return true;
      });
      
      // Sort by created_date descending
      return deduped.sort((a, b) => 
        new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
      );
    },
    enabled: open && !!eventId,
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Group logs by date in America/New_York timezone (ET)
  // This ensures consistent date grouping matching the timestamp display format
  const groupedLogs = React.useMemo(() => {
    const groups = {};
    for (const log of logs) {
      // Normalize timestamp: if no timezone info, assume UTC
      let ts = String(log.created_date);
      if (!(/[zZ]|[+\-]\d{2}:?\d{2}$/.test(ts))) ts += 'Z';
      
      const d = new Date(ts);
      // Format date in America/New_York timezone for grouping
      const date = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    }
    return groups;
  }, [logs, language]);
  
  const dateKeys = Object.keys(groupedLogs);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="w-5 h-5 text-slate-600" />
            {language === 'es' ? 'Historial de Cambios' : 'Edit History'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              {language === 'es' ? 'Cargando historial...' : 'Loading history...'}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {language === 'es' 
                  ? 'No hay cambios registrados aún' 
                  : 'No changes recorded yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'es'
                  ? 'Los cambios futuros aparecerán aquí'
                  : 'Future changes will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {dateKeys.map((date, idx) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">
                        {date}
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  </div>
                  
                  {/* Logs for this date */}
                  <div className="space-y-3 mt-3">
                    {groupedLogs[date].map(log => (
                      <LogEntry 
                        key={log.id} 
                        log={log} 
                        language={language}
                        sessions={sessions}
                        currentUser={currentUser}
                        onUndo={() => {
                          // Invalidate logs and entity queries
                          queryClient.invalidateQueries(['editActionLogs']);
                          queryClient.invalidateQueries(['sessions']);
                          queryClient.invalidateQueries(['segments']);
                          queryClient.invalidateQueries(['event']);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        {logs.length > 0 && (
          <div className="border-t border-slate-200 pt-3 mt-2 text-xs text-slate-500 text-center">
            {language === 'es' 
              ? `${logs.length} cambio(s) registrado(s)` 
              : `${logs.length} change(s) recorded`}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}