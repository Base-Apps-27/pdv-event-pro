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
  serviceData, 
  serviceType, // "weekly" | "custom"
  liveAdjustments,
  currentTime 
}) {
  const { t } = useLanguage();

  // Apply live adjustments to segments
  const { slot930Segments, slot1130Segments, customSegments } = useMemo(() => {
    if (serviceType === 'weekly' && serviceData['9:30am'] && serviceData['11:30am']) {
      return {
        slot930Segments: applyLiveAdjustments(
          serviceData['9:30am'], 
          liveAdjustments, 
          'weekly', 
          '9:30am'
        ),
        slot1130Segments: applyLiveAdjustments(
          serviceData['11:30am'], 
          liveAdjustments, 
          'weekly', 
          '11:30am'
        ),
        customSegments: []
      };
    } else if (serviceType === 'custom' && serviceData.segments) {
      return {
        slot930Segments: [],
        slot1130Segments: [],
        customSegments: applyLiveAdjustments(
          serviceData.segments,
          liveAdjustments,
          'custom'
        )
      };
    }
    return { slot930Segments: [], slot1130Segments: [], customSegments: [] };
  }, [serviceData, liveAdjustments, serviceType]);

  // Empty state
  if (!serviceData || (!slot930Segments.length && !slot1130Segments.length && !customSegments.length)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">
          {t('liveView.noServiceData') || 'No hay datos de servicio disponibles'}
        </p>
      </div>
    );
  }

  // CUSTOM SERVICE RENDERING
  if (serviceType === 'custom') {
    return (
      <div className="space-y-4">
        {/* Live Status Card */}
        <LiveStatusCard 
          segments={customSegments}
          currentTime={currentTime}
          serviceDate={serviceData.date}
          liveAdjustmentEnabled={liveAdjustments?.length > 0}
        />

        {/* Service Info */}
        {serviceData.name && (
          <Card>
            <CardHeader>
              <CardTitle>{serviceData.name}</CardTitle>
              {serviceData.description && (
                <p className="text-sm text-muted-foreground">{serviceData.description}</p>
              )}
            </CardHeader>
          </Card>
        )}

        {/* Segments */}
        <div className="space-y-3">
          {customSegments.map((segment, idx) => (
            <PublicProgramSegment
              key={segment.id || idx}
              segment={segment}
              isCurrent={false}
              isUpcoming={false}
              viewMode="simple"
              alwaysExpanded={true}
            />
          ))}
        </div>

        {/* Team Info (if present) */}
        {(serviceData.coordinators || serviceData.sound || serviceData.luces) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{t('common.team') || 'Equipo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {serviceData.coordinators && (
                <div><strong>{t('common.coordinators') || 'Coordinadores'}:</strong> {typeof serviceData.coordinators === 'object' ? JSON.stringify(serviceData.coordinators) : String(serviceData.coordinators)}</div>
              )}
              {serviceData.sound && (
                <div><strong>{t('common.sound') || 'Sonido'}:</strong> {typeof serviceData.sound === 'object' ? JSON.stringify(serviceData.sound) : String(serviceData.sound)}</div>
              )}
              {serviceData.luces && (
                <div><strong>{t('common.lights') || 'Luces'}:</strong> {typeof serviceData.luces === 'object' ? JSON.stringify(serviceData.luces) : String(serviceData.luces)}</div>
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
        <Card>
          <CardHeader className="gradient-pdv text-white">
            <CardTitle>9:30 AM</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Live Status */}
            <LiveStatusCard 
              segments={slot930Segments}
              currentTime={currentTime}
              serviceDate={serviceData.date}
              liveAdjustmentEnabled={liveAdjustments?.length > 0}
            />

            {/* Pre-service notes */}
            {serviceData.pre_service_notes?.['9:30am'] && (
              <div className="text-sm bg-blue-50 p-3 rounded">
                <strong>{t('liveView.preServiceNotes') || 'Notas Pre-Servicio'}:</strong>
                <p className="mt-1">{String(serviceData.pre_service_notes['9:30am'])}</p>
              </div>
            )}

            {/* Segments */}
            {slot930Segments.map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || `930-${idx}`}
                segment={segment}
                isCurrent={false}
                isUpcoming={false}
                viewMode="simple"
                alwaysExpanded={true}
              />
            ))}

            {/* Team assignments */}
            {(() => {
              const coord = typeof serviceData.coordinators === 'object' ? serviceData.coordinators?.['9:30am'] : serviceData.coordinators;
              const sound = typeof serviceData.sound === 'object' ? serviceData.sound?.['9:30am'] : serviceData.sound;
              const lights = typeof serviceData.luces === 'object' ? serviceData.luces?.['9:30am'] : serviceData.luces;
              
              if (!coord && !sound && !lights) return null;
              
              return (
                <div className="mt-4 pt-4 border-t text-sm space-y-1">
                  {coord && (
                    <div><strong>{t('common.coordinators') || 'Coordinadores'}:</strong> {String(coord)}</div>
                  )}
                  {sound && (
                    <div><strong>{t('common.sound') || 'Sonido'}:</strong> {String(sound)}</div>
                  )}
                  {lights && (
                    <div><strong>{t('common.lights') || 'Luces'}:</strong> {String(lights)}</div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Recess */}
      {serviceData.receso_notes && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <strong>{t('liveView.recess') || 'RECESO'}:</strong>
            <p className="text-sm mt-1">
              {typeof serviceData.receso_notes === 'object' 
                ? (serviceData.receso_notes['9:30am'] || serviceData.receso_notes['11:30am'] || '')
                : String(serviceData.receso_notes)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 11:30 AM Service */}
      {slot1130Segments.length > 0 && (
        <Card>
          <CardHeader className="gradient-pdv text-white">
            <CardTitle>11:30 AM</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Live Status */}
            <LiveStatusCard 
              segments={slot1130Segments}
              currentTime={currentTime}
              serviceDate={serviceData.date}
              liveAdjustmentEnabled={liveAdjustments?.length > 0}
            />

            {/* Pre-service notes */}
            {serviceData.pre_service_notes?.['11:30am'] && (
              <div className="text-sm bg-blue-50 p-3 rounded">
                <strong>{t('liveView.preServiceNotes') || 'Notas Pre-Servicio'}:</strong>
                <p className="mt-1">{String(serviceData.pre_service_notes['11:30am'])}</p>
              </div>
            )}

            {/* Segments */}
            {slot1130Segments.map((segment, idx) => (
              <PublicProgramSegment
                key={segment.id || `1130-${idx}`}
                segment={segment}
                isCurrent={false}
                isUpcoming={false}
                viewMode="simple"
                alwaysExpanded={true}
              />
            ))}

            {/* Team assignments */}
            {(() => {
              const coord = typeof serviceData.coordinators === 'object' ? serviceData.coordinators?.['11:30am'] : serviceData.coordinators;
              const sound = typeof serviceData.sound === 'object' ? serviceData.sound?.['11:30am'] : serviceData.sound;
              const lights = typeof serviceData.luces === 'object' ? serviceData.luces?.['11:30am'] : serviceData.luces;
              
              if (!coord && !sound && !lights) return null;
              
              return (
                <div className="mt-4 pt-4 border-t text-sm space-y-1">
                  {coord && (
                    <div><strong>{t('common.coordinators') || 'Coordinadores'}:</strong> {String(coord)}</div>
                  )}
                  {sound && (
                    <div><strong>{t('common.sound') || 'Sonido'}:</strong> {String(sound)}</div>
                  )}
                  {lights && (
                    <div><strong>{t('common.lights') || 'Luces'}:</strong> {String(lights)}</div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}