import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/components/utils/i18n';

/**
 * LiveViewSelector - Unified selection UI for Events, Weekly, and Custom Services
 * 
 * Features:
 * - Event/Service tab toggle
 * - Smart dropdowns with filtering
 * - Auto-selection logic (today > next 7 days)
 * - URL param handling
 * 
 * @param {Object} props
 * @param {string} props.viewType - 'event' or 'service'
 * @param {Function} props.onViewTypeChange
 * @param {string} props.selectedEventId
 * @param {string} props.selectedServiceId
 * @param {Function} props.onEventChange
 * @param {Function} props.onServiceChange
 * @param {Array} props.events - Available events
 * @param {Array} props.services - Available services
 */
export default function LiveViewSelector({
  viewType,
  onViewTypeChange,
  selectedEventId,
  selectedServiceId,
  onEventChange,
  onServiceChange,
  events = [],
  services = []
}) {
  const { t } = useLanguage();
  
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  // Helper: Parse date strings as local timezone dates at midnight
  const getLocalDateAtMidnight = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  // Filter events: 1 past + upcoming within 7 days
  const getAvailableEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);
    
    const pastEvents = events.filter(e => {
      if (!e.start_date) return false;
      const eventDate = getLocalDateAtMidnight(e.start_date);
      return eventDate && eventDate < today;
    }).slice(0, 1);
    
    const upcomingEvents = events.filter(e => {
      if (!e.start_date) return false;
      const eventDate = getLocalDateAtMidnight(e.start_date);
      return eventDate && eventDate >= today && eventDate <= sevenDaysOut;
    });
    
    return [...pastEvents, ...upcomingEvents];
  };

  // Filter services: upcoming 7 days, deduped by date
  const getAvailableServices = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);

    return services
      .filter(s => {
        if (!s.date) return false;
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
        // Dedupe: keep most recently updated per date
        const existing = acc.find(s => s.date === service.date);
        if (!existing) {
          acc.push(service);
        } else if (new Date(service.updated_date) > new Date(existing.updated_date)) {
          const idx = acc.indexOf(existing);
          acc[idx] = service;
        }
        return acc;
      }, []);
  };

  const availableEvents = getAvailableEvents();
  const availableServices = getAvailableServices();

  return (
    <Card className="bg-white border-2 border-gray-300">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* View Type Toggle */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => onViewTypeChange("event")}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
              style={viewType === "event" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
            >
              {t('nav.events') || 'Eventos'}
            </button>
            <button
              onClick={() => onViewTypeChange("service")}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
              style={viewType === "service" ? { backgroundColor: '#8DC63F', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
            >
              {t('nav.services') || 'Servicios'}
            </button>
          </div>

          {/* Event Selector */}
          {viewType === "event" && (
            <div className="w-full">
              <Select value={selectedEventId} onValueChange={onEventChange}>
                <SelectTrigger className="w-full bg-white border-2 border-gray-400 text-gray-900 h-12">
                  <SelectValue placeholder={t('liveView.selectEvent') || "Selecciona un evento"} />
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
          )}

          {/* Service Selector */}
          {viewType === "service" && (
            <div className="w-full">
              <Select value={selectedServiceId} onValueChange={onServiceChange}>
                <SelectTrigger className="w-full bg-white border-2 border-gray-400 text-gray-900 h-12">
                  <SelectValue placeholder={t('liveView.selectService') || "Selecciona un servicio"} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {availableServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - {service.date} ({service.daysUntil === 0 ? 'Hoy' : service.daysUntil === 1 ? 'Mañana' : `en ${service.daysUntil} días`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}