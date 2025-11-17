import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Clock, MapPin, Plus, ArrowRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list(),
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments'],
    queryFn: () => base44.entities.Segment.list(),
  });

  const upcomingEvents = events.filter(e => e.status !== 'completed' && e.status !== 'archived');
  const recentEvent = upcomingEvents[0];

  const getSessionCount = (eventId) => {
    return sessions.filter(s => s.event_id === eventId).length;
  };

  const getSegmentCount = (eventId) => {
    const eventSessions = sessions.filter(s => s.event_id === eventId);
    return segments.filter(seg => eventSessions.some(s => s.id === seg.session_id)).length;
  };

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  const statusLabels = {
    planning: "Planificación",
    confirmed: "Confirmado",
    in_progress: "En Progreso",
    completed: "Completado",
    archived: "Archivado"
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Gestión de eventos y programación</p>
        </div>
        <Link to={createPageUrl("Events")}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Evento
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-white/90 text-sm font-medium">Total Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{events.length}</div>
            <p className="text-blue-100 text-sm mt-1">{upcomingEvents.length} activos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-white/90 text-sm font-medium">Total Sesiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{sessions.length}</div>
            <p className="text-indigo-100 text-sm mt-1">En todos los eventos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-white/90 text-sm font-medium">Total Segmentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{segments.length}</div>
            <p className="text-purple-100 text-sm mt-1">Programados</p>
          </CardContent>
        </Card>
      </div>

      {recentEvent && (
        <Card className="border-2 border-blue-200 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Evento Próximo</CardTitle>
              <Badge className="bg-blue-600 text-white">Destacado</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{recentEvent.name}</h3>
                {recentEvent.theme && (
                  <p className="text-lg text-slate-600 mt-1 italic">"{recentEvent.theme}"</p>
                )}
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fechas</p>
                    <p className="font-medium text-slate-900">
                      {recentEvent.start_date && format(new Date(recentEvent.start_date), "d MMM", { locale: es })}
                      {recentEvent.end_date && ` - ${format(new Date(recentEvent.end_date), "d MMM yyyy", { locale: es })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Ubicación</p>
                    <p className="font-medium text-slate-900">{recentEvent.location || "Por definir"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sesiones</p>
                    <p className="font-medium text-slate-900">{getSessionCount(recentEvent.id)} programadas</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Link to={createPageUrl(`EventDetail?id=${recentEvent.id}`)} className="flex-1">
                  <Button variant="outline" className="w-full">
                    Ver Detalles
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Todos los Eventos</h2>
          <Link to={createPageUrl("Events")}>
            <Button variant="ghost" size="sm">
              Ver todos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link key={event.id} to={createPageUrl(`EventDetail?id=${event.id}`)}>
              <Card className="hover:shadow-lg transition-shadow duration-200 h-full cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{event.name}</CardTitle>
                      <Badge className={`${statusColors[event.status]} border text-xs`}>
                        {statusLabels[event.status]}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold text-slate-400">{event.year}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {event.theme && (
                      <p className="text-sm text-slate-600 italic line-clamp-2">"{event.theme}"</p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location || "Sin ubicación"}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                      <span className="text-slate-600">{getSessionCount(event.id)} sesiones</span>
                      <span className="text-slate-600">{getSegmentCount(event.id)} segmentos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {events.length === 0 && !isLoading && (
            <Card className="col-span-full p-12 text-center border-dashed border-2">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No hay eventos</h3>
              <p className="text-slate-500 mb-4">Comienza creando tu primer evento</p>
              <Link to={createPageUrl("Events")}>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Evento
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}