import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasPermission } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { Plus, Calendar, MapPin, Edit, Trash2, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DeleteEventDialog from "@/components/event/DeleteEventDialog";
import DuplicateEventDialog from "@/components/event/DuplicateEventDialog";
import TemplateSelectorDialog from "@/components/event/TemplateSelectorDialog";
import EventEditDialog from "@/components/event/EventEditDialog";

export default function Events() {
  const { t } = useLanguage();
  // P2-2: Using shared brandStyles (2026-02-12) — imported at module level would be ideal
  // but kept inline for minimal diff; brandStyles.js exists as single source of truth
  const gradientStyle = { background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' };
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [eventToDuplicate, setEventToDuplicate] = useState(null);
  const [eventToTemplate, setEventToTemplate] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  // P1-4: Replaced duplicate user fetch with shared hook (2026-02-12)
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const events = allEvents.filter(e => e.status !== 'template');

  // UX-AUDIT #6 FIX (2026-03-06): create/update now handled by EventEditDialog.
  // Only deleteMutation remains here since DeleteEventDialog needs it.
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setEventToDelete(null);
    },
    onError: (err) => toast.error(t('errors.deleteFailed') + ': ' + err.message),
  });

  const handleDeleteClick = (event) => {
    setEventToDelete(event);
  };

  // UX-AUDIT #6 (2026-03-06): Use shared EventEditDialog instead of inline form
  const openEditDialog = (event) => {
    setEditingEvent(event);
    setShowDialog(true);
  };

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  const statusLabels = {
    planning: t('status.planning'),
    confirmed: t('status.confirmed'),
    in_progress: t('status.in_progress'),
    completed: t('status.completed'),
    archived: t('status.archived')
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl md:text-5xl text-gray-900 uppercase tracking-tight">{t('events.title')}</h1>
          <p className="text-gray-500 mt-1 font-medium">{t('events.subtitle')}</p>
        </div>
        {hasPermission(user, 'create_events') && (
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowTemplateSelector(true)} 
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all font-bold uppercase px-4 border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Copy className="w-4 h-4 mr-2" />
              {t('events.fromTemplate')}
            </Button>
            <Button onClick={() => openEditDialog(null)} className="text-white shadow-md hover:shadow-lg hover:scale-105 transition-all font-bold uppercase px-6" style={gradientStyle}>
              <Plus className="w-5 h-5 mr-2" />
              {t('events.newEvent')}
            </Button>
          </div>
        )}
        </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Card key={event.id} className="group hover:shadow-xl transition-all duration-300 bg-white border-none shadow-md overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${statusColors[event.status].replace('bg-', 'bg-').replace('text-', '').split(' ')[0]}`} />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2 font-bold uppercase text-gray-900 transition-colors" style={{'--hover-color': '#1F8A70'}}>{event.name}</CardTitle>
                  <Badge className={`${statusColors[event.status]} border-none font-bold uppercase tracking-wider text-[10px]`}>
                    {statusLabels[event.status]}
                  </Badge>
                </div>
                <div className="text-4xl font-bold text-gray-100 font-['Bebas_Neue'] select-none">{event.year}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {event.theme && (
                  <p className="text-sm font-semibold italic" style={{ color: '#8DC63F' }}>"{event.theme}"</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location || t('events.noLocation')}</span>
                </div>

                {event.start_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{event.start_date} {event.end_date && `- ${event.end_date}`}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Link to={createPageUrl(`EventDetail?id=${event.id}`)} className="flex-1 min-w-[100px]">
                    <Button variant="outline" size="sm" className="w-full" style={{ borderColor: '#1F8A70', color: '#1F8A70' }}>
                      {t('events.viewDetails')}
                    </Button>
                  </Link>
                  <div className="flex gap-1 shrink-0">
                    {hasPermission(user, 'edit_events') && (
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {hasPermission(user, 'create_events') && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEventToDuplicate(event)}
                          title={t('events.duplicate')}
                        >
                          <Copy className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEventToTemplate(event)}
                          title={t('events.saveAsTemplate')}
                        >
                          <Save className="w-4 h-4 text-amber-600" />
                        </Button>
                      </>
                    )}
                    {hasPermission(user, 'delete_events') && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteClick(event)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* UX-AUDIT #6 (2026-03-06): Unified EventEditDialog for both create and edit */}
      <EventEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        event={editingEvent}
        onSaved={() => {
          queryClient.invalidateQueries(['events']);
          setShowDialog(false);
          setEditingEvent(null);
        }}
        user={user}
      />

      <DeleteEventDialog 
        open={!!eventToDelete} 
        onOpenChange={(open) => !open && setEventToDelete(null)}
        onConfirm={() => deleteMutation.mutate(eventToDelete.id)}
        eventName={eventToDelete?.name}
      />

      <DuplicateEventDialog
        open={!!eventToDuplicate}
        onOpenChange={(open) => !open && setEventToDuplicate(null)}
        event={eventToDuplicate}
        mode="duplicate"
      />

      <DuplicateEventDialog
        open={!!eventToTemplate}
        onOpenChange={(open) => !open && setEventToTemplate(null)}
        event={eventToTemplate}
        mode="template"
      />

      <TemplateSelectorDialog
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onSelect={(template) => {
          setShowTemplateSelector(false);
          setSelectedTemplate(template);
        }}
      />

      <DuplicateEventDialog
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        event={selectedTemplate}
        mode="from_template"
      />
    </div>
  );
}