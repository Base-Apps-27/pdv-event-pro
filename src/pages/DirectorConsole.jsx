import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Radio, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Users,
  Zap,
  Lock,
  Unlock,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/utils/i18n';
import { hasPermission } from '@/components/utils/permissions';
import { useCurrentUser } from '@/components/utils/useCurrentUser';
import { useClockTick } from '@/components/utils/useClockTick';

import DirectorHeader from '@/components/director/DirectorHeader';
import DirectorTimeline from '@/components/director/DirectorTimeline';
import DirectorHoldPanel from '@/components/director/DirectorHoldPanel';
import DirectorDriftIndicator from '@/components/director/DirectorDriftIndicator';
import DirectorPingFeed from '@/components/director/DirectorPingFeed';
import StickyOpsDeck from '@/components/service/StickyOpsDeck';
import LiveOperationsChat from '@/components/live/LiveOperationsChat';
import { resolveBlockTime } from '@/components/utils/streamTiming';
import { resolveStreamActions } from '@/components/utils/resolveStreamActions';

/**
 * DirectorConsole - Phase 2 Core
 * 
 * Main page for Live Director mode during events.
 * Provides real-time segment timing control with hold/finalize/cascade flow.
 * 
 * URL: /DirectorConsole?sessionId=xxx
 * 
 * ============================================================================
 * ARCHITECTURE DECISION: Shared Live Ops Components (2026-02-11)
 * ============================================================================
 * 
 * This page reuses StickyOpsDeck and LiveOperationsChat from the PublicProgramView.
 * These are the SAME components used in EventProgramView and ServiceProgramView.
 * 
 * RATIONALE:
 * - Single source of truth for chat UI and ops deck behavior
 * - Directors need the same real-time chat access as coordinators in Live View
 * - Prevents drift between Director Console and Live View chat experiences
 * 
 * INTEGRATION PATTERN:
 * - StickyOpsDeck receives segments with date, preSessionData, currentTime
 * - LiveOperationsChat receives contextType="event", contextId=event_id
 * - Chat visibility state (chatOpen) is lifted to this component
 * - Both components are permission-gated via hasPermission('view_live_chat')
 * 
 * MAINTENANCE NOTE:
 * - If chat behavior changes in PublicProgramView, it automatically applies here
 * - If StickyOpsDeck adds features, they appear in both views
 * - DO NOT create Director-specific chat/ops components without explicit approval
 * 
 * See: DecisionLog entry "Shared Live Ops Components Across Views" (2026-02-11)
 * ============================================================================
 */

