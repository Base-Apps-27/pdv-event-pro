import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Users, Languages, Mic, ChevronDown, ChevronUp, Filter, List, ListChecks, BookOpen, BellRing, Sparkles, History } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTimeToEST, formatTimestampToEST, formatDateET } from "../components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import StructuredVersesModal from "@/components/service/StructuredVersesModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import PublicProgramSegment from "@/components/service/PublicProgramSegment";
import LiveStatusCard from "@/components/service/LiveStatusCard";
import LiveTimeAdjustmentModal from "@/components/service/LiveTimeAdjustmentModal";
import TimeAdjustmentHistoryModal from "@/components/service/TimeAdjustmentHistoryModal";

import { hasPermission } from "@/components/utils/permissions";
import { useSegmentNotifications } from "@/components/service/useSegmentNotifications";
import ServiceProgramView from "@/components/service/ServiceProgramView";
import EventProgramView from "@/components/service/EventProgramView";
import LiveOperationsChat from "@/components/live/LiveOperationsChat";
import { useLanguage } from "@/components/utils/i18n";
import LiveViewSkeleton from "@/components/service/LiveViewSkeleton";
import { buildChangeSummary, ChangeToastContent } from "@/components/live/LiveChangeToast";

export default function PublicProgramView() {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        // Not logged in
      }
    };
    fetchUser();
  }, []);
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };
  
  const urlParams = new URLSearchParams(window.location.search);
  const preloadedSlug = urlParams.get('slug');
  const preloadedEventId = urlParams.get('eventId') || "";
  const preloadedServiceId = urlParams.get('serviceId') || "";
  const preloadedDate = urlParams.get('date') || "";
  
  // Top-level state for view type selection and entity selection
  const [viewType, setViewType] = useState(preloadedServiceId || preloadedDate ? "service" : "event");
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedServiceId, setSelectedServiceId] = useState(preloadedServiceId);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [viewMode, setViewMode] = useState("simple");
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  
  // Shared state for both views
  const [currentTime, setCurrentTime] = useState(new Date());
  const [versesModalOpen, setVersesModalOpen] = useState(false);
  const [versesModalData, setVersesModalData] = useState({ parsedData: null, rawText: "" });
  // Admin verse parser state (Live-only for event Plenarias)
  const [verseParserOpen, setVerseParserOpen] = useState(false);
  const [verseParserInitial, setVerseParserInitial] = useState("");
  const [verseParserSegment, setVerseParserSegment] = useState(null);
  const [expandedSegments, setExpandedSegments] = useState({}); // Still needed for verse modal callback compatibility
  const [timeAdjustmentModalOpen, setTimeAdjustmentModalOpen] = useState(false);
  const [adjustmentModalTimeSlot, setAdjustmentModalTimeSlot] = useState(null);
  const [currentAdjustment, setCurrentAdjustment] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  
  // Chat state lifted for integration with StickyOpsDeck
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

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
      const [confirmed, inProgress] = await Promise.all([
        base44.entities.Event.filter({ status: 'confirmed' }, '-start_date'),
        base44.entities.Event.filter({ status: 'in_progress' }, '-start_date'),
      ]);
      const map = new Map();
      [...confirmed, ...inProgress].forEach(e => map.set(e.id, e));
      return Array.from(map.values()).sort((a, b) => {
        const dateA = a.start_date || '';
        const dateB = b.start_date || '';
        return dateB.localeCompare(dateA);
      });
    },
    refetchInterval: 15000,
  });

  // Fetch services (only WeeklyServiceManager date-specific instances)
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const allServices = await base44.entities.Service.filter({ status: 'active' }, '-date');
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
    refetchInterval: 15000,
  });

  // Fetch sessions for selected event OR service
  const { data: sessions = [], refetch: refetchSessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['sessions', selectedEventId, selectedServiceId, viewType],
    queryFn: async () => {
      if (viewType === "event" && selectedEventId) {
        const { data } = await base44.functions.invoke('getSortedSessions', { eventId: selectedEventId });
        return data.sessions || [];
      } else if (viewType === "service" && selectedServiceId) {
        const { data } = await base44.functions.invoke('getSortedSessions', { serviceId: selectedServiceId });
        return data.sessions || [];
      }
      return [];
    },
    enabled: !!(selectedEventId || selectedServiceId),
    refetchInterval: 15000,
  });

  // Fetch PreSessionDetails for the active sessions (Events Only)
  const { data: preSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails', sessions.map(s => s.id).join(',')],
    queryFn: async () => {
      if (viewType !== "event" || sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      return await base44.entities.PreSessionDetails.filter({ 
        session_id: { '$in': sessionIds } 
      });
    },
    enabled: viewType === "event" && sessions.length > 0,
    refetchInterval: 60000
  });

  // Fetch segments for selected sessions (fetch all, child components filter)
  const { data: allSegments = [], refetch: refetchSegments, isLoading: isLoadingSegments } = useQuery({
    queryKey: ['segments', selectedEventId, selectedServiceId, viewType],
    queryFn: async () => {
      const sessionIds = sessions.map(s => s.id);
      
      if (sessionIds.length === 0) return [];
      
      const response = await base44.functions.invoke('getSegmentsBySessionIds', { sessionIds });
      return response.data?.segments?.filter(seg => seg.show_in_general !== false) || [];
    },
    enabled: !!(selectedEventId || selectedServiceId) && sessions.length > 0,
    refetchInterval: 15000,
  });

  const refetchData = () => {
    refetchSessions();
    refetchSegments();
  };

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
    refetchInterval: 60000,
  });

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const rawServiceData = weeklyServiceData?.[0] || null;

  // REAL-TIME SUBSCRIPTIONS: Instant updates when admin edits program data
  // Placed AFTER rawServiceData / selectedEvent are derived so closures can read them safely.
  useEffect(() => {
    const unsubscribers = [];

    const isActiveDay = () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      if (viewType === 'service' && rawServiceData?.date) {
        return rawServiceData.date === todayStr;
      }
      if (viewType === 'event' && selectedEvent) {
        const start = selectedEvent.start_date || '';
        const end = selectedEvent.end_date || start;
        return todayStr >= start && todayStr <= end;
      }
      return false;
    };

    const notify = (entityType, event) => {
      if (isActiveDay()) {
        const { title, details, icon } = buildChangeSummary(entityType, event, language);
        toast(title, {
          duration: 5000,
          icon,
          description: details.length > 0 ? <ChangeToastContent details={details} /> : undefined,
        });
      }
    };

    unsubscribers.push(
      base44.entities.Segment.subscribe((event) => {
        queryClient.invalidateQueries({ queryKey: ['segments'] });
        notify('Segment', event);
      })
    );

    unsubscribers.push(
      base44.entities.Session.subscribe((event) => {
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
        notify('Session', event);
      })
    );

    if (viewType === 'service' && selectedServiceId) {
      unsubscribers.push(
        base44.entities.Service.subscribe((event) => {
          queryClient.invalidateQueries({ queryKey: ['weeklyServiceData'] });
          queryClient.invalidateQueries({ queryKey: ['services'] });
          notify('Service', event);
        })
      );
    }

    if (viewType === 'event' && selectedEventId) {
      unsubscribers.push(
        base44.entities.Event.subscribe((event) => {
          queryClient.invalidateQueries({ queryKey: ['publicEvents'] });
          notify('Event', event);
        })
      );
    }

    if (viewType === 'event') {
      unsubscribers.push(
        base44.entities.PreSessionDetails.subscribe((event) => {
          queryClient.invalidateQueries({ queryKey: ['preSessionDetails'] });
          notify('PreSessionDetails', event);
        })
      );
    }

    unsubscribers.push(
      base44.entities.SegmentAction.subscribe((event) => {
        queryClient.invalidateQueries({ queryKey: ['segments'] });
        notify('SegmentAction', event);
      })
    );

    return () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [viewType, selectedServiceId, selectedEventId, rawServiceData?.date, selectedEvent?.start_date, selectedEvent?.end_date, language, queryClient]);

  // Fetch live time adjustment for weekly services
  const { data: liveAdjustments = [] } = useQuery({
    queryKey: ['liveAdjustments', selectedServiceId, rawServiceData?.date],
    queryFn: async () => {
      if (!selectedServiceId || !rawServiceData?.date) return [];
      return await base44.entities.LiveTimeAdjustment.filter({ 
        date: rawServiceData.date, 
        service_id: selectedServiceId 
      });
    },
    enabled: viewType === "service" && !!selectedServiceId && !!rawServiceData?.date,
    refetchInterval: 3000,
  });

  // Fetch immutable adjustment history logs
  const { data: adjustmentLogs = [] } = useQuery({
    queryKey: ['adjustmentLogs', selectedServiceId, rawServiceData?.date],
    queryFn: async () => {
      if (!selectedServiceId || !rawServiceData?.date) return [];
      return await base44.entities.TimeAdjustmentLog.filter({ 
        date: rawServiceData.date, 
        service_id: selectedServiceId 
      }, '-created_date');
    },
    enabled: viewType === "service" && !!selectedServiceId && !!rawServiceData?.date,
    refetchInterval: 5000,
  });

  // Subscribe to live adjustments for real-time updates
  useEffect(() => {
    if (viewType !== "service" || !selectedServiceId || !rawServiceData?.date) return;

    const unsubscribe = base44.entities.LiveTimeAdjustment.subscribe((event) => {
      if (event.data.date === rawServiceData.date && event.data.service_id === selectedServiceId) {
        // Refetch to get updated data
        queryClient.invalidateQueries(['liveAdjustments', selectedServiceId, rawServiceData.date]);
      }
    });

    return unsubscribe;
  }, [viewType, selectedServiceId, rawServiceData?.date]);

  // Save time adjustment
  const handleSaveTimeAdjustment = async (offsetMinutes, authorizedBy) => {
    if (!selectedServiceId || !rawServiceData?.date || !adjustmentModalTimeSlot) return;

    try {
      // Determine adjustment type: custom services use 'global', weekly use 'time_slot'
      const isCustomService = adjustmentModalTimeSlot === "custom";
      const adjustmentType = isCustomService ? "global" : "time_slot";
      
      // Check if adjustment exists
      const existing = liveAdjustments.find(a => 
        isCustomService ? a.adjustment_type === 'global' : a.time_slot === adjustmentModalTimeSlot
      );
      
      const previousOffset = existing?.offset_minutes || 0;
      const action = offsetMinutes === 0 ? 'clear' : (existing ? 'update' : 'set');
      
      // Always log to immutable history first
      await base44.entities.TimeAdjustmentLog.create({
        date: rawServiceData.date,
        service_id: selectedServiceId,
        time_slot: isCustomService ? 'custom' : adjustmentModalTimeSlot,
        previous_offset: previousOffset,
        new_offset: offsetMinutes,
        authorized_by: authorizedBy,
        performed_by_name: currentUser?.full_name || '',
        performed_by_email: currentUser?.email || '',
        action: action
      });
      
      if (existing) {
        // Update existing LiveTimeAdjustment
        await base44.entities.LiveTimeAdjustment.update(existing.id, {
          offset_minutes: offsetMinutes,
          authorized_by: authorizedBy,
          updated_at: new Date().toISOString()
        });
      } else {
        // Create new LiveTimeAdjustment
        await base44.entities.LiveTimeAdjustment.create({
          date: rawServiceData.date,
          adjustment_type: adjustmentType,
          service_id: selectedServiceId,
          time_slot: isCustomService ? null : adjustmentModalTimeSlot,
          offset_minutes: offsetMinutes,
          authorized_by: authorizedBy
        });
      }

      toast.success(t('adjustments.saveSuccess'));
    } catch (err) {
      console.error(err);
      toast.error(t('adjustments.saveError'));
      throw err;
    }
  };

  // Open adjustment modal
  const openAdjustmentModal = (timeSlot) => {
    // For custom services, find global adjustment; for weekly, find by time_slot
    const existing = timeSlot === "custom" 
      ? liveAdjustments.find(a => a.adjustment_type === 'global')
      : liveAdjustments.find(a => a.time_slot === timeSlot);
    setCurrentAdjustment(existing || null);
    setAdjustmentModalTimeSlot(timeSlot);
    setTimeAdjustmentModalOpen(true);
  };
  
  // Calculate start times for weekly service segments (which usually lack them)
  const actualServiceData = React.useMemo(() => {
    if (!rawServiceData) return null;
    
    // Only process if it's a weekly service structure (has 9:30am/11:30am arrays)
    // Custom services usually have 'segments' with explicit times, but we can process those too if needed
    
    const calculateTimedSegments = (segments, startStr) => {
      if (!segments || !Array.isArray(segments)) return [];
      
      let currentH = 0;
      let currentM = 0;

      if (startStr) {
        currentH = parseInt(startStr.split(':')[0]);
        currentM = parseInt(startStr.split(':')[1]);
      }
      
      return segments.map(seg => {
        // If already has time, use it to update current pointer
        if (seg.start_time) {
          const [h, m] = seg.start_time.split(':').map(Number);
          currentH = h;
          currentM = m;
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
        
        // Use calculated time if not present, but prefer existing if valid
        return {
          ...seg,
          start_time: seg.start_time || startTime,
          end_time: seg.end_time || endTime
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
    // Calculate times for Custom Services (segments array)
    if (newData.segments && newData.segments.length > 0) {
      // Use service time as start, default to 10:00 if missing
      const serviceTime = newData.time || "10:00"; 
      newData.segments = calculateTimedSegments(newData.segments, serviceTime);
    }
    
    return newData;
  }, [rawServiceData]);

  const eventSessions = sessions;
  const filteredSessions = eventSessions;

  // Derive current active session for notifications context
  const activeSession = viewType === "event" ? filteredSessions[0] : null; // Simplified for now
  
  // Prepare segments list for notifications
  const segmentsForNotifications = React.useMemo(() => {
    let list = [];
    if (viewType === "service" && actualServiceData) {
      if (actualServiceData.segments) {
        list = actualServiceData.segments;
      } else {
        const morning = (actualServiceData["9:30am"] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        const afternoon = (actualServiceData["11:30am"] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        list = [...morning, ...afternoon];
      }
    } else if (viewType === "event") {
      list = allSegments;
    }
    return list;
  }, [viewType, actualServiceData, allSegments]);

  // Use the robust notification hook
  useSegmentNotifications(segmentsForNotifications, activeSession);

  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  const isSegmentCurrent = (segment) => {
    if (!segment?.start_time || !segment?.end_time) return false;
    if (typeof segment.start_time !== 'string' || typeof segment.end_time !== 'string') return false;
    
    const now = currentTime;
    
    // Check if the service date is today
    if (viewType === 'service' && actualServiceData?.date) {
      const serviceDate = getLocalDateAtMidnight(actualServiceData.date);
      const today = new Date(now);
      today.setHours(0,0,0,0);
      
      if (serviceDate.getTime() !== today.getTime()) {
        return false;
      }
    }
    
    // Check if the event session date is today
    if (viewType === 'event' && sessions.length > 0) {
      const firstSession = sessions[0];
      if (firstSession?.date) {
        const sessionDate = getLocalDateAtMidnight(firstSession.date);
        const today = new Date(now);
        today.setHours(0,0,0,0);
        
        if (sessionDate.getTime() !== today.getTime()) {
          return false;
        }
      }
    }

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
    // Date check for service
    if (viewType === 'service' && actualServiceData?.date) {
      const serviceDate = getLocalDateAtMidnight(actualServiceData.date);
      const today = new Date(currentTime);
      today.setHours(0,0,0,0);
      if (serviceDate.getTime() !== today.getTime()) return false;
    }
    
    // Date check for event
    if (viewType === 'event' && sessions.length > 0) {
      const firstSession = sessions[0];
      if (firstSession?.date) {
        const sessionDate = getLocalDateAtMidnight(firstSession.date);
        const today = new Date(currentTime);
        today.setHours(0,0,0,0);
        if (sessionDate.getTime() !== today.getTime()) return false;
      }
    }

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

  // Helper functions shared across views
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

  const getSegmentDomId = (segment) => {
    // Generate a unique-ish ID for the DOM element
    // Handle both root-level and data-level properties to ensure consistency between raw and normalized objects
    const title = segment.title || segment.data?.title || 'Untitled';
    const startTime = segment.start_time || segment.data?.start_time || '00:00';
    
    // Fallback to title+time for legacy segments without IDs
    const baseId = segment.id || `${title}-${startTime}`;
    // Sanitize for valid HTML ID
    return `segment-${baseId}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
  };

  const scrollToSegment = (segment) => {
    if (!segment) return;
    const id = getSegmentDomId(segment);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary visual highlight
      element.classList.add('ring-4', 'ring-pdv-teal', 'ring-offset-2', 'transition-all', 'duration-500');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-pdv-teal', 'ring-offset-2');
      }, 2500);
    } else {
        console.warn('Scroll target not found:', id);
    }
  };

  // Show skeleton loading state when primary data is loading
  const isContentLoading = (selectedEventId || selectedServiceId) && (isLoadingSessions || isLoadingSegments);

  if (isContentLoading) {
    return <LiveViewSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Compact Navigation Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* View Type Toggle (Segmented Control style) */}
          <div className="bg-gray-200 p-1 rounded-xl flex shrink-0 shadow-inner">
            <button
              onClick={() => setViewType("event")}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewType === "event" ? "bg-white text-pdv-teal shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t('public.events')}
            </button>
            <button
              onClick={() => setViewType("service")}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewType === "service" ? "bg-white text-pdv-green shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t('public.services')}
            </button>
          </div>

          {/* Context Selector */}
          <div className="flex-1 w-full">
              {viewType === "event" && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const ninetyDaysOut = new Date(today);
                ninetyDaysOut.setDate(today.getDate() + 90);
                
                // Last 1 past event (most recent), leveraging publicEvents pre-sort (desc by start_date)
                const pastEvents = publicEvents.filter(e => {
                  if (!e.start_date) return false;
                  const eventDate = new Date(e.start_date);
                  return eventDate < today;
                }).slice(0, 1);
                
                // All future events within next 90 days
                const upcomingEvents = publicEvents
                  .filter(e => {
                    if (!e.start_date) return false;
                    const eventDate = new Date(e.start_date);
                    return eventDate >= today && eventDate <= ninetyDaysOut;
                  })
                  // Sort ascending by date for better UX (soonest first)
                  .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                
                const availableEvents = [...pastEvents, ...upcomingEvents];
                
                return (
                  <div className="w-full max-w-full">
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-2 border-gray-400 text-gray-900 h-12">
                        <SelectValue placeholder={t('public.selectEvent')} />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-w-[calc(100vw-2rem)]">
                        {availableEvents.map((event) => (
                                                        <SelectItem key={event.id} value={event.id}>
                                                          {event.name.length > 25 ? event.name.substring(0, 25) + '...' : event.name} - {formatDateET(event.start_date)}
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
                  <div className="w-full max-w-full">
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-2 border-gray-400 text-gray-900 h-12">
                        <SelectValue placeholder={t('public.selectService')} />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-w-[calc(100vw-2rem)]">
                        {upcomingServices.map((service) => (
                                                    <SelectItem key={service.id} value={service.id}>
                                                      {service.name.length > 25 ? service.name.substring(0, 25) + '...' : service.name} - {formatDateET(service.date)} ({service.daysUntil === 0 ? t('public.today') : service.daysUntil === 1 ? t('public.tomorrow') : `${t('public.in')} ${service.daysUntil} ${service.daysUntil === 1 ? t('public.day') : t('public.days')}`})
                                                    </SelectItem>
                                                  ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
          </div>
        </div>

        {((selectedEventId && selectedEvent) || (selectedServiceId && selectedService)) && (
          <>
            {/* Minimal Event/Service Info Banner */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase font-bold tracking-wider">
                <Calendar className="w-3 h-3" />
                <span>
                  {viewType === "event" && selectedEvent?.start_date ? formatDateET(selectedEvent.start_date) : 
                   viewType === "service" && selectedService?.date ? formatDateET(selectedService.date) : ""}
                </span>
                {viewType === "event" && selectedEvent?.location && (
                  <>
                    <span>•</span>
                    <span className="truncate">{selectedEvent.location}</span>
                  </>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {viewType === "event" ? selectedEvent?.name : selectedService?.name}
              </h2>
              {viewType === "event" && selectedEvent?.theme && (
                <p className="text-pdv-teal font-medium italic">"{selectedEvent.theme}"</p>
              )}
            </div>

            {/* Live Admin Controls moved to EventProgramView - LiveDirectorPanel */}

            {/* View Mode and Filters Card - EventProgramView handles this now */}
            {false && viewType === "event" && (
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

            {/* Live Time Adjustment Banner */}
            {viewType === "service" && liveAdjustments.length > 0 && liveAdjustments.some(adj => adj.offset_minutes !== 0) && (
              <Card className="bg-amber-50 border-2 border-amber-500">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {liveAdjustments.filter(adj => adj.offset_minutes !== 0).map((adj) => {
                      // Calculate adjusted start time for display
                      let displayLabel = '';
                      let adjustedTimeStr = '';
                      
                      if (adj.adjustment_type === 'global') {
                        // Custom service - show service time + offset
                        const serviceTime = actualServiceData?.time || "10:00";
                        const [h, m] = serviceTime.split(':').map(Number);
                        const adjustedDate = new Date();
                        adjustedDate.setHours(h, m + adj.offset_minutes, 0, 0);
                        const timeStr = `${String(adjustedDate.getHours()).padStart(2, '0')}:${String(adjustedDate.getMinutes()).padStart(2, '0')}`;
                        adjustedTimeStr = formatTimeToEST(timeStr);
                        displayLabel = t('service.specialService');
                      } else {
                        // Weekly service - show time slot
                        const baseTime = adj.time_slot.replace('am', '').replace('pm', '');
                        const [h, m] = baseTime.split(':').map(Number);
                        const adjustedDate = new Date();
                        adjustedDate.setHours(h, m + adj.offset_minutes, 0, 0);
                        const timeStr = `${String(adjustedDate.getHours()).padStart(2, '0')}:${String(adjustedDate.getMinutes()).padStart(2, '0')}`;
                        adjustedTimeStr = formatTimeToEST(timeStr);
                        displayLabel = adj.time_slot;
                      }
                      
                      // Convert adjustment timestamp to EST HH:MM:SS
                       const estTime = formatTimestampToEST(adj.updated_date);
                      
                      return (
                        <div key={adj.id} className="flex items-start justify-between gap-4 bg-white p-3 rounded border border-amber-300">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-amber-700" />
                              <span className="font-bold text-amber-900">
                                {displayLabel} {t('public.adjusted')} {adj.offset_minutes > 0 ? '+' : ''}{adj.offset_minutes} {t('public.minutes')} ({t('public.start')}: {adjustedTimeStr})
                              </span>
                            </div>
                            <div className="text-xs text-gray-700 space-y-0.5">
                              <div><strong>{t('adjustments.authorizedBy')}:</strong> {adj.authorized_by}</div>
                              <div><strong>{t('adjustments.appliedBy')}:</strong> {adj.created_by}</div>
                              <div><strong>{t('adjustments.time')}:</strong> {estTime}</div>
                            </div>
                          </div>
                          {hasPermission(currentUser, 'manage_live_timing') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openAdjustmentModal(adj.adjustment_type === 'global' ? 'custom' : adj.time_slot)}
                              className="shrink-0"
                            >
                              Editar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Time Adjustment Controls for Coordinators - Only for Services */}
            {viewType === "service" && (hasPermission(currentUser, 'manage_live_timing') || hasPermission(currentUser, 'adjust_service_timing')) && actualServiceData && (
              <Card className="bg-slate-900 text-white border-none">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                      <span className="font-bold uppercase text-xs sm:text-sm">Ajustar Hora de Inicio</span>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                      {/* Custom services: show single button regardless of 9:30am/11:30am data */}
                      {actualServiceData.segments && actualServiceData.segments.length > 0 ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openAdjustmentModal("custom")}
                          className="bg-pdv-teal hover:bg-pdv-teal/90 text-white border-none text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          {t('adjustments.adjustStart')}
                        </Button>
                      ) : (
                        <>
                          {actualServiceData["9:30am"] && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAdjustmentModal("9:30am")}
                              className="bg-red-600 hover:bg-red-700 text-white border-none text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                            >
                              {t('adjustments.timeSlot930am')}
                            </Button>
                          )}
                          {actualServiceData["11:30am"] && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAdjustmentModal("11:30am")}
                              className="bg-blue-600 hover:bg-blue-700 text-white border-none text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                            >
                              {t('adjustments.timeSlot1130am')}
                            </Button>
                          )}
                        </>
                      )}
                      {/* History button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryModalOpen(true)}
                        className="text-gray-400 hover:text-white hover:bg-white/10 px-2"
                        title="Ver historial de ajustes"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Service Program View (Weekly and Custom Services) */}
            {viewType === "service" && actualServiceData && (
              <ServiceProgramView
                actualServiceData={actualServiceData}
                liveAdjustments={liveAdjustments}
                currentTime={currentTime}
                isSegmentCurrent={isSegmentCurrent}
                isSegmentUpcoming={isSegmentUpcoming}
                toggleSegmentExpanded={toggleSegmentExpanded}
                onOpenVerses={(data) => {
                  setVersesModalData({
                    parsedData: data.parsedData,
                    rawText: data.rawText
                  });
                  setVersesModalOpen(true);
                }}
                scrollToSegment={scrollToSegment}
                // PERMISSION-GATED: Only pass chat props if user has view_live_chat permission
                onToggleChat={hasPermission(currentUser, 'view_live_chat') ? () => setChatOpen(!chatOpen) : undefined}
                chatUnreadCount={hasPermission(currentUser, 'view_live_chat') ? chatUnreadCount : 0}
                chatOpen={hasPermission(currentUser, 'view_live_chat') ? chatOpen : false}
                // PERMISSION-GATED: Hide StickyOpsDeck for users without view_live_chat
                hideOpsDeck={!hasPermission(currentUser, 'view_live_chat')}
              />
            )}

            {/* Event Program View */}
            {viewType === "event" && selectedEvent && (
              <EventProgramView
                               selectedEvent={selectedEvent}
                               eventSessions={eventSessions}
                               allSegments={allSegments}
                               preSessionDetails={preSessionDetails}
                               currentUser={currentUser}
                               currentTime={currentTime}
                               isSegmentCurrent={isSegmentCurrent}
                               isSegmentUpcoming={isSegmentUpcoming}
                               onOpenVerses={(data) => {
                                 setVersesModalData({
                                   parsedData: data.parsedData,
                                   rawText: data.rawText
                                 });
                                 setVersesModalOpen(true);
                               }}
                               scrollToSegment={scrollToSegment}
                               refetchData={refetchData}
                               getRoomName={getRoomName}
                               onOpenVerseParser={({ segment, initialText }) => {
                                 setVerseParserSegment(segment);
                                 setVerseParserInitial(initialText || "");
                                 setVerseParserOpen(true);
                               }}
                               // PERMISSION-GATED: Only pass chat props if user has view_live_chat permission
                               onToggleChat={hasPermission(currentUser, 'view_live_chat') ? () => setChatOpen(!chatOpen) : undefined}
                               chatUnreadCount={hasPermission(currentUser, 'view_live_chat') ? chatUnreadCount : 0}
                               chatOpen={hasPermission(currentUser, 'view_live_chat') ? chatOpen : false}
                               />
            )}

            {/* Legacy rendering - Remove after confirming above works */}
            {false && viewType === "service" && actualServiceData && (
              // Check for CustomServiceBuilder format (segments array)
              (actualServiceData.segments && actualServiceData.segments.length > 0) ? (
              <div className="space-y-6">
                {/* Live Status Card for Custom Services */}
                <LiveStatusCard 
                  segments={actualServiceData.segments || []} 
                  currentTime={currentTime}
                  onScrollTo={scrollToSegment}
                />

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
                       {actualServiceData.fotografia && Object.values(actualServiceData.fotografia).find(v => v) && (
                         <>
                           <span className="text-gray-400">|</span>
                           <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["9:30am"] || actualServiceData.fotografia["11:30am"] || Object.values(actualServiceData.fotografia).find(v => v))}</span>
                         </>
                       )}
                     </div>
                   )}
                 </div>
                  <div className="divide-y divide-gray-200">
                    {actualServiceData.segments.filter(seg => seg.type !== 'break').map((segment, idx) => (
                      <PublicProgramSegment
                        key={segment.id || idx}
                        segment={segment}
                        isCurrent={isSegmentCurrent(segment)}
                        isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData.segments)}
                        viewMode="simple"
                        isExpanded={true} // Always expanded
                        alwaysExpanded={true} // Hide toggle
                        onToggleExpand={toggleSegmentExpanded}
                        onOpenVerses={(data) => {
                          setVersesModalData({
                            parsedData: data.parsedData,
                            rawText: data.rawText
                          });
                          setVersesModalOpen(true);
                        }}
                        allSegments={actualServiceData.segments}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (actualServiceData["9:30am"] && actualServiceData["9:30am"].length > 0) || 
              (actualServiceData["11:30am"] && actualServiceData["11:30am"].length > 0) ? (
              <div className="space-y-6">
                {/* Live Status Card for Weekly Services */}
                {(() => {
                  const allServiceSegments = [
                    ...(actualServiceData?.['9:30am'] || []),
                    ...(actualServiceData?.['11:30am'] || [])
                  ].map(s => ({
                    ...s,
                    start_time: s.start_time || s.data?.start_time,
                    end_time: s.end_time || s.data?.end_time, // Ensure end_time is passed
                    title: s.title || s.data?.title || 'Untitled'
                  }));

                  return (
                    <LiveStatusCard 
                      segments={allServiceSegments} 
                      currentTime={currentTime}
                      onScrollTo={scrollToSegment}
                      serviceDate={actualServiceData?.date}
                    />
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
                          {actualServiceData.fotografia?.["9:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["9:30am"])}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                    {actualServiceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                      <PublicProgramSegment
                        key={segment.id || idx}
                        segment={segment}
                        isCurrent={isSegmentCurrent(segment)}
                        isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData["9:30am"])}
                        viewMode="simple"
                        isExpanded={true}
                        alwaysExpanded={true}
                        onToggleExpand={toggleSegmentExpanded}
                        onOpenVerses={(data) => {
                          setVersesModalData({
                            parsedData: data.parsedData,
                            rawText: data.rawText
                          });
                          setVersesModalOpen(true);
                        }}
                        allSegments={actualServiceData["9:30am"]}
                      />
                    ))}
                    </div>
                  </div>
                )}

                {/* Receso */}
                <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
                  <p className="font-bold text-gray-600">{t('public.break')} (30 min)</p>
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
                          {actualServiceData.fotografia?.["11:30am"] && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["11:30am"])}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200">
                      {actualServiceData["11:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
                        <PublicProgramSegment
                          key={segment.id || idx}
                          segment={segment}
                          isCurrent={isSegmentCurrent(segment)}
                          isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData["11:30am"])}
                          viewMode="simple"
                          isExpanded={true}
                          alwaysExpanded={true}
                          onToggleExpand={toggleSegmentExpanded}
                          onOpenVerses={(data) => {
                            setVersesModalData({
                              parsedData: data.parsedData,
                              rawText: data.rawText
                            });
                            setVersesModalOpen(true);
                          }}
                          allSegments={actualServiceData["11:30am"]}
                        />
                      ))}
                              </div>
                              </div>
                              )}
                              </div>
                              ) : (
                              <Card className="p-12 text-center bg-white border-2 border-gray-300">
                                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">{t('public.noProgramYet')}</p>
                              </Card>
                              )
                              )}

            {/* Legacy Event Display - Remove after confirming EventProgramView works */}
            {false && viewType === "event" && (
            <div className="space-y-6">
              {/* Live Status Card for Events */}
              <LiveStatusCard 
                segments={allSegments} 
                currentTime={currentTime}
                onScrollTo={scrollToSegment}
                liveAdjustmentEnabled={filteredSessions[0]?.live_adjustment_enabled}
              />

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
                              {actualServiceData.fotografia && (
                                <>
                                  <span className="text-gray-400">|</span>
                                  <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["9:30am"] || actualServiceData.fotografia["11:30am"] || Object.values(actualServiceData.fotografia).find(v => v))}</span>
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

                        return (
                        <PublicProgramSegment
                          key={segment.id}
                          segment={segment}
                          isCurrent={isSegmentCurrent(segment)}
                          isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, allSegments)}
                          viewMode={viewMode}
                          isExpanded={expandedSegments[segment.id]}
                          onToggleExpand={toggleSegmentExpanded}
                          onOpenVerses={(data) => {
                            setVersesModalData({
                              parsedData: data.parsedData,
                              rawText: data.rawText
                            });
                            setVersesModalOpen(true);
                          }}
                          allSegments={allSegments}
                        />
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
                <p className="text-gray-600">{t('public.noSessions')}</p>
              </Card>
            )}
          </>
        )}

        {!selectedEventId && !selectedServiceId && (
          <Card className="p-12 text-center bg-white border-dashed border-2 border-gray-400">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{viewType === 'event' ? t('public.selectPromptEvent') : t('public.selectPromptService')}</p>
          </Card>
        )}
      </div>

      {/* Structured Verses Modal */}
      <StructuredVersesModal
        open={versesModalOpen}
        onOpenChange={setVersesModalOpen}
        parsedData={versesModalData.parsedData}
        rawText={versesModalData.rawText}
        language={language}
      />

      {/* Verse Parser Dialog (Admin only) */}
      <VerseParserDialog
        open={verseParserOpen}
        onOpenChange={setVerseParserOpen}
        initialText={verseParserInitial}
        onSave={async ({ parsed_data, verse }) => {
          if (!verseParserSegment) return;
          await base44.entities.Segment.update(verseParserSegment.id, {
            scripture_references: verse,
            parsed_verse_data: parsed_data
          });
          setVersesModalData({ parsedData: parsed_data, rawText: verse });
          setVersesModalOpen(true);
          refetchSegments();
        }}
        language={language}
      />

      {/* Live Time Adjustment Modal */}
      <LiveTimeAdjustmentModal
        isOpen={timeAdjustmentModalOpen}
        onClose={() => {
          setTimeAdjustmentModalOpen(false);
          setAdjustmentModalTimeSlot(null);
          setCurrentAdjustment(null);
        }}
        timeSlot={adjustmentModalTimeSlot}
        currentOffset={currentAdjustment?.offset_minutes || 0}
        onSave={handleSaveTimeAdjustment}
        serviceTime={actualServiceData?.time}
      />

      {/* Time Adjustment History Modal */}
      <TimeAdjustmentHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        logs={adjustmentLogs}
        selectedDate={rawServiceData?.date ? formatDateET(rawServiceData.date) : ''}
      />

      {/* Live Operations Chat - Floating FAB or Integrated */}
      {/* CRITICAL: Only render chat for users with explicit view_live_chat permission */}
      {currentUser && hasPermission(currentUser, 'view_live_chat') && (viewType === "event" ? selectedEvent : selectedService) && (
        <LiveOperationsChat
          currentUser={currentUser}
          contextType={viewType}
          contextId={viewType === "event" ? selectedEventId : selectedServiceId}
          contextDate={viewType === "event" ? selectedEvent?.end_date : rawServiceData?.date}
          contextName={viewType === "event" ? selectedEvent?.name : selectedService?.name}
          // Controlled props
          isOpen={chatOpen}
          onToggle={setChatOpen}
          onUnreadCountChange={setChatUnreadCount}
          // Hide trigger button always, as StickyOpsDeck is present in both Service and Event views
          hideTrigger={true}
        />
      )}

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