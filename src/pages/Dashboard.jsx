import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { Calendar, FileText, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-start_date')
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list()
  });

  const today = new Date();
  
  const upcomingEvents = events
    .filter((e) => e.status !== 'completed' && e.status !== 'archived' && e.status !== 'template')
    .filter((e) => e.start_date && new Date(e.start_date) >= today)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  const recentPastEvents = events
    .filter((e) => e.status === 'completed' || (e.start_date && new Date(e.start_date) < today && e.status !== 'template'))
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, 3);

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
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-wide mb-2">
            {t('dashboard.title')}
          </h1>
          <p className="text-white/90 text-base mb-6">
            {t('dashboard.subtitle')}
          </p>
          <Button 
            onClick={() => navigate(createPageUrl('Events'))} 
            className="bg-white text-pdv-teal hover:bg-gray-100 font-semibold"
          >
            <Calendar className="w-4 h-4 mr-2" />
            {t('btn.view_events')}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {/* Upcoming Events */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 uppercase">
              {t('dashboard.events.title')} Próximos
            </h2>
            <Button 
              onClick={() => navigate(createPageUrl('Events'))}
              variant="outline"
              size="sm"
            >
              Ver Todos
            </Button>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="grid gap-4">
              {upcomingEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="bg-gradient-to-br from-white to-blue-50 shadow-md border border-blue-200 hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h3>
                        {event.theme && (
                          <p className="text-base text-blue-600 italic mb-3">"{event.theme}"</p>
                        )}
                        <div className="space-y-2 text-gray-700">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span className="font-semibold">
                              {format(new Date(event.start_date), 'MMMM d, yyyy', { locale: es })}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col justify-between">
                        <div>
                          <Badge className={statusColors[event.status] || "bg-gray-500"}>
                            {event.status}
                          </Badge>
                          {sessions.filter(s => s.event_id === event.id).length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-600">Sesiones</p>
                              <p className="text-xl font-bold text-gray-900">
                                {sessions.filter(s => s.event_id === event.id).length}
                              </p>
                            </div>
                          )}
                        </div>
                        <Button 
                          onClick={() => navigate(createPageUrl('EventDetail') + `?eventId=${event.id}`)}
                          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        >
                          {t('btn.view_details')}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-white shadow">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('dashboard.no_events')}</h3>
                <p className="text-gray-600 text-sm mb-4">Crea tu primer evento</p>
                <Button 
                  onClick={() => navigate(createPageUrl('Events'))}
                  className="gradient-pdv text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('btn.create_event')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recently Passed Events */}
        {recentPastEvents.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 uppercase mb-4">
              Eventos Recientes
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {recentPastEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h4 className="font-bold text-gray-900">{event.name}</h4>
                        <p className="text-sm text-gray-600">
                          {event.start_date && format(new Date(event.start_date), 'MMM d, yyyy', { locale: es })}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <Badge className={statusColors[event.status] || "bg-gray-500"}>
                          {event.status}
                        </Badge>
                        <Button 
                          onClick={() => navigate(createPageUrl('EventDetail') + `?eventId=${event.id}`)}
                          size="sm"
                          variant="outline"
                        >
                          Ver
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}