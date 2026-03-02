/**
 * MyProgramTimeline — MyProgram Step 8
 * 
 * Vertical timeline rendering normalized segments.
 * Computes status (done/now/next/upcoming) per segment.
 * Filters by session and department.
 * Auto-scrolls to current segment.
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '@/components/utils/i18n.jsx';
import MyProgramSegmentCard from './MyProgramSegmentCard';
import PostSessionBanner from './PostSessionBanner';

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

import MyProgramPreSessionCard from './MyProgramPreSessionCard';

export default function MyProgramTimeline({ segments, sessionFilter, department, currentTime, sessionDate, preSessionDetails, preServiceNotes, selectedSession, onOpenVerses, segmentRefs }) {
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

  // Check if session is fully finished (all segments done)
  const isSessionFinished = useMemo(() => {
    if (segmentsWithStatus.length === 0) return false;
    return segmentsWithStatus.every(s => s._status === 'done');
  }, [segmentsWithStatus]);

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

  // Resolve pre-service notes for current session (weekly services)
  const resolvedPreServiceNote = useMemo(() => {
    if (!preServiceNotes || !selectedSession) return null;
    // Dynamic lookup: selectedSession is the slot name (e.g. "9:30am", "6:00pm")
    return preServiceNotes[selectedSession] || null;
  }, [preServiceNotes, selectedSession]);

  return (
    <div className="relative pt-4">
      {/* Pre-Session Card (Events with PreSessionDetails entity) */}
      <MyProgramPreSessionCard details={preSessionDetails} />

      {/* Pre-Service Notes (Weekly services — free-text, visible to all departments) */}
      {resolvedPreServiceNote && (
        <div className="relative mb-6 pl-6 sm:pl-8">
          <div className="absolute left-[0.65rem] sm:left-[0.85rem] top-4 w-3 h-3 bg-yellow-400 rounded-full z-10 border-2 border-white box-content" />
          <div className="bg-black border-l-4 border-yellow-400 rounded-r-2xl p-4 shadow-sm">
            <p className="text-sm text-white font-bold whitespace-pre-wrap">{resolvedPreServiceNote}</p>
          </div>
        </div>
      )}

      <div className="relative pl-7 sm:pl-9 space-y-0">
        {/* Vertical Timeline Line */}
        <div className="absolute left-2.5 sm:left-3.5 top-0 bottom-0 w-0.5 bg-gray-200" />

        {segmentsWithStatus.map((seg, idx) => (
        <div
          key={seg.id}
          ref={(el) => {
            // Wire up both the "now" auto-scroll ref and the parent's segmentRefs map
            if (seg._status === 'now') nowRef.current = el;
            if (segmentRefs) segmentRefs.current[seg.id] = el;
          }}
          className="relative mb-7"
        >
          {/* Timeline Dot */}
          <div className={`
            absolute -left-[1.55rem] sm:-left-[1.8rem] top-5 
            w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 
            flex items-center justify-center z-10 transition-all duration-500
            ${seg._status === 'now' 
              ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_0_4px_rgba(250,204,21,0.2)] scale-110' 
              : seg._status === 'done'
                ? 'bg-gray-200 border-gray-300'
                : 'bg-white border-gray-300'}
          `}>
            {seg._status === 'done' && <div className="w-2 h-2 bg-gray-400 rounded-full" />}
            {seg._status === 'now' && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            {seg._status === 'next' && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
          </div>

          <MyProgramSegmentCard
            segment={seg}
            status={seg._status}
            department={department}
            currentTime={currentTime}
            onOpenVerses={onOpenVerses}
          />
        </div>
      ))}
        
        {/* Post-Session Banner */}
        <PostSessionBanner isFinished={isSessionFinished} />
      </div>
    </div>
  );
}