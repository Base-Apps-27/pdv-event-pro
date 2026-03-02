/**
 * LiveAdjustmentControls — P3 DEV-1 (2026-03-02)
 * 
 * Time adjustment banner + coordinator buttons + history button.
 * Extracted from PublicProgramView.
 */
import React from 'react';
import { Clock, History } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTimeToEST, formatTimestampToEST } from "@/components/utils/timeFormat";
import { hasPermission } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n";

export default function LiveAdjustmentControls({
  liveAdjustments, actualServiceData, sessions,
  currentUser, openAdjustmentModal, setHistoryModalOpen,
}) {
  const { t } = useLanguage();
  const hasActiveAdjustments = liveAdjustments.length > 0 && liveAdjustments.some(a => a.offset_minutes !== 0);

  return (
    <>
      {/* Active adjustment banner */}
      {hasActiveAdjustments && (
        <Card className="bg-amber-50 border-2 border-amber-500">
          <CardContent className="p-4">
            <div className="space-y-2">
              {liveAdjustments.filter(a => a.offset_minutes !== 0).map(adj => (
                <AdjustmentRow key={adj.id} adj={adj} actualServiceData={actualServiceData} currentUser={currentUser} openAdjustmentModal={openAdjustmentModal} t={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coordinator controls */}
      {hasPermission(currentUser, 'manage_live_timing') && actualServiceData && (
        <Card className="bg-slate-900 text-white border-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                <span className="font-bold uppercase text-xs sm:text-sm">{t('public.adjustStartTime')}</span>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                {actualServiceData.segments && actualServiceData.segments.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => openAdjustmentModal("custom")} className="bg-pdv-teal hover:bg-pdv-teal/90 text-white border-none text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                    {t('adjustments.adjustStart')}
                  </Button>
                ) : (
                  <>
                    {(() => {
                      const SLOT_BTN_COLORS = ['red', 'blue', 'purple', 'amber', 'green'];
                      return (sessions || []).map((s, i) => (
                        <Button key={s.name} variant="outline" size="sm"
                          onClick={() => openAdjustmentModal(s.name)}
                          className={`bg-${SLOT_BTN_COLORS[i % SLOT_BTN_COLORS.length]}-600 hover:bg-${SLOT_BTN_COLORS[i % SLOT_BTN_COLORS.length]}-700 text-white border-none text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2`}
                        >
                          {s.name.replace('am', ' AM').replace('pm', ' PM')}
                        </Button>
                      ));
                    })()}
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setHistoryModalOpen(true)} className="text-gray-400 hover:text-white hover:bg-white/10 px-2" title={t('public.viewHistory')}>
                  <History className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function AdjustmentRow({ adj, actualServiceData, currentUser, openAdjustmentModal, t }) {
  let displayLabel = '';
  let adjustedTimeStr = '';

  if (adj.adjustment_type === 'global') {
    const serviceTime = actualServiceData?.time || "10:00";
    const [h, m] = serviceTime.split(':').map(Number);
    const d = new Date(); d.setHours(h, m + adj.offset_minutes, 0, 0);
    adjustedTimeStr = formatTimeToEST(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    displayLabel = t('service.specialService');
  } else {
    const baseTime = adj.time_slot.replace('am', '').replace('pm', '');
    const [h, m] = baseTime.split(':').map(Number);
    const d = new Date(); d.setHours(h, m + adj.offset_minutes, 0, 0);
    adjustedTimeStr = formatTimeToEST(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    displayLabel = adj.time_slot;
  }

  const estTime = formatTimestampToEST(adj.updated_date);

  return (
    <div className="flex items-start justify-between gap-4 bg-white p-3 rounded border border-amber-300">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-amber-700" />
          <span className="font-bold text-amber-900">
            {displayLabel} {t('public.adjusted')} {adj.offset_minutes > 0 ? '+' : ''}{adj.offset_minutes} {t('public.minutes')} ({t('public.start')}: {adjustedTimeStr})
          </span>
        </div>
        <div className="text-xs text-gray-700 space-y-0.5">
          <div><strong>{t('adjustments.authorizedBy')}:</strong> {adj.authorized_by}</div>
          <div><strong>{t('adjustments.appliedBy')}:</strong> {adj.created_by}</div>
          <div><strong>{t('adjustments.time')}:</strong> {estTime}</div>
        </div>
      </div>
      {hasPermission(currentUser, 'manage_live_timing') && (
        <Button size="sm" variant="outline"
          onClick={() => openAdjustmentModal(adj.adjustment_type === 'global' ? 'custom' : adj.time_slot)}
          className="shrink-0"
        >
          {t('common.edit')}
        </Button>
      )}
    </div>
  );
}