export default function DirectorConsole() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  
  // P2-3: Memoized URL params (2026-02-12)
  const sessionId = useMemo(() => new URLSearchParams(window.location.search).get('sessionId'), []);
  
  // P1-1: Isolated clock tick to avoid full-page re-renders (2026-02-12)
  const currentTime = useClockTick(1000);
  
  // P1-4: Consolidated user fetch (2026-02-12)
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  
  // Chat state (lifted for StickyOpsDeck + LiveOperationsChat integration)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  
  // Fetch session data
  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const sessions = await base44.entities.Session.filter({ id: sessionId });
      return sessions[0] || null;
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5 seconds for ownership changes
  });
  
  // Fetch event data (for context)
  const { data: event } = useQuery({
    queryKey: ['event', session?.event_id],
    queryFn: async () => {
      if (!session?.event_id) return null;
      const events = await base44.entities.Event.filter({ id: session.event_id });
      return events[0] || null;
    },
    enabled: !!session?.event_id,
  });
  
  // Fetch segments for this session
  const { data: segments = [], isLoading: segmentsLoading, refetch: refetchSegments } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      return base44.entities.Segment.filter({ session_id: sessionId }, 'order');
    },
    enabled: !!sessionId,
  });
  
  // Subscribe to real-time segment changes
  useEffect(() => {
    if (!sessionId) return;
    
    const unsubscribe = base44.entities.Segment.subscribe((event) => {
      if (event.data?.session_id === sessionId || segments.some(s => s.id === event.id)) {
        refetchSegments();
      }
    });
    
    return unsubscribe;
  }, [sessionId, segments, refetchSegments]);
  
  // Subscribe to real-time session changes
  useEffect(() => {
    if (!sessionId) return;
    
    const unsubscribe = base44.entities.Session.subscribe((event) => {
      if (event.id === sessionId) {
        refetchSession();
      }
    });
    
    return unsubscribe;
  }, [sessionId, refetchSession]);
  
  // FIX #1 (2026-02-14): Fetch StreamBlocks for this session so Director sees stream cues in OpsDeck
  const { data: directorStreamBlocks = [] } = useQuery({
    queryKey: ['directorStreamBlocks', sessionId],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId && !!session?.has_livestream,
    refetchInterval: 5000
  });

  // Sort segments by order
  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [segments]);

  // FIX #1 (2026-02-14): Resolve stream actions for Director's StickyOpsDeck
  const directorResolvedStreamActions = useMemo(() => {
    if (!session?.has_livestream || directorStreamBlocks.length === 0) return [];
    return resolveStreamActions(directorStreamBlocks, sortedSegments, session.date);
  }, [directorStreamBlocks, sortedSegments, session]);
  
  // Calculate cumulative drift
  const { cumulativeDrift, timeBankMin, activeSegmentIndex, heldSegment } = useMemo(() => {
    let drift = 0;
    let bank = 0;
    let activeIdx = -1;
    let held = null;
    
    for (let i = 0; i < sortedSegments.length; i++) {
      const seg = sortedSegments[i];
      
      // Find the currently active segment (has actual_start but no actual_end)
      if (seg.actual_start_time && !seg.actual_end_time) {
        activeIdx = i;
      }
      
      // Find held segment
      if (seg.live_hold_status === 'held') {
        held = seg;
      }
      
      // Calculate drift from completed segments
      if (seg.actual_end_time && seg.end_time) {
        const plannedEnd = parseTimeToMinutes(seg.end_time);
        const actualEnd = parseTimeToMinutes(seg.actual_end_time);
        if (plannedEnd !== null && actualEnd !== null) {
          const segDrift = actualEnd - plannedEnd;
          if (segDrift > 0) {
            drift += segDrift;
          } else {
            bank += Math.abs(segDrift);
          }
        }
      }
    }
    
    return { cumulativeDrift: drift, timeBankMin: bank, activeSegmentIndex: activeIdx, heldSegment: held };
  }, [sortedSegments]);
  
  // Refetch helper
  const refetchData = useCallback(() => {
    refetchSession();
    refetchSegments();
  }, [refetchSession, refetchSegments]);
  
  // Permission check
  const canManageDirector = currentUser && hasPermission(currentUser, 'manage_live_director');
  const isCurrentDirector = session?.live_director_user_id === currentUser?.id;
  const isLocked = session?.live_adjustment_enabled && session?.live_director_user_id && !isCurrentDirector;
  
  // Loading state
  if (userLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-16 bg-slate-800" />
          <Skeleton className="h-32 bg-slate-800" />
          <Skeleton className="h-64 bg-slate-800" />
        </div>
      </div>
    );
  }
  
  // No session found
  if (!sessionId || !session) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-700 text-white max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {language === 'es' ? 'Sesión no encontrada' : 'Session Not Found'}
            </h2>
            <p className="text-slate-400 mb-4">
              {language === 'es' 
                ? 'No se encontró la sesión especificada o no tienes acceso.'
                : 'The specified session was not found or you do not have access.'}
            </p>
            <Button asChild variant="outline" className="border-slate-600 text-slate-300">
              <Link to={createPageUrl('Events')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Volver a Eventos' : 'Back to Events'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // No permission
  if (!canManageDirector) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-700 text-white max-w-md">
          <CardContent className="p-6 text-center">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {language === 'es' ? 'Acceso Denegado' : 'Access Denied'}
            </h2>
            <p className="text-slate-400 mb-4">
              {language === 'es' 
                ? 'No tienes permiso para acceder al Director Console.'
                : 'You do not have permission to access the Director Console.'}
            </p>
            <Button asChild variant="outline" className="border-slate-600 text-slate-300">
              <Link to={createPageUrl('PublicProgramView')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Volver al Programa' : 'Back to Program'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <DirectorHeader
        session={session}
        event={event}
        currentUser={currentUser}
        currentTime={currentTime}
        isCurrentDirector={isCurrentDirector}
        isLocked={isLocked}
        heldSegment={heldSegment}
        onRefetch={refetchData}
        language={language}
      />
      
      {/* Director Ping Feed - Shows incoming @Director pings */}
      {session?.event_id && (
        <DirectorPingFeed
          eventId={session.event_id}
          currentUser={currentUser}
          language={language}
        />
      )}
      
      {/* Main content */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Drift Indicator */}
        <DirectorDriftIndicator
          cumulativeDrift={cumulativeDrift}
          timeBankMin={timeBankMin}
          sessionEndTime={session.planned_end_time}
          language={language}
        />
        
        {/* Hold Panel (shown when a segment is held) */}
        {heldSegment && (
          <DirectorHoldPanel
            heldSegment={heldSegment}
            sortedSegments={sortedSegments}
            session={session}
            currentTime={currentTime}
            currentUser={currentUser}
            isCurrentDirector={isCurrentDirector}
            onRefetch={refetchData}
            language={language}
          />
        )}
        
        {/* Timeline */}
        <DirectorTimeline
          segments={sortedSegments}
          session={session}
          currentTime={currentTime}
          currentUser={currentUser}
          activeSegmentIndex={activeSegmentIndex}
          isCurrentDirector={isCurrentDirector}
          isLocked={isLocked}
          heldSegment={heldSegment}
          onRefetch={refetchData}
          language={language}
        />
      </div>
      
      {/* 
       * ========================================================================
       * SHARED LIVE OPS COMPONENTS
       * ========================================================================
       * StickyOpsDeck + LiveOperationsChat are the SAME components used in:
       * - pages/PublicProgramView.js (via EventProgramView / ServiceProgramView)
       * 
       * They share the same props interface and behavior.
       * Chat is scoped to the EVENT context (not session) for continuity.
       * 
       * If you modify chat/deck behavior, test BOTH views to prevent drift.
       * ========================================================================
       */}
      
      {/* StickyOpsDeck - Coordinator Actions + Chat Toggle */}
      {/* FIX #1 (2026-02-14): Director StickyOpsDeck now receives resolved stream actions
           so directors see stream cues alongside room segment actions */}
      {hasPermission(currentUser, 'view_live_chat') && (
        <StickyOpsDeck
          segments={sortedSegments.map(seg => ({ ...seg, date: session?.date }))}
          preSessionData={null}
          sessionDate={session?.date}
          currentTime={currentTime}
          onScrollToSegment={(seg) => {
            const el = document.getElementById(`director-segment-${seg.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onToggleChat={() => setChatOpen(!chatOpen)}
          chatUnreadCount={chatUnreadCount}
          chatOpen={chatOpen}
          resolvedStreamActions={directorResolvedStreamActions}
        />
      )}
      
      {/* LiveOperationsChat - Same component as Live View */}
      {currentUser && hasPermission(currentUser, 'view_live_chat') && session?.event_id && event && (
        <LiveOperationsChat
          currentUser={currentUser}
          contextType="event"
          contextId={session.event_id}
          contextDate={event.end_date}
          contextName={event.name}
          isOpen={chatOpen}
          onToggle={setChatOpen}
          onUnreadCountChange={setChatUnreadCount}
          hideTrigger={true} // StickyOpsDeck handles the trigger
        />
      )}
    </div>
  );
}

// Helper: Parse HH:MM to minutes since midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}