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
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/utils/i18n';
import { useCurrentUser } from '@/components/utils/useCurrentUser';
import { useClockTick } from '@/components/utils/useClockTick';
import { Loader2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateET } from '@/components/utils/timeFormat';

import useSessionDetector from '@/components/myprogram/useSessionDetector';
import { normalizeEventSegments, normalizeServiceSegments, getSessionLabels } from '@/components/myprogram/normalizeSession';
import DepartmentPicker, { useDepartment } from '@/components/myprogram/DepartmentPicker';
import SessionPicker from '@/components/myprogram/SessionPicker';
import MyProgramTimeline from '@/components/myprogram/MyProgramTimeline';
import MyProgramStandby from '@/components/myprogram/MyProgramStandby';
import StructuredVersesModal from '@/components/service/StructuredVersesModal';

export default function MyProgram() {
  const { t, language } = useLanguage();
  const { user } = useCurrentUser();
  const currentTime = useClockTick(1000);
  const queryClient = useQueryClient();

  const [department, setDepartment] = useDepartment();
  const [selectedSession, setSelectedSession] = useState(null);
  const [verseModalData, setVerseModalData] = useState(null);

  const { contextType, contextId, event, service, programData, isLoading } = useSessionDetector();

  // Normalize segments based on context type
  const segments = useMemo(() => {
    if (!programData) return [];
    if (contextType === 'event') {
      return normalizeEventSegments(programData);
    }
    if (contextType === 'service') {
      return normalizeServiceSegments(programData.program || programData);
    }
    return [];
  }, [programData, contextType]);

  // Session labels for picker
  const sessionLabels = useMemo(() => getSessionLabels(segments), [segments]);

  // Auto-select first session if none selected
  useEffect(() => {
    if (sessionLabels.length > 0 && !selectedSession) {
      setSelectedSession(sessionLabels[0].id);
    }
  }, [sessionLabels, selectedSession]);

  // Real-time subscriptions for instant updates
  useEffect(() => {
    if (!user || !contextId) return;

    const unsubs = [];

    unsubs.push(base44.entities.Segment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['myprogram-programData'] });
    }));
    unsubs.push(base44.entities.Session.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['myprogram-programData'] });
    }));

    if (contextType === 'service') {
      unsubs.push(base44.entities.Service.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['myprogram-programData'] });
        queryClient.invalidateQueries({ queryKey: ['myprogram-selectorOptions'] });
      }));
    }
    if (contextType === 'event') {
      unsubs.push(base44.entities.Event.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['myprogram-selectorOptions'] });
        queryClient.invalidateQueries({ queryKey: ['myprogram-programData'] });
      }));
    }

    return () => unsubs.forEach(u => typeof u === 'function' && u());
  }, [user, contextId, contextType, queryClient]);

  // Session date for timeline (used for "is today" checks)
  const sessionDate = useMemo(() => {
    if (contextType === 'service') return service?.date || '';
    if (contextType === 'event' && segments.length > 0 && selectedSession) {
      const seg = segments.find(s => s._sessionId === selectedSession);
      return seg?._sessionDate || '';
    }
    return '';
  }, [contextType, service, segments, selectedSession]);

  // Gradient style for brand header
  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1F8A70]" />
          <p className="text-gray-500 text-sm">{t('myprogram.loading')}</p>
        </div>
      </div>
    );
  }

  if (!contextId) {
    return (
      <div className="min-h-screen bg-[#F0F1F3]">
        <div style={gradientStyle} className="py-4 px-4">
          <h1 className="text-2xl text-white uppercase tracking-wide text-center">{t('myprogram.title')}</h1>
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
      {/* Header — thin bar: name + date */}
      <div style={gradientStyle} className="py-2 px-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-sm truncate">{contextName}</span>
          <span className="text-white/80 text-xs whitespace-nowrap ml-3">{contextDate ? formatDateET(contextDate) : ''}</span>
        </div>
      </div>

      {/* Sticky Controls */}
      <div className="sticky top-0 z-40 bg-[#F0F1F3]/95 backdrop-blur-sm border-b border-white/20 shadow-sm transition-all">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Department Picker */}
          <DepartmentPicker value={department} onChange={setDepartment} />

          {/* Session Picker (events with multiple sessions) */}
          <SessionPicker
            sessions={sessionLabels}
            value={selectedSession}
            onChange={setSelectedSession}
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
          preSessionDetails={programData?.preSessionDetails} // Pass pre-session details
          onOpenVerses={setVerseModalData} // Pass handler
        />
      </div>

      {/* Verses Modal */}
      {verseModalData && (
        <StructuredVersesModal
          isOpen={!!verseModalData}
          onClose={() => setVerseModalData(null)}
          verseData={verseModalData.parsedData}
          rawText={verseModalData.rawText}
        />
      )}
    </div>
  );
}