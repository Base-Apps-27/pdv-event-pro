/**
 * MyProgram — Step 9
 * 
 * Department-filtered, real-time program view for base users.
 * Mobile-first, read-only. No Ops Chat, no Ping Director.
 * 
 * Decision: "MyProgram page: department-filtered real-time view for base users"
 * Decision: "MyProgram: no Ops Chat, no Ping Director for base users"
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/utils/i18n.jsx';
import { useCurrentUser } from '@/components/utils/useCurrentUser';
import { useClockTick } from '@/components/utils/useClockTick';
import { Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { formatDateET } from '@/components/utils/timeFormat';

import useActiveProgramCache from '@/components/myprogram/useActiveProgramCache';
import { getSessionLabels } from '@/components/myprogram/normalizeSession';
import { normalizeProgramData } from '@/components/utils/normalizeProgram';
import DepartmentPicker, { useDepartment } from '@/components/myprogram/DepartmentPicker';
import SessionPicker from '@/components/myprogram/SessionPicker';
import MyProgramTimeline from '@/components/myprogram/MyProgramTimeline';
import MyProgramStandby from '@/components/myprogram/MyProgramStandby';
import MyProgramStatusBar from '@/components/myprogram/MyProgramStatusBar';
import StructuredVersesModal from '@/components/service/StructuredVersesModal';

export default function MyProgram() {
  const { t, language } = useLanguage();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Testing override: check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const overrideServiceId = urlParams.get('override_service_id');
  const overrideEventId = urlParams.get('override_event_id');
  const mockTimeParam = urlParams.get('mock_time'); // HH:MM format

  // Use mock time if provided, otherwise use real clock
  const realTime = useClockTick(1000);
  const currentTime = useMemo(() => {
    if (!mockTimeParam) return realTime;
    const [h, m] = mockTimeParam.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, [mockTimeParam, realTime]);

  const [department, setDepartment] = useDepartment();
  const [selectedSession, setSelectedSession] = useState(null);
  const [userOverrodeSession, setUserOverrodeSession] = useState(false);
  const [verseModalData, setVerseModalData] = useState(null);

  // Ref map for scrolling to specific segments
  const segmentRefs = React.useRef({});

  const { contextType, contextId, event, service, programData, isLoading, _isOverride } = useActiveProgramCache({
    overrideServiceId,
    overrideEventId,
  });

  // Normalize segments based on context type
  const segments = useMemo(() => {
    if (!programData) return [];
    const normalized = normalizeProgramData(programData);
    
    const sessionMap = {};
    (normalized.sessions || []).forEach(s => { sessionMap[s.id] = s.name; });
    
    const roomMap = {};
    (normalized.rooms || []).forEach(r => { roomMap[r.id] = r.name; });

    return normalized.segments.map(seg => {
      // Enrich breakout rooms with room names
      const enrichedBreakouts = (seg.breakout_rooms || []).map(br => ({
        ...br,
        _roomName: br.room_id ? (roomMap[br.room_id] || '') : ''
      }));

      return {
        ...seg,
        breakout_rooms: enrichedBreakouts,
        _sessionId: seg.session_id || 'custom',
        _sessionDate: seg.date || '',
        _sessionName: sessionMap[seg.session_id] || seg.session_id || 'Program',
        _roomName: seg.room_id ? (roomMap[seg.room_id] || '') : '',
        // Ensure effective start times are used for MyProgram timelines (Event Director Mode)
        start_time: seg.actual_start_time || seg.start_time,
        end_time: seg.actual_end_time || seg.end_time,
      };
    });
  }, [programData]);

  // Session labels for picker (with auto-abbreviated labels)
  const sessionLabels = useMemo(() => getSessionLabels(segments, language), [segments, language]);

  // Auto-detect which session is currently active or about to start.
  // For multi-day events: match by date first, then by time.
  // For same-day services: match by time (15-min pre-start window).
  // Only auto-switch if the user hasn't manually overridden their selection.
  const autoDetectedSession = useMemo(() => {
    if (sessionLabels.length === 0) return null;
    if (sessionLabels.length === 1) return sessionLabels[0].id;
    if (!currentTime) return sessionLabels[0].id;

    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(currentTime);

    // Step 1: Filter to today's sessions only (if sessions have dates)
    const hasDateInfo = sessionLabels.some(s => s.date);
    const todaySessions = hasDateInfo
      ? sessionLabels.filter(s => !s.date || s.date === todayStr)
      : sessionLabels; // no date info = treat all as same-day

    // If no sessions today, fall back to first session overall
    if (todaySessions.length === 0) return sessionLabels[0].id;

    // Step 2: Among today's sessions, find the one currently active or about to start.
    // Walk in reverse: pick the latest session whose first segment has started (or within 15 min).
    for (let i = todaySessions.length - 1; i >= 0; i--) {
      const sessId = todaySessions[i].id;
      const sessSegments = segments.filter(s => s._sessionId === sessId);
      if (sessSegments.length === 0) continue;

      const earliest = sessSegments.reduce((min, s) => {
        if (!s.start_time) return min;
        const [h, m] = s.start_time.split(':').map(Number);
        const t = h * 60 + m;
        return t < min ? t : min;
      }, Infinity);

      if (earliest !== Infinity && nowMin >= earliest - 15) {
        return sessId;
      }
    }

    // Step 3: Nothing started yet today — pick the first today session
    return todaySessions[0].id;
  }, [sessionLabels, segments, currentTime]);

  // Auto-select session: use auto-detection unless user manually overrode.
  // Always set on first load and when auto-detected changes (if no manual override).
  useEffect(() => {
    if (sessionLabels.length === 0) return;
    if (!autoDetectedSession) return;

    if (!selectedSession || !userOverrodeSession) {
      setSelectedSession(autoDetectedSession);
    }
  }, [sessionLabels, autoDetectedSession, userOverrodeSession]);

  // Reset override when context changes (different service/event loaded)
  useEffect(() => {
    setUserOverrodeSession(false);
    setSelectedSession(null);
  }, [contextId]);

  // Manual session change handler
  const handleSessionChange = React.useCallback((sessId) => {
    setSelectedSession(sessId);
    setUserOverrodeSession(true);
  }, []);

  // Real-time subscriptions are now handled inside useActiveProgramCache.
  // No need for manual subscriptions here — the cache hook subscribes to
  // ActiveProgramCache, LiveTimeAdjustment, Segment, and Session changes.

  // Session date for timeline (used for "is today" checks)
  const sessionDate = useMemo(() => {
    if (contextType === 'service') return service?.date || '';
    if (contextType === 'event' && segments.length > 0 && selectedSession) {
      const seg = segments.find(s => s._sessionId === selectedSession);
      return seg?._sessionDate || '';
    }
    return '';
  }, [contextType, service, segments, selectedSession]);

  // Is today check for status bar
  const isToday = useMemo(() => {
    if (!sessionDate) return false;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    return sessionDate === todayStr;
  }, [sessionDate]);

  // Filtered segments for the selected session (for status bar)
  const sessionSegments = useMemo(() => {
    if (sessionLabels.length <= 1) return segments;
    return segments.filter(s => s._sessionId === selectedSession);
  }, [segments, selectedSession, sessionLabels]);

  // Scroll to a segment by id
  const handleScrollToSegment = React.useCallback((seg) => {
    const el = segmentRefs.current[seg.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Gradient style for brand header
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  if (isLoading) {
    return <LoadingSpinner size="fullPage" label={t('myprogram.loading')} />;
  }

  if (!contextId) {
    return (
      <div className="min-h-screen bg-[#F0F1F3]">
        <div style={gradientStyle} className="py-2 px-4">
          <span className="text-white font-bold text-sm">{t('myprogram.title')}</span>
        </div>
        <MyProgramStandby />
      </div>
    );
  }

  const contextName = event?.name || service?.name || '';
  const contextDate = event?.start_date || service?.date || '';
  const contextTheme = event?.theme || '';

  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      {/* Header — thin bar: name + date + profile link for MyProgram-only users */}
       <div style={gradientStyle} className="py-2 px-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm truncate">{contextName}</span>
            {_isOverride && (
              <span className="text-orange-300 text-[10px] font-semibold">🧪 TEST MODE</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-xs whitespace-nowrap">{contextDate ? formatDateET(contextDate) : ''}</span>
            <Link
              to={createPageUrl('Profile')}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors no-select"
              title={t('nav.profile')}
            >
              <User className="w-4 h-4 text-white" />
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Controls */}
      <div className="sticky top-0 z-40 bg-[#F0F1F3]/95 backdrop-blur-sm border-b border-white/20 shadow-sm transition-all">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2.5">
          {/* Department Picker */}
          <DepartmentPicker value={department} onChange={setDepartment} />

          {/* Session Picker (events with multiple sessions, or services with time slots) */}
          <SessionPicker
            sessions={sessionLabels}
            value={selectedSession}
            onChange={handleSessionChange}
            currentTime={currentTime}
          />

          {/* Now / Next status bar */}
          <MyProgramStatusBar
            segments={sessionSegments}
            currentTime={currentTime}
            isToday={isToday}
            onScrollTo={handleScrollToSegment}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <MyProgramTimeline
          segments={segments}
          sessionFilter={sessionLabels.length > 1 ? selectedSession : null}
          department={department}
          currentTime={currentTime}
          sessionDate={sessionDate}
          preSessionDetails={programData?.preSessionDetails}
          preServiceNotes={contextType === 'service' ? (programData?.program?.pre_service_notes || null) : null}
          selectedSession={selectedSession}
          onOpenVerses={setVerseModalData}
          segmentRefs={segmentRefs}
        />
      </div>

      {/* Verses & Key Points Modal */}
      {verseModalData && (
        <StructuredVersesModal
          open={!!verseModalData}
          onOpenChange={(open) => { if (!open) setVerseModalData(null); }}
          parsedData={verseModalData.parsedData}
          rawText={verseModalData.rawText}
          presentationUrl={verseModalData.presentationUrl}
          notesUrl={verseModalData.notesUrl}
          isSlidesOnly={verseModalData.isSlidesOnly}
        />
      )}
    </div>
  );
}