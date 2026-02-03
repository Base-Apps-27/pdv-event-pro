import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Edit, Trash2, Calendar, Clock, Bookmark, Copy, Sparkles, FileText, History } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SessionManager from "../components/event/SessionManager";
import EventInfo from "../components/event/EventInfo";
import EventEditDialog from "../components/event/EventEditDialog";
import EventCalendar from "../components/event/EventCalendar";
import EventAIHelper from "../components/event/EventAIHelper";
import EditHistoryModal from "../components/event/EditHistoryModal";

export default function EventDetail() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const eventId = React.useMemo(() => new URLSearchParams(search).get("id"), [search]);
  const queryClient = useQueryClient();
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [headerEvent, setHeaderEvent] = useState(null);
  const [wasValid, setWasValid] = React.useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user for logging
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        console.error('Failed to fetch user:', e);
      }
    };
    fetchUser();
  }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const res = await base44.entities.Event.filter({ id: eventId });
      const e = res?.[0] ?? null;
      return e ? JSON.parse(JSON.stringify(e)) : null;
    },
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (event?.name) {
      setHeaderEvent(event);
      setWasValid(true);
    }
  }, [event?.name]);

  React.useEffect(() => {
    if (wasValid && !event?.name) {
      console.warn("[DATA INTEGRITY] Event object became invalid after being valid. This indicates the base44.entities SDK may be mutating returned objects.", {
        eventId,
        eventSnapshot: event,
        timestamp: new Date().toISOString()
      });
    }
  }, [wasValid, event?.name]);

  const { data: sessionsRaw = [] } = useQuery({
    queryKey: ['sessions', eventId],
    queryFn: () => base44.entities.Session.filter({ event_id: eventId }, 'order'),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Sort sessions chronologically by date and start_time
  const sessions = React.useMemo(() => {
    return [...sessionsRaw].sort((a, b) => {
      // Handle null dates - put sessions without dates at the end
      const aDate = a.date || '';
      const bDate = b.date || '';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      const aTime = a.planned_start_time || '';
      const bTime = b.planned_start_time || '';
      return aTime.localeCompare(bTime);
    });
  }, [sessionsRaw]);

  // CRITICAL: sessionIdsKey MUST be sorted for stable query key
  // Without sorting, key changes when sessions reorder, causing unnecessary refetches
  // Decision Log: Segment Query Key Centralization (2025)
  const sessionIdsKey = React.useMemo(
    () => sessions.map(s => s.id).sort().join(','),
    [sessions]
  );

  // DEBUG: Log when segments query runs (remove after verification)
  const { data: segments = [] } = useQuery({
    queryKey: ['segments', eventId, sessionIdsKey],
    queryFn: async () => {
      console.log('[EventDetail] segments queryFn RUNNING', { eventId, sessionIdsKey, timestamp: new Date().toISOString() });
      if (sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const response = await base44.functions.invoke('getSegmentsBySessionIds', { sessionIds });
      console.log('[EventDetail] segments queryFn COMPLETE', { count: response.data.segments?.length });
      return response.data.segments || [];
    },
    enabled: !!eventId && sessions.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['allSessions', eventId],
    queryFn: () => base44.entities.Session.filter({ event_id: eventId }, 'order'),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // DEBUG: Log when allSegments query runs (remove after verification)
  const { data: allSegments = [] } = useQuery({
    queryKey: ['allSegments', eventId, sessionIdsKey],
    queryFn: async () => {
      console.log('[EventDetail] allSegments queryFn RUNNING', { eventId, sessionIdsKey, timestamp: new Date().toISOString() });
      if (sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const response = await base44.functions.invoke('getSegmentsBySessionIds', { sessionIds });
      console.log('[EventDetail] allSegments queryFn COMPLETE', { count: response.data.segments?.length });
      return response.data.segments || [];
    },
    enabled: !!eventId && sessions.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cargando evento...</p>
      </div>
    );
  }
  
  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Evento no encontrado</p>
      </div>
    );
  }

  const e = headerEvent ?? event;

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section with subtle gradient background */}
      <div className="relative z-10 bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Events"))} className="hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-500" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 uppercase font-['Bebas_Neue'] tracking-tight">{e.name}</h1>
              <Badge variant="outline" className="text-xs uppercase tracking-wider border-gray-300 text-gray-500">{e.year}</Badge>
              {e.origin === 'template' && (
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
              {e.origin === 'duplicate' && (
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
            {e.theme && <p className="text-xl font-medium italic" style={{ color: '#1F8A70' }}>"{e.theme}"</p>}
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
              onClick={() => setShowEditHistory(true)}
              variant="outline"
              className="border-gray-300 hover:border-gray-400 text-gray-700"
            >
              <History className="w-4 h-4 mr-2" />
              Historial
            </Button>
            <Button 
              onClick={() => setShowEditEvent(true)}
              variant="outline"
              className="border-gray-300 hover:border-gray-400 text-gray-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
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

      <EventEditDialog 
        open={showEditEvent}
        onOpenChange={setShowEditEvent}
        event={e}
        onSaved={() => { queryClient.invalidateQueries(['event', eventId]); }}
        user={currentUser}
      />

      <EditHistoryModal
        open={showEditHistory}
        onClose={() => setShowEditHistory(false)}
        eventId={eventId}
        sessions={sessions}
        currentUser={currentUser}
      />

       <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl bg-gray-100">
          <TabsTrigger value="info" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Información</TabsTrigger>
          <TabsTrigger value="sessions" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Sesiones</TabsTrigger>
          <TabsTrigger value="calendar" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <EventInfo event={e} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <SessionManager 
            eventId={eventId} 
            event={e}
            sessions={sessions} 
            segments={segments}
            user={currentUser}
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