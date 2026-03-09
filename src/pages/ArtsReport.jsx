/**
 * ArtsReport.jsx
 * 2026-03-09: Print-optimized arts report for events.
 * Not a run-of-show — organized by segment, all art type sections fully expanded.
 * Designed to replace the "print the screen" workaround that Arts Admin was using.
 * 
 * Data flow: Event → Sessions → Segments (filtered to art_types.length > 0) → grouped by session
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/utils/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Palette, Printer, Calendar } from 'lucide-react';
import ArtsReportSegmentCard from '@/components/arts/ArtsReportSegmentCard';

export default function ArtsReport() {
  const { language } = useLanguage();
  const [selectedEventId, setSelectedEventId] = useState('');

  // ── Events dropdown ──
  const { data: events = [] } = useQuery({
    queryKey: ['events-for-arts-report'],
    queryFn: () => base44.entities.Event.list('-start_date', 40),
  });

  // ── Sessions for selected event ──
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions-for-arts-report', selectedEventId],
    queryFn: () => base44.entities.Session.filter({ event_id: selectedEventId }, 'order'),
    enabled: !!selectedEventId,
  });

  // ── Segments for all sessions ──
  const sessionIds = sessions.map(s => s.id);
  const { data: allSegments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ['segments-for-arts-report', sessionIds.join(',')],
    queryFn: async () => {
      if (!sessionIds.length) return [];
      const results = await Promise.all(
        sessionIds.map(sid => base44.entities.Segment.filter({ session_id: sid }, 'order'))
      );
      return results.flat();
    },
    enabled: sessionIds.length > 0,
  });

  // ── Filter to arts segments only ──
  const artsSegments = useMemo(
    () => allSegments.filter(s => s.art_types && s.art_types.length > 0),
    [allSegments]
  );

  // ── Session lookup map ──
  const sessionMap = useMemo(() => {
    const m = {};
    sessions.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [sessions]);

  // ── Group by session for display ──
  const groupedBySession = useMemo(() => {
    const groups = {};
    artsSegments.forEach(seg => {
      const sName = sessionMap[seg.session_id] || 'Sesión';
      if (!groups[sName]) groups[sName] = [];
      groups[sName].push(seg);
    });
    return groups;
  }, [artsSegments, sessionMap]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const totalTypes = [...new Set(artsSegments.flatMap(s => s.art_types || []))];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Print styles — these are scoped to this page render */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, html { background: white !important; }
          .brand-gradient { background: #1a1a1a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: letter; margin: 0.5in; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Screen header ── */}
      <div className="no-print mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center brand-gradient shrink-0">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl tracking-wider">
              {language === 'es' ? 'REPORTE DE ARTES' : 'ARTS REPORT'}
            </h1>
            <p className="text-sm text-gray-500">
              {language === 'es'
                ? 'Vista completa por evento · optimizado para imprimir'
                : 'Full detail view by event · print-optimized'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder={language === 'es' ? 'Seleccionar evento...' : 'Select event...'} />
            </SelectTrigger>
            <SelectContent>
              {events.map(ev => (
                <SelectItem key={ev.id} value={ev.id}>{ev.name} {ev.year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEventId && artsSegments.length > 0 && (
            <Button onClick={() => window.print()} variant="outline" className="gap-2 shrink-0">
              <Printer className="w-4 h-4" />
              {language === 'es' ? 'Imprimir / Exportar PDF' : 'Print / Export PDF'}
            </Button>
          )}
        </div>

        {/* Stats bar */}
        {artsSegments.length > 0 && !segmentsLoading && (
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
            <span><strong className="text-gray-900">{artsSegments.length}</strong> {language === 'es' ? 'segmentos de artes' : 'arts segments'}</span>
            <span><strong className="text-gray-900">{Object.keys(groupedBySession).length}</strong> {language === 'es' ? 'sesiones' : 'sessions'}</span>
            {totalTypes.length > 0 && (
              <span className="text-gray-400">
                {totalTypes.join(' · ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Print-only document header ── */}
      <div className="print-only mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">
              {language === 'es' ? 'Reporte de Artes' : 'Arts Report'}
            </h1>
            {selectedEvent && (
              <div className="text-lg font-semibold mt-0.5">{selectedEvent.name} {selectedEvent.year}</div>
            )}
          </div>
          <div className="text-xs text-gray-500 text-right">
            <div>Generado / Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div className="mt-0.5">{artsSegments.length} {language === 'es' ? 'segmentos' : 'segments'}</div>
          </div>
        </div>
      </div>

      {/* ── Empty states ── */}
      {!selectedEventId && (
        <div className="text-center py-16 text-gray-400 no-print">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-base">
            {language === 'es' ? 'Selecciona un evento para comenzar' : 'Select an event to get started'}
          </p>
          <p className="text-sm mt-1">
            {language === 'es' ? 'El reporte mostrará todos los segmentos con datos de artes' : 'The report will show all segments with arts data'}
          </p>
        </div>
      )}

      {selectedEventId && segmentsLoading && (
        <div className="text-center py-12 text-gray-400 no-print">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1F8A70] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">{language === 'es' ? 'Cargando segmentos...' : 'Loading segments...'}</p>
        </div>
      )}

      {selectedEventId && !segmentsLoading && artsSegments.length === 0 && sessions.length > 0 && (
        <div className="text-center py-12 text-gray-400 no-print">
          <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {language === 'es' ? 'No hay segmentos de artes en este evento' : 'No arts segments found for this event'}
          </p>
          <p className="text-sm mt-1 text-gray-400">
            {language === 'es'
              ? 'Los segmentos con tipos de arte (danza, drama, video, etc.) aparecerán aquí'
              : 'Segments with art types (dance, drama, video, etc.) will appear here'}
          </p>
        </div>
      )}

      {/* ── Report content: grouped by session ── */}
      {Object.entries(groupedBySession).map(([sessionName, segs]) => (
        <div key={sessionName} className="mb-8">
          {/* Session divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gray-200" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2 shrink-0">
              {sessionName}
            </h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {segs.map(seg => (
            <ArtsReportSegmentCard
              key={seg.id}
              seg={seg}
              sessionName={sessionName}
            />
          ))}
        </div>
      ))}
    </div>
  );
}