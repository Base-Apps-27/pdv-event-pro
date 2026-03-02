/**
 * ProgramSelectorBar — P3 DEV-1 (2026-03-02)
 * 
 * Event/Service toggle + select dropdowns extracted from PublicProgramView.
 * Surfaces: PublicProgramView (Live View)
 */
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateET } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";

function getLocalDateAtMidnight(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export default function ProgramSelectorBar({
  viewType, setViewType,
  selectedEventId, setSelectedEventId,
  selectedServiceId, setSelectedServiceId,
  publicEvents, services,
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      {/* View Type Toggle */}
      <div className="bg-gray-200 p-1 rounded-xl flex shrink-0 shadow-inner">
        <button
          onClick={() => { setViewType("event"); setSelectedServiceId(""); }}
          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewType === "event" ? "bg-white text-pdv-teal shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t('public.events')}
        </button>
        <button
          onClick={() => { setViewType("service"); setSelectedEventId(""); }}
          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewType === "service" ? "bg-white text-pdv-green shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t('public.services')}
        </button>
      </div>

      {/* Context Selector */}
      <div className="flex-1 w-full">
        {viewType === "event" && <EventSelector
          events={publicEvents}
          selectedId={selectedEventId}
          onSelect={setSelectedEventId}
          t={t}
        />}
        {viewType === "service" && <ServiceSelector
          services={services}
          selectedId={selectedServiceId}
          onSelect={setSelectedServiceId}
          t={t}
        />}
      </div>
    </div>
  );
}

function EventSelector({ events, selectedId, onSelect, t }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ninetyDaysOut = new Date(today); ninetyDaysOut.setDate(today.getDate() + 90);

  const pastEvents = events.filter(e => {
    if (!e.start_date) return false;
    return new Date(e.start_date) < today;
  }).slice(0, 1);

  const upcomingEvents = events
    .filter(e => {
      if (!e.start_date) return false;
      const d = new Date(e.start_date);
      return d >= today && d <= ninetyDaysOut;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const available = [...pastEvents, ...upcomingEvents];

  return (
    <div className="w-full max-w-full">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-2 border-gray-400 text-gray-900 h-12">
          <SelectValue placeholder={t('public.selectEvent')} />
        </SelectTrigger>
        <SelectContent className="bg-white max-w-[calc(100vw-2rem)]">
          {available.map(event => (
            <SelectItem key={event.id} value={event.id}>
              <span className="truncate max-w-[200px] inline-block align-bottom">{event.name}</span> - {formatDateET(event.start_date)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ServiceSelector({ services, selectedId, onSelect, t }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sevenDaysOut = new Date(today); sevenDaysOut.setDate(today.getDate() + 7);

  const upcomingServices = services
    .filter(s => {
      const sd = getLocalDateAtMidnight(s.date);
      return sd && sd.getTime() <= sevenDaysOut.getTime();
    })
    .map(service => {
      const sd = getLocalDateAtMidnight(service.date);
      const diffTime = sd.getTime() - today.getTime();
      const daysUntil = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return { ...service, daysUntil };
    })
    .reduce((acc, service) => {
      const existing = acc.find(s => s.date === service.date);
      if (!existing) { acc.push(service); }
      else if (new Date(service.updated_date) > new Date(existing.updated_date)) {
        acc[acc.indexOf(existing)] = service;
      }
      return acc;
    }, []);

  return (
    <div className="w-full max-w-full">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full max-w-full overflow-hidden bg-white border-2 border-gray-400 text-gray-900 h-12">
          <SelectValue placeholder={t('public.selectService')} />
        </SelectTrigger>
        <SelectContent className="bg-white max-w-[calc(100vw-2rem)]">
          {upcomingServices.map(service => (
            <SelectItem key={service.id} value={service.id}>
              <span className="truncate max-w-[180px] inline-block align-bottom">{service.name}</span> - {formatDateET(service.date)} ({service.daysUntil === 0 ? t('public.today') : service.daysUntil === 1 ? t('public.tomorrow') : `${t('public.in')} ${service.daysUntil} ${service.daysUntil === 1 ? t('public.day') : t('public.days')}`})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}