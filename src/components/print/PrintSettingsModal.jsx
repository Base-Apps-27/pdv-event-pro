import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, FileText, Bell } from "lucide-react";

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

// Convert CSS units to pixels (96 DPI standard)
const unitToPx = (value) => {
  if (!value) return 0;
  const num = parseFloat(value);
  if (value.includes('in')) return num * 96;
  if (value.includes('cm')) return num * 37.8;
  if (value.includes('mm')) return num * 3.78;
  if (value.includes('pt')) return num * 1.33;
  return num; // assume px
};

export default function PrintSettingsModal({ open, onOpenChange, settingsPage1, settingsPage2, onSave, language = "es", serviceData = null }) {
  const [page1Settings, setPage1Settings] = useState(settingsPage1 || DEFAULT_SETTINGS);
  const [page2Settings, setPage2Settings] = useState(settingsPage2 || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("page1");
  const [pageFitScale, setPageFitScale] = useState(1);
  
  const previewWrapRef = useRef(null);

  useEffect(() => {
    setPage1Settings(settingsPage1 || DEFAULT_SETTINGS);
    setPage2Settings(settingsPage2 || DEFAULT_SETTINGS);
  }, [settingsPage1, settingsPage2]);

  // Real Letter page dimensions
  const PAGE_W = 8.5 * 96; // 816px
  const PAGE_H = 11 * 96;  // 1056px
  const HEADER_H = 40;
  const FOOTER_H = 20;

  // Responsive preview scaling using ResizeObserver
  useEffect(() => {
    if (!previewWrapRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const container = entries[0];
      if (!container) return;

      const containerWidth = container.contentRect.width;
      const containerHeight = container.contentRect.height;

      const scaleX = containerWidth / PAGE_W;
      const scaleY = containerHeight / PAGE_H;
      const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to add padding

      setPageFitScale(scale);
    });

    observer.observe(previewWrapRef.current);

    return () => observer.disconnect();
  }, [open]);

  const handleSave = () => {
    onSave({ page1: page1Settings, page2: page2Settings });
    onOpenChange(false);
  };

  const currentSettings = activeTab === "page1" ? page1Settings : page2Settings;
  const setCurrentSettings = activeTab === "page1" ? setPage1Settings : setPage2Settings;

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
    noteP1: language === "es" 
      ? "Ajusta cómo se imprime el programa de servicio (horarios, segmentos, equipos)." 
      : "Adjust how the service program prints (schedules, segments, teams).",
    noteP2: language === "es"
      ? "Ajusta cómo se imprimen los anuncios (siempre en 2 columnas)."
      : "Adjust how announcements print (always 2 columns)."
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl bg-white max-h-[95vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5 text-pdv-teal" />
              {t.title}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button onClick={handleSave} className="bg-pdv-teal text-white hover:bg-pdv-green">
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

          <TabsContent value="page1" className="mt-0 h-[calc(95vh-140px)]">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left: Controls */}
              <div className="space-y-5 overflow-y-auto pr-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {t.noteP1}
                </div>

                {/* Global Scale */}
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

                {/* Margins */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t.margins}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">{t.top}</Label>
                      <Input
                        value={page1Settings.margins.top}
                        onChange={(e) => setPage1Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, top: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.right}</Label>
                      <Input
                        value={page1Settings.margins.right}
                        onChange={(e) => setPage1Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, right: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.bottom}</Label>
                      <Input
                        value={page1Settings.margins.bottom}
                        onChange={(e) => setPage1Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, bottom: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.left}</Label>
                      <Input
                        value={page1Settings.margins.left}
                        onChange={(e) => setPage1Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, left: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Body Font Scale */}
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
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>

                {/* Title Font Scale */}
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
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>
              </div>

              {/* Right: Preview for Page 1 */}
              <div 
                ref={previewWrapRef}
                className="bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden"
              >
                <div 
                  className="bg-white shadow-2xl relative"
                  style={{
                    width: `${PAGE_W}px`,
                    height: `${PAGE_H}px`,
                    transform: `scale(${pageFitScale})`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Margin Overlays */}
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

                  {/* FIXED Header */}
                  <div 
                    className="absolute bg-white border-b border-gray-300"
                    style={{
                      top: `${marginTopPx}px`,
                      left: `${marginLeftPx}px`,
                      right: `${marginRightPx}px`,
                      height: `${HEADER_H}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>
                      Orden de Servicio
                    </div>
                  </div>

                  {/* SCALABLE Body Content (zoom applied here) */}
                  <div 
                    className="absolute overflow-hidden"
                    style={{
                      top: `${marginTopPx + HEADER_H}px`,
                      left: `${marginLeftPx}px`,
                      right: `${marginRightPx}px`,
                      bottom: `${marginBottomPx + FOOTER_H}px`,
                      zoom: page1Settings.globalScale
                    }}
                  >
                    {serviceData && serviceData.segments && serviceData.segments.length > 0 ? (
                      <div style={{ padding: '8px', fontSize: `${10.5 * page1Settings.bodyFontScale}px`, lineHeight: 1.3 }}>
                        {serviceData.segments.map((seg, idx) => (
                          <div key={idx} style={{ marginBottom: '8px', borderBottom: idx < serviceData.segments.length - 1 ? '1px solid #e5e7eb' : 'none', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                              <div style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1 }}>
                                {seg.title || 'Sin título'}
                              </div>
                              {seg.duration && (
                                <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px`, color: '#9ca3af', fontWeight: '500' }}>
                                  {seg.duration}min
                                </div>
                              )}
                            </div>

                            {seg.leader && (
                              <div style={{ fontSize: `${10 * page1Settings.bodyFontScale}px`, color: '#16a34a', fontWeight: '600', marginBottom: '2px' }}>
                                Dirige: {seg.leader}
                              </div>
                            )}

                            {seg.preacher && (
                              <div style={{ fontSize: `${10 * page1Settings.bodyFontScale}px`, color: '#2563eb', fontWeight: '600', marginBottom: '2px' }}>
                                {seg.preacher}
                              </div>
                            )}

                            {seg.presenter && !seg.leader && !seg.preacher && (
                              <div style={{ fontSize: `${10 * page1Settings.bodyFontScale}px`, color: '#374151', fontWeight: '500', marginBottom: '2px' }}>
                                {seg.presenter}
                              </div>
                            )}

                            {seg.messageTitle && (
                              <div style={{ fontSize: `${9.5 * page1Settings.bodyFontScale}px`, color: '#6b7280', fontStyle: 'italic', marginBottom: '2px' }}>
                                {seg.messageTitle}
                              </div>
                            )}

                            {seg.verse && (
                              <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginBottom: '2px' }}>
                                📖 {seg.verse}
                              </div>
                            )}

                            {seg.songs && seg.songs.length > 0 && seg.songs.some(s => s.title) && (
                              <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #16a34a' }}>
                                {seg.songs.filter(s => s.title).map((song, sIdx) => (
                                  <div key={sIdx} style={{ fontSize: `${9 * page1Settings.bodyFontScale}px`, color: '#16a34a', marginBottom: '2px' }}>
                                    • {song.title} {song.lead && `(${song.lead})`}
                                  </div>
                                ))}
                              </div>
                            )}

                            {seg.description && (
                              <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px`, color: '#9ca3af', marginTop: '3px', fontStyle: 'italic' }}>
                                {seg.description}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Team Section */}
                        {(serviceData.coordinators || serviceData.ujieres || serviceData.sound || serviceData.luces) && (
                          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1F8A70' }}>
                            <div style={{ fontSize: `${11 * page1Settings.titleFontScale}px`, fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>
                              Equipo
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                              {serviceData.coordinators && (
                                <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px` }}>
                                  <strong>Coordinador:</strong> {serviceData.coordinators}
                                </div>
                              )}
                              {serviceData.ujieres && (
                                <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px` }}>
                                  <strong>Ujieres:</strong> {serviceData.ujieres}
                                </div>
                              )}
                              {serviceData.sound && (
                                <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px` }}>
                                  <strong>Sonido:</strong> {serviceData.sound}
                                </div>
                              )}
                              {serviceData.luces && (
                                <div style={{ fontSize: `${9 * page1Settings.bodyFontScale}px` }}>
                                  <strong>Luces:</strong> {serviceData.luces}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '8px', fontSize: `${10 * page1Settings.bodyFontScale}px` }}>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: `${12 * page1Settings.titleFontScale}px`, fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase' }}>
                            Alabanza
                          </div>
                          <div style={{ fontSize: `${10 * page1Settings.bodyFontScale}px`, color: '#16a34a' }}>
                            Dirige: Juan Pérez
                          </div>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: `${12 * page1Settings.titleFontScale}px`, fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase' }}>
                            Mensaje
                          </div>
                          <div style={{ fontSize: `${10 * page1Settings.bodyFontScale}px`, color: '#2563eb' }}>
                            Pastor Juan
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FIXED Footer */}
                  <div 
                    className="absolute"
                    style={{
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
          </TabsContent>

          <TabsContent value="page2" className="mt-0 h-[calc(95vh-140px)]">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left: Controls */}
              <div className="space-y-5 overflow-y-auto pr-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  {t.noteP2}
                </div>

                {/* Global Scale */}
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
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>70%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>

                {/* Margins */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t.margins}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">{t.top}</Label>
                      <Input
                        value={page2Settings.margins.top}
                        onChange={(e) => setPage2Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, top: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.right}</Label>
                      <Input
                        value={page2Settings.margins.right}
                        onChange={(e) => setPage2Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, right: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.bottom}</Label>
                      <Input
                        value={page2Settings.margins.bottom}
                        onChange={(e) => setPage2Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, bottom: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">{t.left}</Label>
                      <Input
                        value={page2Settings.margins.left}
                        onChange={(e) => setPage2Settings(prev => ({
                          ...prev,
                          margins: { ...prev.margins, left: e.target.value }
                        }))}
                        placeholder="0.5in"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Body Font Scale */}
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
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>

                {/* Title Font Scale */}
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
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>80%</span>
                    <span>100%</span>
                    <span>120%</span>
                  </div>
                </div>
              </div>

              {/* Right: Preview for Page 2 */}
              <div 
                ref={activeTab === "page2" ? previewWrapRef : null}
                className="bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden"
              >
                <div 
                  className="bg-white shadow-2xl relative"
                  style={{
                    width: `${PAGE_W}px`,
                    height: `${PAGE_H}px`,
                    transform: `scale(${pageFitScale})`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Margin Overlays */}
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                  <div className="absolute bg-blue-400 opacity-20 pointer-events-none" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

                  {/* FIXED Header */}
                  <div 
                    className="absolute bg-white border-b border-gray-300"
                    style={{
                      top: `${marginTopPx}px`,
                      left: `${marginLeftPx}px`,
                      right: `${marginRightPx}px`,
                      height: `${HEADER_H}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>
                      Anuncios
                    </div>
                  </div>

                  {/* SCALABLE Body - 2 Column Announcements (zoom applied here) */}
                  <div 
                    className="absolute overflow-hidden"
                    style={{
                      top: `${marginTopPx + HEADER_H}px`,
                      left: `${marginLeftPx}px`,
                      right: `${marginRightPx}px`,
                      bottom: `${marginBottomPx + FOOTER_H}px`,
                      zoom: page2Settings.globalScale
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '4px' }}>
                      <div>
                        <div style={{ fontSize: `${10 * page2Settings.titleFontScale}px`, fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>
                          Título Anuncio
                        </div>
                        <div style={{ fontSize: `${9 * page2Settings.bodyFontScale}px`, color: '#374151', lineHeight: 1.3 }}>
                          Contenido del anuncio fijo que aparece cada semana con información importante para la congregación.
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: `${10 * page2Settings.titleFontScale}px`, fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>
                          Evento Próximo
                        </div>
                        <div style={{ fontSize: `${9 * page2Settings.bodyFontScale}px`, color: '#6b7280', marginBottom: '2px' }}>
                          25 de Diciembre
                        </div>
                        <div style={{ fontSize: `${9 * page2Settings.bodyFontScale}px`, color: '#374151', lineHeight: 1.3 }}>
                          Detalles del evento especial con información completa.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FIXED Footer */}
                  <div 
                    className="absolute"
                    style={{
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}