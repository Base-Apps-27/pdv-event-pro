import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Filter, List, ListChecks, ChevronUp, ChevronDown, Languages, Mic, MapPin } from "lucide-react";
import LiveStatusCard from "@/components/service/LiveStatusCard";
import LiveAdminControls from "@/components/service/LiveAdminControls";
import PublicProgramSegment from "@/components/service/PublicProgramSegment";
import { formatTimeToEST, formatDateET } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { hasPermission } from "@/components/utils/permissions";

/**
 * EventProgramView Component
 * 
 * Dedicated component for rendering the 'Event' view in PublicProgramView.
 * Handles session filtering, view mode toggling (simple/full), and segment expansion.
 * 
 * CRITICAL BEHAVIOR:
 * - Events allow toggling between "simple" and "full" view modes
 * - In "simple" mode, users can manually expand/collapse individual segments
 * - In "full" mode (Run of Show), all details are always visible
 * - Admin users can see LiveAdminControls for managing live timing
 * 
 * @param {Object} selectedEvent - The currently selected event
 * @param {Array} eventSessions - All sessions for the selected event
 * @param {Array} allSegments - All segments across all sessions
 * @param {Object} currentUser - Current authenticated user (for permission checks)
 * @param {Date} currentTime - Current time for live status calculations
 * @param {Function} isSegmentCurrent - Helper to determine if segment is currently active
 * @param {Function} isSegmentUpcoming - Helper to determine if segment is upcoming
 * @param {Function} onOpenVerses - Handler for opening verses modal
 * @param {Function} scrollToSegment - Handler for scrolling to a specific segment
 * @param {Function} refetchData - Handler to refresh sessions and segments data
 * @param {Function} getRoomName - Helper to get room name by ID
 */
