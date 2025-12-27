import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Settings, FileText, Bell, AlertTriangle, CheckCircle2, Save, Printer, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { formatDate as formatDateFn } from "date-fns";
import { es } from "date-fns/locale";

const DEFAULT_SETTINGS = {
  globalScale: 1.0,
  margins: {
    top: "0.5in",
    right: "0.5in",
    bottom: "0.5in",
    left: "0.5in"
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
  const HEADER_H = 120; // Preview header height (2x for readability)
  const FOOTER_H = 40; // Preview footer height (2x for readability)
  const BASE_BODY = 21; // Base body font size (2x for preview readability)
  const BASE_TITLE = 24; // Base title font size (2x for preview readability)

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
  const selectedFixed = fixedAnnouncements.filter(a => selectedAnnouncementIds.includes(a.id));
  const selectedDynamic = dynamicAnnouncements.filter(a => selectedAnnouncementIds.includes(a.id));

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

    // Generate combinations from 1.0 down to 0.5 in 0.05 steps
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

    // Sort by average descending (largest text first)
    combinations.sort((a, b) => b.avg - a.avg);

    // Test each combination to find largest that fits
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

    // If nothing fits, smallest combo already set
  };

  const currentSettings = activePage === "page1" ? page1Settings : page2Settings;
  const setCurrentSettings = activePage === "page1" ? setPage1Settings : setPage2Settings;
  const currentOverflows = activePage === "page1" ? page1Overflows : page2Overflows;

  const t = {
    title: language === "es" ? "Configuración de Impresión" : "Print Settings",
    page1: language === "es" ? "Página 1: Programa" : "Page 1: Program",
    page2: language === "es" ? "Página 2: Anuncios" : "Page 2: Announcements",
    globalScale: language === "es" ? "Escala del Contenido" : "Content Scale",
    margins: language === "es" ? "Márgenes de Página" : "Page Margins",
    top: language === "es" ? "Superior" : "Top",
    right: language === "es" ? "Derecha" : "Right",
    bottom: language === "es" ? "Inferior" : "Bottom",
    left: language === "es" ? "Izquierda" : "Left",
    bodyFontScale: language === "es" ? "Escala de Texto del Cuerpo" : "Body Text Scale",
    titleFontScale: language === "es" ? "Escala de Títulos" : "Title Scale",
    cancel: language === "es" ? "Cancelar" : "Cancel",
    save: language === "es" ? "Guardar" : "Save",
    fits: language === "es" ? "Cabe" : "Fits",
    overflow: language === "es" ? "Desborda" : "Overflow",
    noteP1: language === "es" 
      ? "Ajusta cómo se imprime el programa de servicio (horarios, segmentos, equipos)." 
      : "Adjust how the service program prints (schedules, segments, teams).",
    noteP2: language === "es"
      ? "Ajusta cómo se imprimen los anuncios (siempre en 2 columnas)."
      : "Adjust how announcements print (always 2 columns)."
  };

  const sanitize = (html) => {
    if (!html) return '';
    return html
      .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
      .replace(/&nbsp;/g, ' ');
  };

  const selectedDateFormatted = serviceData?.date 
    ? formatDateFn(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : "—";

  const isWeeklyService = serviceData?.['9:30am'] !== undefined;
  const isCustomService = serviceData?.segments !== undefined;

  return (
    <>
      {/* PRINT-ONLY CONTENT - Hidden on screen, shown when printing */}
      <div className="print-only-container" style={{ display: 'none' }}>
        {renderPage1()}
        {renderPage2()}
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
            {/* AutoScale Button */}
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

            {/* Body Font Scale */}
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

            {/* Title Font Scale */}
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

            {/* Overflow Badge */}
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

            {/* Reset */}
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>

            {/* Print Icon Button */}
            <Button 
              variant="default" 
              size="icon" 
              onClick={handlePrint} 
              style={greenStyle}
              title={language === "es" ? "Imprimir" : "Print"}
            >
              <Printer className="w-4 h-4" />
            </Button>

            {/* Save Icon Button */}
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
          {/* LEFT SIDEBAR - Page Thumbnails */}
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

          {/* CENTER PREVIEW */}
          <div ref={previewViewportRef} className="flex-1 bg-gray-900 overflow-hidden flex items-center justify-center min-h-0">
            <div style={{ transform: `scale(${pageFitScale})`, transformOrigin: "center center" }}>
              {activePage === "page1" ? renderPage1() : renderPage2()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Print-specific styles */}
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
          height: 11in;
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
          margin: 0 !important;
          padding: 0 !important;
        }


      }
    `}</style>
  </>
  );

  function renderPage1() {
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
          display: 'block',
          margin: 0,
          flexShrink: 0,
          breakAfter: 'page',
          breakInside: 'avoid'
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
                        Orden de Servicio
                      </div>
                      <div style={{ fontSize: '22px', color: '#4b5563', marginTop: '4px' }}>
                        Domingo {selectedDateFormatted}
                      </div>
                      {isWeeklyService && (
                        <div style={{ fontSize: '16px', color: '#6b7280', marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {serviceData?.coordinators?.['9:30am'] && <span><strong>Coord:</strong> {serviceData.coordinators['9:30am']}</span>}
                          {serviceData?.ujieres?.['9:30am'] && (
                            <>
                              <span style={{ color: '#9ca3af' }}>/</span>
                              <span><strong>Ujier:</strong> {serviceData.ujieres['9:30am']}</span>
                            </>
                          )}
                          {serviceData?.sound?.['9:30am'] && (
                            <>
                              <span style={{ color: '#9ca3af' }}>/</span>
                              <span><strong>Sonido:</strong> {serviceData.sound['9:30am']}</span>
                            </>
                          )}
                          {serviceData?.luces?.['9:30am'] && (
                            <>
                              <span style={{ color: '#9ca3af' }}>/</span>
                              <span><strong>Luces:</strong> {serviceData.luces['9:30am']}</span>
                            </>
                          )}
                        </div>
                      )}
        </div>

        {/* SCALABLE Body */}
        <div 
          ref={page1BodyRef}
          className="absolute overflow-hidden"
          style={{
            top: `${marginTopPx + HEADER_H}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            bottom: `${marginBottomPx + FOOTER_H}px`
          }}
        >
          <div style={{ width: '100%' }}>
                        {isWeeklyService && serviceData?.['9:30am'] ? (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: `${BASE_BODY * page1Settings.bodyFontScale}px`, lineHeight: 1.4 }}>
                              {/* 9:30 AM Column */}
                              <div>
                                <div style={{ fontSize: `${BASE_TITLE * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#dc2626', marginBottom: '16px', paddingBottom: '8px', borderBottom: '4px solid #1f2937', textTransform: 'uppercase' }}>
                                  9:30 A.M.
                                </div>
                                {serviceData?.pre_service_notes?.['9:30am'] && (
                                  <div style={{ 
                                    marginBottom: '16px', 
                                    fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, 
                                    color: '#14532d', 
                                    background: '#f0fdf4', 
                                    borderLeft: '4px solid #16a34a', 
                                    padding: '4px 8px',
                                    fontStyle: 'italic'
                                  }}>
                                    {serviceData.pre_service_notes['9:30am']}
                                  </div>
                                )}
                                {Array.isArray(serviceData?.['9:30am']) && serviceData['9:30am'].filter(s => s?.type !== 'break').map((seg, idx) => (
                                  <div key={idx} style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ marginBottom: '3px' }}>
                                      <span style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', color: '#1a1a1a' }}>
                                        {seg.title || 'Sin título'}
                                      </span>
                                      {seg.duration && <span style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} mins)</span>}
                                    </div>
                                    
                                    {seg.data?.leader && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                        Dirige: {seg.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                      </div>
                                    )}
                                    
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

                                    {/* Legacy Ministración fallback */}
                                    {(!seg.sub_assignments || seg.sub_assignments.length === 0) && seg.data?.ministry_leader && (
                                      <div style={{ marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #d8b4fe', fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b21a8' }}>
                                        <strong>Ministración:</strong> <span style={{ fontWeight: '700', color: '#9333ea' }}>{seg.data.ministry_leader}</span> (5 min)
                                      </div>
                                    )}

                                    {seg.data?.preacher && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                        {seg.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                      </div>
                                    )}
                                    
                                    {seg.data?.preacher && seg.requires_translation && seg.data?.translator && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                                        🌐 Traduce: {seg.data.translator}
                                      </div>
                                    )}

                                    {seg.data?.presenter && !seg.data?.ministry_leader && !seg.data?.preacher && !seg.data?.leader && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                        {seg.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                      </div>
                                    )}

                                    {seg.data?.presenter && !seg.data?.ministry_leader && !seg.data?.preacher && !seg.data?.leader && 
                                     seg.requires_translation && seg.data?.translator && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                                        🌐 Traduce: {seg.data.translator}
                                      </div>
                                    )}

                                    {seg.data?.title && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic' }}>
                                        {seg.data.title}
                                      </div>
                                    )}
                                    {seg.data?.verse && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af' }}>
                                        📖 {seg.data.verse}
                                      </div>
                                    )}
                                    
                                    {/* Description / Details */}
                                    {seg.data?.description && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#14532d', background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '4px 8px', marginTop: '4px' }}>
                                        {seg.data.description}
                                      </div>
                                    )}
                                    {seg.data?.description_details && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#14532d', background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '4px 8px', marginTop: '4px' }}>
                                        <strong>📝 Notas:</strong> {seg.data.description_details}
                                      </div>
                                    )}
                                    
                                    {/* Coordinator Notes */}
                                    {seg.data?.coordinator_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#92400e', background: '#fffbeb', borderLeft: '1px solid #fcd34d', padding: '2px 4px', marginTop: '2px', fontStyle: 'italic' }}>
                                        <strong>📋 Coordinador:</strong> {seg.data.coordinator_notes}
                                      </div>
                                    )}

                                    {/* Team Notes */}
                                    {seg.data?.sound_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#991b1b', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #dc2626' }}>
                                        <strong>🔊 Sonido:</strong> {seg.data.sound_notes}
                                      </div>
                                    )}
                                    {seg.data?.projection_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#1e40af', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #2563eb' }}>
                                        <strong>📽️ Proyección:</strong> {seg.data.projection_notes}
                                      </div>
                                    )}
                                    {seg.data?.ushers_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#14532d', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #16a34a' }}>
                                        <strong>🚪 Ujieres:</strong> {seg.data.ushers_notes}
                                      </div>
                                    )}
                                    {seg.data?.translation_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#581c87', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #9333ea' }}>
                                        <strong>🌐 Traducción:</strong> {seg.data.translation_notes}
                                      </div>
                                    )}
                                    {seg.data?.stage_decor_notes && (
                                      <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#701a75', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #c026d3' }}>
                                        <strong>🎨 Stage:</strong> {seg.data.stage_decor_notes}
                                      </div>
                                    )}

                                    {/* Coordinator Actions */}
                                    {seg.actions && seg.actions.length > 0 && (
                                      <div style={{ marginTop: '4px', padding: '3px 6px', background: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '2px' }}>
                                        {seg.actions.map((action, aIdx) => (
                                          <div key={aIdx} style={{ fontSize: `${BASE_BODY * 0.76 * page1Settings.bodyFontScale}px`, color: '#78350f', lineHeight: 1.2 }}>
                                            {action.label}
                                            {action.timing === 'before_end' && !/\d+\s*min/i.test(action.label || '') && ` (${action.offset_min || 0} min antes)`}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* 11:30 AM Column */}
                              {serviceData?.['11:30am'] && Array.isArray(serviceData['11:30am']) && (
                              <div>
                            <div style={{ fontSize: `${BASE_TITLE * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#2563eb', marginBottom: '16px', paddingBottom: '8px', borderBottom: '4px solid #1f2937', textTransform: 'uppercase' }}>
                              11:30 A.M.
                            </div>
                            {serviceData?.pre_service_notes?.['11:30am'] && (
                              <div style={{ 
                                marginBottom: '16px', 
                                fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, 
                                color: '#14532d', 
                                background: '#f0fdf4', 
                                borderLeft: '4px solid #16a34a', 
                                padding: '4px 8px',
                                fontStyle: 'italic'
                              }}>
                                {serviceData.pre_service_notes['11:30am']}
                              </div>
                            )}
                            {serviceData['11:30am'].filter(s => s?.type !== 'break').map((seg, idx) => {
                              // We use unified rendering now, similar to 9:30am
                              return (
                                <div key={idx} style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ marginBottom: '3px' }}>
                                    <span style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', color: '#1a1a1a' }}>
                                      {seg.title || 'Sin título'}
                                    </span>
                                    {seg.duration && <span style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} mins)</span>}
                                  </div>

                                  {seg.data?.leader && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                      Dirige: {seg.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                    </div>
                                  )}

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

                                  {/* Legacy Ministración fallback */}
                                  {(!seg.sub_assignments || seg.sub_assignments.length === 0) && seg.data?.ministry_leader && (
                                    <div style={{ marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #d8b4fe', fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b21a8' }}>
                                      <strong>Ministración:</strong> <span style={{ fontWeight: '700', color: '#9333ea' }}>{seg.data.ministry_leader}</span> (5 min)
                                    </div>
                                  )}

                                  {seg.data?.preacher && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                      {seg.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                    </div>
                                  )}

                                  {seg.data?.preacher && seg.requires_translation && seg.data?.translator && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                                      🌐 Traduce: {seg.data.translator}
                                    </div>
                                  )}

                                  {seg.data?.presenter && !seg.data?.ministry_leader && !seg.data?.preacher && !seg.data?.leader && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '700' }}>
                                      {seg.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}
                                    </div>
                                  )}

                                  {seg.data?.presenter && !seg.data?.ministry_leader && !seg.data?.preacher && !seg.data?.leader && 
                                   seg.requires_translation && seg.data?.translator && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                                      🌐 Traduce: {seg.data.translator}
                                    </div>
                                  )}

                                  {seg.data?.title && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic' }}>
                                      {seg.data.title}
                                    </div>
                                  )}
                                  {seg.data?.verse && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af' }}>
                                      📖 {seg.data.verse}
                                    </div>
                                  )}

                                  {/* Description / Details */}
                                  {seg.data?.description && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#14532d', background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '4px 8px', marginTop: '4px' }}>
                                      {seg.data.description}
                                    </div>
                                  )}
                                  {seg.data?.description_details && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#14532d', background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '4px 8px', marginTop: '4px' }}>
                                      <strong>📝 Notas:</strong> {seg.data.description_details}
                                    </div>
                                  )}

                                  {/* Coordinator Notes */}
                                  {seg.data?.coordinator_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#92400e', background: '#fffbeb', borderLeft: '1px solid #fcd34d', padding: '2px 4px', marginTop: '2px', fontStyle: 'italic' }}>
                                      <strong>📋 Coordinador:</strong> {seg.data.coordinator_notes}
                                    </div>
                                  )}

                                  {/* Team Notes */}
                                  {seg.data?.sound_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#991b1b', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #dc2626' }}>
                                      <strong>🔊 Sonido:</strong> {seg.data.sound_notes}
                                    </div>
                                  )}
                                  {seg.data?.projection_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#1e40af', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #2563eb' }}>
                                      <strong>📽️ Proyección:</strong> {seg.data.projection_notes}
                                    </div>
                                  )}
                                  {seg.data?.ushers_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#14532d', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #16a34a' }}>
                                      <strong>🚪 Ujieres:</strong> {seg.data.ushers_notes}
                                    </div>
                                  )}
                                  {seg.data?.translation_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#581c87', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #9333ea' }}>
                                      <strong>🌐 Traducción:</strong> {seg.data.translation_notes}
                                    </div>
                                  )}
                                  {seg.data?.stage_decor_notes && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.81 * page1Settings.bodyFontScale}px`, color: '#701a75', marginTop: '3px', paddingLeft: '6px', borderLeft: '3px solid #c026d3' }}>
                                      <strong>🎨 Stage:</strong> {seg.data.stage_decor_notes}
                                    </div>
                                  )}

                                  {/* Coordinator Actions */}
                                  {seg.actions && seg.actions.length > 0 && (
                                    <div style={{ marginTop: '4px', padding: '3px 6px', background: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '2px' }}>
                                      {seg.actions.map((action, aIdx) => (
                                        <div key={aIdx} style={{ fontSize: `${BASE_BODY * 0.76 * page1Settings.bodyFontScale}px`, color: '#78350f', lineHeight: 1.2 }}>
                                          {action.label}
                                          {action.timing === 'before_end' && !/\d+\s*min/i.test(action.label || '') && ` (${action.offset_min || 0} min antes)`}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* 11:30am Team Section - only show if different from 9:30am */}
                            {(() => {
                              const coord930 = serviceData?.coordinators?.['9:30am'];
                              const coord1130 = serviceData?.coordinators?.['11:30am'];
                              const ujieres930 = serviceData?.ujieres?.['9:30am'];
                              const ujieres1130 = serviceData?.ujieres?.['11:30am'];
                              const sound930 = serviceData?.sound?.['9:30am'];
                              const sound1130 = serviceData?.sound?.['11:30am'];
                              const luces930 = serviceData?.luces?.['9:30am'];
                              const luces1130 = serviceData?.luces?.['11:30am'];
                              
                              const hasDifferences = (coord1130 && coord1130 !== coord930) ||
                                                     (ujieres1130 && ujieres1130 !== ujieres930) ||
                                                     (sound1130 && sound1130 !== sound930) ||
                                                     (luces1130 && luces1130 !== luces930);
                              
                              if (!hasDifferences) return null;
                              
                              return (
                                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '2px solid #2563eb' }}>
                                  <div style={{ fontSize: `${BASE_TITLE * 0.85 * page1Settings.titleFontScale}px`, fontWeight: '700', marginBottom: '8px', color: '#2563eb', textTransform: 'uppercase' }}>
                                    Equipo
                                  </div>
                                  {coord1130 && coord1130 !== coord930 && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, marginBottom: '4px' }}>
                                      <strong>Coord:</strong> {coord1130}
                                    </div>
                                  )}
                                  {ujieres1130 && ujieres1130 !== ujieres930 && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, marginBottom: '4px' }}>
                                      <strong>Ujieres:</strong> {ujieres1130}
                                    </div>
                                  )}
                                  {sound1130 && sound1130 !== sound930 && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, marginBottom: '4px' }}>
                                      <strong>Sonido:</strong> {sound1130}
                                    </div>
                                  )}
                                  {luces1130 && luces1130 !== luces930 && (
                                    <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px` }}>
                                      <strong>Luces:</strong> {luces1130}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          )}
                            </div>

                            {/* RECESO - Outside grid at bottom */}
                            {serviceData?.receso_notes?.['9:30am'] && (
                              <div style={{ margin: '16px 0 0 0', padding: '12px', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: `${BASE_TITLE * 0.85 * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>
                                  RECESO (30 min)
                                </div>
                                <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280' }}>
                                  {serviceData.receso_notes['9:30am']}
                                </div>
                              </div>
                            )}
                          </>
                          ) : isCustomService && serviceData?.segments ? (
                            <div style={{ fontSize: `${BASE_BODY * page1Settings.bodyFontScale}px`, lineHeight: 1.4, padding: '8px' }}>
                          {serviceData.segments.map((seg, idx) => (
                            <div key={idx} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: idx < serviceData.segments.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <div style={{ marginBottom: '2px' }}>
                                <span style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  {seg.title || 'Sin título'}
                                </span>
                                {seg.duration && <span style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} min)</span>}
                              </div>
                              {seg.leader && (
                                <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#16a34a', fontWeight: '600' }}>
                                  Dirige: {seg.leader}
                                </div>
                              )}
                              {seg.preacher && (
                                <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '600' }}>
                                  {seg.preacher}
                                </div>
                              )}
                              {seg.presenter && !seg.leader && !seg.preacher && (
                                <div style={{ fontSize: `${BASE_BODY * 0.95 * page1Settings.bodyFontScale}px`, color: '#374151' }}>
                                  {seg.presenter}
                                </div>
                              )}
                              {seg.translator && (
                                <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#6b7280' }}>
                                  🌐 {seg.translator}
                                </div>
                              )}
                              {seg.messageTitle && (
                                <div style={{ fontSize: `${BASE_BODY * 0.9 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic' }}>
                                  {seg.messageTitle}
                                </div>
                              )}
                              {seg.verse && (
                                <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af' }}>
                                  📖 {seg.verse}
                                </div>
                              )}
                              {seg.songs && seg.songs.filter(s => s.title).length > 0 && (
                                <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                                  {seg.songs.filter(s => s.title).map((song, sIdx) => (
                                    <div key={sIdx} style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#16a34a' }}>
                                      - {song.title} {song.lead && `(${song.lead})`}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {seg.description && (
                                <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px`, color: '#9ca3af', fontStyle: 'italic', marginTop: '3px' }}>
                                  {seg.description}
                                </div>
                              )}
                            </div>
                          ))}
                          {(serviceData.coordinators || serviceData.ujieres || serviceData.sound || serviceData.luces) && (
                            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1F8A70' }}>
                              <div style={{ fontSize: `${BASE_TITLE * 0.92 * page1Settings.titleFontScale}px`, fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>
                                Equipo
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {serviceData.coordinators && (
                                  <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px` }}>
                                    <strong>Coordinador:</strong> {serviceData.coordinators}
                                  </div>
                                )}
                                {serviceData.ujieres && (
                                  <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px` }}>
                                    <strong>Ujieres:</strong> {serviceData.ujieres}
                                  </div>
                                )}
                                {serviceData.sound && (
                                  <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px` }}>
                                    <strong>Sonido:</strong> {serviceData.sound}
                                  </div>
                                )}
                                {serviceData.luces && (
                                  <div style={{ fontSize: `${BASE_BODY * 0.86 * page1Settings.bodyFontScale}px` }}>
                                    <strong>Luces:</strong> {serviceData.luces}
                                  </div>
                                )}
                              </div>
                            </div>
                            )}
                            </div>
                            ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                              No hay datos de servicio
                            </div>
                            )}
                            </div>
                            </div>

        {/* FIXED Footer */}
        <div 
          style={{
            position: 'absolute',
            bottom: `${marginBottomPx}px`,
            left: 0,
            right: 0,
            height: `${FOOTER_H}px`,
            background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <span style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
            ¡Atrévete a cambiar!
          </span>
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
          height: `${PAGE_H}px`,
          display: 'block',
          margin: 0,
          flexShrink: 0,
          breakAfter: 'auto',
          breakInside: 'avoid'
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
              {selectedFixed.map((ann) => (
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
              <div style={{ fontSize: `${BASE_BODY * 0.86 * page2Settings.bodyFontScale}px`, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
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
          style={{
            position: 'absolute',
            bottom: `${marginBottomPx}px`,
            left: 0,
            right: 0,
            height: `${FOOTER_H}px`,
            background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <span style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
            ¡Atrévete a cambiar!
          </span>
        </div>
      </div>
    );
  }
}