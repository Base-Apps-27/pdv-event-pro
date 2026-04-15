/**
 * SessionPicker — Shared horizontal pill bar for session/time-slot selection.
 *
 * Used by: MyProgram, Live View (EventProgramView).
 *
 * Features:
 *  - Optional "All" button (home-style, like DepartmentPicker)
 *  - Horizontal scroll for 4+ sessions
 *  - Past sessions greyed out (based on currentTime + session end)
 *  - Short auto-generated labels for event sessions (from date+time)
 *  - Service slots use their raw names (9:30am, 11:30am)
 *
 * 2026-02-16: Rewritten for auto-label + past-session dimming + All button.
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';

const GRADIENT_H = 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)';

export default function SessionPicker({ sessions, value, onChange, showAll = false, currentTime }) {
  const { language } = useLanguage();
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll active pill into view on mount / change
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [value]);

  // Don't render if 0 or 1 session (and no "All" mode)
  if (!sessions || (sessions.length <= 1 && !showAll)) return null;

  // Determine if a session is in the past (all segments ended)
  // We use session.endMinutes if available; otherwise never mark as past.
  const nowMin = currentTime
    ? currentTime.getHours() * 60 + currentTime.getMinutes()
    : null;

  const todayStr = currentTime
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(currentTime)
    : null;

  return (
    <div className="flex items-center gap-2 w-full">
      {/* "All Sessions" home button */}
      {showAll && (
        <button
          onClick={() => onChange('all')}
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors border ${
            value === 'all'
              ? 'text-white border-transparent shadow-sm'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
          style={value === 'all' ? { background: GRADIENT_H } : {}}
          title={language === 'es' ? 'Todas las sesiones' : 'All sessions'}
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
      )}

      {/* Scrollable pills */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
        <div className="flex gap-2 pb-0.5 min-w-max">
          {sessions.map((session) => {
            const isActive = value === session.id;

            // Past detection: same-day sessions whose endMinutes < now
            const isPast = (() => {
              if (!nowMin || !session.endMinutes) return false;
              // Only dim same-day sessions — multi-day events use session.date
              if (session.date && todayStr && session.date !== todayStr) {
                return session.date < todayStr;
              }
              return session.endMinutes < nowMin;
            })();

            return (
              <button
                key={session.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => onChange(session.id)}
                className={`
                  px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[40px]
                  ${isActive
                    ? 'text-white shadow-sm'
                    : isPast
                      ? 'bg-gray-100 text-gray-400 border border-gray-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'}
                `}
                style={isActive ? { background: GRADIENT_H } : {}}
              >
                {session.shortLabel || session.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}