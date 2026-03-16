/**
 * PublicArtsForm.js
 * 
 * PUBLIC React page for Arts Directors to submit technical/creative details.
 * Hybrid UX refactor (2026-02-28): Orchestrates progress strip, sticky save bar,
 * and managed open/active accordion state.
 * 
 * Data: getArtsFormData (JSON API), submission: submitArtsSegment.
 * Public route — no auth required. Accepts ?event_id=xxx query param.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ArtsFormHeader from '@/components/publicforms/ArtsFormHeader';
import ArtsGateForm from '@/components/publicforms/ArtsGateForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorCard from '@/components/ui/ErrorCard';
import ArtsSegmentAccordion, { calcSegmentStatus } from '@/components/publicforms/ArtsSegmentAccordion';
import ArtsProgressStrip from '@/components/publicforms/ArtsProgressStrip';
import ArtsStickyBar from '@/components/publicforms/ArtsStickyBar';
import ArtsChangeHistory from '@/components/publicforms/ArtsChangeHistory';
import { PublicFormLangProvider, usePublicLang } from '@/components/publicforms/PublicFormLangContext';
import PublicFormLangToggle from '@/components/publicforms/PublicFormLangToggle';
import EventClosedNotice from '@/components/publicforms/EventClosedNotice';
import ArtsReportSegmentCard from '@/components/arts/ArtsReportSegmentCard';
import { Printer } from 'lucide-react';

/**
 * PERF-FIX (2026-03-03): Show gate form immediately while data loads in background.
 * Previously the user saw a full-page spinner for 10-26s on cold starts.
 * Now gate + data load happen in parallel — user fills in name/email while
 * segments load. If gate is passed before data arrives, a small spinner shows.
 */
