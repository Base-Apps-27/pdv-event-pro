import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { sanitizeHtml } from "@/components/utils/sanitizeHtml";

export default function AnnouncementListSelector({ 
  selectedAnnouncementIds = [], 
  onSelectionChange, 
  serviceDate 
}) {
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const fixedAnnouncements = allAnnouncements.filter(a => a.category === 'General' && a.is_active);

  const { data: dynamicAnnouncements = [] } = useQuery({
    queryKey: ['dynamicAnnouncements', serviceDate],
    queryFn: async () => {
      const selDate = serviceDate ? new Date(serviceDate + 'T00:00:00') : new Date();
      const [items, events] = await Promise.all([
        base44.entities.AnnouncementItem.list(),
        base44.entities.Event.list()
      ]);
      
      const filteredItems = items.filter(a => {
        if (a.category === 'General' || !a.is_active) return false;
        if (!a.date_of_occurrence) return false;
        const occurrenceDate = new Date(a.date_of_occurrence + 'T00:00:00');
        return occurrenceDate >= selDate;
      });

      const filteredEvents = events.filter(e => {
        if (!e.promote_in_announcements || !e.start_date) return false;
        const eventStartDate = new Date(e.start_date + 'T00:00:00');
        return eventStartDate >= selDate;
      });

      const combined = [
        ...filteredItems.map(a => ({ ...a, sortDate: new Date(a.date_of_occurrence + 'T00:00:00') })),
        ...filteredEvents.map(e => ({ ...e, isEvent: true, sortDate: new Date(e.start_date + 'T00:00:00') }))
      ];

      return combined.sort((a, b) => a.sortDate - b.sortDate);
    },
    enabled: !!serviceDate
  });

  const handleCheckboxChange = (announcementId, checked) => {
    const newSelection = checked 
      ? [...selectedAnnouncementIds, announcementId] 
      : selectedAnnouncementIds.filter(id => id !== announcementId);
    onSelectionChange(newSelection);
  };

  return (
    <Card className="print:hidden border-2 border-gray-300 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold uppercase">Anuncios</CardTitle>
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
              onSelectionChange([...new Set([...selectedAnnouncementIds, ...allFixed])]);
            }}
          >
            ✓ Seleccionar todos los fijos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const allDynamic = dynamicAnnouncements.map(a => a.id);
              onSelectionChange([...new Set([...selectedAnnouncementIds, ...allDynamic])]);
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
              onSelectionChange(defaultSelection);
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
              <div key={ann.id} className="flex items-start gap-2 p-3 border-2 border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors">
                <Checkbox
                  checked={selectedAnnouncementIds.includes(ann.id)}
                  onCheckedChange={(checked) => handleCheckboxChange(ann.id, checked)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm leading-tight">{ann.title}</h3>
                  </div>
                  <div 
                    className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.content) }}
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
                  {ann.has_video && (
                    <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                      📹 Video
                    </Badge>
                  )}
                </div>
              </div>
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
              <div key={ann.id} className={`flex items-start gap-2 p-3 rounded-lg transition-colors ${ann.emphasize || ann.category === 'Urgent' ? 'border-[3px] border-red-400 bg-red-50' : 'border-2 border-blue-300 bg-blue-50'}`}>
                <Checkbox
                  checked={selectedAnnouncementIds.includes(ann.id)}
                  onCheckedChange={(checked) => handleCheckboxChange(ann.id, checked)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm leading-tight">{ann.isEvent ? ann.name : ann.title}</h3>
                        {ann.isEvent && <Badge className="bg-purple-200 text-purple-800 text-[10px]">Evento</Badge>}
                        {!ann.isEvent && (ann.emphasize || ann.category === 'Urgent') && <Badge className="bg-red-100 text-red-700 text-[10px] border border-red-300">⚡ DESTACADO</Badge>}
                      </div>
                      {(ann.date_of_occurrence || ann.start_date) && (
                        <p className="text-xs font-semibold text-blue-600 mb-1">
                          📅 {ann.date_of_occurrence || ann.start_date} {ann.end_date && `- ${ann.end_date}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div 
                    className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.isEvent ? ann.announcement_blurb || ann.description : ann.content) }}
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
                    <Badge className="bg-purple-100 text-purple-800 text-[10px] mt-2">
                      📹 Video
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}