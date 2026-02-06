import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Filter, List, ListChecks, ChevronUp, ChevronDown, Languages, Mic, MapPin, Utensils, Music, Monitor } from "lucide-react";
import HospitalityTasksViewModal from "@/components/service/HospitalityTasksViewModal";
import LiveStatusCard from "@/components/service/LiveStatusCard";
import StickyOpsDeck from "@/components/service/StickyOpsDeck";
// LiveDirectorPanel shelved - preserved for future iteration
// import LiveDirectorPanel from "@/components/service/LiveDirectorPanel";
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
 * @param {Array} preSessionDetails - PreSession details for sessions (new)
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
  preSessionDetails = [],
  currentUser,
  currentTime,
  isSegmentCurrent,
  isSegmentUpcoming,
  onOpenVerses,
  scrollToSegment,
  refetchData,
  getRoomName,
  onOpenVerseParser,
  // Chat integration props
  onToggleChat,
  chatUnreadCount = 0,
  chatOpen = false,
  // PERMISSION-GATED: When true, StickyOpsDeck is hidden entirely
  hideOpsDeck = false
}) {
  // Event-specific state
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [viewMode, setViewMode] = useState("simple"); // "simple" or "full"
  const [expandedSegments, setExpandedSegments] = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});
  const [hospitalityModalSessionId, setHospitalityModalSessionId] = useState(null);

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

  // Session color classes for visual distinction - full border matches session color
  const sessionColorClasses = {
    green: 'border-2 border-green-500',
    blue: 'border-2 border-blue-500',
    pink: 'border-2 border-pink-500',
    orange: 'border-2 border-orange-500',
    yellow: 'border-2 border-yellow-400',
    purple: 'border-2 border-purple-500',
    red: 'border-2 border-red-500',
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
      {/* Live Director Panel - SHELVED for future iteration
         Reasons: blocking not working reliably, any user can change at any time, 
         feature is cumbersome and rarely needed in current form.
         Component preserved at: components/service/LiveDirectorPanel.jsx
      */}

      {/* Sticky Ops Deck - Persistent Bottom Bar */}
      <StickyOpsDeck 
        segments={allSegments.map(seg => {
          const session = eventSessions.find(s => s.id === seg.session_id);
          return { ...seg, date: session?.date };
        })}
        preSessionData={preSessionDetails.find(p => p.session_id === filteredSessions[0]?.id)}
        sessionDate={filteredSessions[0]?.date}
        currentTime={currentTime}
        onScrollToSegment={scrollToSegment}
        // Pass chat control props
        onToggleChat={onToggleChat}
        chatUnreadCount={chatUnreadCount}
        chatOpen={chatOpen}
      />

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

      {/* Compact Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-gray-100 p-2 rounded-xl border border-gray-200">
        <div className="flex-1 w-full sm:w-auto">
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900 h-9 text-sm font-medium">
              <Filter className="w-3 h-3 mr-2 text-gray-500" />
              <SelectValue placeholder="Todas las Sesiones" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todas las Sesiones</SelectItem>
              {eventSessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex bg-gray-200/50 p-1 rounded-lg shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setViewMode("simple")}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs rounded-md font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === "simple" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <List className="w-3.5 h-3.5" />
            Simple
          </button>
          <button
            onClick={() => setViewMode("full")}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs rounded-md font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === "full" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Run of Show
          </button>
        </div>
      </div>

      {/* Sessions Display */}
      {filteredSessions.map((session) => {
        const segments = getSessionSegments(session.id);
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className={`bg-white rounded-lg overflow-hidden ${sessionColorClasses[session.session_color] || 'border-2 border-gray-300'}`}>
            {/* Session Header */}
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 border-b">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* PreSession Info Card - Segment 0 */}
                  {(() => {
                    const preDetails = preSessionDetails.find(p => p.session_id === session.id);
                    if (!preDetails) return null;
                    return (
                      <div className="mb-4 bg-teal-50 border-l-4 border-teal-500 rounded-r-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-teal-600 text-white text-xs font-bold px-2 py-0.5 rounded">PRE-SESSION</span>
                          <span className="text-sm font-semibold text-teal-900">Detalles Previos</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
                          {preDetails.registration_desk_open_time && (
                            <div className="flex items-center gap-2 text-teal-800">
                              <Calendar className="w-3 h-3" />
                              <span><strong>Registro:</strong> {formatTimeToEST(preDetails.registration_desk_open_time)}</span>
                            </div>
                          )}
                          {preDetails.library_open_time && (
                            <div className="flex items-center gap-2 text-teal-800">
                              <Calendar className="w-3 h-3" />
                              <span><strong>Librería:</strong> {formatTimeToEST(preDetails.library_open_time)}</span>
                            </div>
                          )}
                          {preDetails.music_profile_id && (
                            <div className="flex items-center gap-2 text-teal-800">
                              <Music className="w-3 h-3" />
                              <span><strong>Música:</strong> {preDetails.music_profile_id}</span>
                            </div>
                          )}
                          {preDetails.slide_pack_id && (
                            <div className="flex items-center gap-2 text-teal-800">
                              <Monitor className="w-3 h-3" />
                              <span><strong>Slides:</strong> {preDetails.slide_pack_id}</span>
                            </div>
                          )}
                        </div>
                        {(preDetails.facility_notes || preDetails.general_notes) && (
                          <div className="mt-2 pt-2 border-t border-teal-200 text-xs text-teal-900">
                            {preDetails.facility_notes && <p><strong>Facility:</strong> {preDetails.facility_notes}</p>}
                            {preDetails.general_notes && <p className="mt-1"><strong>Notas:</strong> {preDetails.general_notes}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-3 mb-1">
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
                          <h3 className="text-2xl font-bold uppercase text-gray-900">
                            {session.name} <span className="text-amber-600">(inicio: {adjustedTime})</span>
                          </h3>
                        );
                      }
                      return <h3 className="text-2xl font-bold uppercase text-gray-900">{session.name}</h3>;
                    })()}
                    {/* Hospitality Icon - Prominent rounded rectangle button */}
                    <button
                      onClick={() => setHospitalityModalSessionId(session.id)}
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink-100 hover:bg-pink-200 border-2 border-pink-300 transition-colors"
                      title="Ver Tareas de Hospitalidad"
                    >
                      <Utensils className="w-5 h-5 text-pink-600" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    {session.date && <span>{formatDateET(session.date)}</span>}
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
                  {/* Bilingual Session Indicator (text only) */}
                  {session.is_translated_session && (
                    <div className="flex items-center gap-1 text-purple-600 text-sm font-semibold mt-1">
                      <Languages className="w-4 h-4" />
                      <span>Sesión Bilingüe</span>
                    </div>
                  )}

                  {/* Stage Call Offset */}
                  {session.default_stage_call_offset_min && (
                    <div className="text-xs text-blue-700 font-semibold mt-1">
                      ⏱️ Citación de Equipos: {session.default_stage_call_offset_min} min antes
                    </div>
                  )}

                  {/* Session Presenter */}
                  {session.presenter && (
                    <div className="text-sm text-indigo-700 font-semibold mt-1">
                      <strong>Presentador de Sesión:</strong> {normalizeName(session.presenter)}
                    </div>
                  )}

                  {/* Team Info - Compact */}
                  {(session.coordinators || session.ushers_team || session.sound_team || session.lights_team || session.video_team || session.tech_team || session.admin_team || session.translation_team || session.photography_team || session.worship_leader) && (
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
                      {session.lights_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>💡 Luces:</strong> {normalizeName(session.lights_team)}</span>
                        </>
                      )}
                      {session.video_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>🎥 Video:</strong> {normalizeName(session.video_team)}</span>
                        </>
                      )}
                      {session.tech_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>🔧 Tech:</strong> {normalizeName(session.tech_team)}</span>
                        </>
                      )}
                      {session.admin_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>ADMIN:</strong> {normalizeName(session.admin_team)}</span>
                        </>
                      )}
                      {session.translation_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>TRAD:</strong> {normalizeName(session.translation_team)}</span>
                        </>
                      )}
                      {session.photography_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>FOTO:</strong> {normalizeName(session.photography_team)}</span>
                        </>
                      )}
                      {session.worship_leader && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>ALABANZA:</strong> {normalizeName(session.worship_leader)}</span>
                        </>
                      )}
                      {session.hospitality_team && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span><strong>🍽️ HOSP:</strong> {normalizeName(session.hospitality_team)}</span>
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
            <div className="space-y-0"> {/* Removed divide-y to allow segment-level styling */}
              {segments.map((segment) => {
                // Handle Breakout segments separately
                if (segment.segment_type === "Breakout" && segment.breakout_rooms) {
                  return (
                    <div key={segment.id} className="p-4 bg-amber-50 print:p-2">
                      <div className="flex items-center justify-between mb-3 print:mb-1">
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

                      {/* Breakout-level description_details */}
                      {segment.description_details && (
                        <div className="bg-gray-100 border-l-4 border-gray-500 p-2 mb-3 rounded-r">
                          <p className="text-xs text-gray-900 font-medium">
                            <strong>📝 Descripción:</strong> {segment.description_details}
                          </p>
                        </div>
                      )}

                      {/* Breakout-level segment_actions (prep + during cues) */}
                      {segment.segment_actions && segment.segment_actions.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {segment.segment_actions.map((action, idx) => {
                            const isPrepAction = action.timing === 'before_start';
                            return (
                              <div key={idx} className={`${isPrepAction ? 'bg-amber-100 border border-amber-300' : 'bg-blue-100 border border-blue-300'} rounded px-3 py-2 text-sm`}>
                                <div className="flex items-start gap-2">
                                  <span className={`${isPrepAction ? 'bg-amber-500' : 'bg-blue-600'} text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0`}>
                                    {isPrepAction ? '⚠ PREP' : '▶ DURANTE'}
                                  </span>
                                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold ${isPrepAction ? 'text-amber-900' : 'text-blue-900'}`}>
                                      {action.department && `[${action.department}] `}
                                      {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                                    </span>
                                    {action.notes && <span className={isPrepAction ? 'text-amber-800' : 'text-blue-800'}>— {action.notes}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                        {segment.breakout_rooms.map((room, roomIdx) => (
                          <Card key={roomIdx} className="bg-white border-2 border-gray-300 print:border">
                            <CardContent className="p-4 print:p-2">
                              {room.room_id && (
                                <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-800 print:mb-1 print:text-[10px] print:h-5 print:px-1">
                                  {getRoomName(room.room_id)}
                                </Badge>
                              )}
                              <h5 className="font-bold mb-2 text-gray-900 print:text-sm print:mb-1">{room.topic || `Sala ${roomIdx + 1}`}</h5>
                              {room.hosts && (
                                <p className="text-sm text-indigo-600 mb-1 print:text-xs">
                                  <span className="font-semibold">Anfitrión:</span> {room.hosts}
                                </p>
                              )}
                              {room.speakers && (
                                <p className="text-sm text-blue-600 mb-2 print:text-xs">
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
                              {room.general_notes && (
                                <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded border">
                                  <strong>Notas:</strong> {room.general_notes}
                                </p>
                              )}
                              {room.other_notes && (
                                <p className="text-xs text-gray-500 mt-1">
                                  <strong>Otras:</strong> {room.other_notes}
                                </p>
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
                    getRoomName={getRoomName}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Hospitality Tasks View Modal (Read-Only for Live View) */}
      <HospitalityTasksViewModal
        sessionId={hospitalityModalSessionId}
        sessionName={eventSessions.find(s => s.id === hospitalityModalSessionId)?.name}
        isOpen={!!hospitalityModalSessionId}
        onClose={() => setHospitalityModalSessionId(null)}
      />
    </div>
  );
}