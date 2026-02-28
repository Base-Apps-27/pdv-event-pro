/**
 * ArtsTypeSection.jsx
 * 
 * Collapsible sub-section for a single art type within a segment accordion.
 * Shows a colored header with emoji, type name, and completion badge.
 * Collapses/expands its content independently.
 * 
 * 2026-02-28: Created as part of Hybrid UX refactor (Option 5).
 * Mobile-first: large touch targets (44px+), clear visual hierarchy.
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const TYPE_META = {
  DANCE:       { emoji: '🩰', color: '#E879A0', bgClass: 'bg-pink-50 border-pink-200', accentColor: '#E879A0' },
  DRAMA:       { emoji: '🎭', color: '#8B5CF6', bgClass: 'bg-purple-50 border-purple-200', accentColor: '#8B5CF6' },
  VIDEO:       { emoji: '🎬', color: '#3B82F6', bgClass: 'bg-blue-50 border-blue-200', accentColor: '#3B82F6' },
  SPOKEN_WORD: { emoji: '🎤', color: '#F59E0B', bgClass: 'bg-amber-50 border-amber-200', accentColor: '#F59E0B' },
  PAINTING:    { emoji: '🎨', color: '#10B981', bgClass: 'bg-emerald-50 border-emerald-200', accentColor: '#10B981' },
  OTHER:       { emoji: '✨', color: '#6B7280', bgClass: 'bg-gray-50 border-gray-200', accentColor: '#6B7280' },
};

const TYPE_LABELS_ES = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };
const TYPE_LABELS_EN = { DANCE: 'Dance', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Painting', OTHER: 'Other' };

/**
 * @param {string} artType - e.g. 'DANCE', 'DRAMA', etc.
 * @param {string} statusLevel - 'complete' | 'partial' | 'empty'
 * @param {string} statusLabel - display text for badge
 * @param {boolean} defaultOpen - start expanded
 * @param {string} lang - 'es' | 'en'
 * @param {React.ReactNode} children - the form fields for this type
 */
export default function ArtsTypeSection({ artType, statusLevel, statusLabel, defaultOpen = false, lang = 'es', children }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = TYPE_META[artType] || TYPE_META.OTHER;
  const label = (lang === 'es' ? TYPE_LABELS_ES : TYPE_LABELS_EN)[artType] || artType;

  const statusBadgeClass = {
    complete: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    empty: 'bg-gray-100 text-gray-500',
  }[statusLevel] || 'bg-gray-100 text-gray-500';

  return (
    <div className={`rounded-lg border overflow-hidden ${meta.bgClass}`}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:brightness-95 active:brightness-90"
        style={{ minHeight: '48px' }}
      >
        <span className="text-lg">{meta.emoji}</span>
        <span className="flex-1 font-semibold text-sm" style={{ color: meta.color }}>{label}</span>
        {statusLabel && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
            {statusLabel}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: meta.color }} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: meta.accentColor + '30' }}>
          {children}
        </div>
      )}
    </div>
  );
}