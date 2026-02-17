import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useActiveProgramCache from "@/components/myprogram/useActiveProgramCache";
import { Calendar, Clock, History, Tv } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTimeToEST, formatTimestampToEST, formatDateET } from "../components/utils/timeFormat";
import StructuredVersesModal from "@/components/service/StructuredVersesModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import LiveTimeAdjustmentModal from "@/components/service/LiveTimeAdjustmentModal";
import TimeAdjustmentHistoryModal from "@/components/service/TimeAdjustmentHistoryModal";
import { hasPermission } from "@/components/utils/permissions";
import { useSegmentNotifications } from "@/components/service/useSegmentNotifications";
import ServiceProgramView from "@/components/service/ServiceProgramView";
import EventProgramView from "@/components/service/EventProgramView";
import LiveOperationsChat from "@/components/live/LiveOperationsChat";
import { useLanguage } from "@/components/utils/i18n";
import LiveViewSkeleton from "@/components/service/LiveViewSkeleton";

export default function PublicProgramView() {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // AUTH GATE (2026-02-14): This page now requires authentication.
  // Layout enforces the redirect, but we also guard here for defense-in-depth.
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        if (authenticated) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        } else {
          // Not authenticated — redirect to login
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
      } catch (e) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setAuthChecked(true);
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
  const viewParam = urlParams.get('view'); // 'livestream'
  const isStreamMode = viewParam === 'livestream';
  
  // Top-level state for view type selection and entity selection
  const [viewType, setViewType] = useState(preloadedServiceId || preloadedDate ? "service" : "event");
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedServiceId, setSelectedServiceId] = useState(preloadedServiceId);
  // CLEANUP (2026-02-10): showEventDetails, viewMode, selectedSessionId removed — only used in deleted legacy blocks
  
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

  // ── CACHE-FIRST: Read from ActiveProgramCache (instant, no backend call) ──
  // This provides the auto-detected program, selector options, and full snapshot.
  const {
    contextType: cacheContextType,
    contextId: cacheContextId,
    programData: cacheProgramData,
    selectorOptions: cacheSelectorOptions,
    isLoading: isCacheLoading,
  } = useActiveProgramCache();

  // Selector options always come from cache (wider window: 90d events, 7d services)
  const publicEvents = cacheSelectorOptions?.events || [];
  const services = cacheSelectorOptions?.services || [];

  // Auto-set state from cache's detected program on first load
  // (only when user hasn't explicitly picked something via URL params)
  const [autoDetected, setAutoDetected] = useState(false);
  useEffect(() => {
    if (autoDetected || isCacheLoading) return;
    if (preloadedEventId || preloadedServiceId || preloadedDate || preloadedSlug) {
      setAutoDetected(true);
      return;
    }
    if (cacheContextType && cacheContextId) {
      if (cacheContextType === 'event') {
        setSelectedEventId(cacheContextId);
        setViewType('event');
      } else if (cacheContextType === 'service') {
        setSelectedServiceId(cacheContextId);
        setViewType('service');
      }
      setAutoDetected(true);
    }
  }, [cacheContextType, cacheContextId, isCacheLoading, autoDetected, preloadedEventId, preloadedServiceId, preloadedDate, preloadedSlug]);

  // Determine if the current selection matches the cached program
  const isCachedSelection = useMemo(() => {
    if (!cacheContextId) return false;
    if (viewType === 'event' && selectedEventId === cacheContextId) return true;
    if (viewType === 'service' && selectedServiceId === cacheContextId) return true;
    return false;
  }, [viewType, selectedEventId, selectedServiceId, cacheContextId]);

  // When selection matches cache → use cached snapshot directly (zero latency)
  // When user picks a DIFFERENT event/service → fetch via getPublicProgramData
  const { data: explicitFetchData, isLoading: isExplicitLoading, refetch: refetchExplicit } = useQuery({
    queryKey: ['publicProgramData-explicit', selectedEventId, selectedServiceId, viewType, preloadedDate, preloadedSlug],
    queryFn: async () => {
      const payload = { includeOptions: false };
      if (viewType === 'event' && selectedEventId) {
        payload.eventId = selectedEventId;
      } else if (viewType === 'service' && selectedServiceId) {
        payload.serviceId = selectedServiceId;
      } else if (preloadedDate) {
        payload.date = preloadedDate;
      } else {
        payload.detectActive = true;
      }
      const response = await base44.functions.invoke('getPublicProgramData', payload);
      if (response.status >= 400) throw new Error("Failed to fetch program data");
      return response.data;
    },
    // Only enable when user picks something NOT in cache
    enabled: !isCachedSelection && !!(selectedEventId || selectedServiceId || preloadedDate),
    staleTime: 30 * 1000,    // Fresh for 30s (entity subs handle live updates)
    refetchInterval: 30000,  // Safety net: 30s poll (subs are primary update channel)
  });

  // Merge: cache-first, fallback to explicit fetch
  const programData = isCachedSelection ? cacheProgramData : (explicitFetchData || null);
  const isLoadingProgram = isCachedSelection ? isCacheLoading : isExplicitLoading;
  const refetchProgram = isCachedSelection ? (() => {}) : refetchExplicit;

  // Derived state from programData — works for both cache snapshot and explicit fetch shapes
  const sessions = programData?.sessions || [];
  const allSegments = programData?.segments || [];
  const rooms = programData?.rooms || [];
  const preSessionDetails = programData?.preSessionDetails || [];
  // For 'weeklyServiceData' compat (rawServiceData was the service object)
  const rawServiceData = viewType === 'service' ? programData?.program : null;

  const refetchData = () => {
    if (typeof refetchProgram === 'function') refetchProgram();
  };

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);

  // ── REAL-TIME SUBSCRIPTIONS (2026-02-15 stability refactor) ──
  // CACHED path: useActiveProgramCache subscribes to ActiveProgramCache only.
  //   Entity automations → refreshActiveProgram → ActiveProgramCache update → sub fires.
  // EXPLICIT path: these subs invalidate 'publicProgramData-explicit' for non-cached selection.
  // TOAST notifications: only for entities directly relevant to the current selection on today's date.
  // Debounce timer ref to coalesce rapid entity changes into one invalidation.
  const explicitDebounceRef = React.useRef(null);
  useEffect(() => {
    if (!currentUser) return;

    // Only subscribe to entity changes when viewing a NON-cached selection
    // (cached path is fully handled by useActiveProgramCache → ActiveProgramCache sub)
    if (isCachedSelection) return;

    const unsubscribers = [];

    const debouncedInvalidateExplicit = () => {
      if (explicitDebounceRef.current) clearTimeout(explicitDebounceRef.current);
      explicitDebounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['publicProgramData-explicit'] });
        explicitDebounceRef.current = null;
      }, 800);
    };

    // Core entities that affect program display
    unsubscribers.push(
      base44.entities.Segment.subscribe(() => debouncedInvalidateExplicit())
    );
    unsubscribers.push(
      base44.entities.Session.subscribe(() => debouncedInvalidateExplicit())
    );
    unsubscribers.push(
      base44.entities.SegmentAction.subscribe(() => debouncedInvalidateExplicit())
    );

    if (viewType === 'service' && selectedServiceId) {
      unsubscribers.push(
        base44.entities.Service.subscribe(() => debouncedInvalidateExplicit())
      );
    }
    if (viewType === 'event' && selectedEventId) {
      unsubscribers.push(
        base44.entities.Event.subscribe(() => debouncedInvalidateExplicit())
      );
      unsubscribers.push(
        base44.entities.PreSessionDetails.subscribe(() => debouncedInvalidateExplicit())
      );
      unsubscribers.push(
        base44.entities.StreamBlock.subscribe(() => {
          debouncedInvalidateExplicit();
          queryClient.invalidateQueries({ queryKey: ['streamBlocksForStatusCard'] });
        })
      );
    }

    return () => {
      if (explicitDebounceRef.current) clearTimeout(explicitDebounceRef.current);
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [viewType, selectedServiceId, selectedEventId, isCachedSelection, queryClient, currentUser]);

  // Derived live adjustments from program data
  const liveAdjustments = programData?.liveAdjustments || [];

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
    staleTime: 15 * 1000,    // Fresh for 15s
    refetchInterval: 30000,  // Safety net: 30s poll (not time-critical, only for history modal)
  });

  // LiveTimeAdjustment subscription for explicit-fetch path only.
  // Cached path: handled by entity automation → refreshActiveProgram → ActiveProgramCache sub.
  useEffect(() => {
    if (!currentUser || viewType !== "service" || !selectedServiceId || !rawServiceData?.date) return;
    if (isCachedSelection) return; // Cached path already handles this

    const unsubscribe = base44.entities.LiveTimeAdjustment.subscribe((event) => {
      if (event.data?.date === rawServiceData.date && event.data?.service_id === selectedServiceId) {
        queryClient.invalidateQueries({ queryKey: ['publicProgramData-explicit'] });
      }
    });

    return unsubscribe;
  }, [viewType, selectedServiceId, rawServiceData?.date, isCachedSelection, queryClient, currentUser]);

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

  // Helper: check if a segment's date matches today
  // For events, each segment belongs to a session with its own date.
  // For services, uses the single service date.
  const isSegmentDateToday = (segment) => {
    const now = currentTime;
    const today = new Date(now);
    today.setHours(0,0,0,0);

    if (viewType === 'service' && actualServiceData?.date) {
      const serviceDate = getLocalDateAtMidnight(actualServiceData.date);
      return serviceDate && serviceDate.getTime() === today.getTime();
    }

    if (viewType === 'event') {
      // Find the session this segment belongs to and check ITS date
      // Segments from events carry session_id; also check segment.date (augmented by EventProgramView)
      const segDate = segment.date || (() => {
        const session = sessions.find(s => s.id === segment.session_id);
        return session?.date;
      })();
      if (segDate) {
        const sessionDate = getLocalDateAtMidnight(segDate);
        return sessionDate && sessionDate.getTime() === today.getTime();
      }
      // No date info — conservative: don't mark as live
      return false;
    }

    return true; // fallback
  };

  const isSegmentCurrent = (segment) => {
    if (!segment?.start_time || !segment?.end_time) return false;
    if (typeof segment.start_time !== 'string' || typeof segment.end_time !== 'string') return false;
    
    // Per-session date gate: only segments whose session date is TODAY can be "current"
    if (!isSegmentDateToday(segment)) return false;

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

  const isSegmentUpcoming = (segment, allSegs) => {
    // Per-session date gate
    if (!isSegmentDateToday(segment)) return false;

    // Only consider segments that are also today when computing "next"
    const todaySegments = (allSegs || []).filter(s => isSegmentDateToday(s));
    const nextSegment = getNextSegment(todaySegments);
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

  // AUTH GATE: Don't render anything until auth is confirmed
  if (!authChecked) {
    return <LiveViewSkeleton />;
  }

  // Show skeleton loading state when primary data is loading
  // For cached selection: only show skeleton on initial cache load, not on revalidation
  const isContentLoading = (selectedEventId || selectedServiceId) && isLoadingProgram && !programData;

  if (isContentLoading) {
    return <LiveViewSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
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

          {/* TV View Link */}
          {((viewType === 'event' && selectedEventId) || (viewType === 'service' && selectedServiceId)) && (
            <Link 
              to={viewType === 'event' 
                ? `${createPageUrl('PublicCountdownDisplay')}?event_id=${selectedEventId}`
                : `${createPageUrl('PublicCountdownDisplay')}?service_id=${selectedServiceId}`
              }
              target="_blank"
              className="flex items-center justify-center w-12 h-12 rounded-lg bg-white border-2 border-gray-300 text-gray-500 hover:text-pdv-teal hover:border-pdv-teal transition-all shrink-0 shadow-sm"
              title={t('public.tvViewTooltip')}
            >
              <Tv className="w-5 h-5" />
            </Link>
          )}
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
              <h2 className="text-2xl text-gray-900 leading-tight">
                {viewType === "event" ? selectedEvent?.name : selectedService?.name}
              </h2>
              {viewType === "event" && selectedEvent?.theme && (
                <p className="text-pdv-teal font-medium italic">"{selectedEvent.theme}"</p>
              )}
            </div>

            {/* Live Admin Controls moved to EventProgramView - LiveDirectorPanel */}

            {/* CLEANUP: Legacy filter card removed (2026-02-10). EventProgramView handles filters internally. */}

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
                              {t('common.edit')}
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
            {viewType === "service" && hasPermission(currentUser, 'manage_live_timing') && actualServiceData && (
              <Card className="bg-slate-900 text-white border-none">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                      <span className="font-bold uppercase text-xs sm:text-sm">{t('public.adjustStartTime')}</span>
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
                        title={t('public.viewHistory')}
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
                allSegments={allSegments} // Pass backend-generated flat list (includes Break)
                sessions={sessions} // For resolving entity session IDs to slot names
                liveAdjustments={liveAdjustments}
                preSessionData={preSessionDetails.find(p => sessions[0] && p.session_id === sessions[0].id) || null}
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
                // PERMISSION-GATED: Live ops (StickyOpsDeck + chat) require view_live_chat
                // Compute once and pass down — requires currentUser to be loaded
                canAccessLiveOps={!!(currentUser && hasPermission(currentUser, 'view_live_chat'))}
                onToggleChat={() => setChatOpen(!chatOpen)}
                chatUnreadCount={chatUnreadCount}
                chatOpen={chatOpen}
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
                               // PERMISSION-GATED: Live ops (StickyOpsDeck + chat) require view_live_chat
                               canAccessLiveOps={!!(currentUser && hasPermission(currentUser, 'view_live_chat'))}
                               onToggleChat={() => setChatOpen(!chatOpen)}
                               chatUnreadCount={chatUnreadCount}
                               chatOpen={chatOpen}
                               isStreamMode={isStreamMode}
                               />
            )}

            {/* Legacy blocks removed 2026-02-10 — see AttemptLog */}

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

      <StructuredVersesModal open={versesModalOpen} onOpenChange={setVersesModalOpen} parsedData={versesModalData.parsedData} rawText={versesModalData.rawText} language={language} />
      <VerseParserDialog open={verseParserOpen} onOpenChange={setVerseParserOpen} initialText={verseParserInitial} onSave={async ({ parsed_data, verse }) => { if (!verseParserSegment) return; await base44.entities.Segment.update(verseParserSegment.id, { scripture_references: verse, parsed_verse_data: parsed_data }); setVersesModalData({ parsedData: parsed_data, rawText: verse }); setVersesModalOpen(true); refetchProgram(); }} language={language} />
      <LiveTimeAdjustmentModal isOpen={timeAdjustmentModalOpen} onClose={() => { setTimeAdjustmentModalOpen(false); setAdjustmentModalTimeSlot(null); setCurrentAdjustment(null); }} timeSlot={adjustmentModalTimeSlot} currentOffset={currentAdjustment?.offset_minutes || 0} onSave={handleSaveTimeAdjustment} serviceTime={actualServiceData?.time} />
      <TimeAdjustmentHistoryModal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} logs={adjustmentLogs} selectedDate={rawServiceData?.date ? formatDateET(rawServiceData.date) : ''} />
      {currentUser && hasPermission(currentUser, 'view_live_chat') && (viewType === "event" ? selectedEvent : selectedService) && (
        <LiveOperationsChat currentUser={currentUser} contextType={viewType} contextId={viewType === "event" ? selectedEventId : selectedServiceId} contextDate={viewType === "event" ? selectedEvent?.end_date : rawServiceData?.date} contextName={viewType === "event" ? selectedEvent?.name : selectedService?.name} isOpen={chatOpen} onToggle={setChatOpen} onUnreadCountChange={setChatUnreadCount} hideTrigger={true} />
      )}
      <div style={gradientStyle} className="mt-12 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" className="w-12 h-12 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg tracking-wide uppercase">{t('public.footer.motto')}</p>
          <p className="text-white text-sm mt-2">{t('public.footer.name')}</p>
        </div>
      </div>
    </div>
  );
}
// EOF - PublicProgramView.jsx cleaned 2026-02-10