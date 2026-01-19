import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/utils/i18n";
import { Clock, AlertTriangle } from "lucide-react";

export default function LiveTimeAdjustmentModal({ 
  isOpen, 
  onClose, 
  timeSlot, 
  currentOffset, 
  onSave 
}) {
  const { t } = useLanguage();
  const [offsetMinutes, setOffsetMinutes] = useState(currentOffset || 0);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate new start time based on offset
  const calculateNewTime = (originalTime, offset) => {
    if (!originalTime) return '';
    const baseTime = originalTime.replace('am', '').replace('pm', '');
    const [h, m] = baseTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + offset, 0, 0);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
  };

  const baseTime = timeSlot ? timeSlot.replace('am', '').replace('pm', '') : '';
  const newTime = calculateNewTime(timeSlot, offsetMinutes);

  const handleSave = async () => {
    if (!authorizedBy.trim()) {
      alert(t('live.authorization_required') || 'Por favor ingresa quién autorizó este cambio');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(offsetMinutes, authorizedBy);
      onClose();
    } catch (err) {
      console.error(err);
      alert(t('error.generic') || 'Error al guardar el ajuste');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!authorizedBy.trim()) {
      alert(t('live.authorization_required') || 'Por favor ingresa quién autorizó limpiar este ajuste');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(0, authorizedBy);
      onClose();
    } catch (err) {
      console.error(err);
      alert(t('error.generic') || 'Error al limpiar el ajuste');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Ajustar Horario - Servicio {timeSlot}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-900">
                Este ajuste se aplicará solo en la Vista en Vivo para el día de hoy. No afectará los PDFs ni los datos originales.
              </p>
            </div>
          </div>

          {/* New Time Display */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Hora Original</p>
            <p className="text-2xl font-bold text-gray-400 line-through mb-3">{baseTime}</p>
            <p className="text-sm text-blue-700 font-semibold mb-1">Nueva Hora de Inicio</p>
            <p className="text-4xl font-bold text-blue-600">{newTime}</p>
          </div>

          <div>
            <Label htmlFor="offset" className="font-bold">
              Ajuste (minutos)
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setOffsetMinutes(Math.max(-60, offsetMinutes - 5))}
                disabled={isLoading}
              >
                -5
              </Button>
              <Input
                id="offset"
                type="number"
                value={offsetMinutes}
                onChange={(e) => setOffsetMinutes(parseInt(e.target.value) || 0)}
                className="text-center font-bold text-lg"
                disabled={isLoading}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setOffsetMinutes(Math.min(60, offsetMinutes + 5))}
                disabled={isLoading}
              >
                +5
              </Button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {offsetMinutes > 0 ? `${offsetMinutes} minutos más tarde` : offsetMinutes < 0 ? `${Math.abs(offsetMinutes)} minutos más temprano` : 'Sin cambio'}
            </p>
          </div>

          <div>
            <Label htmlFor="authorized" className="font-bold text-red-600">
              ¿Quién autorizó este cambio? *
            </Label>
            <Input
              id="authorized"
              type="text"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              placeholder="Ej: Pastor Juan Pérez"
              className="mt-2"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Este registro quedará en el sistema para referencia</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentOffset !== 0 && (
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Limpiar Ajuste
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            Aplicar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}