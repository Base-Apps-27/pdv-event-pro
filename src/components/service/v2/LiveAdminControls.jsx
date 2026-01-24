import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';
import { hasPermission } from '@/components/utils/permissions';
import TimeOffsetModal from './TimeOffsetModal';

/**
 * Unified Live Admin Controls (V2)
 * Works for all service types: weekly, custom, event
 * Permission-gated and capability-aware
 */
export default function LiveAdminControls({ 
  user,
  serviceType,
  capabilities,
  context, // { serviceId, eventId, sessionId, date, timeSlot }
  currentOffset,
  onOffsetChange
}) {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  
  // Permission check
  if (!user || !hasPermission(user, 'manage_live_timing')) {
    return null;
  }
  
  // Capability check
  if (!capabilities?.timeAdjustment) {
    return null;
  }
  
  return (
    <>
      <Card className="mb-4 bg-amber-50 border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('liveView.liveTimeControl') || 'CONTROL DE TIEMPO EN VIVO'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => setShowModal(true)} 
            className="w-full bg-amber-600 hover:bg-amber-700"
            size="sm"
          >
            ⏰ {t('liveView.adjustStartTime') || 'Ajustar Hora de Inicio'}
          </Button>
          
          {currentOffset !== 0 && (
            <Badge className="w-full justify-center bg-amber-500 text-white hover:bg-amber-600">
              {t('liveView.currentAdjustment') || 'Ajuste activo'}: {currentOffset > 0 ? '+' : ''}{currentOffset} min
            </Badge>
          )}
          
          {currentOffset === 0 && (
            <p className="text-xs text-center text-muted-foreground">
              {t('liveView.noAdjustment') || 'Sin ajustes activos'}
            </p>
          )}
        </CardContent>
      </Card>
      
      {showModal && (
        <TimeOffsetModal
          serviceType={serviceType}
          context={context}
          currentOffset={currentOffset}
          onClose={() => setShowModal(false)}
          onApply={onOffsetChange}
        />
      )}
    </>
  );
}