export default function EventProgramView({
  selectedEvent,
  eventSessions,
  allSegments,
  currentUser,
  currentTime,
  isSegmentCurrent,
  isSegmentUpcoming,
  onOpenVerses,
  scrollToSegment,
  refetchData,
  getRoomName
}) {
  // Event-specific state
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [viewMode, setViewMode] = useState("simple"); // "simple" or "full"
  const [expandedSegments, setExpandedSegments] = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});

  // Fetch live adjustments for event sessions
  const { data: liveAdjustments = [] } = useQuery({
    queryKey: ['eventLiveAdjustments', selectedEvent?.id, eventSessions.length > 0 ? eventSessions[0]?.date : null],
    queryFn: async () => {
      if (!selectedEvent?.id || eventSessions.length === 0) return [];
      const firstSessionDate = eventSessions[0]?.date;
      if (!firstSessionDate) return [];
      return await base44.entities.LiveTimeAdjustment.filter({
        event_id: selectedEvent.id,
        date: firstSessionDate,
        adjustment_type: 'session'
      });
    },
    enabled: !!(selectedEvent?.id && eventSessions.length > 0),
    refetchInterval: 3000
  });

  // Session color classes for visual distinction
  const sessionColorClasses = {
    green: 'border-l-4 border-pdv-green',
    blue: 'border-l-4 border-blue-500',
    pink: 'border-l-4 border-pink-500',
    orange: 'border-l-4 border-orange-500',
    yellow: 'border-l-4 border-yellow-400',
    purple: 'border-l-4 border-purple-500',
    red: 'border-l-4 border-red-500',
  };

  // Filter sessions based on selection
  const filteredSessions = selectedSessionId === "all" 
    ? eventSessions 
    : eventSessions.filter(s => s.id === selectedSessionId);

  // Get segments for a specific session
  const getSessionSegments = (sessionId) => {
    return allSegments.filter(seg => seg.session_id === sessionId);
  };

  // Toggle segment expansion
  const toggleSegmentExpanded = (segmentId) => {
    setExpandedSegments(prev => ({
      ...prev,
      [segmentId]: !prev[segmentId]
    }));
  };

  // Toggle session expansion
  const toggleSessionExpanded = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  // If no sessions, show empty state
  if (filteredSessions.length === 0) {
    return (
      <Card className="p-12 text-center bg-white border-2 border-gray-300">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No hay sesiones disponibles para este evento</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Admin Controls (for admin users only) */}
      {hasPermission(currentUser, 'manage_live_timing') && filteredSessions.length > 0 && (
        <LiveAdminControls 
          session={filteredSessions[0]} // Use first session for controls
          currentSegment={(() => {
            const sessionSegments = getSessionSegments(filteredSessions[0].id);
            const effectiveSegments = sessionSegments.map(s => {
              if (filteredSessions[0].live_adjustment_enabled && s.is_live_adjusted) {
                return { ...s, start_time: s.actual_start_time || s.start_time, end_time: s.actual_end_time || s.end_time };
              }
              return s;
            });
            const getTimeDate = (timeStr) => {
              if (!timeStr) return null;
              const [hours, mins] = timeStr.split(':').map(Number);
              const date = new Date(currentTime);
              date.setHours(hours, mins, 0, 0);
              return date;
            };
            return effectiveSegments.find(s => {
              const start = getTimeDate(s.start_time);
              const end = getTimeDate(s.end_time);
              return start && end && currentTime >= start && currentTime <= end;
            });
          })()}
          nextSegment={(() => {
            const sessionSegments = getSessionSegments(filteredSessions[0].id);
            const effectiveSegments = sessionSegments.map(s => {
              if (filteredSessions[0].live_adjustment_enabled && s.is_live_adjusted) {
                return { ...s, start_time: s.actual_start_time || s.start_time, end_time: s.actual_end_time || s.end_time };
              }
              return s;
            });
            const getTimeDate = (timeStr) => {
              if (!timeStr) return null;
              const [hours, mins] = timeStr.split(':').map(Number);
              const date = new Date(currentTime);
              date.setHours(hours, mins, 0, 0);
              return date;
            };
            return effectiveSegments.find(s => {
              const start = getTimeDate(s.start_time);
              return start && start > currentTime;
            });
          })()}
          refetchData={refetchData}
        />
      )}

      {/* Live Status Card - with date awareness */}
      <LiveStatusCard 
        segments={allSegments.map(seg => {
          // Augment segments with their session date for accurate live status
          const session = eventSessions.find(s => s.id === seg.session_id);
          return { ...seg, date: session?.date };
        })} 
        currentTime={currentTime}
        onScrollTo={scrollToSegment}
        liveAdjustmentEnabled={filteredSessions[0]?.live_adjustment_enabled}
      />

      {/* View Mode and Filters Card */}
      <Card className="bg-white border-2 border-gray-300">
        <CardHeader className="bg-gray-100 border-b-2 border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{ color: '#1F8A70' }} />
              <h3 className="text-lg font-bold uppercase text-gray-900">Vista y Filtros</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("simple")}
                className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                style={viewMode === "simple" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
              >
                <List className="w-4 h-4" />
                Simple
              </button>
              <button
                onClick={() => setViewMode("full")}
                className="px-3 py-1.5 text-sm rounded-lg font-semibold flex items-center gap-2"
                style={viewMode === "full" ? { backgroundColor: '#1F8A70', color: '#ffffff' } : { backgroundColor: '#ffffff', border: '2px solid #9ca3af', color: '#111827' }}
              >
                <ListChecks className="w-4 h-4" />
                Run of Show
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Filtrar por Sesión</label>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="bg-white border-2 border-gray-400 text-gray-900">
                <SelectValue className="text-gray-900" />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all" className="text-gray-900">Todas las Sesiones</SelectItem>
                {eventSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id} className="text-gray-900">
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Display */}
      {filteredSessions.map((session) => {
        const segments = getSessionSegments(session.id);
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className={`bg-white rounded-lg border-2 border-gray-300 overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
            {/* Session Header */}
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 border-b">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {(() => {
                    const sessionAdj = liveAdjustments.find(a => a.session_id === session.id);
                    if (sessionAdj && sessionAdj.offset_minutes !== 0) {
                      const adjustedTime = (() => {
                        const [h, m] = (session.planned_start_time || "09:00").split(':').map(Number);
                        const date = new Date();
                        date.setHours(h, m + sessionAdj.offset_minutes, 0, 0);
                        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                      })();
                      return (
                        <h3 className="text-2xl font-bold uppercase mb-1 text-gray-900">
                          {session.name} <span className="text-amber-600">(inicio: {adjustedTime})</span>
                        </h3>
                      );
                    }
                    return <h3 className="text-2xl font-bold uppercase mb-1 text-gray-900">{session.name}</h3>;
                  })()}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    {session.date && <span>{session.date}</span>}
                    {session.planned_start_time && (
                      <>
                        <span>•</span>
                        <span>{formatTimeToEST(session.planned_start_time)}</span>
                      </>
                    )}
                    {session.location && (
                      <>
                        <span>•</span>
                        <span>{session.location}</span>
                      </>
                    )}
                  </div>
                  {/* Team Info - Compact */}
                  {(session.coordinators || session.ushers_team || session.sound_team || session.tech_team) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                      {session.coordinators && (
                        <span><strong>👤 Coord:</strong> {normalizeName(session.coordinators)}</span>
                      )}
                      {session.ushers_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>🚪 Ujieres:</strong> {normalizeName(session.ushers_team)}</span>
                        </>
                      )}
                      {session.sound_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>🔊 Sonido:</strong> {normalizeName(session.sound_team)}</span>
                        </>
                      )}
                      {session.tech_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>💡 Tech:</strong> {normalizeName(session.tech_team)}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Expanded Session Details */}
                  {expandedSessions[session.id] && (
                    <div className="mt-3 pt-3 border-t border-gray-300 space-y-2 text-sm">
                      {session.notes && (
                        <p><strong>Notas:</strong> {session.notes}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <p><strong>Segmentos:</strong> {segments.length}</p>
                        <p><strong>Duración:</strong> {session.planned_start_time && session.planned_end_time ? 
                          `${formatTimeToEST(session.planned_start_time)} - ${formatTimeToEST(session.planned_end_time)}` : 
                          'Por definir'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSessionExpanded(session.id)}
                  className="ml-2"
                >
                  {expandedSessions[session.id] ? 
                    <ChevronUp className="w-5 h-5" /> : 
                    <ChevronDown className="w-5 h-5" />
                  }
                </Button>
              </div>
            </div>

            {/* Segments */}
            <div className="divide-y divide-gray-200">
              {segments.map((segment) => {
                // Handle Breakout segments separately
                if (segment.segment_type === "Breakout" && segment.breakout_rooms) {
                  return (
                    <div key={segment.id} className="p-4 bg-amber-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5" /> {/* Spacer for alignment */}
                          <div>
                            <span className="font-bold text-lg">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</span>
                            {segment.end_time && (
                              <span className="text-gray-600 ml-2">- {formatTimeToEST(segment.end_time)}</span>
                            )}
                            {segment.duration_min && (
                              <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-amber-600 text-white">Sesiones Paralelas</Badge>
                      </div>

                      <h4 className="text-xl font-bold mb-3">{segment.title}</h4>

                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {segment.breakout_rooms.map((room, roomIdx) => (
                          <Card key={roomIdx} className="bg-white border-2 border-gray-300">
                            <CardContent className="p-4">
                              {room.room_id && (
                                <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-800">
                                  {getRoomName(room.room_id)}
                                </Badge>
                              )}
                              <h5 className="font-bold mb-2 text-gray-900">{room.topic || `Sala ${roomIdx + 1}`}</h5>
                              {room.hosts && (
                                <p className="text-sm text-indigo-600 mb-1">
                                  <span className="font-semibold">Anfitrión:</span> {room.hosts}
                                </p>
                              )}
                              {room.speakers && (
                                <p className="text-sm text-blue-600 mb-2">
                                  <span className="font-semibold">Presentador:</span> {room.speakers}
                                </p>
                              )}
                              {room.requires_translation && (
                                <div className="flex items-center gap-1 text-sm text-purple-700">
                                  <Languages className="w-4 h-4" />
                                  {room.translation_mode === "InPerson" && <Mic className="w-4 h-4" />}
                                  {room.translator_name && <span>{room.translator_name}</span>}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Regular segment rendering
                return (
                  <PublicProgramSegment
                    key={segment.id}
                    segment={segment}
                    isCurrent={isSegmentCurrent(segment)}
                    isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, allSegments)}
                    viewMode={viewMode}
                    isExpanded={expandedSegments[segment.id]}
                    alwaysExpanded={false} // CRITICAL: Events allow toggling, not always expanded
                    onToggleExpand={toggleSegmentExpanded}
                    onOpenVerses={onOpenVerses}
                    allSegments={allSegments}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}