/**
 * useSegmentTiming — P3 DEV-1 (2026-03-02)
 * 
 * Custom hook extracting segment timing logic from PublicProgramView.
 * Provides: isSegmentCurrent, isSegmentUpcoming, getNextSegment,
 *           getCountdownToNext, scrollToSegment, getSegmentDomId
 * 
 * Surfaces: PublicProgramView (Live View)
 */
import { useCallback } from 'react';

/**
 * Parse YYYY-MM-DD to local Date at midnight (avoids UTC midnight bug)
 */
function getLocalDateAtMidnight(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export default function useSegmentTiming({ currentTime, viewType, serviceDate, sessions }) {
  // Check if a segment's date matches today
  const isSegmentDateToday = useCallback((segment) => {
    const now = currentTime;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    if (viewType === 'service' && serviceDate) {
      const sd = getLocalDateAtMidnight(serviceDate);
      return sd && sd.getTime() === today.getTime();
    }

    if (viewType === 'event') {
      const segDate = segment.date || (() => {
        const session = (sessions || []).find(s => s.id === segment.session_id);
        return session?.date;
      })();
      if (segDate) {
        const sessionDate = getLocalDateAtMidnight(segDate);
        return sessionDate && sessionDate.getTime() === today.getTime();
      }
      return false;
    }

    return true;
  }, [currentTime, viewType, serviceDate, sessions]);

  const isSegmentCurrent = useCallback((segment) => {
    if (!segment?.start_time || !segment?.end_time) return false;
    if (typeof segment.start_time !== 'string' || typeof segment.end_time !== 'string') return false;
    if (!isSegmentDateToday(segment)) return false;

    const now = currentTime;
    const [startH, startM] = segment.start_time.split(':').map(Number);
    const [endH, endM] = segment.end_time.split(':').map(Number);
    const startTime = new Date(now); startTime.setHours(startH, startM, 0);
    const endTime = new Date(now); endTime.setHours(endH, endM, 0);
    return now >= startTime && now <= endTime;
  }, [currentTime, isSegmentDateToday]);

  const getNextSegment = useCallback((segments) => {
    if (!segments || segments.length === 0) return null;
    const now = currentTime;
    const futureSegments = segments.filter(seg => {
      if (!seg?.start_time || typeof seg.start_time !== 'string') return false;
      const [h, m] = seg.start_time.split(':').map(Number);
      const st = new Date(now); st.setHours(h, m, 0);
      return st > now;
    });
    if (futureSegments.length === 0) return null;
    return futureSegments.sort((a, b) => {
      const [aH, aM] = a.start_time.split(':').map(Number);
      const [bH, bM] = b.start_time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    })[0];
  }, [currentTime]);

  const isSegmentUpcoming = useCallback((segment, allSegs) => {
    if (!isSegmentDateToday(segment)) return false;
    const todaySegments = (allSegs || []).filter(s => isSegmentDateToday(s));
    const nextSeg = getNextSegment(todaySegments);
    if (!nextSeg || nextSeg.id !== segment.id) return false;
    if (!segment?.start_time || typeof segment.start_time !== 'string') return false;

    const now = currentTime;
    const [h, m] = segment.start_time.split(':').map(Number);
    const st = new Date(now); st.setHours(h, m, 0);
    const timeUntil = (st - now) / 1000 / 60;
    return timeUntil > 0 && timeUntil <= 15;
  }, [currentTime, isSegmentDateToday, getNextSegment]);

  const getCountdownToNext = useCallback((segments) => {
    const nextSeg = getNextSegment(segments);
    if (!nextSeg?.start_time || typeof nextSeg.start_time !== 'string') return null;
    const now = currentTime;
    const [h, m] = nextSeg.start_time.split(':').map(Number);
    const st = new Date(now); st.setHours(h, m, 0);
    const diffMs = st - now;
    return {
      segment: nextSeg,
      minutes: Math.floor(diffMs / 1000 / 60),
      seconds: Math.floor((diffMs / 1000) % 60),
      isNear: Math.floor(diffMs / 1000 / 60) <= 15,
    };
  }, [currentTime, getNextSegment]);

  const getSegmentDomId = useCallback((segment) => {
    const title = segment.title || segment.data?.title || 'Untitled';
    const startTime = segment.start_time || segment.data?.start_time || '00:00';
    const baseId = segment.id || `${title}-${startTime}`;
    return `segment-${baseId}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
  }, []);

  const scrollToSegment = useCallback((segment) => {
    if (!segment) return;
    const id = getSegmentDomId(segment);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-pdv-teal', 'ring-offset-2', 'transition-all', 'duration-500');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-pdv-teal', 'ring-offset-2');
      }, 2500);
    }
  }, [getSegmentDomId]);

  return {
    isSegmentCurrent,
    isSegmentUpcoming,
    getNextSegment,
    getCountdownToNext,
    getSegmentDomId,
    scrollToSegment,
  };
}