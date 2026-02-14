import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import HelpTooltip from "@/components/utils/HelpTooltip";

/**
 * VisibilityTogglesSection — Extracted from SegmentFormTwoColumn (Phase 3B).
 * Renders the "Opciones de Visibilidad" card with 4 checkboxes controlling
 * which report views include this segment.
 * 
 * Props:
 *   formData    — full segment form state
 *   setFormData — state setter for formData
 */
export default function VisibilityTogglesSection({ formData, setFormData }) {
  return (
    <div id="otros" className="bg-white rounded-lg border border-l-4 border-l-slate-500 border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
        <h3 className="font-bold text-lg text-slate-900">Opciones de Visibilidad</h3>
        <HelpTooltip helpKey="segment.visibility" />
      </div>
      <div className="p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_general"
              checked={formData.show_in_general}
              onCheckedChange={(checked) => setFormData(prev => ({...prev, show_in_general: checked}))}
            />
            <label htmlFor="show_in_general" className="cursor-pointer">General</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_projection"
              checked={formData.show_in_projection}
              onCheckedChange={(checked) => setFormData(prev => ({...prev, show_in_projection: checked}))}
            />
            <label htmlFor="show_in_projection" className="cursor-pointer">Proyección</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_sound"
              checked={formData.show_in_sound}
              onCheckedChange={(checked) => setFormData(prev => ({...prev, show_in_sound: checked}))}
            />
            <label htmlFor="show_in_sound" className="cursor-pointer">Sonido</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show_in_ushers"
              checked={formData.show_in_ushers}
              onCheckedChange={(checked) => setFormData(prev => ({...prev, show_in_ushers: checked}))}
            />
            <label htmlFor="show_in_ushers" className="cursor-pointer">Ujieres</label>
          </div>
        </div>
      </div>
    </div>
  );
}