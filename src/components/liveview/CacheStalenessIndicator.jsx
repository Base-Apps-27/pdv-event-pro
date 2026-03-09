/**
 * CacheStalenessIndicator — 2026-03-09
 *
 * PURPOSE: Surfaces ActiveProgramCache freshness to coordinators.
 * Before this component, coordinators had zero visibility into whether
 * their Live View or MyProgram data was stale.
 *
 * BACKGROUND: The Session entity automation had an 18.3% failure rate (ATT-018),
 * fixed by eliminating the SegmentAction N+1 query in buildProgramSnapshot.
 * Even with the fix, coordinators deserve a data-freshness indicator so they
 * are never silently operating on bad information during a live event.
 *
 * THRESHOLDS:
 *   < 10 min  → neutral gray (normal, healthy)
 *   10-29 min → amber warning (stale — recent automation failure possible)
 *   ≥ 30 min  → red critical (stale data likely affecting live operations)
 *
 * FORCE REFRESH: Admin-only. Matches the server-side guard in refreshActiveProgram
 * which requires user.role === 'admin' for manual trigger. Do not show to other roles.
 *
 * PROPS:
 *   cacheRecord  — the ActiveProgramCache record from useActiveProgramCache
 *   currentUser  — the authenticated user (for admin check)
 *   language     — 'en' | 'es'
 *   compact      — if true: renders a small inline badge (for MyProgram header)
 *                  if false: renders full row with optional Refresh button (for Live View)
 */
import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function formatAge(lastRefreshAt, language) {
  if (!lastRefreshAt) return null;
  const ageMs = Date.now() - new Date(lastRefreshAt).getTime();
  const ageSec = Math.floor(ageMs / 1000);
  const ageMin = Math.floor(ageSec / 60);
  if (ageSec < 60) return language === 'es' ? 'Justo ahora' : 'Just now';
  if (ageMin < 60) return language === 'es' ? `Hace ${ageMin}m` : `${ageMin}m ago`;
  const ageH = Math.floor(ageMin / 60);
  return language === 'es' ? `Hace ${ageH}h` : `${ageH}h ago`;
}

export default function CacheStalenessIndicator({ cacheRecord, currentUser, language = 'en', compact = false }) {
  const [refreshing, setRefreshing] = useState(false);

  if (!cacheRecord?.last_refresh_at) return null;

  const ageMs = Date.now() - new Date(cacheRecord.last_refresh_at).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const isStale = ageMin >= 10;
  const isCritical = ageMin >= 30;
  const ageText = formatAge(cacheRecord.last_refresh_at, language);

  // Admin check mirrors the server-side guard in refreshActiveProgram:
  // if (trigger === 'manual') { if (user.role !== 'admin') return 403 }
  const isAdmin = currentUser?.role === 'admin';

  const handleForceRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('refreshActiveProgram', { trigger: 'manual' });
      toast.success(language === 'es' ? 'Caché actualizado' : 'Cache refreshed');
    } catch {
      toast.error(language === 'es' ? 'Error al actualizar' : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  // Compact mode: small inline text for MyProgram header (non-intrusive)
  if (compact) {
    return (
      <span className={`text-[10px] font-medium ${isCritical ? 'text-red-300' : isStale ? 'text-amber-300' : 'text-white/50'}`}>
        ↻ {ageText}
      </span>
    );
  }

  // Full mode: for Live View — shows warning text and admin force-refresh button
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={`flex items-center gap-1 text-xs ${isCritical ? 'text-red-600' : isStale ? 'text-amber-600' : 'text-gray-400'}`}>
        {isCritical && <AlertCircle className="w-3 h-3 shrink-0" />}
        <span>
          {language === 'es' ? 'Datos actualizados' : 'Data updated'}: {ageText}
          {isCritical && ` — ${language === 'es' ? 'posiblemente desactualizado' : 'may be stale'}`}
        </span>
      </div>
      {isAdmin && (
        <button
          onClick={handleForceRefresh}
          disabled={refreshing}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
            isCritical
              ? 'border-red-300 text-red-600 hover:bg-red-50'
              : isStale
                ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                : 'border-gray-200 text-gray-400 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {language === 'es' ? 'Actualizar' : 'Refresh'}
        </button>
      )}
    </div>
  );
}