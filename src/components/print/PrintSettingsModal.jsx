import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, RotateCcw, FileText, Bell } from "lucide-react";

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

// Convert CSS units to pixels for preview (96 DPI standard)
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

  useEffect(() => {
    setPage1Settings(settingsPage1 || DEFAULT_SETTINGS);
    setPage2Settings(settingsPage2 || DEFAULT_SETTINGS);
  }, [settingsPage1, settingsPage2]);

  const handleReset = () => {
    if (activeTab === "page1") {
      setPage1Settings(DEFAULT_SETTINGS);
    } else {
      setPage2Settings(DEFAULT_SETTINGS);
    }
  };

  const handleSave = () => {
    onSave({ page1: page1Settings, page2: page2Settings });
    onOpenChange(false);
  };

  const currentSettings = activeTab === "page1" ? page1Settings : page2Settings;
  const setCurrentSettings = activeTab === "page1" ? setPage1Settings : setPage2Settings;

  // Preview calculations
  const previewScale = 0.07;
  const pageWidth = 8.5 * 96 * previewScale;
  const pageHeight = 11 * 96 * previewScale;
  
  const marginTopPx = unitToPx(currentSettings.margins.top) * previewScale;
  const marginRightPx = unitToPx(currentSettings.margins.right) * previewScale;
  const marginBottomPx = unitToPx(currentSettings.margins.bottom) * previewScale;
  const marginLeftPx = unitToPx(currentSettings.margins.left) * previewScale;

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
    preview: language === "es" ? "Vista Previa" : "Preview",
    reset: language === "es" ? "Restaurar" : "Reset",
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
      <DialogContent className="max-w-6xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5 text-pdv-teal" />
            {t.title}
          </DialogTitle>
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

          <TabsContent value="page1" className="mt-0">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Controls */}
              <div className="space-y-5">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t.preview}</Label>
                  <Badge variant="outline" className="text-xs">Letter</Badge>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-6 flex items-center justify-center min-h-[500px]">
                  <div 
                    className="bg-white shadow-2xl relative overflow-hidden"
                    style={{
                      width: `${pageWidth}px`,
                      height: `${pageHeight}px`,
                    }}
                  >
                    {/* Margin Overlays */}
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

                    {/* FIXED Header */}
                    <div 
                      className="absolute bg-white border-b border-gray-300"
                      style={{
                        top: `${marginTopPx}px`,
                        left: `${marginLeftPx}px`,
                        right: `${marginRightPx}px`,
                        height: `${10 * previewScale}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ fontSize: `${3 * previewScale}px`, fontWeight: 'bold', textAlign: 'center' }}>
                        ORDEN DE SERVICIO
                      </div>
                    </div>

                    {/* SCALABLE Body Content */}
                    <div 
                      className="absolute"
                      style={{
                        top: `${marginTopPx + 10 * previewScale}px`,
                        left: `${marginLeftPx}px`,
                        right: `${marginRightPx}px`,
                        bottom: `${marginBottomPx + 4 * previewScale}px`,
                        transform: `scale(${page1Settings.globalScale})`,
                        transformOrigin: 'top left',
                        overflow: 'hidden'
                      }}
                    >
                      {serviceData && serviceData.segments ? (
                        <div style={{ padding: `${1 * previewScale}px` }}>
                          {serviceData.segments.slice(0, 4).map((seg, idx) => (
                            <div key={idx} style={{ marginBottom: `${1 * previewScale}px` }}>
                              <div style={{ fontSize: `${1.8 * previewScale * page1Settings.titleFontScale}px`, fontWeight: '600', marginBottom: `${0.3 * previewScale}px`, textTransform: 'uppercase' }}>
                                {seg.title}
                              </div>
                              {seg.leader && (
                                <div style={{ fontSize: `${1.4 * previewScale * page1Settings.bodyFontScale}px`, color: '#16a34a' }}>
                                  Dirige: {seg.leader}
                                </div>
                              )}
                              {seg.preacher && (
                                <div style={{ fontSize: `${1.4 * previewScale * page1Settings.bodyFontScale}px`, color: '#2563eb' }}>
                                  {seg.preacher}
                                </div>
                              )}
                              {seg.presenter && !seg.leader && !seg.preacher && (
                                <div style={{ fontSize: `${1.4 * previewScale * page1Settings.bodyFontScale}px`, color: '#374151' }}>
                                  {seg.presenter}
                                </div>
                              )}
                              {seg.songs && seg.songs.length > 0 && seg.songs.some(s => s.title) && (
                                <div style={{ fontSize: `${1.2 * previewScale * page1Settings.bodyFontScale}px`, color: '#6b7280', marginTop: `${0.3 * previewScale}px` }}>
                                  {seg.songs.filter(s => s.title).slice(0, 2).map(s => s.title).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1" style={{ padding: `${1 * previewScale}px` }}>
                          <div>
                            <div style={{ fontSize: `${1.8 * previewScale * page1Settings.titleFontScale}px`, fontWeight: '600', marginBottom: `${0.5 * previewScale}px` }}>
                              ALABANZA
                            </div>
                            <div style={{ fontSize: `${1.5 * previewScale * page1Settings.bodyFontScale}px`, color: '#16a34a' }}>
                              Dirige: Juan Pérez
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: `${1.8 * previewScale * page1Settings.titleFontScale}px`, fontWeight: '600', marginBottom: `${0.5 * previewScale}px` }}>
                              MENSAJE
                            </div>
                            <div style={{ fontSize: `${1.5 * previewScale * page1Settings.bodyFontScale}px`, color: '#2563eb' }}>
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
                        height: `${4 * previewScale}px`,
                        background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: `${1.5 * previewScale}px`, color: 'white', fontWeight: 'bold' }}>
                        ¡Atrévete a cambiar!
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  {language === "es" 
                    ? "Azul = márgenes • Cabecera/pie fijos • Cuerpo escala" 
                    : "Blue = margins • Header/footer fixed • Body scales"}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="page2" className="mt-0">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Controls */}
              <div className="space-y-5">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t.preview}</Label>
                  <Badge variant="outline" className="text-xs">Letter</Badge>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-6 flex items-center justify-center min-h-[500px]">
                  <div 
                    className="bg-white shadow-2xl relative overflow-hidden"
                    style={{
                      width: `${pageWidth}px`,
                      height: `${pageHeight}px`,
                    }}
                  >
                    {/* Margin Overlays */}
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, left: 0, right: 0, height: `${marginTopPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ bottom: 0, left: 0, right: 0, height: `${marginBottomPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, left: 0, bottom: 0, width: `${marginLeftPx}px` }} />
                    <div className="absolute bg-blue-400 opacity-20" style={{ top: 0, right: 0, bottom: 0, width: `${marginRightPx}px` }} />

                    {/* FIXED Header */}
                    <div 
                      className="absolute bg-white border-b border-gray-300"
                      style={{
                        top: `${marginTopPx}px`,
                        left: `${marginLeftPx}px`,
                        right: `${marginRightPx}px`,
                        height: `${10 * previewScale}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ fontSize: `${3 * previewScale}px`, fontWeight: 'bold', textAlign: 'center' }}>
                        ANUNCIOS
                      </div>
                    </div>

                    {/* SCALABLE Body - 2 Column Announcements */}
                    <div 
                      className="absolute"
                      style={{
                        top: `${marginTopPx + 10 * previewScale}px`,
                        left: `${marginLeftPx}px`,
                        right: `${marginRightPx}px`,
                        bottom: `${marginBottomPx + 4 * previewScale}px`,
                        transform: `scale(${page2Settings.globalScale})`,
                        transformOrigin: 'top left',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2" style={{ padding: `${1 * previewScale}px` }}>
                        <div>
                          <div style={{ fontSize: `${1.8 * previewScale * page2Settings.titleFontScale}px`, fontWeight: '600', marginBottom: `${0.5 * previewScale}px` }}>
                            TÍTULO ANUNCIO
                          </div>
                          <div style={{ fontSize: `${1.4 * previewScale * page2Settings.bodyFontScale}px`, color: '#374151', lineHeight: 1.2 }}>
                            Contenido del anuncio fijo que aparece cada semana...
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: `${1.8 * previewScale * page2Settings.titleFontScale}px`, fontWeight: '600', marginBottom: `${0.5 * previewScale}px` }}>
                            EVENTO PRÓXIMO
                          </div>
                          <div style={{ fontSize: `${1.3 * previewScale * page2Settings.bodyFontScale}px`, color: '#6b7280', marginBottom: `${0.3 * previewScale}px` }}>
                            25 de Diciembre
                          </div>
                          <div style={{ fontSize: `${1.4 * previewScale * page2Settings.bodyFontScale}px`, color: '#374151', lineHeight: 1.2 }}>
                            Detalles del evento...
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
                        height: `${4 * previewScale}px`,
                        background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: `${1.5 * previewScale}px`, color: 'white', fontWeight: 'bold' }}>
                        ¡Atrévete a cambiar!
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  {language === "es" 
                    ? "Azul = márgenes • Cabecera/pie fijos • 2 columnas siempre" 
                    : "Blue = margins • Header/footer fixed • 2 columns always"}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t.reset}
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave} className="bg-pdv-teal text-white hover:bg-pdv-green">
              {t.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}