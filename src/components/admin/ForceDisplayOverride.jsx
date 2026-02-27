/**
 * ForceDisplayOverride — Admin tool to force a specific event or service
 * onto all display screens (TV, MyProgram, Live View).
 *
 * DECISION (2026-02-27): Admin override on ActiveProgramCache.
 * - Admin selects event or service → writes override fields directly to cache
 *   → invokes refreshActiveProgram to rebuild snapshot with overridden target.
 * - Midnight scheduled refresh clears override → auto-detect resumes.
 * - "Clear Override" button also removes it immediately.
 *
 * AFFECTED SURFACES: ActiveProgramCache entity, refreshActiveProgram function,
 *   useActiveProgramCache hook (reads cache — no changes needed there).
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/utils/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Monitor, X, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateET } from '@/components/utils/timeFormat';

export default function ForceDisplayOverride({ user }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [overrideType, setOverrideType] = useState('service');
  const [selectedId, setSelectedId] = useState('');
  const [pushing, setPushing] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Load current cache to show override status
  const { data: cacheRecord } = useQuery({
    queryKey: ['activeProgramCache'],
    queryFn: async () => {
      const records = await base44.entities.ActiveProgramCache.filter({ cache_key: 'current_display' });
      return records?.[0] || null;
    },
    staleTime: 30_000,
  });

  // Load selector options from cache
  const events = useMemo(() => cacheRecord?.selector_options?.events || [], [cacheRecord]);
  const services = useMemo(() => cacheRecord?.selector_options?.services || [], [cacheRecord]);

  const hasOverride = !!(cacheRecord?.admin_override_id);
  const overrideName = cacheRecord?.admin_override_id
    ? (cacheRecord.admin_override_type === 'event'
      ? events.find(e => e.id === cacheRecord.admin_override_id)?.name
      : services.find(s => s.id === cacheRecord.admin_override_id)?.name)
    || cacheRecord.program_name
    : null;

  const handleForceDisplay = async () => {
    if (!selectedId || !cacheRecord) return;
    setPushing(true);

    // 1. Write override fields directly to the cache record
    await base44.entities.ActiveProgramCache.update(cacheRecord.id, {
      admin_override_type: overrideType,
      admin_override_id: selectedId,
      admin_override_by: user?.email || 'admin',
      admin_override_at: new Date().toISOString(),
    });

    // 2. Invoke refreshActiveProgram to rebuild snapshot with the override target
    await base44.functions.invoke('refreshActiveProgram', { trigger: 'admin_override' });

    queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
    toast.success(t('forceDisplay.success'));
    setSelectedId('');
    setPushing(false);
  };

  const handleClearOverride = async () => {
    if (!cacheRecord) return;
    setClearing(true);

    // Clear override fields
    await base44.entities.ActiveProgramCache.update(cacheRecord.id, {
      admin_override_type: null,
      admin_override_id: null,
      admin_override_by: null,
      admin_override_at: null,
    });

    // Re-run detection with normal auto-detect
    await base44.functions.invoke('refreshActiveProgram', { trigger: 'manual' });

    queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
    toast.success(t('forceDisplay.cleared'));
    setClearing(false);
  };

  const items = overrideType === 'event' ? events : services;

  return (
    <Card className="border-2 border-amber-200 bg-amber-50/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
            {t('forceDisplay.title')}
          </h3>
        </div>

        {/* Current override status */}
        {hasOverride && (
          <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-xs text-amber-800 font-medium flex-1">
              {t('forceDisplay.activeOverride')}: <strong>{overrideName || cacheRecord.admin_override_id}</strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearOverride}
              disabled={clearing}
              className="h-7 px-2 text-amber-800 hover:bg-amber-200"
            >
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              <span className="ml-1 text-xs">{t('forceDisplay.clear')}</span>
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-600">{t('forceDisplay.description')}</p>

        {/* Type selector */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={overrideType === 'service' ? 'default' : 'outline'}
            onClick={() => { setOverrideType('service'); setSelectedId(''); }}
            className="text-xs h-8"
          >
            {t('public.services')}
          </Button>
          <Button
            size="sm"
            variant={overrideType === 'event' ? 'default' : 'outline'}
            onClick={() => { setOverrideType('event'); setSelectedId(''); }}
            className="text-xs h-8"
          >
            {t('public.events')}
          </Button>
        </div>

        {/* Item selector */}
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="bg-white h-9 text-sm">
            <SelectValue placeholder={overrideType === 'event' ? t('public.selectEvent') : t('public.selectService')} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {items.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} — {formatDateET(item.date || item.start_date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Force button */}
        <Button
          onClick={handleForceDisplay}
          disabled={!selectedId || pushing}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-9"
        >
          {pushing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('forceDisplay.pushing')}</>
          ) : (
            <><Monitor className="w-4 h-4 mr-2" /> {t('forceDisplay.push')}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}