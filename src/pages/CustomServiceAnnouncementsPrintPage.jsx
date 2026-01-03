import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAutoFitPrint } from '@/components/print/useAutoFitPrint';
import { format as formatFns } from 'date-fns';
import { es } from 'date-fns/locale';


/**
 * CustomServiceAnnouncementsPrintPage
 * 
 * CRITICAL DESIGN RULE: Renders EXACTLY the same visual layout as existing announcements print.
 * NO redesign. Only architectural changes for Safari/print reliability.
 * 
 * FLOW:
 * 1. Fetch service + selected announcements
 * 2. Load stored print_settings_page2 or defaults
 * 3. Render announcements using IDENTICAL markup (2-column, fixed/dynamic split, emojis, emphasis)
 * 4. useAutoFitPrint adjusts font scales to fit
 * 5. Trigger window.print()
 * 
 * ANNOUNCEMENT LOGIC (preserved exactly):
 * - Left column: Fixed announcements (category="General")
 * - Right column: Dynamic announcements (events, category!="General")
 * - Emphasis: Yellow highlight for emphasized/urgent items
 * - Video indicator: 📹 emoji if has_video=true
 * - CUE: instructions styling with border
 */
export default function CustomServiceAnnouncementsPrintPage() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('id');
  
  const [service, setService] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const contentRef = useRef(null);

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

  // CRITICAL: Print routes are public entry points that rely on browser session cookies
  // No explicit auth redirect - if user isn't logged in, fetch will fail with 401/403
  // This prevents infinite redirect loops with AuthContext
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!serviceId) {
          setFetchError('No service ID provided');
          return;
        }

        // These calls use browser session cookies automatically (same-origin policy)
        // If not authenticated, will throw 401/403 which we catch and display
        const services = await base44.entities.Service.filter({ id: serviceId });
        if (!services || services.length === 0) {
          setFetchError('Service not found');
          return;
        }
        const svc = services[0];
        setService(svc);

        // Fetch announcements
        const allAnnouncements = await base44.entities.AnnouncementItem.list('priority');
        const selectedIds = svc.selected_announcements || [];
        const selected = allAnnouncements.filter(a => selectedIds.includes(a.id));
        
        setAnnouncements(selected);

      } catch (err) {
        console.error('[PRINT PAGE] Failed to fetch data:', err);
        
        // User-friendly error for auth failures
        if (err.response?.status === 401 || err.response?.status === 403 || err.message?.includes('logged in')) {
          setFetchError('Por favor inicia sesión en la aplicación principal primero, luego intenta imprimir nuevamente.');
        } else {
          setFetchError(err.message);
        }
      }
    };

    fetchData();
  }, [serviceId]);

  const initialSettings = service?.print_settings_page2 || DEFAULT_SETTINGS;

  const { loading, settings, error } = useAutoFitPrint(
    contentRef,
    initialSettings,
    () => {
      setTimeout(() => {
        window.close();
      }, 500);
    }
  );

  if (fetchError) {
    return <div className="print-loading">Error: {fetchError}</div>;
  }

  if (!service) {
    return <div className="print-loading">Cargando servicio...</div>;
  }

  if (loading) {
    return <div className="print-loading">Preparando impresión...</div>;
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

  // Split announcements (preserve exact logic)
  const selectedFixed = announcements.filter(a => a.category === 'General');
  const selectedDynamic = announcements.filter(a => a.category !== 'General' || a.isEvent);

  // Sanitize HTML (preserve exact function)
  const sanitize = (html) => {
    if (!html) return '';
    return html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ');
  };

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
  const BASE_BODY = 21;
  const BASE_TITLE = 24;

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
        
        {/* HEADER - Fixed */}
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
          {/* Logo */}
          <div className="print-logo" style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}>
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
              alt="Logo" 
              style={{ width: '60px', height: '60px' }}
            />
          </div>

          {/* Title */}
          <div style={{ fontSize: '32px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', textAlign: 'center' }}>
            Anuncios
          </div>
          
          {/* Date */}
          <div style={{ fontSize: '22px', color: '#4b5563', marginTop: '4px', textAlign: 'center' }}>
            Domingo {formatDate(service.date)}
          </div>
        </div>

        {/* BODY - 2 Column Layout (CRITICAL: preserve exact structure) */}
        <div 
          ref={contentRef}
          style={{ 
            position: 'absolute',
            top: `${marginTopPx + HEADER_H}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            bottom: `${marginBottomPx + FOOTER_H}px`,
            overflow: 'hidden'
          }}
        >
          <div style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: `${BASE_BODY * 0.9 * settings.bodyFontScale}px`, lineHeight: 1.4 }}>
              
              {/* LEFT COLUMN: Fixed Announcements */}
              <div>
                {selectedFixed.length > 0 && selectedFixed.map((ann) => (
                  <div key={ann.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: `${BASE_TITLE * 0.83 * settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', marginBottom: '3px', color: '#1a1a1a' }}>
                      {ann.title}
                    </div>
                    {ann.content && (
                      <div 
                        style={{ fontSize: `${BASE_BODY * 0.9 * settings.bodyFontScale}px`, color: '#374151', whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: sanitize(ann.content) }}
                      />
                    )}
                    {ann.instructions && (
                      <div style={{ fontSize: `${BASE_BODY * 0.81 * settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid #fbbf24' }}>
                        <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: `${BASE_BODY * 0.71 * settings.bodyFontScale}px` }}>CUE: </strong>
                        <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                      </div>
                    )}
                    {ann.has_video && (
                      <div style={{ fontSize: `${BASE_BODY * 0.76 * settings.bodyFontScale}px`, color: '#8b5cf6', marginTop: '3px' }}>📹 Video</div>
                    )}
                  </div>
                ))}
              </div>

              {/* RIGHT COLUMN: Dynamic Events */}
              <div style={{ borderLeft: '4px solid #e5e7eb', paddingLeft: '20px' }}>
                {selectedDynamic.length > 0 && (
                  <>
                    <div style={{ fontSize: `${BASE_BODY * 0.86 * settings.bodyFontScale}px`, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                      Próximos Eventos
                    </div>
                    {selectedDynamic.map((ann) => {
                      const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
                      const isEmphasized = ann.emphasize || ann.category === 'Urgent';
                      
                      return (
                        <div 
                          key={ann.id} 
                          style={{ 
                            marginBottom: '6px', 
                            paddingBottom: '6px', 
                            borderBottom: '1px solid #f3f4f6',
                            ...(isEmphasized && { 
                              background: '#fef3c7', 
                              border: '2px solid #f59e0b', 
                              borderRadius: '4px', 
                              padding: '4px 6px', 
                              marginBottom: '6px' 
                            })
                          }}
                        >
                          <div style={{ fontSize: `${BASE_TITLE * 0.83 * settings.titleFontScale}px`, fontWeight: '600', color: '#16a34a', marginBottom: '2px' }}>
                            {ann.isEvent ? ann.name : ann.title}
                          </div>
                          {(ann.date_of_occurrence || ann.start_date) && (
                            <div style={{ fontSize: `${BASE_BODY * 0.86 * settings.bodyFontScale}px`, color: '#4b5563', fontWeight: '500', marginBottom: '2px' }}>
                              {ann.date_of_occurrence || ann.start_date}
                              {ann.end_date && ` — ${ann.end_date}`}
                            </div>
                          )}
                          {content && (
                            <div 
                              style={{ fontSize: `${BASE_BODY * 0.86 * settings.bodyFontScale}px`, color: '#374151', whiteSpace: 'pre-wrap' }}
                              dangerouslySetInnerHTML={{ __html: sanitize(content) }}
                            />
                          )}
                          {ann.instructions && (
                            <div style={{ fontSize: `${BASE_BODY * 0.76 * settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '3px', paddingLeft: '4px', borderLeft: '2px solid #fbbf24' }}>
                              <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: `${BASE_BODY * 0.67 * settings.bodyFontScale}px` }}>CUE: </strong>
                              <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                            </div>
                          )}
                          {(ann.has_video || ann.announcement_has_video) && (
                            <div style={{ fontSize: `${BASE_BODY * 0.76 * settings.bodyFontScale}px`, color: '#8b5cf6', marginTop: '2px' }}>📹 Video</div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* FOOTER - Fixed */}
        <div 
          className="print-footer"
          style={{
            position: 'absolute',
            bottom: '0.25in',
            left: '0.5in',
            width: '7.5in',
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