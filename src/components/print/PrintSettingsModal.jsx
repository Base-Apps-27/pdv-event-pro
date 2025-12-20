import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Settings, RotateCcw } from "lucide-react";

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

export default function PrintSettingsModal({ open, onOpenChange, settings, onSave, language = "es" }) {
  const [localSettings, setLocalSettings] = useState(settings || DEFAULT_SETTINGS);

  useEffect(() => {
    setLocalSettings(settings || DEFAULT_SETTINGS);
  }, [settings]);

  // Calculate preview dimensions (8.5x11 inch at small scale)
  const previewScale = 0.08; // 8% of actual size for preview
  const pageWidth = 8.5 * 96 * previewScale; // 96 DPI
  const pageHeight = 11 * 96 * previewScale;

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  const handleSave = () => {
    onSave(localSettings);
    onOpenChange(false);
  };

  const t = {
    title: language === "es" ? "Configuración de Impresión" : "Print Settings",
    globalScale: language === "es" ? "Escala Global del Contenido" : "Global Content Scale",
    margins: language === "es" ? "Márgenes de Página" : "Page Margins",
    top: language === "es" ? "Superior" : "Top",
    right: language === "es" ? "Derecha" : "Right",
    bottom: language === "es" ? "Inferior" : "Bottom",
    left: language === "es" ? "Izquierda" : "Left",
    bodyFontScale: language === "es" ? "Escala de Texto del Cuerpo" : "Body Text Scale",
    titleFontScale: language === "es" ? "Escala de Títulos" : "Title Scale",
    announcementsLayout: language === "es" ? "Diseño de Anuncios" : "Announcements Layout",
    twoColumns: language === "es" ? "2 Columnas (fijo)" : "2 Columns (fixed)",
    reset: language === "es" ? "Restaurar Valores" : "Reset to Defaults",
    cancel: language === "es" ? "Cancelar" : "Cancel",
    save: language === "es" ? "Guardar" : "Save",
    note: language === "es" 
      ? "Estos ajustes se aplicarán a todo el contenido imprimible (programas y anuncios)." 
      : "These settings will apply to all printable content (programs and announcements)."
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

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              {t.note}
            </div>

            {/* Global Scale */}
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t.globalScale}</Label>
              <span className="text-sm font-mono text-gray-600">{(localSettings.globalScale * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[localSettings.globalScale]}
              onValueChange={([value]) => setLocalSettings(prev => ({ ...prev, globalScale: value }))}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">{t.top}</Label>
                  <Input
                    value={localSettings.margins.top}
                    onChange={(e) => setLocalSettings(prev => ({
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
                    value={localSettings.margins.right}
                    onChange={(e) => setLocalSettings(prev => ({
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
                    value={localSettings.margins.bottom}
                    onChange={(e) => setLocalSettings(prev => ({
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
                    value={localSettings.margins.left}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      margins: { ...prev.margins, left: e.target.value }
                    }))}
                    placeholder="0.5in"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>


          </div>

          {/* Right: Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                {language === "es" ? "Vista Previa" : "Preview"}
              </Label>
              <Badge variant="outline" className="text-xs">Letter Size</Badge>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[500px]">
              <div 
                className="bg-white shadow-lg relative"
                style={{
                  width: `${pageWidth}px`,
                  height: `${pageHeight}px`,
                  border: '1px solid #d1d5db'
                }}
              >
                {/* Margin Indicators */}
                <div 
                  className="absolute bg-blue-50 border border-blue-300 opacity-40"
                  style={{
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `calc(${localSettings.margins.top} * ${previewScale * 96})`,
                  }}
                />
                <div 
                  className="absolute bg-blue-50 border border-blue-300 opacity-40"
                  style={{
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `calc(${localSettings.margins.bottom} * ${previewScale * 96})`,
                  }}
                />
                <div 
                  className="absolute bg-blue-50 border border-blue-300 opacity-40"
                  style={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `calc(${localSettings.margins.left} * ${previewScale * 96})`,
                  }}
                />
                <div 
                  className="absolute bg-blue-50 border border-blue-300 opacity-40"
                  style={{
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: `calc(${localSettings.margins.right} * ${previewScale * 96})`,
                  }}
                />

                {/* Content Area with Scaling */}
                <div 
                  className="absolute"
                  style={{
                    top: `calc(${localSettings.margins.top} * ${previewScale * 96})`,
                    left: `calc(${localSettings.margins.left} * ${previewScale * 96})`,
                    right: `calc(${localSettings.margins.right} * ${previewScale * 96})`,
                    bottom: `calc(${localSettings.margins.bottom} * ${previewScale * 96})`,
                    transform: `scale(${localSettings.globalScale})`,
                    transformOrigin: 'top left',
                    overflow: 'hidden'
                  }}
                >
                  {/* Header Sample */}
                  <div className="text-center mb-1 pb-1 border-b border-gray-300">
                    <div 
                      className="font-bold uppercase mb-0.5"
                      style={{ 
                        fontSize: `${2 * localSettings.titleFontScale}px`,
                        lineHeight: 1.2
                      }}
                    >
                      ORDEN DE SERVICIO
                    </div>
                    <div style={{ fontSize: `${1.2 * localSettings.bodyFontScale}px`, color: '#6b7280' }}>
                      Domingo 22 de Diciembre
                    </div>
                  </div>

                  {/* Two Column Layout Sample */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div 
                        className="font-bold mb-1 pb-0.5 border-b border-gray-400"
                        style={{ fontSize: `${1.5 * localSettings.titleFontScale}px` }}
                      >
                        9:30 A.M.
                      </div>
                      <div className="space-y-1">
                        <div>
                          <div 
                            className="font-semibold uppercase"
                            style={{ fontSize: `${1.2 * localSettings.titleFontScale}px` }}
                          >
                            ALABANZA
                          </div>
                          <div style={{ fontSize: `${1 * localSettings.bodyFontScale}px`, color: '#374151' }}>
                            Dirige: Juan Pérez
                          </div>
                        </div>
                        <div>
                          <div 
                            className="font-semibold uppercase"
                            style={{ fontSize: `${1.2 * localSettings.titleFontScale}px` }}
                          >
                            MENSAJE
                          </div>
                          <div style={{ fontSize: `${1 * localSettings.bodyFontScale}px`, color: '#374151' }}>
                            Pastor María González
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div 
                        className="font-bold mb-1 pb-0.5 border-b border-gray-400"
                        style={{ fontSize: `${1.5 * localSettings.titleFontScale}px` }}
                      >
                        11:30 A.M.
                      </div>
                      <div className="space-y-1">
                        <div>
                          <div 
                            className="font-semibold uppercase"
                            style={{ fontSize: `${1.2 * localSettings.titleFontScale}px` }}
                          >
                            ALABANZA
                          </div>
                          <div style={{ fontSize: `${1 * localSettings.bodyFontScale}px`, color: '#374151' }}>
                            Dirige: Ana López
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Page 2 Sample - Announcements */}
                  <div className="mt-3 pt-2 border-t-2 border-gray-400">
                    <div 
                      className="text-center font-bold uppercase mb-1"
                      style={{ fontSize: `${2 * localSettings.titleFontScale}px` }}
                    >
                      ANUNCIOS
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <div 
                          className="font-semibold uppercase mb-0.5"
                          style={{ fontSize: `${1.1 * localSettings.titleFontScale}px` }}
                        >
                          TÍTULO ANUNCIO
                        </div>
                        <div style={{ fontSize: `${0.9 * localSettings.bodyFontScale}px`, color: '#374151', lineHeight: 1.2 }}>
                          Contenido del anuncio...
                        </div>
                      </div>
                      <div>
                        <div 
                          className="font-semibold uppercase mb-0.5"
                          style={{ fontSize: `${1.1 * localSettings.titleFontScale}px` }}
                        >
                          EVENTO
                        </div>
                        <div style={{ fontSize: `${0.9 * localSettings.bodyFontScale}px`, color: '#374151', lineHeight: 1.2 }}>
                          Detalles del evento...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                {language === "es" 
                  ? "Áreas azules = márgenes • Contenido escala en tiempo real" 
                  : "Blue areas = margins • Content scales in real-time"}
              </p>
            </div>
          </div>
        </div>

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