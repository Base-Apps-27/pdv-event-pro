import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Clock, Users, FileText, Plus, ArrowRight, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const navigate = useNavigate();
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)'
  };
  
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year')
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list()
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list()
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments'],
    queryFn: () => base44.entities.Segment.list()
  });

  const upcomingEvents = events
    .filter((e) => e.status !== 'completed' && e.status !== 'archived' && e.status !== 'template')
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    });
  const nextEvent = upcomingEvents[0];

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="gradient-pdv text-white py-8 px-6 md:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-wide mb-2">
              Panel de Control
            </h1>
            <p className="text-white/90 text-base">
              Gestiona eventos especiales y servicios semanales
            </p>
          </div>
          
          {/* Two Pillars */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/20 transition-all cursor-pointer" onClick={() => navigate(createPageUrl('Events'))}>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase">Eventos Especiales</h3>
                  <p className="text-white/80 text-sm">Congresos, retiros, conferencias</p>
                </div>
              </div>
              <Button className="w-full bg-white text-pdv-teal hover:bg-gray-100 font-semibold">
                Ver Eventos
              </Button>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/20 transition-all cursor-pointer" onClick={() => navigate(createPageUrl('Services'))}>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase">Servicios Semanales</h3>
                  <p className="text-white/80 text-sm">Domingos, miércoles, operación regular</p>
                </div>
              </div>
              <Button className="w-full bg-white text-pdv-teal hover:bg-gray-100 font-semibold">
                Ver Servicios
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - Two Pillars Side by Side */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* EVENTS PILLAR */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-pdv-teal" />
              <h2 className="text-xl font-bold text-gray-900 uppercase">Eventos Especiales</h2>
            </div>
            <div className="space-y-4">
              <Card className="bg-white shadow hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-xs font-medium uppercase">Total Eventos</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{events.filter(e => e.status !== 'template').length}</p>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-xs font-medium uppercase">Sesiones</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{sessions.length}</p>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-xs font-medium uppercase">Segmentos</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{segments.length}</p>
                    </div>
                    <div className="bg-purple-100 p-2 rounded-full">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* SERVICES PILLAR */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-pdv-green" />
              <h2 className="text-xl font-bold text-gray-900 uppercase">Servicios Semanales</h2>
            </div>
            <div className="space-y-4">
              <Card className="bg-white shadow hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-xs font-medium uppercase">Servicios Activos</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{services?.filter(s => s.status === 'active').length || 0}</p>
                    </div>
                    <div className="bg-orange-100 p-2 rounded-full">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-xs font-medium uppercase">Plantillas</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{services?.filter(s => s.status === 'blueprint').length || 0}</p>
                    </div>
                    <div className="bg-teal-100 p-2 rounded-full">
                      <Copy className="w-6 h-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                onClick={() => navigate(createPageUrl('Services'))}
                className="w-full bg-pdv-green hover:bg-pdv-green/90 text-white font-semibold"
              >
                Gestionar Servicios
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 pb-8">
        <h2 className="text-xl font-bold text-gray-900 uppercase mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pdv-teal" />
          Próximos Eventos
        </h2>
        
        {nextEvent ? (
          <Card className="bg-gradient-to-br from-white to-blue-50 shadow-lg border border-blue-200 mb-4">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{nextEvent.name}</h3>
                  {nextEvent.theme && (
                    <p className="text-base text-blue-600 italic mb-3">"{nextEvent.theme}"</p>
                  )}
                  <div className="space-y-2 text-gray-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-semibold">
                        {format(new Date(nextEvent.start_date), 'MMMM d, yyyy', { locale: es })}
                      </span>
                    </div>
                    {nextEvent.location && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{nextEvent.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <Badge className={statusColors[nextEvent.status] || "bg-gray-500"}>
                      {nextEvent.status}
                    </Badge>
                    
                    {sessions.filter(s => s.event_id === nextEvent.id).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-600">Sesiones</p>
                        <p className="text-xl font-bold text-gray-900">
                          {sessions.filter(s => s.event_id === nextEvent.id).length}
                        </p>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => navigate(createPageUrl('EventDetail') + `?eventId=${nextEvent.id}`)}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Ver Detalles
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white shadow">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No hay eventos próximos</h3>
              <p className="text-gray-600 text-sm mb-4">Comienza creando tu primer evento</p>
              <Button 
                onClick={() => navigate(createPageUrl('Events'))}
                className="gradient-pdv text-white font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Evento
              </Button>
            </CardContent>
          </Card>
        )}

        {events.filter(e => e.status !== 'template').length > 1 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Otros Eventos</h3>
            <div className="grid gap-3">
              {events
                .filter(e => e.status !== 'template' && e.id !== nextEvent?.id)
                .slice(0, 3)
                .map((event) => (
                  <Card 
                    key={event.id} 
                    className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(createPageUrl('EventDetail') + `?eventId=${event.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{event.name}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(event.start_date), 'MMM d, yyyy', { locale: es })}
                          </p>
                        </div>
                        <Badge className={statusColors[event.status] || "bg-gray-500"}>
                          {event.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            {events.filter(e => e.status !== 'template').length > 4 && (
              <Button 
                onClick={() => navigate(createPageUrl('Events'))}
                variant="outline"
                className="w-full mt-3"
              >
                Ver Todos los Eventos
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}