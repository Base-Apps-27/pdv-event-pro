/**
 * useSessionDetector — MyProgram Step 4
 * 
 * Auto-detects active event or service for MyProgram.
 * Logic:
 * 1. Check for events happening today (or starting tomorrow if within 24h)
 * 2. Check for weekly/custom services today
 * 3. Return { contextType, contextId, sessions, segments, event, service, ... }
 * 
 * Decision: "MyProgram: context-aware for Events vs Services with normalization layer"
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo } from 'react';

function getTodayETString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function getTomorrowETString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

export default function useSessionDetector() {
  const todayStr = getTodayETString();
  const tomorrowStr = getTomorrowETString();

  // Fetch program data via the same backend function PublicProgramView uses
  const { data: selectorOptions = { events: [], services: [] }, isLoading: optionsLoading } = useQuery({
    queryKey: ['myprogram-selectorOptions'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPublicProgramData', { listOptions: true });
      if (response.status >= 400) return { events: [], services: [] };
      return response.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60000,
  });

  const detected = useMemo(() => {
    const events = selectorOptions.events || [];
    const services = selectorOptions.services || [];

    // 1. Check for events happening today or multi-day events spanning today
    const todayEvent = events.find(e => {
      if (!e.start_date) return false;
      const end = e.end_date || e.start_date;
      return e.start_date <= todayStr && end >= todayStr;
    });

    // 2. Check for events starting tomorrow (1-day-before availability)
    const tomorrowEvent = !todayEvent ? events.find(e => {
      return e.start_date === tomorrowStr;
    }) : null;

    // 3. Check for services today
    const todayService = services.find(s => s.date === todayStr);

    // Priority: today's event > today's service > tomorrow's event
    if (todayEvent) {
      return { contextType: 'event', contextId: todayEvent.id, event: todayEvent, service: null };
    }
    if (todayService) {
      return { contextType: 'service', contextId: todayService.id, event: null, service: todayService };
    }
    if (tomorrowEvent) {
      return { contextType: 'event', contextId: tomorrowEvent.id, event: tomorrowEvent, service: null };
    }

    // Nothing active — find next upcoming within 7 days
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const sevenStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(sevenDaysOut);

    const nextEvent = events.find(e => e.start_date > todayStr && e.start_date <= sevenStr);
    const nextService = services.find(s => s.date > todayStr && s.date <= sevenStr);

    if (nextService && (!nextEvent || nextService.date <= nextEvent.start_date)) {
      return { contextType: 'service', contextId: nextService.id, event: null, service: nextService };
    }
    if (nextEvent) {
      return { contextType: 'event', contextId: nextEvent.id, event: nextEvent, service: null };
    }

    return { contextType: null, contextId: null, event: null, service: null };
  }, [selectorOptions, todayStr, tomorrowStr]);

  // Fetch full program data for the detected context
  const { data: programData, isLoading: programLoading } = useQuery({
    queryKey: ['myprogram-programData', detected.contextType, detected.contextId],
    queryFn: async () => {
      const payload = {};
      if (detected.contextType === 'event') payload.eventId = detected.contextId;
      else if (detected.contextType === 'service') payload.serviceId = detected.contextId;
      else return null;

      const response = await base44.functions.invoke('getPublicProgramData', payload);
      if (response.status >= 400) return null;
      return response.data;
    },
    enabled: !!detected.contextId,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  return {
    ...detected,
    programData,
    isLoading: optionsLoading || programLoading,
    allEvents: selectorOptions.events || [],
    allServices: selectorOptions.services || [],
  };
}