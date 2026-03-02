/**
 * OfflineBanner — P3 GRO-5 (2026-03-02)
 * 
 * Shows a slim bilingual banner when the app is operating on stale/cached data.
 * Auto-hides when connectivity returns.
 * 
 * Props:
 *   lastUpdated — ISO timestamp of the last successful data fetch
 *   language    — 'es' | 'en'
 */
import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ lastUpdated, language = 'es' }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show when offline OR when explicitly told we're using stale data
  if (!isOffline && !lastUpdated) return null;
  // If online and no stale marker, hide
  if (!isOffline) return null;

  const label = language === 'en'
    ? 'You are offline — do not refresh. Check your WiFi or cellular connection.'
    : 'Sin conexión — no actualices. Verifica tu WiFi o conexión celular.';

  const timeAgo = lastUpdated ? formatTimeAgo(lastUpdated, language) : '';

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800 font-medium flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5" />
      <span>{label}</span>
      {timeAgo && <span className="text-amber-600">({timeAgo})</span>}
    </div>
  );
}

function formatTimeAgo(isoString, lang) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return lang === 'en' ? 'just now' : 'ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}