import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Settings, FileText, Bell, AlertTriangle, CheckCircle2, Save, Printer, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { formatDate as formatDateFn, addMinutes, format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

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

const unitToPx = (value) => {
  if (!value) return 0;
  const num = parseFloat(value);
  if (value.includes('in')) return num * 96;
  if (value.includes('cm')) return num * 37.8;
  if (value.includes('mm')) return num * 3.78;
  if (value.includes('pt')) return num * 1.33;
  return num;
};

export default function PrintSettingsModal({ open, onOpenChange, settingsPage1, settingsPage2, onSave, language = "es", serviceData = null }) {
  const greenStyle = { backgroundColor: '#8DC63F', color: '#ffffff' };
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  
  const [page1Settings, setPage1Settings] = useState(settingsPage1 || DEFAULT_SETTINGS);
  const [page2Settings, setPage2Settings] = useState(settingsPage2 || DEFAULT_SETTINGS);
  const [activePage, setActivePage] = useState("page1");
  const [pageFitScale, setPageFitScale] = useState(1);
  const [page1Overflows, setPage1Overflows] = useState(false);
  const [page2Overflows, setPage2Overflows] = useState(false);
  
  const previewViewportRef = useRef(null);
  const page1BodyRef = useRef(null);
  const page2BodyRef = useRef(null);

  const PAGE_W = 8.5 * 96; // 816px
  const PAGE_H = 11 * 96;  // 1056px
  const HEADER_H = 65; // Preview header height
  const FOOTER_H = 24; // Preview footer height (Exact fit)
  const BASE_BODY = 21; // Base body font size
  const BASE_TITLE = 24; // Base title font size

  useEffect(() => {
    setPage1Settings(settingsPage1 || DEFAULT_SETTINGS);
    setPage2Settings(settingsPage2 || DEFAULT_SETTINGS);
  }, [settingsPage1, settingsPage2]);

  // Fetch announcements for Page 2 preview
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
    enabled: open,
  });

  const { data: dynamicEvents = [] } = useQuery({
    queryKey: ['dynamicEvents'],
    queryFn: async () => {
      const events = await base44.entities.Event.list();
      return events.filter(e => e.promote_in_announcements && e.start_date);
    },
    enabled: open,
  });

  const fixedAnnouncements = allAnnouncements.filter(a => a.category === 'General' && a.is_active);
  const dynamicAnnouncements = [
    ...allAnnouncements.filter(a => a.category !== 'General' && a.is_active),
    ...dynamicEvents.map(e => ({ ...e, isEvent: true }))
  ];

  const selectedAnnouncementIds = serviceData?.selected_announcements || [];
  
  const selectedAnnouncements = allAnnouncements.filter(a => selectedAnnouncementIds.includes(a.id));
  const selectedFixed = selectedAnnouncements.filter(a => a.category === 'General');
  const selectedDynamic = selectedAnnouncements.filter(a => a.category !== 'General' || a.isEvent);

  // Responsive preview scaling
  useEffect(() => {
    if (!previewViewportRef.current || !open) return;

    const element = previewViewportRef.current;

    const observer = new ResizeObserver((entries) => {
      const container = entries[0];
      if (!container) return;

      const containerWidth = container.contentRect.width - 40;
      const containerHeight = container.contentRect.height - 40;

      const scaleX = containerWidth / PAGE_W;
      const scaleY = containerHeight / PAGE_H;
      const scale = Math.min(Math.min(scaleX, scaleY) * 0.95, 1.0);

      setPageFitScale(scale);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [open, serviceData]);

  // Measure overflow
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page1BodyRef.current) {
        setPage1Overflows(page1BodyRef.current.scrollHeight > page1BodyRef.current.clientHeight + 2);
      }
      if (page2BodyRef.current) {
        setPage2Overflows(page2BodyRef.current.scrollHeight > page2BodyRef.current.clientHeight + 2);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [page1Settings, page2Settings, serviceData, selectedFixed, selectedDynamic]);

  const handleSave = () => {
    onSave({ page1: page1Settings, page2: page2Settings });
    onOpenChange(false);
  };

  const handleReset = () => {
    if (activePage === "page1") {
      setPage1Settings(DEFAULT_SETTINGS);
    } else {
      setPage2Settings(DEFAULT_SETTINGS);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAutoScale = async () => {
    const bodyRef = activePage === "page1" ? page1BodyRef : page2BodyRef;
    if (!bodyRef.current) return;

    const combinations = [];
    for (let body = 1.0; body >= 0.5; body -= 0.05) {
      for (let title = 1.0; title >= 0.5; title -= 0.05) {
        combinations.push({ 
          bodyFontScale: Math.round(body * 20) / 20,
          titleFontScale: Math.round(title * 20) / 20,
          avg: (body + title) / 2 
        });
      }
    }

    combinations.sort((a, b) => b.avg - a.avg);

    for (const combo of combinations) {
      setCurrentSettings(prev => ({
        ...prev,
        bodyFontScale: combo.bodyFontScale,
        titleFontScale: combo.titleFontScale
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const overflows = bodyRef.current.scrollHeight > bodyRef.current.clientHeight + 2;
      if (!overflows) {
        return;
      }
    }
  };

  const currentSettings = activePage === "page1" ? page1Settings : page2Settings;
  const setCurrentSettings = activePage === "page1" ? setPage1Settings : setPage2Settings;
  const currentOverflows = activePage === "page1" ? page1Overflows : page2Overflows;

  const t = {
    title: language === "es" ? "Configuración de Impresión" : "Print Settings",
    page1: language === "es" ? "Página 1: Programa" : "Page 1: Program",
    page2: language === "es" ? "Página 2: Anuncios" : "Page 2: Announcements",
    bodyFontScale: language === "es" ? "Escala de Texto del Cuerpo" : "Body Text Scale",
    titleFontScale: language === "es" ? "Escala de Títulos" : "Title Scale",
    save: language === "es" ? "Guardar" : "Save",
    fits: language === "es" ? "Cabe" : "Fits",
    overflow: language === "es" ? "Desborda" : "Overflow",
  };

  const sanitize = (html) => {
    if (!html) return '';
    return html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ');
  };

  const selectedDateFormatted = serviceData?.date 
    ? formatDateFn(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : "—";

  // LOGIC SEPARATION:
  const isCustomService = Array.isArray(serviceData?.segments) && serviceData.segments.length > 0;
  // If not custom, check if it has weekly structure (even if empty initially)
  const isWeeklyService = !isCustomService && (serviceData?.['9:30am'] !== undefined || serviceData?.['11:30am'] !== undefined);

  // RENDERER: CUSTOM SERVICE (Single Column)
  function renderCustomPreview() {
    const marginTopPx = unitToPx(page1Settings.margins.top);
    const marginRightPx = unitToPx(page1Settings.margins.right);
    const marginBottomPx = unitToPx(page1Settings.margins.bottom);
    const marginLeftPx = unitToPx(page1Settings.margins.left);

    return (
      <div 
        className="bg-white shadow-2xl relative print:shadow-none"
        style={{
          width: `${PAGE_W}px`,
          height: `${PAGE_H}px`, 
          display: 'block', margin: 0, flexShrink: 0, breakAfter: 'page', breakInside: 'avoid', overflow: 'hidden' 
        }}
      >
        <div className="hidden print:block absolute" style={{ top: `${marginTopPx}px`, left: `${marginLeftPx}px`, zIndex: 10 }}>
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" style={{ width: '60px', height: '60px' }} />
        </div>
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

        {/* HEADER - Custom */}
        <div className="absolute bg-white" style={{ top: `${marginTopPx}px`, left: `${marginLeftPx}px`, right: `${marginRightPx}px`, height: `${HEADER_H}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: 1.2 }}>{serviceData.name || "Orden de Servicio"}</div>
          <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px' }}>{serviceData.day_of_week} {selectedDateFormatted} {serviceData.time && `• ${serviceData.time}`}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
             {/* Custom team display logic */}
             {serviceData.coordinators && <span><strong>Coord:</strong> {typeof serviceData.coordinators === 'object' ? serviceData.coordinators.main : serviceData.coordinators}</span>}
             {serviceData.ujieres && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Ujier:</strong> {typeof serviceData.ujieres === 'object' ? serviceData.ujieres.main : serviceData.ujieres}</span></>)}
             {serviceData.sound && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Sonido:</strong> {typeof serviceData.sound === 'object' ? serviceData.sound.main : serviceData.sound}</span></>)}
             {serviceData.luces && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Luces:</strong> {typeof serviceData.luces === 'object' ? serviceData.luces.main : serviceData.luces}</span></>)}
             {serviceData.fotografia && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Foto:</strong> {typeof serviceData.fotografia === 'object' ? serviceData.fotografia.main : serviceData.fotografia}</span></>)}
          </div>
        </div>

        {/* BODY - Custom Single Column */}
        <div ref={page1BodyRef} className="absolute overflow-hidden" style={{ top: `${marginTopPx + HEADER_H}px`, left: `${marginLeftPx}px`, right: `${marginRightPx}px`, bottom: `${marginBottomPx + FOOTER_H}px` }}>
          <div style={{ width: '100%', fontSize: `${BASE_BODY * page1Settings.bodyFontScale}px`, lineHeight: 1.4, padding: '0 4px' }}>
             {(() => {
                let currentTime = serviceData.time ? parse(serviceData.time, 'HH:mm', new Date()) : null;

                return serviceData.segments.map((seg, idx) => {
                  const startTimeStr = currentTime ? format(currentTime, 'h:mm a') : '';
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
                <div key={idx} style={{ marginBottom: idx < serviceData.segments.length - 1 ? '8px' : '0', paddingBottom: '6px', borderBottom: idx < serviceData.segments.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                   <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(['Especial', 'Special', 'special'].includes(seg.segment_type || seg.type || seg.data?.type || seg.data?.segment_type)) && (
                        <Sparkles 
                          size={BASE_TITLE * 0.8 * page1Settings.titleFontScale} 
                          color="#f59e0b" 
                          fill="#fef3c7"
                          style={{ marginRight: '6px' }} 
                        />
                      )}
                      <span style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {startTimeStr && <span style={{ color: '#4b5563', marginRight: '8px' }}>{startTimeStr}</span>}
                        {seg.title || 'Sin título'}
                      </span>
                      {seg.duration && <span style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} min)</span>}
                      </div>
                   {leader && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>Dirige: {leader}</div>}
                   {preacher && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{preacher}</div>}
                   {presenter && !leader && !preacher && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{presenter}</div>}
                   {translator && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280' }}>🌐 {translator}</div>}

                   {/* Songs */}
                   {songs && songs.filter(s => s.title).length > 0 && (
                      <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                        {songs.filter(s => s.title).map((song, sIdx) => (
                          <div key={sIdx} style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#16a34a' }}>
                            - {song.title} {song.lead && `(${song.lead})`}
                          </div>
                        ))}
                      </div>
                   )}

                   {/* Other Fields */}
                   {messageTitle && <div style={{ fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic' }}>{messageTitle}</div>}
                   {verse && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af' }}>📖 {verse}</div>}
                   {description && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', fontStyle: 'italic', marginTop: '3px' }}>{description}</div>}
                   {description_details && (
                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#1f2937', marginTop: '4px', padding: '6px 8px', background: '#f3f4f6', borderLeft: '4px solid #4b5563', borderRadius: '0 4px 4px 0' }}>
                        <strong style={{ display: 'block', marginBottom: '2px', color: '#111827', textTransform: 'uppercase', fontSize: '0.9em' }}>📝 Notas Generales:</strong>
                        {description_details}
                      </div>
                   )}

                   {/* Technical Notes */}
                   {(coordinator_notes || projection_notes || sound_notes || ushers_notes) && (
                      <div style={{ fontSize: `${BASE_BODY * 0.76 * page1Settings.bodyFontScale}px`, marginTop: '4px', padding: '4px', background: '#f9fafb', borderRadius: '4px' }}>
                        {coordinator_notes && <div><strong style={{color:'#92400e'}}>Coord:</strong> {coordinator_notes}</div>}
                        {projection_notes && <div><strong style={{color:'#1e40af'}}>Proj:</strong> {projection_notes}</div>}
                        {sound_notes && <div><strong style={{color:'#991b1b'}}>Sound:</strong> {sound_notes}</div>}
                        {ushers_notes && <div><strong style={{color:'#14532d'}}>Ujieres:</strong> {ushers_notes}</div>}
                      </div>
                   )}
                </div>
             )})
             })()}
             </div>
             </div>
        
        <div className="print-footer" style={{ position: 'absolute', bottom: '0.25in', left: '0.25in', width: '8in', height: '24px', zIndex: 9999, backgroundColor: '#1F8A70', background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid #1F8A70' }}>
          <span className="print-footer-text" style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', zIndex: 10000, position: 'relative', letterSpacing: '0.1em', textTransform: 'uppercase' }}>¡Atrévete a cambiar!</span>
        </div>
      </div>
    );
  }

  // RENDERER: STANDARD WEEKLY SERVICE (Dual Column)
  function renderStandardPreview() {
    const marginTopPx = unitToPx(page1Settings.margins.top);
    const marginRightPx = unitToPx(page1Settings.margins.right);
    const marginBottomPx = unitToPx(page1Settings.margins.bottom);
    const marginLeftPx = unitToPx(page1Settings.margins.left);

    const renderSegments = (segments) => {
        if (!Array.isArray(segments)) return null;
        return segments.filter(s => s?.type !== 'break').map((seg, idx) => (
          <div key={idx} style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {(['Especial', 'Special', 'special'].includes(seg.segment_type || seg.type || seg.data?.type || seg.data?.segment_type)) && (
                <Sparkles 
                  size={BASE_TITLE * 0.8 * page1Settings.titleFontScale} 
                  color="#f59e0b" 
                  fill="#fef3c7"
                  style={{ marginRight: '6px' }} 
                />
              )}
              <span style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', color: '#1a1a1a' }}>
                {seg.title || 'Sin título'}
              </span>
              {seg.duration && <span style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} mins)</span>}
            </div>
            
            {seg.data?.leader && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>Dirige: {seg.data.leader}</div>}
            {seg.data?.preacher && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{seg.data.preacher}</div>}
            {seg.data?.presenter && !seg.data?.leader && !seg.data?.preacher && <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>{seg.data.presenter}</div>}
            {seg.data?.translator && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280' }}>🌐 {seg.data.translator}</div>}
            
            {seg.songs && seg.songs.filter(s => s.title).length > 0 && (
              <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #d1d5db' }}>
                {seg.songs.filter(s => s.title).map((song, sIdx) => (
                  <div key={sIdx} style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#374151' }}>
                    - {song.title} {song.lead && `(${song.lead})`}
                  </div>
                ))}
              </div>
            )}

            {/* Sub-assignments */}
            {seg.sub_assignments && seg.sub_assignments.map((subAssign, saIdx) => {
              const personValue = seg.data?.[subAssign.person_field_name];
              if (!personValue) return null;
              return (
                <div key={saIdx} style={{ marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #d8b4fe', fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b21a8' }}>
                  <strong>{subAssign.label}:</strong> <span style={{ fontWeight: '700', color: '#9333ea' }}>{personValue}</span>
                  {subAssign.duration_min && <span> ({subAssign.duration_min} min)</span>}
                </div>
              );
            })}

            {/* Message/Content Fields */}
            {seg.data?.messageTitle && <div style={{ fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>{seg.data.messageTitle}</div>}
            {(seg.data?.verse || seg.data?.scripture_references) && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af' }}>📖 {seg.data.verse || seg.data.scripture_references}</div>}

            {/* Descriptions */}
            {seg.data?.description && <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#14532d', background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '4px 8px', marginTop: '4px' }}>{seg.data.description}</div>}
            {seg.data?.description_details && (
              <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#1f2937', marginTop: '4px', padding: '6px 8px', background: '#f3f4f6', borderLeft: '4px solid #4b5563', borderRadius: '0 4px 4px 0' }}>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#111827', textTransform: 'uppercase', fontSize: '0.9em' }}>📝 Notas Generales:</strong>
                {seg.data.description_details}
              </div>
            )}
            
            {/* Team Notes */}
            {seg.data?.coordinator_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#92400e', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #b45309' }}><strong>📋 Coord:</strong> {seg.data.coordinator_notes}</div>}
            {seg.data?.sound_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#991b1b', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #dc2626' }}><strong>🔊 Sonido:</strong> {seg.data.sound_notes}</div>}
            {seg.data?.projection_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#1e40af', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #2563eb' }}><strong>📽️ Proyección:</strong> {seg.data.projection_notes}</div>}
            {seg.data?.ushers_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#14532d', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #16a34a' }}><strong>🤝 Ujieres:</strong> {seg.data.ushers_notes}</div>}
            {seg.data?.translation_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#4c1d95', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #6d28d9' }}><strong>🌐 Trad:</strong> {seg.data.translation_notes}</div>}
            {seg.data?.stage_decor_notes && <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#be185d', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #db2777' }}><strong>🎨 Stage:</strong> {seg.data.stage_decor_notes}</div>}
          </div>
        ));
    };

    return (
      <div 
        className="bg-white shadow-2xl relative print:shadow-none"
        style={{
          width: `${PAGE_W}px`,
          height: `${PAGE_H}px`, 
          display: 'block', margin: 0, flexShrink: 0, breakAfter: 'page', breakInside: 'avoid', overflow: 'hidden' 
        }}
      >
        <div className="hidden print:block absolute" style={{ top: `${marginTopPx}px`, left: `${marginLeftPx}px`, zIndex: 10 }}>
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" style={{ width: '60px', height: '60px' }} />
        </div>
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

        {/* HEADER - Standard */}
        <div className="absolute bg-white" style={{ top: `${marginTopPx}px`, left: `${marginLeftPx}px`, right: `${marginRightPx}px`, height: `${HEADER_H}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: 1.2 }}>Orden de Servicio</div>
          <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px' }}>Domingo {selectedDateFormatted}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {serviceData?.coordinators?.['9:30am'] && <span><strong>Coord:</strong> {serviceData.coordinators['9:30am']}</span>}
            {serviceData?.ujieres?.['9:30am'] && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Ujier:</strong> {serviceData.ujieres['9:30am']}</span></>)}
            {serviceData?.sound?.['9:30am'] && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Sonido:</strong> {serviceData.sound['9:30am']}</span></>)}
            {serviceData?.luces?.['9:30am'] && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Luces:</strong> {serviceData.luces['9:30am']}</span></>)}
            {serviceData?.fotografia?.['9:30am'] && (<><span style={{ color: '#9ca3af' }}>/</span><span><strong>Foto:</strong> {serviceData.fotografia['9:30am']}</span></>)}
          </div>
        </div>

        {/* BODY - Standard 2 Columns */}
        <div ref={page1BodyRef} className="absolute overflow-hidden" style={{ top: `${marginTopPx + HEADER_H}px`, left: `${marginLeftPx}px`, right: `${marginRightPx}px`, bottom: `${marginBottomPx + FOOTER_H}px` }}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: `${BASE_BODY * page1Settings.bodyFontScale}px`, lineHeight: 1.4 }}>
              {/* 9:30 AM Column */}
              <div>
                <div style={{ fontSize: `${BASE_TITLE * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#dc2626', marginBottom: '16px', paddingBottom: '8px', borderBottom: '4px solid #1f2937', textTransform: 'uppercase' }}>9:30 A.M.</div>
                {serviceData?.pre_service_notes?.['9:30am'] && <div style={{ marginBottom: '16px', color: '#14532d', background: '#f0fdf4', padding: '4px' }}>{serviceData.pre_service_notes['9:30am']}</div>}
                {renderSegments(serviceData?.['9:30am'])}
              </div>
              {/* 11:30 AM Column */}
              <div>
                <div style={{ fontSize: `${BASE_TITLE * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#2563eb', marginBottom: '16px', paddingBottom: '8px', borderBottom: '4px solid #1f2937', textTransform: 'uppercase' }}>11:30 A.M.</div>
                {serviceData?.pre_service_notes?.['11:30am'] && <div style={{ marginBottom: '16px', color: '#14532d', background: '#f0fdf4', padding: '4px' }}>{serviceData.pre_service_notes['11:30am']}</div>}
                {renderSegments(serviceData?.['11:30am'])}
              </div>
            </div>
            {/* Receso */}
            {serviceData?.receso_notes?.['9:30am'] && (
              <div style={{ margin: '16px 0 0 0', padding: '12px', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: `${BASE_TITLE * 0.85 * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>RECESO (30 min)</div>
                <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280' }}>{serviceData.receso_notes['9:30am']}</div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="print-footer" style={{ position: 'absolute', bottom: '0.25in', left: '0.25in', width: '8in', height: '24px', zIndex: 9999, backgroundColor: '#1F8A70', background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid #1F8A70' }}>
          <span className="print-footer-text" style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', zIndex: 10000, position: 'relative', letterSpacing: '0.1em', textTransform: 'uppercase' }}>¡Atrévete a cambiar!</span>
        </div>
      </div>
    );
  }

  function renderPage2() {
    const marginTopPx = unitToPx(page2Settings.margins.top);
    const marginRightPx = unitToPx(page2Settings.margins.right);
    const marginBottomPx = unitToPx(page2Settings.margins.bottom);
    const marginLeftPx = unitToPx(page2Settings.margins.left);

    return (
      <div 
        className="bg-white shadow-2xl relative print:shadow-none"
        style={{
          width: `${PAGE_W}px`,
          height: `${PAGE_H}px`, /* Aggressive buffer to prevent ANY blank pages */
          display: 'block',
          margin: 0,
          flexShrink: 0,
          breakAfter: 'avoid',
          breakInside: 'avoid',
          overflow: 'hidden'
        }}
      >
        {/* Logo - only for print */}
        <div className="hidden print:block absolute" style={{ top: `${marginTopPx}px`, left: `${marginLeftPx}px`, zIndex: 10 }}>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
            alt="Logo" 
            style={{ width: '60px', height: '60px' }}
          />
        </div>
        {/* Margin Overlays - hide in print */}
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
        <div className="absolute bg-blue-400 opacity-20 pointer-events-none print:hidden" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

        {/* FIXED Header */}
        <div 
          className="absolute bg-white"
          style={{
            top: `${marginTopPx}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            height: `${HEADER_H}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a' }}>
            Anuncios
          </div>
          <div style={{ fontSize: '22px', color: '#4b5563', marginTop: '4px' }}>
            Domingo {selectedDateFormatted}
          </div>
        </div>

        {/* SCALABLE Body - 2 Column Announcements */}
        <div 
          ref={page2BodyRef}
          className="absolute overflow-hidden"
          style={{
            top: `${marginTopPx + HEADER_H}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            bottom: `${marginBottomPx + FOOTER_H}px`
          }}
        >
          <div style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: `${BASE_BODY * 0.9 * page2Settings.bodyFontScale}px`, lineHeight: 1.4 }}>
            {/* Left Column: Fixed Announcements */}
            <div>
              {selectedFixed.length > 0 && selectedFixed.map((ann) => (
                <div key={ann.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: `${BASE_TITLE * 0.83 * page2Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', marginBottom: '3px', color: '#1a1a1a' }}>
                    {ann.title}
                  </div>
                  {ann.content && (
                    <div 
                      style={{ fontSize: `${BASE_BODY * 0.9 * page2Settings.bodyFontScale}px`, color: '#374151', whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: sanitize(ann.content) }}
                    />
                  )}
                  {ann.instructions && (
                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page2Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid #fbbf24' }}>
                      <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: `${BASE_BODY * 0.71 * page2Settings.bodyFontScale}px` }}>CUE: </strong>
                      <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                    </div>
                  )}
                  {ann.has_video && (
                    <div style={{ fontSize: `${BASE_BODY * 0.76 * page2Settings.bodyFontScale}px`, color: '#8b5cf6', marginTop: '3px' }}>📹 Video</div>
                  )}
                </div>
              ))}
            </div>

            {/* Right Column: Dynamic Events */}
            <div style={{ borderLeft: '4px solid #e5e7eb', paddingLeft: '20px' }}>
              {selectedDynamic.length > 0 && (
                <div style={{ fontSize: `${BASE_BODY * 0.86 * page2Settings.bodyFontScale}px`, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                  Próximos Eventos
                </div>
              )}
              {selectedDynamic.length > 0 && selectedDynamic.map((ann) => {
                const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
                const isEmphasized = ann.emphasize || ann.category === 'Urgent';
                return (
                  <div 
                    key={ann.id} 
                    style={{ 
                      marginBottom: '6px', 
                      paddingBottom: '6px', 
                      borderBottom: '1px solid #f3f4f6',
                      ...(isEmphasized && { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '4px', padding: '4px 6px', marginBottom: '6px' })
                    }}
                  >
                    <div style={{ fontSize: `${BASE_TITLE * 0.83 * page2Settings.titleFontScale}px`, fontWeight: '600', color: '#16a34a', marginBottom: '2px' }}>
                      {ann.isEvent ? ann.name : ann.title}
                    </div>
                    {(ann.date_of_occurrence || ann.start_date) && (
                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page2Settings.bodyFontScale}px`, color: '#4b5563', fontWeight: '500', marginBottom: '2px' }}>
                        {ann.date_of_occurrence || ann.start_date}
                        {ann.end_date && ` — ${ann.end_date}`}
                      </div>
                    )}
                    {content && (
                      <div 
                        style={{ fontSize: `${BASE_BODY * 0.86 * page2Settings.bodyFontScale}px`, color: '#374151', whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: sanitize(content) }}
                      />
                    )}
                    {ann.instructions && (
                      <div style={{ fontSize: `${BASE_BODY * 0.76 * page2Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginTop: '3px', paddingLeft: '4px', borderLeft: '2px solid #fbbf24' }}>
                        <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: `${BASE_BODY * 0.67 * page2Settings.bodyFontScale}px` }}>CUE: </strong>
                        <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                      </div>
                    )}
                    {(ann.has_video || ann.announcement_has_video) && (
                      <div style={{ fontSize: `${BASE_BODY * 0.76 * page2Settings.bodyFontScale}px`, color: '#8b5cf6', marginTop: '2px' }}>📹 Video</div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>

        {/* FIXED Footer */}
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
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            overflow: 'hidden',
            borderRadius: '12px',
            boxShadow: 'none',
            border: '1px solid #1F8A70'
          }}
        >
          <span className="print-footer-text" style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', zIndex: 10000, position: 'relative', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ¡Atrévete a cambiar!
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print-only-container" style={{ display: 'none' }}>
        {activePage === "page1" ? (isCustomService ? renderCustomPreview() : renderStandardPreview()) : renderPage2()}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl bg-white max-h-[95vh] overflow-hidden p-0 print:hidden">
        {/* TOOLBAR */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-pdv-teal" />
            <span className="font-semibold text-lg">{t.title}</span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoScale}
              style={{ borderColor: '#8DC63F', color: '#8DC63F' }}
              className="gap-1 border-2 hover:text-white font-semibold"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#8DC63F'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#8DC63F'; }}
              title={language === "es" ? "Escalar automáticamente para ajustar" : "Auto-scale to fit"}
            >
              <Sparkles className="w-3 h-3" />
              Auto
            </Button>

            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">{t.bodyFontScale}</Label>
              <div className="w-32">
                <Slider
                  value={[currentSettings.bodyFontScale]}
                  onValueChange={([value]) => setCurrentSettings(prev => ({ ...prev, bodyFontScale: value }))}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <span className="text-xs font-mono w-10 text-right">{(currentSettings.bodyFontScale * 100).toFixed(0)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">{t.titleFontScale}</Label>
              <div className="w-32">
                <Slider
                  value={[currentSettings.titleFontScale]}
                  onValueChange={([value]) => setCurrentSettings(prev => ({ ...prev, titleFontScale: value }))}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <span className="text-xs font-mono w-10 text-right">{(currentSettings.titleFontScale * 100).toFixed(0)}%</span>
            </div>

            {currentOverflows ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t.overflow}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3" />
                {t.fits}
              </Badge>
            )}

            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>

            <Button 
              variant="default" 
              size="icon" 
              onClick={handlePrint} 
              style={greenStyle}
              title={language === "es" ? "Imprimir" : "Print"}
            >
              <Printer className="w-4 h-4" />
            </Button>

            <Button 
              onClick={handleSave} 
              size="icon"
              style={tealStyle}
              title={t.save}
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* VIEWER */}
        <div className="flex h-[calc(95vh-80px)] min-h-0">
          <div className="w-48 bg-gray-50 border-r border-gray-200 p-4 space-y-3 overflow-y-auto">
            <button
              onClick={() => setActivePage("page1")}
              className={`w-full p-3 rounded-lg border-2 transition-all ${
                activePage === "page1" 
                  ? "border-pdv-teal bg-pdv-teal/5" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                <span className="font-semibold text-sm">Page 1</span>
              </div>
              <div className="text-xs text-gray-600">
                {language === "es" ? "Programa del Servicio" : "Service Program"}
              </div>
            </button>

            <button
              onClick={() => setActivePage("page2")}
              className={`w-full p-3 rounded-lg border-2 transition-all ${
                activePage === "page2" 
                  ? "border-pdv-teal bg-pdv-teal/5" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4" />
                <span className="font-semibold text-sm">Page 2</span>
              </div>
              <div className="text-xs text-gray-600">
                {language === "es" ? "Anuncios" : "Announcements"}
              </div>
            </button>
          </div>

          <div ref={previewViewportRef} className="flex-1 bg-gray-900 overflow-hidden flex items-center justify-center min-h-0">
            <div style={{ transform: `scale(${pageFitScale})`, transformOrigin: "center center" }}>
              {activePage === "page1" ? (isCustomService ? renderCustomPreview() : renderStandardPreview()) : renderPage2()}
            </div>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 8.5in;
            height: auto !important;
            overflow: visible !important;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          .print-only-container,
          .print-only-container * {
            visibility: visible;
          }

          .print-only-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 8.5in;
            height: 11in !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .print-footer {
            width: 8in !important; /* Explicit width for print reliability */
            left: 0.25in !important;  /* Center horizontally (8.5 - 8) / 2 */
            bottom: 0.25in !important; /* Move up to safe zone */
            background-color: #1F8A70 !important;
            background-image: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .print-footer-text {
            background-color: transparent !important;
            background: transparent !important;
            color: white !important;
            -webkit-text-fill-color: white !important;
            text-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
}