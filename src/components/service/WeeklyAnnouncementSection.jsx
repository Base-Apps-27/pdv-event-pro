import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { sanitizeHtml } from "@/components/utils/sanitizeHtml";

/**
 * WeeklyAnnouncementSection — Extracted from WeeklyServiceManager (Phase 3A).
 * Renders the full "Anuncios" card with fixed + dynamic announcement lists,
 * bulk selection controls, and per-announcement edit/delete/priority actions.
 *
 * Props:
 *   fixedAnnouncements      — array of General category AnnouncementItem records
 *   dynamicAnnouncements    — array of non-General active announcements + promoted events
 *   selectedAnnouncements   — array of selected announcement IDs
 *   setSelectedAnnouncements — setter for selected IDs
 *   onNewAnnouncement       — callback to open create dialog
 *   onEditAnnouncement      — callback(ann) to open edit dialog
 *   onDeleteAnnouncement    — callback(id) to trigger delete confirm
 *   onMovePriority          — callback(ann, direction) to change priority
 *   onUpdateEvent           — callback({id, data}) for event video toggle
 *   canCreate               — boolean permission
 *   canEdit                 — boolean permission
 *   canDelete               — boolean permission
 *   tealStyle               — inline style object for teal buttons
 */
export default function WeeklyAnnouncementSection({
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  setSelectedAnnouncements,
  onNewAnnouncement,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onMovePriority,
  onUpdateEvent,
  canCreate,
  canEdit,
  canDelete,
  tealStyle,
}) {
  return (
    <Card className="print:hidden border-2 border-gray-300 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
          {canCreate && (
            <Button onClick={onNewAnnouncement} size="sm" style={tealStyle} className="print:hidden">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Anuncio
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bulk Selection Controls */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const allFixed = fixedAnnouncements.map(a => a.id);
              setSelectedAnnouncements(prev => [...new Set([...prev, ...allFixed])]);
            }}
          >
            ✓ Seleccionar todos los fijos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const allDynamic = dynamicAnnouncements.map(a => a.id);
              setSelectedAnnouncements(prev => [...new Set([...prev, ...allDynamic])]);
            }}
          >
            ✓ Seleccionar dinámicos relevantes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const defaultSelection = [
                ...fixedAnnouncements.map(a => a.id),
                ...dynamicAnnouncements.map(a => a.id)
              ];
              setSelectedAnnouncements(defaultSelection);
            }}
          >
            ⟲ Restaurar selección por defecto
          </Button>
        </div>

        {/* Fixed Announcements */}
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Label className="text-base font-bold text-gray-900">Anuncios Fijos / Static Announcements</Label>
            <p className="text-xs text-gray-600 mt-1">
              Los anuncios fijos aparecen cada semana. Manténgalos cortos y use el formato para claridad, no para longitud.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Static announcements appear every week. Keep them short and use formatting for clarity, not length.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {fixedAnnouncements.map(ann => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                isSelected={selectedAnnouncements.includes(ann.id)}
                onToggleSelect={(checked) => {
                  setSelectedAnnouncements(prev =>
                    checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                  );
                }}
                onEdit={() => onEditAnnouncement(ann)}
                onDelete={() => onDeleteAnnouncement(ann.id)}
                onMovePriority={onMovePriority}
                canEdit={canEdit}
                canDelete={canDelete}
                variant="fixed"
              />
            ))}
          </div>
        </div>

        {/* Dynamic Announcements */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-bold text-gray-900">Anuncios Dinámicos</Label>
            <p className="text-xs text-gray-600 mt-1">
              Anuncios de Eventos, Ministerios o Urgentes activos. Expiran automáticamente después de su Fecha de Ocurrencia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {dynamicAnnouncements.map(ann => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                isSelected={selectedAnnouncements.includes(ann.id)}
                onToggleSelect={(checked) => {
                  setSelectedAnnouncements(prev =>
                    checked ? [...prev, ann.id] : prev.filter(id => id !== ann.id)
                  );
                }}
                onEdit={() => onEditAnnouncement(ann)}
                onDelete={() => onDeleteAnnouncement(ann.id)}
                onMovePriority={onMovePriority}
                onUpdateEvent={onUpdateEvent}
                canEdit={canEdit}
                canDelete={canDelete}
                variant="dynamic"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AnnouncementCard — renders a single announcement with checkbox, content, and action buttons.
 */
function AnnouncementCard({ ann, isSelected, onToggleSelect, onEdit, onDelete, onMovePriority, onUpdateEvent, canEdit, canDelete, variant }) {
  const isDynamic = variant === "dynamic";
  const isEmphasized = isDynamic && (ann.emphasize || ann.category === 'Urgent');
  const borderClass = isDynamic
    ? (isEmphasized ? 'border-[3px] border-red-400 bg-red-50' : 'border-2 border-blue-300 bg-blue-50')
    : 'border-2 border-gray-300 bg-white hover:border-gray-400';

  const displayTitle = ann.isEvent ? ann.name : ann.title;
  const displayContent = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg transition-colors ${borderClass}`}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-sm leading-tight">{displayTitle}</h3>
              {ann.isEvent && <Badge className="bg-purple-200 text-purple-800 text-[10px]">Evento</Badge>}
              {!ann.isEvent && isEmphasized && <Badge className="bg-red-100 text-red-700 text-[10px] border border-red-300">⚡ DESTACADO</Badge>}
            </div>
            {isDynamic && (ann.date_of_occurrence || ann.start_date) && (
              <p className="text-xs font-semibold text-blue-600 mb-1">
                📅 {ann.date_of_occurrence || ann.start_date} {ann.end_date && `- ${ann.end_date}`}
              </p>
            )}
          </div>
          {ann.isEvent && isDynamic && onUpdateEvent && (
            <div className="flex items-center gap-1 print:hidden">
              <Checkbox
                checked={ann.announcement_has_video}
                onCheckedChange={(checked) => {
                  onUpdateEvent({ id: ann.id, data: { ...ann, announcement_has_video: checked } });
                }}
              />
              <span className="text-xs font-semibold text-purple-700">📹</span>
            </div>
          )}
          {!ann.isEvent && canEdit && (
            <div className="flex gap-1 flex-shrink-0 print:hidden">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMovePriority(ann, 'up')}>
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMovePriority(ann, 'down')}>
                <ChevronDown className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Edit className="w-3 h-3" />
              </Button>
              {canDelete && (
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center hover:bg-red-50 rounded"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                </button>
              )}
            </div>
          )}
        </div>
        <div
          className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
        />
        {ann.instructions && (
          <div className="bg-gray-100 border border-gray-300 rounded p-2 mt-2">
            <p className="text-[10px] text-gray-600 font-semibold mb-1">📋 Instrucciones (solo presentador):</p>
            <div
              className="text-[10px] text-gray-600 italic whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.instructions) }}
            />
          </div>
        )}
        {(ann.has_video || ann.announcement_has_video) && (
          <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">📹 Video</Badge>
        )}
      </div>
    </div>
  );
}