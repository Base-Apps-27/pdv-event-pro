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
    planning: "bg-yellow-900 bg-opacity-30 text-yellow-400 border-yellow-700",
    confirmed: "bg-pdv-green bg-opacity-20 text-pdv-green border-pdv-green",
    in_progress: "bg-pdv-teal bg-opacity-20 text-pdv-teal border-pdv-teal",
    completed: "bg-slate-800 text-slate-400 border-slate-700",
    archived: "bg-slate-800 text-slate-500 border-slate-700"
  };

  const statusLabels = {
    planning: "PLANIFICACIÓN",
    confirmed: "CONFIRMADO",
    in_progress: "EN PROGRESO",
    completed: "COMPLETADO",
    archived: "ARCHIVADO"
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">DASHBOARD</h1>
          <p className="text-slate-400 mt-2 font-medium">Gestión de eventos y programación</p>
        </div>
        <Link to={createPageUrl("Events")}>
          <Button className="gradient-pdv text-white hover:opacity-90 transition-opacity font-bold uppercase tracking-wide">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Evento
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden bg-pdv-card border-slate-800 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pdv-teal opacity-20 rounded-full transform translate-x-8 -translate-y-8" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">Total Eventos</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-bold text-pdv-teal">{events.length}</div>
            <p className="text-slate-400 text-sm mt-1 font-medium">{upcomingEvents.length} activos</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-pdv-card border-slate-800 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pdv-green opacity-20 rounded-full transform translate-x-8 -translate-y-8" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">Total Sesiones</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-bold text-pdv-green">{sessions.length}</div>
            <p className="text-slate-400 text-sm mt-1 font-medium">En todos los eventos</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-pdv-card border-slate-800 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pdv-yellow opacity-20 rounded-full transform translate-x-8 -translate-y-8" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">Total Segmentos</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-5xl font-bold text-pdv-yellow">{segments.length}</div>
            <p className="text-slate-400 text-sm mt-1 font-medium">Programados</p>
          </CardContent>
        </Card>
      </div>

      {recentEvent && (
        <Card className="border-l-4 border-pdv-green bg-pdv-card shadow-xl">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-transparent border-b border-slate-700">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold uppercase tracking-tight text-white">Evento Próximo</CardTitle>
              <Badge className="gradient-pdv text-white font-bold uppercase border-none">Destacado</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-3xl font-bold text-white uppercase tracking-tight">{recentEvent.name}</h3>
                {recentEvent.theme && (
                  <p className="text-xl text-pdv-green mt-2 font-semibold italic">"{recentEvent.theme}"</p>
                )}
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-pdv-teal bg-opacity-20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-pdv-teal" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Fechas</p>
                    <p className="font-semibold text-white">
                      {recentEvent.start_date && format(new Date(recentEvent.start_date), "d MMM", { locale: es })}
                      {recentEvent.end_date && ` - ${format(new Date(recentEvent.end_date), "d MMM yyyy", { locale: es })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-pdv-green bg-opacity-20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-pdv-green" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Ubicación</p>
                    <p className="font-semibold text-white">{recentEvent.location || "Por definir"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-pdv-yellow bg-opacity-20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-pdv-yellow" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Sesiones</p>
                    <p className="font-semibold text-white">{getSessionCount(recentEvent.id)} programadas</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Link to={createPageUrl(`EventDetail?id=${recentEvent.id}`)} className="flex-1">
                  <Button variant="outline" className="w-full border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white font-bold uppercase">
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white uppercase tracking-tight">Todos los Eventos</h2>
          <Link to={createPageUrl("Events")}>
            <Button variant="ghost" size="sm" className="text-pdv-green hover:text-pdv-teal font-bold uppercase hover:bg-slate-800">
              Ver todos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link key={event.id} to={createPageUrl(`EventDetail?id=${event.id}`)}>
              <Card className="hover:shadow-xl hover:border-pdv-teal transition-all duration-200 h-full cursor-pointer bg-pdv-card border-slate-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-3 font-bold uppercase tracking-tight text-white">{event.name}</CardTitle>
                      <Badge className={`${statusColors[event.status]} border text-xs font-bold uppercase`}>
                        {statusLabels[event.status]}
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-slate-700">{event.year}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {event.theme && (
                      <p className="text-sm text-pdv-green font-semibold italic line-clamp-2">"{event.theme}"</p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">{event.location || "Sin ubicación"}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-sm font-semibold">
                      <span className="text-slate-400">{getSessionCount(event.id)} sesiones</span>
                      <span className="text-slate-400">{getSegmentCount(event.id)} segmentos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {events.length === 0 && !isLoading && (
            <Card className="col-span-full p-12 text-center border-dashed border-2 bg-pdv-card border-slate-700">
              <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold uppercase text-white mb-2">No hay eventos</h3>
              <p className="text-slate-400 mb-4">Comienza creando tu primer evento</p>
              <Link to={createPageUrl("Events")}>
                <Button className="gradient-pdv text-white font-bold uppercase">
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