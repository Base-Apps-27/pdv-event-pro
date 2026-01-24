import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/components/utils/i18n';
import { toast } from 'sonner';

/**
 * Simple time offset adjustment modal
 * Supports weekly (time_slot), custom (global), and event (session) adjustments
 */
export default function TimeOffsetModal({
  serviceType,
  context, // { serviceId, eventId, sessionId, date, timeSlot }
  currentOffset,
  onClose,
  onApply
}) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState(currentOffset || 0);
  const [timeSlot, setTimeSlot] = useState(context.timeSlot || '9:30am');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    try {
      setLoading(true);
      
      // Build adjustment payload based on service type
      let adjustmentType, target;
      
      if (serviceType === 'weekly') {
        adjustmentType = 'time_slot';
        target = { serviceId: context.serviceId, timeSlot };
      } else if (serviceType === 'custom') {
        adjustmentType = 'global';
        target = { serviceId: context.serviceId };
      } else if (serviceType === 'event') {
        adjustmentType = 'session';
        target = { eventId: context.eventId, sessionId: context.sessionId };
      }
      
      // Call backend function
      await base44.functions.invoke('updateLiveTiming', {
        adjustmentType,
        target,
        offsetMinutes: offset,
        date: context.date
      });
      
      toast.success(t('liveView.adjustmentApplied') || 'Ajuste aplicado exitosamente');
      onApply(offset);
      onClose();
    } catch (error) {
      console.error('Error applying offset:', error);
      toast.error(t('liveView.adjustmentError') || 'Error al aplicar ajuste');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('liveView.adjustStartTime') || 'Ajustar Tiempo de Inicio'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Time Slot Selector (weekly only) */}
          {serviceType === 'weekly' && (
            <div className="space-y-2">
              <Label>{t('liveView.service') || 'Servicio'}</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:30am">9:30 AM</SelectItem>
                  <SelectItem value="11:30am">11:30 AM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Offset Input */}
          <div className="space-y-2">
            <Label>{t('liveView.offsetMinutes') || 'Minutos de Ajuste'}</Label>
            <Input
              type="number"
              value={offset}
              onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
              placeholder={t('liveView.offsetPlaceholder') || '+15 para adelantar, -10 para atrasar'}
            />
            <p className="text-xs text-muted-foreground">
              {t('liveView.offsetHelp') || 'Números positivos adelantan el inicio, negativos lo atrasan'}
            </p>
          </div>

          {/* Current offset display */}
          {currentOffset !== 0 && (
            <div className="text-sm text-muted-foreground">
              {t('liveView.currentOffset') || 'Ajuste actual'}: {currentOffset > 0 ? '+' : ''}{currentOffset} min
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel') || 'Cancelar'}
          </Button>
          <Button onClick={handleApply} disabled={loading}>
            {loading ? (t('common.applying') || 'Aplicando...') : (t('common.apply') || 'Aplicar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}