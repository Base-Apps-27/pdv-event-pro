import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldOriginIndicator, getFieldOrigin } from "@/components/utils/fieldOrigins";
import HelpTooltip from "@/components/utils/HelpTooltip";

/**
 * TeamNotesSection — Extracted from SegmentFormTwoColumn (Phase 3B).
 * Renders the "Notas por Equipo" card with per-department textarea fields.
 * Visibility of each field is controlled by the parent via boolean props.
 * 
 * Props:
 *   formData       — full segment form state
 *   updateField    — field updater (tracks field origin changes)
 *   setFormData    — direct state setter (for translation_notes which doesn't track origins)
 *   fieldOrigins   — origin map for FieldOriginIndicator badges
 *   isBreakType    — hides Projection, Sound, Ushers, Stage & Decor notes
 *   isBreakoutType — hides all notes (replaced by per-room notes message)
 *   isTechOnly     — hides Ushers notes
 *   requiresTranslation — shows Translation notes field
 */
export default function TeamNotesSection({
  formData,
  updateField,
  setFormData,
  fieldOrigins,
  isBreakType,
  isBreakoutType,
  isTechOnly,
  requiresTranslation,
}) {
  return (
    <div id="notas" className="bg-white rounded-lg border border-l-4 border-l-purple-500 border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
        <h3 className="font-bold text-lg text-slate-900">Notas por Equipo</h3>
        <HelpTooltip helpKey="segment.teamNotes" />
      </div>
      
      <div className="p-4 space-y-3">
        {isBreakoutType && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
            <p className="text-gray-700">
              Para segmentos de tipo Breakout, las notas se definen individualmente para cada sala en la sección de "Contenido Específico".
            </p>
          </div>
        )}

        {!isBreakType && !isBreakoutType && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-purple-700">Proyección</Label>
              <div className="relative">
                <Textarea 
                  value={formData.projection_notes}
                  onChange={(e) => updateField('projection_notes', e.target.value)}
                  rows={2}
                  placeholder="Slides, videos..."
                  className="text-sm"
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'projection_notes')} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-red-700">Sonido</Label>
              <div className="relative">
                <Textarea 
                  value={formData.sound_notes}
                  onChange={(e) => updateField('sound_notes', e.target.value)}
                  rows={2}
                  placeholder="Micrófonos, cues..."
                  className="text-sm"
                />
                <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'sound_notes')} />
              </div>
            </div>
          </>
        )}

        {!isBreakType && !isTechOnly && !isBreakoutType && (
          <div className="space-y-1">
            <Label className="text-xs text-green-700">Ujieres</Label>
            <div className="relative">
              <Textarea 
                value={formData.ushers_notes}
                onChange={(e) => updateField('ushers_notes', e.target.value)}
                rows={2}
                placeholder="Instrucciones..."
                className="text-sm"
              />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'ushers_notes')} />
            </div>
          </div>
        )}

        {requiresTranslation && !isBreakoutType && (
          <div className="space-y-1">
            <Label className="text-xs text-purple-700">Traducción</Label>
            <Textarea 
              value={formData.translation_notes}
              onChange={(e) => setFormData(prev => ({...prev, translation_notes: e.target.value}))}
              rows={2}
              placeholder="Instrucciones para traductor..."
              className="text-sm"
            />
          </div>
        )}

        {!isBreakType && !isBreakoutType && (
          <div className="space-y-1">
            <Label className="text-xs text-amber-700">Stage & Decor</Label>
            <div className="relative">
              <Textarea 
                value={formData.stage_decor_notes}
                onChange={(e) => updateField('stage_decor_notes', e.target.value)}
                rows={2}
                placeholder="Mover mesas, preparar escenario..."
                className="text-sm"
              />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'stage_decor_notes')} />
            </div>
          </div>
        )}

        {!isBreakoutType && (
          <div className="space-y-1">
            <Label className="text-xs text-gray-700">Otras Notas</Label>
            <div className="relative">
              <Textarea 
                value={formData.other_notes}
                onChange={(e) => updateField('other_notes', e.target.value)}
                rows={2}
                className="text-sm"
              />
              <FieldOriginIndicator origin={getFieldOrigin(fieldOrigins, 'other_notes')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}