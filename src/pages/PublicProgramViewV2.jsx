import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, BellRing } from 'lucide-react';
import { hasPermission } from '@/components/utils/permissions';
import { useSegmentNotifications } from '@/components/service/useSegmentNotifications';
import { useLanguage } from '@/components/utils/i18n';

import LiveViewSelector from '@/components/service/v2/LiveViewSelector';
import LiveViewInfoCard from '@/components/service/v2/LiveViewInfoCard';
import ServiceProgramView from '@/components/service/v2/ServiceProgramView';
import EventProgramView from '@/components/service/v2/EventProgramView';
import LiveAdminControls from '@/components/service/v2/LiveAdminControls';
import StructuredVersesModal from '@/components/service/StructuredVersesModal';
import LiveTimeAdjustmentModal from '@/components/service/LiveTimeAdjustmentModal';

/**
 * PublicProgramViewV2 - Complete unified live view
 * 
 * Architecture:
 * - Polymorphic data handling (Weekly, Custom, Event)
 * - Smart auto-selection (today > next 7 days)
 * - Real-time subscriptions
 * - Segment notifications
 * - Type-specific live controls
 * - URL param handling (slug, eventId, serviceId, date)
 */
export default function PublicProgramViewV2() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  // URL params handling
  const urlParams = new URLSearchParams(window.location.search);
  const preloadedSlug = urlParams.get('slug');
  const preloadedEventId = urlParams.get('eventId') || '';
  const preloadedServiceId = urlParams.get('serviceId') || '';
  const preloadedDate = urlParams.get('date') || '';

  // Core state
  const [currentUser, setCurrentUser] = useState(null);
  const [viewType, setViewType] = useState(preloadedServiceId || preloadedDate ? 'service' : 'event');
  const [selectedEventId, setSelectedEventId] = useState(preloadedEventId);
  const [selectedServiceId, setSelectedServiceId] = useState(preloadedServiceId);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modal state
  const [versesModalOpen, setVersesModalOpen] = useState(false);
  const [versesModalData, setVersesModalData] = useState({ parsedData: null, rawText: '' });
  const [timeAdjustmentModalOpen, setTimeAdjustmentModalOpen] = useState(false);
  const [adjustmentModalTimeSlot, setAdjustmentModalTimeSlot] = useState(null);
  const [currentAdjustment, setCurrentAdjustment] = useState(null);

  // Helper: Parse date strings as local timezone dates at midnight
  const getLocalDateAtMidnight = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        // Not logged in - public access
      }
    };
    fetchUser();
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch events
  const { data: publicEvents = [] } = useQuery({
    queryKey: ['publicEvents'],
    queryFn: async () => {
      const events = await base44.entities.Event.list('-start_date');
      return events.filter(e => e.status === 'confirmed' || e.status === 'in_progress');
    },
    refetchInterval: 5000,
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const allServices = await base44.entities.Service.list();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayString = `${yyyy}-${mm}-${dd}`;

      return allServices
        .filter(s => 
          s.status === 'active' && 
          s.date && 
          s.origin !== 'blueprint' && 
          s.date >= todayString
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    refetchInterval: 5000,
  });

  // Handle preloaded date
  useEffect(() => {
    if (preloadedDate && services.length > 0 && !selectedServiceId) {
      const serviceForDate = services.find(s => s.date === preloadedDate && s.status === 'active');
      if (serviceForDate) {
        setSelectedServiceId(serviceForDate.id);
        setViewType('service');
      }
    }
  }, [preloadedDate, services, selectedServiceId]);

  // Handle preloaded slug
  useEffect(() => {
    if (preloadedSlug && publicEvents.length > 0 && !selectedEventId) {
      const event = publicEvents.find(e => e.slug === preloadedSlug);
      if (event) {
        setSelectedEventId(event.id);
        setViewType('event');
      }
    }
  }, [preloadedSlug, publicEvents, selectedEventId]);

  // Auto-selection logic: Today's service > Today's event > Next upcoming
  useEffect(() => {
    if (publicEvents.length > 0 && services.length > 0 && !selectedEventId && !selectedServiceId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayEvent = publicEvents.find(e => {
        if (!e.start_date) return false;
        const eventDate = getLocalDateAtMidnight(e.start_date);
        const endDate = e.end_date ? getLocalDateAtMidnight(e.end_date) : eventDate;
        return eventDate && endDate && today.getTime() >= eventDate.getTime() && today.getTime() <= endDate.getTime();
      });
      
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayString = `${yyyy}-${mm}-${dd}`;
      const todayService = services.find(s => s.date === todayString);
      
      if (todayService) {
        setSelectedServiceId(todayService.id);
        setViewType('service');
      } else if (todayEvent) {
        setSelectedEventId(todayEvent.id);
        setViewType('event');
      } else {
        const sevenDaysOut = new Date(today);
        sevenDaysOut.setDate(today.getDate() + 7);
        
        const nextEvent = publicEvents.find(e => {
          if (!e.start_date) return false;
          const eventDate = getLocalDateAtMidnight(e.start_date);
          return eventDate && eventDate.getTime() > today.getTime() && eventDate.getTime() <= sevenDaysOut.getTime();
        });
        
        const nextService = services.find(s => {
          const serviceDate = getLocalDateAtMidnight(s.date);
          return serviceDate && serviceDate.getTime() > today.getTime();
        });
        
        if (nextEvent && nextService) {
          const eventDaysAway = Math.floor((getLocalDateAtMidnight(nextEvent.start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const serviceDaysAway = Math.floor((getLocalDateAtMidnight(nextService.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (serviceDaysAway <= eventDaysAway) {
            setSelectedServiceId(nextService.id);
            setViewType('service');
          } else {
            setSelectedEventId(nextEvent.id);
            setViewType('event');
          }
        } else if (nextEvent) {
          setSelectedEventId(nextEvent.id);
          setViewType('event');
        } else if (nextService) {
          setSelectedServiceId(nextService.id);
          setViewType('service');
        }
      }
    }
  }, [publicEvents, services, selectedEventId, selectedServiceId]);

  // Fetch service data
  const { data: rawServiceData } = useQuery({
    queryKey: ['serviceData', selectedServiceId],
    queryFn: async () => {
      const data = await base44.entities.Service.filter({ id: selectedServiceId });
      return data.filter(s => s.status === 'active' && s.date);
    },
    enabled: viewType === 'service' && !!selectedServiceId,
    refetchInterval: 5000,
  });

  // Fetch sessions for events
  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['sessions', selectedEventId],
    queryFn: () => base44.entities.Session.filter({ event_id: selectedEventId }, 'order'),
    enabled: viewType === 'event' && !!selectedEventId,
    refetchInterval: 5000,
  });

  // Fetch segments for events
  const { data: allSegments = [], refetch: refetchSegments } = useQuery({
    queryKey: ['segments', selectedEventId],
    queryFn: async () => {
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length === 0) return [];
      const allSegs = await base44.entities.Segment.list('order');
      return allSegs.filter(seg => 
        sessionIds.includes(seg.session_id) && seg.show_in_general !== false
      );
    },
    enabled: viewType === 'event' && !!selectedEventId && sessions.length > 0,
    refetchInterval: 5000,
  });

  // Fetch live adjustments
  const { data: liveAdjustments = [] } = useQuery({
    queryKey: ['liveAdjustments', selectedServiceId, selectedEventId, rawServiceData?.[0]?.date],
    queryFn: async () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayString = `${yyyy}-${mm}-${dd}`;
      
      if (viewType === 'service' && selectedServiceId && rawServiceData?.[0]?.date) {
        return await base44.entities.LiveTimeAdjustment.filter({ 
          date: rawServiceData[0].date, 
          service_id: selectedServiceId 
        });
      } else if (viewType === 'event' && selectedEventId) {
        return await base44.entities.LiveTimeAdjustment.filter({ 
          date: todayString, 
          event_id: selectedEventId 
        });
      }
      return [];
    },
    enabled: (viewType === 'service' && !!selectedServiceId && !!rawServiceData?.[0]?.date) || 
             (viewType === 'event' && !!selectedEventId),
    refetchInterval: 3000,
  });

  // Subscribe to live adjustments
  useEffect(() => {
    if (viewType === 'service' && selectedServiceId && rawServiceData?.[0]?.date) {
      const unsubscribe = base44.entities.LiveTimeAdjustment.subscribe((event) => {
        if (event.data.date === rawServiceData[0].date && event.data.service_id === selectedServiceId) {
          queryClient.invalidateQueries(['liveAdjustments', selectedServiceId, selectedEventId, rawServiceData[0].date]);
        }
      });
      return unsubscribe;
    }
  }, [viewType, selectedServiceId, rawServiceData?.[0]?.date]);

  // Calculate service times
  const actualServiceData = useMemo(() => {
    if (!rawServiceData?.[0]) return null;
    
    const calculateTimedSegments = (segments, startStr) => {
      if (!segments || !Array.isArray(segments)) return [];
      
      let currentH = 0;
      let currentM = 0;

      if (startStr) {
        currentH = parseInt(startStr.split(':')[0]);
        currentM = parseInt(startStr.split(':')[1]);
      }
      
      return segments.map(seg => {
        if (seg.start_time) {
          const [h, m] = seg.start_time.split(':').map(Number);
          currentH = h;
          currentM = m;
        }
        
        const startH = String(currentH).padStart(2, '0');
        const startM = String(currentM).padStart(2, '0');
        const startTime = `${startH}:${startM}`;
        
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
          start_time: seg.start_time || startTime,
          end_time: seg.end_time || endTime
        };
      });
    };

    const newData = { ...rawServiceData[0] };
    
    if (newData['9:30am']) {
      newData['9:30am'] = calculateTimedSegments(newData['9:30am'], '09:30');
    }
    if (newData['11:30am']) {
      newData['11:30am'] = calculateTimedSegments(newData['11:30am'], '11:30');
    }
    if (newData.segments && newData.segments.length > 0) {
      const serviceTime = newData.time || '10:00';
      newData.segments = calculateTimedSegments(newData.segments, serviceTime);
    }
    
    return newData;
  }, [rawServiceData]);

  // Prepare segments for notifications
  const segmentsForNotifications = useMemo(() => {
    let list = [];
    if (viewType === 'service' && actualServiceData) {
      if (actualServiceData.segments) {
        list = actualServiceData.segments;
      } else {
        const morning = (actualServiceData['9:30am'] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        const afternoon = (actualServiceData['11:30am'] || []).map(s => ({ ...s, start_time: s.start_time || s.data?.start_time, title: s.title || s.data?.title }));
        list = [...morning, ...afternoon];
      }
    } else if (viewType === 'event') {
      list = allSegments;
    }
    return list;
  }, [viewType, actualServiceData, allSegments]);

  useSegmentNotifications(segmentsForNotifications, sessions[0]);

  // Save time adjustment
  const handleSaveTimeAdjustment = async (offsetMinutes, authorizedBy) => {
    if (!selectedServiceId || !actualServiceData?.date || !adjustmentModalTimeSlot) return;

    try {
      const existing = liveAdjustments.find(a => a.time_slot === adjustmentModalTimeSlot);
      
      if (existing) {
        await base44.entities.LiveTimeAdjustment.update(existing.id, {
          offset_minutes: offsetMinutes,
          authorized_by: authorizedBy
        });
      } else {
        await base44.entities.LiveTimeAdjustment.create({
          date: actualServiceData.date,
          service_id: selectedServiceId,
          time_slot: adjustmentModalTimeSlot,
          offset_minutes: offsetMinutes,
          authorized_by: authorizedBy,
          adjustment_type: 'time_slot'
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const openAdjustmentModal = (timeSlot) => {
    const existing = liveAdjustments.find(a => a.time_slot === timeSlot);
    setCurrentAdjustment(existing || null);
    setAdjustmentModalTimeSlot(timeSlot);
    setTimeAdjustmentModalOpen(true);
  };

  const selectedEvent = publicEvents.find(e => e.id === selectedEventId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedData = viewType === 'event' ? selectedEvent : selectedService;

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
                <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">
                  {t('liveView.programTitle') || 'Programa del Evento'}
                </h1>
                <p className="text-sm md:text-base text-white/95 mt-1">¡ATRÉVETE A CAMBIAR!</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-lg">
              <BellRing className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-medium">{t('liveView.notificationsActive') || 'Notificaciones activas'}</span>
            </div>
          </div>
          <p className="text-lg text-white/95">{t('liveView.subtitle') || 'Explora el programa completo y mantente actualizado'}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Selection UI */}
        <LiveViewSelector
          viewType={viewType}
          onViewTypeChange={setViewType}
          selectedEventId={selectedEventId}
          selectedServiceId={selectedServiceId}
          onEventChange={setSelectedEventId}
          onServiceChange={setSelectedServiceId}
          events={publicEvents}
          services={services}
        />

        {/* Info Card */}
        {selectedData && (
          <LiveViewInfoCard
            viewType={viewType}
            data={selectedData}
            sessionCount={sessions.length}
            segmentCount={viewType === 'event' ? allSegments.length : 0}
          />
        )}

        {/* Live Admin Controls */}
        {hasPermission(currentUser, 'manage_live_timing') && selectedData && (
          <LiveAdminControls
            viewType={viewType}
            serviceData={actualServiceData}
            liveAdjustments={liveAdjustments}
            onOpenAdjustmentModal={openAdjustmentModal}
            currentUser={currentUser}
          />
        )}

        {/* Service Program */}
        {viewType === 'service' && actualServiceData && (
          <ServiceProgramView
            actualServiceData={actualServiceData}
            liveAdjustments={liveAdjustments}
            currentTime={currentTime}
            onOpenVerses={(data) => {
              setVersesModalData(data);
              setVersesModalOpen(true);
            }}
          />
        )}

        {/* Event Program */}
        {viewType === 'event' && selectedEvent && (
          <EventProgramView
            selectedEvent={selectedEvent}
            sessions={sessions}
            allSegments={allSegments}
            currentTime={currentTime}
            onOpenVerses={(data) => {
              setVersesModalData(data);
              setVersesModalOpen(true);
            }}
          />
        )}

        {/* Empty State */}
        {!selectedEventId && !selectedServiceId && (
          <div className="p-12 text-center bg-white border-dashed border-2 border-gray-400 rounded-xl">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {t('liveView.selectPrompt') || `Selecciona un ${viewType === 'event' ? 'evento' : 'servicio'} para ver su programa`}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <StructuredVersesModal
        open={versesModalOpen}
        onOpenChange={setVersesModalOpen}
        parsedData={versesModalData.parsedData}
        rawText={versesModalData.rawText}
        language="es"
      />

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