import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, MapPin, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SessionManager from "../components/event/SessionManager";

export default function ServiceDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('id');

  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => base44.entities.Service.filter({ id: serviceId }).then(res => res[0]),
    enabled: !!serviceId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', serviceId],
    queryFn: () => base44.entities.Session.filter({ service_id: serviceId }, 'order'),
    enabled: !!serviceId,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', serviceId],
    queryFn: async () => {
      const allSegments = await base44.entities.Segment.list();
      const sessionIds = sessions.map(s => s.id);
      return allSegments.filter(seg => sessionIds.includes(seg.session_id));
    },
    enabled: sessions.length > 0,
  });

  if (!service) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cargando servicio...</p>
      </div>
    );
  }

  const dayLabels = {
    Sunday: "Domingo",
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miércoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sábado"
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Services"))} className="hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-500" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 uppercase font-['Bebas_Neue'] tracking-tight">{service.name}</h1>
              <Badge className="bg-pdv-teal text-white hover:bg-pdv-teal/90">{dayLabels[service.day_of_week]}</Badge>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
              {service.time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Horario habitual: {service.time}</span>
                </div>
              )}
              {service.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{service.location}</span>
                </div>
              )}
            </div>
            
            {service.description && (
              <p className="text-gray-500 mt-3 max-w-2xl">{service.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <SessionManager 
          serviceId={serviceId} 
          sessions={sessions} 
          segments={segments}
        />
      </div>
    </div>
  );
}