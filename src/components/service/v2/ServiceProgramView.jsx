import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import { applyLiveAdjustments } from '@/components/utils/liveAdjustmentHelpers';
import PublicProgramSegment from '@/components/service/PublicProgramSegment';
import LiveStatusCard from '@/components/service/LiveStatusCard';

/**
 * Service Program View V2
 * Handles both Weekly and Custom services
 * Preserves existing mobile-friendly layout
 */
export default function ServiceProgramView({ 
  actualServiceData, 
  liveAdjustments,
  currentTime,
  onOpenVerses
}) {
  const { t } = useLanguage();

  // Auto-detect service type from data structure
  const serviceType = actualServiceData?.['9:30am'] || actualServiceData?.['11:30am'] 
    ? 'weekly' 
    : actualServiceData?.segments 
      ? 'custom' 
      : null;

  // Apply live adjustments to segments
  const { slot930Segments, slot1130Segments, customSegments } = useMemo(() => {
    if (serviceType === 'weekly' && actualServiceData['9:30am'] && actualServiceData['11:30am']) {
      return {
        slot930Segments: applyLiveAdjustments(
          actualServiceData['9:30am'], 
          liveAdjustments, 
          'weekly', 
          '9:30am'
        ),
        slot1130Segments: applyLiveAdjustments(
          actualServiceData['11:30am'], 
          liveAdjustments, 
          'weekly', 
          '11:30am'
        ),
        customSegments: []
      };
    } else if (serviceType === 'custom' && actualServiceData.segments) {
      return {
        slot930Segments: [],
        slot1130Segments: [],
        customSegments: applyLiveAdjustments(
          actualServiceData.segments,
          liveAdjustments,
          'custom'
        )
      };
    }
    return { slot930Segments: [], slot1130Segments: [], customSegments: [] };
  }, [actualServiceData, liveAdjustments, serviceType]);

  // Empty state - Only if no service data at all
  if (!actualServiceData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">
          {t('liveView.noServiceData') || 'No hay datos de servicio disponibles'}
        </p>
      </div>
    );
  }

  // CRITICAL: Don't block rendering if service exists but has no segments yet
  // Custom services and weekly services should still show metadata/team info

  // CUSTOM SERVICE RENDERING
  if (serviceType === 'custom') {
    return (
      <div className="space-y-4">
        {/* Live Status Card - Only if segments exist */}
        {customSegments.length > 0 && (
          <LiveStatusCard 
            segments={customSegments}
            currentTime={currentTime}
            serviceDate={actualServiceData.date}
            liveAdjustmentEnabled={liveAdjustments?.length > 0}
          />
        )}

        {/* Custom Service Card */}
        <Card className="bg-white border-2 border-gray-300 overflow-hidden border-l-4 border-l-pdv-teal">
          <CardHeader className="bg-gradient-to-r from-pdv-teal/10 to-white border-b">
            <CardTitle className="text-2xl font-bold uppercase text-pdv-teal">
              {actualServiceData.name || 'Servicio Especial'}
            </CardTitle>
            {actualServiceData.description && (
              <p className="text-sm text-gray-600 mt-2">{actualServiceData.description}</p>
            )}
            {actualServiceData.time && (
              <p className="text-sm text-gray-600 mt-1">⏰ {actualServiceData.time}</p>
            )}
          </CardHeader>
          {customSegments.length > 0 ? (
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {customSegments.map((segment, idx) => (
                <PublicProgramSegment
                  key={segment.id || idx}
                  segment={segment}
                  isCurrent={false}
                  isUpcoming={false}
                  viewMode="simple"
                  isExpanded={true}
                  alwaysExpanded={true}
                  onToggleExpand={() => {}}
                  onOpenVerses={onOpenVerses}
                  allSegments={customSegments}
                />
              ))}
            </div>
          </CardContent>
          ) : (
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 text-sm">
                {t('liveView.noSegments') || 'No hay segmentos programados para este servicio'}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Team Info (if present) */}
        {(actualServiceData.coordinators || actualServiceData.sound || actualServiceData.luces) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{t('common.team') || 'Equipo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {actualServiceData.coordinators && (
                <div><strong>{t('common.coordinators') || 'Coordinadores'}:</strong> {typeof actualServiceData.coordinators === 'object' ? JSON.stringify(actualServiceData.coordinators) : String(actualServiceData.coordinators)}</div>
              )}
              {actualServiceData.sound && (
                <div><strong>{t('common.sound') || 'Sonido'}:</strong> {typeof actualServiceData.sound === 'object' ? JSON.stringify(actualServiceData.sound) : String(actualServiceData.sound)}</div>
              )}
              {actualServiceData.luces && (
                <div><strong>{t('common.lights') || 'Luces'}:</strong> {typeof actualServiceData.luces === 'object' ? JSON.stringify(actualServiceData.luces) : String(actualServiceData.luces)}</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // WEEKLY SERVICE RENDERING (preserve existing mobile layout)
  return (
    <div className="space-y-6">
      {/* 9:30 AM Service */}
      {slot930Segments.length > 0 && (
        <Card className="bg-white border-2 border-gray-300 overflow-hidden border-l-4 border-l-red-500">
          <CardHeader className="bg-gradient-to-r from-red-50 to-white border-b">
            <CardTitle className="text-2xl font-bold uppercase text-red-600">9:30 A.M.</CardTitle>
            {/* Pre-service notes */}
            {actualServiceData.pre_service_notes?.['9:30am'] && (
              <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                <p className="text-sm text-green-900 font-medium italic whitespace-pre-wrap">
                  {String(actualServiceData.pre_service_notes['9:30am'])}
                </p>
              </div>
            )}
            {/* Team Info */}
            {(() => {
              const coord = typeof actualServiceData.coordinators === 'object' ? actualServiceData.coordinators?.['9:30am'] : actualServiceData.coordinators;
              const ujieres = typeof actualServiceData.ujieres === 'object' ? actualServiceData.ujieres?.['9:30am'] : actualServiceData.ujieres;
              const sound = typeof actualServiceData.sound === 'object' ? actualServiceData.sound?.['9:30am'] : actualServiceData.sound;
              const lights = typeof actualServiceData.luces === 'object' ? actualServiceData.luces?.['9:30am'] : actualServiceData.luces;
              const foto = typeof actualServiceData.fotografia === 'object' ? actualServiceData.fotografia?.['9:30am'] : actualServiceData.fotografia;
              
              if (!coord && !ujieres && !sound && !lights && !foto) return null;
              
              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                  {coord && <span><strong>👤 Coord:</strong> {String(coord)}</span>}
                  {ujieres && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🚪 Ujieres:</strong> {String(ujieres)}</span>
                    </>
                  )}
                  {sound && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🔊 Sonido:</strong> {String(sound)}</span>
                    </>
                  )}
                  {lights && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>💡 Luces:</strong> {String(lights)}</span>
                    </>
                  )}
                  {foto && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>📸 Foto:</strong> {String(foto)}</span>
                    </>
                  )}
                </div>
              );
            })()}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {slot930Segments.map((segment, idx) => (
                <PublicProgramSegment
                  key={segment.id || `930-${idx}`}
                  segment={segment}
                  isCurrent={false}
                  isUpcoming={false}
                  viewMode="simple"
                  isExpanded={true}
                  alwaysExpanded={true}
                  onToggleExpand={() => {}}
                  onOpenVerses={onOpenVerses}
                  allSegments={slot930Segments}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recess */}
      {actualServiceData.receso_notes && (
        <Card className="bg-gray-50">
          <CardContent className="p-4 text-center">
            <strong>{t('liveView.recess') || 'RECESO (30 min)'}:</strong>
            <p className="text-sm mt-1 text-gray-600">
              {typeof actualServiceData.receso_notes === 'object' 
                ? (actualServiceData.receso_notes['9:30am'] || actualServiceData.receso_notes['11:30am'] || '')
                : String(actualServiceData.receso_notes)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 11:30 AM Service */}
      {slot1130Segments.length > 0 && (
        <Card className="bg-white border-2 border-gray-300 overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b">
            <CardTitle className="text-2xl font-bold uppercase text-blue-600">11:30 A.M.</CardTitle>
            {/* Pre-service notes */}
            {actualServiceData.pre_service_notes?.['11:30am'] && (
              <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                <p className="text-sm text-green-900 font-medium italic whitespace-pre-wrap">
                  {String(actualServiceData.pre_service_notes['11:30am'])}
                </p>
              </div>
            )}
            {/* Team Info */}
            {(() => {
              const coord = typeof actualServiceData.coordinators === 'object' ? actualServiceData.coordinators?.['11:30am'] : actualServiceData.coordinators;
              const ujieres = typeof actualServiceData.ujieres === 'object' ? actualServiceData.ujieres?.['11:30am'] : actualServiceData.ujieres;
              const sound = typeof actualServiceData.sound === 'object' ? actualServiceData.sound?.['11:30am'] : actualServiceData.sound;
              const lights = typeof actualServiceData.luces === 'object' ? actualServiceData.luces?.['11:30am'] : actualServiceData.luces;
              const foto = typeof actualServiceData.fotografia === 'object' ? actualServiceData.fotografia?.['11:30am'] : actualServiceData.fotografia;
              
              if (!coord && !ujieres && !sound && !lights && !foto) return null;
              
              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-700">
                  {coord && <span><strong>👤 Coord:</strong> {String(coord)}</span>}
                  {ujieres && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🚪 Ujieres:</strong> {String(ujieres)}</span>
                    </>
                  )}
                  {sound && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>🔊 Sonido:</strong> {String(sound)}</span>
                    </>
                  )}
                  {lights && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>💡 Luces:</strong> {String(lights)}</span>
                    </>
                  )}
                  {foto && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span><strong>📸 Foto:</strong> {String(foto)}</span>
                    </>
                  )}
                </div>
              );
            })()}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {slot1130Segments.map((segment, idx) => (
                <PublicProgramSegment
                  key={segment.id || `1130-${idx}`}
                  segment={segment}
                  isCurrent={false}
                  isUpcoming={false}
                  viewMode="simple"
                  isExpanded={true}
                  alwaysExpanded={true}
                  onToggleExpand={() => {}}
                  onOpenVerses={onOpenVerses}
                  allSegments={slot1130Segments}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}