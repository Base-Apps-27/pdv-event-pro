import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/utils/i18n";
import { Calendar, Clock, FileText, Plus, ArrowRight, Bell } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseDateStringLocal } from "@/components/utils/timeFormat";

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);
  
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const blueStyle = { backgroundColor: '#2563eb', color: '#ffffff' };
  
  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-start_date'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // P1-2: Pre-compute session counts per event (was computed twice per card in render) (2026-02-12)
  const sessionCountByEvent = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (s.event_id) {
        map[s.event_id] = (map[s.event_id] || 0) + 1;
      }
    });
    return map;
  }, [sessions]);

  const isLoading = eventsLoading || sessionsLoading;

  // Build a timezone-safe "today" string (YYYY-MM-DD) in America/New_York.
  // Comparing date STRINGS avoids UTC-vs-local midnight bugs that caused
  // same-day events (like Juntos 2026-02-06) to fall into "recent" prematurely.
  const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  // ^ 'en-CA' locale produces YYYY-MM-DD format

  // An event is "upcoming" if its end_date (or start_date if no end_date) is today or later.
  // This ensures multi-day events stay in "upcoming" through their final day.
  const upcomingEvents = events
    .filter((e) => e.status !== 'template' && e.start_date)
    .filter((e) => (e.end_date || e.start_date) >= todayET)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const recentPastEvents = events
    .filter((e) => e.status !== 'template' && e.start_date)
    .filter((e) => (e.end_date || e.start_date) < todayET)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 3);

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  // Localized labels for event.status
  const statusLabels = {
    planning: t('status.planning'),
    confirmed: t('status.confirmed'),
    in_progress: t('status.in_progress'),
    completed: t('status.completed'),
    archived: t('status.archived'),
  };

  const statusBorderColors = {
    planning: "border-l-yellow-400",
    confirmed: "border-l-green-500",
    in_progress: "border-l-blue-500",
    completed: "border-l-gray-400",
    archived: "border-l-slate-400"
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div style={gradientStyle} className="text-white py-8 px-6 md:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl text-white uppercase tracking-wide leading-tight mb-2">
            {t('dashboard.title')}
          </h1>
          <p className="text-white/90 text-base">
            {t('dashboard.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        )}
        {/* Live Program — compact secondary link. Red when a program is active. (2026-03-02) */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            isLive
              ? 'bg-red-50 border border-red-300 hover:bg-red-100'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
          onClick={() => navigate(createPageUrl('PublicProgramView'))}
        >
          <Bell className={`w-4 h-4 shrink-0 ${isLive ? 'text-red-500' : 'text-gray-500'}`} />
          {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
          <span className={`text-sm font-medium ${isLive ? 'text-red-700' : 'text-gray-700'}`}>{t('dashboard.liveProgram.title')}</span>
          <span className={`text-xs hidden sm:inline ${isLive ? 'text-red-400' : 'text-gray-400'}`}>— {t('dashboard.liveProgram.subtitle')}</span>
          <ArrowRight className={`w-3.5 h-3.5 ml-auto shrink-0 ${isLive ? 'text-red-400' : 'text-gray-400'}`} />
        </div>

        {/* Quick Actions - 3 Shortcuts */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-white to-green-50 border-2 border-green-200 hover:shadow-lg transition-all group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg text-gray-900 uppercase">{t('dashboard.weeklyServices.title')}</h3>
                  <p className="text-sm text-gray-600">{t('dashboard.weeklyServices.subtitle')}</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate(createPageUrl('WeeklyServiceManager'))}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                {t('btn.manage_services')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 hover:shadow-lg transition-all group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Plus className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg text-gray-900 uppercase">{t('dashboard.otherServices.title')}</h3>
                  <p className="text-sm text-gray-600">{t('dashboard.otherServices.subtitle')}</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate(createPageUrl('CustomServiceBuilder'))}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {t('btn.add')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-blue-50 border-2 border-blue-200 hover:shadow-lg transition-all group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg text-gray-900 uppercase">{t('nav.events')}</h3>
                  <p className="text-sm text-gray-600">{t('dashboard.events.subtitle')}</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate(createPageUrl('Events'))}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {t('btn.view_all')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <h2 className="text-2xl text-gray-900 uppercase mb-4">{t('dashboard.upcoming')}</h2>

          {upcomingEvents.length > 0 ? (
            <div className="grid gap-4">
              {upcomingEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="bg-white shadow-md hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-2xl text-gray-900 mb-2">{event.name}</h3>
                        {event.theme && (
                          <p className="text-base text-blue-600 italic mb-3">"{event.theme}"</p>
                        )}
                        <div className="space-y-2 text-gray-700">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {/* DEV-6 (2026-03-02): Use parseDateStringLocal to avoid UTC midnight
                                off-by-one. new Date('2026-03-01') is UTC midnight which displays
                                as Feb 28 in EST. Splitting the string creates a local-timezone date. */}
                            <span className="font-semibold">
                              {(() => {
                                const d = parseDateStringLocal(event.start_date);
                                if (!d) return '';
                                return d.toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                              })()}
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
                            {statusLabels[event.status]}
                          </Badge>
                          {(sessionCountByEvent[event.id] || 0) > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-600">{t('dashboard.events.sessions')}</p>
                              <p className="text-xl text-gray-900 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                                {sessionCountByEvent[event.id]}
                              </p>
                            </div>
                          )}
                        </div>
                        <Button 
                          onClick={() => navigate(createPageUrl('EventDetail') + `?id=${event.id}`)}
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
                <h3 className="text-lg text-gray-900 mb-2">{t('dashboard.no_events')}</h3>
                <p className="text-gray-600 text-sm mb-4">{t('dashboard.create_first')}</p>
                <Button 
                  onClick={() => navigate(createPageUrl('Events'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
            <h2 className="text-2xl text-gray-900 uppercase mb-4">{t('dashboard.recent')}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {recentPastEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className={`bg-white shadow-sm hover:shadow-md transition-shadow border-l-4 ${statusBorderColors[event.status] || 'border-l-gray-300'}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h4 className="text-gray-900">{event.name}</h4>
                        {/* DEV-6 (2026-03-02): Safe date formatting — same fix as above */}
                        <p className="text-sm text-gray-600">
                          {(() => {
                            const d = parseDateStringLocal(event.start_date);
                            if (!d) return '';
                            return d.toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          })()}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <Badge className={statusColors[event.status] || "bg-gray-500"}>
                          {statusLabels[event.status]}
                        </Badge>
                        <Button 
                          onClick={() => {
                            if (event?.id) {
                              navigate(createPageUrl('EventDetail') + `?id=${event.id}`);
                            }
                          }}
                          size="sm"
                          style={blueStyle}
                        >
                          {t('btn.view')}
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