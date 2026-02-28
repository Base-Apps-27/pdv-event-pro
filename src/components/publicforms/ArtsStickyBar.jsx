/**
 * ArtsStickyBar.jsx
 * 
 * Fixed bottom save bar that appears while a segment is open/active.
 * Shows segment name + save button. Mobile-first: full-width, safe-area-aware.
 * 
 * 2026-02-28: Created as part of Hybrid UX refactor (Option 5).
 */
import React from 'react';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsStickyBar({ segmentTitle, saving, onSave, saveMsg }) {
  const { t } = usePublicLang();

  if (!segmentTitle) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-area-bottom">
      <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{segmentTitle}</p>
          {saveMsg && (
            <p className={`text-xs font-medium mt-0.5 ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg.type === 'success' ? t('✅ Guardado', '✅ Saved') : '❌ Error'}
            </p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
          style={{ background: 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)' }}
        >
          {saving ? t('⏳ ...', '⏳ ...') : t('💾 GUARDAR', '💾 SAVE')}
        </button>
      </div>
    </div>
  );
}