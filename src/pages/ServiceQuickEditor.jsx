/**
 * ServiceQuickEditor — Temporary Debug Tool
 * PURPOSE: Allow admin to select ANY service or event and view its
 * program on the MyProgram-style display. Bypasses auto-detection
 * constraints to diagnose segment ordering, session order, and data integrity.
 *
 * ACCESS: Admin only.
 * LIFESPAN: Temporary — remove once display bugs are resolved.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/utils/useCurrentUser';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Monitor, Smartphone, AlertTriangle, Loader2, Calendar, Search, Eye } from 'lucide-react';

export default function ServiceQuickEditor() {
  const { user } = useCurrentUser();
  const [selectedType, setSelectedType] = useState('service');
  const [selectedId, setSelectedId] = useState('');

  // Fetch all services (recent 60)
  const { data: services = [], isLoading: svcLoading } = useQuery({
    queryKey: ['debugServices'],
    queryFn: () => base44.entities.Service.list('-date', 60),
  });

  // Fetch all events (recent 30)
  const { data: events = [], isLoading: evtLoading } = useQuery({
    queryKey: ['debugEvents'],
    queryFn: () => base44.entities.Event.list('-start_date', 30),
  });

  // Filter out blueprints from services
  const filteredServices = useMemo(() =>
    services.filter(s => s.status !== 'blueprint' && s.date),
    [services]
  );

  // Fetch sessions + segments for selected item (diagnostic)
  const { data: diagnosticData, isLoading: diagLoading } = useQuery({
    queryKey: ['debugDiagnostic', selectedType, selectedId],
    queryFn: async () => {
      if (!selectedId) return null;

      let sessions, segments;
      if (selectedType === 'service') {
        sessions = await base44.entities.Session.filter({ service_id: selectedId });
        const segArrays = await Promise.all(
          sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }))
        );
        segments = segArrays.flat();
      } else {
        sessions = await base44.entities.Session.filter({ event_id: selectedId });
        const segArrays = await Promise.all(
          sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }))
        );
        segments = segArrays.flat();
      }

      // Sort sessions by order
      sessions.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Sort segments by session order then segment order
      const sessOrderMap = new Map(sessions.map((s, i) => [s.id, i]));
      segments.sort((a, b) => {
        const sA = sessOrderMap.get(a.session_id) ?? 999;
        const sB = sessOrderMap.get(b.session_id) ?? 999;
        if (sA !== sB) return sA - sB;
        return (a.order || 0) - (b.order || 0);
      });

      return { sessions, segments };
    },
    enabled: !!selectedId,
  });

  // Build links
  const myProgramUrl = selectedId
    ? createPageUrl('MyProgram') + `?${selectedType === 'service' ? 'override_service_id' : 'override_event_id'}=${selectedId}`
    : null;

  const publicViewUrl = selectedId
    ? createPageUrl('PublicProgramView') + `?${selectedType === 'service' ? 'serviceId' : 'eventId'}=${selectedId}`
    : null;

  // TV Display override uses same param names as MyProgram
  const tvDisplayUrl = selectedId
    ? createPageUrl('PublicCountdownDisplay') + `?${selectedType === 'service' ? 'override_service_id' : 'override_event_id'}=${selectedId}`
    : null;

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-600 font-bold">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Search className="w-6 h-6 text-pdv-teal" />
        <h1 className="text-2xl text-gray-900">Program Debug Viewer</h1>
        <Badge className="bg-orange-500 text-white">Temp Tool</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">1. Select Program Type & Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setSelectedId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={svcLoading || evtLoading ? 'Loading...' : 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {selectedType === 'service' && filteredServices.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.date} — {s.name} ({s.day_of_week})
                  </SelectItem>
                ))}
                {selectedType === 'event' && events.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.start_date} — {e.name} ({e.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* View Links */}
      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">2. Open Views</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              onClick={() => window.open(myProgramUrl, '_blank')}
              className="bg-pdv-teal hover:bg-pdv-teal/90 text-white"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              MyProgram (Override)
            </Button>
            <Button
              onClick={() => window.open(tvDisplayUrl, '_blank')}
              variant="outline"
              className="border-purple-500 text-purple-600"
            >
              <Monitor className="w-4 h-4 mr-2" />
              TV Display (Override)
            </Button>
            <Button
              onClick={() => window.open(publicViewUrl, '_blank')}
              variant="outline"
              className="border-blue-500 text-blue-600"
            >
              <Eye className="w-4 h-4 mr-2" />
              Public Program View
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Diagnostic Data */}
      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">3. Diagnostic: Sessions & Segments</CardTitle>
          </CardHeader>
          <CardContent>
            {diagLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
            {diagnosticData && (
              <div className="space-y-4">
                {/* Sessions */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">SESSIONS ({diagnosticData.sessions.length})</h3>
                  <div className="space-y-1">
                    {diagnosticData.sessions.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                        <Badge variant="outline" className="text-[10px]">#{i} order={s.order ?? 'null'}</Badge>
                        <span className="font-bold">{s.name}</span>
                        <span className="text-gray-500">{s.planned_start_time || '—'}</span>
                        <span className="text-gray-400 text-[10px] ml-auto truncate max-w-[120px]">{s.id}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segments grouped by session */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">SEGMENTS ({diagnosticData.segments.length})</h3>
                  {diagnosticData.sessions.map((session, sIdx) => {
                    const segs = diagnosticData.segments.filter(seg => seg.session_id === session.id && !seg.parent_segment_id);
                    return (
                      <div key={session.id} className="mb-3">
                        <div className="text-xs font-bold text-blue-700 mb-1">
                          Session #{sIdx}: {session.name} (order={session.order ?? 'null'})
                        </div>
                        <div className="space-y-0.5 ml-3">
                          {segs.map((seg, idx) => {
                            const isWrongOrder = idx > 0 && (seg.order || 0) < (segs[idx - 1].order || 0);
                            return (
                              <div key={seg.id} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${isWrongOrder ? 'bg-red-50 border border-red-300' : 'bg-white border border-gray-100'}`}>
                                <Badge variant="outline" className={`text-[9px] ${isWrongOrder ? 'border-red-400 text-red-600' : ''}`}>
                                  order={seg.order ?? 'null'}
                                </Badge>
                                <span className="font-medium">{seg.title}</span>
                                <Badge variant="outline" className="text-[9px] text-gray-500">{seg.segment_type}</Badge>
                                <span className="text-gray-400">{seg.start_time || '—'}–{seg.end_time || '—'}</span>
                                <span className="text-gray-400">{seg.duration_min || 0}m</span>
                                {isWrongOrder && <AlertTriangle className="w-3 h-3 text-red-500" />}
                              </div>
                            );
                          })}
                          {segs.length === 0 && <span className="text-xs text-gray-400 italic">No segments</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}