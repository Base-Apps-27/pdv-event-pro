import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, FileText, Bell, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  const [page1Settings, setPage1Settings] = useState(settingsPage1 || DEFAULT_SETTINGS);
  const [page2Settings, setPage2Settings] = useState(settingsPage2 || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("page1");
  const [pageFitScale, setPageFitScale] = useState(1);
  const [page1Overflows, setPage1Overflows] = useState(false);
  const [page2Overflows, setPage2Overflows] = useState(false);
  
  const previewWrapRef = useRef(null);
  const page1BodyRef = useRef(null);
  const page2BodyRef = useRef(null);

  const PAGE_W = 8.5 * 96; // 816px
  const PAGE_H = 11 * 96;  // 1056px
  const HEADER_H = 60;
  const FOOTER_H = 20;

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
    if (!previewWrapRef.current || !open) return;

    const element = previewWrapRef.current;

    const observer = new ResizeObserver((entries) => {
      const container = entries[0];
      if (!container) return;

      const containerWidth = container.contentRect.width;
      const containerHeight = container.contentRect.height;

      const scaleX = containerWidth / PAGE_W;
      const scaleY = containerHeight / PAGE_H;
      const scale = Math.min(scaleX, scaleY) * 0.90;

      setPageFitScale(scale);
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
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

  const currentSettings = activeTab === "page1" ? page1Settings : page2Settings;
  const marginTopPx = unitToPx(currentSettings.margins.top);
  const marginRightPx = unitToPx(currentSettings.margins.right);
  const marginBottomPx = unitToPx(currentSettings.margins.bottom);
  const marginLeftPx = unitToPx(currentSettings.margins.left);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl bg-white max-h-[95vh] overflow-hidden p-6">
        <DialogHeader className="pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5 text-pdv-teal" />
              {t.title}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
                {t.cancel}
              </Button>
              <Button onClick={handleSave} className="bg-pdv-teal text-white hover:bg-pdv-green" size="sm">
                {t.save}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="page1" className="gap-2">
              <FileText className="w-4 h-4" />
              {t.page1}
            </TabsTrigger>
            <TabsTrigger value="page2" className="gap-2">
              <Bell className="w-4 h-4" />
              {t.page2}
            </TabsTrigger>
          </TabsList>

          {/* PAGE 1 TAB */}
          <TabsContent value="page1" className="mt-0 h-[calc(95vh-180px)]">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left: Controls */}
              <div className="space-y-4 overflow-y-auto pr-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {t.noteP1}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.globalScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page1Settings.globalScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page1Settings.globalScale]}
                    onValueChange={([value]) => setPage1Settings(prev => ({ ...prev, globalScale: value }))}
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>70%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t.margins}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {['top', 'right', 'bottom', 'left'].map(side => (
                      <div key={side} className="space-y-1">
                        <Label className="text-sm">{t[side]}</Label>
                        <Input
                          value={page1Settings.margins[side]}
                          onChange={(e) => setPage1Settings(prev => ({
                            ...prev,
                            margins: { ...prev.margins, [side]: e.target.value }
                          }))}
                          placeholder="0.5in"
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.bodyFontScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page1Settings.bodyFontScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page1Settings.bodyFontScale]}
                    onValueChange={([value]) => setPage1Settings(prev => ({ ...prev, bodyFontScale: value }))}
                    min={0.8}
                    max={1.2}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span><span>100%</span><span>120%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.titleFontScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page1Settings.titleFontScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page1Settings.titleFontScale]}
                    onValueChange={([value]) => setPage1Settings(prev => ({ ...prev, titleFontScale: value }))}
                    min={0.8}
                    max={1.2}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span><span>100%</span><span>120%</span>
                  </div>
                </div>

                {page1Overflows && (
                  <Badge variant="destructive" className="w-full justify-center gap-1 py-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.overflow}
                  </Badge>
                )}
                {!page1Overflows && (
                  <Badge variant="outline" className="w-full justify-center gap-1 py-2 bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-4 h-4" />
                    {t.fits}
                  </Badge>
                )}
              </div>

              {/* Right: Page 1 Preview */}
              <div ref={previewWrapRef} className="bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                <div style={{ display: 'inline-block', transform: `scale(${pageFitScale})`, transformOrigin: 'center center' }}>
                  <div 
                    className="bg-white shadow-2xl relative"
                    style={{
                      width: `${PAGE_W}px`,
                      height: `${PAGE_H}px`,
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  >
                    {/* Margin Overlays */}
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

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
                      <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a' }}>
                        Orden de Servicio
                      </div>
                      <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
                        Domingo {selectedDateFormatted}
                      </div>
                      {isWeeklyService && (
                        <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                        bottom: `${marginBottomPx + FOOTER_H}px`,
                        zoom: page1Settings.globalScale
                      }}
                    >
                      {isWeeklyService && serviceData?.['9:30am'] ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: `${10.5 * page1Settings.bodyFontScale}px`, lineHeight: 1.3 }}>
                          {/* 9:30 AM Column */}
                          <div>
                            <div style={{ fontSize: `${12 * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#dc2626', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #1f2937', textTransform: 'uppercase' }}>
                              9:30 A.M.
                            </div>
                            {serviceData?.pre_service_notes?.['9:30am'] && (
                              <div style={{ marginBottom: '10px', fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                {serviceData.pre_service_notes['9:30am']}
                              </div>
                            )}
                            {Array.isArray(serviceData?.['9:30am']) && serviceData['9:30am'].filter(s => s?.type !== 'break').map((seg, idx) => (
                              <div key={idx} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '0.5px solid #f3f4f6' }}>
                                <div style={{ marginBottom: '3px' }}>
                                  <span style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', color: '#1a1a1a' }}>
                                    {seg.title || 'Sin título'}
                                  </span>
                                  {seg.duration && <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} mins)</span>}
                                </div>
                                {seg.data?.leader && (
                                  <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                                    Dirige: {seg.data.leader}
                                  </div>
                                )}
                                {seg.data?.preacher && (
                                  <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                                    {seg.data.preacher}
                                  </div>
                                )}
                                {seg.data?.presenter && !seg.data?.leader && (
                                  <div style={{ fontSize: '10px', color: '#374151', fontWeight: '500' }}>
                                    {seg.data.presenter}
                                  </div>
                                )}
                                {seg.data?.title && (
                                  <div style={{ fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                    {seg.data.title}
                                  </div>
                                )}
                                {seg.data?.verse && (
                                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                                    📖 {seg.data.verse}
                                  </div>
                                )}
                                {seg.songs && seg.songs.filter(s => s.title).length > 0 && (
                                  <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                                    {seg.songs.filter(s => s.title).map((song, sIdx) => (
                                      <div key={sIdx} style={{ fontSize: '9px', color: '#16a34a' }}>
                                        - {song.title} {song.lead && `(${song.lead})`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {seg.data?.ministry_leader && (
                                  <div style={{ fontSize: '9px', color: '#8b5cf6', marginTop: '3px' }}>
                                    • Ministración: {seg.data.ministry_leader} (5 min)
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* 11:30 AM Column */}
                          {serviceData?.['11:30am'] && (
                          <div>
                           <div style={{ fontSize: `${12 * page1Settings.titleFontScale}px`, fontWeight: '700', color: '#2563eb', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #1f2937', textTransform: 'uppercase' }}>
                             11:30 A.M.
                           </div>
                           {serviceData?.pre_service_notes?.['11:30am'] && (
                             <div style={{ marginBottom: '10px', fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                               {serviceData.pre_service_notes['11:30am']}
                             </div>
                           )}
                           {Array.isArray(serviceData?.['11:30am']) && serviceData['11:30am'].filter(s => s?.type !== 'break').map((seg, idx) => (
                              <div key={idx} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '0.5px solid #f3f4f6' }}>
                                <div style={{ marginBottom: '3px' }}>
                                  <span style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', color: '#1a1a1a' }}>
                                    {seg.title || 'Sin título'}
                                  </span>
                                  {seg.duration && <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} mins)</span>}
                                </div>
                                {seg.data?.leader && (
                                  <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                                    Dirige: {seg.data.leader}
                                  </div>
                                )}
                                {seg.data?.preacher && (
                                  <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                                    {seg.data.preacher}
                                  </div>
                                )}
                                {seg.data?.presenter && !seg.data?.leader && (
                                  <div style={{ fontSize: '10px', color: '#374151', fontWeight: '500' }}>
                                    {seg.data.presenter}
                                  </div>
                                )}
                                {seg.data?.translator && (
                                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                                    🌐 {seg.data.translator}
                                  </div>
                                )}
                                {seg.data?.title && (
                                  <div style={{ fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                    {seg.data.title}
                                  </div>
                                )}
                                {seg.data?.verse && (
                                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                                    📖 {seg.data.verse}
                                  </div>
                                )}
                                {seg.songs && seg.songs.filter(s => s.title).length > 0 && (
                                  <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                                    {seg.songs.filter(s => s.title).map((song, sIdx) => (
                                      <div key={sIdx} style={{ fontSize: '9px', color: '#16a34a' }}>
                                        - {song.title} {song.lead && `(${song.lead})`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {seg.data?.ministry_leader && (
                                  <div style={{ fontSize: '9px', color: '#8b5cf6', marginTop: '3px' }}>
                                    • Ministración: {seg.data.ministry_leader} (5 min)
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          )}
                        </div>
                      ) : isCustomService && serviceData?.segments ? (
                        <div style={{ fontSize: `${10.5 * page1Settings.bodyFontScale}px`, lineHeight: 1.3, padding: '8px' }}>
                          {serviceData.segments.map((seg, idx) => (
                            <div key={idx} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: idx < serviceData.segments.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <div style={{ marginBottom: '2px' }}>
                                <span style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  {seg.title || 'Sin título'}
                                </span>
                                {seg.duration && <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }}>({seg.duration} min)</span>}
                              </div>
                              {seg.leader && (
                                <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                                  Dirige: {seg.leader}
                                </div>
                              )}
                              {seg.preacher && (
                                <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: '600' }}>
                                  {seg.preacher}
                                </div>
                              )}
                              {seg.presenter && !seg.leader && !seg.preacher && (
                                <div style={{ fontSize: '10px', color: '#374151' }}>
                                  {seg.presenter}
                                </div>
                              )}
                              {seg.translator && (
                                <div style={{ fontSize: '9px', color: '#6b7280' }}>
                                  🌐 {seg.translator}
                                </div>
                              )}
                              {seg.messageTitle && (
                                <div style={{ fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                  {seg.messageTitle}
                                </div>
                              )}
                              {seg.verse && (
                                <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                                  📖 {seg.verse}
                                </div>
                              )}
                              {seg.songs && seg.songs.filter(s => s.title).length > 0 && (
                                <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                                  {seg.songs.filter(s => s.title).map((song, sIdx) => (
                                    <div key={sIdx} style={{ fontSize: '9px', color: '#16a34a' }}>
                                      - {song.title} {song.lead && `(${song.lead})`}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {seg.description && (
                                <div style={{ fontSize: '9px', color: '#9ca3af', fontStyle: 'italic', marginTop: '3px' }}>
                                  {seg.description}
                                </div>
                              )}
                            </div>
                          ))}
                          {(serviceData.coordinators || serviceData.ujieres || serviceData.sound || serviceData.luces) && (
                            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1F8A70' }}>
                              <div style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>
                                Equipo
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {serviceData.coordinators && (
                                  <div style={{ fontSize: '9px' }}>
                                    <strong>Coordinador:</strong> {serviceData.coordinators}
                                  </div>
                                )}
                                {serviceData.ujieres && (
                                  <div style={{ fontSize: '9px' }}>
                                    <strong>Ujieres:</strong> {serviceData.ujieres}
                                  </div>
                                )}
                                {serviceData.sound && (
                                  <div style={{ fontSize: '9px' }}>
                                    <strong>Sonido:</strong> {serviceData.sound}
                                  </div>
                                )}
                                {serviceData.luces && (
                                  <div style={{ fontSize: '9px' }}>
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
                        justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: '10px', color: 'white', fontWeight: 'bold' }}>
                        ¡Atrévete a cambiar!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PAGE 2 TAB */}
          <TabsContent value="page2" className="mt-0 h-[calc(95vh-180px)]">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left: Controls */}
              <div className="space-y-4 overflow-y-auto pr-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  {t.noteP2}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.globalScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page2Settings.globalScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page2Settings.globalScale]}
                    onValueChange={([value]) => setPage2Settings(prev => ({ ...prev, globalScale: value }))}
                    min={0.7}
                    max={1.2}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>70%</span><span>100%</span><span>120%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t.margins}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {['top', 'right', 'bottom', 'left'].map(side => (
                      <div key={side} className="space-y-1">
                        <Label className="text-sm">{t[side]}</Label>
                        <Input
                          value={page2Settings.margins[side]}
                          onChange={(e) => setPage2Settings(prev => ({
                            ...prev,
                            margins: { ...prev.margins, [side]: e.target.value }
                          }))}
                          placeholder="0.5in"
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.bodyFontScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page2Settings.bodyFontScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page2Settings.bodyFontScale]}
                    onValueChange={([value]) => setPage2Settings(prev => ({ ...prev, bodyFontScale: value }))}
                    min={0.8}
                    max={1.2}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span><span>100%</span><span>120%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t.titleFontScale}</Label>
                    <span className="text-sm font-mono text-gray-600">{(page2Settings.titleFontScale * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[page2Settings.titleFontScale]}
                    onValueChange={([value]) => setPage2Settings(prev => ({ ...prev, titleFontScale: value }))}
                    min={0.8}
                    max={1.2}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span><span>100%</span><span>120%</span>
                  </div>
                </div>

                {page2Overflows && (
                  <Badge variant="destructive" className="w-full justify-center gap-1 py-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.overflow}
                  </Badge>
                )}
                {!page2Overflows && (
                  <Badge variant="outline" className="w-full justify-center gap-1 py-2 bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-4 h-4" />
                    {t.fits}
                  </Badge>
                )}
              </div>

              {/* Right: Page 2 Preview */}
              <div className="bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                <div style={{ display: 'inline-block', transform: `scale(${pageFitScale})`, transformOrigin: 'center center' }}>
                  <div 
                    className="bg-white shadow-2xl relative"
                    style={{
                      width: `${PAGE_W}px`,
                      height: `${PAGE_H}px`,
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  >
                    {/* Margin Overlays */}
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

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
                      <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a' }}>
                        Anuncios
                      </div>
                      <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
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
                        bottom: `${marginBottomPx + FOOTER_H}px`,
                        zoom: page2Settings.globalScale
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: `${9.5 * page2Settings.bodyFontScale}px`, lineHeight: 1.3 }}>
                        {/* Left Column: Fixed Announcements */}
                        <div>
                          {selectedFixed.map((ann) => (
                            <div key={ann.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                              <div style={{ fontSize: `${10 * page2Settings.titleFontScale}px`, fontWeight: '600', textTransform: 'uppercase', marginBottom: '3px', color: '#1a1a1a' }}>
                                {ann.title}
                              </div>
                              {ann.content && (
                                <div 
                                  style={{ fontSize: '9.5px', color: '#374151', whiteSpace: 'pre-wrap' }}
                                  dangerouslySetInnerHTML={{ __html: sanitize(ann.content) }}
                                />
                              )}
                              {ann.instructions && (
                                <div style={{ fontSize: '8.5px', color: '#6b7280', fontStyle: 'italic', marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid #fbbf24' }}>
                                  <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: '7.5px' }}>CUE: </strong>
                                  <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                                </div>
                              )}
                              {ann.has_video && (
                                <div style={{ fontSize: '8px', color: '#8b5cf6', marginTop: '3px' }}>📹 Video</div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Right Column: Dynamic Events */}
                        <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '12px' }}>
                          <div style={{ fontSize: '9px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
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
                                <div style={{ fontSize: `${10 * page2Settings.titleFontScale}px`, fontWeight: '600', color: '#16a34a', marginBottom: '2px' }}>
                                  {ann.isEvent ? ann.name : ann.title}
                                </div>
                                {(ann.date_of_occurrence || ann.start_date) && (
                                  <div style={{ fontSize: '9px', color: '#4b5563', fontWeight: '500', marginBottom: '2px' }}>
                                    {ann.date_of_occurrence || ann.start_date}
                                    {ann.end_date && ` — ${ann.end_date}`}
                                  </div>
                                )}
                                {content && (
                                  <div 
                                    style={{ fontSize: '9px', color: '#374151', whiteSpace: 'pre-wrap' }}
                                    dangerouslySetInnerHTML={{ __html: sanitize(content) }}
                                  />
                                )}
                                {ann.instructions && (
                                  <div style={{ fontSize: '8px', color: '#6b7280', fontStyle: 'italic', marginTop: '3px', paddingLeft: '4px', borderLeft: '2px solid #fbbf24' }}>
                                    <strong style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: '7px' }}>CUE: </strong>
                                    <span dangerouslySetInnerHTML={{ __html: sanitize(ann.instructions) }} />
                                  </div>
                                )}
                                {(ann.has_video || ann.announcement_has_video) && (
                                  <div style={{ fontSize: '8px', color: '#8b5cf6', marginTop: '2px' }}>📹 Video</div>
                                )}
                              </div>
                            );
                          })}
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
                        justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: '10px', color: 'white', fontWeight: 'bold' }}>
                        ¡Atrévete a cambiar!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}