export default function PublicArtsForm() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [event, setEvent] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isUnica, setIsUnica] = useState(false);
  const [gateUser, setGateUser] = useState(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('event_id');
      const payload = {};
      if (eventId) payload.event_id = eventId;

      const response = await base44.functions.invoke('getArtsFormData', payload);
      const data = response.data;

      if (data.closed) {
        setEvent(data.event);
        setClosed(true);
      } else if (data.error && !data.event) {
        setError(data.error);
      } else {
        setEvent(data.event);
        setSegments(data.segments || []);
        setIsUnica(data.isUnicaEvent || false);
        base44.analytics.track({
          eventName: 'arts_form_loaded',
          properties: { segment_count: (data.segments || []).length, event_name: data.event?.name || '' }
        });
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // 2026-03-16: Closed event — show gentle notice instead of form
  if (!loading && closed) {
    return (
      <PublicFormLangProvider>
        <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-[720px]">
            <EventClosedNotice event={event} />
          </div>
        </div>
      </PublicFormLangProvider>
    );
  }

  // Hard error: no event found at all (only show after loading finishes)
  if (!loading && error) {
    return (
      <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[720px]">
          <ArtsFormHeader event={null} />
          <ErrorCard message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <PublicFormLangProvider>
      <div className="min-h-screen bg-[#F0F1F3] p-4 md:p-8">
        <div className="w-full max-w-[720px] mx-auto">
          <div className="flex justify-between items-center mb-2">
            {/* Print button — only useful after gate is passed and segments are loaded */}
            {gateUser && !loading && segments.length > 0 ? (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors print:hidden"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir reporte
              </button>
            ) : (
              <span />
            )}
            <PublicFormLangToggle />
          </div>
          {/* Show header with event info once loaded, or placeholder header while loading */}
          <ArtsFormHeader event={event} />

          {!gateUser ? (
            /* Gate shows immediately — no need to wait for data */
            <ArtsGateForm onEnter={setGateUser} />
          ) : loading ? (
            /* User passed gate but data still loading — brief spinner */
            <LoadingSpinner size="fullPage" label="Cargando segmentos..." />
          ) : (
            <>
              <ArtsFormContent segments={segments} gateUser={gateUser} isUnica={isUnica} eventId={event?.id} />

              {/* Print-only report: hidden on screen, shown when printing.
                  Uses ArtsReportSegmentCard (read-only, dense, print-optimized).
                  All segments expand fully — no accordion state needed. */}
              <div className="hidden print:block">
                <div className="text-center mb-4 border-b border-gray-400 pb-2">
                  <div className="text-2xl font-bold uppercase tracking-widest">{event?.name}</div>
                  <div className="text-sm text-gray-500">Artes — Reporte de Producción</div>
                </div>
                {segments.map(seg => (
                  <ArtsReportSegmentCard key={seg.id} seg={seg} sessionName={seg.session_name} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicFormLangProvider>
  );
}

/**
 * ArtsFormContent — manages accordion open state, progress strip, and sticky save bar.
 * Extracted so it can use lang context inside the provider.
 * 
 * 2026-02-28 audit fixes:
 * - Progress strip status is now live (segmentSnapshots updated by children on every field edit)
 * - handleSave exposed from children is stable (useCallback + ref pattern in accordion)
 * - Sticky bar correctly wired via save state collection
 */
function ArtsFormContent({ segments: initialSegments, gateUser, isUnica, eventId }) {
  const { t } = usePublicLang();
  const [openSegmentId, setOpenSegmentId] = useState(null);
  const [saveStates, setSaveStates] = useState({}); // { [segId]: { saving, saveMsg, handleSave, segmentTitle } }
  // Live snapshots of each segment's art data for progress strip status calculation.
  // Keyed by segment id, seeded from initialSegments, updated by children via onSegmentDataChange.
  const [segmentSnapshots, setSegmentSnapshots] = useState(() => {
    const map = {};
    initialSegments.forEach(s => { map[s.id] = s; });
    return map;
  });

  // Toggle accordion: only one open at a time
  const handleToggle = useCallback((segId) => {
    setOpenSegmentId(prev => prev === segId ? null : segId);
  }, []);

  // Progress strip tap: open that segment and scroll to it
  const handleStripTap = useCallback((segId) => {
    setOpenSegmentId(segId);
    // Scroll after React renders the opened accordion
    setTimeout(() => {
      const el = document.getElementById(`seg-${segId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // Collect save state from children for the sticky bar
  const handleSaveStateChange = useCallback((segId, state) => {
    setSaveStates(prev => ({ ...prev, [segId]: state }));
  }, []);

  // Receive live data snapshot from each accordion child (called on every field edit)
  const handleSegmentDataChange = useCallback((segId, data) => {
    setSegmentSnapshots(prev => ({ ...prev, [segId]: data }));
  }, []);

  // Build progress strip data from live snapshots
  const stripData = initialSegments.map(seg => {
    const liveSeg = segmentSnapshots[seg.id] || seg;
    const status = calcSegmentStatus(liveSeg);
    return { id: seg.id, title: seg.title, statusLevel: status.level };
  });

  // Active segment's save state (for sticky bar)
  const activeSave = openSegmentId ? saveStates[openSegmentId] : null;

  return (
    <>
      {/* Single guidance banner at the top — no duplicates inside accordions */}
      <div className="bg-white rounded-lg border border-gray-200 border-l-4 p-4 mb-4 text-sm text-gray-500 leading-relaxed" style={{ borderLeftColor: '#8DC63F' }}>
        {t(
          'Abra cada segmento para ingresar los detalles. Suba únicamente material final listo para proyección. Puede guardar progreso parcial y regresar luego.',
          'Open each segment to enter details. Upload only final material ready for projection. You can save partial progress and return later.'
        )}
      </div>

      {/* Change history — collapsible panel for collaborative visibility */}
      {eventId && <ArtsChangeHistory eventId={eventId} />}

      {/* Progress strip — scrollable pill bar for quick navigation */}
      <ArtsProgressStrip segments={stripData} activeSegmentId={openSegmentId} onSegmentTap={handleStripTap} />

      {initialSegments.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <h2 className="text-2xl text-gray-500 mb-2">{t('NO HAY SEGMENTOS DE ARTES', 'NO ARTS SEGMENTS')}</h2>
          <p>{t('No se encontraron segmentos de tipo "Artes" para este evento.', 'No "Arts" type segments were found for this event.')}</p>
        </div>
      ) : (
        <div className="mt-3">
          {initialSegments.map(seg => (
            <ArtsSegmentAccordion
              key={seg.id}
              segment={seg}
              submitterName={gateUser.name}
              submitterEmail={gateUser.email}
              honeypot={gateUser.website || ''}
              isUnica={isUnica}
              isOpen={openSegmentId === seg.id}
              onToggle={handleToggle}
              onSaveStateChange={handleSaveStateChange}
              onSegmentDataChange={handleSegmentDataChange}
            />
          ))}
        </div>
      )}

      {/* Sticky save bar — appears when a segment is open */}
      <ArtsStickyBar
        segmentTitle={activeSave?.segmentTitle || null}
        saving={activeSave?.saving || false}
        onSave={activeSave?.handleSave || (() => {})}
        saveMsg={activeSave?.saveMsg || null}
      />
    </>
  );
}