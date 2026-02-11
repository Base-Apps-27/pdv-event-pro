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

import DirectorHeader from '@/components/director/DirectorHeader';
import DirectorTimeline from '@/components/director/DirectorTimeline';
import DirectorHoldPanel from '@/components/director/DirectorHoldPanel';
import DirectorDriftIndicator from '@/components/director/DirectorDriftIndicator';
import DirectorPingFeed from '@/components/director/DirectorPingFeed';

/**
 * DirectorConsole - Phase 2 Core
 * 
 * Main page for Live Director mode during events.
 * Provides real-time segment timing control with hold/finalize/cascade flow.
 * 
 * URL: /DirectorConsole?sessionId=xxx
 */

export default function DirectorConsole() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  
  // Parse session ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');
  
  // Current time state (updates every second)
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // User state
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);
  
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
  
  // Sort segments by order
  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [segments]);
  
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