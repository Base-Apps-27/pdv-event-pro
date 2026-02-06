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
 * Dedicated component for rendering the 'Service' view in PublicProgramView.
 * Handles both weekly services (9:30am/11:30am) and custom services (segments array).
 * 
 * CRITICAL BEHAVIOR:
 * - Services ALWAYS display all details (alwaysExpanded=true passed to PublicProgramSegment)
 * - This ensures coordinator actions, team notes, and all operational info is always visible
 * 
 * @param {Object} actualServiceData - Processed service data with calculated times
 * @param {Date} currentTime - Current time for live status calculations
 * @param {Function} isSegmentCurrent - Helper to determine if segment is currently active
 * @param {Function} isSegmentUpcoming - Helper to determine if segment is upcoming
 * @param {Function} toggleSegmentExpanded - Handler for expand/collapse (not used for services)
 * @param {Function} onOpenVerses - Handler for opening verses modal
 * @param {Function} scrollToSegment - Handler for scrolling to a specific segment
 */
export default function ServiceProgramView({
  actualServiceData,
  liveAdjustments = [],
  currentTime,
  isSegmentCurrent,
  isSegmentUpcoming,
  toggleSegmentExpanded,
  onOpenVerses,
  scrollToSegment,
  // PERMISSION-GATED: Single boolean controls StickyOpsDeck + chat visibility
  canAccessLiveOps = false,
  onToggleChat,
  chatUnreadCount,
  chatOpen
}) {
  const adjustedServiceData = React.useMemo(() => {
    if (!actualServiceData) return null;
    
    // Helper to apply time offset
    const applyTimeOffset = (segments, timeSlot, globalOffset = null) => {
      let offsetMinutes = 0;
      
      if (globalOffset !== null) {
        // Global adjustment for custom services
        offsetMinutes = globalOffset;
      } else {
        // Time slot adjustment for weekly services
        const adjustment = liveAdjustments.find(a => a.time_slot === timeSlot);
        if (!adjustment || adjustment.offset_minutes === 0) return segments;
        offsetMinutes = adjustment.offset_minutes;
      }

      return segments.map(seg => {
        const addMinutes = (timeStr, minutes) => {
          if (!timeStr) return timeStr;
          const [h, m] = timeStr.split(':').map(Number);
          const date = new Date();
          date.setHours(h, m + minutes, 0, 0);
          return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        };

        return {
          ...seg,
          start_time: addMinutes(seg.start_time, offsetMinutes),
          end_time: addMinutes(seg.end_time, offsetMinutes)
        };
      });
    };
    
    const adjusted = { ...actualServiceData };
    
    if (adjusted["9:30am"]) {
      adjusted["9:30am"] = applyTimeOffset(adjusted["9:30am"], "9:30am");
    }
    if (adjusted["11:30am"]) {
      adjusted["11:30am"] = applyTimeOffset(adjusted["11:30am"], "11:30am");
    }
    if (adjusted.segments) {
      // Apply global adjustment for custom services
      const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
      if (globalAdj && globalAdj.offset_minutes !== 0) {
        adjusted.segments = applyTimeOffset(adjusted.segments, null, globalAdj.offset_minutes);
      }
    }
    
    return adjusted;
  }, [actualServiceData, liveAdjustments]);

  // If no service data, show empty state
  if (!adjustedServiceData) {
    return (
      <Card className="p-12 text-center ppv-bg-surface border-2 ppv-border">
        <Calendar className="w-16 h-16 ppv-text-muted mx-auto mb-4" />
        <p className="ppv-text-secondary">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  // Check if this is a Custom Service (has segments array) or Weekly Service (has 9:30am/11:30am)
  const isCustomService = adjustedServiceData.segments && adjustedServiceData.segments.length > 0;
  const isWeeklyService = (adjustedServiceData["9:30am"] && adjustedServiceData["9:30am"].length > 0) || 
                          (adjustedServiceData["11:30am"] && adjustedServiceData["11:30am"].length > 0);

  // If neither format, show empty state
  if (!isCustomService && !isWeeklyService) {
    return (
      <Card className="p-12 text-center ppv-bg-surface border-2 ppv-border">
        <Calendar className="w-16 h-16 ppv-text-muted mx-auto mb-4" />
        <p className="ppv-text-secondary">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  // Render Custom Service
  if (isCustomService) {
    return (
      <div className="space-y-6">
        {/* Sticky Ops Deck - PERMISSION-GATED: requires view_live_chat */}
        {canAccessLiveOps && (
        <StickyOpsDeck 
          segments={adjustedServiceData.segments || []}
          sessionDate={adjustedServiceData.date}
          currentTime={currentTime}
          onScrollToSegment={scrollToSegment}
          onToggleChat={onToggleChat}
          chatUnreadCount={chatUnreadCount}
          chatOpen={chatOpen}
        />
        )}

        {/* Live Status Card for Custom Services */}
        <LiveStatusCard 
          segments={adjustedServiceData.segments || []} 
          currentTime={currentTime}
          onScrollTo={scrollToSegment}
          serviceDate={adjustedServiceData.date}
        />

        {/* Custom Service Segments */}
         <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
           <div className="bg-gradient-to-r from-pdv-teal/10 to-white p-3 sm:p-4 border-b">
             {(() => {
               const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
               if (globalAdj && globalAdj.offset_minutes !== 0) {
                 const adjustedTime = (() => {
                   const serviceTime = adjustedServiceData.time || "10:00";
                   const [h, m] = serviceTime.split(':').map(Number);
                   const date = new Date();
                   date.setHours(h, m + globalAdj.offset_minutes, 0, 0);
                   const adjustedTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                   return formatTimeToEST(adjustedTimeStr);
                 })();
                 return (
                   <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words mb-1">
                     {adjustedServiceData.name} <span className="text-amber-600 text-lg">(inicio: {adjustedTime})</span>
                   </h3>
                 );
               }
               return <h3 className="text-xl sm:text-2xl font-bold uppercase text-pdv-teal break-words">{adjustedServiceData.name}</h3>;
             })()}
            {adjustedServiceData.description && (
              <p className="text-xs sm:text-sm text-gray-600 mt-2">{adjustedServiceData.description}</p>
            )}
            {/* Team Info - Compact */}
            {(adjustedServiceData.coordinators || adjustedServiceData.ujieres || adjustedServiceData.sound || adjustedServiceData.luces || adjustedServiceData.fotografia) && (
              <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-700">
                {adjustedServiceData.coordinators && Object.values(adjustedServiceData.coordinators).find(v => v) && (
                  <span><strong>👤 Coord:</strong> {normalizeName(adjustedServiceData.coordinators["9:30am"] || adjustedServiceData.coordinators["11:30am"] || Object.values(adjustedServiceData.coordinators).find(v => v))}</span>
                )}
                {adjustedServiceData.ujieres && Object.values(adjustedServiceData.ujieres).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(adjustedServiceData.ujieres["9:30am"] || adjustedServiceData.ujieres["11:30am"] || Object.values(adjustedServiceData.ujieres).find(v => v))}</span>
                  </>
                )}
                {adjustedServiceData.sound && Object.values(adjustedServiceData.sound).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(adjustedServiceData.sound["9:30am"] || adjustedServiceData.sound["11:30am"] || Object.values(adjustedServiceData.sound).find(v => v))}</span>
                  </>
                )}
                {adjustedServiceData.luces && Object.values(adjustedServiceData.luces).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(adjustedServiceData.luces["9:30am"] || adjustedServiceData.luces["11:30am"] || Object.values(adjustedServiceData.luces).find(v => v))}</span>
                  </>
                )}
                {adjustedServiceData.fotografia && Object.values(adjustedServiceData.fotografia).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(adjustedServiceData.fotografia["9:30am"] || adjustedServiceData.fotografia["11:30am"] || Object.values(adjustedServiceData.fotografia).find(v => v))}</span>
                  </>
                )}
              </div>
            )}
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
                alwaysExpanded={true} // CRITICAL: Services always show all details
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

  // Render Weekly Service (9:30am and 11:30am)
  return (
    <div className="space-y-6">
      {/* Sticky Ops Deck for Weekly Services - PERMISSION-GATED */}
      {canAccessLiveOps && (() => {
        const allServiceSegments = [
          ...(adjustedServiceData?.['9:30am'] || []),
          ...(adjustedServiceData?.['11:30am'] || [])
        ].map(s => ({
          ...s,
          start_time: s.start_time || s.data?.start_time,
          end_time: s.end_time || s.data?.end_time,
          title: s.title || s.data?.title || 'Untitled'
        }));

        return (
        <StickyOpsDeck 
          segments={allServiceSegments}
          sessionDate={adjustedServiceData.date}
          currentTime={currentTime}
          onScrollToSegment={scrollToSegment}
          onToggleChat={onToggleChat}
          chatUnreadCount={chatUnreadCount}
          chatOpen={chatOpen}
        />
        );
        })()}

        {/* Live Status Card for Weekly Services */}
      {(() => {
        const allServiceSegments = [
          ...(adjustedServiceData?.['9:30am'] || []),
          ...(adjustedServiceData?.['11:30am'] || [])
        ].map(s => ({
          ...s,
          start_time: s.start_time || s.data?.start_time,
          end_time: s.end_time || s.data?.end_time,
          title: s.title || s.data?.title || 'Untitled'
        }));

        return (
          <LiveStatusCard 
            segments={allServiceSegments} 
            currentTime={currentTime}
            onScrollTo={scrollToSegment}
            serviceDate={adjustedServiceData.date}
          />
        );
      })()}

      {/* 9:30am Service */}
      {adjustedServiceData["9:30am"] && (
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-red-500">
          <div className="bg-gradient-to-r from-red-50 to-white p-3 sm:p-4 border-b">
            {(() => {
              const adjustment = liveAdjustments.find(a => a.time_slot === "9:30am");
              if (adjustment && adjustment.offset_minutes !== 0) {
                const adjustedTime = (() => {
                  const [h, m] = "09:30".split(':').map(Number);
                  const date = new Date();
                  date.setHours(h, m + adjustment.offset_minutes, 0, 0);
                  const adjustedTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                  return formatTimeToEST(adjustedTimeStr);
                })();
                return (
                  <h3 className="text-2xl font-bold uppercase mb-1 text-red-600">
                    9:30 AM <span className="text-amber-600">(inicio: {adjustedTime})</span>
                  </h3>
                );
              }
              return <h3 className="text-2xl font-bold uppercase mb-1 text-red-600">9:30 AM</h3>;
            })()}
            {adjustedServiceData.pre_service_notes?.["9:30am"] && (
              <div className="bg-black border-l-4 border-yellow-400 p-2 mt-2 rounded-r">
                <p className="text-sm text-white font-bold whitespace-pre-wrap line-clamp-3">{adjustedServiceData.pre_service_notes["9:30am"]}</p>
              </div>
            )}
            {/* Team Info - Compact */}
            {(adjustedServiceData.coordinators?.["9:30am"] || adjustedServiceData.ujieres?.["9:30am"] || adjustedServiceData.sound?.["9:30am"] || adjustedServiceData.luces?.["9:30am"] || adjustedServiceData.fotografia?.["9:30am"]) && (
              <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-700">
                {adjustedServiceData.coordinators?.["9:30am"] && (
                  <span><strong>👤 Coord:</strong> {normalizeName(adjustedServiceData.coordinators["9:30am"])}</span>
                )}
                {adjustedServiceData.ujieres?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(adjustedServiceData.ujieres["9:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.sound?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(adjustedServiceData.sound["9:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.luces?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(adjustedServiceData.luces["9:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.fotografia?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(adjustedServiceData.fotografia["9:30am"])}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-0">
            {adjustedServiceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, adjustedServiceData["9:30am"])}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true} // CRITICAL: Services always show all details
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={adjustedServiceData["9:30am"]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Receso */}
      <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
        <p className="font-bold text-gray-600">RECESO (30 min)</p>
        {adjustedServiceData.receso_notes?.["9:30am"] && (
          <p className="text-sm text-gray-600 mt-2">{adjustedServiceData.receso_notes["9:30am"]}</p>
        )}
      </div>

      {/* 11:30am Service */}
      {adjustedServiceData["11:30am"] && (
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-blue-500">
          <div className="bg-gradient-to-r from-blue-50 to-white p-3 sm:p-4 border-b">
            {(() => {
              const adjustment = liveAdjustments.find(a => a.time_slot === "11:30am");
              if (adjustment && adjustment.offset_minutes !== 0) {
                const adjustedTime = (() => {
                  const [h, m] = "11:30".split(':').map(Number);
                  const date = new Date();
                  date.setHours(h, m + adjustment.offset_minutes, 0, 0);
                  const adjustedTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                  return formatTimeToEST(adjustedTimeStr);
                })();
                return (
                  <h3 className="text-2xl font-bold uppercase mb-1 text-blue-600">
                    11:30 AM <span className="text-amber-600">(inicio: {adjustedTime})</span>
                  </h3>
                );
              }
              return <h3 className="text-2xl font-bold uppercase mb-1 text-blue-600">11:30 AM</h3>;
            })()}
            {adjustedServiceData.pre_service_notes?.["11:30am"] && (
              <div className="bg-black border-l-4 border-yellow-400 p-2 mt-2 rounded-r">
                <p className="text-sm text-white font-bold whitespace-pre-wrap line-clamp-3">{adjustedServiceData.pre_service_notes["11:30am"]}</p>
              </div>
            )}
            {/* Team Info - Compact */}
            {(adjustedServiceData.coordinators?.["11:30am"] || adjustedServiceData.ujieres?.["11:30am"] || adjustedServiceData.sound?.["11:30am"] || adjustedServiceData.luces?.["11:30am"] || adjustedServiceData.fotografia?.["11:30am"]) && (
              <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-700">
                {adjustedServiceData.coordinators?.["11:30am"] && (
                  <span><strong>👤 Coord:</strong> {normalizeName(adjustedServiceData.coordinators["11:30am"])}</span>
                )}
                {adjustedServiceData.ujieres?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(adjustedServiceData.ujieres["11:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.sound?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(adjustedServiceData.sound["11:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.luces?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(adjustedServiceData.luces["11:30am"])}</span>
                  </>
                )}
                {adjustedServiceData.fotografia?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(adjustedServiceData.fotografia["11:30am"])}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-0">
            {adjustedServiceData["11:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, adjustedServiceData["11:30am"])}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true} // CRITICAL: Services always show all details
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={adjustedServiceData["11:30am"]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}