import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Users, Languages, Mic, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTimeToEST } from "../components/utils/timeFormat";

export default function PublicProgramView() {
  const urlParams = new URLSearchParams(window.location.search);
  const preloadedSlug = urlParams.get('slug');
  const preloadedEventId = urlParams.get('eventId') || "";
  
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [teamFilters, setTeamFilters] = useState({
    projection: false,
    sound: false,
    ushers: false,
    translation: false
  });

  useEffect(() => {
    if (preloadedEventId) {
      setSelectedEventId(preloadedEventId);
    }
  }, [preloadedEventId]);

  // Fetch list of public events
  const { data: publicEvents = [] } = useQuery({
    queryKey: ['publicEvents'],
    queryFn: async () => {
      const events = await base44.entities.Event.list('-start_date');
      return events.filter(e => e.status === 'confirmed' || e.status === 'in_progress');
    },
  });

  // If slug is provided, find the event and set the ID
  useEffect(() => {
    if (preloadedSlug && publicEvents.length > 0 && !selectedEventId) {
      const event = publicEvents.find(e => e.slug === preloadedSlug);
      if (event) {
        setSelectedEventId(event.id);
      }
    }
  }, [preloadedSlug, publicEvents, selectedEventId]);

  // Fetch sessions for selected event
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', selectedEventId],
    queryFn: () => base44.entities.Session.filter({ event_id: selectedEventId }, 'order'),
    enabled: !!selectedEventId,
  });

  // Fetch segments for selected sessions
  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', selectedEventId, selectedSessionId],
    queryFn: async () => {
      const sessionIds = selectedSessionId === "all" 
        ? sessions.map(s => s.id)
        : [selectedSessionId];
      
      if (sessionIds.length === 0) return [];
      
      const allSegs = await base44.entities.Segment.list('order');
      return allSegs.filter(seg => 
        sessionIds.includes(seg.session_id) && seg.show_in_general !== false
      );
    },
    enabled: !!selectedEventId && sessions.length > 0,
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  // Fetch event days
  const { data: eventDays = [] } = useQuery({
    queryKey: ['eventDays', selectedEventId],
    queryFn: () => base44.entities.EventDay.filter({ event_id: selectedEventId }),
    enabled: !!selectedEventId,
  });

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const eventSessions = sessions;
  const filteredSessions = eventSessions;

  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "";
  };

  const toggleSegmentExpanded = (segmentId) => {
    setExpandedSegments(prev => ({
      ...prev,
      [segmentId]: !prev[segmentId]
    }));
  };

  const toggleSessionExpanded = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const sessionColorClasses = {
    green: 'border-l-4 border-pdv-green',
    blue: 'border-l-4 border-blue-500',
    pink: 'border-l-4 border-pink-500',
    orange: 'border-l-4 border-orange-500',
    yellow: 'border-l-4 border-yellow-400',
    purple: 'border-l-4 border-purple-500',
    red: 'border-l-4 border-red-500',
  };

  const anyTeamFilter = teamFilters.projection || teamFilters.sound || teamFilters.ushers || teamFilters.translation;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="brand-gradient text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-2">Programa del Evento</h1>
          <p className="text-lg text-white text-opacity-90">Explora el programa completo y mantente actualizado</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Event Selection */}
        <Card className="bg-white shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pdv-teal" />
              <h2 className="text-xl font-bold uppercase">Seleccionar Evento</h2>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un evento..." />
              </SelectTrigger>
              <SelectContent>
                {publicEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} - {event.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedEventId && selectedEvent && (
          <>
            {/* Event Info Card */}
            <Card className="bg-white shadow-md border-l-4 border-pdv-green">
              <CardContent className="p-6">
                <h2 className="text-3xl font-bold uppercase mb-2">{selectedEvent.name}</h2>
                {selectedEvent.theme && (
                  <p className="text-xl text-pdv-green italic mb-4">"{selectedEvent.theme}"</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  {selectedEvent.start_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>{selectedEvent.start_date}</span>
                      {selectedEvent.end_date && <span> - {selectedEvent.end_date}</span>}
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                </div>

                {/* Toggle Event Details */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEventDetails(!showEventDetails)}
                  className="mb-4"
                >
                  {showEventDetails ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  {showEventDetails ? 'Ocultar Detalles' : 'Ver Más Detalles'}
                </Button>

                {/* Expanded Event Details */}
                {showEventDetails && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    {selectedEvent.description && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Descripción:</p>
                        <p className="text-gray-700">{selectedEvent.description}</p>
                      </div>
                    )}
                    {selectedEvent.announcement_blurb && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Anuncio:</p>
                        <p className="text-gray-700">{selectedEvent.announcement_blurb}</p>
                      </div>
                    )}
                    {selectedEvent.promotion_targets && selectedEvent.promotion_targets.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Audiencia:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.promotion_targets.map((target, idx) => (
                            <Badge key={idx} variant="outline">{target}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Total Sesiones:</p>
                        <p className="text-2xl font-bold text-pdv-teal">{eventSessions.length}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Total Segmentos:</p>
                        <p className="text-2xl font-bold text-pdv-teal">
                          {allSegments.filter(seg => eventSessions.some(s => s.id === seg.session_id)).length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filters Card */}
            <Card className="bg-white shadow-md">
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-pdv-teal" />
                  <h3 className="text-lg font-bold uppercase text-gray-900">Filtros y Opciones</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">Sesión</label>
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">Todas las Sesiones</SelectItem>
                        {eventSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">Ver Detalles</label>
                    <div className="flex items-center space-x-2 h-10">
                      <Checkbox 
                        id="show-details"
                        checked={showDetails}
                        onCheckedChange={setShowDetails}
                        className="border-gray-400"
                      />
                      <label htmlFor="show-details" className="text-sm cursor-pointer text-gray-900">
                        Mostrar información detallada
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="text-sm font-semibold text-gray-900 block mb-3">Mostrar Notas de Equipos</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-projection"
                        checked={teamFilters.projection}
                        onCheckedChange={(checked) => setTeamFilters({...teamFilters, projection: checked})}
                        className="border-gray-400"
                      />
                      <label htmlFor="filter-projection" className="text-sm cursor-pointer text-gray-900">Proyección</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-sound"
                        checked={teamFilters.sound}
                        onCheckedChange={(checked) => setTeamFilters({...teamFilters, sound: checked})}
                        className="border-gray-400"
                      />
                      <label htmlFor="filter-sound" className="text-sm cursor-pointer text-gray-900">Sonido</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-ushers"
                        checked={teamFilters.ushers}
                        onCheckedChange={(checked) => setTeamFilters({...teamFilters, ushers: checked})}
                        className="border-gray-400"
                      />
                      <label htmlFor="filter-ushers" className="text-sm cursor-pointer text-gray-900">Ujieres</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-translation"
                        checked={teamFilters.translation}
                        onCheckedChange={(checked) => setTeamFilters({...teamFilters, translation: checked})}
                        className="border-gray-400"
                      />
                      <label htmlFor="filter-translation" className="text-sm cursor-pointer text-gray-900">Traducción</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions Display */}
            <div className="space-y-6">
              {filteredSessions.map((session) => {
                const segments = getSessionSegments(session.id);
                if (segments.length === 0) return null;

                return (
                  <div key={session.id} className={`bg-white rounded-lg shadow-md overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 border-b">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold uppercase mb-1">{session.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            {session.date && <span>{session.date}</span>}
                            {session.planned_start_time && (
                              <>
                                <span>•</span>
                                <span>{formatTimeToEST(session.planned_start_time)}</span>
                              </>
                            )}
                            {session.location && (
                              <>
                                <span>•</span>
                                <span>{session.location}</span>
                              </>
                            )}
                          </div>

                          {/* Expanded Session Details */}
                          {expandedSessions[session.id] && (
                            <div className="mt-3 pt-3 border-t border-gray-300 space-y-2 text-sm">
                              {session.notes && (
                                <p><strong>Notas:</strong> {session.notes}</p>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <p><strong>Segmentos:</strong> {segments.length}</p>
                                <p><strong>Duración:</strong> {session.planned_start_time && session.planned_end_time ? 
                                  `${formatTimeToEST(session.planned_start_time)} - ${formatTimeToEST(session.planned_end_time)}` : 
                                  'Por definir'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSessionExpanded(session.id)}
                          className="ml-2"
                        >
                          {expandedSessions[session.id] ? 
                            <ChevronUp className="w-5 h-5" /> : 
                            <ChevronDown className="w-5 h-5" />
                          }
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {segments.map((segment) => {
                        const isExpanded = expandedSegments[segment.id];

                        if (segment.segment_type === "Breakout" && segment.breakout_rooms) {
                          return (
                            <div key={segment.id} className="p-4 bg-amber-50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Clock className="w-5 h-5 text-pdv-teal" />
                                  <div>
                                    <span className="font-bold text-lg">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</span>
                                    {segment.end_time && (
                                      <span className="text-gray-600 ml-2">- {formatTimeToEST(segment.end_time)}</span>
                                    )}
                                    {segment.duration_min && (
                                      <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                                    )}
                                  </div>
                                </div>
                                <Badge className="bg-amber-600 text-white">Sesiones Paralelas</Badge>
                              </div>

                              <h4 className="text-xl font-bold mb-3">{segment.title}</h4>

                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {segment.breakout_rooms.map((room, roomIdx) => (
                                  <Card key={roomIdx} className="bg-white">
                                    <CardContent className="p-4">
                                      {room.room_id && (
                                        <Badge variant="outline" className="mb-2 bg-blue-50">
                                          {getRoomName(room.room_id)}
                                        </Badge>
                                      )}
                                      <h5 className="font-bold mb-2">{room.topic || `Sala ${roomIdx + 1}`}</h5>
                                      {room.hosts && (
                                        <p className="text-sm text-indigo-600 mb-1">
                                          <span className="font-semibold">Anfitrión:</span> {room.hosts}
                                        </p>
                                      )}
                                      {room.speakers && (
                                        <p className="text-sm text-blue-600 mb-2">
                                          <span className="font-semibold">Presentador:</span> {room.speakers}
                                        </p>
                                      )}
                                      {room.requires_translation && (
                                        <div className="flex items-center gap-1 text-sm text-purple-700">
                                          <Languages className="w-4 h-4" />
                                          {room.translation_mode === "InPerson" && <Mic className="w-4 h-4" />}
                                          {room.translator_name && <span>{room.translator_name}</span>}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={segment.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Clock className="w-5 h-5 text-pdv-teal flex-shrink-0" />
                                  <div>
                                    <span className="font-bold text-lg">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</span>
                                    {segment.end_time && (
                                      <span className="text-gray-600 ml-2">- {formatTimeToEST(segment.end_time)}</span>
                                    )}
                                    {segment.duration_min && (
                                      <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-xl font-bold">{segment.title}</h4>
                                  <Badge variant="outline" className="text-xs">{segment.segment_type}</Badge>
                                  {segment.requires_translation && (
                                    <div className="flex items-center gap-1">
                                      <Languages className="w-4 h-4 text-purple-600" />
                                      {segment.translation_mode === "InPerson" && <Mic className="w-4 h-4 text-purple-600" />}
                                    </div>
                                  )}
                                </div>

                                {segment.presenter && (
                                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                                    <Users className="w-4 h-4" />
                                    <span className="font-semibold">{segment.presenter}</span>
                                  </div>
                                )}

                                {segment.room_id && (
                                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    <span>{getRoomName(segment.room_id)}</span>
                                  </div>
                                )}

                                {showDetails && (
                                  <div className="mt-3 space-y-2">
                                    {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                                      <div className="bg-green-50 p-3 rounded border border-green-200">
                                        <p className="font-semibold text-green-800 mb-1">Canciones:</p>
                                        <div className="space-y-1 text-sm">
                                          {[...Array(segment.number_of_songs)].map((_, idx) => {
                                            const songNum = idx + 1;
                                            const title = segment[`song_${songNum}_title`];
                                            const lead = segment[`song_${songNum}_lead`];
                                            if (!title) return null;
                                            return (
                                              <div key={songNum}>
                                                {songNum}. {title} {lead && `(${lead})`}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {segment.segment_type === "Plenaria" && segment.message_title && (
                                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                        <p className="font-semibold text-blue-800">Mensaje: {segment.message_title}</p>
                                        {segment.scripture_references && (
                                          <p className="text-sm mt-1">Escrituras: {segment.scripture_references}</p>
                                        )}
                                      </div>
                                    )}

                                    {segment.description_details && (
                                      <p className="text-gray-600">{segment.description_details}</p>
                                    )}
                                  </div>
                                )}

                                {anyTeamFilter && (
                                  <div className="mt-3 space-y-2">
                                    {teamFilters.projection && segment.projection_notes && (
                                      <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm">
                                        <span className="font-semibold text-purple-800">Proyección:</span> {segment.projection_notes}
                                      </div>
                                    )}
                                    {teamFilters.sound && segment.sound_notes && (
                                      <div className="bg-red-50 p-2 rounded border border-red-200 text-sm">
                                        <span className="font-semibold text-red-800">Sonido:</span> {segment.sound_notes}
                                      </div>
                                    )}
                                    {teamFilters.ushers && segment.ushers_notes && (
                                      <div className="bg-green-50 p-2 rounded border border-green-200 text-sm">
                                        <span className="font-semibold text-green-800">Ujieres:</span> {segment.ushers_notes}
                                      </div>
                                    )}
                                    {teamFilters.translation && segment.translation_notes && (
                                      <div className="bg-blue-50 p-2 rounded border border-blue-200 text-sm">
                                        <span className="font-semibold text-blue-800">Traducción:</span> {segment.translation_notes}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {(showDetails || anyTeamFilter) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSegmentExpanded(segment.id)}
                                  className="flex-shrink-0"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredSessions.length === 0 && (
              <Card className="p-12 text-center bg-white">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay sesiones disponibles para este evento</p>
              </Card>
            )}
          </>
        )}

        {!selectedEventId && (
          <Card className="p-12 text-center bg-white border-dashed border-2">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Selecciona un evento para ver su programa</p>
          </Card>
        )}
      </div>
    </div>
  );
}