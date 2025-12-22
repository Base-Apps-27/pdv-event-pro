import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import SessionColumn from "./SessionColumn";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function ServiceBuilder({ serviceId }) {
  const queryClient = useQueryClient();

  // Fetch Service
  const { data: service, isLoading: loadingService } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => base44.entities.Service.filter({ id: serviceId }).then(res => res[0]),
    enabled: !!serviceId
  });

  // Fetch Sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions', serviceId],
    queryFn: () => base44.entities.Session.filter({ service_id: serviceId }),
    enabled: !!serviceId
  });

  // Fetch All Segments for these sessions
  const sessionIds = sessions.map(s => s.id);
  const sessionIdsKey = React.useMemo(
    () => sessionIds.sort().join(','),
    [sessionIds.join(',')]
  );
  
  const { data: segments = [], isLoading: loadingSegments } = useQuery({
    queryKey: ['segments', serviceId, sessionIdsKey],
    queryFn: async () => {
        if (sessionIds.length === 0) return [];
        const response = await base44.functions.invoke('getSegmentsBySessionIds', { sessionIds });
        return response.data.segments || [];
    },
    enabled: !!serviceId && sessionIds.length > 0
  });

  // Update Segment Mutation
  const updateSegmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Segment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['segments']);
    }
  });

  // Recalculate Timeline Logic (Reused from SessionManager)
  const recalculateTimesMutation = useMutation({
    mutationFn: async (sessionId) => {
      const sessionSegments = segments
        .filter(seg => seg.session_id === sessionId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const updatedSegments = [];
      for (let i = 0; i < sessionSegments.length; i++) {
        const segment = sessionSegments[i];
        const previousSegment = i > 0 ? updatedSegments[i - 1] : null;

        let newStartTime = segment.start_time;
        if (previousSegment && previousSegment.end_time) {
          newStartTime = previousSegment.end_time;
        }

        let newEndTime = segment.end_time;
        if (newStartTime && segment.duration_min) {
          const [hours, minutes] = newStartTime.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + segment.duration_min;
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        }

        updatedSegments.push({
          id: segment.id,
          start_time: newStartTime,
          end_time: newEndTime
        });
      }

      await Promise.all(
        updatedSegments.map(seg => 
          base44.entities.Segment.update(seg.id, {
            start_time: seg.start_time,
            end_time: seg.end_time
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['segments']);
    },
  });


  // "Copy People from Last Week" Logic
  const copyPeopleMutation = useMutation({
    mutationFn: async () => {
        if (!service) return;
        
        // 1. Find last service of same type (name)
        // This assumes 'name' like 'Domingo AM' is the type identifier.
        // We need to find a service with same name, different ID, date < current date, sort by date desc, limit 1.
        // SDK filter might be limited. Let's fetch recent 20 services and find match.
        const recentServices = await base44.entities.Service.list('-created_date', 50);
        const lastService = recentServices.find(s => 
            s.name === service.name && 
            s.id !== service.id && 
            s.status === 'active'
        );

        if (!lastService) {
            alert("No se encontró un servicio anterior con el mismo nombre.");
            return;
        }

        if(!confirm(`¿Copiar personas del servicio "${lastService.name}" (${lastService.day_of_week}) al actual?`)) return;

        // 2. Get sessions of last service
        const lastSessions = await base44.entities.Session.filter({ service_id: lastService.id });
        
        // 3. Map and copy fields
        // We try to match sessions by name or order
        for (const currentSession of sessions) {
            const match = lastSessions.find(ls => ls.name === currentSession.name) || lastSessions[currentSession.order - 1];
            
            if (match) {
                // Update Session People
                await base44.entities.Session.update(currentSession.id, {
                    admin_team: match.admin_team,
                    coordinators: match.coordinators,
                    sound_team: match.sound_team,
                    tech_team: match.tech_team,
                    ushers_team: match.ushers_team,
                    translation_team: match.translation_team,
                    hospitality_team: match.hospitality_team,
                    photography_team: match.photography_team,
                    worship_leader: match.worship_leader
                });

                // Optional: Copy presenter names for similar segments? 
                // That might be risky as order/structure changes. Let's stick to session-level teams for now as requested in point 3 ("Add copy people... at session level").
            }
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries(['sessions']);
        alert("Personal copiado exitosamente.");
    }
  });


  if (loadingService || loadingSessions) return <div>Cargando Builder...</div>;

  const sortedSessions = [...sessions].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold uppercase font-['Bebas_Neue']">{service.name}</h2>
            <p className="text-gray-500">Constructor de Servicio Semanal</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyPeopleMutation.mutate()} disabled={copyPeopleMutation.isPending}>
                <Users className="w-4 h-4 mr-2" />
                Copiar Personal (Semana Anterior)
            </Button>
        </div>
      </div>

      <div className="space-y-6">
        {sortedSessions.map(session => (
            <SessionColumn 
                key={session.id}
                session={session}
                segments={segments}
                onUpdateSegment={(id, data) => updateSegmentMutation.mutate({ id, data })}
                onRecalculate={(sid) => recalculateTimesMutation.mutate(sid)}
            />
        ))}
      </div>
    </div>
  );
}