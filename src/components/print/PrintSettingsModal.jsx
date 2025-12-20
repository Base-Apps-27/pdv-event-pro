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
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5 text-pdv-teal" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {/* Body Font Scale */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t.bodyFontScale}</Label>
              <span className="text-sm font-mono text-gray-600">{(localSettings.bodyFontScale * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[localSettings.bodyFontScale]}
              onValueChange={([value]) => setLocalSettings(prev => ({ ...prev, bodyFontScale: value }))}
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
              <span className="text-sm font-mono text-gray-600">{(localSettings.titleFontScale * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[localSettings.titleFontScale]}
              onValueChange={([value]) => setLocalSettings(prev => ({ ...prev, titleFontScale: value }))}
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

          {/* Announcements Layout (Fixed) */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">{t.announcementsLayout}</Label>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm text-gray-700">
              {t.twoColumns}
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