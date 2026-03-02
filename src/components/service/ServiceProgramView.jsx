import React, { useMemo } from "react";
import { Calendar } from "lucide-react";
import ServiceStatusBar from "@/components/service/ServiceStatusBar";
import StickyOpsDeck from "@/components/service/StickyOpsDeck";
import PublicProgramSegment from "@/components/service/PublicProgramSegment";
import { normalizeName } from "@/components/utils/textNormalization";
import { formatTimeToEST } from "@/components/utils/timeFormat";

/**
 * ServiceProgramView Component
 * 
 * ENTITY LIFT (2026-02-18): Unified rendering for weekly and custom services.
 *
 * DATA PATHS (priority order):
 *   1. Entity-sourced: sessions[] + allSegments[] from Session/Segment entities
 *      (returned by getPublicProgramData when entities exist)
 *   2. JSON fallback: actualServiceData["9:30am"][] / .segments[]
 *      (legacy path — only used when no Session entities exist)
 *
 * CRITICAL BEHAVIOR:
 * - Services ALWAYS display all details (alwaysExpanded=true)
 * - Receso is rendered between consecutive sessions if there's a time gap
 * - Entity-sourced segments already have start_time/end_time from the sync layer
 */

// Color palette for dynamic slots — cycles through for 3+ slots
const SLOT_COLORS = [
  { border: 'border-l-red-500', bg: 'from-red-50', text: 'text-red-600' },
  { border: 'border-l-blue-500', bg: 'from-blue-50', text: 'text-blue-600' },
  { border: 'border-l-purple-500', bg: 'from-purple-50', text: 'text-purple-600' },
  { border: 'border-l-amber-500', bg: 'from-amber-50', text: 'text-amber-600' },
  { border: 'border-l-green-500', bg: 'from-green-50', text: 'text-green-600' },
];

