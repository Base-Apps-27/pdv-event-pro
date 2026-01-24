import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import { getCapabilities } from '@/components/service/liveViewCapabilities';
import ServiceProgramView from '@/components/service/v2/ServiceProgramView';
import EventProgramView from '@/components/service/v2/EventProgramView';
import LiveAdminControls from '@/components/service/v2/LiveAdminControls';

/**
 * Public Program View V2
 * Unified live view for weekly, custom, and event services
 * Mobile-first with preserved Weekly layout
 */
export default function PublicProgramViewV2() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Service state
  const [serviceType, setServiceType] = useState(searchParams.get('type') || 'weekly');
  const [serviceId, setServiceId] = useState(searchParams.get('serviceId'));
  const [eventId, setEventId] = useState(searchParams.get('eventId'));
  const [serviceData, setServiceData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [liveAdjustments, setLiveAdjustments] = useState([]);

  const capabilities = getCapabilities(serviceType);

  // Get user
  useEffect(() => {
    const getUser = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        if (authenticated) {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
    };
    getUser();
  }, []);

  // Load service data
  useEffect(() => {
    loadServiceData();
  }, [serviceType, serviceId, eventId]);

  // Update current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadServiceData = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      if (serviceType === 'weekly') {
        // Load weekly service
        const services = await base44.entities.Service.filter({
          day_of_week: 'Sunday',
          status: 'active'
        });
        const service = services[0];
        if (service) {
          setServiceData(service);
          setServiceId(service.id);
          
          // Load live adjustments for today
          const adjustments = await base44.entities.LiveTimeAdjustment.filter({
            date: today,
            service_id: service.id,
            adjustment_type: 'time_slot'
          });
          setLiveAdjustments(adjustments);
        }
      } else if (serviceType === 'custom' && serviceId) {
        // Load custom service
        const service = await base44.entities.Service.get(serviceId);
        setServiceData(service);
        
        // Load live adjustments
        const adjustments = await base44.entities.LiveTimeAdjustment.filter({
          date: service.date || today,
          service_id: serviceId,
          adjustment_type: 'global'
        });
        setLiveAdjustments(adjustments);
      } else if (serviceType === 'event' && eventId) {
        // Load event, sessions, and segments
        const event = await base44.entities.Event.get(eventId);
        const eventSessions = await base44.entities.Session.filter({ event_id: eventId });
        const sessionIds = eventSessions.map(s => s.id);
        const eventSegments = await base44.entities.Segment.filter({
          session_id: { $in: sessionIds }
        });
        
        setServiceData(event);
        setSessions(eventSessions);
        setSegments(eventSegments);
        
        // Load live adjustments for today
        const adjustments = await base44.entities.LiveTimeAdjustment.filter({
          date: today,
          event_id: eventId,
          adjustment_type: 'session'
        });
        setLiveAdjustments(adjustments);
      }
    } catch (error) {
      console.error('Error loading service data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOffsetChange = (newOffset) => {
    // Reload data to reflect changes
    loadServiceData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">{t('common.loading') || 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-pdv flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl">
                  {t('liveView.liveProgram') || 'Programa en Vivo'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {format(currentTime, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={loadServiceData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Admin Controls */}
        {user && capabilities.timeAdjustment && (
          <LiveAdminControls
            user={user}
            serviceType={serviceType}
            capabilities={capabilities}
            context={{
              serviceId,
              eventId,
              date: format(currentTime, 'yyyy-MM-dd')
            }}
            currentOffset={liveAdjustments[0]?.offset_minutes || 0}
            onOffsetChange={handleOffsetChange}
          />
        )}

        {/* Service/Event Content */}
        {serviceType === 'event' ? (
          <EventProgramView
            eventData={serviceData}
            sessions={sessions}
            segments={segments}
            liveAdjustments={liveAdjustments}
            currentTime={currentTime}
          />
        ) : (
          <ServiceProgramView
            serviceData={serviceData}
            serviceType={serviceType}
            liveAdjustments={liveAdjustments}
            currentTime={currentTime}
          />
        )}
      </div>
    </div>
  );
}