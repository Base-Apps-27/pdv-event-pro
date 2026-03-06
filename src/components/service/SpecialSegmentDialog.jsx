import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useLanguage } from "@/components/utils/i18n";

/**
 * SpecialSegmentDialog — Modal for inserting a "special" segment into a service time slot.
 *
 * 2026-03-06: Added requires_translation checkbox + translation_mode + translator_name fields.
 *             Default: unchecked (consistent with all other segment forms).
 *             Also converted all hardcoded Spanish strings to i18n keys.
 *
 * Props:
 *   open                    — boolean controlling dialog visibility
 *   onOpenChange            — setter for open
 *   details                 — { timeSlot, title, duration, insertAfterIdx, presenter, translator,
 *                              requires_translation, translation_mode, translator_name }
 *   setDetails              — setter for details object
 *   serviceSegments         — array of segments for the target time slot (for "insert after" options)
 *   slotHasTranslation      — (legacy) whether slot-level translation is on — kept for backward compat
 *   onAdd                   — callback to execute segment insertion
 *   tealStyle               — inline style for primary button
 */
export default function SpecialSegmentDialog({
  open,
  onOpenChange,
  details,
  setDetails,
  serviceSegments,
  slotHasTranslation,
  onAdd,
  tealStyle,
}) {
  const { t, language } = useLanguage();
  const en = language === 'en';

  // Derive translation state from details (default: false / unchecked)
  const requiresTranslation = details.requires_translation || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">
            {en ? 'Insert Special Segment' : 'Insertar Segmento Especial'} {details.timeSlot ? `(${details.timeSlot})` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Segment title */}
          <div className="space-y-2">
            <Label>{en ? 'Segment Title' : 'Título del Segmento'}</Label>
            <Input
              value={details.title}
              onChange={(e) => setDetails(prev => ({ ...prev, title: e.target.value }))}
              placeholder={en ? 'e.g. Children\'s Dedication' : 'Ej. Presentación de Niños'}
            />
          </div>

          {/* Presenter */}
          <div className="space-y-2">
            <Label className="text-sm">{en ? 'Presenter' : 'Presentador'}</Label>
            <AutocompleteInput
              type="presenter"
              value={details.presenter}
              onChange={(e) => setDetails(prev => ({ ...prev, presenter: e.target.value }))}
              placeholder={en ? 'Presenter name' : 'Nombre del presentador'}
              className="text-sm"
            />
          </div>

          {/* Translation section — 2026-03-06: New checkbox + conditional fields */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="special-requires-translation"
                checked={requiresTranslation}
                onCheckedChange={(checked) =>
                  setDetails(prev => ({
                    ...prev,
                    requires_translation: !!checked,
                    // Reset sub-fields when unchecked
                    ...(!checked ? { translation_mode: 'InPerson', translator: '' } : {}),
                  }))
                }
              />
              <Label htmlFor="special-requires-translation" className="text-sm font-medium cursor-pointer">
                {en ? 'Requires Translation' : 'Requiere Traducción'}
              </Label>
            </div>

            {requiresTranslation && (
              <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                {/* Translation mode */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{en ? 'Translation Mode' : 'Modo de Traducción'}</Label>
                  <Select
                    value={details.translation_mode || 'InPerson'}
                    onValueChange={(value) => setDetails(prev => ({ ...prev, translation_mode: value }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="InPerson">{en ? 'In Person (On Stage)' : 'En Persona (En Tarima)'}</SelectItem>
                      <SelectItem value="RemoteBooth">{en ? 'Remote Booth (Headphones)' : 'Cabina Remota (Audífonos)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2026-03-06: Translator source — manual or auto from preceding segment */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{en ? 'Translator Source' : 'Fuente del Traductor'}</Label>
                  <Select
                    value={details.default_translator_source || 'manual'}
                    onValueChange={(value) => setDetails(prev => ({
                      ...prev,
                      default_translator_source: value,
                      // Clear manual translator when switching to auto
                      ...(value !== 'manual' ? { translator: '' } : {}),
                    }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{en ? 'Enter manually' : 'Escribir manualmente'}</SelectItem>
                      {/* Show preceding segments that have translation enabled */}
                      {(serviceSegments || []).map((seg, idx) => (
                        <SelectItem key={idx} value={`auto_from_segment:${seg.id || idx}`}>
                          Auto → {seg.title || seg.type || `Segment ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {details.default_translator_source && details.default_translator_source !== 'manual' && (
                    <p className="text-[10px] text-gray-400">
                      {en ? 'Will copy the translator from the selected segment.' : 'Copiará el traductor del segmento seleccionado.'}
                    </p>
                  )}
                </div>

                {/* Manual translator name — only when source is manual */}
                {(!details.default_translator_source || details.default_translator_source === 'manual') && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">{en ? 'Translator' : 'Traductor'}</Label>
                    <AutocompleteInput
                      type="translator"
                      value={details.translator || ''}
                      onChange={(e) => setDetails(prev => ({ ...prev, translator: e.target.value }))}
                      placeholder={en ? 'Translator name (optional)' : 'Nombre del traductor (opcional)'}
                      className="text-sm h-8"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>{en ? 'Duration (minutes)' : 'Duración (minutos)'}</Label>
            <Input
              type="number"
              value={details.duration}
              onChange={(e) => setDetails(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
            />
          </div>

          {/* Insert position */}
          <div className="space-y-2">
            <Label>{en ? 'Insert after:' : 'Insertar después de:'}</Label>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={details.insertAfterIdx}
              onChange={(e) => setDetails(prev => ({ ...prev, insertAfterIdx: parseInt(e.target.value) }))}
            >
              <option value="-1">{en ? 'At the beginning' : 'Al inicio'}</option>
              {(serviceSegments || [])
                .filter(seg => seg.type !== "special")
                .map((segment, idx) => (
                  <option key={idx} value={idx}>{segment.title}</option>
                ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {en ? 'Cancel' : 'Cancelar'}
            </Button>
            <Button onClick={onAdd} style={tealStyle} className="w-full sm:w-auto">
              {en ? 'Add Segment' : 'Añadir Segmento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}