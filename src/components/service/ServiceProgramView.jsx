import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import LiveStatusCard from "@/components/service/LiveStatusCard";
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

// Team fields to show in header (label + icon)
const TEAM_FIELDS = [
  { key: 'coordinators', icon: '👤', label: 'Coord' },
  { key: 'ujieres', icon: '🚪', label: 'Ujieres' },
  { key: 'sound', icon: '🔊', label: 'Sonido' },
  { key: 'luces', icon: '💡', label: 'Luces' },
  { key: 'fotografia', icon: '📸', label: 'Foto' },
];

export default function ServiceProgramView({
  actualServiceData,
  allSegments = [],
  sessions = [],
  liveAdjustments = [],
  preSessionData = null,
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

  // ── Discover dynamic slot keys from service data ──
  // Pattern: keys matching "9:30am", "11:30am", "7:00pm", etc. with non-empty arrays
  const slotKeys = useMemo(() => {
    if (!actualServiceData) return [];
    return Object.keys(actualServiceData)
      .filter(k => /^\d+:\d+[ap]m$/i.test(k) && Array.isArray(actualServiceData[k]) && actualServiceData[k].length > 0)
      .sort((a, b) => {
        const pa = parseSlotName(a);
        const pb = parseSlotName(b);
        return (pa?.totalMinutes || 0) - (pb?.totalMinutes || 0);
      });
  }, [actualServiceData]);

  // ── Apply live time adjustments to each dynamic slot ──
  const adjustedServiceData = useMemo(() => {
    if (!actualServiceData) return null;
    const adjusted = { ...actualServiceData };

    const applyTimeOffset = (segments, timeSlot, globalOffset = null) => {
      let offsetMinutes = 0;
      if (globalOffset !== null) {
        offsetMinutes = globalOffset;
      } else {
        const adjustment = liveAdjustments.find(a => a.time_slot === timeSlot);
        if (!adjustment || adjustment.offset_minutes === 0) return segments;
        offsetMinutes = adjustment.offset_minutes;
      }
      return segments.map(seg => ({
        ...seg,
        start_time: addMinutesToTime(seg.start_time, offsetMinutes),
        end_time: addMinutesToTime(seg.end_time, offsetMinutes)
      }));
    };

    // Dynamic: apply adjustments to all discovered slot keys
    slotKeys.forEach(slotKey => {
      if (adjusted[slotKey]) {
        adjusted[slotKey] = applyTimeOffset(adjusted[slotKey], slotKey);
      }
    });

    // Custom services: global adjustment
    if (adjusted.segments) {
      const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
      if (globalAdj && globalAdj.offset_minutes !== 0) {
        adjusted.segments = applyTimeOffset(adjusted.segments, null, globalAdj.offset_minutes);
      }
    }

    return adjusted;
  }, [actualServiceData, liveAdjustments, slotKeys]);

  // ── Adjust flat list for StickyOpsDeck/LiveCard ──
  const adjustedAllSegments = useMemo(() => {
    if (actualServiceData?.segments && actualServiceData.segments.length > 0) {
      return adjustedServiceData?.segments || [];
    }

    const sessionNameMap = new Map();
    if (sessions?.length > 0) {
      sessions.forEach(s => { if (s.id && s.name) sessionNameMap.set(s.id, s.name); });
    }

    return allSegments.map(seg => {
      let offsetMinutes = 0;
      let slot = null;

      const resolvedName = sessionNameMap.get(seg.session_id);
      if (resolvedName) {
        slot = resolvedName;
      }
      // JSON-sourced: map synthetic session IDs to slots (legacy compat)
      else if (seg.session_id === 'slot-9-30') slot = '9:30am';
      else if (seg.session_id === 'slot-11-30') slot = '11:30am';
      else if (seg.session_id === 'slot-break') slot = slotKeys[0] || '9:30am';

      if (slot) {
        const adjustment = liveAdjustments.find(a => a.time_slot === slot);
        if (adjustment) offsetMinutes = adjustment.offset_minutes;
      }

      return {
        ...seg,
        start_time: addMinutesToTime(seg.start_time, offsetMinutes),
        end_time: addMinutesToTime(seg.end_time, offsetMinutes)
      };
    });
  }, [allSegments, adjustedServiceData, liveAdjustments, actualServiceData, sessions, slotKeys]);

  if (!adjustedServiceData) {
    return (
      <Card className="p-12 text-center bg-white border-2 border-gray-300">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  const isCustomService = adjustedServiceData.segments && adjustedServiceData.segments.length > 0;
  const isWeeklyService = slotKeys.length > 0;

  if (!isCustomService && !isWeeklyService) {
    return (
      <Card className="p-12 text-center bg-white border-2 border-gray-300">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  // ── Custom Service rendering (unchanged logic) ──
  if (isCustomService) {
    return (
      <div className="space-y-6">
        {canAccessLiveOps && (
          <StickyOpsDeck
            segments={adjustedServiceData.segments || []}
            preSessionData={preSessionData}
            sessionDate={adjustedServiceData.date}
            currentTime={currentTime}
            onScrollToSegment={scrollToSegment}
            onToggleChat={onToggleChat}
            chatUnreadCount={chatUnreadCount}
            chatOpen={chatOpen}
            resolvedStreamActions={[]}
          />
        )}

        <LiveStatusCard
          segments={adjustedServiceData.segments || []}
          currentTime={currentTime}
          onScrollTo={scrollToSegment}
          serviceDate={adjustedServiceData.date}
        />

        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
          <div className="bg-gradient-to-r from-pdv-teal/10 to-white p-3 sm:p-4 border-b">
            {(() => {
              const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
              if (globalAdj && globalAdj.offset_minutes !== 0) {
                const serviceTime = adjustedServiceData.time || "10:00";
                const [h, m] = serviceTime.split(':').map(Number);
                const date = new Date();
                date.setHours(h, m + globalAdj.offset_minutes, 0, 0);
                const adjustedTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words mb-1">
                    {adjustedServiceData.name} <span className="text-amber-600 text-lg">(inicio: {formatTimeToEST(adjustedTimeStr)})</span>
                  </h3>
                );
              }
              return <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words">{adjustedServiceData.name}</h3>;
            })()}
            {adjustedServiceData.description && (
              <p className="text-xs sm:text-sm text-gray-600 mt-2">{adjustedServiceData.description}</p>
            )}
            <TeamInfoRow serviceData={adjustedServiceData} slotKey={null} />
          </div>
          <div className="space-y-0">
            {adjustedServiceData.segments.filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, adjustedServiceData.segments)}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true}
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={adjustedServiceData.segments}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Weekly Service: DYNAMIC SLOT RENDERING ──
  return (
    <div className="space-y-6">
      {canAccessLiveOps && (
        <StickyOpsDeck
          segments={adjustedAllSegments}
          preSessionData={preSessionData}
          sessionDate={adjustedServiceData.date}
          currentTime={currentTime}
          onScrollToSegment={scrollToSegment}
          onToggleChat={onToggleChat}
          chatUnreadCount={chatUnreadCount}
          chatOpen={chatOpen}
          resolvedStreamActions={[]}
        />
      )}

      <LiveStatusCard
        segments={adjustedAllSegments}
        currentTime={currentTime}
        onScrollTo={scrollToSegment}
        serviceDate={adjustedServiceData.date}
      />

      {slotKeys.map((slotKey, slotIdx) => {
        const slotSegments = adjustedServiceData[slotKey];
        if (!slotSegments || slotSegments.length === 0) return null;

        const parsed = parseSlotName(slotKey);
        const colors = SLOT_COLORS[slotIdx % SLOT_COLORS.length];
        const adjustment = liveAdjustments.find(a => a.time_slot === slotKey);

        return (
          <React.Fragment key={slotKey}>
            {/* Receso between slots (not before the first) */}
            {slotIdx > 0 && (() => {
              const prevSlotKey = slotKeys[slotIdx - 1];
              const prevParsed = parseSlotName(prevSlotKey);
              const prevSegs = adjustedServiceData[prevSlotKey];
              // Calculate gap: last segment end of prev slot → first segment start of this slot
              const prevEnd = prevSegs?.[prevSegs.length - 1]?.end_time;
              const thisStart = slotSegments[0]?.start_time;
              let gapMin = 0;
              if (prevEnd && thisStart) {
                const [eh, em] = prevEnd.split(':').map(Number);
                const [sh, sm] = thisStart.split(':').map(Number);
                gapMin = (sh * 60 + sm) - (eh * 60 + em);
              }
              // Show receso if gap > 0 or if notes exist for the first slot key
              const recesoNotes = adjustedServiceData.receso_notes?.[slotKeys[0]] || '';
              if (gapMin > 0 || recesoNotes) {
                return (
                  <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
                    <p className="font-bold text-gray-600">RECESO{gapMin > 0 ? ` (${gapMin} min)` : ''}</p>
                    {recesoNotes && (
                      <p className="text-sm text-gray-600 mt-2">{recesoNotes}</p>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Slot column */}
            <div className={`bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 ${colors.border}`}>
              <div className={`bg-gradient-to-r ${colors.bg} to-white p-3 sm:p-4 border-b`}>
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
                  return <h3 className={`text-2xl font-bold uppercase mb-1 ${colors.text}`}>{parsed?.display || slotKey}</h3>;
                })()}

                {/* Pre-service notes */}
                {adjustedServiceData.pre_service_notes?.[slotKey] && (
                  <div className="bg-black border-l-4 border-yellow-400 p-2 mt-2 rounded-r">
                    <p className="text-sm text-white font-bold whitespace-pre-wrap line-clamp-3">
                      {adjustedServiceData.pre_service_notes[slotKey]}
                    </p>
                  </div>
                )}

                {/* Team info */}
                <TeamInfoRow serviceData={adjustedServiceData} slotKey={slotKey} />
              </div>

              {/* Segments */}
              <div className="space-y-0">
                {slotSegments.filter(seg => seg.type !== 'break').map((segment, idx) => (
                  <PublicProgramSegment
                    key={segment.id || `${slotKey}-${idx}`}
                    segment={segment}
                    isCurrent={isSegmentCurrent(segment)}
                    isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, slotSegments)}
                    viewMode="simple"
                    isExpanded={true}
                    alwaysExpanded={true}
                    onToggleExpand={toggleSegmentExpanded}
                    onOpenVerses={onOpenVerses}
                    allSegments={slotSegments}
                  />
                ))}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * TeamInfoRow — renders compact team info for a given slot key.
 * If slotKey is null (custom services), picks the first non-empty value from any slot.
 */
function TeamInfoRow({ serviceData, slotKey }) {
  const getValue = (fieldKey) => {
    const obj = serviceData[fieldKey];
    if (!obj || typeof obj !== 'object') return '';
    if (slotKey) return obj[slotKey] || '';
    // Custom service: pick first non-empty value
    return Object.values(obj).find(v => v) || '';
  };

  const hasAny = TEAM_FIELDS.some(f => getValue(f.key));
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-700">
      {TEAM_FIELDS.map((field, idx) => {
        const val = getValue(field.key);
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