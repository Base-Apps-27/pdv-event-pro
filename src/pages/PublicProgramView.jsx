import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Users, Languages, Mic, ChevronDown, ChevronUp, Filter, List, ListChecks } from "lucide-react";
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
  const preloadedServiceId = urlParams.get('serviceId') || "";
  const preloadedDate = urlParams.get('date') || "";
  
  const [viewType, setViewType] = useState(preloadedServiceId || preloadedDate ? "service" : "event");
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedServiceId, setSelectedServiceId] = useState(preloadedServiceId);
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [viewMode, setViewMode] = useState("simple"); // "simple" or "full"
  const [expandedSegments, setExpandedSegments] = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

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

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  // Handle preloaded date parameter
  useEffect(() => {
    if (preloadedDate && services.length > 0 && !selectedServiceId) {
      const serviceForDate = services.find(s => s.date === preloadedDate && s.status === 'active');
      if (serviceForDate) {
        setSelectedServiceId(serviceForDate.id);
        setViewType("service");
      }
    }
  }, [preloadedDate, services, selectedServiceId]);

  // If slug is provided, find the event and set the ID
  useEffect(() => {
    if (preloadedSlug && publicEvents.length > 0 && !selectedEventId) {
      const event = publicEvents.find(e => e.slug === preloadedSlug);
      if (event) {
        setSelectedEventId(event.id);
        setViewType("event");
      }
    }
  }, [preloadedSlug, publicEvents, selectedEventId]);

  // Auto-select next upcoming event or service
  useEffect(() => {
    if (!preloadedEventId && !preloadedServiceId && !preloadedDate && publicEvents.length > 0 && services.length > 0) {
      const today = new Date();
      
      // Find next event
      const nextEvent = publicEvents.find(e => e.start_date && new Date(e.start_date) >= today);
      
      // Find next service
      const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const activeServices = services.filter(s => s.status === 'active');
      const upcomingServices = activeServices.map(service => {
        const serviceDayNum = dayMap[service.day_of_week];
        let daysUntil = serviceDayNum - today.getDay();
        if (daysUntil < 0) daysUntil += 7;
        if (daysUntil === 0 && service.time) {
          const [hours, minutes] = service.time.split(':');
          const serviceTime = new Date(today);
          serviceTime.setHours(parseInt(hours), parseInt(minutes), 0);
          if (serviceTime < today) daysUntil = 7;
        }
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntil);
        return { ...service, nextDate, daysUntil };
      }).sort((a, b) => a.daysUntil - b.daysUntil);
      
      const nextService = upcomingServices[0];
      
      // Compare and select closest
      if (nextEvent && nextService) {
        const eventDaysAway = Math.floor((new Date(nextEvent.start_date) - today) / (1000 * 60 * 60 * 24));
        if (nextService.daysUntil <= eventDaysAway) {
          setSelectedServiceId(nextService.id);
          setViewType("service");
        } else {
          setSelectedEventId(nextEvent.id);
          setViewType("event");
        }
      } else if (nextEvent) {
        setSelectedEventId(nextEvent.id);
        setViewType("event");
      } else if (nextService) {
        setSelectedServiceId(nextService.id);
        setViewType("service");
      }
    }
  }, [publicEvents, services, preloadedEventId, preloadedServiceId]);

  // Fetch actual Service data for weekly services
  const { data: weeklyServiceData } = useQuery({
    queryKey: ['weeklyServiceData', selectedServiceId],
    queryFn: () => base44.entities.Service.filter({ id: selectedServiceId }),
    enabled: !!(viewType === "service" && selectedServiceId),
  });

  // Fetch sessions for selected event OR service
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', selectedEventId, selectedServiceId, viewType],
    queryFn: () => {
      if (viewType === "event" && selectedEventId) {
        return base44.entities.Session.filter({ event_id: selectedEventId }, 'order');
      } else if (viewType === "service" && selectedServiceId) {
        return base44.entities.Session.filter({ service_id: selectedServiceId }, 'order');
      }
      return [];
    },
    enabled: !!(selectedEventId || selectedServiceId),
  });

  // Fetch segments for selected sessions
  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments', selectedEventId, selectedServiceId, selectedSessionId, viewType],
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
    enabled: !!(selectedEventId || selectedServiceId) && sessions.length > 0,
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const actualServiceData = weeklyServiceData?.[0] || null;
  const eventSessions = sessions;
  const filteredSessions = eventSessions;

  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  const isSegmentCurrent = (segment) => {
    if (!segment.start_time || !segment.end_time) return false;
    
    const now = currentTime;
    const [startHours, startMinutes] = segment.start_time.split(':').map(Number);
    const [endHours, endMinutes] = segment.end_time.split(':').map(Number);
    
    const startTime = new Date(now);
    startTime.setHours(startHours, startMinutes, 0);
    
    const endTime = new Date(now);
    endTime.setHours(endHours, endMinutes, 0);
    
    return now >= startTime && now <= endTime;
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

  const getSegmentActions = (segment) => {
    return segment?.segment_actions || [];
  };

  const departmentColors = {
    Admin: "bg-orange-50 border-orange-200 text-orange-700",
    MC: "bg-blue-50 border-blue-200 text-blue-700",
    Sound: "bg-red-50 border-red-200 text-red-700",
    Projection: "bg-purple-50 border-purple-200 text-purple-700",
    Hospitality: "bg-pink-50 border-pink-200 text-pink-700",
    Ujieres: "bg-green-50 border-green-200 text-green-700",
    Kids: "bg-yellow-50 border-yellow-200 text-yellow-700",
    Coordinador: "bg-orange-50 border-orange-200 text-orange-700",
    "Stage & Decor": "bg-purple-50 border-purple-200 text-purple-700",
    Alabanza: "bg-green-50 border-green-200 text-green-700",
    Translation: "bg-purple-50 border-purple-200 text-purple-700",
    Other: "bg-gray-50 border-gray-200 text-gray-700"
  };

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-pdv-teal to-pdv-green text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
              alt="Logo" 
              className="w-16 h-16 md:w-20 md:h-20"
            />
            <div>
              <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">Programa del Evento</h1>
              <p className="text-sm md:text-base text-white mt-1">¡ATRÉVETE A CAMBIAR!</p>
            </div>
          </div>
          <p className="text-lg text-white">Explora el programa completo y mantente actualizado</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {((selectedEventId && selectedEvent) || (selectedServiceId && selectedService)) && (
          <>
            {/* Event/Service Info Card */}
            <Card className={`bg-white border-2 border-gray-300 border-l-4 ${viewType === "event" ? "border-l-pdv-teal" : "border-l-pdv-green"}`}>
              <CardContent className="p-6">
                <h2 className="text-3xl font-bold uppercase mb-2 text-gray-900">
                  {viewType === "event" ? selectedEvent?.name : selectedService?.name}
                </h2>
                {viewType === "event" && selectedEvent?.theme && (
                  <p className="text-xl text-pdv-green italic mb-4">"{selectedEvent.theme}"</p>
                )}
                {viewType === "service" && selectedService?.description && (
                  <p className="text-lg text-gray-600 mb-4">{selectedService.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm mb-4 text-gray-700">
                  {viewType === "event" && selectedEvent?.start_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>{selectedEvent.start_date}</span>
                      {selectedEvent.end_date && <span> - {selectedEvent.end_date}</span>}
                    </div>
                  )}
                  {viewType === "service" && selectedService && (
                    <>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <span>{selectedService.day_of_week}</span>
                      </div>
                      {selectedService.time && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span>{selectedService.time}</span>
                        </div>
                      )}
                    </>
                  )}
                  {(selectedEvent?.location || selectedService?.location) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <span>{viewType === "event" ? selectedEvent?.location : selectedService?.location}</span>
                    </div>
                  )}
                </div>

                {/* Toggle Event Details */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEventDetails(!showEventDetails)}
                  className="mb-4 border-2 border-gray-400 bg-white text-gray-900 font-semibold"
                >
                  {showEventDetails ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  {showEventDetails ? 'Ocultar Detalles' : 'Ver Más Detalles'}
                </Button>

                {/* Expanded Details */}
                {showEventDetails && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    {viewType === "event" && selectedEvent?.description && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Descripción:</p>
                        <p className="text-gray-700">{selectedEvent.description}</p>
                      </div>
                    )}
                    {viewType === "event" && selectedEvent?.announcement_blurb && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Anuncio:</p>
                        <p className="text-gray-700">{selectedEvent.announcement_blurb}</p>
                      </div>
                    )}
                    {viewType === "event" && selectedEvent?.promotion_targets && selectedEvent.promotion_targets.length > 0 && (
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
                        <p className={`text-2xl font-bold ${viewType === "event" ? "text-pdv-teal" : "text-pdv-green"}`}>
                          {eventSessions.length}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Total Segmentos:</p>
                        <p className={`text-2xl font-bold ${viewType === "event" ? "text-pdv-teal" : "text-pdv-green"}`}>
                          {allSegments.filter(seg => eventSessions.some(s => s.id === seg.session_id)).length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* View Mode and Filters Card */}
            <Card className="bg-white border-2 border-gray-300">
              <CardHeader className="bg-gray-100 border-b-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-pdv-teal" />
                    <h3 className="text-lg font-bold uppercase text-gray-900">Vista y Filtros</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === "simple" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("simple")}
                      className={viewMode === "simple" ? "bg-pdv-teal text-white border-2 border-pdv-teal font-semibold" : "border-2 border-gray-400 bg-white text-gray-900 font-semibold"}
                    >
                      <List className="w-4 h-4 mr-2" />
                      Simple
                    </Button>
                    <Button
                      variant={viewMode === "full" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("full")}
                      className={viewMode === "full" ? "bg-pdv-teal text-white border-2 border-pdv-teal font-semibold" : "border-2 border-gray-400 bg-white text-gray-900 font-semibold"}
                    >
                      <ListChecks className="w-4 h-4 mr-2" />
                      Run of Show
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-900">Filtrar por Sesión</label>
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger className="bg-white border-2 border-gray-400 text-gray-900">
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
              </CardContent>
            </Card>

            {/* Weekly Services Display (for Service view type) */}
            {viewType === "service" && actualServiceData && (
              <div className="space-y-6">
                {/* 9:30am Service */}
                {actualServiceData["9:30am"] && (
                  <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-red-500">
                    <div className="bg-gradient-to-r from-red-50 to-white p-4 border-b">
                      <h3 className="text-2xl font-bold uppercase mb-1 text-red-600">9:30 a.m.</h3>
                      {actualServiceData.pre_service_notes?.["9:30am"] && (
                        <p className="text-sm text-gray-600 italic mt-2">{actualServiceData.pre_service_notes["9:30am"]}</p>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                     {actualServiceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                       <div key={idx} className="p-4 hover:bg-gray-50">
                         <div className="flex items-start justify-between gap-4">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2 flex-wrap">
                               <h4 className="text-xl font-bold">{segment.title}</h4>
                               <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
                             </div>

                             {segment.data?.leader && (
                               <p className="text-lg font-bold text-pdv-green mb-2">Dirige: {segment.data.leader}</p>
                             )}

                             {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                               <div className="bg-green-50 p-2 rounded border border-green-200 text-sm mb-2">
                                 <p className="font-semibold text-green-800 mb-1">Canciones:</p>
                                 {segment.songs.filter(s => s.title).map((song, sIdx) => (
                                   <div key={sIdx} className="text-xs">• {song.title} {song.lead && `(${song.lead})`}</div>
                                 ))}
                               </div>
                             )}

                             {segment.data?.ministry_leader && (
                               <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                 <strong>Ministración (5 min):</strong> <span className="font-bold text-purple-900">{segment.data.ministry_leader}</span>
                               </div>
                             )}

                             {segment.data?.presenter && !segment.data?.ministry_leader && (
                               <p className="text-lg font-bold text-blue-600 mb-2">{segment.data.presenter}</p>
                             )}

                             {segment.data?.preacher && (
                               <p className="text-lg font-bold text-blue-600 mb-2">{segment.data.preacher}</p>
                             )}

                             {segment.data?.title && (
                               <p className="text-sm text-gray-700 mb-1 italic">{segment.data.title}</p>
                             )}

                             {segment.data?.verse && (
                               <p className="text-xs text-gray-600 mb-1">📖 {segment.data.verse}</p>
                             )}

                             {segment.data?.description && (
                               <p className="text-xs text-gray-600 mt-2 italic">{segment.data.description}</p>
                             )}

                             {segment.data?.description_details && (
                               <div className="bg-gray-50 p-2 rounded border border-gray-200 text-xs mt-2">
                                 <strong className="text-gray-700">Notas:</strong>
                                 <p className="mt-1 text-gray-600">{segment.data.description_details}</p>
                               </div>
                             )}

                             {segment.data?.projection_notes && (
                               <div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs mt-2">
                                 <strong className="text-purple-800">📽️ Proyección:</strong>
                                 <p className="mt-1 text-purple-700">{segment.data.projection_notes}</p>
                               </div>
                             )}

                             {segment.data?.sound_notes && (
                               <div className="bg-red-50 p-2 rounded border border-red-200 text-xs mt-2">
                                 <strong className="text-red-800">🔊 Sonido:</strong>
                                 <p className="mt-1 text-red-700">{segment.data.sound_notes}</p>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     ))}
                    </div>
                  </div>
                )}

                {/* Receso */}
                <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
                  <p className="font-bold text-gray-600">RECESO (30 min)</p>
                  {actualServiceData.receso_notes?.["9:30am"] && (
                    <p className="text-sm text-gray-600 mt-2">{actualServiceData.receso_notes["9:30am"]}</p>
                  )}
                </div>

                {/* 11:30am Service */}
                {actualServiceData["11:30am"] && (
                  <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-blue-500">
                    <div className="bg-gradient-to-r from-blue-50 to-white p-4 border-b">
                      <h3 className="text-2xl font-bold uppercase mb-1 text-blue-600">11:30 a.m.</h3>
                      {actualServiceData.pre_service_notes?.["11:30am"] && (
                        <p className="text-sm text-gray-600 italic mt-2">{actualServiceData.pre_service_notes["11:30am"]}</p>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                      {actualServiceData["11:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                        <div key={idx} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="text-xl font-bold">{segment.title}</h4>
                                <Badge variant="outline" className="text-xs">{segment.duration} min</Badge>
                              </div>
                              
                              {segment.data?.leader && (
                                <p className="text-lg font-bold text-pdv-green mb-2">Dirige: {segment.data.leader}</p>
                              )}
                              
                              {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
                                <div className="bg-green-50 p-2 rounded border border-green-200 text-sm mb-2">
                                  <p className="font-semibold text-green-800 mb-1">Canciones:</p>
                                  {segment.songs.filter(s => s.title).map((song, sIdx) => (
                                    <div key={sIdx} className="text-xs">• {song.title} {song.lead && `(${song.lead})`}</div>
                                  ))}
                                </div>
                              )}
                              
                              {segment.data?.ministry_leader && (
                                <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                  <strong>Ministración (5 min):</strong> <span className="font-bold text-purple-900">{segment.data.ministry_leader}</span>
                                </div>
                              )}
                              
                              {segment.data?.translator && (
                                <div className="text-base font-bold text-blue-600 mb-2">
                                  🌐 Traduce: {segment.data.translator}
                                </div>
                              )}
                              
                              {segment.data?.presenter && !segment.data?.ministry_leader && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{segment.data.presenter}</p>
                              )}
                              
                              {segment.data?.preacher && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{segment.data.preacher}</p>
                              )}
                              
                              {segment.data?.title && (
                                <p className="text-sm text-gray-700 mb-1 italic">{segment.data.title}</p>
                              )}
                              
                              {segment.data?.verse && (
                                <p className="text-xs text-gray-600 mb-1">📖 {segment.data.verse}</p>
                              )}
                              
                              {segment.data?.description && (
                                <p className="text-xs text-gray-600 mt-2 italic">{segment.data.description}</p>
                              )}
                              
                              {segment.data?.description_details && (
                                <p className="text-xs text-gray-500 mt-2">{segment.data.description_details}</p>
                              )}
                              
                              {segment.data?.projection_notes && (
                                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-dashed border-gray-200">
                                  <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                                </div>
                              )}
                              
                              {segment.data?.sound_notes && (
                                <div className="text-xs text-gray-600 mt-1">
                                  <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sessions Display (for Event view type) */}
            {viewType === "event" && (
            <div className="space-y-6">
              {filteredSessions.map((session) => {
                const segments = getSessionSegments(session.id);
                if (segments.length === 0) return null;

                return (
                  <div key={session.id} className={`bg-white rounded-lg border-2 border-gray-300 overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
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
                        const segmentActions = getSegmentActions(segment);
                        const prepActions = segmentActions.filter(a => a.timing === 'before_start');
                        const duringActions = segmentActions.filter(a => a.timing !== 'before_start');

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
                                  <Card key={roomIdx} className="bg-white border-2 border-gray-300">
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

                        const isCurrent = isSegmentCurrent(segment);

                        return (
                          <div key={segment.id} className={`p-4 transition-colors border-b last:border-b-0 ${isCurrent ? 'bg-yellow-100 border-l-4 border-l-yellow-500' : 'hover:bg-gray-50'}`}>
                            {/* Current Segment Indicator */}
                            {isCurrent && (
                              <div className="mb-2">
                                <Badge className="bg-yellow-500 text-white animate-pulse">EN CURSO AHORA</Badge>
                              </div>
                            )}

                            {/* SIMPLE MODE */}
                            {viewMode === "simple" && (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
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

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xl font-bold">{segment.title}</h4>
                                    <Badge variant="outline" className="text-xs">{segment.segment_type}</Badge>
                                  </div>

                                  {segment.presenter && (
                                    <p className="text-blue-600 text-sm mt-1">{segment.presenter}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSegmentExpanded(segment.id)}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </div>
                            )}

                            {/* FULL RUN OF SHOW MODE */}
                            {viewMode === "full" && (
                              <div className="space-y-3">
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

                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                                  </div>
                                </div>

                                {/* Prep Actions */}
                                {prepActions.length > 0 && (
                                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                    <p className="font-bold text-amber-900 text-sm mb-2">⚠ PREPARACIÓN</p>
                                    <div className="space-y-1">
                                      {prepActions.map((action, idx) => (
                                        <div key={idx} className={`text-xs px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}>
                                          <span className="font-bold">[{action.department}]</span> {action.label}
                                          {action.offset_min !== undefined && (
                                            <span className="italic ml-1">({action.offset_min}m antes)</span>
                                          )}
                                          {action.notes && <span className="ml-1">— {action.notes}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* During Actions */}
                                {duringActions.length > 0 && (
                                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="font-bold text-blue-900 text-sm mb-2">▶ DURANTE SEGMENTO</p>
                                    <div className="space-y-1">
                                      {duringActions.map((action, idx) => (
                                        <div key={idx} className={`text-xs px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}>
                                          <span className="font-bold">[{action.department}]</span> {action.label}
                                          {action.notes && <span className="ml-1">— {action.notes}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Team Notes */}
                                <div className="grid md:grid-cols-2 gap-2">
                                  {segment.projection_notes && (
                                    <div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs">
                                      <span className="font-bold text-purple-800">PROYECCIÓN:</span>
                                      <p className="mt-1">{segment.projection_notes}</p>
                                    </div>
                                  )}
                                  {segment.sound_notes && (
                                    <div className="bg-red-50 p-2 rounded border border-red-200 text-xs">
                                      <span className="font-bold text-red-800">SONIDO:</span>
                                      <p className="mt-1">{segment.sound_notes}</p>
                                    </div>
                                  )}
                                  {segment.ushers_notes && (
                                    <div className="bg-green-50 p-2 rounded border border-green-200 text-xs">
                                      <span className="font-bold text-green-800">UJIERES:</span>
                                      <p className="mt-1">{segment.ushers_notes}</p>
                                    </div>
                                  )}
                                  {segment.translation_notes && (
                                    <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                                      <span className="font-bold text-blue-800">TRADUCCIÓN:</span>
                                      <p className="mt-1">{segment.translation_notes}</p>
                                    </div>
                                  )}
                                  {segment.stage_decor_notes && (
                                    <div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs">
                                      <span className="font-bold text-purple-800">STAGE & DECOR:</span>
                                      <p className="mt-1">{segment.stage_decor_notes}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Additional Details (collapsed by default in full mode) */}
                                {isExpanded && (
                                  <div className="border-t pt-3 space-y-2">
                                    {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                                      <div className="bg-green-50 p-2 rounded border border-green-200 text-xs">
                                        <p className="font-semibold text-green-800 mb-1">Canciones:</p>
                                        <div className="space-y-1">
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
                                      <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                                        <p className="font-semibold text-blue-800">Mensaje: {segment.message_title}</p>
                                        {segment.scripture_references && (
                                          <p className="mt-1">Escrituras: {segment.scripture_references}</p>
                                        )}
                                      </div>
                                    )}

                                    {segment.description_details && (
                                      <p className="text-gray-600 text-xs">{segment.description_details}</p>
                                    )}
                                  </div>
                                  )}

                                  <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSegmentExpanded(segment.id)}
                                  className="mt-2"
                                  >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  {isExpanded ? 'Menos' : 'Más Detalles'}
                                  </Button>
                                  </div>
                                  )}

                                  {/* Expanded details in SIMPLE mode */}
                                  {viewMode === "simple" && isExpanded && (
                                  <div className="mt-3 pt-3 border-t space-y-2">
                                  {segment.description_details && (
                                  <p className="text-gray-600 text-sm">{segment.description_details}</p>
                                  )}

                                  {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                                  <div className="bg-green-50 p-2 rounded border border-green-200 text-sm">
                                  <p className="font-semibold text-green-800 mb-1">Canciones:</p>
                                  <div className="space-y-1">
                                    {[...Array(segment.number_of_songs)].map((_, idx) => {
                                      const songNum = idx + 1;
                                      const title = segment[`song_${songNum}_title`];
                                      const lead = segment[`song_${songNum}_lead`];
                                      if (!title) return null;
                                      return <div key={songNum}>{songNum}. {title} {lead && `(${lead})`}</div>;
                                    })}
                                  </div>
                                  </div>
                                  )}

                                  {segment.segment_type === "Plenaria" && segment.message_title && (
                                  <div className="bg-blue-50 p-2 rounded border border-blue-200 text-sm">
                                  <p className="font-semibold text-blue-800">Mensaje: {segment.message_title}</p>
                                  {segment.scripture_references && (
                                    <p className="mt-1">Escrituras: {segment.scripture_references}</p>
                                  )}
                                  </div>
                                  )}
                                  </div>
                                  )}
                                  </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {viewType === "event" && filteredSessions.length === 0 && (
                  <Card className="p-12 text-center bg-white border-2 border-gray-300">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay sesiones disponibles para este evento</p>
              </Card>
            )}
          </>
        )}

        {!selectedEventId && !selectedServiceId && (
          <Card className="p-12 text-center bg-white border-dashed border-2 border-gray-400">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Selecciona un {viewType === "event" ? "evento" : "servicio"} para ver su programa</p>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 py-6 bg-gradient-to-r from-pdv-green to-pdv-teal">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
            alt="Logo" 
            className="w-12 h-12 mx-auto mb-3"
          />
          <p className="text-white font-semibold text-lg tracking-wide uppercase">¡Atrévete a cambiar!</p>
          <p className="text-white text-sm mt-2">Palabras de Vida</p>
        </div>
      </div>
    </div>
  );
}