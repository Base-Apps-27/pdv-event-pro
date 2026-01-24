import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import { applyLiveAdjustments } from '@/components/utils/liveAdjustmentHelpers';
import PublicProgramSegment from '@/components/service/PublicProgramSegment';
import LiveStatusCard from '@/components/service/LiveStatusCard';

/**
 * Event Program View V2
 * Supports session filtering, view modes, and live adjustments
 */
export default function EventProgramView({ 
  eventData,
  sessions,
  segments,
  liveAdjustments,
  currentTime 
}) {
  const { t } = useLanguage();
  const [selectedSessionId, setSelectedSessionId] = useState('all');
  const [viewMode, setViewMode] = useState('simple'); // "simple" | "full"
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  // Group segments by session
  const sessionGroups = useMemo(() => {
    const groups = {};
    segments.forEach(seg => {
      const sessionId = seg.session_id || 'unknown';
      if (!groups[sessionId]) {
        groups[sessionId] = [];
      }
      groups[sessionId].push(seg);
    });
    return groups;
  }, [segments]);

  // Filter sessions and apply live adjustments
  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    if (selectedSessionId !== 'all') {
      filtered = sessions.filter(s => s.id === selectedSessionId);
    }

    return filtered.map(session => ({
      ...session,
      segments: applyLiveAdjustments(
        sessionGroups[session.id] || [],
        liveAdjustments,
        'event',
        null,
        session.id
      )
    }));
  }, [sessions, selectedSessionId, sessionGroups, liveAdjustments]);

  // Get all segments for live status card
  const allAdjustedSegments = useMemo(() => {
    return filteredSessions.flatMap(s => s.segments);
  }, [filteredSessions]);

  // Toggle session expansion
  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Empty state
  if (!eventData || !sessions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">
          {t('liveView.noEventData') || 'No hay datos de evento disponibles'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Status Card */}
      <LiveStatusCard 
        segments={allAdjustedSegments}
        currentTime={currentTime}
        serviceDate={eventData.start_date}
        liveAdjustmentEnabled={liveAdjustments?.length > 0}
      />

      {/* Filters and View Mode */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Session Filter */}
          {sessions.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('liveView.filterBySession') || 'Filtrar por Sesión'}
              </label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('liveView.allSessions') || 'Todas las sesiones'}</SelectItem>
                  {sessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'simple' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('simple')}
              className="flex-1"
            >
              {t('liveView.simpleView') || 'Vista Simple'}
            </Button>
            <Button
              variant={viewMode === 'full' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('full')}
              className="flex-1"
            >
              {t('liveView.fullView') || 'Run of Show'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <div className="space-y-4">
        {filteredSessions.map(session => {
          const isExpanded = expandedSessions.has(session.id);
          const hasSegments = session.segments?.length > 0;

          return (
            <Card key={session.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => hasSegments && toggleSession(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{session.name}</CardTitle>
                    {session.planned_start_time && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {session.planned_start_time}
                        {session.planned_end_time && ` - ${session.planned_end_time}`}
                      </p>
                    )}
                  </div>
                  {hasSegments && (
                    isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && hasSegments && (
                <CardContent className="space-y-3">
                  {session.segments.map((segment, idx) => (
                    <PublicProgramSegment
                      key={segment.id || idx}
                      segment={segment}
                      isCurrent={false}
                      isUpcoming={false}
                      viewMode={viewMode}
                      alwaysExpanded={viewMode === 'full'}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}