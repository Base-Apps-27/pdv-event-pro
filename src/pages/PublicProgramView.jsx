import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Users, Languages, Mic, ChevronDown, ChevronUp, Filter, List, ListChecks, BookOpen, BellRing, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTimeToEST } from "../components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import StructuredVersesModal from "@/components/service/StructuredVersesModal";

export default function PublicProgramView() {
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
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
  const [versesModalOpen, setVersesModalOpen] = useState(false);
  const [versesModalData, setVersesModalData] = useState({ parsedData: null, rawText: "" });
  const [notifiedSegments, setNotifiedSegments] = useState(new Set());

  // Helper to parse date strings as local timezone dates at midnight
  const getLocalDateAtMidnight = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  // Update current time every second for real-time countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second
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
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch services (only WeeklyServiceManager date-specific instances)
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const allServices = await base44.entities.Service.list();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Construct local YYYY-MM-DD string for comparison
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayString = `${yyyy}-${mm}-${dd}`;

      // Filter to only date-specific weekly services (created by WeeklyServiceManager)
      return allServices
        .filter(s => 
          s.status === 'active' && 
          s.date && // Must have a specific date
          s.origin !== 'blueprint' && // Exclude old blueprint/template records
          s.date >= todayString // String comparison ensures timezone safety
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending
    },
    refetchInterval: 5000,
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

  // Auto-select what's happening TODAY (prioritize same-day activities)
  useEffect(() => {
    if (publicEvents.length > 0 && services.length > 0 && !selectedEventId && !selectedServiceId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check for events happening TODAY
      const todayEvent = publicEvents.find(e => {
        if (!e.start_date) return false;
        const eventDate = getLocalDateAtMidnight(e.start_date);
        const endDate = e.end_date ? getLocalDateAtMidnight(e.end_date) : eventDate;
        return eventDate && endDate && today.getTime() >= eventDate.getTime() && today.getTime() <= endDate.getTime();
      });
      
      // Check for services happening TODAY
      const todayService = services.find(s => {
        // String comparison is safest for YYYY-MM-DD
        const todayString = today.toLocaleDateString('sv-SE'); // Returns YYYY-MM-DD in most locales, safe for comparison
        // Fallback to manual construction if locale is weird
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const manualTodayString = `${yyyy}-${mm}-${dd}`;
        
        return s.date === manualTodayString;
      });
      
      // Priority: Today's service > Today's event > Next upcoming (within 7 days)
      if (todayService) {
        setSelectedServiceId(todayService.id);
        setViewType("service");
      } else if (todayEvent) {
        setSelectedEventId(todayEvent.id);
        setViewType("event");
      } else {
        // Find next upcoming (within 7 days)
        const sevenDaysOut = new Date(today);
        sevenDaysOut.setDate(today.getDate() + 7);
        
        const nextEvent = publicEvents.find(e => {
          if (!e.start_date) return false;
          const eventDate = getLocalDateAtMidnight(e.start_date);
          return eventDate && eventDate.getTime() > today.getTime() && eventDate.getTime() <= sevenDaysOut.getTime();
        });
        
        // Services are already sorted by date, just find next one
        const nextService = services.find(s => {
          const serviceDate = getLocalDateAtMidnight(s.date);
          return serviceDate && serviceDate.getTime() > today.getTime();
        });
        
        if (nextEvent && nextService) {
          const eventDaysAway = Math.floor((getLocalDateAtMidnight(nextEvent.start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const serviceDaysAway = Math.floor((getLocalDateAtMidnight(nextService.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (serviceDaysAway <= eventDaysAway) {
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
    }
  }, [publicEvents, services, preloadedEventId, preloadedServiceId]);

  // Fetch actual Service data for selected service
  const { data: weeklyServiceData } = useQuery({
    queryKey: ['weeklyServiceData', selectedServiceId],
    queryFn: async () => {
      const data = await base44.entities.Service.filter({ id: selectedServiceId });
      // Ensure we only work with active date-specific services
      return data.filter(s => s.status === 'active' && s.date);
    },
    enabled: !!(viewType === "service" && selectedServiceId),
    refetchInterval: 5000,
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
    refetchInterval: 5000,
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
    refetchInterval: 5000,
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
    refetchInterval: 30000, // Rooms change less frequently
  });

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const rawServiceData = weeklyServiceData?.[0] || null;
  
  // Calculate start times for weekly service segments (which usually lack them)
  const actualServiceData = React.useMemo(() => {
    if (!rawServiceData) return null;
    
    // Only process if it's a weekly service structure (has 9:30am/11:30am arrays)
    // Custom services usually have 'segments' with explicit times, but we can process those too if needed
    
    const calculateTimedSegments = (segments, startStr) => {
      if (!segments || !Array.isArray(segments)) return [];
      
      let currentH = parseInt(startStr.split(':')[0]);
      let currentM = parseInt(startStr.split(':')[1]);
      
      return segments.map(seg => {
        // If already has time, update current pointer to its end and return
        if (seg.start_time) {
          const [h, m] = seg.start_time.split(':').map(Number);
          currentH = h;
          currentM = m;
          
          const duration = seg.duration || 0;
          const date = new Date();
          date.setHours(currentH, currentM + duration, 0, 0);
          
          // Update pointer for next segment (if contiguous)
          currentH = date.getHours();
          currentM = date.getMinutes();
          
          return seg;
        }
        
        const startH = String(currentH).padStart(2, '0');
        const startM = String(currentM).padStart(2, '0');
        const startTime = `${startH}:${startM}`;
        
        // Add duration
        const duration = seg.duration || 0;
        const date = new Date();
        date.setHours(currentH, currentM + duration, 0, 0);
        
        currentH = date.getHours();
        currentM = date.getMinutes();
        
        const endH = String(currentH).padStart(2, '0');
        const endM = String(currentM).padStart(2, '0');
        const endTime = `${endH}:${endM}`;
        
        return {
          ...seg,
          start_time: startTime,
          end_time: endTime
        };
      });
    };

    const newData = { ...rawServiceData };
    
    if (newData["9:30am"]) {
      newData["9:30am"] = calculateTimedSegments(newData["9:30am"], "09:30");
    }
    if (newData["11:30am"]) {
      newData["11:30am"] = calculateTimedSegments(newData["11:30am"], "11:30");
    }
    
    return newData;
  }, [rawServiceData]);

  const eventSessions = sessions;
  const filteredSessions = eventSessions;

  // Real-time notifications for segments
  useEffect(() => {
    // Collect all segments from current view
    let segmentsToCheck = [];
    
    if (viewType === "service" && actualServiceData) {
      if (actualServiceData.segments) {
        segmentsToCheck = actualServiceData.segments.filter(s => s.start_time);
      } else {
        const morning = (actualServiceData["9:30am"] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        const afternoon = (actualServiceData["11:30am"] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        segmentsToCheck = [...morning, ...afternoon].filter(s => s.start_time && s.title);
      }
    } else if (viewType === "event") {
      segmentsToCheck = allSegments.filter(s => s.start_time && s.title);
    }

    if (segmentsToCheck.length === 0) return;

    const checkNotifications = () => {
      const now = new Date();
      
      segmentsToCheck.forEach(segment => {
        if (!segment.start_time || !segment.title) return;
        
        const segmentId = segment.id || `${segment.title}-${segment.start_time}`;
        
        // Parse start time
        const [segHours, segMins] = segment.start_time.split(':').map(Number);
        const segmentStart = new Date();
        segmentStart.setHours(segHours, segMins, 0, 0);
        
        const diffMs = segmentStart - now;
        const diffMins = Math.floor(diffMs / 60000);
        
        // Notify 2 minutes before
        if (diffMins === 2 && !notifiedSegments.has(`${segmentId}-2min`)) {
          toast.info(`⏰ ${segment.title} comienza en 2 minutos`, {
            duration: 10000,
            icon: <BellRing className="w-5 h-5" />,
          });
          setNotifiedSegments(prev => new Set(prev).add(`${segmentId}-2min`));
        }
        
        // Notify when segment starts
        if (diffMins === 0 && !notifiedSegments.has(`${segmentId}-start`)) {
          toast.success(`▶️ ${segment.title} está comenzando ahora`, {
            duration: 8000,
            icon: <Clock className="w-5 h-5" />,
          });
          setNotifiedSegments(prev => new Set(prev).add(`${segmentId}-start`));
        }
      });
    };

    // Check immediately, then every 30 seconds
    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, [actualServiceData, allSegments, viewType, notifiedSegments]);

  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  const isSegmentCurrent = (segment) => {
    if (!segment?.start_time || !segment?.end_time) return false;
    if (typeof segment.start_time !== 'string' || typeof segment.end_time !== 'string') return false;
    
    const now = currentTime;
    const [startHours, startMinutes] = segment.start_time.split(':').map(Number);
    const [endHours, endMinutes] = segment.end_time.split(':').map(Number);
    
    const startTime = new Date(now);
    startTime.setHours(startHours, startMinutes, 0);
    
    const endTime = new Date(now);
    endTime.setHours(endHours, endMinutes, 0);
    
    return now >= startTime && now <= endTime;
  };

  const getNextSegment = (segments) => {
    if (!segments || segments.length === 0) return null;
    
    const now = currentTime;
    const futureSegments = segments.filter(seg => {
      if (!seg?.start_time || typeof seg.start_time !== 'string') return false;
      const [hours, minutes] = seg.start_time.split(':').map(Number);
      const startTime = new Date(now);
      startTime.setHours(hours, minutes, 0);
      return startTime > now;
    });
    
    if (futureSegments.length === 0) return null;
    
    // Sort by start time and return first
    return futureSegments.sort((a, b) => {
      const [aH, aM] = a.start_time.split(':').map(Number);
      const [bH, bM] = b.start_time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    })[0];
  };

  const isSegmentUpcoming = (segment, allSegments) => {
    const nextSegment = getNextSegment(allSegments);
    if (!nextSegment || nextSegment.id !== segment.id) return false;
    if (!segment?.start_time || typeof segment.start_time !== 'string') return false;
    
    const now = currentTime;
    const [startHours, startMinutes] = segment.start_time.split(':').map(Number);
    const startTime = new Date(now);
    startTime.setHours(startHours, startMinutes, 0);
    const timeUntilStart = (startTime - now) / 1000 / 60;
    
    return timeUntilStart > 0 && timeUntilStart <= 15;
  };

  const getCountdownToNext = (segments) => {
    const nextSegment = getNextSegment(segments);
    if (!nextSegment || !nextSegment?.start_time || typeof nextSegment.start_time !== 'string') return null;
    
    const now = currentTime;
    const [hours, minutes] = nextSegment.start_time.split(':').map(Number);
    const startTime = new Date(now);
    startTime.setHours(hours, minutes, 0);
    const diffMs = startTime - now;
    const diffMin = Math.floor(diffMs / 1000 / 60);
    const diffSec = Math.floor((diffMs / 1000) % 60);
    
    return {
      segment: nextSegment,
      minutes: diffMin,
      seconds: diffSec,
      isNear: diffMin <= 15
    };
  };

  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "";
  };

  const normalizeSongs = (segment) => {
    // 1. Prefer existing songs array (Sunday services)
    if (segment.songs && Array.isArray(segment.songs) && segment.songs.length > 0) {
      return segment.songs;
    }
    
    // 2. Fallback to flat fields (Custom services / Segment entities)
    // Check both root level and .data property just in case
    const songs = [];
    const getField = (field) => segment[field] || segment.data?.[field];
    
    // Check up to 6 songs (standard max)
    for (let i = 1; i <= 6; i++) {
      const title = getField(`song_${i}_title`);
      if (title) {
        songs.push({
          title,
          lead: getField(`song_${i}_lead`),
          key: getField(`song_${i}_key`)
        });
      }
    }
    return songs;
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
    // CustomServiceBuilder stores in 'actions', Session entities use 'segment_actions'
    const rawActions = segment?.actions || segment?.segment_actions || [];
    
    // HOTFIX: Filter out "Mensaje" actions that were incorrectly merged into "Special" segments
    const isSpecial = ['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type);
    
    if (isSpecial) {
      return rawActions.filter(action => {
        const label = (action.label || '').toLowerCase();
        // Filter out specific message closure actions
        if (label.includes('pianista sube') || label.includes('equipo de a&a sube')) return false;
        return true;
      });
    }
    
    return rawActions;
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
      <div style={gradientStyle} className="text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
                alt="Logo" 
                className="w-16 h-16 md:w-20 md:h-20"
              />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">Programa del Evento</h1>
                <p className="text-sm md:text-base text-white/95 mt-1">¡ATRÉVETE A CAMBIAR!</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-lg">
              <BellRing className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-medium">Notificaciones activas</span>
            </div>
          </div>
          <p className="text-lg text-white/95">Explora el programa completo y mantente actualizado</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Navigation Selector */}
        <Card className="bg-white border-2 border-gray-300">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* View Type Toggle */}
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setViewType("event")}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
                  style={viewType === "event" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
                >
                  Eventos
                </button>
                <button
                  onClick={() => setViewType("service")}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
                  style={viewType === "service" ? { backgroundColor: '#8DC63F', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
                >
                  Servicios
                </button>
              </div>

              {/* Event Selector (1 past, 1 upcoming within 7 days) */}
              {viewType === "event" && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const sevenDaysOut = new Date(today);
                sevenDaysOut.setDate(today.getDate() + 7);
                
                const pastEvents = publicEvents.filter(e => {
                  if (!e.start_date) return false;
                  const eventDate = new Date(e.start_date);
                  return eventDate < today;
                }).slice(0, 1);
                
                const upcomingEvents = publicEvents.filter(e => {
                  if (!e.start_date) return false;
                  const eventDate = new Date(e.start_date);
                  return eventDate >= today && eventDate <= sevenDaysOut;
                }).slice(0, 1);
                
                const availableEvents = [...pastEvents, ...upcomingEvents];
                
                return (
                  <div className="w-full">
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="w-full bg-white border-2 border-gray-400 text-gray-900 h-12">
                        <SelectValue placeholder="Selecciona un evento" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {availableEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} - {event.start_date}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}

              {/* Service Selector (upcoming within 7 days) */}
              {viewType === "service" && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const sevenDaysOut = new Date(today);
                sevenDaysOut.setDate(today.getDate() + 7);

                // Services are already filtered and sorted by date
                const upcomingServices = services
                  .filter(s => {
                    const serviceDate = getLocalDateAtMidnight(s.date);
                    return serviceDate && serviceDate.getTime() <= sevenDaysOut.getTime();
                  })
                  .map(service => {
                    const serviceDate = getLocalDateAtMidnight(service.date);
                    const diffTime = serviceDate.getTime() - today.getTime();
                    const daysUntil = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    return { ...service, daysUntil };
                  })
                  .reduce((acc, service) => {
                    // Dedupe by date - keep only the most recently updated service per date
                    const existing = acc.find(s => s.date === service.date);
                    if (!existing) {
                      acc.push(service);
                    } else if (new Date(service.updated_date) > new Date(existing.updated_date)) {
                      const idx = acc.indexOf(existing);
                      acc[idx] = service;
                    }
                    return acc;
                  }, []);

                return (
                  <div className="w-full">
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger className="w-full bg-white border-2 border-gray-400 text-gray-900 h-12">
                        <SelectValue placeholder="Selecciona un servicio" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {upcomingServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - {service.date} ({service.daysUntil === 0 ? 'Hoy' : service.daysUntil === 1 ? 'Mañana' : `en ${service.daysUntil} días`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

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
                {viewType === "event" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEventDetails(!showEventDetails)}
                    className="mb-4 border-2 border-gray-400 bg-white text-gray-900 font-semibold"
                  >
                    {showEventDetails ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                    {showEventDetails ? 'Ocultar Detalles' : 'Ver Más Detalles'}
                  </Button>
                )}

                {/* Expanded Details */}
                {showEventDetails && viewType === "event" && (
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

            {/* View Mode and Filters Card - Only show for Events */}
            {viewType === "event" && (
              <Card className="bg-white border-2 border-gray-300">
                <CardHeader className="bg-gray-100 border-b-2 border-gray-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-5 h-5" style={{ color: '#1F8A70' }} />
                      <h3 className="text-lg font-bold uppercase text-gray-900">Vista y Filtros</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode("simple")}
                        className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                        style={viewMode === "simple" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
                      >
                        <List className="w-4 h-4" />
                        Simple
                      </button>
                      <button
                        onClick={() => setViewMode("full")}
                        className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                        style={viewMode === "full" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
                      >
                        <ListChecks className="w-4 h-4" />
                        Run of Show
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">Filtrar por Sesión</label>
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                      <SelectTrigger className="bg-white border-2 border-gray-400 text-gray-900">
                        <SelectValue className="text-gray-900" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-gray-900">
                        <SelectItem value="all" className="text-gray-900">Todas las Sesiones</SelectItem>
                        {eventSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id} className="text-gray-900">
                            {session.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Services Display (for Service view type) */}
            {viewType === "service" && actualServiceData && (
              // Check for CustomServiceBuilder format (segments array)
              (actualServiceData.segments && actualServiceData.segments.length > 0) ? (
              <div className="space-y-6">
                {/* Countdown Timer for Custom Services */}
                {(() => {
                  const countdown = getCountdownToNext(actualServiceData.segments.filter(s => s.start_time));
                  if (!countdown) return null;

                  const sortedSegments = actualServiceData.segments.filter(s => s.start_time).sort((a, b) => {
                    const [aH, aM] = a.start_time.split(':').map(Number);
                    const [bH, bM] = b.start_time.split(':').map(Number);
                    return (aH * 60 + aM) - (bH * 60 + bM);
                  });
                  const isFirstSegment = sortedSegments[0]?.title === countdown.segment.title;
                  const maxMinutes = isFirstSegment ? 120 : 60;

                  if (countdown.minutes > maxMinutes) return null;

                  return (
                    <Card className={`mb-6 ${countdown.isNear ? 'border-blue-500 border-2' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Próximo Segmento</p>
                            <p className="font-bold text-lg text-gray-900">{countdown.segment.title}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${countdown.isNear ? 'text-blue-600' : 'text-gray-700'}`}>
                              {countdown.minutes}:{countdown.seconds.toString().padStart(2, '0')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {countdown.minutes === 0 ? 'segundos' : countdown.minutes === 1 ? 'minuto' : 'minutos'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Custom Service Segments */}
                <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
                 <div className="bg-gradient-to-r from-pdv-teal/10 to-white p-4 border-b">
                   <h3 className="text-2xl font-bold uppercase text-pdv-teal">{actualServiceData.name}</h3>
                   {actualServiceData.description && (
                     <p className="text-sm text-gray-600 mt-2">{actualServiceData.description}</p>
                   )}
                   {/* Team Info - Compact */}
                   {(actualServiceData.coordinators || actualServiceData.ujieres || actualServiceData.sound || actualServiceData.luces) && (
                     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                       {actualServiceData.coordinators && Object.values(actualServiceData.coordinators).find(v => v) && (
                         <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["9:30am"] || actualServiceData.coordinators["11:30am"] || Object.values(actualServiceData.coordinators).find(v => v))}</span>
                       )}
                       {actualServiceData.ujieres && Object.values(actualServiceData.ujieres).find(v => v) && (
                         <>
                           <span className="text-gray-400">|</span>
                           <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["9:30am"] || actualServiceData.ujieres["11:30am"] || Object.values(actualServiceData.ujieres).find(v => v))}</span>
                         </>
                       )}
                       {actualServiceData.sound && Object.values(actualServiceData.sound).find(v => v) && (
                         <>
                           <span className="text-gray-400">|</span>
                           <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["9:30am"] || actualServiceData.sound["11:30am"] || Object.values(actualServiceData.sound).find(v => v))}</span>
                         </>
                       )}
                       {actualServiceData.luces && Object.values(actualServiceData.luces).find(v => v) && (
                         <>
                           <span className="text-gray-400">|</span>
                           <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["9:30am"] || actualServiceData.luces["11:30am"] || Object.values(actualServiceData.luces).find(v => v))}</span>
                         </>
                       )}
                     </div>
                   )}
                 </div>
                  <div className="divide-y divide-gray-200">
                    {actualServiceData.segments.filter(seg => seg.type !== 'break').map((segment, idx) => {
                      const isCurrent = isSegmentCurrent(segment);
                      const isUpcoming = !isCurrent && isSegmentUpcoming(segment, actualServiceData.segments);

                      return (
                        <div key={idx} className={`p-4 ${isCurrent ? 'bg-yellow-100 border-l-4 border-l-yellow-500' : isUpcoming ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>
                          {isCurrent && (
                            <div className="mb-2">
                              <Badge className="bg-yellow-500 text-white animate-pulse">EN CURSO AHORA</Badge>
                            </div>
                          )}
                          {isUpcoming && (
                            <div className="mb-2">
                              <Badge className="bg-blue-500 text-white">PRÓXIMO (15 min)</Badge>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {segment.start_time && (
                                  <span className="font-bold text-lg text-gray-900">{formatTimeToEST(segment.start_time)}</span>
                                )}
                                <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                  {(['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type)) && (
                                    <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                                  )}
                                  {segment.title}
                                </h4>
                                <Badge variant="outline" className="text-xs text-gray-700">{segment.duration} min</Badge>
                              </div>

                              {segment.data?.leader && (
                                <p className="text-lg font-bold text-blue-600 mb-2">Dirige: {normalizeName(segment.data.leader)}</p>
                              )}

                              {(() => {
                                const songs = normalizeSongs(segment).filter(s => s.title);
                                if (songs.length === 0) return null;
                                return (
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200 text-sm mb-2">
                                    <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                                    {songs.map((song, sIdx) => (
                                      <div key={sIdx} className="text-xs flex items-center gap-1">
                                        <span>• {song.title}</span>
                                        {song.lead && <span className="text-gray-600">({song.lead})</span>}
                                        {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {segment.data?.presenter && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{normalizeName(segment.data.presenter)}</p>
                              )}

                              {segment.data?.presenter && segment.requires_translation && segment.data?.translator && !/(trad|traduc)/i.test(segment.data?.presenter || '') && (
                                <p className="text-sm text-blue-600 mb-2 ml-4">
                                  🌐 Traduce: {normalizeName(segment.data.translator)}
                                </p>
                              )}

                              {segment.data?.preacher && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{normalizeName(segment.data.preacher)}</p>
                              )}

                              {segment.data?.preacher && segment.requires_translation && segment.data?.translator && !/(trad|traduc)/i.test(segment.data?.preacher || '') && (
                                <p className="text-sm text-blue-600 mb-2 ml-4">
                                  🌐 Traduce: {normalizeName(segment.data.translator)}
                                </p>
                              )}

                              {/* Cierre sub-assignment (shown after speaker) */}
                              {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
                                const personValue = segment.data?.[subAssign.person_field_name];
                                if (!personValue) return null;
                                return (
                                  <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                    <strong>{subAssign.label} {subAssign.duration_min && `(${subAssign.duration_min} min)`}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                  </div>
                                );
                              })}

                              {segment.data?.title && (
                                <p className="text-sm text-gray-700 mb-1 italic">{segment.data.title}</p>
                              )}

                              {/* Verse Display - Prioritized for Messages */}
                              {(segment.data?.verse || (segment.data?.parsed_verse_data && (segment.type === 'message' || segment.title === 'Mensaje' || segment.title === 'Message'))) && (
                                <div className="flex items-start gap-2 mb-2">
                                  {segment.data?.verse ? (
                                    <p className="text-xs text-gray-600 flex-1">📖 {segment.data.verse}</p>
                                  ) : (
                                    <div className="flex-1"></div>
                                  )}
                                  {segment.data?.parsed_verse_data && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        setVersesModalData({
                                          parsedData: segment.data.parsed_verse_data,
                                          rawText: segment.data.verse
                                        });
                                        setVersesModalOpen(true);
                                      }}
                                      className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0 bg-white"
                                      title="Ver Versículos"
                                    >
                                      <BookOpen className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}

                              {segment.data?.description && (
                                <p className="text-xs text-gray-600 mt-2 italic">{segment.data.description}</p>
                              )}

                              {/* Coordinator Actions */}
                              {segment.actions && segment.actions.length > 0 && (
                                <div className="bg-[#fffdf5] border border-yellow-100 rounded p-2 text-xs mt-2">
                                  <p className="font-bold text-yellow-800 mb-1 opacity-75">📋 Coordinador</p>
                                  <div className="space-y-1">
                                    {segment.actions.map((action, aIdx) => {
                                      const safeAction = typeof action === 'object' && action !== null ? action : {};
                                      return (
                                      <div key={aIdx} className="text-yellow-900 not-italic">
                                        • {safeAction.label || ''}
                                        {safeAction.notes && <span className="ml-1 opacity-75">— {safeAction.notes}</span>}
                                      </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (actualServiceData["9:30am"] && actualServiceData["9:30am"].length > 0) || 
              (actualServiceData["11:30am"] && actualServiceData["11:30am"].length > 0) ? (
              <div className="space-y-6">
                {/* Countdown Timer - 2 hours for first segment, 1 hour for others */}
                {(() => {
                  const allServiceSegments = [
                    ...(actualServiceData?.['9:30am'] || []),
                    ...(actualServiceData?.['11:30am'] || [])
                  ].map(s => ({
                    ...s,
                    start_time: s.start_time || s.data?.start_time,
                    title: s.title || s.data?.title || 'Untitled'
                  })).filter(s => s.start_time);
                  
                  const countdown = getCountdownToNext(allServiceSegments);
                  if (!countdown) return null;
                  
                  // Check if this is the first segment
                  const sortedSegments = allServiceSegments.sort((a, b) => {
                    const [aH, aM] = a.start_time.split(':').map(Number);
                    const [bH, bM] = b.start_time.split(':').map(Number);
                    return (aH * 60 + aM) - (bH * 60 + bM);
                  });
                  const isFirstSegment = sortedSegments[0]?.title === countdown.segment.title;
                  const maxMinutes = isFirstSegment ? 120 : 60;
                  
                  if (countdown.minutes > maxMinutes) return null;
                  
                  return (
                    <Card className={`mb-6 ${countdown.isNear ? 'border-blue-500 border-2' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Próximo Segmento</p>
                            <p className="font-bold text-lg text-gray-900">{countdown.segment.title}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${countdown.isNear ? 'text-blue-600' : 'text-gray-700'}`}>
                              {countdown.minutes}:{countdown.seconds.toString().padStart(2, '0')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {countdown.minutes === 0 ? 'segundos' : countdown.minutes === 1 ? 'minuto' : 'minutos'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 9:30am Service */}
                {actualServiceData["9:30am"] && (
                  <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-red-500">
                    <div className="bg-gradient-to-r from-red-50 to-white p-4 border-b">
                      <h3 className="text-2xl font-bold uppercase mb-1 text-red-600">9:30 A.M.</h3>
                      {actualServiceData.pre_service_notes?.["9:30am"] && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                          <p className="text-sm text-green-900 font-medium italic whitespace-pre-wrap line-clamp-3">{actualServiceData.pre_service_notes["9:30am"]}</p>
                        </div>
                      )}
                      {/* Team Info - Compact */}
                      {(actualServiceData.coordinators?.["9:30am"] || actualServiceData.ujieres?.["9:30am"] || actualServiceData.sound?.["9:30am"] || actualServiceData.luces?.["9:30am"]) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                          {actualServiceData.coordinators?.["9:30am"] && (
                            <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["9:30am"])}</span>
                          )}
                          {actualServiceData.ujieres?.["9:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["9:30am"])}</span>
                            </>
                          )}
                          {actualServiceData.sound?.["9:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["9:30am"])}</span>
                            </>
                          )}
                          {actualServiceData.luces?.["9:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["9:30am"])}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                     {actualServiceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                       <div key={idx} className="p-4 hover:bg-gray-50">
                         <div className="flex items-start justify-between gap-4">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2 flex-wrap">
                               <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                 {(['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type)) && (
                                   <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                                 )}
                                 {segment.title}
                               </h4>
                               <Badge variant="outline" className="text-xs text-gray-700">{segment.duration} min</Badge>
                             </div>

                             {segment.data?.leader && (
                                                                  <p className="text-lg font-bold text-blue-600 mb-2">Dirige: {normalizeName(segment.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, ''))}</p>
                                                                )}

                             {(() => {
                               const songs = normalizeSongs(segment).filter(s => s.title);
                               if (songs.length === 0) return null;
                               return (
                                 <div className="bg-slate-50 p-2 rounded border border-slate-200 text-sm mb-2">
                                   <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                                   {songs.map((song, sIdx) => (
                                     <div key={sIdx} className="text-xs flex items-center gap-1">
                                       <span>• {song.title}</span>
                                       {song.lead && <span className="text-gray-600">({song.lead})</span>}
                                       {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                                     </div>
                                   ))}
                                 </div>
                               );
                             })()}

                             {/* Sub-assignments from blueprint (excluding cierre, shown after speaker) */}
                             {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name !== 'cierre_leader').map((subAssign, saIdx) => {
                               const personValue = segment.data?.[subAssign.person_field_name];
                               if (!personValue) return null;
                               return (
                                 <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                   <strong>{subAssign.label} {subAssign.duration_min && `(${subAssign.duration_min} min)`}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                 </div>
                               );
                             })}

                             {/* Legacy fallback */}
                             {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
                               <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                 <strong>Ministración (5 min):</strong> <span className="font-bold text-purple-900">{segment.data.ministry_leader}</span>
                               </div>
                             )}

                             {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && (
                                                                  <p className="text-lg font-bold text-blue-600 mb-2">{normalizeName(segment.data.presenter)}</p>
                                                                )}

                             {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && segment.requires_translation && segment.data?.translator && !/(trad|traduc)/i.test(segment.data?.presenter || '') && (
                               <p className="text-sm text-blue-600 mb-2 ml-4">
                                 🌐 Traduce: {segment.data.translator}
                               </p>
                             )}

                             {segment.data?.preacher && (
                               <p className="text-lg font-bold text-blue-600 mb-2">{segment.data.preacher}</p>
                             )}

                             {segment.data?.preacher && segment.requires_translation && segment.data?.translator && !/(trad|traduc)/i.test(segment.data?.preacher || '') && (
                               <p className="text-sm text-blue-600 mb-2 ml-4">
                                 🌐 Traduce: {segment.data.translator}
                               </p>
                             )}

                             {/* Cierre sub-assignment (shown after speaker) */}
                             {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
                               const personValue = segment.data?.[subAssign.person_field_name];
                               if (!personValue) return null;
                               return (
                                 <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                   <strong>{subAssign.label} {subAssign.duration_min && `(${subAssign.duration_min} min)`}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                 </div>
                               );
                             })}

                             {segment.data?.title && (
                               <p className="text-sm text-gray-700 mb-1 italic">{segment.data.title}</p>
                             )}

                             {(segment.data?.verse || segment.data?.parsed_verse_data) && (
                               <div className="flex items-start gap-2">
                                 {segment.data?.verse && (
                                   <p className="text-xs text-gray-600 mb-1 flex-1">📖 {segment.data.verse}</p>
                                 )}
                                 {!segment.data?.verse && <div className="flex-1"></div>}
                                 {segment.data?.parsed_verse_data && (
                                   <Button
                                     variant="outline"
                                     size="icon"
                                     onClick={() => {
                                       setVersesModalData({
                                         parsedData: segment.data.parsed_verse_data,
                                         rawText: segment.data.verse
                                       });
                                       setVersesModalOpen(true);
                                     }}
                                     className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                     title="Ver Versículos"
                                   >
                                     <BookOpen className="w-3.5 h-3.5" />
                                   </Button>
                                 )}
                               </div>
                             )}

                             {segment.data?.description && (
                               <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                 <p className="text-sm text-green-900 font-medium">{segment.data.description}</p>
                               </div>
                             )}

                             {segment.data?.description_details && (
                               <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                 <p className="text-sm text-green-900 font-medium">
                                   <strong>📝 Notas:</strong> {segment.data.description_details}
                                 </p>
                               </div>
                             )}

                             {segment.data?.projection_notes && (
                               <div className="pl-2 border-l-4 border-blue-500 mt-1 bg-transparent">
                                 <p className="text-xs text-blue-800">
                                   <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                                 </p>
                               </div>
                             )}

                             {segment.data?.sound_notes && (
                               <div className="pl-2 border-l-4 border-red-500 mt-1 bg-transparent">
                                 <p className="text-xs text-red-800">
                                   <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                                 </p>
                               </div>
                             )}

                             {/* Coordinator Actions */}
                             {segment.actions && segment.actions.length > 0 && (
                               <div className="bg-[#fffdf5] border border-yellow-100 rounded p-2 text-xs mt-2">
                                 <p className="font-bold text-yellow-800 mb-1 opacity-75">📋 Acciones para Coordinador</p>
                                 <div className="space-y-1">
                                   {segment.actions.map((action, aIdx) => {
                                     const safeAction = typeof action === 'object' && action !== null ? action : {};
                                     return (
                                     <div key={aIdx} className="text-yellow-900 not-italic">
                                       • {safeAction.label || ''}
                                       {safeAction.notes && <span className="ml-1 opacity-75">— {safeAction.notes}</span>}
                                     </div>
                                     );
                                   })}
                                 </div>
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
                      <h3 className="text-2xl font-bold uppercase mb-1 text-blue-600">11:30 A.M.</h3>
                      {actualServiceData.pre_service_notes?.["11:30am"] && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                          <p className="text-sm text-gray-600 font-medium italic whitespace-pre-wrap line-clamp-3">{actualServiceData.pre_service_notes["11:30am"]}</p>
                        </div>
                      )}
                      {/* Team Info - Compact */}
                      {(actualServiceData.coordinators?.["11:30am"] || actualServiceData.ujieres?.["11:30am"] || actualServiceData.sound?.["11:30am"] || actualServiceData.luces?.["11:30am"]) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                          {actualServiceData.coordinators?.["11:30am"] && (
                            <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["11:30am"])}</span>
                          )}
                          {actualServiceData.ujieres?.["11:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["11:30am"])}</span>
                            </>
                          )}
                          {actualServiceData.sound?.["11:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["11:30am"])}</span>
                            </>
                          )}
                          {actualServiceData.luces?.["11:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["11:30am"])}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                      {actualServiceData["11:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                        <div key={idx} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                  {(['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type)) && (
                                    <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                                  )}
                                  {segment.title}
                                </h4>
                                <Badge variant="outline" className="text-xs text-gray-700">{segment.duration} min</Badge>
                              </div>
                              
                              {segment.data?.leader && (
                                <p className="text-lg font-bold text-blue-600 mb-2">Dirige: {segment.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</p>
                              )}
                              
                              {(() => {
                                const songs = normalizeSongs(segment).filter(s => s.title);
                                if (songs.length === 0) return null;
                                return (
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200 text-sm mb-2">
                                    <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                                    {songs.map((song, sIdx) => (
                                      <div key={sIdx} className="text-xs flex items-center gap-1">
                                        <span>• {song.title}</span>
                                        {song.lead && <span className="text-gray-600">({song.lead})</span>}
                                        {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              
                              {/* Sub-assignments from blueprint (excluding cierre, shown after speaker) */}
                              {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name !== 'cierre_leader').map((subAssign, saIdx) => {
                                const personValue = segment.data?.[subAssign.person_field_name];
                                if (!personValue) return null;
                                return (
                                  <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                    <strong>{subAssign.label} {subAssign.duration_min && `(${subAssign.duration_min} min)`}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                  </div>
                                );
                              })}
                              
                              {/* Legacy fallback */}
                              {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
                                <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                  <strong>Ministración (5 min):</strong> <span className="font-bold text-purple-900">{segment.data.ministry_leader}</span>
                                </div>
                              )}
                              
                              {segment.data?.presenter && !segment.data?.ministry_leader && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{normalizeName(segment.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, ''))}</p>
                              )}

                              {segment.data?.preacher && (
                                <p className="text-lg font-bold text-blue-600 mb-2">{normalizeName(segment.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, ''))}</p>
                              )}

                              {/* Cierre sub-assignment (shown after speaker) */}
                              {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
                                const personValue = segment.data?.[subAssign.person_field_name];
                                if (!personValue) return null;
                                return (
                                  <div key={saIdx} className="bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-2">
                                    <strong>{subAssign.label} {subAssign.duration_min && `(${subAssign.duration_min} min)`}:</strong> <span className="font-bold text-purple-900">{personValue}</span>
                                  </div>
                                );
                              })}

                              {segment.requires_translation && segment.data?.translator && (
                                <p className="text-xs text-blue-600 mt-1">
                                  🌐 Traduce: {normalizeName(segment.data.translator)}
                                </p>
                              )}
                              
                              {segment.data?.title && (
                                <p className="text-sm text-gray-700 mb-1 italic">{segment.data.title}</p>
                              )}
                              
                              {/* Verse Display - Prioritized for Messages */}
                              {(segment.data?.verse || (segment.data?.parsed_verse_data && (segment.type === 'message' || segment.title === 'Mensaje' || segment.title === 'Message'))) && (
                                <div className="flex items-start gap-2 mb-2">
                                  {segment.data?.verse ? (
                                    <p className="text-xs text-gray-600 flex-1">📖 {segment.data.verse}</p>
                                  ) : (
                                    <div className="flex-1"></div>
                                  )}
                                  {segment.data?.parsed_verse_data && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        setVersesModalData({
                                          parsedData: segment.data.parsed_verse_data,
                                          rawText: segment.data.verse
                                        });
                                        setVersesModalOpen(true);
                                      }}
                                      className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0 bg-white"
                                      title="Ver Versículos"
                                    >
                                      <BookOpen className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              {segment.data?.description && (
                                <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                  <p className="text-sm text-green-900 font-medium">{segment.data.description}</p>
                                </div>
                              )}

                              {segment.data?.description_details && (
                                <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                  <p className="text-sm text-green-900 font-medium">
                                    <strong>📝 Notas:</strong> {segment.data.description_details}
                                  </p>
                                </div>
                              )}
                              
                              {segment.data?.projection_notes && (
                                <div className="pl-2 border-l-4 border-blue-500 mt-1 bg-transparent">
                                  <p className="text-xs text-blue-800">
                                    <strong>📽️ Proyección:</strong> {segment.data.projection_notes}
                                  </p>
                                </div>
                              )}

                              {segment.data?.sound_notes && (
                                <div className="pl-2 border-l-4 border-red-500 mt-1 bg-transparent">
                                  <p className="text-xs text-red-800">
                                    <strong>🔊 Sonido:</strong> {segment.data.sound_notes}
                                  </p>
                                </div>
                              )}

                              {/* Coordinator Actions */}
                              {segment.actions && segment.actions.length > 0 && (
                                <div className="bg-[#fffdf5] border border-yellow-100 rounded p-2 text-xs mt-2">
                                  <p className="font-bold text-yellow-800 mb-1 opacity-75">📋 Acciones para Coordinador</p>
                                  <div className="space-y-1">
                                    {segment.actions.map((action, aIdx) => {
                                      const safeAction = typeof action === 'object' && action !== null ? action : {};
                                      return (
                                      <div key={aIdx} className="text-yellow-900 not-italic">
                                        • {safeAction.label || ''}
                                        {safeAction.notes && <span className="ml-1 opacity-75">— {safeAction.notes}</span>}
                                      </div>
                                      );
                                    })}
                                  </div>
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
                              ) : (
                              <Card className="p-12 text-center bg-white border-2 border-gray-300">
                                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
                              </Card>
                              )
                              )}

            {/* Sessions Display (for Event view type) */}
            {viewType === "event" && (
            <div className="space-y-6">
              {/* Countdown Timer for Events - 2 hours for first segment, 1 hour for others */}
              {(() => {
                const countdown = getCountdownToNext(allSegments);
                if (!countdown) return null;
                
                // Check if this is the first segment
                const sortedSegments = allSegments.filter(s => s.start_time).sort((a, b) => {
                  const [aH, aM] = a.start_time.split(':').map(Number);
                  const [bH, bM] = b.start_time.split(':').map(Number);
                  return (aH * 60 + aM) - (bH * 60 + bM);
                });
                const isFirstSegment = sortedSegments[0]?.id === countdown.segment.id;
                const maxMinutes = isFirstSegment ? 120 : 60;
                
                if (countdown.minutes > maxMinutes) return null;
                
                return (
                  <Card className={`mb-6 ${countdown.isNear ? 'border-blue-500 border-2' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Próximo Segmento</p>
                          <p className="font-bold text-lg">{countdown.segment.title}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-3xl font-bold ${countdown.isNear ? 'text-blue-600' : 'text-gray-700'}`}>
                            {countdown.minutes}:{countdown.seconds.toString().padStart(2, '0')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {countdown.minutes === 0 ? 'segundos' : countdown.minutes === 1 ? 'minuto' : 'minutos'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {filteredSessions.map((session) => {
                const segments = getSessionSegments(session.id);
                if (segments.length === 0) return null;

                return (
                  <div key={session.id} className={`bg-white rounded-lg border-2 border-gray-300 overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 border-b">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold uppercase mb-1 text-gray-900">{session.name}</h3>
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
                          {/* Team Info - Compact */}
                          {(session.coordinators || session.ushers_team || session.sound_team || session.tech_team) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                              {session.coordinators && (
                                <span><strong>👤 Coord:</strong> {normalizeName(session.coordinators)}</span>
                              )}
                              {session.ushers_team && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>🚪 Ujieres:</strong> {normalizeName(session.ushers_team)}</span>
                                </>
                              )}
                              {session.sound_team && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>🔊 Sonido:</strong> {normalizeName(session.sound_team)}</span>
                                </>
                              )}
                              {session.tech_team && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>💡 Tech:</strong> {normalizeName(session.tech_team)}</span>
                                </>
                              )}
                            </div>
                          )}
                          {/* Custom Service team display */}
                          {viewType === "service" && actualServiceData?.coordinators && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                              {actualServiceData.coordinators && (
                                <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["9:30am"] || actualServiceData.coordinators["11:30am"] || Object.values(actualServiceData.coordinators).find(v => v))}</span>
                              )}
                              {actualServiceData.ujieres && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["9:30am"] || actualServiceData.ujieres["11:30am"] || Object.values(actualServiceData.ujieres).find(v => v))}</span>
                                </>
                              )}
                              {actualServiceData.sound && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["9:30am"] || actualServiceData.sound["11:30am"] || Object.values(actualServiceData.sound).find(v => v))}</span>
                                </>
                              )}
                              {actualServiceData.luces && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["9:30am"] || actualServiceData.luces["11:30am"] || Object.values(actualServiceData.luces).find(v => v))}</span>
                                </>
                              )}
                            </div>
                          )}

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
                                                    <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-800">
                                                      {getRoomName(room.room_id)}
                                                    </Badge>
                                                  )}
                                                  <h5 className="font-bold mb-2 text-gray-900">{room.topic || `Sala ${roomIdx + 1}`}</h5>
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
                        const isUpcoming = !isCurrent && isSegmentUpcoming(segment, allSegments);

                        return (
                          <div key={segment.id} className={`p-4 transition-colors border-b last:border-b-0 ${isCurrent ? 'bg-yellow-100 border-l-4 border-l-yellow-500' : isUpcoming ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>
                            {/* Current Segment Indicator */}
                            {isCurrent && (
                              <div className="mb-2">
                                <Badge className="bg-yellow-500 text-white animate-pulse">EN CURSO AHORA</Badge>
                              </div>
                            )}
                            
                            {/* Upcoming Segment Indicator */}
                            {isUpcoming && (
                              <div className="mb-2">
                                <Badge className="bg-blue-500 text-white">PRÓXIMO (15 min)</Badge>
                              </div>
                            )}

                            {/* SIMPLE MODE */}
                            {viewMode === "simple" && (
                              <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <Clock className="w-5 h-5 text-pdv-teal flex-shrink-0" />
                                      <div>
                                        <span className="font-bold text-lg text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</span>
                                      {segment.end_time && (
                                        <span className="text-gray-600 ml-2">- {formatTimeToEST(segment.end_time)}</span>
                                      )}
                                      {segment.duration_min && (
                                        <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                      {(segment.segment_type === 'Especial' || segment.type === 'Especial') && (
                                        <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                                      )}
                                      {segment.title}
                                    </h4>
                                    <Badge variant="outline" className="text-xs text-gray-700">{segment.segment_type}</Badge>
                                  </div>

                                  {segment.presenter && (
                                    <p className="text-blue-600 text-sm mt-1">{normalizeName(segment.presenter)}</p>
                                  )}

                                  {(segment.scripture_references || segment.parsed_verse_data) && (
                                    <div className="flex items-start gap-2 mt-2">
                                      {segment.scripture_references && (
                                        <p className="text-xs text-gray-600 flex-1">📖 {segment.scripture_references}</p>
                                      )}
                                      {!segment.scripture_references && <div className="flex-1"></div>}
                                      {segment.parsed_verse_data && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          onClick={() => {
                                            setVersesModalData({
                                              parsedData: segment.parsed_verse_data,
                                              rawText: segment.scripture_references
                                            });
                                            setVersesModalOpen(true);
                                          }}
                                          className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                          title="Ver Versículos"
                                        >
                                          <BookOpen className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
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
                                      <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        {(segment.segment_type === 'Especial' || segment.type === 'Especial') && (
                                          <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                                        )}
                                        {segment.title}
                                      </h4>
                                      <Badge variant="outline" className="text-xs text-gray-700">{segment.segment_type}</Badge>
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
                                        <span className="font-semibold">{normalizeName(segment.presenter)}</span>
                                      </div>
                                    )}

                                    {segment.room_id && (
                                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <MapPin className="w-4 h-4" />
                                        <span>{getRoomName(segment.room_id)}</span>
                                      </div>
                                    )}

                                    {(segment.scripture_references || segment.parsed_verse_data) && (
                                      <div className="flex items-start gap-2">
                                        {segment.scripture_references && (
                                          <p className="text-xs text-gray-600 mb-1 flex-1">📖 {segment.scripture_references}</p>
                                        )}
                                        {!segment.scripture_references && <div className="flex-1"></div>}
                                        {segment.parsed_verse_data && (
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                              setVersesModalData({
                                                parsedData: segment.parsed_verse_data,
                                                rawText: segment.scripture_references
                                              });
                                              setVersesModalOpen(true);
                                            }}
                                            className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                                            title="Ver Versículos"
                                          >
                                            <BookOpen className="w-3.5 h-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Prep Actions (show for Coordinador too) */}
                                {prepActions.length > 0 && (
                                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                                    <p className="font-bold text-gray-700 text-sm mb-2">⚠ PREPARACIÓN</p>
                                    <div className="space-y-1">
                                      {prepActions.map((action, idx) => {
                                        const showForCoord = viewMode === "simple" || action.department === "Coordinador" || action.department === "Admin";
                                        if (viewMode === "simple" && !showForCoord) return null;
                                        
                                        return (
                                          <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                                            <span className="font-bold">[{action.department}]</span> {action.label}
                                            {action.offset_min !== undefined && (
                                              <span className="italic ml-1">({action.offset_min}m antes)</span>
                                            )}
                                            {action.notes && <span className="ml-1">— {action.notes}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* During Actions (show for Coordinador too) */}
                                {duringActions.length > 0 && (
                                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                                    <p className="font-bold text-gray-700 text-sm mb-2">▶ DURANTE SEGMENTO</p>
                                    <div className="space-y-1">
                                      {duringActions.map((action, idx) => {
                                        const showForCoord = viewMode === "simple" || action.department === "Coordinador" || action.department === "Admin";
                                        if (viewMode === "simple" && !showForCoord) return null;
                                        
                                        return (
                                          <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                                            <span className="font-bold">[{action.department}]</span> {action.label}
                                            {action.notes && <span className="ml-1">— {action.notes}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Team Notes */}
                                <div className="grid md:grid-cols-2 gap-2">
                                  {segment.projection_notes && (
                                    <div className="border-l-4 border-blue-500 pl-3 py-1 text-xs">
                                      <span className="font-bold text-blue-800">PROYECCIÓN:</span>
                                      <p className="mt-1 text-blue-900">{segment.projection_notes}</p>
                                    </div>
                                  )}
                                  {segment.sound_notes && (
                                    <div className="border-l-4 border-red-500 pl-3 py-1 text-xs">
                                      <span className="font-bold text-red-800">SONIDO:</span>
                                      <p className="mt-1 text-red-900">{segment.sound_notes}</p>
                                    </div>
                                  )}
                                  {segment.ushers_notes && (
                                    <div className="border-l-4 border-green-500 pl-3 py-1 text-xs">
                                      <span className="font-bold text-green-800">UJIERES:</span>
                                      <p className="mt-1 text-green-900">{segment.ushers_notes}</p>
                                    </div>
                                  )}
                                  {segment.translation_notes && (
                                    <div className="border-l-4 border-blue-500 pl-3 py-1 text-xs">
                                      <span className="font-bold text-blue-800">TRADUCCIÓN:</span>
                                      <p className="mt-1 text-blue-900">{segment.translation_notes}</p>
                                    </div>
                                  )}
                                  {segment.stage_decor_notes && (
                                    <div className="border-l-4 border-purple-500 pl-3 py-1 text-xs">
                                      <span className="font-bold text-purple-800">STAGE & DECOR:</span>
                                      <p className="mt-1 text-purple-900">{segment.stage_decor_notes}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Additional Details (collapsed by default in full mode) */}
                                {isExpanded && (
                                  <div className="border-t pt-3 space-y-2">
                                    {segment.segment_type === "Alabanza" && (
                                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                                        <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                                        <div className="space-y-1">
                                          {normalizeSongs(segment).map((song, idx) => (
                                            <div key={idx} className="flex items-center gap-1">
                                              <span>{idx + 1}. {song.title}</span>
                                              {song.lead && <span className="text-gray-600">({song.lead})</span>}
                                              {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                                            </div>
                                          ))}
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
                                      <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                        <p className="text-xs text-green-900 font-medium">
                                          <strong>📝 Notas:</strong> {segment.description_details}
                                        </p>
                                      </div>
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
                                  <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                                    <p className="text-sm text-green-900 font-medium">
                                      <strong>📝 Notas:</strong> {segment.description_details}
                                    </p>
                                  </div>
                                  )}

                                  {segment.segment_type === "Alabanza" && (
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                                  <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                                  <div className="space-y-1">
                                    {normalizeSongs(segment).map((song, idx) => (
                                      <div key={idx} className="flex items-center gap-1">
                                        <span>{idx + 1}. {song.title}</span>
                                        {song.lead && <span className="text-gray-600">({song.lead})</span>}
                                        {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                                      </div>
                                    ))}
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

      {/* Structured Verses Modal */}
      <StructuredVersesModal
        open={versesModalOpen}
        onOpenChange={setVersesModalOpen}
        parsedData={versesModalData.parsedData}
        rawText={versesModalData.rawText}
        language="es"
      />

      {/* Footer */}
      <div style={gradientStyle} className="mt-12 py-6">
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