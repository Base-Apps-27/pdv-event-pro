import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, ListChecks } from "lucide-react";

/**
 * AnnouncementSeriesSection — Extracted from SegmentFormTwoColumn (Phase 3B).
 * Renders the Announcement Series selector + manual overrides for Anuncio segments.
 * 
 * Props:
 *   formData            — full segment form state
 *   updateField          — field updater (tracks field origin changes)
 *   announcementSeries   — array of AnnouncementSeries records
 *   onManageSeries       — callback to open the AnnouncementSeriesManager modal
 */
export default function AnnouncementSeriesSection({ formData, updateField, announcementSeries, onManageSeries }) {
  return (
    <div className="space-y-3 bg-indigo-50 p-4 rounded border border-indigo-200 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h4 className="font-bold text-indigo-800">Serie de Anuncios</h4>
        </div>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={onManageSeries}
          className="bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
        >
          <ListChecks className="w-4 h-4 mr-2" />
          Gestionar Series
        </Button>
      </div>
      
      <div className="space-y-2">
        <Label>Seleccionar Serie de Anuncios</Label>
        <div className="relative">
          <Select 
            value={formData.announcement_series_id}
            onValueChange={(value) => updateField('announcement_series_id', value)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Seleccionar configuración..." />
            </SelectTrigger>
            <SelectContent>
              {announcementSeries.map(series => (
                <SelectItem key={series.id} value={series.id}>{series.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-indigo-700 mt-1">
          Esta serie determina qué anuncios fijos y eventos dinámicos se mostrarán.
        </p>
      </div>

      {/* Legacy Fields / Manual Overrides */}
      <div className="mt-4 pt-4 border-t border-indigo-200">
        <Label className="text-xs font-bold text-indigo-800 uppercase mb-2 block">Overrides Manuales (Opcional)</Label>
        <div className="space-y-2">
          <Label className="text-xs">Título Alternativo (Sobreescribe nombre de serie)</Label>
          <Input 
            value={formData.announcement_title}
            onChange={(e) => updateField('announcement_title', e.target.value)}
            placeholder="Dejar vacío para usar nombre de serie"
            className="bg-white h-8 text-sm"
          />
        </div>
        <div className="space-y-2 mt-2">
          <Label className="text-xs">Notas Adicionales</Label>
          <Textarea 
            value={formData.announcement_description}
            onChange={(e) => updateField('announcement_description', e.target.value)}
            rows={2}
            placeholder="Notas extra específicas para este servicio..."
            className="bg-white text-sm"
          />
        </div>
      </div>
    </div>
  );
}