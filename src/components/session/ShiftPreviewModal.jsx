import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/utils/i18n";
import { computeShiftPreview } from "@/components/utils/shiftSchedule";

export default function ShiftPreviewModal({ open, onClose, session, segments, editedSegment, newStartTime, onConfirm }) {
  const { t, language } = useLanguage();
  const [mode, setMode] = React.useState('additive'); // 'additive' | 'reflow'
  const [stopAtMajorBreak, setStopAtMajorBreak] = React.useState(true);
  const [stopAtBreakout, setStopAtBreakout] = React.useState(true);

  const { affected, deltaMin } = React.useMemo(() => computeShiftPreview({
    segments,
    editedSegmentId: editedSegment?.id,
    newStartTime,
    mode,
    stopAtMajorBreak,
    stopAtBreakout,
  }), [segments, editedSegment?.id, newStartTime, mode, stopAtMajorBreak, stopAtBreakout]);

  const titleText = language === 'es' ? 'Previsualizar ajustes' : 'Preview adjustments';
  const descText = language === 'es' ? 'Confirma cómo se ajustarán los horarios de los segmentos posteriores.' : 'Confirm how downstream segments will be adjusted.';

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose?.(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{language === 'es' ? 'Modo' : 'Mode'}</span>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="additive">{language === 'es' ? 'Desplazamiento (Δ)' : 'Additive (Δ shift)'}</SelectItem>
                  <SelectItem value="reflow">{language === 'es' ? 'Contiguo (sin huecos)' : 'Contiguous (no gaps)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="barrier_break" checked={stopAtMajorBreak} onCheckedChange={setStopAtMajorBreak} />
              <label htmlFor="barrier_break" className="text-sm">{language === 'es' ? 'Detener en Receso Mayor' : 'Stop at Major Break'}</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="barrier_breakout" checked={stopAtBreakout} onCheckedChange={setStopAtBreakout} />
              <label htmlFor="barrier_breakout" className="text-sm">{language === 'es' ? 'Detener antes de Breakout' : 'Stop before Breakout'}</label>
            </div>
            <Badge variant="outline" className="text-xs ml-auto">Δ {deltaMin >= 0 ? '+' : ''}{deltaMin} {language === 'es' ? 'min' : 'min'}</Badge>
          </div>

          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">{language === 'es' ? 'Segmento' : 'Segment'}</th>
                  <th className="p-2 text-left">{language === 'es' ? 'Inicio' : 'Start'}</th>
                  <th className="p-2 text-left">{language === 'es' ? 'Fin' : 'End'}</th>
                  <th className="p-2 text-left">{language === 'es' ? '→ Nuevo Inicio' : '→ New Start'}</th>
                  <th className="p-2 text-left">{language === 'es' ? 'Nuevo Fin' : 'New End'}</th>
                  <th className="p-2 text-left">{language === 'es' ? 'Duración' : 'Duration'}</th>
                </tr>
              </thead>
              <tbody>
                {affected.length === 0 ? (
                  <tr><td className="p-3 text-center text-gray-500" colSpan={6}>{language === 'es' ? 'No hay segmentos posteriores afectados.' : 'No downstream segments affected.'}</td></tr>
                ) : affected.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2 font-medium text-gray-900">{a.title}</td>
                    <td className="p-2 text-gray-700">{a.oldStart || '-'}</td>
                    <td className="p-2 text-gray-700">{a.oldEnd || '-'}</td>
                    <td className="p-2 text-blue-700 font-semibold">{a.newStart}</td>
                    <td className="p-2 text-blue-700">{a.newEnd}</td>
                    <td className="p-2 text-gray-700">{a.duration_min} {language === 'es' ? 'min' : 'min'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('btn.cancel') || (language === 'es' ? 'Cancelar' : 'Cancel')}</Button>
          <Button
            disabled={affected.length === 0}
            onClick={() => onConfirm?.({ affected, mode, stopAtMajorBreak, stopAtBreakout })}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {language === 'es' ? 'Confirmar y aplicar' : 'Confirm and Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}