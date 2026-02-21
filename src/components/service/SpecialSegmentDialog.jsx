import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

/**
 * SpecialSegmentDialog — Extracted from WeeklyServiceManager (Phase 3A).
 * Modal for inserting a "special" segment into a service time slot.
 *
 * Props:
 *   open                    — boolean controlling dialog visibility
 *   onOpenChange            — setter for open
 *   details                 — { timeSlot, title, duration, insertAfterIdx, presenter, translator }
 *   setDetails              — setter for details object
 *   serviceSegments         — array of segments for the target time slot (for "insert after" options)
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">Insertar Segmento Especial ({details.timeSlot})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título del Segmento</Label>
            <Input
              value={details.title}
              onChange={(e) => setDetails(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej. Presentación de Niños"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Presentador</Label>
              <AutocompleteInput
                type="presenter"
                value={details.presenter}
                onChange={(e) => setDetails(prev => ({ ...prev, presenter: e.target.value }))}
                placeholder="Nombre del presentador"
                className="text-sm"
              />
            </div>
            {slotHasTranslation && (
              <div className="space-y-2">
                <Label className="text-sm">Traductor</Label>
                <AutocompleteInput
                  type="translator"
                  value={details.translator}
                  onChange={(e) => setDetails(prev => ({ ...prev, translator: e.target.value }))}
                  placeholder="Nombre del traductor"
                  className="text-sm"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Duración (minutos)</Label>
            <Input
              type="number"
              value={details.duration}
              onChange={(e) => setDetails(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Insertar después de:</Label>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={details.insertAfterIdx}
              onChange={(e) => setDetails(prev => ({ ...prev, insertAfterIdx: parseInt(e.target.value) }))}
            >
              <option value="-1">Al inicio</option>
              {(serviceSegments || [])
                .filter(seg => seg.type !== "special")
                .map((segment, idx) => (
                  <option key={idx} value={idx}>{segment.title}</option>
                ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={onAdd} style={tealStyle} className="w-full sm:w-auto">
              Añadir Segmento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}