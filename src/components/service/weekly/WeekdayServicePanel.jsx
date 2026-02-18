/**
 * WeekdayServicePanel — renders a non-Sunday weekly service.
 *
 * Entity Lift L1.4: Reads Session + Segment entities first.
 * Falls back to Service.segments[] JSON if no entities exist
 * (pre-sync data or failed sync). Read-only overview with
 * "Edit" link to CustomServiceBuilder.
 *
 * Data paths (prioritized):
 *   1. Session/Segment entities (canonical, from syncToSession)
 *   2. Service.segments[] JSON (fallback for pre-sync services)
 *   3. Empty state with edit button
 */

import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, User, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSegmentData } from '@/components/utils/segmentDataUtils';

function formatDuration(min) {
  if (!min) return '';
  return `${min} min`;
}

/**
 * Resolves the primary person from a JSON segment based on its type.
 * Weekly/custom JSON segments store people in data.leader, data.preacher, data.presenter.
 */
function resolvePresenter(seg) {
  const getData = (field) => getSegmentData(seg, field);
  const typeL = (seg.type || seg.segment_type || '').toLowerCase();
  if (typeL === 'worship' || typeL === 'alabanza') return getData('leader') || getData('presenter') || '';
  if (typeL === 'message' || typeL === 'plenaria' || typeL === 'predica') return getData('preacher') || getData('presenter') || '';
  return getData('presenter') || '';
}

export default function WeekdayServicePanel({ service }) {
  const navigate = useNavigate();

  // ── Entity path: Session + Segment entities ──
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['weekdayServiceSessions', service.id],
    queryFn: async () => {
      const s = await base44.entities.Session.filter({ service_id: service.id });
      return s.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    enabled: !!service.id,
    staleTime: 30000,
  });

  const { data: allSegments = [], isLoading: segsLoading } = useQuery({
    queryKey: ['weekdayServiceSegments', service.id, sessions.map(s => s.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }, 'order'))
      );
      return results.flat();
    },
    enabled: sessions.length > 0,
    staleTime: 30000,
  });

  // ── L1.4 Fallback: Service.segments[] JSON ──
  // Used when no Session/Segment entities exist (pre-sync or failed sync).
  const jsonSegments = useMemo(() => {
    if (!service.segments || !Array.isArray(service.segments)) return [];
    return service.segments;
  }, [service.segments]);

  // FIX (2026-02-18): Sessions can exist (from sync) but have zero entity segments.
  // In that case, fall through to JSON fallback if the Service has embedded segments.
  const hasEntitySegments = allSegments.length > 0;
  const hasEntityData = sessions.length > 0 && hasEntitySegments;
  const hasJsonFallback = !hasEntityData && jsonSegments.length > 0;
  const isLoading = sessionsLoading || (hasEntityData && segsLoading);

  if (isLoading) {
    return (
      <Card className="flex-1 min-w-0 w-full p-6 border-2 border-gray-200 bg-white">
        <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      </Card>
    );
  }

  // ── Empty state: no entities AND no JSON segments ──
  if (!hasEntityData && !hasJsonFallback) {
    return (
      <Card className="flex-1 min-w-0 w-full p-4 border-2 border-gray-200 bg-white">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{service.name || 'Servicio'}</h3>
        <p className="text-sm text-gray-500 mb-1">Fecha: {service.date}</p>
        {service.time && <p className="text-sm text-gray-500 mb-2">Hora: {service.time}</p>}
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="outline" className="text-xs">{service.status || 'active'}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-xs gap-1"
            onClick={() => navigate(createPageUrl('CustomServiceBuilder') + `?id=${service.id}`)}
          >
            <ExternalLink className="w-3 h-3" />
            Editar
          </Button>
        </div>
      </Card>
    );
  }

  // ── JSON Fallback rendering ──
  // Renders Service.segments[] directly when no entity sync has occurred.
  if (hasJsonFallback) {
    return (
      <Card className="flex-1 min-w-0 w-full border-2 border-gray-200 bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900">
              {service.name || 'Servicio'}
            </CardTitle>
            <p className="text-xs text-gray-500">{service.date}{service.time ? ` · ${service.time}` : ''}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => navigate(createPageUrl('CustomServiceBuilder') + `?id=${service.id}`)}
          >
            <ExternalLink className="w-3 h-3" />
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="min-w-[250px]">
            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-200">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                {service.time || 'Programa'}
              </span>
              <Badge variant="outline" className="text-[10px] ml-auto bg-amber-50 border-amber-200 text-amber-700">
                {jsonSegments.length} segmentos
              </Badge>
            </div>
            <div className="space-y-1.5">
              {jsonSegments.map((seg, idx) => {
                const presenter = resolvePresenter(seg);
                return (
                  <div
                    key={seg._uiId || `json-seg-${idx}`}
                    className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-100 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{seg.title || 'Sin título'}</p>
                      {presenter && (
                        <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {presenter}
                        </p>
                      )}
                    </div>
                    <div className="text-gray-400 whitespace-nowrap">
                      {formatDuration(seg.duration)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Entity rendering (primary path) ──
  return (
    <Card className="flex-1 min-w-0 w-full border-2 border-gray-200 bg-white">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold text-gray-900">
            {service.name || 'Servicio'}
          </CardTitle>
          <p className="text-xs text-gray-500">{service.date}{service.time ? ` · ${service.time}` : ''}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1"
          onClick={() => navigate(createPageUrl('CustomServiceBuilder') + `?id=${service.id}`)}
        >
          <ExternalLink className="w-3 h-3" />
          Editar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-x-auto">
          {sessions.map(session => {
            const segs = allSegments
              .filter(s => s.session_id === session.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            return (
              <div key={session.id} className="min-w-[250px] flex-1">
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-200">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">
                    {session.name || session.planned_start_time || 'Sesión'}
                  </span>
                  {session.coordinators && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {session.coordinators}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  {segs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Sin segmentos</p>
                  ) : (
                    segs.map(seg => (
                      <div
                        key={seg.id}
                        className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-100 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{seg.title}</p>
                          {seg.presenter && (
                            <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" />
                              {seg.presenter}
                            </p>
                          )}
                        </div>
                        <div className="text-gray-400 whitespace-nowrap flex flex-col items-end">
                          {seg.start_time && (
                            <span>{seg.start_time}</span>
                          )}
                          <span>{formatDuration(seg.duration_min)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}