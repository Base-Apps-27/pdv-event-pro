import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Edit, Trash2, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SessionManager from "../components/event/SessionManager";
import EventInfo from "../components/event/EventInfo";

export default function EventDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
  const queryClient = useQueryClient();

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

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cargando evento...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Events"))}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
          {event.theme && <p className="text-slate-600 italic">"{event.theme}"</p>}
        </div>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="sessions">Sesiones</TabsTrigger>
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
      </Tabs>
    </div>
  );
}