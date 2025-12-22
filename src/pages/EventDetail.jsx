import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Edit, Trash2, Calendar, Clock, Bookmark, Copy, Sparkles, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SessionManager from "../components/event/SessionManager";
import EventInfo from "../components/event/EventInfo";
import EventCalendar from "../components/event/EventCalendar";
import EventAIHelper from "../components/event/EventAIHelper";

export default function EventDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [showAIHelper, setShowAIHelper] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }).then(res => res[0]),
    enabled: !!eventId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: () => base44.entities.Session.filter({ event_id: eventId }, 'order'),
    enabled: !!eventId,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', eventId],
    queryFn: async () => {
      const allSegments = await base44.entities.Segment.list();
      const sessionIds = sessions.map(s => s.id);
      return allSegments.filter(seg => sessionIds.includes(seg.session_id));
    },
    enabled: sessions.length > 0,
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['allSessions'],
    queryFn: () => base44.entities.Session.list(),
  });

  const { data: allSegments = [] } = useQuery({
    queryKey: ['allSegments'],
    queryFn: () => base44.entities.Segment.list(),
  });

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cargando evento...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section with subtle gradient background */}
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Events"))} className="hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-500" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 uppercase font-['Bebas_Neue'] tracking-tight">{event.name}</h1>
              <Badge variant="outline" className="text-xs uppercase tracking-wider border-gray-300 text-gray-500">{event.year}</Badge>
              {event.origin === 'template' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="h-6 px-2 bg-blue-50 text-blue-600 border-blue-200 text-xs">
                        <Bookmark className="w-3 h-3 mr-1" />
                        Plantilla
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Este evento fue creado desde una plantilla</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {event.origin === 'duplicate' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="h-6 px-2 bg-amber-50 text-amber-600 border-amber-200 text-xs">
                        <Copy className="w-3 h-3 mr-1" />
                        Copia
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Este evento es una copia duplicada</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {event.theme && <p className="text-xl font-medium italic" style={{ color: '#1F8A70' }}>"{event.theme}"</p>}
          </div>
          <div className="ml-auto flex gap-2">
            <Button 
              onClick={() => navigate(createPageUrl("Reports") + `?eventId=${eventId}`)}
              variant="outline"
              className="border-gray-300 hover:border-gray-400 text-gray-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              Reportes
            </Button>
            <Button 
              onClick={() => setShowAIHelper(true)}
              variant="outline"
              style={{ 
                background: 'linear-gradient(to right, rgba(31, 138, 112, 0.1), rgba(141, 198, 63, 0.1))',
                borderColor: 'rgba(31, 138, 112, 0.3)',
                color: '#1F8A70'
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Asistente IA
            </Button>
          </div>
        </div>
      </div>

      <EventAIHelper 
        eventId={eventId} 
        isOpen={showAIHelper} 
        onClose={() => setShowAIHelper(false)} 
      />

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl bg-gray-100">
          <TabsTrigger value="info" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Información</TabsTrigger>
          <TabsTrigger value="sessions" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Sesiones</TabsTrigger>
          <TabsTrigger value="calendar" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <EventInfo event={event} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <SessionManager 
            eventId={eventId} 
            sessions={sessions} 
            segments={segments}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <EventCalendar 
            eventId={eventId}
            sessions={sessions}
            allSessions={allSessions}
            segments={allSegments}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}