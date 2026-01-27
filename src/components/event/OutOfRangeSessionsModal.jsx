import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DatePicker from "@/components/ui/DatePicker";
import { useLanguage } from "@/components/utils/i18n";
import { Calendar, AlertTriangle } from "lucide-react";

/**
 * OutOfRangeSessionsModal
 * - After an event's date range changes, this modal helps align sessions that now fall outside.
 * - Lists sessions with dates before the new start or after the new end, and lets user set new dates.
 * - Non-destructive: only updates sessions the user confirms.
 */
export default function OutOfRangeSessionsModal({ open, onOpenChange, eventId, newStartDate, newEndDate }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [updates, setUpdates] = useState({}); // sessionId -> newDate

  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  // Fetch sessions when opening
  useEffect(() => {
    let cancelled = false;
    async function fetchSessions() {
      if (!open || !eventId) return;
      setLoading(true);
      try {
        const list = await base44.entities.Session.filter({ event_id: eventId });
        if (cancelled) return;
        // Identify out-of-range sessions (only those with a date defined)
        const out = (list || []).filter(s => !!s.date && ((newStartDate && s.date < newStartDate) || (newEndDate && s.date > newEndDate)));
        setSessions(out);
        // Prefill suggested date (clamp to nearest boundary)
        const initial = {};
        out.forEach(s => {
          const suggested = (newStartDate && s.date < newStartDate) ? newStartDate : (newEndDate && s.date > newEndDate) ? newEndDate : s.date;
          initial[s.id] = suggested;
        });
        setUpdates(initial);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSessions();
    return () => { cancelled = true; };
  }, [open, eventId, newStartDate, newEndDate]);

  const hasChanges = useMemo(() => sessions.some(s => updates[s.id] && updates[s.id] !== s.date), [sessions, updates]);

  const handleSave = async () => {
    if (sessions.length === 0) { onOpenChange(false); return; }
    setLoading(true);
    try {
      const toUpdate = sessions.filter(s => updates[s.id] && updates[s.id] !== s.date);
      if (toUpdate.length > 0) {
        await Promise.all(toUpdate.map(s => base44.entities.Session.update(s.id, { date: updates[s.id] })));
        // Invalidate common caches used across pages
        queryClient.invalidateQueries(['sessions', eventId]);
        queryClient.invalidateQueries(['allSessions', eventId]);
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            {t('sessionsDateFix.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-semibold">{t('sessionsDateFix.subtitle')}</div>
              {(newStartDate || newEndDate) && (
                <div className="text-xs text-amber-800 mt-1">
                  <span className="font-semibold">{t('common.date')}s:</span> {newStartDate || '—'} {newStartDate && newEndDate && '→'} {newEndDate || ''}
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="text-sm text-gray-600">{t('status.loading') || 'Cargando...'}</div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="text-sm text-gray-600">{t('sessionsDateFix.none') || 'No hay sesiones fuera del rango.'}</div>
          )}

          {!loading && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 border rounded bg-gray-50">
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {s.name}
                  </Badge>
                  <div className="ml-auto w-48">
                    <DatePicker
                      value={updates[s.id] || ''}
                      onChange={(val) => setUpdates(prev => ({ ...prev, [s.id]: val }))}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('btn.skip') || 'Omitir'}
            </Button>
            <Button onClick={handleSave} disabled={loading || sessions.length === 0 || !hasChanges} className="text-white" style={gradientStyle}>
              {t('btn.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}