import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { hasPermission } from '@/components/utils/permissions';
import { useLanguage } from '@/components/utils/i18n';

/**
 * LiveAdminControls - Type-specific admin controls for live timing
 * 
 * Weekly: 9:30am/11:30am buttons + adjustment banner
 * Custom: Global offset button
 * Event: Per-session controls (future)
 */
export default function LiveAdminControls({ 
  viewType,
  serviceData,
  liveAdjustments = [],
  onOpenAdjustmentModal,
  currentUser
}) {
  const { t } = useLanguage();

  if (!hasPermission(currentUser, 'manage_live_timing')) {
    return null;
  }

  const isWeekly = serviceData && (serviceData['9:30am'] || serviceData['11:30am']);

  // Live Adjustments Banner (show active adjustments with history)
  const activeAdjustments = liveAdjustments.filter(adj => adj.offset_minutes !== 0);

  return (
    <div className="space-y-4">
      {/* Active Adjustments Banner */}
      {activeAdjustments.length > 0 && (
        <Card className="bg-amber-50 border-2 border-amber-500">
          <CardContent className="p-4">
            <div className="space-y-2">
              {activeAdjustments.map((adj) => {
                const baseTime = adj.time_slot?.replace('am', '').replace('pm', '') || '00:00';
                const [h, m] = baseTime.split(':').map(Number);
                const adjustedDate = new Date();
                adjustedDate.setHours(h, m + adj.offset_minutes, 0, 0);
                const adjustedTimeStr = `${String(adjustedDate.getHours()).padStart(2, '0')}:${String(adjustedDate.getMinutes()).padStart(2, '0')}`;
                
                const estTime = new Date(adj.created_date).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'America/New_York'
                });
                
                return (
                  <div key={adj.id} className="flex items-start justify-between gap-4 bg-white p-3 rounded border border-amber-300">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-700" />
                        <span className="font-bold text-amber-900">
                          {adj.time_slot} ajustado {adj.offset_minutes > 0 ? '+' : ''}{adj.offset_minutes} min (inicio: {adjustedTimeStr})
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 space-y-0.5">
                        <div><strong>Autorizado por:</strong> {adj.authorized_by}</div>
                        <div><strong>Aplicado por:</strong> {adj.created_by}</div>
                        <div><strong>Hora:</strong> {estTime}</div>
                      </div>
                    </div>
                    {isWeekly && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onOpenAdjustmentModal(adj.time_slot)}
                        className="shrink-0"
                      >
                        Editar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Buttons */}
      {isWeekly && (
        <Card className="bg-slate-900 text-white border-none">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="font-bold uppercase text-sm">{t('liveView.adjustStartTime') || 'Ajustar Hora de Inicio'}</span>
              </div>
              <div className="flex gap-2">
                {serviceData['9:30am'] && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onOpenAdjustmentModal('9:30am')}
                    className="bg-red-600 hover:bg-red-700 text-white border-none"
                  >
                    9:30 AM
                  </Button>
                )}
                {serviceData['11:30am'] && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onOpenAdjustmentModal('11:30am')}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-none"
                  >
                    11:30 AM
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}