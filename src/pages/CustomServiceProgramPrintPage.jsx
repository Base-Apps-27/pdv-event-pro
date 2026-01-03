import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAutoFitPrint } from '@/components/print/useAutoFitPrint';
import { getSegmentData } from '@/components/utils/segmentDataUtils';
import { addMinutes, parse, format as formatFns } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';


/**
 * CustomServiceProgramPrintPage
 * 
 * CRITICAL DESIGN RULE: This component renders EXACTLY the same visual layout as the existing
 * CustomServiceBuilder print output. NO redesign allowed. Only architectural changes for reliability.
 * 
 * FLOW:
 * 1. Fetch service by ID from URL params
 * 2. Load stored print_settings_page1 or use defaults
 * 3. Render program using IDENTICAL markup to existing print layout
 * 4. useAutoFitPrint hook measures overflow and adjusts font scales automatically
 * 5. Trigger window.print() when ready
 * 6. Optionally auto-close tab after print
 * 
 * SAFARI COMPATIBILITY:
 * - Dedicated route (no app chrome)
 * - Scoped print CSS (printStyles.css)
 * - No CSS transforms (only font-size scaling)
 * - Single page guarantee (no forced page breaks)
 */
export default function CustomServiceProgramPrintPage() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  
  const [authReady, setAuthReady] = useState(false);
  const [service, setService] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const contentRef = useRef(null);

  // Default settings (fallback if no stored settings)
  const DEFAULT_SETTINGS = {
    globalScale: 1.0,
    margins: {
      top: "0.25in",
      right: "0.25in",
      bottom: "0.25in",
      left: "0.25in"
    },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  // CRITICAL: Check authentication before fetching data
  // Print routes require auth to access user-specific service data
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        if (!authenticated) {
          // Redirect to login with clean from_url (prevents infinite nesting)
          const currentUrl = window.location.pathname + window.location.search;
          window.location.href = `/login?from_url=${encodeURIComponent(currentUrl)}`;
          return;
        }
        setAuthReady(true);
      } catch (err) {
        console.error('[PRINT] Auth check failed:', err);
        setFetchError('Authentication required');
      }
    };
    checkAuth();
  }, []);

  // Fetch service data ONLY after auth is confirmed ready
  useEffect(() => {
    if (!authReady) return;

    const fetchService = async () => {
      try {
        if (!serviceId) {
          setFetchError('No service ID provided');
          return;
        }

        const services = await base44.entities.Service.filter({ id: serviceId });
        if (!services || services.length === 0) {
          setFetchError('Service not found');
          return;
        }

        setService(services[0]);
      } catch (err) {
        console.error('[PRINT PAGE] Failed to fetch service:', err);
        setFetchError(err.message);
      }
    };

    fetchService();
  }, [authReady, serviceId]);

  // Get initial settings from service or use defaults
  const initialSettings = service?.print_settings_page1 || DEFAULT_SETTINGS;

  // Auto-fit hook (runs after service loads)
  const { loading, settings, error } = useAutoFitPrint(
    contentRef,
    initialSettings,
    () => {
      // Optional: auto-close tab after print (best-effort, may be blocked)
      setTimeout(() => {
        window.close();
      }, 500);
    }
  );

  // Show loading/error states
  if (fetchError) {
    return (
      <div className="print-loading">
        Error: {fetchError}
      </div>
    );
  }

  if (!service) {
    return (
      <div className="print-loading">
        Cargando servicio...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="print-loading">
        Preparando impresión...
      </div>
    );
  }

  if (error) {
    return (
      <div className="print-loading">
        Advertencia: {error}
        <br />
        <small>Imprimiendo de todos modos...</small>
      </div>
    );
  }

  // Parse margins for layout
  const parseMargin = (marginStr) => {
    if (!marginStr) return 0;
    const value = parseFloat(marginStr);
    if (marginStr.includes('in')) return value * 96;
    if (marginStr.includes('cm')) return value * 37.8;
    if (marginStr.includes('mm')) return value * 3.78;
    if (marginStr.includes('pt')) return value * 1.33;
    return value;
  };

  const marginTopPx = parseMargin(settings.margins.top);
  const marginRightPx = parseMargin(settings.margins.right);
  const marginBottomPx = parseMargin(settings.margins.bottom);
  const marginLeftPx = parseMargin(settings.margins.left);

  const PAGE_W = 8.5 * 96;
  const PAGE_H = 11 * 96;
  const HEADER_H = 65;
  const FOOTER_H = 24;

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const localDate = new Date(y, m - 1, d);
      return formatFns(localDate, "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0 !important; }
          html, body { margin: 0 !important; padding: 0 !important; width: 8.5in; height: auto !important; overflow: visible !important; background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > *:not(.print-page-root) { display: none !important; }
          .print-page-root { display: block !important; position: relative !important; width: 8.5in !important; height: 11in !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; page-break-after: avoid !important; page-break-inside: avoid !important; break-after: avoid !important; break-inside: avoid !important; }
          .print-page-root * { max-height: none !important; }
          .print-page-root::after { content: none !important; }
          * { overflow: visible !important; }
          .print-segment { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-footer { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #1F8A70 !important; background-image: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) !important; color: white !important; }
          .print-logo img { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-loading { display: none !important; }
        }
        @media screen {
          .print-page-root { display: block; width: 8.5in; margin: 0 auto; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .print-loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; z-index: 9999; }
        }
      `}</style>
      <div className="print-page-root" style={{ width: `${PAGE_W}px`, height: `${PAGE_H}px`, position: 'relative', overflow: 'hidden', background: 'white' }}>
        
        {/* HEADER - Fixed, Not Scaled */}
        <div style={{ 
          position: 'absolute', 
          top: `${marginTopPx}px`, 
          left: `${marginLeftPx}px`, 
          right: `${marginRightPx}px`, 
          height: `${HEADER_H}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #e5e7eb'
        }}>
          {/* Logo - Print Only */}
          <div className="print-logo" style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}>
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
              alt="Logo" 
              style={{ width: '60px', height: '60px' }}
            />
          </div>

          {/* Title */}
          <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: 1.2, textAlign: 'center' }}>
            {service.name || "Orden de Servicio"}
          </div>
          
          {/* Date/Time */}
          <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px', textAlign: 'center' }}>
            {service.day_of_week} {formatDate(service.date)} {service.time && `• ${service.time}`}
          </div>

          {/* Team Info */}
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {service.coordinators?.main && <span><strong>Coord:</strong> {service.coordinators.main}</span>}
            {service.ujieres?.main && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Ujier:</strong> {service.ujieres.main}</span></>)}
            {service.sound?.main && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Sonido:</strong> {service.sound.main}</span></>)}
            {service.luces?.main && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Luces:</strong> {service.luces.main}</span></>)}
            {service.fotografia?.main && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Foto:</strong> {service.fotografia.main}</span></>)}
          </div>
        </div>

        {/* BODY - Scalable Content Area */}
        <div 
          ref={contentRef}
          style={{ 
            position: 'absolute',
            top: `${marginTopPx + HEADER_H}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            bottom: `${marginBottomPx + FOOTER_H}px`,
            overflow: 'hidden',
            fontSize: `${21 * settings.bodyFontScale}px`, // BASE_BODY = 21
            lineHeight: 1.4,
            padding: '0 4px'
          }}
        >
          {(() => {
            let currentTime = service.time ? parse(service.time, 'HH:mm', new Date()) : null;

            return service.segments.map((seg, idx) => {
              const startTimeStr = currentTime ? formatFns(currentTime, 'h:mm a') : '';
              if (currentTime && (seg.duration || seg.duration_min)) {
                currentTime = addMinutes(currentTime, seg.duration || seg.duration_min || 0);
              }

              const getData = (field) => getSegmentData(seg, field);
              const segmentType = seg.segment_type || seg.type || getData('type') || 'Especial';
              const isWorship = ['Alabanza', 'worship'].includes(segmentType);
              const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
              const isOffering = ['Ofrenda', 'offering'].includes(segmentType);

              const leader = isWorship ? getData('leader') : null;
              const preacher = isMessage ? getData('preacher') : null;
              const presenter = (!isWorship && !isMessage) ? getData('presenter') : null;

              const translator = getData('translator');
              const songs = isWorship ? getData('songs') : null;
              const messageTitle = isMessage ? getData('messageTitle') : null;
              const verse = (isMessage || isOffering) ? getData('verse') : null;
              const description = getData('description');
              const description_details = getData('description_details');
              const coordinator_notes = getData('coordinator_notes');
              const projection_notes = getData('projection_notes');
              const sound_notes = getData('sound_notes');
              const ushers_notes = getData('ushers_notes');

              return (
                <div 
                  key={idx} 
                  className="print-segment"
                  style={{ 
                    marginBottom: idx < service.segments.length - 1 ? '8px' : '0', 
                    paddingBottom: '6px', 
                    borderBottom: idx < service.segments.length - 1 ? '1px solid #e5e7eb' : 'none' 
                  }}
                >
                  {/* Title Row */}
                  <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Special Indicator (CRITICAL: preserve emoji/icon exactly as current design) */}
                    {['Especial', 'Special', 'special'].includes(segmentType) && (
                      <Sparkles 
                        size={24 * 0.8 * settings.titleFontScale} 
                        color="#f59e0b" 
                        fill="#fef3c7"
                        style={{ marginRight: '6px' }} 
                      />
                    )}
                    <span style={{ fontSize: `${24 * 0.92 * settings.titleFontScale}px`, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {startTimeStr && <span style={{ color: '#4b5563', marginRight: '8px' }}>{startTimeStr}</span>}
                      {seg.title || 'Sin título'}
                    </span>
                    {seg.duration && <span style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} min)</span>}
                  </div>

                  {/* People Assignments */}
                  {leader && <div style={{ fontSize: `${21 * 0.95 * settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>Dirige: {leader}</div>}
                  {preacher && <div style={{ fontSize: `${21 * 0.95 * settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{preacher}</div>}
                  {presenter && !leader && !preacher && <div style={{ fontSize: `${21 * 0.95 * settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{presenter}</div>}
                  {translator && <div style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#6b7280' }}>🌐 {translator}</div>}

                  {/* Songs List (CRITICAL: preserve exact layout) */}
                  {songs && Array.isArray(songs) && songs.filter(s => s.title).length > 0 && (
                    <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                      {songs.filter(s => s.title).map((song, sIdx) => (
                        <div key={sIdx} style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#16a34a' }}>
                          - {song.title} {song.lead && `(${song.lead})`}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Details */}
                  {messageTitle && <div style={{ fontSize: `${21 * 0.9 * settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>{messageTitle}</div>}
                  {verse && <div style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#9ca3af' }}>📖 {verse}</div>}

                  {/* General Descriptions */}
                  {description && <div style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#9ca3af', fontStyle: 'italic', marginTop: '3px' }}>{description}</div>}
                  {description_details && (
                    <div style={{ fontSize: `${21 * 0.86 * settings.bodyFontScale}px`, color: '#1f2937', marginTop: '4px', padding: '6px 8px', background: '#f3f4f6', borderLeft: '4px solid #4b5563', borderRadius: '0 4px 4px 0' }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: '#111827', textTransform: 'uppercase', fontSize: '0.9em' }}>📝 Notas Generales:</strong>
                      {description_details}
                    </div>
                  )}

                  {/* Technical Notes (CRITICAL: preserve exact color/emoji scheme) */}
                  {(coordinator_notes || projection_notes || sound_notes || ushers_notes) && (
                    <div style={{ fontSize: `${21 * 0.76 * settings.bodyFontScale}px`, marginTop: '4px', padding: '4px', background: '#f9fafb', borderRadius: '4px' }}>
                      {coordinator_notes && <div><strong style={{color:'#92400e'}}>📋 Coord:</strong> {coordinator_notes}</div>}
                      {projection_notes && <div><strong style={{color:'#1e40af'}}>📽️ Proj:</strong> {projection_notes}</div>}
                      {sound_notes && <div><strong style={{color:'#991b1b'}}>🔊 Sound:</strong> {sound_notes}</div>}
                      {ushers_notes && <div><strong style={{color:'#14532d'}}>🤝 Ujieres:</strong> {ushers_notes}</div>}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* FOOTER - Fixed, Not Scaled (CRITICAL: preserve gradient exactly) */}
        <div 
          className="print-footer"
          style={{
            position: 'absolute',
            bottom: '0.25in',
            left: '0.25in',
            width: '8in',
            height: '24px',
            zIndex: 9999,
            backgroundColor: '#1F8A70',
            background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            border: '1px solid #1F8A70'
          }}
        >
          <span style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ¡Atrévete a cambiar!
          </span>
        </div>
      </div>
    </>
  );
}