// Parse "9:30am" → { h: 9, m: 30, display: "9:30 AM", base24: "09:30" }
function parseSlotName(name) {
  const match = name.match(/^(\d+):(\d+)(am|pm)$/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = match[2];
  const period = match[3].toUpperCase();
  const display = `${match[1]}:${m} ${period}`;
  // 24h for calculations
  let h24 = h;
  if (period === 'PM' && h < 12) h24 += 12;
  if (period === 'AM' && h === 12) h24 = 0;
  const base24 = `${String(h24).padStart(2, '0')}:${m}`;
  const totalMinutes = h24 * 60 + parseInt(m);
  return { h: h24, m: parseInt(m), display, base24, totalMinutes };
}

// Legacy TEAM_FIELDS removed

export default function ServiceProgramView({
  actualServiceData,
  allSegments = [],
  sessions = [],
  liveAdjustments = [],
  preSessionData = null,
  allPreSessionDetails = [],
  currentTime,
  isSegmentCurrent,
  isSegmentUpcoming,
  toggleSegmentExpanded,
  onOpenVerses,
  scrollToSegment,
  canAccessLiveOps = false,
  onToggleChat,
  chatUnreadCount,
  chatOpen
}) {
  const addMinutesToTime = (timeStr, minutes) => {
    if (!timeStr) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutes, 0, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════════════════════
  // ENTITY LIFT: STRICT ENTITY MODE
  // ═══════════════════════════════════════════════════════════════════
  // We now rely 100% on Session/Segment entities.
  // Legacy JSON path is removed. 
  const useEntityPath = true;

  // ── Entity-sourced: group segments by session for slot rendering ──
  const entitySessionSlots = useMemo(() => {
    // STRICT ENTITY MODE
    return sessions
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((session, idx) => {
        const segs = allSegments
          .filter(s => s.session_id === session.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        return {
          sessionId: session.id,
          name: session.name || `Session ${idx + 1}`,
          session,
          segments: segs,
          colorIdx: idx,
        };
      })
      .filter(slot => slot.segments.length > 0);
  }, [sessions, allSegments]);

  // ── Detect service type from entity data ──
  const isCustomService = useMemo(() => {
    // Entity path: check if any session name DOESN'T match time-slot pattern
    // Weekly sessions have names like "9:30am", "11:30am"
    // Custom sessions have descriptive names
    return entitySessionSlots.length > 0 &&
      entitySessionSlots.every(slot => !/^\d+:\d+[ap]m$/i.test(slot.name));
  }, [entitySessionSlots]);

  // ── JSON fallback: DISABLED ──
  const jsonSlotKeys = useMemo(() => [], []);

  // ── Apply live time adjustments ──
  const adjustedAllSegments = useMemo(() => {
    const sessionNameMap = new Map();
    if (sessions?.length > 0) {
      sessions.forEach(s => { if (s.id && s.name) sessionNameMap.set(s.id, s.name); });
    }

    // For entity path or flat allSegments list
    if (useEntityPath || allSegments.length > 0) {
      return allSegments.map(seg => {
        let offsetMinutes = 0;
        let slot = null;

        const resolvedName = sessionNameMap.get(seg.session_id);
        if (resolvedName) {
          slot = resolvedName;
        }
        // JSON-sourced synthetic session IDs (legacy compat): "slot-9-30" → "9:30am"
        else if (seg.session_id === 'slot-break') {
          slot = jsonSlotKeys[0] || null;
        } else if (seg.session_id && seg.session_id.startsWith('slot-')) {
          // Parse "slot-9-30" → "9:30am", "slot-11-30" → "11:30am", "slot-18-00" → "6:00pm"
          const parts = seg.session_id.replace('slot-', '').split('-');
          if (parts.length === 2) {
            let h = parseInt(parts[0]), m = parts[1];
            const period = h >= 12 ? 'pm' : 'am';
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            slot = `${h}:${m}${period}`;
          }
        }

        if (slot) {
          const adjustment = liveAdjustments.find(a => a.time_slot === slot);
          if (adjustment) offsetMinutes = adjustment.offset_minutes || 0;
        } else {
          // Custom service: check for global adjustment
          const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
          if (globalAdj) offsetMinutes = globalAdj.offset_minutes || 0;
        }

        if (offsetMinutes === 0) return seg;
        return {
          ...seg,
          start_time: addMinutesToTime(seg.start_time, offsetMinutes),
          end_time: addMinutesToTime(seg.end_time, offsetMinutes)
        };
      });
    }

    // JSON-only custom service fallback
    if (actualServiceData?.segments) {
      const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
      const offset = globalAdj?.offset_minutes || 0;
      if (offset === 0) return actualServiceData.segments;
      return actualServiceData.segments.map(seg => ({
        ...seg,
        start_time: addMinutesToTime(seg.start_time, offset),
        end_time: addMinutesToTime(seg.end_time, offset)
      }));
    }

    return [];
  }, [useEntityPath, allSegments, sessions, liveAdjustments, actualServiceData, jsonSlotKeys]);

  // ── Entity path: build adjusted slot data for weekly rendering ──
  const adjustedEntitySlots = useMemo(() => {
    if (isCustomService) return [];
    return entitySessionSlots.map(slot => {
      const adjustment = liveAdjustments.find(a => a.time_slot === slot.name);
      const offset = adjustment?.offset_minutes || 0;
      const adjustedSegs = offset === 0 ? slot.segments : slot.segments.map(seg => ({
        ...seg,
        start_time: addMinutesToTime(seg.start_time, offset),
        end_time: addMinutesToTime(seg.end_time, offset)
      }));
      return { ...slot, segments: adjustedSegs, adjustment };
    });
  }, [isCustomService, entitySessionSlots, liveAdjustments]);

  // ── JSON fallback: DISABLED ──
  const adjustedJsonSlots = useMemo(() => ({}), []);

  // 2026-03-01: Compute current/upcoming session's preSessionData for StickyOpsDeck.
  // Only show the notes for the session that's currently active or next up,
  // so the ops deck isn't cluttered with notes from past sessions.
  const activePreSessionData = useMemo(() => {
    if (!sessions || sessions.length === 0) return preSessionData;
    if (sessions.length === 1) {
      // Single session: always use its details
      return allPreSessionDetails.find(p => p.session_id === sessions[0].id) || preSessionData;
    }
    // Multi-session: find the session whose time range contains currentTime or is next
    const now = currentTime;
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const nowTotal = nowH * 60 + nowM;

    // Check if today is the service day
    const todayStr = now.toISOString().split('T')[0];
    const serviceDate = actualServiceData?.date;
    const isToday = !serviceDate || serviceDate === todayStr;

    if (!isToday) {
      // Preview mode: show first session's notes
      return allPreSessionDetails.find(p => p.session_id === sessions[0].id) || preSessionData;
    }

    // Find session that's currently active or upcoming
    for (const sess of sessions) {
      if (!sess.planned_start_time) continue;
      const [sh, sm] = sess.planned_start_time.split(':').map(Number);
      const endTime = sess.planned_end_time ? sess.planned_end_time.split(':').map(Number) : null;
      const startTotal = sh * 60 + sm;
      const endTotal = endTime ? endTime[0] * 60 + endTime[1] : startTotal + 120;

      // Current session: now is within its window (or up to 30min before start for prep)
      if (nowTotal >= startTotal - 30 && nowTotal <= endTotal) {
        return allPreSessionDetails.find(p => p.session_id === sess.id) || null;
      }
    }

    // No session currently active — find the next upcoming one
    for (const sess of sessions) {
      if (!sess.planned_start_time) continue;
      const [sh, sm] = sess.planned_start_time.split(':').map(Number);
      if (sh * 60 + sm > nowTotal) {
        return allPreSessionDetails.find(p => p.session_id === sess.id) || null;
      }
    }

    // All sessions passed: show last session's notes (may still be relevant)
    const lastSess = sessions[sessions.length - 1];
    return allPreSessionDetails.find(p => p.session_id === lastSess.id) || preSessionData;
  }, [sessions, allPreSessionDetails, preSessionData, currentTime, actualServiceData?.date]);

  // ═══════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════════
  if (!actualServiceData) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </div>
    );
  }

  const hasEntityWeeklySlots = adjustedEntitySlots.length > 0;
  const hasCustomSegments = isCustomService && adjustedAllSegments.length > 0;

  if (!hasEntityWeeklySlots && !hasCustomSegments) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOM SERVICE RENDERING (entity-sourced or JSON)
  // ═══════════════════════════════════════════════════════════════════
  if (isCustomService) {
    return (
      <div className="space-y-6">
        {canAccessLiveOps && (
          <StickyOpsDeck
            segments={adjustedAllSegments}
            preSessionData={activePreSessionData}
            sessionDate={actualServiceData.date}
            currentTime={currentTime}
            onScrollToSegment={scrollToSegment}
            onToggleChat={onToggleChat}
            chatUnreadCount={chatUnreadCount}
            chatOpen={chatOpen}
            resolvedStreamActions={[]}
            isServiceContext={true}
          />
        )}

        <ServiceStatusBar
          segments={adjustedAllSegments}
          currentTime={currentTime}
          onScrollTo={scrollToSegment}
          serviceDate={actualServiceData.date}
        />

        {/* Custom Service Header */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-pdv-teal/10 to-white p-3 sm:p-4 border-b">
            {(() => {
              const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
              if (globalAdj && globalAdj.offset_minutes !== 0) {
                const serviceTime = actualServiceData.time || "10:00";
                const [h, m] = serviceTime.split(':').map(Number);
                const date = new Date();
                date.setHours(h, m + globalAdj.offset_minutes, 0, 0);
                const adjustedTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words mb-1">
                    {actualServiceData.name} <span className="text-amber-600 text-lg">(inicio: {formatTimeToEST(adjustedTimeStr)})</span>
                  </h3>
                );
              }
              return <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words">{actualServiceData.name}</h3>;
            })()}
            {actualServiceData.description && (
              <p className="text-xs sm:text-sm text-gray-600 mt-2">{actualServiceData.description}</p>
            )}
            {entitySessionSlots[0]?.session && <SessionTeamInfoRow teamInfo={entitySessionSlots[0].session} />}
          </div>

          {/* Timeline-style segment list */}
          <div className="relative pl-7 sm:pl-9 py-4 pr-3 sm:pr-4">
            {/* Vertical Timeline Line */}
            <div className="absolute left-3 sm:left-4 top-4 bottom-4 w-0.5 bg-gray-200" />

            {adjustedAllSegments.filter(seg => (seg.type || seg.segment_type) !== 'break' && (seg.type || seg.segment_type) !== 'Break').map((segment, idx) => {
              const isCurr = isSegmentCurrent(segment);
              const isUp = !isCurr && isSegmentUpcoming(segment, adjustedAllSegments);
              return (
                <div key={segment.id || idx} className="relative mb-2">
                  {/* Timeline Dot */}
                  <div className={`
                    absolute -left-[1.4rem] sm:-left-[1.6rem] top-5 
                    w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 
                    flex items-center justify-center z-10 transition-all duration-500
                    ${isCurr
                      ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_0_4px_rgba(250,204,21,0.2)] scale-110' 
                      : isUp
                        ? 'bg-white border-blue-400'
                        : 'bg-white border-gray-300'}
                  `}>
                    {isCurr && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                    {isUp && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
                  </div>

                  <PublicProgramSegment
                    segment={segment}
                    isCurrent={isCurr}
                    isUpcoming={isUp}
                    viewMode="simple"
                    isExpanded={true}
                    alwaysExpanded={true}
                    onToggleExpand={toggleSegmentExpanded}
                    onOpenVerses={onOpenVerses}
                    allSegments={adjustedAllSegments}
                    timelineMode={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // WEEKLY SERVICE RENDERING
  // STRICT ENTITY MODE: Render ONLY from entity slots.
  // ═══════════════════════════════════════════════════════════════════

  const weeklySlots = adjustedEntitySlots;

  return (
    <div className="space-y-6">
      {canAccessLiveOps && (
        <StickyOpsDeck
          segments={adjustedAllSegments}
          preSessionData={activePreSessionData}
          sessionDate={actualServiceData.date}
          currentTime={currentTime}
          onScrollToSegment={scrollToSegment}
          onToggleChat={onToggleChat}
          chatUnreadCount={chatUnreadCount}
          chatOpen={chatOpen}
          resolvedStreamActions={[]}
          isServiceContext={true}
        />
      )}

      <ServiceStatusBar
        segments={adjustedAllSegments}
        currentTime={currentTime}
        onScrollTo={scrollToSegment}
        serviceDate={actualServiceData.date}
      />

      {weeklySlots.map((slot, slotIdx) => {
        if (!slot.segments || slot.segments.length === 0) return null;

        const parsed = parseSlotName(slot.name);
        const colors = SLOT_COLORS[slot.colorIdx % SLOT_COLORS.length];
        const adjustment = slot.adjustment;

        // Entity path: read team info from Session entity
        const sessionTeamInfo = slot.session ? {
          coordinators: slot.session.coordinators,
          ushers: slot.session.ushers_team,
          sound: slot.session.sound_team,
          tech: slot.session.tech_team,
          photography: slot.session.photography_team,
        } : null;

        // Entity path: read pre-service notes from PreSessionDetails (passed via preSessionData)
        // JSON path: read from actualServiceData.pre_service_notes
        const preServiceNotes = slot.session
          ? null // PreSessionDetails are handled by StickyOpsDeck
          : actualServiceData.pre_service_notes?.[slot.name];

        return (
          <React.Fragment key={slot.sessionId}>
            {/* Receso between slots (not before the first) */}
            {slotIdx > 0 && (() => {
              const prevSlot = weeklySlots[slotIdx - 1];
              const prevSegs = prevSlot?.segments;
              const prevEnd = prevSegs?.[prevSegs.length - 1]?.end_time;
              const thisStart = slot.segments[0]?.start_time;
              let gapMin = 0;
              if (prevEnd && thisStart) {
                const [eh, em] = prevEnd.split(':').map(Number);
                const [sh, sm] = thisStart.split(':').map(Number);
                gapMin = (sh * 60 + sm) - (eh * 60 + em);
              }
              // Receso notes keyed by the PREVIOUS slot name (break "after" that slot)
              const recesoNotes = actualServiceData.receso_notes?.[prevSlot?.name] || '';
              if (gapMin > 0 || recesoNotes) {
                return (
                  <div className="bg-gray-50 rounded-2xl p-4 text-center border-2 border-dashed border-gray-300">
                    <p className="font-bold text-gray-500 text-sm uppercase tracking-wide">☕ RECESO{gapMin > 0 ? ` (${gapMin} min)` : ''}</p>
                    {recesoNotes && (
                      <p className="text-sm text-gray-600 mt-2">{recesoNotes}</p>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Slot column — timeline aesthetic */}
            <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm`}>
              <div className={`bg-gradient-to-r ${colors.bg} to-white p-3 sm:p-4 border-b border-l-4 ${colors.border} rounded-tl-2xl`}>
                {/* Slot title with optional live adjustment indicator */}
                {(() => {
                  if (adjustment && adjustment.offset_minutes !== 0 && parsed) {
                    const [h, m] = parsed.base24.split(':').map(Number);
                    const date = new Date();
                    date.setHours(h, m + adjustment.offset_minutes, 0, 0);
                    const adjTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    return (
                      <h3 className={`text-2xl font-bold uppercase mb-1 ${colors.text}`}>
                        {parsed.display} <span className="text-amber-600">(inicio: {formatTimeToEST(adjTimeStr)})</span>
                      </h3>
                    );
                  }
                  return <h3 className={`text-2xl font-bold uppercase mb-1 ${colors.text}`}>{parsed?.display || slot.name}</h3>;
                })()}

                {/* 2026-03-01: Pre-service notes displayed in slot header.
                    Matches PreSessionDetails.general_notes for this session. */}
                {(() => {
                  const psd = allPreSessionDetails.find(p => p.session_id === slot.sessionId);
                  if (!psd?.general_notes) return null;
                  return (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-amber-900">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-amber-700 block mb-0.5">📋 Nota Pre-Servicio</span>
                      <span className="whitespace-pre-wrap">{psd.general_notes}</span>
                    </div>
                  );
                })()}

                {/* Team info — entity path ONLY */}
                {sessionTeamInfo && <SessionTeamInfoRow teamInfo={sessionTeamInfo} />}
              </div>

              {/* Timeline-style Segments */}
              <div className="relative pl-7 sm:pl-9 py-4 pr-3 sm:pr-4">
                {/* Vertical Timeline Line */}
                <div className="absolute left-3 sm:left-4 top-4 bottom-4 w-0.5 bg-gray-200" />

                {slot.segments.filter(seg => {
                  const t = seg.type || seg.segment_type || '';
                  return t !== 'break' && t !== 'Break' && t !== 'Receso';
                }).map((segment, idx) => {
                  const isCurr = isSegmentCurrent(segment);
                  const isUp = !isCurr && isSegmentUpcoming(segment, slot.segments);
                  return (
                    <div key={segment.id || `${slot.name}-${idx}`} className="relative mb-2">
                      {/* Timeline Dot */}
                      <div className={`
                        absolute -left-[1.4rem] sm:-left-[1.6rem] top-5 
                        w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 
                        flex items-center justify-center z-10 transition-all duration-500
                        ${isCurr
                          ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_0_4px_rgba(250,204,21,0.2)] scale-110' 
                          : isUp
                            ? 'bg-white border-blue-400'
                            : 'bg-white border-gray-300'}
                      `}>
                        {isCurr && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                        {isUp && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
                      </div>

                      <PublicProgramSegment
                        segment={segment}
                        isCurrent={isCurr}
                        isUpcoming={isUp}
                        viewMode="simple"
                        isExpanded={true}
                        alwaysExpanded={true}
                        onToggleExpand={toggleSegmentExpanded}
                        onOpenVerses={onOpenVerses}
                        allSegments={slot.segments}
                        timelineMode={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Legacy TeamInfoRow removed - strictly using SessionTeamInfoRow

/**
 * SessionTeamInfoRow — renders compact team info from a Session entity (entity path).
 * Entity Lift: reads directly from Session fields instead of Service JSON objects.
 */
function SessionTeamInfoRow({ teamInfo }) {
  if (!teamInfo) return null;

  const SESSION_TEAM_FIELDS = [
    { key: 'coordinators', icon: '👤', label: 'Coord' },
    { key: 'ushers', icon: '🚪', label: 'Ujieres' },
    { key: 'sound', icon: '🔊', label: 'Sonido' },
    { key: 'tech', icon: '💡', label: 'Luces' },
    { key: 'photography', icon: '📸', label: 'Foto' },
  ];

  const hasAny = SESSION_TEAM_FIELDS.some(f => teamInfo[f.key]);
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-700">
      {SESSION_TEAM_FIELDS.map((field, idx) => {
        const val = teamInfo[field.key];
        if (!val) return null;
        return (
          <React.Fragment key={field.key}>
            {idx > 0 && <span className="text-gray-400">|</span>}
            <span><strong>{field.icon} {field.label}:</strong> {normalizeName(val)}</span>
          </React.Fragment>
        );
      })}
    </div>
  );
}