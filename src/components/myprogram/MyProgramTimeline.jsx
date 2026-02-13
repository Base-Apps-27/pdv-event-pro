/**
 * MyProgramTimeline — MyProgram Step 8
 * 
 * Vertical timeline rendering normalized segments.
 * Computes status (done/now/next/upcoming) per segment.
 * Filters by session and department.
 * Auto-scrolls to current segment.
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '@/components/utils/i18n';
import MyProgramSegmentCard from './MyProgramSegmentCard';

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

export default function MyProgramTimeline({ segments, sessionFilter, department, currentTime, sessionDate }) {
  const { t } = useLanguage();
  const nowRef = useRef(null);
  const hasScrolled = useRef(false);

  // Filter by session
  const filtered = useMemo(() => {
    if (!sessionFilter) return segments;
    return segments.filter(s => s._sessionId === sessionFilter);
  }, [segments, sessionFilter]);

  // Compute status for each segment
  const nowMinutes = useMemo(() => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  // Check if the session date is today
  const isToday = useMemo(() => {
    if (!sessionDate) return false;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    return sessionDate === todayStr;
  }, [sessionDate]);

  const segmentsWithStatus = useMemo(() => {
    let foundCurrent = false;
    let foundNext = false;

    return filtered.map((seg) => {
      if (!isToday) {
        return { ...seg, _status: 'upcoming' };
      }

      const start = parseTimeToMinutes(seg.start_time);
      const end = parseTimeToMinutes(seg.end_time);

      if (start === null) return { ...seg, _status: 'upcoming' };

      if (end !== null && nowMinutes >= start && nowMinutes < end && !foundCurrent) {
        foundCurrent = true;
        return { ...seg, _status: 'now' };
      }

      if (end !== null && nowMinutes >= end) {
        return { ...seg, _status: 'done' };
      }

      if (!foundCurrent && !foundNext && start > nowMinutes) {
        // Check if there's an active segment we haven't found yet
        // If no current segment, the first future one is "next"
        foundNext = true;
        return { ...seg, _status: 'next' };
      }

      if (foundCurrent && !foundNext && start > nowMinutes) {
        foundNext = true;
        return { ...seg, _status: 'next' };
      }

      return { ...seg, _status: 'upcoming' };
    });
  }, [filtered, nowMinutes, isToday]);

  // Auto-scroll to "now" or "next" on first render
  useEffect(() => {
    if (!hasScrolled.current && nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolled.current = true;
    }
  }, [segmentsWithStatus]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {t('myprogram.standby.subtitle')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {segmentsWithStatus.map((seg) => (
        <div
          key={seg.id}
          ref={seg._status === 'now' || seg._status === 'next' ? nowRef : undefined}
        >
          <MyProgramSegmentCard
            segment={seg}
            status={seg._status}
            department={department}
          />
        </div>
      ))}
    </div>
  );
}