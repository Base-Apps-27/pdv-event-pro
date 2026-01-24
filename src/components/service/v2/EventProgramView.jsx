import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, List, ListChecks } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import PublicProgramSegment from '@/components/service/PublicProgramSegment';
import LiveStatusCard from '@/components/service/LiveStatusCard';
import { normalizeName } from '@/components/utils/textNormalization';

/**
 * EventProgramView - Complete event display with filters and view modes
 * 
 * Features:
 * - View mode toggle (Simple/Run of Show)
 * - Session filter dropdown
 * - Live status card
 * - Session-based rendering
 * - Team info display
 */
export default function EventProgramView({
  selectedEvent,
  sessions = [],
  allSegments = [],
  currentTime,
  onOpenVerses
}) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('simple');
  const [selectedSessionId, setSelectedSessionId] = useState('all');
  const [expandedSegments, setExpandedSegments] = useState({});

  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  const filteredSessions = selectedSessionId === 'all' 
    ? sessions 
    : sessions.filter(s => s.id === selectedSessionId);

  const isSegmentCurrent = (segment) => {
    if (!segment?.start_time || !segment?.end_time) return false;
    const now = currentTime;
    const [startH, startM] = segment.start_time.split(':').map(Number);
    const [endH, endM] = segment.end_time.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startH, startM, 0);
    const end = new Date(now);
    end.setHours(endH, endM, 0);
    return now >= start && now <= end;
  };

  const isSegmentUpcoming = (segment, sessionSegments) => {
    if (!segment?.start_time) return false;
    const now = currentTime;
    const futureSegs = sessionSegments.filter(s => {
      if (!s.start_time) return false;
      const [h, m] = s.start_time.split(':').map(Number);
      const t = new Date(now);
      t.setHours(h, m, 0);
      return t > now;
    }).sort((a, b) => {
      const [aH, aM] = a.start_time.split(':').map(Number);
      const [bH, bM] = b.start_time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });
    if (futureSegs.length === 0 || futureSegs[0].id !== segment.id) return false;
    const [h, m] = segment.start_time.split(':').map(Number);
    const t = new Date(now);
    t.setHours(h, m, 0);
    const minUntil = (t - now) / 1000 / 60;
    return minUntil > 0 && minUntil <= 15;
  };

  const toggleSegmentExpanded = (segmentId) => {
    setExpandedSegments(prev => ({ ...prev, [segmentId]: !prev[segmentId] }));
  };

  if (!selectedEvent || sessions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-500">{t('liveView.noSessions') || 'No hay sesiones disponibles'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Mode and Filters */}
      <Card className="bg-white border-2 border-gray-300">
        <CardHeader className="bg-gray-100 border-b-2 border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{ color: '#1F8A70' }} />
              <h3 className="text-lg font-bold uppercase text-gray-900">
                {t('liveView.viewAndFilters') || 'Vista y Filtros'}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('simple')}
                className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                style={viewMode === 'simple' ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
              >
                <List className="w-4 h-4" />
                Simple
              </button>
              <button
                onClick={() => setViewMode('full')}
                className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                style={viewMode === 'full' ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
              >
                <ListChecks className="w-4 h-4" />
                Run of Show
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">
              {t('liveView.filterBySession') || 'Filtrar por Sesión'}
            </label>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="bg-white border-2 border-gray-400 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all">{t('liveView.allSessions') || 'Todas las Sesiones'}</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Live Status Card */}
      <LiveStatusCard
        segments={allSegments}
        currentTime={currentTime}
        serviceDate={selectedEvent.start_date}
      />

      {/* Sessions */}
      {filteredSessions.map((session) => {
        const sessionSegments = getSessionSegments(session.id);
        if (sessionSegments.length === 0) return null;

        return (
          <Card key={session.id} className="bg-white border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 border-b">
              <CardTitle className="text-2xl font-bold uppercase text-gray-900">{session.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                {session.date && <span>{session.date}</span>}
                {session.planned_start_time && (
                  <>
                    <span>•</span>
                    <span>{session.planned_start_time}</span>
                  </>
                )}
                {session.location && (
                  <>
                    <span>•</span>
                    <span>{session.location}</span>
                  </>
                )}
              </div>
              {/* Team Info */}
              {(session.coordinators || session.ushers_team || session.sound_team || session.tech_team) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                  {session.coordinators && (
                    <span><strong>👤 Coord:</strong> {normalizeName(String(session.coordinators))}</span>
                  )}
                  {session.ushers_team && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🚪 Ujieres:</strong> {normalizeName(String(session.ushers_team))}</span>
                    </>
                  )}
                  {session.sound_team && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🔊 Sonido:</strong> {normalizeName(String(session.sound_team))}</span>
                    </>
                  )}
                  {session.tech_team && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>💡 Tech:</strong> {normalizeName(String(session.tech_team))}</span>
                    </>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {sessionSegments.map((segment) => (
                  <PublicProgramSegment
                    key={segment.id}
                    segment={segment}
                    isCurrent={isSegmentCurrent(segment)}
                    isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, sessionSegments)}
                    viewMode={viewMode}
                    isExpanded={expandedSegments[segment.id]}
                    alwaysExpanded={false}
                    onToggleExpand={toggleSegmentExpanded}
                    onOpenVerses={onOpenVerses}
                    allSegments={sessionSegments}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}