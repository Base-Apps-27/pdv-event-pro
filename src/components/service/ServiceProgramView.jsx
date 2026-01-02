import React from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import LiveStatusCard from "@/components/service/LiveStatusCard";
import PublicProgramSegment from "@/components/service/PublicProgramSegment";
import { normalizeName } from "@/components/utils/textNormalization";

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
  currentTime,
  isSegmentCurrent,
  isSegmentUpcoming,
  toggleSegmentExpanded,
  onOpenVerses,
  scrollToSegment
}) {
  // If no service data, show empty state
  if (!actualServiceData) {
    return (
      <Card className="p-12 text-center bg-white border-2 border-gray-300">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  // Check if this is a Custom Service (has segments array) or Weekly Service (has 9:30am/11:30am)
  const isCustomService = actualServiceData.segments && actualServiceData.segments.length > 0;
  const isWeeklyService = (actualServiceData["9:30am"] && actualServiceData["9:30am"].length > 0) || 
                          (actualServiceData["11:30am"] && actualServiceData["11:30am"].length > 0);

  // If neither format, show empty state
  if (!isCustomService && !isWeeklyService) {
    return (
      <Card className="p-12 text-center bg-white border-2 border-gray-300">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Este servicio aún no tiene programa disponible</p>
      </Card>
    );
  }

  // Render Custom Service
  if (isCustomService) {
    return (
      <div className="space-y-6">
        {/* Live Status Card for Custom Services */}
        <LiveStatusCard 
          segments={actualServiceData.segments || []} 
          currentTime={currentTime}
          onScrollTo={scrollToSegment}
        />

        {/* Custom Service Segments */}
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
          <div className="bg-gradient-to-r from-pdv-teal/10 to-white p-4 border-b">
            <h3 className="text-2xl font-bold uppercase text-pdv-teal">{actualServiceData.name}</h3>
            {actualServiceData.description && (
              <p className="text-sm text-gray-600 mt-2">{actualServiceData.description}</p>
            )}
            {/* Team Info - Compact */}
            {(actualServiceData.coordinators || actualServiceData.ujieres || actualServiceData.sound || actualServiceData.luces || actualServiceData.fotografia) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                {actualServiceData.coordinators && Object.values(actualServiceData.coordinators).find(v => v) && (
                  <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["9:30am"] || actualServiceData.coordinators["11:30am"] || Object.values(actualServiceData.coordinators).find(v => v))}</span>
                )}
                {actualServiceData.ujieres && Object.values(actualServiceData.ujieres).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["9:30am"] || actualServiceData.ujieres["11:30am"] || Object.values(actualServiceData.ujieres).find(v => v))}</span>
                  </>
                )}
                {actualServiceData.sound && Object.values(actualServiceData.sound).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["9:30am"] || actualServiceData.sound["11:30am"] || Object.values(actualServiceData.sound).find(v => v))}</span>
                  </>
                )}
                {actualServiceData.luces && Object.values(actualServiceData.luces).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["9:30am"] || actualServiceData.luces["11:30am"] || Object.values(actualServiceData.luces).find(v => v))}</span>
                  </>
                )}
                {actualServiceData.fotografia && Object.values(actualServiceData.fotografia).find(v => v) && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["9:30am"] || actualServiceData.fotografia["11:30am"] || Object.values(actualServiceData.fotografia).find(v => v))}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="divide-y divide-gray-200">
            {actualServiceData.segments.filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData.segments)}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true} // CRITICAL: Services always show all details
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={actualServiceData.segments}
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
      {/* Live Status Card for Weekly Services */}
      {(() => {
        const allServiceSegments = [
          ...(actualServiceData?.['9:30am'] || []),
          ...(actualServiceData?.['11:30am'] || [])
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
          />
        );
      })()}

      {/* 9:30am Service */}
      {actualServiceData["9:30am"] && (
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-red-500">
          <div className="bg-gradient-to-r from-red-50 to-white p-4 border-b">
            <h3 className="text-2xl font-bold uppercase mb-1 text-red-600">9:30 A.M.</h3>
            {actualServiceData.pre_service_notes?.["9:30am"] && (
              <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                <p className="text-sm text-green-900 font-medium italic whitespace-pre-wrap line-clamp-3">{actualServiceData.pre_service_notes["9:30am"]}</p>
              </div>
            )}
            {/* Team Info - Compact */}
            {(actualServiceData.coordinators?.["9:30am"] || actualServiceData.ujieres?.["9:30am"] || actualServiceData.sound?.["9:30am"] || actualServiceData.luces?.["9:30am"] || actualServiceData.fotografia?.["9:30am"]) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                {actualServiceData.coordinators?.["9:30am"] && (
                  <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["9:30am"])}</span>
                )}
                {actualServiceData.ujieres?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["9:30am"])}</span>
                  </>
                )}
                {actualServiceData.sound?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["9:30am"])}</span>
                  </>
                )}
                {actualServiceData.luces?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["9:30am"])}</span>
                  </>
                )}
                {actualServiceData.fotografia?.["9:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["9:30am"])}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="divide-y divide-gray-200">
            {actualServiceData["9:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData["9:30am"])}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true} // CRITICAL: Services always show all details
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={actualServiceData["9:30am"]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Receso */}
      <div className="bg-gray-100 rounded-lg p-4 text-center border border-gray-300">
        <p className="font-bold text-gray-600">RECESO (30 min)</p>
        {actualServiceData.receso_notes?.["9:30am"] && (
          <p className="text-sm text-gray-600 mt-2">{actualServiceData.receso_notes["9:30am"]}</p>
        )}
      </div>

      {/* 11:30am Service */}
      {actualServiceData["11:30am"] && (
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden border-l-4 border-l-blue-500">
          <div className="bg-gradient-to-r from-blue-50 to-white p-4 border-b">
            <h3 className="text-2xl font-bold uppercase mb-1 text-blue-600">11:30 A.M.</h3>
            {actualServiceData.pre_service_notes?.["11:30am"] && (
              <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                <p className="text-sm text-gray-600 font-medium italic whitespace-pre-wrap line-clamp-3">{actualServiceData.pre_service_notes["11:30am"]}</p>
              </div>
            )}
            {/* Team Info - Compact */}
            {(actualServiceData.coordinators?.["11:30am"] || actualServiceData.ujieres?.["11:30am"] || actualServiceData.sound?.["11:30am"] || actualServiceData.luces?.["11:30am"] || actualServiceData.fotografia?.["11:30am"]) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                {actualServiceData.coordinators?.["11:30am"] && (
                  <span><strong>👤 Coord:</strong> {normalizeName(actualServiceData.coordinators["11:30am"])}</span>
                )}
                {actualServiceData.ujieres?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🚪 Ujieres:</strong> {normalizeName(actualServiceData.ujieres["11:30am"])}</span>
                  </>
                )}
                {actualServiceData.sound?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>🔊 Sonido:</strong> {normalizeName(actualServiceData.sound["11:30am"])}</span>
                  </>
                )}
                {actualServiceData.luces?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>💡 Luces:</strong> {normalizeName(actualServiceData.luces["11:30am"])}</span>
                  </>
                )}
                {actualServiceData.fotografia?.["11:30am"] && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span><strong>📸 Foto:</strong> {normalizeName(actualServiceData.fotografia["11:30am"])}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="divide-y divide-gray-200">
            {actualServiceData["11:30am"].filter(seg => seg.type !== 'break').map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || idx}
                segment={segment}
                isCurrent={isSegmentCurrent(segment)}
                isUpcoming={!isSegmentCurrent(segment) && isSegmentUpcoming(segment, actualServiceData["11:30am"])}
                viewMode="simple"
                isExpanded={true}
                alwaysExpanded={true} // CRITICAL: Services always show all details
                onToggleExpand={toggleSegmentExpanded}
                onOpenVerses={onOpenVerses}
                allSegments={actualServiceData["11:30am"]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}