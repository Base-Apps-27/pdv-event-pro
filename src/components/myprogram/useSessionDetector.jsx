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

    // Nothing active — find next upcoming within visibility windows (Unified Queue)
    const candidates = [];

    // 1. Events: Visible Date-4 (4 days out)
    const fourDaysOut = new Date();
    fourDaysOut.setDate(fourDaysOut.getDate() + 4);
    const fourStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(fourDaysOut);
    
    const validNextEvents = events.filter(e => e.start_date > todayStr && e.start_date <= fourStr);
    validNextEvents.forEach(e => {
        // Events don't strictly have a single "start time" field in the list object usually, 
        // but if they do, we use it. Default to end of day priority if no time (events usually span days).
        // Actually, events usually start early. Let's treat them as 00:00 if undefined.
        candidates.push({
            type: 'event',
            date: e.start_date,
            time: '00:00', 
            item: e
        });
    });

    // 2. Services: Visible Date-1 (1 day out)
    const oneDayOut = new Date();
    oneDayOut.setDate(oneDayOut.getDate() + 1);
    const oneStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(oneDayOut);

    const validNextServices = services.filter(s => s.date > todayStr && s.date <= oneStr);
    validNextServices.forEach(s => {
        // Services usually have a 'time' field (e.g. "10:00" or "19:30")
        candidates.push({
            type: 'service',
            date: s.date,
            time: s.time || '00:00',
            item: s
        });
    });

    // 3. Sort unified list by Date ASC, then Time ASC to find the absolute nearest
    candidates.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        // Same date: compare time
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
    });

    const winner = candidates[0];

    if (winner) {
        if (winner.type === 'service') {
             return { contextType: 'service', contextId: winner.item.id, event: null, service: winner.item };
        } else {
             return { contextType: 'event', contextId: winner.item.id, event: winner.item, service: null };
        }
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